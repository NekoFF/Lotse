import type { FachId } from "./fachrichtungen";

/**
 * Praxen kommen zur Laufzeit live aus OpenStreetMap (siehe src/services/dienste.ts).
 * Regel: Was nicht in den Daten steht, zeigt die App als „unbekannt“ an und schätzt es nie.
 */

export type LngLat = [number, number];
export type Modus = "fuss" | "rad" | "auto";
export const MODI: Modus[] = ["fuss", "rad", "auto"];

/** Dauer in Sekunden und Strecke in Metern laut Routendienst */
export interface Zeit { s: number; m: number }
export interface Weg extends Zeit { line: LngLat[] }

export interface Praxis {
  /** z. B. "node-123" */
  id: string;
  fach: FachId;
  name: string;
  strasse: string | null;
  ort: string | null;
  lngLat: LngLat;
  website: string | null;
  telefon: string | null;
  oeffnungszeiten: string | null;
  /** laut OSM: "yes", "limited", "no" oder null (unbekannt) */
  rollstuhl: string | null;
}

/** Praxis mit Luftlinie und echten Fahrzeiten ab dem Startpunkt */
export interface PraxisMitZeit extends Praxis {
  entfernung: number;
  /** null = der Routendienst kennt keinen Weg (oder der Dienst war nicht erreichbar, siehe nichtAbrufbar) */
  zeiten: Record<Modus, Zeit | null>;
  /** Verkehrsmittel, deren Fahrzeit der Dienst gerade nicht geliefert hat (Ausfall, zu viele Anfragen) – nicht „kein Weg“ */
  nichtAbrufbar?: Modus[];
  /** Verkehrsmittel, deren Fahrzeit noch geladen wird */
  ausstehend?: Modus[];
}

/** Nur die Praxisfelder (ohne Fahrzeiten), so wie sie auf dem Gerät gemerkt werden */
export function nurPraxis(p: Praxis): Praxis {
  const { id, fach, name, strasse, ort, lngLat, website, telefon, oeffnungszeiten, rollstuhl } = p;
  return { id, fach, name, strasse, ort, lngLat, website, telefon, oeffnungszeiten, rollstuhl };
}

export interface Start { lngLat: LngLat; name: string; quelle: "gps" | "adresse" }

export function minuten(p: PraxisMitZeit, m: Modus): number | null {
  const z = p.zeiten[m];
  return z ? Math.max(1, Math.round(z.s / 60)) : null;
}

export const osmLink = (p: Praxis) => `https://www.openstreetmap.org/${p.id.replace("-", "/")}`;
export const adresse = (p: Praxis) => [p.strasse, p.ort].filter(Boolean).join(", ");

/** Luftlinie in km */
export function luftlinie(a: LngLat, b: LngLat): number {
  const r = Math.PI / 180, dLat = (b[1] - a[1]) * r, dLng = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

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
