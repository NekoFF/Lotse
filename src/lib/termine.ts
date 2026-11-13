import type { Modus } from "../data/praxen";
import type { Ort } from "../services/orte";

/** Termine bleiben nur in diesem Browser (localStorage). Kein Server. */
export interface Termin {
  id: string;
  ort: Ort;
  zeit: string;
  /** Losgehzeit, nur wenn ein echter Weg berechnet wurde */
  los: string | null;
  modus: Modus | null;
}

const KEY = "lotse.termine.v4";
/** Sicherheitsabstand vor dem Termin */
export const PUFFER_MIN = 10;

export function leseTermine(): Termin[] {
  try {
    const l = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Termin[];
    const grenze = Date.now() - 2 * 3600_000;
    return l.filter((t) => t?.ort?.lngLat && new Date(t.zeit).getTime() > grenze).sort((a, b) => a.zeit.localeCompare(b.zeit));
  } catch { return []; }
}

function schreibe(l: Termin[]) {
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* privates Fenster */ }
}

export function speichereTermin(t: Termin): Termin[] {
  const l = leseTermine().filter((x) => x.id !== t.id);
  l.push(t);
  schreibe(l);
  return leseTermine();
}

export function loescheTermin(id: string): Termin[] {
  schreibe(leseTermine().filter((x) => x.id !== id));
  return leseTermine();
}

/** Losgehzeit = Termin − Puffer − echte Wegzeit */
export function losgehzeit(zeit: Date, wegSekunden: number): Date {
  return new Date(zeit.getTime() - (PUFFER_MIN * 60 + Math.round(wegSekunden / 60) * 60) * 1000);
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
    `SUMMARY:${esc(t.ort.name)}`, `LOCATION:${esc(t.ort.adresse ?? "")}`,
    `DESCRIPTION:${esc(los ? `Losgehen um ${uhr(los)}. Geplant mit Lotse.` : "Geplant mit Lotse.")}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(los ? `Jetzt losgehen: ${t.ort.name}` : `In einer Stunde: ${t.ort.name}`)}`,
    `TRIGGER;VALUE=DATE-TIME:${ics(erinnerung)}`, "END:VALARM", "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}

export function kalenderLaden(t: Termin) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([kalenderDatei(t)], { type: "text/calendar;charset=utf-8" }));
  a.download = `Lotse-${t.ort.name.replace(/[^\wäöüÄÖÜß-]+/g, "-")}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Erinnerung, solange die App offen ist (Benachrichtigung, falls erlaubt). Gibt eine Aufräumfunktion zurück. */
export function erinnerungenPlanen(l: Termin[], melden: (text: string) => void): () => void {
  const timer: number[] = [];
  for (const t of l) {
    const wann = t.los ? new Date(t.los) : new Date(new Date(t.zeit).getTime() - 3600_000);
    const ms = wann.getTime() - Date.now();
    if (ms <= 0 || ms > 24 * 3600_000) continue;
    const text = t.los ? `Jetzt losgehen: ${t.ort.name}` : `In einer Stunde: ${t.ort.name}`;
    timer.push(window.setTimeout(() => {
      melden(text);
      try { if ("Notification" in window && Notification.permission === "granted") new Notification("Lotse", { body: text }); } catch { /* egal */ }
    }, ms));
  }
  return () => timer.forEach((x) => window.clearTimeout(x));
}
