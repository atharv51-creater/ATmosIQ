"""STEP 4 - Feature engineering: lags, rolling stats, wind, UPWIND EMITTER INDEX, calendar, static features, targets."""
from common import *

UPWIND_KM, HALF_ANGLE = 20.0, 45.0


def upwind_index(cells, emitters, wind_dir):
    """cells: DataFrame(lat,lon) N rows; emitters: (M,3) [lat,lon,weight]; wind_dir: (T,N) degrees wind blows FROM.
    Index = sum of emitter weights / (1+distance km) for emitters inside a +-45 deg cone pointing INTO the wind,
    within 20 km, i.e. sources whose plume is blowing toward the cell."""
    T, N = wind_dir.shape
    if len(emitters) == 0:
        return np.zeros((T, N))
    la, lo = cells.lat.values[:, None], cells.lon.values[:, None]
    dist = haversine_km(la, lo, emitters[None, :, 0], emitters[None, :, 1])           # N,M
    brg = bearing_deg(la, lo, emitters[None, :, 0], emitters[None, :, 1])             # N,M
    contrib = emitters[None, :, 2] / (1.0 + dist) * (dist <= UPWIND_KM)               # N,M
    out = np.zeros((T, N))
    for t in range(T):
        diff = np.abs((brg - wind_dir[t][:, None] + 180) % 360 - 180)
        out[t] = (contrib * (diff <= HALF_ANGLE)).sum(1)
    return out


def main():
    daily, static = load_df("daily"), load_df("static")
    em = np.array(load_json(DATA / "emitters.json")).reshape(-1, 3)
    daily["date"] = pd.to_datetime(daily["date"])
    static = static.sort_values("cell_id").reset_index(drop=True)

    # complete cell x date grid, fill short gaps
    full = pd.MultiIndex.from_product([static.cell_id, pd.date_range(daily.date.min(), daily.date.max())],
                                      names=["cell_id", "date"])
    df = daily.set_index(["cell_id", "date"]).reindex(full).reset_index().sort_values(["cell_id", "date"])
    num = [c for c in df.columns if c not in ("cell_id", "date")]
    df[num] = df.groupby("cell_id")[num].transform(lambda s: s.interpolate(limit=3, limit_direction="both"))
    df = df.dropna(subset=["pm25", "wind_dir"])

    # upwind emitter index (needs full cell x date matrix)
    wd = df.pivot(index="date", columns="cell_id", values="wind_dir").reindex(columns=static.cell_id).ffill().bfill()
    ui = upwind_index(static, em, wd.values)
    uidf = pd.DataFrame(ui, index=wd.index, columns=static.cell_id).stack().rename("upwind_idx").reset_index()
    df = df.merge(uidf, on=["date", "cell_id"], how="left")

    g = df.groupby("cell_id")
    for k in (1, 2, 7):
        df[f"pm25_lag{k}"] = g.pm25.shift(k)
    df["pm25_roll3"] = g.pm25.transform(lambda s: s.rolling(3).mean())
    df["pm25_roll7"] = g.pm25.transform(lambda s: s.rolling(7).mean())
    df["pm25_std7"] = g.pm25.transform(lambda s: s.rolling(7).std())
    df["pm25_trend"] = df.pm25 - df.pm25_lag1
    for c in ("no2", "pm10"):
        df[f"{c}_lag1"] = g[c].shift(1)
    df["rain_3d"] = g.rain.transform(lambda s: s.rolling(3, min_periods=1).sum())
    df["upwind_roll3"] = g.upwind_idx.transform(lambda s: s.rolling(3, min_periods=1).mean())
    df["ventilation"] = df.wind_speed * (1 + df.temp.clip(lower=0) / 40)       # crude ventilation proxy (no PBL data)
    df["city_pm25"] = df.groupby("date").pm25.transform("mean")
    df["dow"], df["month"], df["doy"] = df.date.dt.dayofweek, df.date.dt.month, df.date.dt.dayofyear
    df["season_sin"], df["season_cos"] = np.sin(2 * np.pi * df.doy / 365), np.cos(2 * np.pi * df.doy / 365)
    df["winter_flag"] = df.month.isin([11, 12, 1, 2]).astype(int)

    stat_cols = ["pop_density", "industry_frac", "road_km_per_km2", "green_frac", "dist_nearest_emitter_km",
                 "emit_5km", "emit_10km", "lat", "lon"]
    df = df.merge(static[["cell_id"] + stat_cols], on="cell_id", how="left")
    for h in HORIZONS:
        df[f"target_h{h}"] = df.groupby("cell_id").pm25.shift(-h)

    # reference stats so scoring normalises the same way every day
    ref = {"upwind_p95": float(df.upwind_idx.quantile(.95) or 1.0), "temp_min": float(df.temp.quantile(.02)),
           "temp_max": float(df.temp.quantile(.98))}
    dump_json(ref, DATA / "ref_stats.json")
    df = df.dropna(subset=["pm25_lag7", "pm25_std7"]).reset_index(drop=True)   # warm-up rows (keeps latest rows w/o targets)
    save_df(df, "features")
    print(f"features: {df.shape}, {df.date.min().date()} -> {df.date.max().date()}")


if __name__ == "__main__":
    main()
