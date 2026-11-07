"""Run: python -m unittest discover -s tests   (no FastAPI needed for this file)"""
import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.store import DataStore, DataNotReady
from app.services import RiskService, parse_horizon, classify

DATA = Path(__file__).resolve().parent.parent / "data"
svc = RiskService(DataStore(DATA), {"hazard": .5, "exposure": .3, "vulnerability": .2})


class T(unittest.TestCase):
    def test_horizon(self):
        self.assertEqual([parse_horizon(x) for x in (0, 24, 48, 72, 1, 3)], [0, 1, 2, 3, 1, 3])
        for bad in (5, 25, 96, -1):
            with self.assertRaises(ValueError):
                parse_horizon(bad)

    def test_zones_and_default_weights_match_stored(self):
        base = svc.zones(0)
        same = svc.zones(0, {"hazard": .5, "exposure": .3, "vulnerability": .2})
        for a, b in zip(base["features"], same["features"]):
            self.assertAlmostEqual(a["properties"]["score"], b["properties"]["score"], delta=0.11)

    def test_weights_change_scores_and_normalise(self):
        a = svc.zones(0, {"hazard": 1, "exposure": 0, "vulnerability": 0})
        b = svc.zones(0, {"hazard": 10, "exposure": 0, "vulnerability": 0})
        for fa, fb in zip(a["features"], b["features"]):
            self.assertEqual(fa["properties"]["score"], fb["properties"]["score"])
            self.assertAlmostEqual(fa["properties"]["score"], 100 * fa["properties"]["hazard"], delta=0.1)

    def test_min_class_filter(self):
        z = svc.zones(0, min_class="High")
        self.assertTrue(all(f["properties"]["risk_class"] in ("High", "Critical") for f in z["features"]))

    def test_priority_queue(self):
        q = svc.priority_queue()
        self.assertEqual([r["rank"] for r in q], list(range(1, len(q) + 1)))
        self.assertEqual(q[0]["priority_index"], 100.0)
        self.assertTrue(all(q[i]["priority_index"] >= q[i + 1]["priority_index"] for i in range(len(q) - 1)))
        self.assertEqual(len(svc.priority_queue(limit=3)), 3)
        self.assertTrue(all(r["risk_class"] == "High" for r in svc.priority_queue(risk_class="High")))
        self.assertTrue(all(r["action"] for r in q))

    def test_zone_and_forecast(self):
        cid = svc.priority_queue(limit=1)[0]["cell_id"]
        d, f = svc.zone_detail(cid), svc.forecast(cid)
        self.assertIn("geometry", d); self.assertEqual(len(f["forecast"]), 3)
        self.assertIsNone(svc.zone_detail("nope")); self.assertIsNone(svc.forecast("nope"))

    def test_what_if(self):
        r = svc.what_if({"hazard": 0.2, "exposure": 0.6, "vulnerability": 0.2}, horizon=24, top=5)
        self.assertEqual(len(r["priority_queue"]), 5)
        self.assertAlmostEqual(sum(r["weights"].values()), 1.0)
        self.assertEqual(sum(r["class_counts"].values()), len(r["zones"]["features"]))

    def test_alerts(self):
        al = svc.alerts("watch")
        order = {"critical": 2, "warning": 1, "watch": 0}
        self.assertTrue(all(order[al[i]["level"]] >= order[al[i + 1]["level"]] for i in range(len(al) - 1)))
        self.assertTrue(all(a["level"] != "watch" for a in svc.alerts("warning")))
        self.assertIsInstance(svc.format_alert_text(al), str)

    def test_missing_data(self):
        with self.assertRaises(DataNotReady):
            RiskService(DataStore("/nonexistent"), {"hazard": 1, "exposure": 1, "vulnerability": 1}).wind()

    def test_misc_files(self):
        self.assertIn("results", svc.metrics()); self.assertIn("global", svc.shap_global()); self.assertTrue(svc.wind())


if __name__ == "__main__":
    unittest.main()
