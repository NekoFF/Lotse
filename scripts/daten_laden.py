"""Lädt echte Praxen aus OpenStreetMap (Nominatim) und berechnet echte Wege
(routing.openstreetmap.de, FOSSGIS) ab dem Startpunkt. Ergebnis: src/data/praxen-osm.json

Aufruf:  python3 scripts/daten_laden.py
Regeln:  höchstens 1 Anfrage pro Sekunde, eigener User-Agent (Nutzungsbedingungen von Nominatim und FOSSGIS).
Nichts wird erfunden: Fachrichtung nur aus OSM-Tag oder eindeutigem Wort im Namen, sonst wird die Praxis weggelassen.
"""
import json, re, time, urllib.parse, urllib.request, datetime, math, sys

UA = {"User-Agent": "Lotse-Schulprojekt/0.1 (github.com/NekoFF/Lotse)"}
START = {"name": "Wetzlar, Bahnhof", "lngLat": [8.50437, 50.56508]}
BOX = (8.42, 50.52, 8.58, 50.62)  # Wetzlar
OUT = "scripts/beispieldaten/wetzlar.json"  # nur für Tests, die App lädt live

def get(url, tries=4):
    for a in range(tries):
        try:
            r = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40))
            time.sleep(1.2)
            return r
        except Exception as e:
            print("  wiederhole:", e, file=sys.stderr); time.sleep(10 * (a + 1))
    return None

TAG = {
    "general": "allgemein", "internal": "allgemein", "orthopaedics": "ortho", "dermatology": "derma", "skin": "derma",
    "ophthalmology": "auge", "otolaryngology": "hno", "gynaecology": "gyn", "urology": "uro", "paediatrics": "kinder",
    "psychiatry": "psych", "psychotherapy": "psych", "neuropsychiatry": "psych", "depth": "psych", "behavior": "psych",
    "child_psychiatry": "kinder", "dentist": "zahn", "orthodontics": "zahn",
}
NAME = [  # nur eindeutige Wörter im Namen
    (r"allgemeinmedizin|hausarzt|hausärzt", "allgemein"), (r"orthop", "ortho"), (r"dermatolog|hautarzt|hautärzt", "derma"),
    (r"augenarzt|augenärzt|augenheil", "auge"), (r"\bhno\b|hals-nasen-ohren", "hno"), (r"frauenarzt|frauenärzt|gynäkolog", "gyn"),
    (r"urolog", "uro"), (r"kinderarzt|kinderärzt|kinder- und jugendmedizin|pädiatr", "kinder"), (r"psychotherap|psychiatr", "psych"),
    (r"zahnarzt|zahnärzt|zahnheil|kieferorthop", "zahn"),
]

def fach_von(tags, name, amenity):
    if amenity == "dentist":
        return "zahn"
    for teil in re.split(r"[;,]", tags.get("healthcare:speciality", "")):
        if teil.strip() in TAG:
            return TAG[teil.strip()]
    low = name.lower()
    for muster, f in NAME:
        if re.search(muster, low):
            return f
    return None

def luft(a, b):
    r = math.pi / 180; dl = (b[1]-a[1])*r; dn = (b[0]-a[0])*r
    h = math.sin(dl/2)**2 + math.cos(a[1]*r)*math.cos(b[1]*r)*math.sin(dn/2)**2
    return 6371 * 2 * math.asin(math.sqrt(h))

def suche():
    funde = {}
    x0, y0, x1, y1 = BOX
    xs = [x0, (x0+x1)/2, x1]; ys = [y0, (y0+y1)/2, y1]
    for q in ["doctors", "dentist"]:
        for i in range(2):
            for j in range(2):
                vb = f"{xs[i]},{ys[j+1]},{xs[i+1]},{ys[j]}"
                u = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
                    {"q": f"[{q}]", "format": "jsonv2", "limit": 50, "extratags": 1, "addressdetails": 1, "viewbox": vb, "bounded": 1})
                for e in get(u) or []:
                    funde[f"{e['osm_type']}/{e['osm_id']}"] = e
        print(q, len(funde))
    return funde

def weg(profil, ziel):
    base = {"fuss": "routed-foot/route/v1/foot", "rad": "routed-bike/route/v1/bike", "auto": "routed-car/route/v1/driving"}[profil]
    s = START["lngLat"]
    r = get(f"https://routing.openstreetmap.de/{base}/{s[0]},{s[1]};{ziel[0]},{ziel[1]}?overview=simplified&geometries=geojson")
    if not r or not r.get("routes"):
        return None
    x = r["routes"][0]
    return {"m": round(x["distance"]), "s": round(x["duration"]), "line": [[round(p[0], 5), round(p[1], 5)] for p in x["geometry"]["coordinates"]]}

def main():
    praxen = []
    for key, e in suche().items():
        t = e.get("extratags") or {}
        name = e.get("name") or ""
        if not name:
            continue
        fach = fach_von(t, name, e.get("type"))
        if not fach:
            continue
        ll = [round(float(e["lon"]), 5), round(float(e["lat"]), 5)]
        a = e.get("address") or {}
        strasse = " ".join(x for x in [a.get("road"), a.get("house_number")] if x)
        praxen.append({
            "id": key.replace("/", "-"), "osm": key, "fach": fach, "name": name,
            "strasse": strasse or None, "ort": a.get("city") or a.get("town") or a.get("village") or "Wetzlar",
            "lngLat": ll, "luftlinieKm": round(luft(START["lngLat"], ll), 2),
            "website": t.get("website") or t.get("contact:website"),
            "telefon": t.get("phone") or t.get("contact:phone"),
            "oeffnungszeiten": t.get("opening_hours"),
            "rollstuhl": t.get("wheelchair"),
        })
    praxen.sort(key=lambda p: p["luftlinieKm"])
    print("Praxen mit Fachrichtung:", len(praxen))
    for i, p in enumerate(praxen):
        p["wege"] = {k: weg(k, p["lngLat"]) for k in ("fuss", "rad", "auto")}
        print(f"  {i+1}/{len(praxen)} {p['name'][:40]}", file=sys.stderr)
    daten = {
        "stand": datetime.date.today().isoformat(),
        "quelle": "© OpenStreetMap-Mitwirkende (ODbL), abgefragt über Nominatim; Wege: routing.openstreetmap.de (FOSSGIS)",
        "start": START, "praxen": praxen,
    }
    json.dump(daten, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("geschrieben:", OUT)

if __name__ == "__main__":
    main()
