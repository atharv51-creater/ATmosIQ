"""Run the whole pipeline.  python run_all.py            -> real data (needs internet)
                           python run_all.py --synthetic -> offline test with fake data"""
import subprocess, sys
syn = "--synthetic" in sys.argv
steps = ["01_build_grid.py"] + (["00_make_synthetic_data.py"] if syn else ["02_download_openmeteo.py", "03_static_features.py"]) + \
        ["04_features.py", "05_train_models.py", "06_forecast_explain.py", "07_risk_scores.py"]
for s in steps:
    print(f"\n===== {s} =====")
    if subprocess.run([sys.executable, s]).returncode != 0:
        sys.exit(f"Step failed: {s}")
print("\nDONE. Outputs in ./output (GeoJSON, priority_queue.json, validation.md ...)")
