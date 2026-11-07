"""STEP 6 - Run forecasts for the latest day (t+1..t+3) + SHAP explanations of the forecast model."""
import re, joblib
from common import *

LABELS = {"pm25": "today's PM2.5", "pm25_lag1": "PM2.5 yesterday", "pm25_lag2": "PM2.5 2 days ago",
          "pm25_lag7": "PM2.5 a week ago", "pm25_roll3": "3-day avg PM2.5", "pm25_roll7": "7-day avg PM2.5",
          "pm25_std7": "recent PM2.5 volatility", "pm25_trend": "PM2.5 day-on-day change", "pm25_max": "peak hourly PM2.5",
          "pm10": "PM10", "no2": "NO2", "so2": "SO2", "co": "CO", "o3": "ozone", "temp": "temperature",
          "rh": "humidity", "rain": "rainfall", "rain_3d": "3-day rainfall", "wind_u": "east-west wind",
          "wind_v": "north-south wind", "wind_speed": "wind speed", "wind_dir": "wind direction",
          "upwind_idx": "upwind emitters", "upwind_roll3": "3-day upwind emitters", "ventilation": "ventilation",
          "city_pm25": "city-wide PM2.5", "winter_flag": "winter stagnation season", "emit_5km": "emitters within 5 km",
          "emit_10km": "emitters within 10 km", "industry_frac": "industrial land share",
          "road_km_per_km2": "major-road density", "green_frac": "green cover", "pop_density": "population density",
          "dist_nearest_emitter_km": "distance to nearest emitter", "no2_lag1": "NO2 yesterday", "pm10_lag1": "PM10 yesterday"}


def label(f):
    return LABELS.get(f, f.replace("_", " "))


def contributions(model, X, feats):
    """Per-row feature contributions. SHAP TreeExplainer if available, else a clearly-labelled approximation."""
    try:
        import shap
        return shap.TreeExplainer(model).shap_values(X), "shap"
    except Exception as ex:
        print(f"WARNING: SHAP unavailable ({type(ex).__name__}); using importance x z-score approximation")
        imp = load_json(MODELS / "rf_importance.json")
        z = (X - X.mean()) / (X.std() + 1e-9)
        return z.values * np.array([imp.get(f, 0) for f in feats]) * X["pm25"].mean(), "approx"


def main():
    feat = load_df("features")
    feat["date"] = pd.to_datetime(feat["date"])
    feats = load_json(MODELS / "feature_cols.json")
    last = feat.date.max()
    cur = feat[feat.date == last].reset_index(drop=True)
    X = cur[feats]
    fc = cur[["cell_id", "date"]].copy()
    for h in HORIZONS:
        fc[f"pred_h{h}"] = np.clip(joblib.load(MODELS / f"gbm_h{h}.joblib").predict(X), 0, None)
    save_df(fc, "forecast_latest")

    m1 = joblib.load(MODELS / f"gbm_h{HORIZONS[0]}.joblib")
    sv, method = contributions(m1, X, feats)
    shap_cells = {}
    for i, cid in enumerate(cur.cell_id):
        idx = np.argsort(-np.abs(sv[i]))[:3]
        shap_cells[cid] = [{"feature": feats[j], "label": label(feats[j]), "value": round(float(X.iloc[i, j]), 2),
                            "shap": round(float(sv[i, j]), 2),
                            "text": f"{label(feats[j])} ({sv[i, j]:+.1f} ug/m3)"} for j in idx]
    # global importance on a recent sample
    samp = feat[feat.date > last - pd.Timedelta(days=90)].sample(min(1500, len(feat)), random_state=0)
    sg, _ = contributions(m1, samp[feats], feats)
    gi = sorted(zip(feats, np.abs(sg).mean(0)), key=lambda x: -x[1])[:12]
    dump_json({"method": method, "global": [{"feature": f, "label": label(f), "mean_abs": round(float(v), 3)} for f, v in gi]},
              OUT / "shap_global.json")
    dump_json({"method": method, "cells": shap_cells}, OUT / "shap_latest.json")

    # history + forecast series per cell for the line chart
    hist = {}
    for cid, g in feat[feat.date > last - pd.Timedelta(days=30)].groupby("cell_id"):
        f = fc[fc.cell_id == cid].iloc[0]
        hist[cid] = {"dates": [d.strftime("%Y-%m-%d") for d in g.date], "pm25": [round(v, 1) for v in g.pm25],
                     "forecast_dates": [(last + pd.Timedelta(days=h)).strftime("%Y-%m-%d") for h in HORIZONS],
                     "forecast_pm25": [round(float(f[f"pred_h{h}"]), 1) for h in HORIZONS]}
    dump_json(hist, OUT / "history.json")
    print(f"Forecast for {last.date()} +{HORIZONS} days done. Explanation method: {method}")


if __name__ == "__main__":
    main()
