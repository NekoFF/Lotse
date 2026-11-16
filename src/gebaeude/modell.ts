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

export interface Zone {
  id: string;
  art: ZonenArt;
  name?: string;
  /** ein oder mehrere Rechtecke (L-Formen, Ringe) */
  flaechen: Rechteck[];
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
}

export interface Treppe { id: string; flaeche: Rechteck; etagen: number[] }

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

export const zonenFlaeche = (z: Zone) => z.flaechen.reduce((s, [a, b, c, d]) => s + Math.abs(c - a) * Math.abs(d - b), 0);

export function grenzen(g: Gebaeude): Rechteck {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const e of g.etagen) for (const z of e.zonen) for (const [a, b, c, d] of z.flaechen) {
    x1 = Math.min(x1, a, c); y1 = Math.min(y1, b, d); x2 = Math.max(x2, a, c); y2 = Math.max(y2, b, d);
  }
  return [x1, y1, x2, y2];
}

const drin = ([a, b, c, d]: Rechteck, x: number, y: number) => x >= Math.min(a, c) && x <= Math.max(a, c) && y >= Math.min(b, d) && y <= Math.max(b, d);

/** Zone an einem Punkt (Räume vor Flur, damit Nummern an der Tür zum Raum gehören) */
export function zoneAn(e: Etage, x: number, y: number): Zone | null {
  const treffer = e.zonen.filter((z) => z.flaechen.some((f) => drin(f, x, y)));
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

/** Wandstück: von (x1,y1) nach (x2,y2), immer waagrecht oder senkrecht */
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
