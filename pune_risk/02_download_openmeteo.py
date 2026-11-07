"""STEP 2 - Download hourly air quality + weather from Open-Meteo (free, no key), aggregate to DAILY per cell.
Air quality = Copernicus CAMS model output. Weather = ERA5-Land archive + forecast API for the last days.
Cells are snapped to a 0.1 deg query grid (native model resolution) so we make few API calls. Raw batches are cached,
so re-running resumes where it stopped."""
import time, hashlib
import requests
from common import *

AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
WX_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
WX_FORECAST = "https://api.open-meteo.com/v1/forecast"
AQ_VARS = ["pm2_5", "pm10", "nitrogen_dioxide", "sulphur_dioxide", "carbon_monoxide", "ozone"]
WX_VARS = ["temperature_2m", "relative_humidity_2m", "wind_speed_10m", "wind_direction_10m", "precipitation"]
BATCH, CHUNK_DAYS = 5, 180


def call(url, params, tries=6):
    for i in range(tries):
        try:
            r = requests.get(url, params=params, timeout=90)
        except requests.exceptions.RequestException as e:
            wait = 15 * (i + 1)
            print(f"   network error ({type(e).__name__}), waiting {wait}s ...")
            time.sleep(wait)
            continue
        if r.status_code == 200:
            try:
                return r.json()
            except ValueError:
                wait = 15 * (i + 1)
                print(f"   invalid JSON response, waiting {wait}s ...")
                time.sleep(wait)
                continue
        if r.status_code == 429 or r.status_code >= 500:
            wait = 15 * (i + 1)
            print(f"   HTTP {r.status_code}, waiting {wait}s ...")
            time.sleep(wait)
            continue
        raise RuntimeError(f"{r.status_code}: {r.text[:300]}")
    raise RuntimeError("Open-Meteo kept failing; try again later (rate limit).")


def fetch(url, pts, variables, extra):
    params = {"latitude": ",".join(str(p[0]) for p in pts), "longitude": ",".join(str(p[1]) for p in pts),
              "hourly": ",".join(variables), "timezone": "Asia/Kolkata", **extra}
    if "forecast" in url:
        params["wind_speed_unit"] = "ms"
    if "archive" in url:
        params["wind_speed_unit"] = "ms"
    js = call(url, params)
    js = js if isinstance(js, list) else [js]
    frames = []
    for p, item in zip(pts, js):
        d = pd.DataFrame(item["hourly"])
        d["qlat"], d["qlon"] = p
        frames.append(d)
    return pd.concat(frames)


def cached(kind, url, pts, variables, extra):
    key = hashlib.md5(f"{kind}{pts}{variables}{extra}".encode()).hexdigest()[:12]
    f = RAW / f"{kind}_{key}.pkl"
    if f.exists():
        return pd.read_pickle(f)
    df = fetch(url, pts, variables, extra)
    df.to_pickle(f)
    time.sleep(1.0)
    return df


def date_chunks(start, end):
    s, e = pd.Timestamp(start), pd.Timestamp(end)
    while s <= e:
        t = min(s + pd.Timedelta(days=CHUNK_DAYS - 1), e)
        yield s.date().isoformat(), t.date().isoformat()
        s = t + pd.Timedelta(days=1)


def download_kind(kind, url, variables, pts, start, end, extra=None):
    out = []
    for a, b in date_chunks(start, end):
        for i in range(0, len(pts), BATCH):
            sub = pts[i:i + BATCH]
            print(f"  {kind} {a}..{b} points {i}-{i + len(sub)} / {len(pts)}")
            out.append(cached(kind, url, sub, variables, {"start_date": a, "end_date": b, **(extra or {})}))
    return pd.concat(out)


def main():
    grid = load_json(DATA / "grid.geojson")
    cells = pd.DataFrame([f["properties"] for f in grid["features"]])
    cells["qlat"], cells["qlon"] = cells.lat.round(1), cells.lon.round(1)
    pts = sorted({(a, b) for a, b in zip(cells.qlat, cells.qlon)})
    print(f"{len(cells)} cells -> {len(pts)} unique query points")

    aq = download_kind("aq", AQ_URL, AQ_VARS, pts, START_DATE, END_DATE)

    # weather: archive lags ~5 days, so fill the tail from the forecast endpoint (past_days)
    wx_end = (pd.Timestamp(END_DATE) - pd.Timedelta(days=6)).date().isoformat()
    wx = download_kind("wx", WX_ARCHIVE, WX_VARS, pts, START_DATE, wx_end)
    tail = []
    for i in range(0, len(pts), BATCH):
        sub = pts[i:i + BATCH]
        tail.append(cached("wxtail", WX_FORECAST, sub, WX_VARS, {"past_days": 10, "forecast_days": 1}))
    wx = pd.concat([wx, pd.concat(tail)]).drop_duplicates(["time", "qlat", "qlon"], keep="first")

    # hourly -> wind components -> daily
    wx["ws"] = wx.wind_speed_10m
    rad = np.radians(wx.wind_direction_10m)
    wx["u"], wx["v"] = -wx.ws * np.sin(rad), -wx.ws * np.cos(rad)   # meteorological convention
    for d in (aq, wx):
        d["date"] = pd.to_datetime(d["time"]).dt.floor("D")
    aqd = aq.groupby(["qlat", "qlon", "date"]).agg(
        pm25=("pm2_5", "mean"), pm25_max=("pm2_5", "max"), pm10=("pm10", "mean"),
        no2=("nitrogen_dioxide", "mean"), so2=("sulphur_dioxide", "mean"),
        co=("carbon_monoxide", "mean"), o3=("ozone", "mean")).reset_index()
    wxd = wx.groupby(["qlat", "qlon", "date"]).agg(
        temp=("temperature_2m", "mean"), rh=("relative_humidity_2m", "mean"), rain=("precipitation", "sum"),
        wind_u=("u", "mean"), wind_v=("v", "mean"), wind_speed=("ws", "mean")).reset_index()
    wxd["wind_dir"] = (np.degrees(np.arctan2(-wxd.wind_u, -wxd.wind_v))) % 360   # direction wind blows FROM
    daily = aqd.merge(wxd, on=["qlat", "qlon", "date"], how="inner")
    daily = daily[daily.date <= pd.Timestamp(END_DATE)]
    daily = cells[["cell_id", "qlat", "qlon"]].merge(daily, on=["qlat", "qlon"]).drop(columns=["qlat", "qlon"])
    # sanity cleaning
    daily = daily[(daily.pm25.isna()) | ((daily.pm25 >= 0) & (daily.pm25 < 1000))]
    save_df(daily.sort_values(["cell_id", "date"]), "daily")
    print(f"Saved daily data: {len(daily)} rows, {daily.date.min().date()} -> {daily.date.max().date()}")


if __name__ == "__main__":
    main()
