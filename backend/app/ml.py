"""Serving layer for the trained PM2.5 forecast models.

The pipeline (pune_risk/) writes three artefacts that this module consumes:

* ``pune_risk/models/gbm_h{1,2,3}.joblib`` - trained XGBoost (or sklearn GBM) regressors
* ``pune_risk/models/feature_cols.json``    - ordered feature columns expected by the models
* ``pune_risk/data/features.parquet``       - engineered features for every cell/day
* ``pune_risk/data/forecast_latest.parquet``- pre-computed +1/+2/+3 day predictions

When ``joblib``/``xgboost`` are importable we score the latest feature row live so
the API is genuinely running the model.  When they are not installed we still
serve the last pipeline forecast and say so explicitly in ``/model/status``
(no silent fallback).
"""
from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

ROOT = Path(__file__).resolve().parent.parent.parent
PIPELINE = ROOT / "pune_risk"
MODELS = PIPELINE / "models"
DATA = PIPELINE / "data"
OUTPUT = PIPELINE / "output"

HORIZONS = (1, 2, 3)
_LOCK = threading.Lock()
_CACHE: dict[str, Any] = {}


def _mtime(path: Path) -> float:
    return path.stat().st_mtime if path.exists() else 0.0


def _load_joblib():
    try:
        import joblib  # noqa: F401
    except Exception:
        return None
    return joblib


def _model_files() -> dict[str, bool]:
    return {f"gbm_h{h}": (MODELS / f"gbm_h{h}.joblib").exists() for h in HORIZONS}


def _feature_cols() -> list[str]:
    path = MODELS / "feature_cols.json"
    if not path.exists():
        return []
    return json.loads(path.read_text())


def _models_cached() -> Optional[dict[str, Any]]:
    """Load and cache the three joblib models. Returns None if it is not possible."""
    joblib = _load_joblib()
    if joblib is None or not all(_model_files().values()):
        return None
    stamp = tuple(_mtime(MODELS / f"gbm_h{h}.joblib") for h in HORIZONS)
    with _LOCK:
        hit = _CACHE.get("models")
        if hit and hit[0] == stamp:
            return hit[1]
        try:
            models = {h: joblib.load(MODELS / f"gbm_h{h}.joblib") for h in HORIZONS}
        except Exception as exc:  # xgboost missing / version mismatch
            _CACHE["models_error"] = f"{type(exc).__name__}: {exc}"
            return None
        _CACHE["models"] = (stamp, models)
        _CACHE.pop("models_error", None)
        return models


def _latest_features() -> Optional[Any]:
    path = DATA / "features.parquet"
    if not path.exists():
        return None
    stamp = _mtime(path)
    with _LOCK:
        hit = _CACHE.get("features")
        if hit and hit[0] == stamp:
            return hit[1]
    import pandas as pd

    df = pd.read_parquet(path)
    df["date"] = pd.to_datetime(df["date"])
    with _LOCK:
        _CACHE["features"] = (stamp, df)
    return df


def status() -> dict[str, Any]:
    """Health of the ML serving stack (does not raise if artefacts are absent)."""
    models = _models_cached()
    joblib = _load_joblib()
    engine = "precomputed"
    if models is not None:
        first = models[HORIZONS[0]]
        engine = type(first).__module__.split(".")[0] or "sklearn"

    feats = _feature_cols()
    latest = DATA / "forecast_latest.parquet"
    metrics = OUTPUT / "metrics.json"
    data_date = None
    if latest.exists():
        try:
            import pandas as pd

            data_date = str(pd.read_parquet(latest, columns=["date"])["date"].max())[:10]
        except Exception:
            data_date = None

    return {
        "engine": engine,
        "live_inference": models is not None,
        "joblib_available": joblib is not None,
        "model_files": _model_files(),
        "feature_count": len(feats),
        "features_available": (DATA / "features.parquet").exists(),
        "forecast_available": latest.exists(),
        "metrics_available": metrics.exists(),
        "data_date": data_date,
        "horizons": list(HORIZONS),
        "load_error": _CACHE.get("models_error"),
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


def forecast_latest() -> dict[str, Any]:
    """Pre-computed ``+1/+2/+3`` day predictions from the last pipeline run."""
    path = DATA / "forecast_latest.parquet"
    if not path.exists():
        raise FileNotFoundError(
            "forecast_latest.parquet missing. Run `python run_all.py` inside pune_risk/ first."
        )
    import pandas as pd

    df = pd.read_parquet(path)
    df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    rows = []
    for row in df.sort_values(["cell_id"]).to_dict("records"):
        rows.append(
            {
                "cell_id": row["cell_id"],
                "date": row["date"],
                "pred_h1": round(float(row.get("pred_h1", 0)), 2),
                "pred_h2": round(float(row.get("pred_h2", 0)), 2),
                "pred_h3": round(float(row.get("pred_h3", 0)), 2),
            }
        )
    return {
        "source": "forecast_latest.parquet",
        "engine": status()["engine"],
        "generated_at": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
        "horizons": list(HORIZONS),
        "count": len(rows),
        "predictions": rows,
    }


def predict_zone(cell_id: str) -> Optional[dict[str, Any]]:
    """Live score one zone with the trained models, falling back to the last run.

    Returns ``None`` when the zone is not present in the feature table.
    """
    df = _latest_features()
    if df is None:
        pre = forecast_latest()["predictions"]
        hit = next((r for r in pre if r["cell_id"] == cell_id), None)
        if hit is None:
            return None
        return {"cell_id": cell_id, "mode": "precomputed", "engine": "precomputed", "date": hit["date"],
                "predictions": [hit[f"pred_h{h}"] for h in HORIZONS]}

    last = df["date"].max()
    current = df[(df["date"] == last) & (df["cell_id"] == cell_id)]
    if current.empty:
        return None

    feats = _feature_cols()
    models = _models_cached()
    if models is None or not feats:
        pre = forecast_latest()["predictions"]
        hit = next((r for r in pre if r["cell_id"] == cell_id), None)
        if hit is None:
            return None
        return {"cell_id": cell_id, "mode": "precomputed", "engine": "precomputed",
                "date": hit["date"], "predictions": [hit[f"pred_h{h}"] for h in HORIZONS]}

    X = current[feats]
    preds = [round(float(max(0.0, models[h].predict(X)[0])), 2) for h in HORIZONS]
    actual = current.iloc[0].get("pm25")
    return {
        "cell_id": cell_id,
        "mode": "live",
        "engine": type(models[HORIZONS[0]]).__module__.split(".")[0] or "sklearn",
        "date": last.strftime("%Y-%m-%d"),
        "input_pm25": None if actual is None else round(float(actual), 2),
        "predictions": preds,
        "horizons": list(HORIZONS),
    }


def explain_zone(cell_id: str) -> Optional[dict[str, Any]]:
    """SHAP-style drivers for the +1 day forecast of one zone."""
    path = OUTPUT / "shap_latest.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    drivers = (data.get("cells") or {}).get(cell_id)
    if drivers is None:
        return None
    return {"cell_id": cell_id, "method": data.get("method", "shap"), "drivers": drivers}
