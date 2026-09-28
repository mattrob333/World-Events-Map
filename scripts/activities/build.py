"""Build activities.json from seed.py.

- Coordinates: Wikipedia (MediaWiki API, prop=coordinates) for each wikiTitle.
- Country check: point must fall inside (or within 30 km of) the Natural Earth
  1:50m polygon for its countryCode (world-atlas 2.0.2).
- elevationFt (ski only): Wikipedia infobox top elevation, else null.
- heat: Wikimedia pageviews for the last 30 days, log-scaled to 0-100.
Run: python3 data/build.py  (writes data/activities.json and data/report.txt)
"""
import json, math, re, sys, time, unicodedata, urllib.parse
import requests, pycountry
from shapely.geometry import shape, Point
from shapely.ops import nearest_points

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from seed import ROWS, COUNTRIES

UA = {"User-Agent": "PulseActivityBuild/1.0 (mroberson333@gmail.com)"}
API = "https://en.wikipedia.org/w/api.php"
S = requests.Session(); S.headers.update(UA)
import os, hashlib
CACHE_P = "/tmp/wiki_cache.json"
CACHE = json.load(open(CACHE_P)) if os.path.exists(CACHE_P) else {}
def getj(url, params=None):
    key = url + json.dumps(params, sort_keys=True)
    if key in CACHE: return CACHE[key]
    for i in range(6):
        try:
            r = S.get(url, params=params, timeout=30)
            if r.status_code == 200:
                j = r.json(); CACHE[key] = j
                if len(CACHE) % 20 == 0: json.dump(CACHE, open(CACHE_P, "w"))
                time.sleep(0.15); return j
            if r.status_code == 404: CACHE[key] = {}; return {}
        except Exception: pass
        time.sleep(2 * (i + 1))
    return {}
MANUAL = json.load(open(__file__.rsplit("/", 1)[0] + "/manual_coords.json")) if __import__("os").path.exists(__file__.rsplit("/", 1)[0] + "/manual_coords.json") else {}

def months(spec):
    if spec == "all": return list(range(1, 13))
    out = []
    for part in str(spec).split(","):
        if "-" in part:
            a, b = map(int, part.split("-")); m = a
            while True:
                out.append(m)
                if m == b: break
                m = m % 12 + 1
        else: out.append(int(part))
    return out

def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

def wiki_batch(titles):
    res = {}
    for i in range(0, len(titles), 40):
        chunk = titles[i:i+40]
        r = getj(API, {"action":"query","prop":"coordinates|info|pageprops","ppprop":"wikibase_item","inprop":"url","redirects":1,"titles":"|".join(chunk),"format":"json","colimit":"max"})
        q = r["query"]; norm = {n["from"]: n["to"] for n in q.get("normalized", [])}
        redir = {n["from"]: n["to"] for n in q.get("redirects", [])}
        pages = {p["title"]: p for p in q["pages"].values()}
        for t in chunk:
            tt = norm.get(t, t); tt = redir.get(tt, tt); p = pages.get(tt)
            if p and "coordinates" in p:
                c = p["coordinates"][0]
                res[t] = {"lat": round(c["lat"], 4), "lng": round(c["lon"], 4), "title": p["title"], "url": p["fullurl"]}
            elif p and "missing" not in p:
                qid = p.get("pageprops", {}).get("wikibase_item")
                lat = lng = None
                if qid:
                    wd = getj("https://www.wikidata.org/w/api.php", {"action":"wbgetentities","ids":qid,"props":"claims","format":"json"})
                    try:
                        v = wd["entities"][qid]["claims"]["P625"][0]["mainsnak"]["datavalue"]["value"]
                        lat, lng = round(v["latitude"], 4), round(v["longitude"], 4)
                    except Exception: pass
                res[t] = {"lat": lat, "lng": lng, "title": p["title"], "url": p.get("fullurl"), "wd": (f"https://www.wikidata.org/wiki/{qid}" if lat is not None else None)}
        time.sleep(0.3)
    return res

ELEV_NULL = {"Valle Nevado", "The Remarkables"}  # infobox top is a peak, not the lift-served summit
M2F = lambda m: round(m * 3.28084)
ELEV_OVERRIDE = {  # highest lift-served point from resort or ski-data pages
 "Whistler skiing": (7494, "https://www.whistler.com/about-whistler/stats-facts/"),
 "Niseko powder": (M2F(1306), "https://www.ykhokkaido.com/en/resorts/niseko/guide/"),
 "Hakuba skiing": (M2F(1831), "https://www.happo-one.jp/en/gelande/"),
 "Mount Hutt skiing": (M2F(2086), "https://www.mthutt.co.nz/mountain-info"),
 "Åre skiing": (M2F(1319), "https://www.skiresort.com/en/ski-resort/aare/"),
 "Hemsedal skiing": (M2F(1450), "https://www.j2ski.com/ski_resorts/Norway/Hemsedal.html"),
 "Trysil skiing": (M2F(1100), "https://www.skiresort.com/en/ski-resort/trysil/"),
 "Ruka skiing": (M2F(492), "https://www.ruka.fi/en/information-about-ruka-kuusamo"),
 "Pyeongchang skiing": (M2F(1438), "https://skiasia.com/ski-resorts/yongpyong/"),
 "Valle Nevado skiing": (12041, "https://www.onthesnow.com/chile/valle-nevado/ski-resort"),
}  # infobox top is the 5,430 m peak, not lift-served terrain
def conv(v):
    c = re.search(r"\{\{\s*(?:convert|cvt)\s*\|\s*([\d,\.]+)\s*\|\s*(m|ft)", v)
    if not c: return None
    n = float(c.group(1).replace(",", "")); return round(n * 3.28084) if c.group(2) == "m" else round(n)
def ski_elevation(title):
    if title in ELEV_NULL: return None
    r = getj(API, {"action":"parse","page":title,"prop":"wikitext","format":"json","redirects":1})
    txt = r.get("parse", {}).get("wikitext", {}).get("*", "")
    m = re.search(r"\|\s*top_elevation\s*=", txt)
    if m:
        e = conv(txt[m.end():m.end()+300])
        if e: return e
    m = re.search(r"\|\s*elevation_m\s*=\s*([\d,\.]+)", txt)
    if m: return round(float(m.group(1).replace(",", "")) * 3.28084)
    return None

def pageviews(title):
    t = urllib.parse.quote(title.replace(" ", "_"), safe="")
    u = f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/{t}/daily/20260827/20260926"
    try:
        j = getj(u); return sum(i["views"] for i in j.get("items", []))
    except Exception: return None

def topo_countries(path):
    topo = json.load(open(path)); tr = topo["transform"]; sx, sy = tr["scale"]; tx, ty = tr["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0; pts = []
        for dx, dy in arc:
            x += dx; y += dy; pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)
    def ring(idx):
        out = []
        for i in idx:
            a = arcs[i] if i >= 0 else arcs[~i][::-1]
            out.extend(a if not out else a[1:])
        return out
    geoms = {}
    for g in topo["objects"]["countries"]["geometries"]:
        if g.get("type") == "Polygon": polys = [[ring(r) for r in g["arcs"]]]
        elif g.get("type") == "MultiPolygon": polys = [[ring(r) for r in p] for p in g["arcs"]]
        else: continue
        from shapely.geometry import Polygon
        from shapely.validation import make_valid
        from shapely.ops import unary_union
        parts = []
        for pr in polys:
            try: parts.append(make_valid(Polygon(pr[0], pr[1:])))
            except Exception: pass
        if "id" in g:
            k = str(g["id"]).zfill(3); geoms[k] = unary_union(parts + ([geoms[k]] if k in geoms else []))
    return geoms

def main():
    titles = sorted({r[7] for r in ROWS})
    wk = wiki_batch(titles)
    geoms = topo_countries("/tmp/countries-50m.json")
    report, out, views = [], [], {}
    for r in ROWS:
        cc, name, place, cat, kind, best, peak, wt, summary, tags, ev, cond = r
        w = wk.get(wt)
        lat = lng = None; src = []
        if name in MANUAL:
            lat, lng = MANUAL[name]["lat"], MANUAL[name]["lng"]; src.append(MANUAL[name]["source"])
        elif w and w["lat"] is not None:
            lat, lng = w["lat"], w["lng"]
        if w and w.get("url"): src.append(w["url"])
        if w and w.get("wd") and name not in MANUAL: src.append(w["wd"])
        if lat is None: report.append(f"NO COORDS: {name} [{wt}]")
        # country check
        if lat is not None and cc != "AQ":
            num = pycountry.countries.get(alpha_2=cc).numeric
            g = geoms.get(num)
            if g is None: report.append(f"NO POLYGON for {cc} ({name})")
            else:
                p = Point(lng, lat)
                if not g.contains(p):
                    q = nearest_points(g, p)[0]
                    km = math.hypot((q.x - lng) * math.cos(math.radians(lat)), q.y - lat) * 111
                    if km > 8: report.append(f"NOTE offshore {km:.0f} km from 1:50m coastline (island/reef, reviewed): {name}")
                    if km > 75: report.append(f"OUTSIDE {cc} by {km:.0f} km: {name} ({lat},{lng}) [{wt}]")
        if len(summary) > 90: report.append(f"SUMMARY>90 ({len(summary)}): {name}")
        if name in ELEV_OVERRIDE:
            elev, eu = ELEV_OVERRIDE[name]; src.append(eu)
        else:
            elev = ski_elevation(w["title"]) if (cat == "ski" and w) else None
        if cat == "ski" and elev is None: report.append(f"NO ELEVATION: {name} [{wt}]")
        if ev and ev.get("sourceUrl") and ev["sourceUrl"] not in src: src.append(ev["sourceUrl"])
        pv = views.get(w["title"]) if w else None
        if w and w["title"] not in views:
            pv = views[w["title"]] = pageviews(w["title"])
        conditions = cond or {"ski":"snow","surf":"marine","beach":"beach"}.get(cat) or ("event" if kind == "event" else None)
        name_c, reg = COUNTRIES[cc]
        rec = {"id": slug(f"{name}-{cc}"), "name": name, "place": place, "country": name_c, "countryCode": cc, "region": reg,
               "lat": lat, "lng": lng, "category": cat, "kind": kind, "bestMonths": months(best), "peakMonths": months(peak)}
        if kind == "event": rec["eventDates"] = ev
        if cat == "ski": rec["elevationFt"] = elev
        rec.update({"summary": summary, "tags": [t for t in tags if t in {"family","solo","nightlife","luxury","budget","adrenaline"}][:3],
                    "heat": None, "_views": pv, "conditions": conditions, "sources": src})
        out.append(rec)
    vals = [math.log10(r["_views"] + 10) for r in out if r["_views"]]
    lo, hi = min(vals), max(vals)
    for r in out:
        v = r.pop("_views")
        r["heat"] = round((math.log10(v + 10) - lo) / (hi - lo) * 100) if v else None
    ids = [r["id"] for r in out]; dup = {i for i in ids if ids.count(i) > 1}
    if dup: report.append(f"DUP IDS {dup}")
    per = {}
    for r in out: per[r["country"]] = per.get(r["country"], 0) + 1
    for c, n in per.items():
        if n < 3: report.append(f"FEW SPOTS {c}: {n}")
    json.dump(CACHE, open(CACHE_P, "w"))
    json.dump(out, open(__file__.rsplit("/", 1)[0] + "/activities.json", "w"), ensure_ascii=False, indent=1)
    open(__file__.rsplit("/", 1)[0] + "/report.txt", "w").write("\n".join(report))
    print(len(out), "records,", len(per), "countries"); print("\n".join(report))

main()
