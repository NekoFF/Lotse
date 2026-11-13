import type { Praxis } from "../data/praxen";

/** Sicherheitsabstand vor dem Termin in Minuten */
export const PUFFER = 10;

export interface Schritt {
  zeit: Date;
  art: "fuss" | "linie";
  titel: string;
  detail: string;
}

export interface Plan {
  los: Date;
  an: Date;
  schritte: Schritt[];
  linie: string | null;
}

/** "Bus 12, direkt" → "Bus 12" */
export function linienName(verbindung: string): string | null {
  const kopf = verbindung.split(",")[0].trim();
  return /^zu fu/i.test(kopf) ? null : kopf;
}

const plus = (d: Date, min: number) => new Date(d.getTime() + min * 60000);

/** Rechnet vom Termin rückwärts: Ankunft = Termin − Puffer, Losgehen = Ankunft − Fahrzeit. */
export function planeWeg(p: Praxis, termin: Date): Plan {
  const an = plus(termin, -PUFFER);
  const los = plus(an, -p.fahrzeit);
  const linie = p.modus === "oepnv" ? linienName(p.verbindung) : null;
  if (!linie) {
    return { los, an, linie: null, schritte: [{ zeit: los, art: "fuss", titel: `${p.fahrzeit} Min zu Fuß`, detail: `bis ${p.strasse}` }] };
  }
  const hin = 4, ab = 3, fahrt = Math.max(3, p.fahrzeit - hin - ab);
  const rest = p.verbindung.split(",").slice(1).join(",").trim();
  return {
    los, an, linie,
    schritte: [
      { zeit: los, art: "fuss", titel: `${hin} Min zu Fuß`, detail: "bis zur Haltestelle" },
      { zeit: plus(los, hin), art: "linie", titel: linie, detail: rest ? `${fahrt} Min, ${rest}` : `${fahrt} Min Richtung ${p.ort}` },
      { zeit: plus(los, hin + fahrt), art: "fuss", titel: `${ab} Min zu Fuß`, detail: `bis ${p.strasse}` },
    ],
  };
}

/** Teile der Mini-Route für die Liste: Gehminuten und Linie */
export function miniRoute(p: Praxis): { art: "fuss" | "linie"; text: string }[] {
  const linie = p.modus === "oepnv" ? linienName(p.verbindung) : null;
  if (!linie) return [{ art: "fuss", text: String(p.fahrzeit) }];
  return [{ art: "fuss", text: "4" }, { art: "linie", text: linie }, { art: "fuss", text: "3" }];
}

export const uhr = (d: Date) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
export const tag = (d: Date) => d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });

/** Nächster Werktag, 09:00 */
export function standardTermin(jetzt = new Date()): Date {
  const d = new Date(jetzt);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** Wert für <input type="datetime-local"> in Ortszeit */
export function alsEingabe(d: Date): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

/* ---------- Kalender (.ics) ---------- */

function icsZeit(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
const esc = (s: string) => s.replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");

export function kalenderDatei(p: Praxis, termin: Date, plan: Plan): string {
  const ende = plus(termin, 30);
  const text = `Losgehen um ${uhr(plan.los)} (${p.verbindung}). Ankunft ${uhr(plan.an)}, ${PUFFER} Min Puffer. Geplant mit Lotse.`;
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Lotse//Schulprojekt//DE", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${p.id}-${termin.getTime()}@lotse`,
    `DTSTAMP:${icsZeit(new Date())}`,
    `DTSTART:${icsZeit(termin)}`,
    `DTEND:${icsZeit(ende)}`,
    `SUMMARY:${esc(p.name)}`,
    `LOCATION:${esc(`${p.strasse}, ${p.ort}`)}`,
    `DESCRIPTION:${esc(text)}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(`Jetzt losgehen zu ${p.name}`)}`,
    `TRIGGER;VALUE=DATE-TIME:${icsZeit(plan.los)}`, "END:VALARM",
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(`Morgen: ${p.name}, los um ${uhr(plan.los)}`)}`,
    "TRIGGER:-PT15H", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}

/* ---------- Begleitung: alles steht im Link, kein Server ---------- */

export interface Geteilt { praxisId: string; termin: Date; von?: string }

export function begleitLink(praxisId: string, termin: Date): string {
  const u = new URL(window.location.href);
  u.hash = new URLSearchParams({ p: praxisId, t: alsEingabe(termin) }).toString();
  return u.toString();
}

export function leseLink(hash: string): Geteilt | null {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const p = q.get("p"), t = q.get("t");
  if (!p || !t || !/^[a-z]+-\d+$/.test(p)) return null;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : { praxisId: p, termin: d };
}

/* ---------- gemerkte Termine (nur auf diesem Gerät) ---------- */

export interface Gemerkt { praxisId: string; name: string; termin: string; los: string }
const KEY = "lotse.termine";

export function leseTermine(): Gemerkt[] {
  try {
    const l = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Gemerkt[];
    const jetzt = Date.now();
    return l.filter((t) => new Date(t.termin).getTime() > jetzt).sort((a, b) => a.termin.localeCompare(b.termin));
  } catch { return []; }
}

export function merkeTermin(t: Gemerkt): Gemerkt[] {
  const l = leseTermine().filter((x) => !(x.praxisId === t.praxisId && x.termin === t.termin));
  l.push(t);
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* privates Fenster */ }
  return leseTermine();
}
