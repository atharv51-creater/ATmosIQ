# Environmental Risk API (FastAPI)

Serves the ML pipeline's output files (zones GeoJSON, priority queue, SHAP, forecasts, wind) over REST.
`data/` holds the latest real pipeline output (`data_date = 2026-11-06`); copy a newer `pune_risk/output/` here (or set
`DATA_DIR`) to refresh without editing code. Files are re-read automatically when they change.

The service also exposes the trained models directly: `/model/status` reports whether XGBoost/joblib are importable and
whether scoring is live or served from the last pre-computed forecast; `/model/forecast` returns the +1/+2/+3 day PM2.5
predictions and `/model/predict/{zone_id}` scores one H3 cell (live when the model libraries are installed).

## Run
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-ml.txt              # optional: enables live XGBoost scoring
uvicorn app.main:app --reload --port 8000      # interactive docs: http://localhost:8000/docs
python -m unittest discover -s tests            # tests
# or: cp .env.example .env && docker compose up --build
```

Without `requirements-ml.txt` the API still works and serves the last pipeline forecast; `/model/status` reports
`live_inference: false` so the UI never pretends the model ran when it did not.

## Endpoints
| Method & path | Purpose |
|---|---|
| GET `/zones?region=pune&horizon=0\|24\|48\|72` | GeoJSON with scores. Optional `min_class`, `w_hazard`, `w_exposure`, `w_vulnerability` |
| GET `/zones/{id}` | score breakdown (points per driver), SHAP drivers, geometry, history |
| GET `/forecast/{id}` | 30-day PM2.5 history + 3-day forecast with risk score/class |
| GET `/priority-queue?horizon=&limit=&risk_class=` | zones ranked by risk x population, trend, recommended action |
| GET `/wind?region=pune` | wind u/v per zone for the arrows overlay |
| POST `/weights` | what-if: `{hazard, exposure, vulnerability, horizon, top}` -> recomputed zones, class counts, ranking (weights auto-normalised) |
| GET `/alerts?min_level=watch\|warning\|critical` | generated alerts (critical now / warning on forecast / watch rising) |
| POST `/alerts/notify` | `{channel: telegram\|email, min_level, dry_run}` push alerts (configure via `.env`) |
| GET `/summary`, `/model/metrics`, `/model/shap`, `/health`, `/regions` | dashboard stats, validation numbers, global feature importance |
| GET `/model/status` | model engine, live-inference availability, artefact health, data date |
| GET `/model/forecast` | +1/+2/+3 day PM2.5 predictions for all 136 zones |
| GET `/model/predict/{id}`, `/model/explain/{id}` | score one zone with the trained models / its SHAP drivers |

Horizons are accepted as hours (0/24/48/72) or days (0-3). Alerts and the priority queue are derived from the
pipeline output on request; there is no database (add Postgres later if you need alert history).

## Deploy
Render/Railway: build from the Dockerfile, set `CORS_ORIGINS` to your frontend URL, commit the real `data/` files.
Keep a local copy running as the demo-day fallback.
