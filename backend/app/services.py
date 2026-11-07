"""All business logic (framework-free, unit-testable). Operates on the pipeline's output files."""
import copy
import hashlib
from .store import DataStore

CLASSES = [(0, 25, "Low"), (25, 50, "Moderate"), (50, 75, "High"), (75, 100.01, "Critical")]
LEVEL_ORDER = {"Low": 0, "Moderate": 1, "High": 2, "Critical": 3}
HORIZON_DAYS = (0, 1, 2, 3)


def classify(score):
    for lo, hi, name in CLASSES:
        if lo <= score < hi:
            return name
    return "Critical"


def parse_horizon(h):
    """Accepts hours (0, 24, 48, 72) or days (0..3)."""
    d = h // 24 if h >= 24 else h
    if (h >= 24 and h % 24) or d not in HORIZON_DAYS:
        raise ValueError("horizon must be one of 0, 24, 48, 72 (hours) or 0, 1, 2, 3 (days)")
    return d


def normalise_weights(w):
    s = sum(w.values())
    if s <= 0:
        raise ValueError("weights must sum to more than 0")
    return {k: v / s for k, v in w.items()}


def recommend_action(row):
    cls, trend = row["risk_class"], row.get("trend", 0)
    industrial = row.get("industry_frac", 0) > 0.05 or row.get("emit_5km", 0) >= 4
    if cls == "Critical" and industrial:
        return "Immediate: deploy mobile sensor + inspect nearby/upwind industrial sources; issue health advisory"
    if cls == "Critical":
        return "Immediate: public health advisory, deploy sensors, curb dust/traffic sources"
    if cls == "High" and industrial:
        return "Inspect industrial emitters within 5 km; increase monitoring frequency"
    if cls == "High":
        return "Targeted traffic/dust control; alert vulnerable groups (schools, hospitals)"
    if cls == "Moderate" and trend >= 5:
        return "Watchlist: risk rising - pre-position monitoring, advisory for sensitive groups"
    if cls == "Moderate":
        return "Routine monitoring"
    return "No action needed"


class RiskService:
    def __init__(self, store: DataStore, default_weights: dict):
        self.store, self.default_weights = store, normalise_weights(default_weights)

    # ---------------------------------------------------------------- zones
    def _zones_raw(self, d):
        return self.store.get(f"zones_h{d}.geojson")

    def _score(self, props, w):
        return round(max(0.0, min(100.0, 100 * (w["hazard"] * props["hazard"] + w["exposure"] * props["exposure"]
                                                 + w["vulnerability"] * props["vulnerability"]))), 1)

    def zones(self, horizon=0, weights=None, min_class=None):
        d = parse_horizon(horizon)
        gj = copy.deepcopy(self._zones_raw(d))
        w = normalise_weights(weights) if weights else None
        feats = []
        for f in gj["features"]:
            p = f["properties"]
            if w:
                p["score"] = self._score(p, w)
                p["risk_class"] = classify(p["score"])
            if min_class and LEVEL_ORDER[p["risk_class"]] < LEVEL_ORDER[min_class]:
                continue
            feats.append(f)
        gj["features"] = feats
        gj["meta"] = {"horizon_days": d, "weights": w or self.default_weights, "custom_weights": bool(w),
                      "data_date": self.summary().get("data_date"), "count": len(feats)}
        return gj

    def zone_detail(self, cell_id):
        details = self.store.get("zone_details.json")
        if cell_id not in details:
            return None
        feat = next(f for f in self._zones_raw(0)["features"] if f["properties"]["cell_id"] == cell_id)
        pq = next((r for r in self.store.get("priority_queue.json") if r["cell_id"] == cell_id), {})
        return {"cell_id": cell_id, "geometry": feat["geometry"], "current": feat["properties"],
                "centroid": {"lat": pq.get("lat"), "lon": pq.get("lon")}, "priority": pq, **details[cell_id]}

    def forecast(self, cell_id):
        det = self.store.get("zone_details.json").get(cell_id)
        if det is None:
            return None
        hist = det.get("history") or {}
        out = []
        for i, d in enumerate((1, 2, 3)):
            props = next(f["properties"] for f in self._zones_raw(d)["features"] if f["properties"]["cell_id"] == cell_id)
            dates, pm = hist.get("forecast_dates", []), hist.get("forecast_pm25", [])
            out.append({"horizon_days": d, "date": dates[i] if i < len(dates) else props["date"],
                        "pm25": pm[i] if i < len(pm) else props["pm25"], "score": props["score"],
                        "risk_class": props["risk_class"]})
        return {"cell_id": cell_id, "history": {"dates": hist.get("dates", []), "pm25": hist.get("pm25", [])},
                "forecast": out, "forecast_drivers": det.get("forecast_drivers", [])}

    # ------------------------------------------------------ priority queue
    def _scores_by_cell(self, weights):
        w = normalise_weights(weights) if weights else None
        res = {}
        for d in HORIZON_DAYS:
            for f in self._zones_raw(d)["features"]:
                p = f["properties"]
                res.setdefault(p["cell_id"], {})[d] = self._score(p, w) if w else p["score"]
        return res

    def priority_queue(self, horizon=None, weights=None, limit=None, risk_class=None):
        """horizon=None ranks by the worst of now..+3d; otherwise by that horizon. Rank = score x population."""
        d_sel = parse_horizon(horizon) if horizon is not None else None
        scores = self._scores_by_cell(weights)
        rows = []
        for r in self.store.get("priority_queue.json"):
            s = scores[r["cell_id"]]
            sel = max(s.values()) if d_sel is None else s[d_sel]
            row = {k: r[k] for k in ("cell_id", "lat", "lon", "pop", "industry_frac", "emit_5km", "top_factors")}
            row.update({"score_now": s[0], **{f"score_h{d}": s[d] for d in (1, 2, 3)}, "score_ranked": sel,
                        "trend": round(s[3] - s[0], 1), "risk_class": classify(sel), "priority_raw": sel * r["pop"]})
            row["action"] = recommend_action(row)
            rows.append(row)
        rows.sort(key=lambda x: -x["priority_raw"])
        top = rows[0]["priority_raw"] or 1
        for i, row in enumerate(rows, 1):
            row["rank"] = i
            row["priority_index"] = round(100 * row.pop("priority_raw") / top, 1)
        if risk_class:
            rows = [r for r in rows if r["risk_class"] == risk_class]
        return rows[:limit] if limit else rows

    # ----------------------------------------------------------- misc data
    def wind(self):
        return self.store.get("wind_latest.json")

    def summary(self):
        return self.store.get("summary.json")

    def metrics(self):
        return self.store.get("metrics.json")

    def shap_global(self):
        return self.store.get("shap_global.json")

    def what_if(self, weights, horizon=0, top=10):
        d = parse_horizon(horizon)
        gj = self.zones(d, weights)
        counts = {}
        for f in gj["features"]:
            c = f["properties"]["risk_class"]; counts[c] = counts.get(c, 0) + 1
        return {"weights": gj["meta"]["weights"], "horizon_days": d, "class_counts": counts,
                "mean_score": round(sum(f["properties"]["score"] for f in gj["features"]) / max(1, len(gj["features"])), 1),
                "zones": gj, "priority_queue": self.priority_queue(horizon=None if d == 0 else d, weights=weights, limit=top)}

    # -------------------------------------------------------------- alerts
    def alerts(self, min_level="watch"):
        order = {"watch": 0, "warning": 1, "critical": 2}
        date = self.summary().get("data_date", "")
        out = []
        for r in self.priority_queue():
            now_c, peak_c = classify(r["score_now"]), r["risk_class"]
            if now_c == "Critical":
                level, msg = "critical", f"Zone {r['cell_id']} is CRITICAL now (risk {r['score_now']})."
            elif LEVEL_ORDER[peak_c] >= 2:
                level, msg = "warning", f"Zone {r['cell_id']} expected to reach {peak_c.upper()} (peak risk {r['score_ranked']}) within 3 days."
            elif r["trend"] >= 5 and now_c == "Moderate":
                level, msg = "watch", f"Zone {r['cell_id']} risk rising +{r['trend']} points over 3 days."
            else:
                continue
            if order[level] < order[min_level]:
                continue
            out.append({"alert_id": hashlib.md5(f"{r['cell_id']}{level}{date}".encode()).hexdigest()[:10],
                        "zone_id": r["cell_id"], "level": level, "message": msg, "created_at": date,
                        "score_now": r["score_now"], "score_peak": r["score_ranked"], "population": r["pop"],
                        "drivers": r["top_factors"], "recommended_action": r["action"], "rank": r["rank"]})
        out.sort(key=lambda a: (-order[a["level"]], a["rank"]))
        return out

    @staticmethod
    def format_alert_text(alerts, max_items=5):
        if not alerts:
            return "No active environmental risk alerts."
        lines = [f"Environmental Risk Alerts ({len(alerts)} active)"]
        for a in alerts[:max_items]:
            lines.append(f"[{a['level'].upper()}] {a['message']} Pop ~{int(a['population']):,}. "
                         f"Drivers: {'; '.join(a['drivers'])}. Action: {a['recommended_action']}")
        return "\n".join(lines)
