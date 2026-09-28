# Coordinates for spots whose Wikipedia page has no coordinates, from OpenStreetMap Nominatim.
import json, time, requests
Q = {
"Midnight sun at North Cape":"Nordkapp, Norway","Hemsedal skiing":"Hemsedal Skisenter","Ruka skiing":"Ruka, Kuusamo",
"Ring Road drive":"Seljalandsfoss","Edinburgh Festival Fringe":"Royal Mile, Edinburgh","Scottish Highlands and whisky":"Aberlour, Scotland",
"Douro Valley harvest":"Pinhão, Portugal","Venice Carnival":"Piazza San Marco, Venezia","Art Basel":"Messe Basel",
"Salzburg Festival":"Großes Festspielhaus, Salzburg","Vienna ball season":"Wiener Staatsoper","Amsterdam Dance Event":"Leidseplein, Amsterdam",
"Wadi Shab":"Wadi Shab, Oman","Devil's Pool":"Livingstone Island, Zambia","Victoria Falls, Zimbabwe side":"Victoria Falls, Zimbabwe",
"Zambezi rafting":"Batoka Gorge","Niseko powder":"Niseko Grand Hirafu","Hakuba skiing":"Hakuba, Nagano",
"Cherry blossoms in Kyoto":"Philosopher's Walk, Kyoto","Seoul food and nightlife":"Hongdae, Seoul","Dim sum":"Sham Shui Po, Hong Kong",
"Hoi An lantern nights":"Hội An, Quảng Nam","Overwater villas":"Kaafu Atoll","Manta diving at Hanifaru":"Hanifaru",
"Maafushi local island":"Maafushi","Everest Base Camp trek":"Everest Base Camp, Nepal","Milford Track":"Glade Wharf, Te Anau",
"Banff and Lake Louise":"Lake Louise, Alberta","Tulum cenotes":"Gran Cenote, Tulum","Puerto Escondido surf":"Playa Zicatela",
"Iguazu Falls, Argentine side":"Garganta del Diablo, Misiones","Lima food":"Miraflores, Lima","Cartagena old town":"Ciudad Amurallada, Cartagena",
"José Ignacio":"José Ignacio, Maldonado",
}
out = {}
for name, q in Q.items():
    r = requests.get("https://nominatim.openstreetmap.org/search", params={"q": q, "format": "json", "limit": 1},
                     headers={"User-Agent": "PulseActivityBuild/1.0 (mroberson333@gmail.com)"}).json()
    if r:
        h = r[0]; out[name] = {"lat": round(float(h["lat"]), 4), "lng": round(float(h["lon"]), 4),
            "source": f"https://www.openstreetmap.org/{h['osm_type']}/{h['osm_id']}", "match": h["display_name"][:90]}
    else: out[name] = None
    print(name, "->", out[name] and out[name]["match"]); time.sleep(1.1)
json.dump({k: v for k, v in out.items() if v}, open("manual_coords.json", "w"), ensure_ascii=False, indent=1)
