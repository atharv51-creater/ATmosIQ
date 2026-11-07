# Environmental Risk API (FastAPI)

Serves the ML pipeline's output files (zones GeoJSON, priority queue, SHAP, forecasts, wind) over REST.
**`data/` currently holds SYNTHETIC sample data** so the frontend can be built immediately - replace it with the real
`output/` folder from the pipeline (`zones_h0..3.geojson, priority_queue.json, zone_details.json, wind_latest.json,
summary.json, shap_global.json, metrics.json`). Files are re-read automatically when they change.

## Run
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000      # interactive docs: http://localhost:8000/docs
python -m unittest discover -s tests            # tests
# or: cp .env.example .env && docker compose up --build
```

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

Horizons are accepted as hours (0/24/48/72) or days (0-3). Alerts and the priority queue are derived from the
pipeline output on request; there is no database (add Postgres later if you need alert history).

## Deploy
Render/Railway: build from the Dockerfile, set `CORS_ORIGINS` to your frontend URL, commit the real `data/` files.
Keep a local copy running as the demo-day fallback.
