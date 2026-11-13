"""Baut die Lotse-Kartenstile (hell/dunkel) aus den offiziellen OpenFreeMap-Stilen Positron und Dark.

Aufruf:   python3 scripts/kartenstil_bauen.py          (nutzt die gespeicherten Quellen)
          python3 scripts/kartenstil_bauen.py --neu    (lädt die Quellen neu von tiles.openfreemap.org)
Ergebnis: public/karte/stil-hell.json, public/karte/stil-dunkel.json

Was wir ändern (eigene Arbeit): Farben für Wasser, Parks, Wald, Wiesen; eigene Ebenen für Bus & Bahn,
Arztpraxen/Kliniken/Apotheken und sonstige Orte (Symbole zeichnet src/map/kartenSymbole.ts selbst);
eine ausgeblendete 3D-Gebäude-Ebene. Lizenzen der Vorlagen: public/karte/LIZENZ.txt.
"""
import copy, datetime, json, os, sys, urllib.request

HIER = os.path.dirname(os.path.abspath(__file__))
QUELLE = os.path.join(HIER, "kartenstil", "quelle")
ZIEL = os.path.join(HIER, "..", "public", "karte")
UA = {"User-Agent": "Lotse-Schulprojekt/0.1 (github.com/NekoFF/Lotse)"}
VORLAGEN = {"hell": "positron", "dunkel": "dark"}

# Eigene Farben (hell angelehnt an den ersten Lotse-Kartenentwurf, dunkel neu abgestimmt)
FARBEN = {
    "hell": {
        "water": "#a8cbec", "waterway": "#a8cbec", "park": "#d1e7c8", "landuse_park": "#d1e7c8",
        "landcover_wood": "#d4e5d0", "landcover_grass": "#dcebd3",
        "text": "#5b5f6b", "halo": "#ffffff", "oepnv": "#2447e6", "bahn": "#1f7a4a", "medizin": "#c2255c",
        "gebaeude3d": "#d9dbdc",
    },
    "dunkel": {
        "water": "#1d2c3d", "waterway": "#1d2c3d", "park": "#1b2a20", "landuse_park": "#1b2a20",
        "landcover_wood": "#1a271d", "landcover_grass": "#1d2b21",
        "text": "#b9bdc7", "halo": "#15161a", "oepnv": "#8ea2ff", "bahn": "#5fc28e", "medizin": "#f0739f",
        "gebaeude3d": "#3a3d44",
    },
}

NAME = ["coalesce", ["get", "name:de"], ["get", "name_de"], ["get", "name"]]
MEDIZIN = ["doctors", "doctor", "dentist", "clinic", "hospital"]
OEPNV = ["bus", "railway", "rail"]


def lade(name: str, neu: bool) -> dict:
    os.makedirs(QUELLE, exist_ok=True)
    pfad = os.path.join(QUELLE, f"{name}.json")
    if neu or not os.path.exists(pfad):
        url = f"https://tiles.openfreemap.org/styles/{name}"
        daten = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30))
        json.dump(daten, open(pfad, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        with open(os.path.join(QUELLE, "STAND.txt"), "a", encoding="utf-8") as f:
            f.write(f"{datetime.date.today().isoformat()} {url}\n")
    return json.load(open(pfad, encoding="utf-8"))


def faerben(stil: dict, f: dict) -> None:
    for l in stil["layers"]:
        p = l.setdefault("paint", {})
        i = l["id"]
        if l["type"] == "fill" and i in f:
            p["fill-color"] = f[i]
            # Vorlage zeichnet manche Flächen mit einem Muster, das im OpenFreeMap-Sprite fehlt („wood-pattern“)
            p.pop("fill-pattern", None)
        if l["type"] == "line" and i in f:
            p["line-color"] = f[i]
        # Wiesen/Grünflächen, die die Vorlagen grau zeichnen
        if l["type"] == "fill" and l.get("source-layer") == "landcover" and "grass" in json.dumps(l.get("filter", "")):
            p["fill-color"] = f["landcover_grass"]


def text_layout(groesse: float, versatz: list, anker: str) -> dict:
    return {
        "text-field": NAME, "text-font": ["Noto Sans Regular"], "text-size": groesse,
        "text-offset": versatz, "text-anchor": anker, "text-max-width": 9, "text-optional": True,
    }


def eigene_ebenen(f: dict, dunkel: bool) -> list:
    klasse = ["get", "class"]
    unterklasse = ["get", "subclass"]
    ist_medizin = ["any", ["in", klasse, ["literal", MEDIZIN]], ["in", unterklasse, ["literal", MEDIZIN + ["pharmacy"]]], ["==", klasse, "pharmacy"]]
    ist_oepnv = ["in", klasse, ["literal", OEPNV]]
    halo = {"text-halo-color": f["halo"], "text-halo-width": 1.2, "text-halo-blur": 0.4}
    return [
        {   # 3D-Gebäude: ausgeblendet, die App schaltet sie mit dem 3D-Knopf ein
            "id": "lotse-3d", "type": "fill-extrusion", "source": "openmaptiles", "source-layer": "building",
            "minzoom": 14.5, "filter": ["!=", ["get", "hide_3d"], True], "layout": {"visibility": "none"},
            "paint": {
                "fill-extrusion-color": f["gebaeude3d"],
                "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 14.5, 0, 15.5, ["coalesce", ["get", "render_height"], 6]],
                "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
                "fill-extrusion-opacity": 0.85,
            },
        },
        {   # sonstige Orte (Läden, Cafés, Schulen …): Themen-Symbol (Maki, CC0, im OpenFreeMap-Sprite) NUR zusammen mit Namen,
            # sonst entstehen namenlose Punkte; erst nah dran und nur die wichtigeren (rank)
            # wie OSM Liberty: wichtige Orte (rank < 7) ab Zoom 15, weitere ab 16, alle ab 17
            "id": "lotse-poi-orte", "type": "symbol", "source": "openmaptiles", "source-layer": "poi", "minzoom": 15,
            "filter": ["all", ["has", "name"], ["!", ist_medizin], ["!", ist_oepnv],
                       ["<", ["get", "rank"], ["step", ["zoom"], 7, 16, 20, 17, 100000]]],
            "layout": {
                "icon-image": ["match", unterklasse, ["florist", "furniture"], unterklasse, klasse],
                "icon-size": 0.9, "icon-optional": False, **text_layout(11, [0, 0.8], "top"), "text-optional": False,
                "symbol-sort-key": ["get", "rank"],
            },
            "paint": {"text-color": f["text"], "icon-opacity": 0.85 if dunkel else 1, **halo},
        },
        {   # Arztpraxen, Zahnarztpraxen, Kliniken, Apotheken
            "id": "lotse-poi-medizin", "type": "symbol", "source": "openmaptiles", "source-layer": "poi", "minzoom": 14.5,
            "filter": ist_medizin,
            "layout": {
                "icon-image": ["case", ["any", ["==", klasse, "pharmacy"], ["==", unterklasse, "pharmacy"]], "lotse-apotheke", "lotse-medizin"],
                "icon-allow-overlap": False, **text_layout(11.5, [0, 1.0], "top"),
            },
            "paint": {"text-color": f["medizin"], **halo},
        },
        {   # Bus & Bahn: Bahnhöfe früh, Bushaltestellen ab Straßenzoom
            "id": "lotse-poi-oepnv", "type": "symbol", "source": "openmaptiles", "source-layer": "poi",
            "minzoom": 12,
            "filter": ["all", ist_oepnv, ["any", ["!=", klasse, "bus"], [">=", ["zoom"], 15]]],
            "layout": {
                "icon-image": ["case", ["==", klasse, "bus"], "lotse-bus", "lotse-bahn"],
                "symbol-sort-key": ["case", ["==", klasse, "bus"], 2, 1],
                **text_layout(11.5, [0.95, 0], "left"),
            },
            "paint": {"text-color": ["case", ["==", klasse, "bus"], f["oepnv"], f["bahn"]], **halo},
        },
    ]


def baue(art: str, neu: bool) -> dict:
    vorlage = VORLAGEN[art]
    stil = copy.deepcopy(lade(vorlage, neu))
    f = FARBEN[art]
    faerben(stil, f)
    ebenen = eigene_ebenen(f, art == "dunkel")
    # 3D über den Gebäuden; Punkte unter den Ortsnamen
    ids = [l["id"] for l in stil["layers"]]
    vor_orten = next((i for i, x in enumerate(ids) if x.startswith("place_")), len(ids))
    stil["layers"][vor_orten:vor_orten] = ebenen
    stil["name"] = f"Lotse {art}"
    stil["metadata"] = {
        "lotse:quelle": f"OpenFreeMap-Stil „{vorlage}“ (https://tiles.openfreemap.org/styles/{vorlage}), verändert mit scripts/kartenstil_bauen.py",
        "lotse:lizenz": "siehe karte/LIZENZ.txt (BSD-3-Clause / CC BY 4.0 / CC BY 3.0 / MIT)",
    }
    return stil


def main():
    neu = "--neu" in sys.argv
    os.makedirs(ZIEL, exist_ok=True)
    for art in ("hell", "dunkel"):
        stil = baue(art, neu)
        pfad = os.path.join(ZIEL, f"stil-{art}.json")
        json.dump(stil, open(pfad, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        print(f"{pfad}: {len(stil['layers'])} Ebenen")


if __name__ == "__main__":
    main()
