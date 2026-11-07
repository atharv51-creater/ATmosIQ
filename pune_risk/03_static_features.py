"""STEP 3 - Static per-cell features: population (WorldPop), OSM industry / roads / green cover, emitter list.
Population: put a WorldPop GeoTIFF (e.g. ind_ppp_2020_1km_Aggregated.tif) anywhere in ./data (any *.tif).
If missing or OSM is unreachable, clearly-labelled PROXY values are used so the pipeline still runs."""
import warnings
from common import *
warnings.filterwarnings("ignore")

EMITTER_TAGS = {"landuse": ["industrial", "quarry"], "power": ["plant"], "man_made": ["works", "chimney"]}
ROAD_TAGS = {"highway": ["motorway", "trunk", "primary", "secondary"]}
GREEN_TAGS = {"landuse": ["forest", "grass", "meadow", "recreation_ground"], "leisure": ["park", "garden"],
              "natural": ["wood", "scrub"]}


def population(gdf):
    import glob
    tifs = glob.glob(str(DATA / "*.tif"))
    if not tifs:
        return None
    from rasterstats import zonal_stats
    z = zonal_stats(gdf.geometry, tifs[0], stats=["sum"], all_touched=True)
    return np.array([(r["sum"] or 0.0) for r in z])


def osm_layers():
    import osmnx as ox
    from shapely.geometry import box
    s, w, n, e = BBOX
    poly = box(w - 0.05, s - 0.05, e + 0.05, n + 0.05)   # buffer so emitters just outside still count
    out = {}
    for name, tags in [("emit", EMITTER_TAGS), ("road", ROAD_TAGS), ("green", GREEN_TAGS)]:
        try:
            out[name] = ox.features_from_polygon(poly, tags)
            print(f"  OSM {name}: {len(out[name])} features")
        except Exception as ex:
            print(f"  OSM {name} failed ({ex}); using empty layer")
            out[name] = None
    return out


def main():
    import geopandas as gpd
    from shapely.geometry import shape
    grid = load_json(DATA / "grid.geojson")
    props = [f["properties"] for f in grid["features"]]
    gdf = gpd.GeoDataFrame(props, geometry=[shape(f["geometry"]) for f in grid["features"]], crs=4326)
    proj = gdf.to_crs(32643)                                  # UTM 43N, metres
    area_km2 = proj.geometry.area.values / 1e6
    st = pd.DataFrame(props)

    pop = population(gdf)
    st["pop_is_proxy"] = pop is None
    if pop is None:
        print("WARNING: no WorldPop .tif in ./data -> using PROXY population (decays from city centre)")
        d = haversine_km(st.lat.values, st.lon.values, *CITY_CENTER)
        pop = 25000 * np.exp(-d / 7) * area_km2 / area_km2.mean() + 500
    st["pop"] = pop
    st["pop_density"] = pop / area_km2

    layers = osm_layers()
    emit_pts = []
    st["industry_frac"] = st["road_km_per_km2"] = st["green_frac"] = 0.0
    if layers["emit"] is not None and len(layers["emit"]):
        e = layers["emit"].reset_index(drop=True)
        ep = e.to_crs(32643)
        cen = e.geometry.centroid
        for i, row in e.iterrows():
            w = 3.0 if row.get("power") == "plant" else 2.0 if row.get("man_made") in ("works", "chimney") else 1.0
            if w == 1.0:
                w += min(ep.geometry.iloc[i].area / 1e6 * 2, 3.0)     # bigger industrial areas weigh more
            emit_pts.append([cen.iloc[i].y, cen.iloc[i].x, w])
        ind = ep[ep.geometry.type.isin(["Polygon", "MultiPolygon"])].geometry.buffer(0).unary_union
        st["industry_frac"] = [proj.geometry.iloc[i].intersection(ind).area / proj.geometry.iloc[i].area
                               for i in range(len(proj))]
    if layers["road"] is not None and len(layers["road"]):
        lines = layers["road"].to_crs(32643)
        lines = lines[lines.geometry.type.isin(["LineString", "MultiLineString"])].geometry.unary_union
        st["road_km_per_km2"] = [proj.geometry.iloc[i].intersection(lines).length / 1000 / area_km2[i]
                                 for i in range(len(proj))]
    if layers["green"] is not None and len(layers["green"]):
        g = layers["green"].to_crs(32643)
        g = g[g.geometry.type.isin(["Polygon", "MultiPolygon"])].geometry.buffer(0).unary_union
        st["green_frac"] = [proj.geometry.iloc[i].intersection(g).area / proj.geometry.iloc[i].area
                            for i in range(len(proj))]
    if not emit_pts:
        print("WARNING: no OSM emitters found -> emitter features will be zero")

    em = np.array(emit_pts) if emit_pts else np.zeros((0, 3))
    if len(em):
        D = haversine_km(st.lat.values[:, None], st.lon.values[:, None], em[None, :, 0], em[None, :, 1])
        st["dist_nearest_emitter_km"] = D.min(1)
        st["emit_5km"] = ((D <= 5) * em[None, :, 2]).sum(1)
        st["emit_10km"] = ((D <= 10) * em[None, :, 2]).sum(1)
    else:
        st["dist_nearest_emitter_km"], st["emit_5km"], st["emit_10km"] = 99.0, 0.0, 0.0
    # cells sharing the same 0.1 deg weather/air grid point belong to one group (used for honest spatial CV)
    st["group_id"] = st.groupby([st.lat.round(1), st.lon.round(1)]).ngroup()
    save_df(st, "static")
    dump_json(em.tolist(), DATA / "emitters.json")
    print(f"Static features saved ({len(st)} cells, {len(em)} emitters)")


if __name__ == "__main__":
    main()
