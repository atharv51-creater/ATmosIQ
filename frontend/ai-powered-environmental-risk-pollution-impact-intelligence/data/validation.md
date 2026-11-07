# Forecast validation (time-based test set)

Test period starts 2026-04-14. Units: ug/m3.

| Horizon | Model | MAE | RMSE | R2 | AQI-category acc |
|---|---|---|---|---|---|
| +1d | persistence | 3.43 | 5.29 | 0.836 | 0.91 |
| +1d | random_forest | 3.88 | 5.79 | 0.804 | 0.891 |
| +1d | xgboost | 3.35 | 5.03 | 0.852 | 0.914 |
| +1d | spatial_holdout | 3.42 | 5.03 | 0.829 | 0.907 |
| +2d | persistence | 4.96 | 7.61 | 0.662 | 0.867 |
| +2d | random_forest | 5.7 | 8.1 | 0.617 | 0.832 |
| +2d | xgboost | 4.84 | 6.9 | 0.722 | 0.865 |
| +2d | spatial_holdout | 4.69 | 6.59 | 0.707 | 0.845 |
| +3d | persistence | 5.71 | 8.84 | 0.545 | 0.845 |
| +3d | random_forest | 6.95 | 9.93 | 0.427 | 0.79 |
| +3d | xgboost | 6.21 | 8.78 | 0.552 | 0.819 |
| +3d | spatial_holdout | 5.72 | 8.16 | 0.554 | 0.818 |