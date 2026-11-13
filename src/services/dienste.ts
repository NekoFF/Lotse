import { DIENSTE, MAX_ZIELE, ZEITLIMIT } from "../config";
import { fachAusOsm } from "../core/osmFach";
import type { FachId } from "../data/fachrichtungen";
import { luftlinie, MODI, type LngLat, type Modus, type Praxis, type PraxisMitZeit, type Start, type Weg, type Zeit } from "../data/praxen";

/** Fehler mit einem Satz, der so in der App angezeigt werden kann */
export class DienstFehler extends Error {}

async function holeJson<T>(url: string, was: string): Promise<T> {
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), ZEITLIMIT);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: "application/json" } });
    if (r.status === 429) throw new DienstFehler(`${was}: zu viele Anfragen. Bitte gleich noch einmal versuchen.`);
    if (!r.ok) throw new DienstFehler(`${was} gerade nicht erreichbar (Fehler ${r.status}).`);
    return (await r.json()) as T;
  } catch (e) {
    if (e instanceof DienstFehler) throw e;
    throw new DienstFehler(`${was} gerade nicht erreichbar. Prüfe die Internetverbindung.`);
  } finally {
    window.clearTimeout(t);
  }
}

/* ---------- Standort ---------- */

export function gpsStandort(): Promise<Start> {
  return new Promise((ok, nein) => {
    if (!("geolocation" in navigator)) { nein(new DienstFehler("Dieses Gerät kann den Standort nicht bestimmen.")); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lngLat: [p.coords.longitude, p.coords.latitude], name: "Mein Standort", quelle: "gps" }),
      (e) => nein(new DienstFehler(e.code === 1 ? "Standortfreigabe abgelehnt. Gib stattdessen eine Adresse ein." : "Standort gerade nicht bestimmbar. Gib eine Adresse ein.")),
      { enableHighAccuracy: true, timeout: ZEITLIMIT, maximumAge: 60000 },
    );
  });
}

interface NomAdresse { road?: string; house_number?: string; city?: string; town?: string; village?: string; suburb?: string; postcode?: string }
interface NomTreffer {
  osm_type: string; osm_id: number; lat: string; lon: string; name?: string; display_name: string;
  type?: string; category?: string; extratags?: Record<string, string> | null; address?: NomAdresse;
}

export async function adresseSuchen(text: string): Promise<Start[]> {
  const u = `${DIENSTE.nominatim}/search?${new URLSearchParams({ q: text, format: "jsonv2", limit: "5", addressdetails: "1", "accept-language": "de" })}`;
  const r = await holeJson<NomTreffer[]>(u, "Adresssuche");
  return r.map((t) => ({ lngLat: [Number(t.lon), Number(t.lat)] as LngLat, name: kurzname(t), quelle: "adresse" as const }));
}

function kurzname(t: NomTreffer): string {
  const a = t.address ?? {};
  const strasse = [a.road, a.house_number].filter(Boolean).join(" ");
  const ort = a.city ?? a.town ?? a.village ?? "";
  return [t.name && t.name !== a.road ? t.name : null, strasse || null, ort || null].filter(Boolean).join(", ") || t.display_name;
}

/* ---------- Praxen ---------- */

function alsPraxis(t: NomTreffer): Praxis | null {
  const name = t.name?.trim();
  if (!name) return null;
  const tags = t.extratags ?? {};
  const fach = fachAusOsm(tags, name, t.type ?? "");
  if (!fach) return null;
  const a = t.address ?? {};
  const web = tags.website ?? tags["contact:website"] ?? null;
  return {
    id: `${t.osm_type}-${t.osm_id}`,
    fach,
    name,
    strasse: [a.road, a.house_number].filter(Boolean).join(" ") || null,
    ort: a.city ?? a.town ?? a.village ?? null,
    lngLat: [Number(t.lon), Number(t.lat)],
    website: web ? (/^https?:\/\//i.test(web) ? web : `https://${web}`) : null,
    telefon: tags.phone ?? tags["contact:phone"] ?? null,
    oeffnungszeiten: tags.opening_hours ?? null,
    rollstuhl: tags.wheelchair ?? null,
  };
}

/** Sucht Praxen einer Fachrichtung im Umkreis (Quadrat mit Kantenlänge 2 × radiusKm). */
export async function praxenSuchen(start: LngLat, fach: FachId, radiusKm: number): Promise<Praxis[]> {
  const dLat = radiusKm / 111, dLng = radiusKm / (111 * Math.cos((start[1] * Math.PI) / 180));
  const box = [start[0] - dLng, start[1] + dLat, start[0] + dLng, start[1] - dLat].map((n) => n.toFixed(5)).join(",");
  const arten = fach === "zahn" ? ["[dentist]"] : ["[doctors]"];
  const alle = new Map<string, Praxis>();
  for (const q of arten) {
    const u = `${DIENSTE.nominatim}/search?${new URLSearchParams({ q, format: "jsonv2", limit: "50", extratags: "1", addressdetails: "1", viewbox: box, bounded: "1", "accept-language": "de" })}`;
    for (const t of await holeJson<NomTreffer[]>(u, "Praxissuche")) {
      const p = alsPraxis(t);
      if (p && p.fach === fach) alle.set(p.id, p);
    }
  }
  return [...alle.values()];
}

/** Eine Praxis über ihre OSM-Kennung laden (für geteilte Links). */
export async function praxisLaden(id: string): Promise<Praxis | null> {
  const [typ, nr] = id.split("-");
  const k = { node: "N", way: "W", relation: "R" }[typ];
  if (!k || !/^\d+$/.test(nr)) return null;
  const u = `${DIENSTE.nominatim}/lookup?${new URLSearchParams({ osm_ids: k + nr, format: "jsonv2", extratags: "1", addressdetails: "1", "accept-language": "de" })}`;
  const r = await holeJson<NomTreffer[]>(u, "Praxisdaten");
  return r[0] ? alsPraxis(r[0]) : null;
}

/* ---------- Wege ---------- */

const pkt = (l: LngLat) => `${l[0].toFixed(5)},${l[1].toFixed(5)}`;
const profil: Record<Modus, string> = { fuss: "foot", rad: "bike", auto: "driving" };

/** Echte Fahrzeiten vom Start zu allen Praxen: eine Anfrage je Verkehrsmittel. */
export async function zeitenBerechnen(start: LngLat, praxen: Praxis[]): Promise<PraxisMitZeit[]> {
  const mit = praxen
    .map((p) => ({ ...p, entfernung: Math.round(luftlinie(start, p.lngLat) * 10) / 10, zeiten: { fuss: null, rad: null, auto: null } as Record<Modus, Zeit | null> }))
    .sort((a, b) => a.entfernung - b.entfernung)
    .slice(0, MAX_ZIELE);
  if (mit.length === 0) return [];
  const coords = [start, ...mit.map((p) => p.lngLat)].map(pkt).join(";");
  const ergebnisse = await Promise.allSettled(MODI.map(async (m) => {
    const u = `${DIENSTE.routing[m]}/table/v1/${profil[m]}/${coords}?sources=0&annotations=duration,distance`;
    const r = await holeJson<{ code: string; durations?: (number | null)[][]; distances?: (number | null)[][] }>(u, "Wegberechnung");
    if (r.code !== "Ok" || !r.durations) throw new DienstFehler("Wegberechnung lieferte keine Zeiten.");
    mit.forEach((p, i) => {
      const s = r.durations![0][i + 1], d = r.distances?.[0][i + 1];
      p.zeiten[m] = s != null && d != null ? { s, m: d } : null;
    });
  }));
  if (ergebnisse.every((e) => e.status === "rejected")) throw (ergebnisse[0] as PromiseRejectedResult).reason;
  return mit;
}

/** Genaue Linie eines Weges für die Karte. */
export async function wegLaden(start: LngLat, ziel: LngLat, m: Modus): Promise<Weg> {
  const u = `${DIENSTE.routing[m]}/route/v1/${profil[m]}/${pkt(start)};${pkt(ziel)}?overview=full&geometries=geojson`;
  const r = await holeJson<{ code: string; routes?: { distance: number; duration: number; geometry: { coordinates: LngLat[] } }[] }>(u, "Wegberechnung");
  const x = r.routes?.[0];
  if (r.code !== "Ok" || !x) throw new DienstFehler("Für diesen Weg gibt es gerade keine Route.");
  return { s: x.duration, m: x.distance, line: x.geometry.coordinates };
}
