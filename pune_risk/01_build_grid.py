"""STEP 1 - H3 hexagon grid over the study area -> data/grid.geojson"""
import numpy as np
from common import *

try:
    import h3
    V4 = hasattr(h3, "latlng_to_cell")
except ImportError:
    h3 = None


def build_h3():
    s, w, n, e = BBOX
    cells = set()
    for lat in np.arange(s, n + 0.005, 0.005):
        for lon in np.arange(w, e + 0.005, 0.005):
            cells.add(h3.latlng_to_cell(lat, lon, H3_RES) if V4 else h3.geo_to_h3(lat, lon, H3_RES))
    feats = []
    for c in sorted(cells):
        lat, lon = h3.cell_to_latlng(c) if V4 else h3.h3_to_geo(c)
        b = h3.cell_to_boundary(c) if V4 else h3.h3_to_geo_boundary(c)
        ring = [[lo, la] for la, lo in b] + [[b[0][1], b[0][0]]]
        feats.append((c, lat, lon, ring))
    return feats


def build_square(step=0.025):
    """Fallback if h3 is not installed: square cells (~2.7 km)."""
    s, w, n, e = BBOX
    feats = []
    for i, lat in enumerate(np.arange(s, n, step)):
        for j, lon in enumerate(np.arange(w, e, step)):
            ring = [[lon, lat], [lon + step, lat], [lon + step, lat + step], [lon, lat + step], [lon, lat]]
            feats.append((f"sq_{i}_{j}", lat + step / 2, lon + step / 2, ring))
    return feats


if __name__ == "__main__":
    feats = build_h3() if h3 else build_square()
    if not h3:
        print("WARNING: h3 not installed -> using square grid fallback (pip install h3)")
    gj = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [ring]},
         "properties": {"cell_id": c, "lat": lat, "lon": lon}} for c, lat, lon, ring in feats]}
    dump_json(gj, DATA / "grid.geojson")
    print(f"Grid built: {len(feats)} cells -> data/grid.geojson")
