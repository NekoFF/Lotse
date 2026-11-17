"""
Schulplan auf die Karte legen und Gebäudehülle erzeugen -> src/gebaeude/karte.ts

Quellen (offen, HVBG Hessen, Nutzung nach § 18 HVGG ohne Einschränkung; Quellenvermerk mit Hinweis auf Bearbeitung):
  - 3D-Gebäudemodell LoD2, Gemeinde Wetzlar: https://gds.hessen.de -> Downloadcenter -> 3D-Daten -> 3D-Gebäudemodelle LoD2
    -> Lahn-Dill-Kreis -> Wetzlar-LoD2.zip (CityGML, ETRS89/UTM32)
  - (zur Sichtprüfung) DOP20-Luftbild per WMS: https://gds-srv.hessen.de/cgi-bin/lika-services/ogc-free-images.ows, Ebene he_dop20_rgb

Ablauf:
  1. Gebäude (gml:id, Standard: Dammstraße 62 = DEHE06210000NDKe) mit allen Gebäudeteilen aus der CityGML lesen.
  2. Umriss des EG aus src/gebaeude/schule.ts (alle Bereiche + Treppen) mit Drehung, Maßstab und Verschiebung so legen,
     dass er den LoD2-Grundriss möglichst gut überdeckt (Flächenüberdeckung IoU, grob dann fein).
  3. Affine Abbildung Plan-Meter -> WGS84 und die Gebäudeteile (Umriss + gemessene Höhe + Dachform) als TypeScript schreiben.

Benutzung (eigenes venv mit numpy, shapely, pyproj):
  python scripts/gebaeude/georef_lod2.py pfad/Wetzlar-LoD2.gml [gml_id]
"""
import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
from pyproj import Transformer
from shapely import affinity
from shapely.geometry import Polygon
from shapely.ops import unary_union

WURZEL = Path(__file__).resolve().parents[2]
SCHULE_TS = WURZEL / "src" / "gebaeude" / "schule.ts"
AUS = WURZEL / "src" / "gebaeude" / "karte.ts"
NS = {"gml": "http://www.opengis.net/gml", "bldg": "http://www.opengis.net/citygml/building/1.0",
      "gen": "http://www.opengis.net/citygml/generics/1.0", "core": "http://www.opengis.net/citygml/1.0"}
B = "{http://www.opengis.net/citygml/building/1.0}"


def teile_lesen(gml, gid):
    teile = []
    for _, el in ET.iterparse(gml, events=("end",)):
        if el.tag != "{http://www.opengis.net/citygml/1.0}cityObjectMember":
            continue
        b = el.find("bldg:Building", NS)
        if b is not None and b.get("{http://www.opengis.net/gml}id") == gid:
            for bp in b.iter(B + "BuildingPart"):
                boden = [list(map(float, p.text.split())) for s in bp.iter(B + "GroundSurface") for p in s.iter("{http://www.opengis.net/gml}posList")]
                mh, rt = bp.find("bldg:measuredHeight", NS), bp.find("bldg:roofType", NS)
                if boden and mh is not None:
                    p = boden[0]
                    flaechen = lambda art: [[(q[i], q[i + 1], q[i + 2]) for i in range(0, len(q), 3)]
                                            for s in bp.iter(B + art) for q in (list(map(float, x.text.split())) for x in s.iter("{http://www.opengis.net/gml}posList"))]
                    teile.append({"id": bp.get("{http://www.opengis.net/gml}id"), "h": float(mh.text),
                                  "dach": rt.text if rt is not None else None,
                                  "utm": [(p[i], p[i + 1]) for i in range(0, len(p), 3)],
                                  "boden_z": min(p[2::3]), "dachflaechen": flaechen("RoofSurface"), "waende": flaechen("WallSurface")})
            el.clear()
            break
        el.clear()
    if not teile:
        sys.exit(f"Gebäude {gid} nicht gefunden")
    return teile


def eg_umriss():
    ts = SCHULE_TS.read_text(encoding="utf-8")
    eg = ts[ts.index('id: "eg"'):ts.index('id: "og1"')]
    polys = [Polygon(r).buffer(0) for m in re.finditer(r"ringe: (\[\[\[.*?\]\]\])", eg) for r in json.loads(m.group(1)) if len(r) >= 3]
    block = ts[ts.index("const TREPPEN"):ts.index("};", ts.index("const TREPPEN"))]
    polys += [Polygon(json.loads(m.group(2))[0]) for m in re.finditer(r"\n  (\w+): (\[\[\[.*?\]\]\])", block)]
    return unary_union([p.buffer(0.3) for p in polys]).buffer(-0.3)


def main(gml, gid="DEHE06210000NDKe"):
    teile = teile_lesen(gml, gid)
    ox, oy = np.mean([x for t in teile for x, _ in t["utm"]]), np.mean([y for t in teile for _, y in t["utm"]])
    ox, oy = round(ox), round(oy)
    ziel = unary_union([Polygon([(x - ox, y - oy) for x, y in t["utm"]]).buffer(0) for t in teile])
    plan = eg_umriss()

    def tf(g, th, s, dx, dy):
        return affinity.translate(affinity.rotate(affinity.scale(g, s, s, origin=(0, 0)), th, origin=(0, 0)), dx, dy)

    def iou(v):
        g = tf(plan, *v)
        return g.intersection(ziel).area / g.union(ziel).area

    # grob: alle Drehungen, einige Maßstäbe, Schwerpunkte übereinander
    kand = []
    for th in range(0, 360, 2):
        for s in (0.9, 0.95, 1.0, 1.05, 1.1):
            g = tf(plan, th, s, 0, 0)
            v = [th, s, ziel.centroid.x - g.centroid.x, ziel.centroid.y - g.centroid.y]
            kand.append((iou(v), v))
    best, v = max(kand)
    # fein: Koordinatensuche
    schritt = [1.0, 0.02, 1.0, 1.0]
    while max(schritt[0], schritt[2]) >= 0.05:
        besser = False
        for i in range(4):
            for sgn in (1, -1):
                w = list(v)
                w[i] += sgn * schritt[i]
                sc = iou(w)
                if sc > best:
                    best, v, besser = sc, w, True
        if not besser:
            schritt = [x * 0.5 for x in schritt]
    th, s, dx, dy = v
    print(f"Überdeckung {best:.3f}, Drehung {th:.2f}°, Maßstab {s:.4f}")

    utm2ll = Transformer.from_crs("EPSG:25832", "EPSG:4326", always_xy=True)
    c, si = math.cos(math.radians(th)), math.sin(math.radians(th))
    plan2utm = lambda x, y: (ox + s * (x * c - y * si) + dx, oy + s * (x * si + y * c) + dy)
    pts = [(x, y) for x in np.linspace(-10, 150, 20) for y in np.linspace(-10, 95, 20)]
    A = np.array([[x, y, 1.0] for x, y in pts])
    ll = np.array([utm2ll.transform(*plan2utm(x, y)) for x, y in pts])
    cl, *_ = np.linalg.lstsq(A, ll[:, 0], rcond=None)
    cb, *_ = np.linalg.lstsq(A, ll[:, 1], rcond=None)
    fehler = max(np.abs(A @ cl - ll[:, 0]).max() * 71000, np.abs(A @ cb - ll[:, 1]).max() * 111200)
    (x0, y0), (x1, y1) = plan2utm(45, 25), plan2utm(45, 35)
    peil = math.degrees(math.atan2(x1 - x0, y1 - y0)) % 360
    mitte = utm2ll.transform(*plan2utm(55, 40))
    huelle = sorted(({"id": t["id"][-6:], "h": round(t["h"], 2), "dach": t["dach"],
                      "ring": [[round(a, 7), round(b, 7)] for a, b in (utm2ll.transform(x, y) for x, y in t["utm"])]} for t in teile),
                    key=lambda t: -t["h"])
    AUS.write_text(f'''/**
 * Lage des Schulgebäudes auf der Karte und äußere Hülle – abgeleitet aus offenen Geodaten Hessens:
 * 3D-Gebäudemodell LoD2 (HVBG) und DOP20-Luftbild. Daten verändert/bearbeitet:
 * nur das Gebäude {gid} ({len(teile)} Teile), Koordinaten nach WGS84 umgerechnet, gerundet.
 * Nutzung laut § 18 HVGG ohne Einschränkung erlaubt; Quellenvermerk mit Hinweis auf die Bearbeitung.
 *
 * Ausrichtung: Umriss der EG-Markierung auf den LoD2-Umriss gelegt (Übereinstimmung {best * 100:.0f} % der Fläche),
 * Drehung {th:.2f}°, Maßstab {s:.4f}. Erzeugt mit scripts/gebaeude/georef_lod2.py.
 */
import type {{ LngLat }} from "../data/praxen";

/** Plan-Meter (x, y) → [lng, lat]; affine Näherung, Fehler < {max(fehler, 0.01):.2f} m */
export const PLAN_NACH_KARTE = {{ lng: [{cl[0]:.10f}, {cl[1]:.10f}, {cl[2]:.10f}], lat: [{cb[0]:.10f}, {cb[1]:.10f}, {cb[2]:.10f}] }};
export const planNachKarte = (x: number, y: number): LngLat => [
  PLAN_NACH_KARTE.lng[0] * x + PLAN_NACH_KARTE.lng[1] * y + PLAN_NACH_KARTE.lng[2],
  PLAN_NACH_KARTE.lat[0] * x + PLAN_NACH_KARTE.lat[1] * y + PLAN_NACH_KARTE.lat[2],
];
/** Plan-Meter sind Schildmeter: echte Meter = Plan-Meter × MASSSTAB */
export const MASSSTAB = {s:.4f};
/** Kartenpeilung, in die „oben“ auf dem Schild zeigt (für die Kamera) */
export const PEILUNG_PLAN_OBEN = {peil:.1f};
export const MITTE: LngLat = [{mitte[0]:.7f}, {mitte[1]:.7f}];

export interface HuellenTeil {{ id: string; /** Höhe über Gelände in m (Laserdaten) */ h: number; /** AdV-Dachform: 1000 Flach, 2100 Pult, 3200 Walm */ dach: string | null; ring: LngLat[] }}
export const HUELLE: HuellenTeil[] = {json.dumps(huelle)};
export const HUELLE_QUELLE = "Gebäudehülle: 3D-Gebäudemodell LoD2 © HVBG Hessen (2026), bearbeitet";

/** [lng, lat] → Plan-Meter (Umkehrung der affinen Abbildung) */
export function karteNachPlan([lng, lat]: LngLat): [number, number] {{
  const [a, b, c] = PLAN_NACH_KARTE.lng, [d, e, f] = PLAN_NACH_KARTE.lat;
  const det = a * e - b * d;
  return [((lng - c) * e - (lat - f) * b) / det, ((lat - f) * a - (lng - c) * d) / det];
}}
''', encoding="utf-8")
    print(f"→ {AUS}")
    huelle3d(teile, mitte)


GLAS = {"9df931"}  # Mitte des Hauptbaus: Glasdach über dem Innenhof (im Luftbild DOP20 sichtbar)


def huelle3d(teile, mitte):
    """Dach- und Wandflächen als Dreiecke in Metern relativ zu MITTE (Ost, Nord, Höhe über Gelände)."""
    import mapbox_earcut as earcut
    utm2ll = Transformer.from_crs("EPSG:25832", "EPSG:4326", always_xy=True)
    ll2utm = Transformer.from_crs("EPSG:4326", "EPSG:25832", always_xy=True)
    mx, my = ll2utm.transform(*mitte)
    gelaende = min(t["boden_z"] for t in teile)
    # Meridiankonvergenz: UTM-Nord ist nicht genau geografisch Nord – Ost/Nord-Achsen über einen Punkt 100 m östlich bestimmen
    lon_o, lat_o = utm2ll.transform(mx + 100, my)
    lon0, lat0 = mitte
    k = math.cos(math.radians(lat0))
    ost = ((lon_o - lon0) * 111320 * k, (lat_o - lat0) * 110574)
    w = math.atan2(ost[1], ost[0])  # Drehung der UTM-Achsen gegen geografisch Ost
    def lokal(x, y):
        dx, dy = x - mx, y - my
        return (dx * math.cos(w) - dy * math.sin(w), dx * math.sin(w) + dy * math.cos(w))
    dreiecke = {"dach": [], "glas": [], "wand": []}
    for t in teile:
        kurz = t["id"][-6:]
        for art, liste in (("dach", t["dachflaechen"]), ("wand", t["waende"])):
            for ring in liste:
                pts = ring[:-1] if ring[0] == ring[-1] else ring
                if len(pts) < 3:
                    continue
                a = np.array(pts)
                n = np.zeros(3)
                for i in range(len(a)):
                    p0, p1 = a[i], a[(i + 1) % len(a)]
                    n += [(p0[1] - p1[1]) * (p0[2] + p1[2]), (p0[2] - p1[2]) * (p0[0] + p1[0]), (p0[0] - p1[0]) * (p0[1] + p1[1])]
                if np.linalg.norm(n) < 1e-9:
                    continue
                ax = int(np.argmax(np.abs(n)))
                zwei = np.delete(a, ax, axis=1)
                idx = earcut.triangulate_float64(zwei, np.array([len(a)], np.uint32))
                ziel = dreiecke["glas" if art == "dach" and kurz in GLAS else art]
                for j in idx:
                    e_, n_ = lokal(a[j][0], a[j][1])
                    ziel += [round(e_, 2), round(n_, 2), round(a[j][2] - gelaende, 2)]
    aus = AUS.with_name("huelle3d.json")
    aus.write_text(json.dumps({"quelle": "3D-Gebäudemodell LoD2 © HVBG Hessen (2026), bearbeitet: Dreiecke, lokale Meter um MITTE",
                               "mitte": [round(lon0, 7), round(lat0, 7)], **dreiecke}, separators=(",", ":")), encoding="utf-8")
    print(f"→ {aus}: " + ", ".join(f"{k} {len(v) // 9} Dreiecke" for k, v in dreiecke.items()))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(*sys.argv[1:])
