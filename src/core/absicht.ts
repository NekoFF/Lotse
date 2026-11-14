import type { FachId } from "../data/fachrichtungen";
import type { Notfallstufe } from "../data/notfall";
import { ordneZu, type Zuordnung } from "./match";
import { containsTerm, normalize } from "./normalize";
import { pruefeSicherheit } from "./safety";

/**
 * Was will die Person? Eine Eingabe für alles: Adresse, Kategorie, Anliegen, Termin.
 * Reihenfolge fest: 1. Sicherheitsfilter, 2. Termin, 3. Kategorie, 4. Anliegen → Fachrichtung, 5. normale Suche.
 * Keine Diagnose, nur Zuordnung zu Orten.
 */
export interface Kategorie { id: string; name: string; phrasen: string[]; fach?: FachId }

export const KATEGORIEN: Kategorie[] = [
  { id: "arzt", name: "Ärzte", phrasen: ["doctors"] },
  { id: "zahnarzt", name: "Zahnärzte", phrasen: ["dentist"], fach: "zahn" },
  { id: "apotheke", name: "Apotheken", phrasen: ["pharmacy"] },
  { id: "krankenhaus", name: "Krankenhäuser", phrasen: ["hospital"] },
  { id: "essen", name: "Essen", phrasen: ["restaurant", "fast_food"] },
  { id: "cafe", name: "Cafés", phrasen: ["cafe"] },
  { id: "einkaufen", name: "Supermärkte", phrasen: ["supermarket"] },
  { id: "baecker", name: "Bäckereien", phrasen: ["bakery"] },
  { id: "freizeit", name: "Freizeit", phrasen: ["cinema", "museum", "park"] },
  { id: "sehenswert", name: "Sehenswertes", phrasen: ["attraction", "museum", "viewpoint"] },
  { id: "haltestelle", name: "Haltestellen", phrasen: ["bus_stop"] },
  { id: "bahnhof", name: "Bahnhöfe", phrasen: ["station"] },
  { id: "tanken", name: "Tankstellen", phrasen: ["fuel"] },
];
const kat = (id: string) => KATEGORIEN.find((k) => k.id === id)!;

/** Wörter, die eine Kategorie meinen (normalisiert, Wortanfang) */
const KAT_WOERTER: [string, string][] = [
  ["zahnarzt", "zahnarzt"], ["zahnaerzt", "zahnarzt"], ["apothek", "apotheke"], ["krankenhaus", "krankenhaus"], ["klinik", "krankenhaus"],
  ["notaufnahme", "krankenhaus"], ["arzt", "arzt"], ["aerzt", "arzt"], ["praxis", "arzt"], ["restaurant", "essen"], ["essen", "essen"],
  ["imbiss", "essen"], ["pizza", "essen"], ["hunger", "essen"], ["medikament", "apotheke"], ["tablette", "apotheke"], ["doener", "essen"], ["cafe", "cafe"], ["kaffee", "cafe"], ["supermarkt", "einkaufen"],
  ["einkauf", "einkaufen"], ["baecker", "baecker"], ["kino", "freizeit"], ["film", "freizeit"], ["ausgehen", "freizeit"], ["spazier", "freizeit"], ["sehenswuerdig", "sehenswert"], ["sightseeing", "sehenswert"], ["museum", "freizeit"], ["freizeit", "freizeit"],
  ["unternehmen", "freizeit"], ["park", "freizeit"], ["haltestelle", "haltestelle"], ["bushaltestelle", "haltestelle"], ["bus ", "haltestelle"],
  ["bahnhof", "bahnhof"], ["zug", "bahnhof"], ["tankstelle", "tanken"], ["tanken", "tanken"],
];

/** Fachrichtungen beim Namen genannt („Orthopäde“, „HNO“ …) */
const FACH_WOERTER: [string, FachId][] = [
  ["hausarzt", "allgemein"], ["hausaerzt", "allgemein"], ["allgemeinmedizin", "allgemein"], ["orthopaed", "ortho"], ["hautarzt", "derma"],
  ["dermatolog", "derma"], ["augenarzt", "auge"], ["augenaerzt", "auge"], ["hno", "hno"], ["frauenarzt", "gyn"], ["frauenaerzt", "gyn"],
  ["gynaekolog", "gyn"], ["urolog", "uro"], ["kinderarzt", "kinder"], ["kinderaerzt", "kinder"], ["psychotherap", "psych"], ["psychiater", "psych"],
];

export type Absicht =
  | { typ: "notfall"; stufe: Notfallstufe }
  | { typ: "termin"; zeit: Date; rest: string }
  | { typ: "fach"; fach: FachId }
  | { typ: "kategorie"; kategorie: Kategorie }
  | { typ: "anliegen"; zuordnung: Zuordnung }
  | { typ: "suche"; text: string };

const WOCHENTAGE = ["sonntag", "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag"];

/** „morgen 10 Uhr“, „am Freitag um 14:30“, „heute 9“ → Datum. Ohne Zeitangabe: null. */
export function zeitAus(text: string, jetzt = new Date()): Date | null {
  const n = normalize(text);
  const uhr = n.match(/\b(?:um\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*uhr\b/) ?? n.match(/\bum\s+(\d{1,2})(?:[:.](\d{2}))?\b/) ?? text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!uhr) return null;
  const h = Number(uhr[1]), min = Number(uhr[2] ?? 0);
  if (h > 23 || min > 59) return null;
  const d = new Date(jetzt);
  d.setSeconds(0, 0);
  if (/\buebermorgen\b/.test(n)) d.setDate(d.getDate() + 2);
  else if (/\bmorgen\b/.test(n)) d.setDate(d.getDate() + 1);
  else {
    const w = WOCHENTAGE.findIndex((t) => new RegExp(`\\b${t}\\b`).test(n));
    if (w >= 0) d.setDate(d.getDate() + (((w - d.getDay()) + 7) % 7 || 7));
    const datum = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/);
    if (datum) { d.setMonth(Number(datum[2]) - 1, Number(datum[1])); if (datum[3]) d.setFullYear(Number(datum[3].length === 2 ? "20" + datum[3] : datum[3])); }
  }
  d.setHours(h, min);
  if (d.getTime() < jetzt.getTime() && !/\bheute\b/.test(n)) d.setDate(d.getDate() + 1);
  return d;
}

/** Klingt der Text nach gesundheitlichen Beschwerden? (sonst kann „sehen“ auch „einen Film sehen“ sein) */
export function klingtNachBeschwerde(text: string): boolean {
  const n = normalize(text);
  return /\b(weh|schmerz|tut|tun|juck|brenn|krank|blut|geschwollen|seit|fieber|husten|uebel|schwindel|probleme?|verletz|gebrochen|abgebrochen|entzuend|ausschlag)/.test(n);
}

/** Entfernt Datum/Uhrzeit-Wörter („morgen“, „um 10 Uhr“, „20.11.“) für die Ortssuche */
export function ohneZeit(text: string): string {
  return text
    .replace(/\b(heute|morgen|übermorgen|uebermorgen|am|um|uhr|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|beim?|bei|zum|zur)\b/gi, " ")
    .replace(/\b\d{1,2}\.\d{1,2}\.(\d{2,4})?/g, " ")
    .replace(/\b\d{1,2}([:.]\d{2})?\b/g, " ")
    .replace(/(^|\s)[.,:;!?-]+(?=\s|$)/g, " ")
    .replace(/\s+/g, " ").trim();
}

/** Hausnummer oder Straßenwort → Adresse */
export function siehtAusWieAdresse(text: string): boolean {
  return /\d/.test(text) || /(stra(ss|ß|s)e|str\.?|weg|platz|gasse|allee|ring|ufer|chaussee)(\s|,|$)/i.test(text);
}

export function verstehe(text: string, jetzt = new Date()): Absicht {
  const s = pruefeSicherheit(text);
  if (s.stufe) return { typ: "notfall", stufe: s.stufe };
  const n = normalize(text) + " ";
  if (/\btermin\b/.test(n)) {
    const zeit = zeitAus(text, jetzt);
    if (zeit) return { typ: "termin", zeit, rest: text };
  }
  // Sieht wie eine Adresse aus („Bahnhofstraße 1“)? Dann keine Kategorie aus Wortteilen raten
  if (siehtAusWieAdresse(text)) return { typ: "suche", text: text.trim() };
  for (const [w, f] of FACH_WOERTER) if (containsTerm(n, w)) return { typ: "fach", fach: f };
  for (const [w, id] of KAT_WOERTER) if (w.endsWith(" ") ? n.includes(" " + w) || n.startsWith(w) : containsTerm(n, w)) return { typ: "kategorie", kategorie: kat(id) };
  const z = ordneZu(text);
  if (!z.unsicher) return { typ: "anliegen", zuordnung: z };
  return { typ: "suche", text: text.trim() };
}

/** Klingt nach Gespräch oder Frage statt nach einer Adresse? Dann direkt in den Chat. */
export function istGespraech(text: string): boolean {
  const n = normalize(text);
  return /\?\s*$/.test(text.trim())
    || /^(hi|hallo|hey|moin|servus|danke|guten (morgen|tag|abend)|wie|was|wo|wann|warum|wieso|welche[rsn]?|gibt es|zeig|finde|such|empfiehl|kannst du|ich (will|moechte|brauche|suche))\b/.test(n);
}
