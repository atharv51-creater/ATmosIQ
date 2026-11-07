"""HTTP-level tests. Needs: pip install -r requirements.txt. Run: python -m unittest discover -s tests"""
import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
try:
    from fastapi.testclient import TestClient
    from app.main import app
    c = TestClient(app)
except Exception:  # fastapi/httpx not installed
    c = None


@unittest.skipIf(c is None, "fastapi/httpx not installed")
class API(unittest.TestCase):
    def test_all_endpoints(self):
        self.assertEqual(c.get("/health").json()["status"], "ok")
        for h in (0, 24, 48, 72):
            r = c.get(f"/zones?region=pune&horizon={h}"); self.assertEqual(r.status_code, 200)
            self.assertEqual(r.json()["type"], "FeatureCollection")
        self.assertEqual(c.get("/zones?horizon=30").status_code, 422)
        self.assertEqual(c.get("/zones?region=delhi").status_code, 404)
        q = c.get("/priority-queue?limit=3").json(); self.assertEqual(len(q), 3)
        cid = q[0]["cell_id"]
        self.assertEqual(c.get(f"/zones/{cid}").status_code, 200)
        self.assertEqual(len(c.get(f"/forecast/{cid}").json()["forecast"]), 3)
        self.assertEqual(c.get("/zones/zzz").status_code, 404)
        self.assertTrue(c.get("/wind").json())
        r = c.post("/weights", json={"hazard": .2, "exposure": .6, "vulnerability": .2, "horizon": 24})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(c.post("/weights", json={"hazard": 0, "exposure": 0, "vulnerability": 0}).status_code, 422)
        self.assertEqual(c.get("/alerts").status_code, 200)
        self.assertEqual(c.post("/alerts/notify", json={"dry_run": True}).status_code, 200)
        self.assertIn(c.post("/alerts/notify", json={"channel": "telegram", "min_level": "critical"}).status_code, (200, 503))  # 503 = not configured
        self.assertEqual(c.get("/model/metrics").status_code, 200)


if __name__ == "__main__":
    unittest.main()
