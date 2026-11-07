# Environmental Risk Intelligence - Data + ML pipeline (Pune)

Score = 100 x (0.5 Hazard + 0.3 Exposure + 0.2 Vulnerability). The ML part is a real, validated PM2.5 forecast (XGBoost);
future risk = the same score formula applied to forecast PM2.5. SHAP explains the forecast; an exact point
decomposition explains the score.

## Run
```bash
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt                          # (Colab: !pip install -r requirements.txt)
python run_all.py                  # real data (internet needed). ~10-30 min, API calls are cached/resumable
python run_all.py --synthetic      # offline smoke test with FAKE data (never show these results)
```
Or step by step: `01_build_grid` -> `02_download_openmeteo` -> `03_static_features` -> `04_features` ->
`05_train_models` -> `06_forecast_explain` -> `07_risk_scores`.

**Population (do before step 3):** download a WorldPop India 1 km GeoTIFF (worldpop.org -> India -> Population counts)
and drop the `.tif` into `data/`. Without it, a labelled PROXY population is used.
If h3 is missing a square grid is used; install `h3` for hexagons.

## Outputs (`output/`) - feed these to FastAPI / React
| File | Use |
|---|---|
| zones_h0.geojson ... zones_h3.geojson | choropleth map: now, +1d, +2d, +3d (score, class, hazard/exposure/vulnerability, top_factors) |
| priority_queue.json | ranked zones: risk x population, trend, recommended action |
| zone_details.json | click panel: points breakdown, SHAP drivers, PM2.5 history + forecast |
| wind_latest.json | wind arrows overlay |
| shap_global.json, metrics.json, validation.md | explainability + validation slide (model vs persistence vs RF) |
| summary.json | city-wide stats |

`risk_engine.compute_scores(df, ref, weights)` is reusable by the backend for the "what-if weights" slider.

## Be honest in the pitch
- Open-Meteo/CAMS air data is ~10 km resolution, so neighbouring cells share pollutant values. Local variation in the
  score comes from population, emitters (OSM), wind/upwind index and green cover. Say "regional model + local exposure".
- No ground-truth risk label exists: the score is an explainable composite, the forecast is what is validated.
- Child/elderly share and NDVI are not included (proxies: green cover from OSM, temperature). Add WorldPop age bands / GEE NDVI as future work.
- Daily resolution; forecast horizons are +1/+2/+3 days.
- Compare against CPCB stations (OpenAQ / Kaggle) if time permits, as an external sanity check.

## Tunable in `common.py`
BBOX, H3_RES, START_DATE, HORIZONS, WEIGHTS, CLASSES. Action rules: `risk_engine.recommend_action`.
