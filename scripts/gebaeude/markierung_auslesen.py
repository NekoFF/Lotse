"""
Etagen-Markierung auslesen -> Vielecke in Metern (für src/gebaeude/schule.ts).

Markierung (z. B. in Photoshop über das Foto des Orientierungsplans gemalt):
  grau  (199,199,199) = begehbar (Flur, Halle, Innenhof)
  weiß  innerhalb der roten Linien = Räume (oder offene Bereiche – das entscheidet man beim Benennen)
  blau  = Treppen
  rot   = Linien (werden den Nachbarflächen zugeschlagen)

Ablauf:
  1. Flächen nach Farbe trennen, Außenfläche = Weiß, das den Bildrand berührt.
  2. Leichte Drehung des Fotos und Schräge des Schilds aus den Kanten messen und herausrechnen.
  3. Maßstab und Lage über die Treppen: sie passen auf die Treppen im Modell (Ähnlichkeit ohne Drehung,
     Zuordnung automatisch über alle Reihenfolgen). Ausgabe des Restfehlers je Treppe – über ~0,5 m: prüfen!
  4. Kanten unter 0,6 m Abweichung gerade ziehen, auf 0,25 m runden; Treppen des Modells haben Vorrang,
     Räume vor Flur (Überlappungen werden abgezogen).

Benutzung (einmalig ein eigenes venv, außerhalb des Projekts):
  python3 -m venv /tmp/gebaeude-venv && /tmp/gebaeude-venv/bin/pip install numpy opencv-python-headless shapely
  /tmp/gebaeude-venv/bin/python scripts/gebaeude/markierung_auslesen.py markierung.png ausgabe.json
Danach Bereiche in schule.ts benennen (Nummer im Kontrollbild regionen.png = Schlüssel in ausgabe.json).
"""
import itertools
import json
import math
import re
import sys
from pathlib import Path

import cv2
import numpy as np
from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import unary_union

MODELL = Path(__file__).resolve().parents[2] / "src" / "gebaeude" / "schule.ts"


def flaechen(bild):
    im = bild.astype(int)
    b, g, r = im[..., 0], im[..., 1], im[..., 2]
    grau = (abs(r - 199) < 22) & (abs(g - 199) < 22) & (abs(b - 199) < 22) & (abs(r - b) < 10)
    blau = (b > 180) & (r < 150) & (b - r > 80)
    weiss = (r > 235) & (g > 235) & (b > 235)
    _, cc = cv2.connectedComponents(weiss.astype(np.uint8), connectivity=4)
    rand = np.unique(np.concatenate([cc[0], cc[-1], cc[:, 0], cc[:, -1]]))
    aussen = np.isin(cc, rand) & weiss
    regionen = []
    for maske, art in ((grau, "flur"), (blau, "treppe"), (weiss & ~aussen, "raum")):
        n, c = cv2.connectedComponents(maske.astype(np.uint8), connectivity=4)
        regionen += [(art, c == i) for i in range(1, n) if (c == i).sum() >= 300]
    lab = np.zeros(grau.shape, np.int32)
    for k, (_, m) in enumerate(regionen):
        lab[m] = k + 1
    frei = (lab == 0) & ~aussen
    for _ in range(12):  # rote Linien den Nachbarn zuschlagen
        d = cv2.dilate(lab.astype(np.float32), np.ones((3, 3), np.uint8)).astype(np.int32)
        neu = frei & (d > 0)
        lab[neu] = d[neu]
        frei = (lab == 0) & ~aussen
    return lab, [a for a, _ in regionen]


def vielecke(lab, arten):
    out = {}
    for k, art in enumerate(arten, 1):
        cs, _ = cv2.findContours((lab == k).astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        out[k] = {"art": art, "rings": [cv2.approxPolyDP(c, 2.5, True)[:, 0, :].tolist() for c in cs if cv2.contourArea(c) >= 150]}
    return out


def drehung_und_schraege(polys):
    segs = []
    for v in polys.values():
        for a in v["rings"]:
            for i in range(len(a)):
                p, q = a[i], a[(i + 1) % len(a)]
                if math.hypot(q[0] - p[0], q[1] - p[1]) > 60:
                    segs.append((p, q))
    waag = []
    for p, q in segs:
        w = math.degrees(math.atan2(q[1] - p[1], q[0] - p[0]))
        if abs(w) < 10:
            waag.append((w, math.dist(p, q)))
        elif abs(abs(w) - 180) < 10:
            waag.append((w - 180 if w > 0 else w + 180, math.dist(p, q)))
    rot = float(np.average([w for w, _ in waag], weights=[l for _, l in waag]))
    c, s = math.cos(math.radians(-rot)), math.sin(math.radians(-rot))
    ks, ws = [], []
    for p, q in segs:
        dx = (q[0] * c - q[1] * s) - (p[0] * c - p[1] * s)
        dy = (q[0] * s + q[1] * c) - (p[0] * s + p[1] * c)
        if abs(dy) > 40 and 0.3 < -dx / dy < 0.9:
            ks.append(-dx / dy)
            ws.append(math.hypot(dx, dy))
    return rot, float(np.average(ks, weights=ws))


def modell_treppen():
    ts = MODELL.read_text(encoding="utf-8")
    block = ts[ts.index("const TREPPEN"):ts.index("};", ts.index("const TREPPEN"))]
    return {m.group(1): json.loads(m.group(2)) for m in re.finditer(r"\n  (\w+): (\[\[\[.*?\]\]\])", block)}


def main(eingabe, ausgabe):
    bild = cv2.imread(eingabe)
    lab, arten = flaechen(bild)
    polys = vielecke(lab, arten)
    rot, k = drehung_und_schraege(polys)
    c, s = math.cos(math.radians(-rot)), math.sin(math.radians(-rot))

    def gerade(p):
        x, y = p[0] * c - p[1] * s, p[0] * s + p[1] * c
        return (x + k * y, -y)  # Bild-y nach unten → Modell-y nach oben, Schräge raus

    ref = {n: Polygon(r[0]).centroid for n, r in modell_treppen().items()}
    treppen = [i for i, v in polys.items() if v["art"] == "treppe"]
    src = {i: Polygon([gerade(p) for p in polys[i]["rings"][0]]).centroid for i in treppen}
    best = None
    for namen in itertools.permutations(ref, len(treppen)):
        a, b = [], []
        for i, n in zip(treppen, namen):
            a += [[src[i].x, 1, 0], [src[i].y, 0, 1]]
            b += [ref[n].x, ref[n].y]
        x, *_ = np.linalg.lstsq(np.array(a), np.array(b), rcond=None)
        if x[0] <= 0:
            continue
        rest = np.abs(np.array(a) @ x - np.array(b)).reshape(-1, 2)
        if best is None or rest.max() < best[0].max():
            best = (rest, x, namen)
    rest, (sc, tx, ty), namen = best
    print(f"Drehung {rot:.2f}°, Schräge {k:.3f}, Maßstab {sc:.4f} m/px")
    for i, n, r in zip(treppen, namen, rest):
        print(f"  Treppe {i} → {n}: Rest {r.max():.2f} m")

    def meter(p):
        x, y = gerade(p)
        return (x * sc + tx, y * sc + ty)

    def ortho(ring):
        pts = [list(p) for p in ring]
        for _ in range(2):
            for i in range(len(pts)):
                a, b = pts[i], pts[(i + 1) % len(pts)]
                if abs(a[0] - b[0]) <= 0.6 and abs(a[1] - b[1]) > 1.5:
                    a[0] = b[0] = round((a[0] + b[0]) * 2) / 4
                if abs(a[1] - b[1]) <= 0.6 and abs(a[0] - b[0]) > 1.5:
                    a[1] = b[1] = round((a[1] + b[1]) * 2) / 4
        return pts

    belegt = unary_union([Polygon(modell_treppen()[n][0]) for n in namen])
    r4 = lambda v: round(v * 4) / 4
    out = {"treppen": dict(zip(map(str, treppen), namen)), "bereiche": {}}
    for i, v in sorted(((i, v) for i, v in polys.items() if v["art"] != "treppe"), key=lambda iv: iv[1]["art"] == "flur"):
        ringe = [ortho([meter(p) for p in r]) for r in v["rings"]]
        g = Polygon(ringe[0], ringe[1:]).buffer(0).difference(belegt)
        if isinstance(g, MultiPolygon):
            g = max(g.geoms, key=lambda p: p.area)
        g = g.simplify(0.05)
        belegt = unary_union([belegt, g])
        out["bereiche"][str(i)] = {
            "art": v["art"],
            "flaeche_m2": round(g.area),
            "ringe": [[[r4(x), r4(y)] for x, y in list(g.exterior.coords)[:-1]]] + [[[r4(x), r4(y)] for x, y in list(h.coords)[:-1]] for h in g.interiors],
        }
    Path(ausgabe).write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")

    # Kontrollbild mit Nummern
    vis = np.full((*lab.shape, 3), 255, np.uint8)
    for i, v in polys.items():
        vis[lab == i] = {"flur": (200, 200, 200), "treppe": (255, 110, 60)}.get(v["art"], (235, 225, 210))
        ys, xs = np.nonzero(lab == i)
        cv2.putText(vis, str(i), (int(xs.mean()), int(ys.mean())), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    kontroll = str(Path(ausgabe).with_name("regionen.png"))
    cv2.imwrite(kontroll, vis)
    print(f"{len(out['bereiche'])} Bereiche → {ausgabe}, Kontrollbild {kontroll}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
