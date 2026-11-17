import type { LngLat } from "../data/praxen";
import { MASSSTAB, planNachKarte } from "./karte";
import { umrissKanten, type Gebaeude, type Kante, type Zone } from "./modell";

/**
 * 3D-Szene für die Karte (MapLibre fill-extrusion):
 *  - Hülle: eigene WebGL-Ebene mit echten Dächern (huellenEbene.ts)
 *  - gewählte Etage: Boden je Bereich + Wände (aus den Umrissen der Markierung)
 *  - Etagen darunter: nur Böden, blass – wie ein Schnitt durchs Haus
 */
export const FARBEN: Record<Zone["art"], string> = {
  raeume: "#efe4cf", flur: "#b9c5df", treppe: "#6f7fb3", wc: "#a8d8e6", eingang: "#c8d6fb",
  hof: "#cfe6c2", luftraum: "#000000", terrasse: "#d9e8c9", nebengebaeude: "#e2e2e2",
};

const WANDSTAERKE = 0.25; // m
const BODEN = 0.3; // m Deckenstärke

/** Geschosshöhe in echten Metern */
export const geschoss = (g: Gebaeude) => g.geschosshoehe;

const ring = (pts: [number, number][]): LngLat[] => [...pts.map(([x, y]) => planNachKarte(x, y)), planNachKarte(...pts[0])];

/** Wandstück als schmales Rechteck um die Kante (Plan-Meter) */
function wandRing([x1, y1, x2, y2]: Kante): LngLat[] | null {
  const l = Math.hypot(x2 - x1, y2 - y1);
  if (l < 0.05) return null;
  const d = WANDSTAERKE / MASSSTAB / 2;
  const nx = (-(y2 - y1) / l) * d, ny = ((x2 - x1) / l) * d;
  return ring([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]]);
}

function zonenRinge(z: Zone): LngLat[][][] {
  const aus: LngLat[][][] = z.flaechen.map(([a, b, c, d]) => [ring([[a, b], [c, b], [c, d], [a, d]])]);
  if (z.ringe) aus.push(z.ringe.map((r) => ring(r)));
  return aus;
}

type F = GeoJSON.Feature<GeoJSON.Polygon, { art: string; farbe: string; basis: number; hoehe: number; id?: string }>;
const poly = (coords: LngLat[][], p: F["properties"]): F => ({ type: "Feature", geometry: { type: "Polygon", coordinates: coords }, properties: p });

export function szene3D(g: Gebaeude, ebene: number, gewaehlt?: string | null): GeoJSON.FeatureCollection {
  const H = geschoss(g);
  const f: F[] = [];
  // Die Hülle zeichnet jetzt die eigene WebGL-Ebene (echte Dächer, huellenEbene.ts)
  for (const e of g.etagen.filter((x) => x.ebene <= ebene)) {
    const aktiv = e.ebene === ebene;
    const z0 = e.ebene * H;
    for (const z of e.zonen) {
      if (z.art === "luftraum") continue;
      const farbe = gewaehlt && z.id === gewaehlt ? "#2447e6" : FARBEN[z.art];
      for (const p of zonenRinge(z)) f.push(poly(p, { art: aktiv ? "boden" : "boden-unten", farbe, basis: z0, hoehe: z0 + BODEN, id: z.id }));
      if (!aktiv) continue;
      // Wände: Räume, WCs, Treppen und Außenkanten der Flure volle Höhe, Luftraum-Kanten als Brüstung
      const hoch = z.art === "terrasse" ? 1.1 : z.art === "hof" ? 0 : H * 0.72;
      if (!hoch) continue;
      for (const k of umrissKanten(z)) {
        const w = wandRing(k);
        if (w) f.push(poly([w], { art: "wand", farbe: z.art === "flur" ? "#8e98ad" : "#6b7280", basis: z0 + BODEN, hoehe: z0 + BODEN + hoch }));
      }
    }
    // Brüstung um offene Bereiche (Blick aufs Dach darunter)
    if (aktiv) for (const z of e.zonen.filter((x) => x.art === "luftraum")) for (const k of umrissKanten(z)) {
      const w = wandRing(k);
      if (w) f.push(poly([w], { art: "wand", farbe: "#9aa3b5", basis: z0 + BODEN, hoehe: z0 + BODEN + 1.1 }));
    }
  }
  return { type: "FeatureCollection", features: f };
}

/** Bereich an einem Kartenpunkt (für Antippen in 3D) */
export function zoneAusFeature(g: Gebaeude, ebene: number, id: string | undefined) {
  const e = g.etagen.find((x) => x.ebene === ebene);
  return e?.zonen.find((z) => z.id === id) ?? null;
}
