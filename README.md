# AI-Powered Environmental Risk & Pollution Impact Intelligence — Pune

An end-to-end platform that forecasts air quality, converts it into an explainable
environmental **risk score** per neighbourhood, and exposes the results through a
FastAPI backend for maps, alerts and what-if analysis.

- **Study area:** Pune Metro (PMC + PCMC), India
- **Grid:** 136 H3 res-7 hexagons (~5 km² each)
- **Data window:** 2024-01-01 → latest complete day
- **Risk score:** `100 × (0.5·Hazard + 0.3·Exposure + 0.2·Vulnerability)`
- **ML:** XGBoost PM2.5 forecast at +1 / +2 / +3 days (SHAP-explained)

## How it works

1. **Grid** — build H3 hexagons over the Pune bounding box.
2. **Air quality** — download daily Open-Meteo / CAMS pollutants and meteorology (cached, resumable).
3. **Static exposure** — OSM industrial emitters, roads, green cover, and WorldPop 1 km population.
4. **Features** — lagged pollutants, day-on-day change, wind/upwind index, emitter proximity.
5. **Models** — train XGBoost + Random Forest per horizon; validate against persistence and a spatial holdout.
6. **Explain + forecast** — SHAP global/local drivers and 3-day PM2.5 forecasts.
7. **Risk** — apply the weighted score to current and forecast PM2.5, classify zones, rank by
   `risk × population`, and generate recommended actions.

## Validation snapshot

Time-based holdout (`time_cut = 2026-04-14`), PM2.5 forecast:

| Horizon | Model | MAE | RMSE | R² | AQI class acc |
|---|---|---|---|---|---|
| +1 day | Persistence | 3.43 | 5.29 | 0.836 | 0.910 |
| +1 day | **XGBoost** | **3.35** | **5.03** | **0.852** | **0.914** |
| +2 days | Persistence | 4.96 | 7.61 | 0.662 | 0.867 |
| +2 days | **XGBoost** | **4.84** | **6.90** | **0.722** | **0.865** |
| +3 days | Persistence | 5.71 | 8.84 | 0.545 | 0.845 |
| +3 days | **XGBoost** | 6.21 | 8.78 | 0.552 | 0.819 |

Latest run (`data_date = 2026-11-06`): 136 zones — 117 Moderate, 17 High, 2 Low;
mean score 41.2; ~4.5 M people in High/Critical zones.

## Folder Structure

```text
pune_risk_pipeline/
├── README.md                      # this file
├── .gitignore
├── main.py                        # legacy single-file API prototype (use backend/ instead)
│
├── pune_risk/                     # Data + ML pipeline
│   ├── run_all.py                 # orchestrates steps 01 → 07
│   ├── common.py                  # config: bbox, grid res, dates, weights, helpers
│   ├── risk_engine.py             # score formula, classification, recommended actions
│   ├── 00_make_synthetic_data.py  # offline smoke-test data (never used for results)
│   ├── 01_build_grid.py           # H3 hex grid over Pune
│   ├── 02_download_openmeteo.py   # cached/resumable air-quality + weather download
│   ├── 03_static_features.py      # OSM emitters/roads/green + WorldPop population
│   ├── 04_features.py             # lag/trend/wind/upwind feature engineering
│   ├── 05_train_models.py         # XGBoost + RF, time + spatial validation
│   ├── 06_forecast_explain.py     # +1/+2/+3 day forecasts and SHAP drivers
│   ├── 07_risk_scores.py          # scores, priority queue, alerts, summaries
│   ├── requirements.txt
│   ├── README.md                  # pipeline-specific notes
│   ├── data/                      # inputs + intermediates (parquet, grid, WorldPop .tif)
│   ├── cache/                     # Open-Meteo response cache (resumable runs)
│   ├── models/                    # trained gbm_h1..h3.joblib + feature columns
│   └── output/                    # deliverables consumed by the backend
│
├── backend/                       # FastAPI service (canonical API)
│   ├── app/
│   │   ├── main.py                # routes, validation, CORS, gzip
│   │   ├── services.py            # scoring, priority queue, alerts, what-if logic
│   │   ├── store.py               # file-backed store with mtime cache
│   │   ├── config.py              # env-driven settings
│   │   └── notify.py              # Telegram / email alert delivery
│   ├── data/                      # copy of pipeline output served by the API
│   ├── tests/                     # 11 unittest cases (services + API)
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
│
├── aashish-atmosiq/               # Integrated React 19 + Express UI (canonical frontend)
│   ├── src/                       # dashboard, maps, auth, Pune Risk Intelligence (ML) page
│   ├── server/                    # Express API: auth, live FIRMS/CAMS data, /risk proxy to FastAPI
│   └── .env.example               # PORT, JWT_SECRET, RISK_API_URL, optional FIRMS/Gemini keys
│
└── frontend/                      # Early Vite scaffold (superseded by aashish-atmosiq)
```

## Quick start

### 1. Run the pipeline

```bash
cd pune_risk
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python run_all.py            # real data (internet); ~10–30 min, cached/resumable
python run_all.py --synthetic # offline smoke test with fake data
```

Before step 3, download a WorldPop India 1 km population GeoTIFF from
[worldpop.org](https://www.worldpop.org/) and place the `.tif` in `pune_risk/data/`.
Without it the pipeline falls back to a clearly labelled population proxy.

Outputs land in `pune_risk/output/`.

### 2. Run the backend + integrated frontend

```bash
# terminal 1 — FastAPI / ML service (:8000)
cd backend
cp .env.example .env
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-ml.txt              # optional: live XGBoost scoring
uvicorn app.main:app --reload --port 8000       # docs: http://localhost:8000/docs

# terminal 2 — ATmosIQ web (:3000) + Express API (:8080)
cd aashish-atmosiq
npm install
cp .env.example .env                            # RISK_API_URL defaults to http://127.0.0.1:8000
npm run dev
```

Open **http://localhost:3000**, sign up, then visit **Dashboard → Pune Risk Intelligence** for
the ML-backed H3 risk map, priority queue, what-if lab, alerts and validation metrics.
The Express API proxies `/api/v1/risk/*` to FastAPI server-side, so the browser has one origin
and the ML service stays private. `GET /api/v1/risk/model-status` reports whether scoring is
live (`engine: xgboost`) or serving the last pre-computed forecast.

Or run the backend with Docker:

```bash
cd backend
cp .env.example .env
docker compose up --build
```

The API reads `backend/data/` and hot-reloads changed files without a restart. Copy new
pipeline output there (or point `DATA_DIR` at `pune_risk/output/`) to refresh the demo.

## API endpoints

| Method & path | Purpose |
|---|---|
| `GET /zones?region=pune&horizon=0\|24\|48\|72` | GeoJSON zones with scores; optional `min_class` and weight overrides |
| `GET /zones/{id}` | Score breakdown, SHAP drivers, geometry, population, history |
| `GET /forecast/{id}` | 30-day PM2.5 history + 3-day forecast with risk |
| `GET /priority-queue?horizon=&limit=&risk_class=` | Zones ranked by risk × population with actions |
| `GET /wind?region=pune` | Wind u/v vectors per zone |
| `POST /weights` | What-if recompute with custom hazard/exposure/vulnerability weights |
| `GET /alerts?min_level=watch\|warning\|critical` | Generated alerts |
| `POST /alerts/notify` | Push alerts to Telegram/email (`dry_run` supported) |
| `GET /summary`, `/model/metrics`, `/model/shap`, `/health`, `/regions` | Dashboard stats and model metadata |

## Key output files

| File | Used for |
|---|---|
| `zones_h0..h3.geojson` | Choropleth map: now, +1d, +2d, +3d |
| `priority_queue.json` | Ranked intervention list |
| `zone_details.json` | Click panel: points, SHAP, history + forecast |
| `wind_latest.json` | Wind arrow overlay |
| `summary.json` | City-wide KPIs |
| `metrics.json`, `validation.md`, `shap_global.json` | Validation and explainability |

## Data sources

- **Open-Meteo / CAMS** — regional air quality and meteorology (~10 km resolution)
- **OpenStreetMap** (via `osmnx`) — industrial emitters, road density, green cover
- **WorldPop** — 1 km population counts (2020, India)

## Configuration

Edit the CONFIG block in `pune_risk/common.py`: `CITY`, `BBOX`, `H3_RES`, `START_DATE`,
`HORIZONS`, `WEIGHTS`, `CLASSES`. Action rules live in `pune_risk/risk_engine.py`.
Backend settings are environment variables documented in `backend/.env.example`.

## Limitations (read before presenting)

- Air-quality input is ~10 km resolution, so neighbouring cells share pollutant values.
  Local variation comes from population, emitters, wind/upwind index and green cover —
  describe it as a **regional model with local exposure**, not hyper-local sensing.
- There is no ground-truth "risk" label: the score is an explainable composite; the
  **PM2.5 forecast is the validated component**.
- Child/elderly share and NDVI are not included; green cover and temperature are proxies.
- Resolution is daily; horizons are +1/+2/+3 days.
- Use `aashish-atmosiq/` for the UI; the older `frontend/` folder is a superseded scaffold.
