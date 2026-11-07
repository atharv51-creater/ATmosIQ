"""STEP 7 - Risk score (current + forecast), classes, priority queue with actions, GeoJSON outputs for the API/frontend."""
from common import *
from risk_engine import compute_scores, recommend_action, top_drivers, classify


def main():
    feat = load_df("features"); feat["date"] = pd.to_datetime(feat["date"])
    fc, static, ref = load_df("forecast_latest"), load_df("static"), load_json(DATA / "ref_stats.json")
    shap = load_json(OUT / "shap_latest.json")["cells"]
    grid = {f["properties"]["cell_id"]: f["geometry"] for f in load_json(DATA / "grid.geojson")["features"]}
    last = feat.date.max()
    base = feat[feat.date == last].merge(fc.drop(columns="date"), on="cell_id").merge(static[["cell_id", "pop"]], on="cell_id")

    S = {0: compute_scores(base, ref)}
    for h in HORIZONS:                                   # forecast scenario: swap in predicted PM2.5, co-scale NO2
        sc = base.copy()
        ratio = np.clip(sc[f"pred_h{h}"] / sc.pm25.clip(lower=1), 0.5, 2.0)
        sc["pm25"], sc["no2"] = sc[f"pred_h{h}"], sc.no2 * ratio
        S[h] = compute_scores(sc, ref)
    hmax = max(HORIZONS)

    # GeoJSON per horizon
    for h, d in S.items():
        feats_out = []
        for _, r in d.iterrows():
            props = {"cell_id": r.cell_id, "horizon_days": h, "date": str((last + pd.Timedelta(days=h)).date()),
                     "score": r.score, "risk_class": r.risk_class, "hazard": round(r.hazard, 3),
                     "exposure": round(r.exposure, 3), "vulnerability": round(r.vulnerability, 3),
                     "pm25": round(r.pm25, 1), "aqi_est": round(r.aqi_est), "population": int(r["pop"]),
                     "top_factors": top_drivers(r), "forecast_drivers": [x["text"] for x in shap[r.cell_id]]}
            feats_out.append({"type": "Feature", "geometry": grid[r.cell_id], "properties": props})
        dump_json({"type": "FeatureCollection", "features": feats_out}, OUT / f"zones_h{h}.geojson")

    # priority queue: risk (now or peak forecast) x population exposed
    q = S[0][["cell_id", "lat", "lon", "pop", "score", "risk_class", "industry_frac", "emit_5km"]].rename(
        columns={"score": "score_now", "risk_class": "class_now"})
    for h in HORIZONS:
        q[f"score_h{h}"] = S[h].score.values
    q["score_peak"] = q[["score_now"] + [f"score_h{h}" for h in HORIZONS]].max(axis=1)
    q["trend"] = (q[f"score_h{hmax}"] - q.score_now).round(1)
    q["class_peak"] = q.score_peak.map(classify)
    q["priority_raw"] = q.score_peak * q["pop"]
    q["priority_index"] = (100 * q.priority_raw / q.priority_raw.max()).round(1)
    q["risk_class"] = q.class_peak
    q["action"] = q.apply(recommend_action, axis=1)
    q = q.sort_values("priority_raw", ascending=False).reset_index(drop=True)
    q.insert(0, "rank", q.index + 1)
    q["top_factors"] = q.cell_id.map({r.cell_id: top_drivers(r) for _, r in S[0].iterrows()})
    dump_json(q.drop(columns=["risk_class", "priority_raw"]).to_dict("records"), OUT / "priority_queue.json")

    # zone details + wind + summary
    hist = load_json(OUT / "history.json")
    details = {}
    for _, r in S[0].iterrows():
        details[r.cell_id] = {"scores": {f"h{h}": S[h].set_index("cell_id").loc[r.cell_id, "score"] for h in S},
                              "components": {k: round(r[k], 3) for k in ("hazard", "exposure", "vulnerability")},
                              "points": {k: round(r[k], 1) for k in r.index if k.startswith("pts_")},
                              "top_factors": top_drivers(r), "forecast_drivers": shap[r.cell_id],
                              "history": hist.get(r.cell_id)}
    dump_json(details, OUT / "zone_details.json")
    dump_json(base[["cell_id", "lat", "lon", "wind_u", "wind_v", "wind_speed", "wind_dir"]].round(3).to_dict("records"),
              OUT / "wind_latest.json")
    cnt = S[0].risk_class.value_counts().to_dict()
    dump_json({"city": CITY, "data_date": str(last.date()), "weights": WEIGHTS, "class_counts_now": cnt,
               "mean_score_now": round(S[0].score.mean(), 1), "mean_score_h%d" % hmax: round(S[hmax].score.mean(), 1),
               "population_in_high_or_critical": int(S[hmax][S[hmax].risk_class.isin(["High", "Critical"])]["pop"].sum())},
              OUT / "summary.json")
    print("Risk outputs written to output/. Class counts now:", cnt)
    print(q[["rank", "cell_id", "score_now", f"score_h{hmax}", "class_peak", "pop", "action"]].head(5).to_string(index=False))


if __name__ == "__main__":
    main()
