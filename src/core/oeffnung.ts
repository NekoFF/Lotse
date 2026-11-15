/**
 * Öffnungszeiten aus OSM (opening_hours) auswerten – nur die häufigen Formen.
 * Unbekannte Formen ergeben null („unbekannt“), nie eine Vermutung.
 *   „Mo-Fr 08:00-18:00; Sa 09:00-12:00“, „24/7“, „Mo,We 10:00-12:00,14:00-18:00“, „Su off“, „Mo-Su 11:00-23:00“
 */
const TAGE = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function tageAus(teil: string): number[] | null {
  const aus = new Set<number>();
  for (const stueck of teil.split(",")) {
    const m = stueck.trim().match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
    if (!m) return null;
    const a = TAGE.indexOf(m[1]), b = m[2] ? TAGE.indexOf(m[2]) : a;
    for (let i = a; ; i = (i + 1) % 7) { aus.add(i); if (i === b) break; }
  }
  return [...aus];
}

/** Minuten seit Mitternacht; Zeiträume über Mitternacht werden auf zwei Tage verteilt */
type Spanne = [number, number];
function spannenAus(teil: string): Spanne[] | null {
  const aus: Spanne[] = [];
  for (const s of teil.split(",")) {
    const m = s.trim().match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})\+?$/);
    if (!m || +m[1] > 24 || +m[2] > 59 || +m[4] > 59) return null;
    // Endzeiten bis 48:00 sind in OSM erlaubt (z. B. 10:00-26:00)
    if (+m[3] > 48) return null;
    aus.push([+m[1] * 60 + +m[2], +m[3] * 60 + +m[4]]);
  }
  return aus;
}

export interface Status { offen: boolean; bis?: string; ab?: string }

/** Ostersonntag (Gauß/Meeus) */
function ostern(j: number): Date {
  const a = j % 19, b = Math.floor(j / 100), c = j % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31), tag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(j, monat - 1, tag);
}
/** bundesweite Feiertage (+ Fronleichnam, gilt in Hessen) – an Feiertagen sagen wir lieber „unbekannt“ */
export function istFeiertag(d: Date): boolean {
  const md = `${d.getMonth() + 1}-${d.getDate()}`;
  if (["1-1", "5-1", "10-3", "12-25", "12-26"].includes(md)) return true;
  const o = ostern(d.getFullYear()).getTime();
  const tage = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - o) / 86400000);
  return [-2, 1, 39, 50, 60].includes(tage);
}

/** Ist zur Zeit d geöffnet? null = Format unbekannt */
export function geoeffnet(oh: string | null | undefined, d: Date): Status | null {
  if (!oh) return null;
  const text = oh.trim();
  if (text === "24/7") return { offen: true };
  // Feiertag: Regeln dafür werten wir nicht aus → lieber „unbekannt“ als falsch „geöffnet“
  if (istFeiertag(d)) return null;
  const regeln: { tage: number[]; spannen: Spanne[] | "off" }[] = [];
  for (const roh of text.split(";")) {
    const r = roh.trim();
    if (!r || /^PH\s/.test(r)) continue; // reine Feiertagsregel (heute ist kein Feiertag)
    const m = r.match(/^([A-Za-z,\- ]+?)\s+(off|closed|\d.*)$/);
    if (!m) {
      const nurZeit = spannenAus(r);
      if (nurZeit) { regeln.push({ tage: [0, 1, 2, 3, 4, 5, 6], spannen: nurZeit }); continue; }
      return null;
    }
    // „PH,Su off“ / „Su,PH off“: Feiertag weglassen, Wochentage behalten
    const tage = tageAus(m[1].replace(/\s/g, "").split(",").filter((x) => x !== "PH").join(","));
    if (!tage) return null;
    const sp = /^(off|closed)$/.test(m[2]) ? "off" : spannenAus(m[2]);
    if (!sp) return null;
    regeln.push({ tage, spannen: sp });
  }
  if (!regeln.length) return null;
  const tag = d.getDay(), jetzt = d.getHours() * 60 + d.getMinutes();
  // spätere Regeln überschreiben frühere (OSM-Regel)
  const heute = [...regeln].reverse().find((r) => r.tage.includes(tag));
  const gestern = [...regeln].reverse().find((r) => r.tage.includes((tag + 6) % 7));
  const hhmm = (x: number) => (x === 1440 ? "24:00" : `${String(Math.floor((x % 1440) / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`);
  // über Mitternacht von gestern
  if (gestern && gestern.spannen !== "off") for (const [a, b] of gestern.spannen) {
    if (b < a && jetzt < b) return { offen: true, bis: hhmm(b) };
    if (b > 1440 && jetzt < b - 1440) return { offen: true, bis: hhmm(b - 1440) };
  }
  if (!heute || heute.spannen === "off") return { offen: false };
  for (const [a, b] of heute.spannen) {
    const ende = b <= a ? b + 1440 : b;
    if (jetzt >= a && jetzt < ende) return { offen: true, bis: hhmm(ende) };
  }
  const naechste = heute.spannen.map(([a]) => a).filter((a) => a > jetzt).sort((x, y) => x - y)[0];
  return naechste != null ? { offen: false, ab: hhmm(naechste) } : { offen: false };
}
