import { adresse, minuten, MODI, type Modus, type Praxis, type PraxisMitZeit } from "../data/praxen";

/** Sicherheitsabstand vor dem Termin in Minuten */
export const PUFFER = 10;

export const MODUS_NAME: Record<Modus, string> = { fuss: "zu Fuß", rad: "mit dem Rad", auto: "mit dem Auto" };
export const MODUS_KURZ: Record<Modus, string> = { fuss: "Zu Fuß", rad: "Rad", auto: "Auto" };

export interface Plan {
  modus: Modus;
  min: number;
  km: number;
  los: Date;
  an: Date;
  /** zweitschnellster echter Weg als Plan B */
  planb: { modus: Modus; min: number; los: Date } | null;
}

const plus = (d: Date, min: number) => new Date(d.getTime() + min * 60000);

/** Rechnet vom Termin rückwärts. Gibt null zurück, wenn es für diesen Modus keinen berechneten Weg gibt. */
export function planeWeg(p: PraxisMitZeit, termin: Date, modus: Modus): Plan | null {
  const min = minuten(p, modus);
  const w = p.zeiten[modus];
  if (min === null || !w) return null;
  const an = plus(termin, -PUFFER);
  const los = plus(an, -min);
  const andere = MODI
    .filter((m) => m !== modus)
    .map((m) => ({ modus: m, min: minuten(p, m) }))
    .filter((x): x is { modus: Modus; min: number } => x.min !== null)
    .sort((a, b) => a.min - b.min)[0];
  return {
    modus, min, km: Math.round(w.m / 100) / 10, los, an,
    planb: andere ? { ...andere, los: plus(an, -andere.min) } : null,
  };
}

export const uhr = (d: Date) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
export const tag = (d: Date) => d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
export const km = (n: number) => String(n).replace(".", ",");

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
  const ort = adresse(p);
  const text = `Losgehen um ${uhr(plan.los)} (${plan.min} Min ${MODUS_NAME[plan.modus]}). Ankunft ${uhr(plan.an)}, ${PUFFER} Min Puffer. Geplant mit Lotse.`;
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Lotse//Schulprojekt//DE", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${p.id}-${termin.getTime()}@lotse`,
    `DTSTAMP:${icsZeit(new Date())}`,
    `DTSTART:${icsZeit(termin)}`,
    `DTEND:${icsZeit(ende)}`,
    `SUMMARY:${esc(p.name)}`,
    `LOCATION:${esc(ort)}`,
    `DESCRIPTION:${esc(text)}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(`Jetzt losgehen zu ${p.name}`)}`,
    `TRIGGER;VALUE=DATE-TIME:${icsZeit(plan.los)}`, "END:VALARM",
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(`Morgen: ${p.name}, los um ${uhr(plan.los)}`)}`,
    "TRIGGER:-PT15H", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}

/* ---------- Begleitung: alles steht im Link, kein Server ---------- */

export interface Geteilt { praxisId: string; termin: Date; modus: Modus }

export function begleitLink(praxisId: string, termin: Date, modus: Modus): string {
  const u = new URL(window.location.href);
  u.hash = new URLSearchParams({ p: praxisId, t: alsEingabe(termin), m: modus }).toString();
  return u.toString();
}

export function leseLink(hash: string): Geteilt | null {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const p = q.get("p"), t = q.get("t"), m = q.get("m");
  if (!p || !t || !/^(node|way|relation)-\d+$/.test(p)) return null;
  const d = new Date(t);
  const modus: Modus = m === "rad" || m === "auto" ? m : "fuss";
  return isNaN(d.getTime()) ? null : { praxisId: p, termin: d, modus };
}

/* ---------- gemerkte Termine (nur auf diesem Gerät) ---------- */

export interface Gemerkt { praxis: Praxis; termin: string; los: string; modus: Modus }
const KEY = "lotse.termine.v3";

export function leseTermine(): Gemerkt[] {
  try {
    const l = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Gemerkt[];
    const jetzt = Date.now();
    return l.filter((t) => new Date(t.termin).getTime() > jetzt).sort((a, b) => a.termin.localeCompare(b.termin));
  } catch { return []; }
}

export function merkeTermin(t: Gemerkt): Gemerkt[] {
  const l = leseTermine().filter((x) => !(x.praxis.id === t.praxis.id && x.termin === t.termin));
  l.push(t);
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* privates Fenster */ }
  return leseTermine();
}
