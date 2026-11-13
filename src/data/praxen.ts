import type { FachId } from "./fachrichtungen";
import daten from "./praxen-osm.json";

/**
 * ECHTE Praxen aus OpenStreetMap mit echten, vorab berechneten Wegen.
 * Erzeugt mit `python3 scripts/daten_laden.py` (Stand siehe DATENSTAND).
 * Regel: Was nicht in den Daten steht, wird in der App als „unbekannt“ angezeigt und nie geschätzt.
 */

export type LngLat = [number, number];
export interface Weg { m: number; s: number; line: LngLat[] }
export type Modus = "fuss" | "rad" | "auto";

export interface Praxis {
  id: string;
  osm: string;
  fach: FachId;
  name: string;
  strasse: string | null;
  ort: string;
  lngLat: LngLat;
  /** Luftlinie ab Startpunkt in km */
  entfernung: number;
  website: string | null;
  telefon: string | null;
  oeffnungszeiten: string | null;
  /** laut OSM: "yes", "limited", "no" oder unbekannt (null) */
  rollstuhl: string | null;
  wege: Record<Modus, Weg | null>;
}

interface Roh {
  id: string; osm: string; fach: string; name: string; strasse: string | null; ort: string;
  lngLat: number[]; luftlinieKm: number; website?: string | null; telefon?: string | null;
  oeffnungszeiten?: string | null; rollstuhl?: string | null;
  wege: Record<Modus, { m: number; s: number; line: number[][] } | null>;
}

const roh = daten as unknown as { stand: string; quelle: string; start: { name: string; lngLat: number[] }; praxen: Roh[] };

export const DATENSTAND = roh.stand;
export const DATENQUELLE = roh.quelle;
export const START = { name: roh.start.name, lngLat: roh.start.lngLat as LngLat };

export const PRAXEN: Praxis[] = roh.praxen.map((p) => ({
  id: p.id,
  osm: p.osm,
  fach: p.fach as FachId,
  name: p.name,
  strasse: p.strasse,
  ort: p.ort,
  lngLat: p.lngLat as LngLat,
  entfernung: p.luftlinieKm,
  website: normUrl(p.website ?? null),
  telefon: p.telefon ?? null,
  oeffnungszeiten: p.oeffnungszeiten ?? null,
  rollstuhl: p.rollstuhl ?? null,
  wege: p.wege as Record<Modus, Weg | null>,
}));

function normUrl(u: string | null): string | null {
  if (!u) return null;
  const s = u.trim();
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

/** Minuten für einen Weg, oder null, wenn es keinen berechneten Weg gibt */
export function minuten(p: Praxis, m: Modus): number | null {
  const w = p.wege[m];
  return w ? Math.max(1, Math.round(w.s / 60)) : null;
}

export function praxenFuer(fach: FachId): Praxis[] {
  return PRAXEN.filter((p) => p.fach === fach);
}

export function praxisNachId(id: string): Praxis | undefined {
  return PRAXEN.find((p) => p.id === id);
}

export const osmLink = (p: Praxis) => `https://www.openstreetmap.org/${p.osm}`;

/** "Mo-Fr 08:00-12:00; Sa off" → deutsch lesbar, ohne etwas hinzuzufügen */
export function zeitenLesbar(s: string): string[] {
  const tag: Record<string, string> = { Mo: "Mo", Tu: "Di", We: "Mi", Th: "Do", Fr: "Fr", Sa: "Sa", Su: "So", PH: "Feiertag" };
  return s.split(";").map((t) =>
    t.trim()
      .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (x) => tag[x])
      .replace(/\boff\b|\bclosed\b/g, "geschlossen")
      .replace(/-/g, "–"),
  ).filter(Boolean);
}
