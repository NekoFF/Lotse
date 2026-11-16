/**
 * Gebäudemodell für die Innenansicht (und später das 3D-Modell).
 * Koordinaten in Metern, ein gemeinsames Raster für ALLE Etagen: x nach rechts (Osten laut Plan), y nach oben (Norden laut Plan).
 * Dadurch liegen die Etagen genau übereinander – Treppen haben auf jeder Etage dieselbe Stelle.
 */
export type ZonenArt =
  | "raeume"        // Raumgruppe (einzelne Wände zwischen Räumen zeigt der Plan nicht)
  | "flur"
  | "treppe"
  | "wc"
  | "eingang"
  | "hof"           // Innenhof, begehbar, unter freiem Himmel
  | "luftraum"      // offen nach unten (Lichthof)
  | "terrasse"
  | "nebengebaeude";

/** Rechteck [x1, y1, x2, y2] in Metern */
export type Rechteck = [number, number, number, number];
export type Punkt = [number, number];
/** Umriss: erster Ring außen, weitere Ringe = Löcher (Füllregel „evenodd“) */
export type Ringe = Punkt[][];

export interface Zone {
  id: string;
  art: ZonenArt;
  name?: string;
  /** ein oder mehrere Rechtecke (L-Formen, Ringe) */
  flaechen: Rechteck[];
  /** genaue Form als Vieleck(e) – aus der Markierung des Plans; ersetzt/ergänzt flaechen */
  ringe?: Ringe;
  /** Raumnummern, die im Plan an dieser Zone stehen */
  nummern?: string[];
}

/** Raumnummer an der Stelle, wo sie im Plan steht (meist an der Tür zum Flur) */
export interface Nummer { nr: string; x: number; y: number }

export interface Etage {
  id: string;
  /** kurz für den Etagenknopf */
  kurz: string;
  name: string;
  /** 0 = Erdgeschoss */
  ebene: number;
  zonen: Zone[];
  nummern: Nummer[];
  /** freie Beschriftungen wie „Innenhof“, „Haupteingang“ */
  etiketten?: { text: string; x: number; y: number }[];
}

export interface Treppe { id: string; ringe: Ringe; etagen: number[] }

export interface Gebaeude {
  id: string;
  name: string;
  quelle: string;
  /** ehrliche Angaben zur Genauigkeit */
  hinweise: string[];
  geschosshoehe: number;
  etagen: Etage[];
  treppen: Treppe[];
}

/* ---------- Hilfen ---------- */

/** Fläche eines Rings (Schuhbandformel, ohne Vorzeichen) */
export const ringFlaeche = (r: Punkt[]) => Math.abs(r.reduce((s, [x, y], i) => { const [u, v] = r[(i + 1) % r.length]; return s + x * v - u * y; }, 0)) / 2;

export const zonenFlaeche = (z: Zone) =>
  z.flaechen.reduce((s, [a, b, c, d]) => s + Math.abs(c - a) * Math.abs(d - b), 0)
  + (z.ringe ? ringFlaeche(z.ringe[0]) - z.ringe.slice(1).reduce((s, r) => s + ringFlaeche(r), 0) : 0);

/** alle Eckpunkte einer Zone */
export const zonenPunkte = (z: Zone): Punkt[] => [
  ...z.flaechen.flatMap(([a, b, c, d]) => [[a, b], [c, d]] as Punkt[]),
  ...(z.ringe?.flat() ?? []),
];

export function grenzen(g: Gebaeude): Rechteck {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const e of g.etagen) for (const z of e.zonen) for (const [x, y] of zonenPunkte(z)) {
    x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y);
  }
  return [x1, y1, x2, y2];
}

const drin = ([a, b, c, d]: Rechteck, x: number, y: number) => x >= Math.min(a, c) && x <= Math.max(a, c) && y >= Math.min(b, d) && y <= Math.max(b, d);

/** Punkt im Vieleck (gerade/ungerade, Löcher zählen mit) */
export function inRingen(ringe: Ringe, x: number, y: number): boolean {
  let drinnen = false;
  for (const r of ringe) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) drinnen = !drinnen;
  }
  return drinnen;
}

export const zoneEnthaelt = (z: Zone, x: number, y: number) => z.flaechen.some((f) => drin(f, x, y)) || (!!z.ringe && inRingen(z.ringe, x, y));

/** Zone an einem Punkt (Räume vor Flur, damit Nummern an der Tür zum Raum gehören) */
export function zoneAn(e: Etage, x: number, y: number): Zone | null {
  const treffer = e.zonen.filter((z) => zoneEnthaelt(z, x, y));
  const rang = (z: Zone) => (z.art === "raeume" ? 0 : z.art === "wc" || z.art === "treppe" ? 1 : 2);
  return treffer.sort((p, q) => rang(p) - rang(q))[0] ?? null;
}

/** Raumnummer suchen: „152“, „Raum 152“, „R 0.52“ … – Etage aus der ersten Ziffer, wie im Plan */
export function raumFinden(g: Gebaeude, eingabe: string): { etage: Etage; nummer: Nummer; zone: Zone | null } | null {
  const nr = eingabe.replace(/\D/g, "");
  if (nr.length < 2) return null;
  for (const etage of g.etagen) {
    const nummer = etage.nummern.find((n) => n.nr === nr.padStart(3, "0"));
    if (nummer) return { etage, nummer, zone: etage.zonen.find((z) => z.nummern?.includes(nummer.nr)) ?? zoneAn(etage, nummer.x, nummer.y) };
  }
  return null;
}

/** Wandstück von (x1,y1) nach (x2,y2) */
export type Kante = [number, number, number, number];

/** Intervall [a,b] minus Liste von Intervallen */
function abziehen(a: number, b: number, weg: [number, number][]): [number, number][] {
  let rest: [number, number][] = [[a, b]];
  for (const [c, d] of weg) {
    rest = rest.flatMap(([p, q]): [number, number][] => {
      if (d <= p || c >= q) return [[p, q]];
      const aus: [number, number][] = [];
      if (c > p) aus.push([p, c]);
      if (d < q) aus.push([d, q]);
      return aus;
    });
  }
  return rest.filter(([p, q]) => q - p > 1e-6);
}

/**
 * Umriss einer Zone als Wandstücke: Kanten zwischen zwei Rechtecken derselben Zone fallen weg.
 * Grundlage für die Wände im Plan und später fürs 3D-Modell.
 */
export function umrissKanten(z: Zone): Kante[] {
  const vieleck: Kante[] = (z.ringe ?? []).flatMap((ring) => ring.map(([x, y], i) => { const [u, v] = ring[(i + 1) % ring.length]; return [x, y, u, v] as Kante; }));
  return [...vieleck, ...rechteckKanten(z)];
}

function rechteckKanten(z: Zone): Kante[] {
  const r = z.flaechen.map(([a, b, c, d]) => [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)] as Rechteck);
  const aus: Kante[] = [];
  r.forEach(([x1, y1, x2, y2], i) => {
    const andere = r.filter((_, j) => j !== i);
    // unten: Nachbar, dessen Oberkante hier liegt
    for (const [p, q] of abziehen(x1, x2, andere.filter((s) => s[3] === y1).map((s) => [s[0], s[2]]))) aus.push([p, y1, q, y1]);
    for (const [p, q] of abziehen(x1, x2, andere.filter((s) => s[1] === y2).map((s) => [s[0], s[2]]))) aus.push([p, y2, q, y2]);
    for (const [p, q] of abziehen(y1, y2, andere.filter((s) => s[2] === x1).map((s) => [s[1], s[3]]))) aus.push([x1, p, x1, q]);
    for (const [p, q] of abziehen(y1, y2, andere.filter((s) => s[0] === x2).map((s) => [s[1], s[3]]))) aus.push([x2, p, x2, q]);
  });
  return aus;
}

/** SVG-Pfad der Vielecke einer Zone */
export const ringePfad = (r: Ringe) => r.map((ring) => `M${ring.map(([x, y]) => `${x} ${y}`).join("L")}Z`).join("");

/**
 * Platz für eine Beschriftung: die Stelle, an der ein Text dieser Länge am größten passt
 * (auch in L- und U-Formen immer innen). Rückgabe [x, y, freieBreite, freieHoehe].
 */
export function textPlatz(z: Zone, zeichen = 12): [number, number, number, number] | null {
  const pts = zonenPunkte(z);
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const [x1, x2, y1, y2] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const schritt = Math.max(0.75, Math.max(x2 - x1, y2 - y1) / 30);
  const frei = (x: number, y: number, dx: number, dy: number) => { let s = 0; while (s < 200 && zoneEnthaelt(z, x + dx * (s + 0.5), y + dy * (s + 0.5))) s += 0.5; return s; };
  let best: [number, number, number, number, number] | null = null;
  for (let x = x1 + schritt / 2; x < x2; x += schritt) for (let y = y1 + schritt / 2; y < y2; y += schritt) {
    if (!zoneEnthaelt(z, x, y)) continue;
    const l = frei(x, y, -1, 0), r = frei(x, y, 1, 0), u = frei(x, y, 0, -1), o = frei(x, y, 0, 1);
    const w = l + r, h = 2 * Math.min(u, o);
    // erreichbare Schriftgröße: Breite reicht für den Text, Höhe für eine Zeile
    const groesse = Math.min((w * 0.9) / (zeichen * 0.56), h / 2.2);
    if (!best || groesse > best[4]) best = [x + (r - l) / 2, y, w, h, groesse];
  }
  return best && [best[0], best[1], best[2], best[3]];
}
