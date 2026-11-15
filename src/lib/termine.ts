import type { Modus, Start } from "../data/praxen";
import { verbindungen } from "../services/oepnv";
import { routeLaden, type Ort } from "../services/orte";

/**
 * Termine bleiben nur in diesem Browser (localStorage). Kein Server.
 * Lotse rechnet die Losgehzeit aus dem ECHTEN Weg (Bus & Bahn mit Echtzeit, sonst Routendienst)
 * und prüft sie, solange die App offen ist, regelmäßig nach.
 */
export type TerminArt = "arzt" | "treffen" | "erinnerung";
export type Verkehr = Modus | "oepnv";

export interface Termin {
  id: string;
  art: TerminArt;
  titel: string;
  ort: Ort | null;
  zeit: string;
  /** von wo aus geplant wurde (für die Nachprüfung) */
  start: Start | null;
  verkehr: Verkehr | null;
  /** Minuten Puffer vor dem Termin */
  puffer: number;
  /** berechnete Losgehzeit (null = kein Weg berechenbar) */
  los: string | null;
  dauerS: number | null;
  /** kurze Beschreibung des Weges, z. B. „Bus 170 → RE99“ */
  weg: string | null;
  /** Hinweis aus der Echtzeit, z. B. „RE99 +19 Min“ */
  hinweis: string | null;
  geprueft: string | null;
}

export const ART_NAME: Record<TerminArt, string> = { arzt: "Arzttermin", treffen: "Treffen", erinnerung: "Erinnerung" };
export const PUFFER = [{ min: 5, name: "Knapp" }, { min: 10, name: "Normal" }, { min: 20, name: "Entspannt" }];
/** für ältere Stellen im Code */
export const PUFFER_MIN = 10;

const KEY = "lotse.termine.v5";
const ALT = "lotse.termine.v4";

/** ältere Einträge (v4) übernehmen */
function migrieren(): Termin[] {
  try {
    const alt = JSON.parse(localStorage.getItem(ALT) ?? "[]") as { id: string; ort: Ort; zeit: string; los: string | null; modus: Modus | null }[];
    return alt.filter((t) => t?.ort).map((t) => ({
      id: t.id, art: "arzt", titel: t.ort.name, ort: t.ort, zeit: t.zeit, start: null, verkehr: t.modus, puffer: 10,
      los: t.los, dauerS: null, weg: null, hinweis: null, geprueft: null,
    }));
  } catch { return []; }
}

export function leseTermine(): Termin[] {
  try {
    const roh = localStorage.getItem(KEY);
    const l = roh ? (JSON.parse(roh) as Termin[]) : migrieren();
    const grenze = Date.now() - 2 * 3600_000;
    return l.filter((t) => t?.id && t.zeit && new Date(t.zeit).getTime() > grenze).sort((a, b) => a.zeit.localeCompare(b.zeit));
  } catch { return []; }
}

function schreibe(l: Termin[]) {
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* privates Fenster */ }
}

export function speichereTermin(t: Termin): Termin[] {
  schreibe([...leseTermine().filter((x) => x.id !== t.id), t]);
  return leseTermine();
}

export function loescheTermin(id: string): Termin[] {
  schreibe(leseTermine().filter((x) => x.id !== id));
  return leseTermine();
}

/** Losgehzeit = Termin − Puffer − echte Wegzeit */
export function losgehzeit(zeit: Date, wegSekunden: number, puffer = PUFFER_MIN): Date {
  return new Date(zeit.getTime() - (puffer * 60 + Math.round(wegSekunden / 60) * 60) * 1000);
}

export interface Planung { los: Date | null; dauerS: number | null; weg: string | null; hinweis: string | null }

/** Weg für einen Termin berechnen – Bus & Bahn: Verbindung, die spätestens zur Zielzeit ankommt (inkl. Echtzeit) */
export async function plane(ort: Ort, start: Start, zeit: Date, verkehr: Verkehr, puffer: number, frisch = false): Promise<Planung> {
  const ankunft = new Date(zeit.getTime() - puffer * 60000);
  if (verkehr === "oepnv") {
    const f = (await verbindungen(start.lngLat, ort.lngLat, { ankunft, frisch }))
      .filter((x) => x.an.getTime() <= ankunft.getTime() + 60000 && !x.abschnitte.some((a) => a.ausfall))
      .sort((a, b) => b.ab.getTime() - a.ab.getTime())[0];
    if (!f) return { los: null, dauerS: null, weg: null, hinweis: "Keine passende Verbindung gefunden." };
    const fahrten = f.abschnitte.filter((a) => a.art === "oepnv");
    const spaet = fahrten.filter((a) => (a.verspaetung ?? 0) >= 2).map((a) => `${a.linie} +${a.verspaetung} Min`);
    return { los: f.ab, dauerS: f.dauerS, weg: fahrten.map((a) => a.linie).join(" → ") || "zu Fuß", hinweis: spaet.length ? spaet.join(", ") : null };
  }
  const r = await routeLaden(start.lngLat, ort.lngLat, verkehr);
  return { los: losgehzeit(zeit, r.s, puffer), dauerS: r.s, weg: r.ueber ? `über ${r.ueber}` : null, hinweis: null };
}

const ics = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
const uhr = (d: Date) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

/** Kalenderdatei mit Erinnerung zur Losgehzeit (oder 1 Stunde vorher, wenn kein Weg berechnet ist) */
export function kalenderDatei(t: Termin): string {
  const zeit = new Date(t.zeit);
  const los = t.los ? new Date(t.los) : null;
  const erinnerung = los ?? new Date(zeit.getTime() - 3600_000);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Lotse//Schulprojekt//DE", "BEGIN:VEVENT",
    `UID:${t.id}@lotse`, `DTSTAMP:${ics(new Date())}`, `DTSTART:${ics(zeit)}`, `DTEND:${ics(new Date(zeit.getTime() + 30 * 60000))}`,
    `SUMMARY:${esc(t.titel)}`, `LOCATION:${esc(t.ort?.adresse ?? t.ort?.name ?? "")}`,
    `DESCRIPTION:${esc(los ? `Losgehen um ${uhr(los)}${t.weg ? ` (${t.weg})` : ""}. Geplant mit Lotse.` : "Geplant mit Lotse.")}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(los ? `Jetzt losgehen: ${t.titel}` : `In einer Stunde: ${t.titel}`)}`,
    `TRIGGER;VALUE=DATE-TIME:${ics(erinnerung)}`, "END:VALARM", "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}

export function kalenderLaden(t: Termin) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([kalenderDatei(t)], { type: "text/calendar;charset=utf-8" }));
  a.download = `Lotse-${t.titel.replace(/[^\wäöüÄÖÜß-]+/g, "-")}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Erinnerung, solange die App offen ist (Benachrichtigung, falls erlaubt). Gibt eine Aufräumfunktion zurück. */
export function erinnerungenPlanen(l: Termin[], melden: (text: string) => void): () => void {
  const timer: number[] = [];
  for (const t of l) {
    const wann = t.los ? new Date(t.los) : new Date(new Date(t.zeit).getTime() - (t.art === "erinnerung" ? 0 : 3600_000));
    const ms = wann.getTime() - Date.now();
    if (ms <= 0 || ms > 24 * 3600_000) continue;
    const text = t.los ? `Jetzt losgehen: ${t.titel}` : t.art === "erinnerung" ? `Erinnerung: ${t.titel}` : `In einer Stunde: ${t.titel}`;
    timer.push(window.setTimeout(() => {
      melden(text);
      try { if ("Notification" in window && Notification.permission === "granted") new Notification("Lotse", { body: text }); } catch { /* egal */ }
    }, ms));
  }
  return () => timer.forEach((x) => window.clearTimeout(x));
}
