"""STEP 5 - Train PM2.5 forecast models (t+1, t+2, t+3 days) with XGBoost.
Validation is honest: (a) TIME split (train on past, test on the last 20% of dates) and
(b) SPATIAL hold-out (whole 0.1-degree source grid groups unseen in training).
Baselines: persistence (tomorrow = today) and Random Forest. Output: models/, output/validation.md, metrics.json"""
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from common import *

try:
    from xgboost import XGBRegressor
    HAVE_XGB = True
except ImportError:
    HAVE_XGB = False
    print("WARNING: xgboost not installed -> falling back to sklearn HistGradientBoosting (pip install xgboost)")

ID_COLS = ["cell_id", "date"]
PM_BINS = [30, 60, 90, 120, 250]          # CPCB PM2.5 24h category breakpoints


def make_gbm():
    if HAVE_XGB:
        return XGBRegressor(n_estimators=800, learning_rate=0.04, max_depth=6, subsample=0.8, colsample_bytree=0.8,
                            min_child_weight=3, reg_lambda=2.0, early_stopping_rounds=40, n_jobs=-1, random_state=42)
    return HistGradientBoostingRegressor(max_iter=400, learning_rate=0.05, max_depth=6, random_state=42)


def fit_gbm(m, Xtr, ytr, Xva, yva):
    if HAVE_XGB:
        m.fit(Xtr, ytr, eval_set=[(Xva, yva)], verbose=False)
    else:
        m.fit(Xtr, ytr)
    return m


def metrics(y, p):
    cat = (np.digitize(y, PM_BINS) == np.digitize(p, PM_BINS)).mean()
    return {"MAE": round(float(mean_absolute_error(y, p)), 2),
            "RMSE": round(float(np.sqrt(mean_squared_error(y, p))), 2),
            "R2": round(float(r2_score(y, p)), 3), "AQI_category_acc": round(float(cat), 3)}


def main():
    df = load_df("features")
    targets = [f"target_h{h}" for h in HORIZONS]
    feats = [c for c in df.columns if c not in ID_COLS + targets]
    dump_json(feats, MODELS / "feature_cols.json")
    dates = np.sort(df.date.unique())
    cut = pd.Timestamp(dates[int(len(dates) * 0.8)])
    print(f"{len(feats)} features | time cut {cut.date()} | cells {df.cell_id.nunique()}")
    results, rf_imp = {}, None
    groups = df.cell_id.map(load_df("static").set_index("cell_id").group_id)
    rng = np.random.default_rng(0)
    ug = np.unique(groups)
    held = set(rng.choice(ug, max(1, int(len(ug) * 0.2)), replace=False)) if len(ug) >= 5 else set()

    for h in HORIZONS:
        t = f"target_h{h}"
        d = df.dropna(subset=[t])
        train = d[d.date <= cut - pd.Timedelta(days=h)]          # no target overlap with test period
        test = d[d.date >= cut]
        vcut = train.date.quantile(0.9)
        tr, va = train[train.date <= vcut - pd.Timedelta(days=h)], train[train.date > vcut]
        m = fit_gbm(make_gbm(), tr[feats], tr[t], va[feats], va[t])
        rf = RandomForestRegressor(n_estimators=150, max_depth=14, min_samples_leaf=3, n_jobs=-1, random_state=42)
        rf.fit(train[feats], train[t])
        r = {"persistence": metrics(test[t], test.pm25), "random_forest": metrics(test[t], rf.predict(test[feats])),
             "xgboost" if HAVE_XGB else "gbm": metrics(test[t], m.predict(test[feats]))}
        if held:                                                  # spatial hold-out
            mask_h = groups.loc[d.index].isin(held)
            tr_s = train[~mask_h.loc[train.index]]; te_s = test[mask_h.loc[test.index]]
            tr_s2, va_s = tr_s[tr_s.date <= vcut - pd.Timedelta(days=h)], tr_s[tr_s.date > vcut]
            ms = fit_gbm(make_gbm(), tr_s2[feats], tr_s2[t], va_s[feats], va_s[t])
            r["spatial_holdout"] = metrics(te_s[t], ms.predict(te_s[feats]))
        results[f"h{h}"] = r
        # final model: retrain on everything available up to the latest labelled day (better for deployment)
        full_tr = d
        vc = full_tr.date.quantile(0.92)
        mf = fit_gbm(make_gbm(), full_tr[full_tr.date <= vc - pd.Timedelta(days=h)][feats],
                     full_tr[full_tr.date <= vc - pd.Timedelta(days=h)][t], full_tr[full_tr.date > vc][feats],
                     full_tr[full_tr.date > vc][t])
        joblib.dump(mf, MODELS / f"gbm_h{h}.joblib")
        if h == HORIZONS[0]:
            rf_imp = dict(zip(feats, rf.feature_importances_.tolist()))
        print(f"h{h}:", json.dumps(r))
    dump_json(rf_imp, MODELS / "rf_importance.json")
    dump_json({"time_cut": str(cut.date()), "n_features": len(feats), "results": results, "xgboost": HAVE_XGB},
              OUT / "metrics.json")
    # markdown table for the validation slide
    lines = ["# Forecast validation (time-based test set)\n", f"Test period starts {cut.date()}. Units: ug/m3.\n",
             "| Horizon | Model | MAE | RMSE | R2 | AQI-category acc |", "|---|---|---|---|---|---|"]
    for h, r in results.items():
        for name, m_ in r.items():
            lines.append(f"| +{h[1:]}d | {name} | {m_['MAE']} | {m_['RMSE']} | {m_['R2']} | {m_['AQI_category_acc']} |")
    (OUT / "validation.md").write_text("\n".join(lines))
    print("Saved models/ and output/validation.md")


if __name__ == "__main__":
    main()
