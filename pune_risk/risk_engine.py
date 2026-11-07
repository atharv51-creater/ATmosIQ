"""Explainable risk score: Score = 100 * (wH*Hazard + wE*Exposure + wV*Vulnerability), each term in 0..1.
Reusable by the backend (POST /weights recomputes scores with custom weights)."""
from common import *

# CPCB AQI breakpoints (24h avg, ug/m3) -> sub-index
PM25_X, PM25_AQI = [0, 30, 60, 90, 120, 250, 500], [0, 50, 100, 200, 300, 400, 500]
NO2_X, NO2_AQI = [0, 40, 80, 180, 280, 400, 800], [0, 50, 100, 200, 300, 400, 500]


def pm25_subindex(x): return np.interp(x, PM25_X, PM25_AQI)
def no2_subindex(x): return np.interp(x, NO2_X, NO2_AQI)


def classify(score):
    for lo, hi, name in CLASSES:
        if lo <= score < hi:
            return name
    return "Critical"


def compute_scores(df, ref, weights=None):
    """df needs: pm25, no2, pop_density, upwind_idx, green_frac, temp, emit_5km, industry_frac.
    Returns df with hazard, exposure, vulnerability (0..1), score (0..100), risk_class."""
    w = weights or WEIGHTS
    s = sum(w.values()); w = {k: v / s for k, v in w.items()}        # normalise so sliders always sum to 1
    out = df.copy()
    aqi = np.maximum(pm25_subindex(out.pm25), no2_subindex(out.no2))
    pollution = np.clip(aqi / 300.0, 0, 1)                           # AQI 300 ("very poor") -> 1.0
    emit_pressure = np.clip(0.6 * out.emit_5km.rank(pct=True) + 0.4 * out.industry_frac.rank(pct=True), 0, 1)
    out["aqi_est"] = aqi
    out["hazard"] = 0.8 * pollution + 0.2 * emit_pressure
    pd_log = np.log1p(out.pop_density)
    pop_n = (pd_log - pd_log.min()) / (pd_log.max() - pd_log.min() + 1e-9)
    wind_n = np.clip(out.upwind_idx / (ref["upwind_p95"] + 1e-9), 0, 1)
    out["exposure"] = pop_n * (0.5 + 0.5 * wind_n)                   # people x downwind pollutant transport
    low_green = 1 - np.clip(out.green_frac / 0.30, 0, 1)
    heat = np.clip((out.temp - ref["temp_min"]) / (ref["temp_max"] - ref["temp_min"] + 1e-9), 0, 1)
    out["vulnerability"] = 0.6 * low_green + 0.4 * heat
    # exact point decomposition of the score (used for "top reasons" text)
    out["pts_pollution"] = 100 * w["hazard"] * 0.8 * pollution
    out["pts_emission"] = 100 * w["hazard"] * 0.2 * emit_pressure
    out["pts_population"] = 100 * w["exposure"] * pop_n * 0.5
    out["pts_wind"] = 100 * w["exposure"] * pop_n * 0.5 * wind_n
    out["pts_green"] = 100 * w["vulnerability"] * 0.6 * low_green
    out["pts_heat"] = 100 * w["vulnerability"] * 0.4 * heat
    out["score"] = 100 * (w["hazard"] * out.hazard + w["exposure"] * out.exposure + w["vulnerability"] * out.vulnerability)
    out["score"] = out.score.clip(0, 100).round(1)
    out["risk_class"] = out.score.map(classify)
    return out


def recommend_action(row):
    """Simple, transparent rule table (editable)."""
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


DRIVER_LABELS = {"pts_pollution": "High PM2.5/NO2 pollution", "pts_emission": "Nearby industrial/emission sources",
                 "pts_population": "Dense population", "pts_wind": "Wind carrying pollution from emitters",
                 "pts_green": "Low green cover", "pts_heat": "Heat stress"}


def top_drivers(row, k=3):
    pts = sorted(((c, row[c]) for c in DRIVER_LABELS), key=lambda x: -x[1])[:k]
    return [f"{DRIVER_LABELS[c]} (+{v:.0f})" for c, v in pts]
