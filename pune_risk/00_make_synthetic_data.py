"""OPTIONAL - create synthetic daily.parquet / static.parquet / emitters.json so you can test the whole pipeline
offline (steps 4-7). Synthetic data is NOT real; never present results from it."""
from common import *
rng = np.random.default_rng(42)
grid = load_json(DATA / "grid.geojson")
cells = pd.DataFrame([f["properties"] for f in grid["features"]])
n = len(cells)
d = haversine_km(cells.lat.values, cells.lon.values, *CITY_CENTER)
st = cells.copy()
st["pop_is_proxy"] = True
st["pop"] = 25000 * np.exp(-d / 7) + rng.uniform(200, 2000, n)
st["pop_density"] = st["pop"] / 5.0
em = np.column_stack([rng.uniform(BBOX[0], BBOX[2], 25), rng.uniform(BBOX[1], BBOX[3], 25), rng.choice([1, 2, 3], 25)])
D = haversine_km(st.lat.values[:, None], st.lon.values[:, None], em[None, :, 0], em[None, :, 1])
st["industry_frac"] = np.clip(rng.beta(1, 8, n) + (D.min(1) < 2) * 0.2, 0, 1)
st["road_km_per_km2"] = rng.uniform(0.5, 6, n)
st["green_frac"] = np.clip(rng.beta(2, 6, n), 0, 1)
st["dist_nearest_emitter_km"] = D.min(1)
st["emit_5km"] = ((D <= 5) * em[None, :, 2]).sum(1)
st["emit_10km"] = ((D <= 10) * em[None, :, 2]).sum(1)
st["group_id"] = st.groupby([st.lat.round(1), st.lon.round(1)]).ngroup()
save_df(st, "static"); dump_json(em.tolist(), DATA / "emitters.json")

dates = pd.date_range("2024-01-01", periods=600)
t = np.arange(len(dates))
season = 45 + 35 * np.cos(2 * np.pi * (t - 20) / 365)           # winter peak
rows = []
for g, sub in st.groupby("group_id"):
    ar = np.zeros(len(t)); e = rng.normal(0, 8, len(t))
    for i in range(1, len(t)):
        ar[i] = 0.75 * ar[i - 1] + e[i]
    wd = (rng.uniform(0, 360) + np.cumsum(rng.normal(0, 25, len(t)))) % 360
    ws = np.clip(rng.gamma(3, 1.0, len(t)), 0.3, 12)
    base = np.clip(season + ar - 2.5 * ws, 3, None)
    for _, c in sub.iterrows():
        loc = 1 + 0.02 * c.emit_5km + 0.4 * c.industry_frac
        pm = np.clip(base * loc + rng.normal(0, 2, len(t)), 1, None)
        rows.append(pd.DataFrame({"cell_id": c.cell_id, "date": dates, "pm25": pm, "pm25_max": pm * 1.4,
            "pm10": pm * 1.8, "no2": 12 + 0.3 * pm + rng.normal(0, 3, len(t)), "so2": 5 + rng.normal(0, 1, len(t)),
            "co": 300 + 3 * pm, "o3": 40 + rng.normal(0, 8, len(t)), "temp": 26 + 5 * np.sin(2 * np.pi * (t - 90) / 365),
            "rh": 55 + 20 * rng.random(len(t)), "rain": np.clip(rng.normal(0, 2, len(t)), 0, None),
            "wind_u": -ws * np.sin(np.radians(wd)), "wind_v": -ws * np.cos(np.radians(wd)),
            "wind_speed": ws, "wind_dir": wd}))
save_df(pd.concat(rows), "daily")
print("Synthetic data written (NOT REAL).")
