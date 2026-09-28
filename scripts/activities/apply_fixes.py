"""
Apply the checked link research and the known data fixes to activities.json.

    pip install timezonefinder
    python3 scripts/activities/apply_fixes.py

Idempotent: run it again after re-running the research passes. Inputs:
  scripts/activities/links/out-*.json   per-record links, researched and opened
                                        by hand; `_notes` holds data findings
Writes src/data/activities/activities.json and appends to report.txt.

IDs never change: saved places reference them.
"""

import json
import os

from timezonefinder import TimezoneFinder

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "..", "..", "src", "data", "activities", "activities.json")
REPORT = os.path.join(ROOT, "report.txt")

LINK_KEYS = ("officialSite", "tickets", "wikipedia", "instagram", "youtube", "tiktok")

F1_2027 = "https://www.astonmartinf1.com/en-GB/news/announcement/f1-2027-calendar-revealed"
SEPANG_SOURCES = [
    "https://www.skysports.com/f1/news/13566600/malaysia-added-to-2026-f1-calendar-in-october-to-host-postponed-bahrain-gp-amid-continued-conflict-in-middle-east",
    "https://www.espn.com/f1/story/_/id/49453371/formula-1-bahrain-grand-prix-malaysia-new-race-confirmed-f1-2026-schedule-changes",
]


def main():
    with open(DATA) as f:
        records = json.load(f)
    by_id = {r["id"]: r for r in records}
    log = []

    # 1. Links, hashtags, airports and book-ahead notes from the research passes.
    for name in sorted(os.listdir(os.path.join(ROOT, "links"))):
        with open(os.path.join(ROOT, "links", name)) as f:
            found = json.load(f)
        for rid, entry in found.items():
            if rid.startswith("_") or rid not in by_id:
                continue
            r = by_id[rid]
            links = {k: entry[k] for k in LINK_KEYS if entry.get(k)}
            if links:
                r["links"] = links
            if entry.get("hashtags"):
                r["hashtags"] = entry["hashtags"]
            if entry.get("nearestAirports"):
                r["nearestAirports"] = entry["nearestAirports"]
            if entry.get("bookAheadNote"):
                r["bookAheadNote"] = entry["bookAheadNote"]

    # Aspen's second gateway: Eagle County (EGE) has the longer runway and more winter flights.
    aspen = by_id.get("aspen-snowmass-us")
    if aspen and not any(a.get("iata") == "EGE" for a in aspen.get("nearestAirports", [])):
        aspen.setdefault("nearestAirports", []).append({"iata": "EGE", "city": "Eagle/Vail"})

    # 2. Bahrain GP: the 2026 race runs at Sepang, Malaysia. The Sakhir record keeps
    #    its id and carries the 2027 race; the 2026 edition gets its own record.
    bh = by_id.get("bahrain-grand-prix-bh")
    if bh and "bahrain-grand-prix-my" not in by_id:
        bh.update({
            "eventDates": {"start": "2027-03-12", "end": "2027-03-14", "status": "confirmed", "sourceUrl": F1_2027},
            "bestMonths": [3],
            "peakMonths": [3],
            "summary": "F1 under floodlights at Sakhir, March 2027",
            "sources": ["https://en.wikipedia.org/wiki/Bahrain_International_Circuit", F1_2027],
        })
        my = {
            "id": "bahrain-grand-prix-my",
            "name": "Bahrain Grand Prix at Sepang",
            "place": "Sepang",
            "country": "Malaysia",
            "countryCode": "MY",
            "region": "Southeast Asia",
            "lat": 2.7608,
            "lng": 101.7382,
            "category": "sports",
            "kind": "event",
            "bestMonths": [10],
            "peakMonths": [10],
            "summary": "The 2026 Bahrain Grand Prix, held in Malaysia this year only",
            "note": "The Bahrain Grand Prix moved to Sepang for 2026. It returns to Sakhir in March 2027.",
            "tags": [],
            "heat": bh.get("heat") or 40,
            "conditions": "event",
            "eventDates": {"start": "2026-10-02", "end": "2026-10-04", "status": "confirmed", "sourceUrl": SEPANG_SOURCES[0]},
            "sources": ["https://en.wikipedia.org/wiki/Sepang_International_Circuit", *SEPANG_SOURCES],
            "links": {"wikipedia": "https://en.wikipedia.org/wiki/Sepang_International_Circuit"},
            "hashtags": ["bahraingp", "f1"],
            "nearestAirports": [{"iata": "KUL", "city": "Kuala Lumpur"}],
        }
        records.insert(records.index(bh) + 1, my)
        by_id[my["id"]] = my
        log.append("FIX bahrain-grand-prix-bh: 2026 race moved to new record bahrain-grand-prix-my (Sepang); bh now holds 2027-03-12..14")

    # 3. Qatar and Abu Dhabi 2026: dates in doubt.
    for rid in ("qatar-grand-prix-qa", "abu-dhabi-grand-prix-ae"):
        ev = by_id.get(rid, {}).get("eventDates")
        if ev and ev["start"].startswith("2026") and ev.get("status") != "under-review":
            ev["status"] = "under-review"
            log.append(f"FIX {rid}: status under-review")

    # 4. Events with no announced dates: say why, with a source, instead of guessing.
    esala = by_id.get("esala-perahera-lk")
    if esala and not esala.get("eventDates"):
        esala["datesNote"] = "Dates not announced yet. Set by the lunar calendar, usually late July to August"
        wiki = "https://en.wikipedia.org/wiki/Kandy_Esala_Perahera"
        if wiki not in esala["sources"]:
            esala["sources"].insert(0, wiki)
    heiva = by_id.get("heiva-i-tahiti-pf")
    if heiva and not heiva.get("eventDates"):
        heiva["summary"] = "Polynesian dance, song and sport contests in Papeete"
        heiva["datesNote"] = "2027 dates not announced yet. Tahiti hosts the Pacific Games Jul 24 to Aug 7, 2027"
        games = "https://en.wikipedia.org/wiki/2027_Pacific_Games"
        if games not in heiva["sources"]:
            heiva["sources"].append(games)

    # 5. Findings from the research passes.
    tdf_gb = by_id.get("tour-de-france-grand-depart-gb")
    if tdf_gb and tdf_gb.get("eventDates", {}).get("end") == "2027-07-25":
        tdf_gb["eventDates"].update({"start": "2027-07-02", "end": "2027-07-04", "status": "estimated"})
        log.append("FIX tour-de-france-grand-depart-gb: dates cover the UK stages only (Jul 2 to 4)")
    tdf_fr = by_id.get("tour-de-france-finish-fr")
    if tdf_fr and tdf_fr.get("eventDates", {}).get("start") == "2027-07-02":
        tdf_fr["eventDates"].update({"start": "2027-07-25", "end": "2027-07-25", "status": "estimated"})
        log.append("FIX tour-de-france-finish-fr: dates cover the Paris finish only (Jul 25)")
    ibiza = by_id.get("ibiza-clubs-es")
    if ibiza and ibiza.get("place") == "Sant Antoni de Portmany":
        ibiza["place"] = "Playa d'en Bossa"
        log.append("FIX ibiza-clubs-es: place matches the coordinates (Playa d'en Bossa)")
    salz = by_id.get("salzburg-festival-at")
    if salz and salz.get("eventDates", {}).get("status") == "estimated":
        salz["eventDates"]["status"] = "confirmed"
        log.append("FIX salzburg-festival-at: dates confirmed by the festival")

    # 6. Missing heat gets a neutral default.
    for r in records:
        if r.get("heat") is None:
            r["heat"] = 40
            log.append(f"HEAT default 40: {r['id']}")

    # 7. Time zones, from the coordinates, for the card's local time.
    tf = TimezoneFinder()
    for r in records:
        tz = tf.timezone_at(lat=r["lat"], lng=r["lng"])
        if tz:
            r["tz"] = tz

    with open(DATA, "w") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)
        f.write("\n")
    if log:
        with open(REPORT, "a") as f:
            f.write("\n# apply_fixes.py\n" + "\n".join(log) + "\n")
    print(f"{len(records)} records; {len(log)} changes logged")


if __name__ == "__main__":
    main()
