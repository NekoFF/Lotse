import { ABSTAND_MS, DIENSTE, MAX_ZIELE, NOMINATIM_MAX, START_STELLEN, ZEITLIMIT } from "../config";
import { fachAusOsm } from "../core/osmFach";
import type { FachId } from "../data/fachrichtungen";
import { luftlinie, MODI, type LngLat, type Modus, type Praxis, type PraxisMitZeit, type Start, type Weg, type Zeit } from "../data/praxen";

/** Fehler mit einem Satz, der so in der App angezeigt werden kann */
export class DienstFehler extends Error {}

/* ---------- Höflich anfragen: je Dienst eine Anfrage nach der anderen, höchstens 1 pro Sekunde, Zwischenspeicher ---------- */

const naechsterSlot = new Map<string, number>();
/** Letzte Anfrage je Dienst: die nächste startet erst, wenn sie fertig ist (FOSSGIS antwortet sonst mit 429, live gemessen). */
const reihe = new Map<string, Promise<void>>();

/** Wartet, bis an diesen Dienst wieder eine Anfrage gehen darf (Nutzungsbedingung Nominatim/FOSSGIS: max. 1/s). */
function warteAufSlot(host: string): Promise<void> {
  const jetzt = Date.now();
  const frei = Math.max(jetzt, naechsterSlot.get(host) ?? 0);
  naechsterSlot.set(host, frei + ABSTAND_MS);
  const warte = frei - jetzt;
  return warte > 0 ? new Promise((ok) => setTimeout(ok, warte)) : Promise.resolve();
}

async function laden<T>(url: string, was: string): Promise<T> {
  const host = new URL(url).host;
  const vorher = reihe.get(host) ?? Promise.resolve();
  let fertig: () => void = () => {};
  const meins = new Promise<void>((ok) => { fertig = ok; });
  reihe.set(host, vorher.then(() => meins));
  await vorher;
  await warteAufSlot(host);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ZEITLIMIT);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: "application/json" } });
    if (r.status === 429) throw new DienstFehler(`${was}: zu viele Anfragen. Bitte gleich noch einmal versuchen.`);
    if (!r.ok) throw new DienstFehler(`${was} gerade nicht erreichbar (Fehler ${r.status}).`);
    return (await r.json()) as T;
  } catch (e) {
    if (e instanceof DienstFehler) throw e;
    throw new DienstFehler(`${was} gerade nicht erreichbar. Prüfe die Internetverbindung.`);
  } finally {
    clearTimeout(t);
    fertig();
  }
}

/** Gleiche Anfrage = gleiche Antwort aus dem Speicher (nur solange die Seite offen ist). Fehler werden nicht gemerkt. */
const zwischenspeicher = new Map<string, Promise<unknown>>();
const SPEICHER_MAX = 200;

export function holeJson<T>(url: string, was: string): Promise<T> {
  const da = zwischenspeicher.get(url);
  if (da) return da as Promise<T>;
  const p = laden<T>(url, was);
  zwischenspeicher.set(url, p);
  p.catch(() => zwischenspeicher.delete(url));
  if (zwischenspeicher.size > SPEICHER_MAX) zwischenspeicher.delete(zwischenspeicher.keys().next().value as string);
  return p;
}

/** Nur für Tests: Zwischenspeicher und Warteschlange zurücksetzen */
export function _zuruecksetzen() {
  zwischenspeicher.clear();
  naechsterSlot.clear();
  reihe.clear();
}

/* ---------- Standort ---------- */

/** Auf ~10 m runden: genauer braucht die Wegberechnung den Startpunkt nicht (Datensparsamkeit). */
export const runden = (n: number) => Math.round(n * 10 ** START_STELLEN) / 10 ** START_STELLEN;

export function gpsStandort(): Promise<Start> {
  return new Promise((ok, nein) => {
    if (!("geolocation" in navigator)) { nein(new DienstFehler("Dieses Gerät kann den Standort nicht bestimmen.")); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lngLat: [runden(p.coords.longitude), runden(p.coords.latitude)], name: "Mein Standort", quelle: "gps" }),
      (e) => nein(new DienstFehler(e.code === 1 ? "Standortfreigabe abgelehnt. Gib stattdessen eine Adresse ein." : "Standort gerade nicht bestimmbar. Gib eine Adresse ein.")),
      { enableHighAccuracy: true, timeout: ZEITLIMIT, maximumAge: 60000 },
    );
  });
}

interface NomAdresse { road?: string; house_number?: string; city?: string; town?: string; village?: string; suburb?: string; postcode?: string }
export interface NomTreffer {
  osm_type: string; osm_id: number; lat: string; lon: string; name?: string; display_name: string;
  type?: string; category?: string; extratags?: Record<string, string> | null; address?: NomAdresse;
}

/** Adresse suchen. Nur auf ausdrücklichen Knopfdruck aufrufen, nie beim Tippen (Nominatim verbietet Autovervollständigung). */
export async function adresseSuchen(text: string): Promise<Start[]> {
  const u = `${DIENSTE.nominatim}/search?${new URLSearchParams({ q: text, format: "jsonv2", limit: "5", addressdetails: "1", "accept-language": "de" })}`;
  const r = await holeJson<NomTreffer[]>(u, "Adresssuche");
  return r.map((t) => ({ lngLat: [runden(Number(t.lon)), runden(Number(t.lat))] as LngLat, name: kurzname(t), quelle: "adresse" as const }));
}

function kurzname(t: NomTreffer): string {
  const a = t.address ?? {};
  const strasse = [a.road, a.house_number].filter(Boolean).join(" ");
  const ort = a.city ?? a.town ?? a.village ?? "";
  return [t.name && t.name !== a.road ? t.name : null, strasse || null, ort || null].filter(Boolean).join(", ") || t.display_name;
}

/* ---------- Praxen ---------- */

/** Website aus OSM nur übernehmen, wenn sie eine echte http(s)-Adresse ergibt (kein javascript: o. Ä.). */
export function sichereWebsite(roh: string | undefined | null): string | null {
  const w = roh?.split(";")[0].trim();
  if (!w) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(w) ? w : `https://${w}`);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".") ? u.href : null;
  } catch {
    return null;
  }
}

/** Erste Telefonnummer (OSM erlaubt mehrere, getrennt mit „;“ – zusammengeklebt ergäbe das eine falsche Nummer). */
export function ersteNummer(roh: string | undefined | null): string | null {
  const n = roh?.split(";")[0].trim();
  return n && n.replace(/\D/g, "").length >= 4 ? n : null;
}

/** tel:-Link nur aus Ziffern und „+“ */
export const telLink = (nr: string) => `tel:${nr.replace(/[^\d+]/g, "")}`;

export function alsPraxis(t: NomTreffer): Praxis | null {
  const name = t.name?.trim();
  if (!name) return null;
  const tags = t.extratags ?? {};
  const fach = fachAusOsm(tags, name, t.type ?? "");
  if (!fach) return null;
  const a = t.address ?? {};
  return {
    id: `${t.osm_type}-${t.osm_id}`,
    fach,
    name,
    strasse: [a.road, a.house_number].filter(Boolean).join(" ") || null,
    ort: a.city ?? a.town ?? a.village ?? null,
    lngLat: [Number(t.lon), Number(t.lat)],
    website: sichereWebsite(tags.website ?? tags["contact:website"]),
    telefon: ersteNummer(tags.phone ?? tags["contact:phone"]),
    oeffnungszeiten: tags.opening_hours ?? null,
    rollstuhl: tags.wheelchair ?? null,
  };
}

export interface Suchergebnis {
  praxen: Praxis[];
  /** true = der Dienst hat seine Höchstzahl an Treffern geliefert, es kann weitere Praxen geben */
  gekappt: boolean;
}

/** Sucht Praxen einer Fachrichtung im Umkreis (Kreis mit radiusKm um den Start). */
export async function praxenSuchen(start: LngLat, fach: FachId, radiusKm: number): Promise<Suchergebnis> {
  const dLat = radiusKm / 111, dLng = radiusKm / (111 * Math.cos((start[1] * Math.PI) / 180));
  const box = [start[0] - dLng, start[1] + dLat, start[0] + dLng, start[1] - dLat].map((n) => n.toFixed(5)).join(",");
  // An Nominatim geht nur die Art (Arzt- oder Zahnarztpraxis), nie die Fachrichtung oder das Anliegen.
  // Achtung: Die Fahrzeit-Anfrage an FOSSGIS enthält danach die Orte der gefundenen Praxen – daraus ist die Fachrichtung ablesbar.
  const q = fach === "zahn" ? "[dentist]" : "[doctors]";
  const u = `${DIENSTE.nominatim}/search?${new URLSearchParams({ q, format: "jsonv2", limit: String(NOMINATIM_MAX), extratags: "1", addressdetails: "1", viewbox: box, bounded: "1", "accept-language": "de" })}`;
  const treffer = await holeJson<NomTreffer[]>(u, "Praxissuche");
  const alle = new Map<string, Praxis>();
  for (const t of treffer) {
    const p = alsPraxis(t);
    // Kreis statt Quadrat, damit „im Umkreis von x km“ stimmt
    if (p && p.fach === fach && luftlinie(start, p.lngLat) <= radiusKm) alle.set(p.id, p);
  }
  return { praxen: [...alle.values()], gekappt: treffer.length >= NOMINATIM_MAX };
}

/** Eine Praxis über ihre OSM-Kennung laden (für geteilte Links). */
export async function praxisLaden(id: string): Promise<Praxis | null> {
  const [typ, nr] = id.split("-");
  const k = ({ node: "N", way: "W", relation: "R" } as Record<string, string>)[typ];
  if (!k || !/^\d+$/.test(nr ?? "")) return null;
  const u = `${DIENSTE.nominatim}/lookup?${new URLSearchParams({ osm_ids: k + nr, format: "jsonv2", extratags: "1", addressdetails: "1", "accept-language": "de" })}`;
  const r = await holeJson<NomTreffer[]>(u, "Praxisdaten");
  return r[0] ? alsPraxis(r[0]) : null;
}

/* ---------- Wege ---------- */

export const pkt = (l: LngLat) => `${l[0].toFixed(5)},${l[1].toFixed(5)}`;
export const profil: Record<Modus, string> = { fuss: "foot", rad: "bike", auto: "driving" };

/**
 * Echte Fahrzeiten vom Start zu den nächsten Praxen: eine Anfrage je Verkehrsmittel, nacheinander
 * (die Warteschlange hält 1 Anfrage/s ein). Fällt ein Verkehrsmittel aus, steht es in nichtAbrufbar –
 * die App zeigt dann „nicht verfügbar“ statt „kein Weg“. Nichts wird geschätzt.
 * Das gewählte Verkehrsmittel kommt zuerst; beiTeil meldet jeden Zwischenstand, damit die Liste nicht auf alle warten muss.
 */
export async function zeitenBerechnen(
  start: LngLat, praxen: Praxis[], erster: Modus = "fuss", beiTeil?: (liste: PraxisMitZeit[]) => void,
  /** true = Ergebnis wird nicht mehr gebraucht: keine weiteren Anfragen stellen */
  abgebrochen?: () => boolean,
): Promise<{ liste: PraxisMitZeit[]; fehler: string | null }> {
  const mit: PraxisMitZeit[] = praxen
    .map((p) => ({ ...p, entfernung: Math.round(luftlinie(start, p.lngLat) * 10) / 10, zeiten: { fuss: null, rad: null, auto: null } as Record<Modus, Zeit | null> }))
    .sort((a, b) => a.entfernung - b.entfernung)
    .slice(0, MAX_ZIELE);
  if (mit.length === 0) return { liste: [], fehler: null };
  const coords = [start, ...mit.map((p) => p.lngLat)].map(pkt).join(";");
  const fehlend: Modus[] = [];
  let ersterFehler: string | null = null;
  const folge = [erster, ...MODI.filter((m) => m !== erster)];
  for (const [i, m] of folge.entries()) {
    if (abgebrochen?.()) break;
    try {
      const u = `${DIENSTE.routing[m]}/table/v1/${profil[m]}/${coords}?sources=0&annotations=duration,distance`;
      const r = await holeJson<{ code: string; durations?: (number | null)[][]; distances?: (number | null)[][] }>(u, "Wegberechnung");
      if (r.code !== "Ok" || !r.durations?.[0]) throw new DienstFehler("Wegberechnung lieferte keine Zeiten.");
      mit.forEach((p, i) => {
        const s = r.durations![0][i + 1], d = r.distances?.[0]?.[i + 1];
        p.zeiten[m] = s != null && d != null ? { s, m: d } : null;
      });
    } catch (e) {
      fehlend.push(m);
      ersterFehler ??= e instanceof DienstFehler ? e.message : "Wegberechnung gerade nicht erreichbar.";
    }
    const ausstehend = folge.slice(i + 1);
    mit.forEach((p) => {
      p.nichtAbrufbar = fehlend.length ? [...fehlend] : undefined;
      p.ausstehend = ausstehend.length ? ausstehend : undefined;
    });
    if (ausstehend.length) beiTeil?.(mit.map((p) => ({ ...p, zeiten: { ...p.zeiten } })));
  }
  // Fallen alle Verkehrsmittel aus, bleiben die Praxen sichtbar, nur ohne Zeiten.
  return { liste: mit, fehler: fehlend.length === MODI.length ? ersterFehler : null };
}

/** Genaue Linie eines Weges für die Karte. */
export async function wegLaden(start: LngLat, ziel: LngLat, m: Modus): Promise<Weg> {
  const u = `${DIENSTE.routing[m]}/route/v1/${profil[m]}/${pkt(start)};${pkt(ziel)}?overview=full&geometries=geojson`;
  const r = await holeJson<{ code: string; routes?: { distance: number; duration: number; geometry: { coordinates: LngLat[] } }[] }>(u, "Wegberechnung");
  const x = r.routes?.[0];
  if (r.code !== "Ok" || !x) throw new DienstFehler("Für diesen Weg gibt es gerade keine Route.");
  return { s: x.duration, m: x.distance, line: x.geometry.coordinates };
}

export const fehlerText = (e: unknown) => (e instanceof Error && e.message ? e.message : "Unbekannter Fehler.");
