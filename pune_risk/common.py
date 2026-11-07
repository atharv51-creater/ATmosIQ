"""Shared config + helpers. Edit the CONFIG block to change city/dates/weights."""
from pathlib import Path
from datetime import date, timedelta
import json
import numpy as np
import pandas as pd

ROOT = Path(__file__).parent
DATA, OUT, MODELS = ROOT / "data", ROOT / "output", ROOT / "models"
RAW = DATA / "raw"
for p in (DATA, OUT, MODELS, RAW):
    p.mkdir(parents=True, exist_ok=True)

# ----------------------------- CONFIG ---------------------------------
CITY = "Pune Metro (PMC + PCMC)"
BBOX = (18.45, 73.72, 18.65, 73.95)        # south, west, north, east
CITY_CENTER = (18.5204, 73.8567)
H3_RES = 7                                  # ~5 km2 hexagons
START_DATE = "2024-01-01"                   # Open-Meteo air quality starts mid-2022
END_DATE = (date.today() - timedelta(days=1)).isoformat()
HORIZONS = [1, 2, 3]                        # forecast days ahead
WEIGHTS = {"hazard": 0.5, "exposure": 0.3, "vulnerability": 0.2}
CLASSES = [(0, 25, "Low"), (25, 50, "Moderate"), (50, 75, "High"), (75, 100.01, "Critical")]
# -----------------------------------------------------------------------


def save_df(df, name):
    """Parquet if pyarrow is available, otherwise gzipped CSV (same name stem)."""
    try:
        df.to_parquet(DATA / f"{name}.parquet", index=False)
    except Exception:
        df.to_csv(DATA / f"{name}.csv.gz", index=False)


def load_df(name):
    pq, cs = DATA / f"{name}.parquet", DATA / f"{name}.csv.gz"
    if pq.exists():
        return pd.read_parquet(pq)
    if cs.exists():
        df = pd.read_csv(cs)
        if "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"])
        return df
    raise FileNotFoundError(f"{name} not found in {DATA}. Run the earlier pipeline steps first.")


def dump_json(obj, path):
    with open(path, "w") as f:
        json.dump(obj, f, default=lambda o: o.item() if hasattr(o, "item") else str(o))


def load_json(path):
    with open(path) as f:
        return json.load(f)


def haversine_km(lat1, lon1, lat2, lon2):
    """Vectorised; broadcasts arrays."""
    r = 6371.0
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi, dl = p2 - p1, np.radians(lon2) - np.radians(lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 2 * r * np.arcsin(np.sqrt(a))


def bearing_deg(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dl = np.radians(lon2) - np.radians(lon1)
    y = np.sin(dl) * np.cos(p2)
    x = np.cos(p1) * np.sin(p2) - np.sin(p1) * np.cos(p2) * np.cos(dl)
    return (np.degrees(np.arctan2(y, x)) + 360) % 360
