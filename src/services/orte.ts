import { DIENSTE } from "../config";
import { fachAusOsm } from "../core/osmFach";
import type { FachId } from "../data/fachrichtungen";
import { luftlinie, type LngLat, type Modus } from "../data/praxen";
import { DienstFehler, ersteNummer, holeJson, pkt, profil, sichereWebsite, type NomTreffer } from "./dienste";
import { commonsDatei, type BildHinweis } from "./foto";

/** Ein beliebiger Ort auf der Karte: Adresse, Laden, Haltestelle, Praxis … (alles aus OpenStreetMap) */
export interface Ort {
  id: string;
  name: string;
  art: string;
  lngLat: LngLat;
  adresse: string | null;
  website: string | null;
  telefon: string | null;
  /** fehlt bei älteren gespeicherten Orten */
  email?: string | null;
  oeffnungszeiten: string | null;
  rollstuhl: string | null;
  fach: FachId | null;
  /** Verweis auf ein freies Foto (Wikimedia Commons / Wikidata), falls in OSM eingetragen */
  bild?: BildHinweis;
}

const ART: Record<string, string> = {
  doctors: "Arztpraxis", dentist: "Zahnarztpraxis", pharmacy: "Apotheke", hospital: "Krankenhaus", clinic: "Klinik",
  restaurant: "Restaurant", cafe: "Café", fast_food: "Imbiss", bar: "Bar", pub: "Kneipe", cinema: "Kino", theatre: "Theater",
  museum: "Museum", park: "Park", playground: "Spielplatz", supermarket: "Supermarkt", bakery: "Bäckerei", school: "Schule",
  bus_stop: "Bushaltestelle", station: "Bahnhof", halt: "Haltepunkt", tram_stop: "Straßenbahn", library: "Bibliothek",
  place_of_worship: "Kirche/Gebetshaus", post_office: "Post", bank: "Bank", atm: "Geldautomat", fuel: "Tankstelle",
  parking: "Parkplatz", swimming_pool: "Schwimmbad", sports_centre: "Sportzentrum", hotel: "Hotel", attraction: "Sehenswürdigkeit",
  house: "Adresse", residential: "Straße", road: "Straße", city: "Stadt", town: "Stadt", village: "Ort", suburb: "Stadtteil",
};

function adresseVon(t: NomTreffer): string | null {
  const a = t.address ?? {};
  const strasse = [a.road, a.house_number].filter(Boolean).join(" ");
  const ort = [a.postcode, a.city ?? a.town ?? a.village].filter(Boolean).join(" ");
  return [strasse, ort].filter(Boolean).join(", ") || null;
}

export function alsOrt(t: NomTreffer): Ort {
  const tags = t.extratags ?? {};
  const a = t.address ?? {};
  const name = t.name?.trim() || [a.road, a.house_number].filter(Boolean).join(" ") || t.display_name.split(",")[0];
  return {
    id: `${t.osm_type}-${t.osm_id}`,
    name,
    art: ART[t.type ?? ""] ?? ART[t.category ?? ""] ?? (a.house_number ? "Adresse" : "Ort"),
    lngLat: [Number(t.lon), Number(t.lat)],
    adresse: adresseVon(t),
    website: sichereWebsite(tags.website ?? tags["contact:website"]),
    telefon: ersteNummer(tags.phone ?? tags["contact:phone"]),
    email: sichereEmail(tags.email ?? tags["contact:email"]),
    oeffnungszeiten: tags.opening_hours ?? null,
    rollstuhl: tags.wheelchair ?? null,
    fach: t.type === "doctors" || t.type === "dentist" ? fachAusOsm(tags, name, t.type) : null,
    bild: commonsDatei(tags) || tags.wikidata ? { commons: commonsDatei(tags) ?? undefined, wikidata: tags.wikidata } : undefined,
  };
}

const basis = { format: "jsonv2", addressdetails: "1", extratags: "1", "accept-language": "de" };
const box = (m: LngLat, km: number) => {
  const dLat = km / 111, dLng = km / (111 * Math.cos((m[1] * Math.PI) / 180));
  return [m[0] - dLng, m[1] + dLat, m[0] + dLng, m[1] - dLat].map((n) => n.toFixed(5)).join(",");
};

/** E-Mail aus OSM nur übernehmen, wenn sie wie eine Adresse aussieht (erste von mehreren) */
export function sichereEmail(roh: string | undefined | null): string | null {
  const e = roh?.split(";")[0].trim();
  return e && /^[^@\s<>"']+@[^@\s<>"']+\.[a-z]{2,}$/i.test(e) ? e : null;
}

/** Freie Suche (Adresse, Ort, Name). Bevorzugt Treffer in der Nähe. Nur auf Knopfdruck (Nominatim-Regel). */
export async function suchen(text: string, nahe: LngLat | null): Promise<Ort[]> {
  const q = new URLSearchParams({ ...basis, q: text, limit: "8", ...(nahe ? { viewbox: box(nahe, 30) } : {}) });
  const r = await holeJson<NomTreffer[]>(`${DIENSTE.nominatim}/search?${q}`, "Suche");
  const orte = r.map(alsOrt);
  // Nächste zuerst (wie bei Karten-Apps); ferne Treffer rutschen ans Ende
  return nahe ? orte.sort((a, b) => luftlinie(nahe, a.lngLat) - luftlinie(nahe, b.lngLat)) : orte;
}

/** Orte einer Art in der Nähe (z. B. „[cafe]“), nach Luftlinie sortiert */
export async function inDerNaehe(phrasen: string[], mitte: LngLat, km = 3): Promise<Ort[]> {
  const alle = new Map<string, Ort>();
  for (const p of phrasen) {
    const q = new URLSearchParams({ ...basis, q: `[${p}]`, limit: "40", viewbox: box(mitte, km), bounded: "1" });
    for (const t of await holeJson<NomTreffer[]>(`${DIENSTE.nominatim}/search?${q}`, "Suche")) {
      const o = alsOrt(t);
      if (t.name && luftlinie(mitte, o.lngLat) <= km) alle.set(o.id, o);
    }
  }
  return [...alle.values()].sort((a, b) => luftlinie(mitte, a.lngLat) - luftlinie(mitte, b.lngLat));
}

/** Was ist an dieser Stelle? (Tipp auf die Karte) */
export async function ortAnStelle(l: LngLat): Promise<Ort> {
  const q = new URLSearchParams({ ...basis, lat: l[1].toFixed(5), lon: l[0].toFixed(5), zoom: "18" });
  const t = await holeJson<NomTreffer & { error?: string }>(`${DIENSTE.nominatim}/reverse?${q}`, "Ortsabfrage");
  if (t.error || !t.lat) return { id: `punkt-${l.join(",")}`, name: "Punkt auf der Karte", art: "Ort", lngLat: l, adresse: null, website: null, telefon: null, email: null, oeffnungszeiten: null, rollstuhl: null, fach: null };
  return alsOrt(t);
}

/** Kartensymbol angetippt: den Ort über seinen NAMEN in direkter Umgebung suchen – liefert Website, Telefon,
 *  Öffnungszeiten aus OSM. (Die Koordinaten-Abfrage trifft oft nur das Gebäude daneben.) */
export async function ortMitNamen(name: string, l: LngLat, art = ""): Promise<Ort | null> {
  // Namen auf der Karte können älter sein als die Live-Daten („Dr. Wirth & Cem Canerik“ ↔ „Cem Canerik & Kollegen“):
  // Ähnlichkeit über gemeinsame bedeutsame Wörter
  const woerter = (x: string) => new Set(x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !["und", "der", "die", "das", "fur", "dres", "med", "praxis"].includes(w)));
  const ziel = woerter(name);
  const aehnlich = (o: Ort) => { const w = woerter(o.name); let g = 0; ziel.forEach((x) => { if (w.has(x)) g++; }); return ziel.size && w.size ? g / Math.min(ziel.size, w.size) : 0; };
  const holen = async (q: string, km: number) => (await holeJson<NomTreffer[]>(`${DIENSTE.nominatim}/search?${new URLSearchParams({ ...basis, q, limit: "20", viewbox: box(l, km), bounded: "1" })}`, "Ortsdaten")).map(alsOrt);
  const bester = (r: Ort[], min: number) => r.filter((o) => aehnlich(o) >= min).sort((a, b) => aehnlich(b) - aehnlich(a) || luftlinie(l, a.lngLat) - luftlinie(l, b.lngLat))[0] ?? null;
  // 1. genau über den Namen
  const genau = bester(await holen(name, 0.15), 0.5);
  if (genau) return genau;
  // 2. Orte dieser Art direkt daneben (z. B. alle Zahnarztpraxen im Umkreis von 100 m), ähnlichster Name
  const phrase = ({ Zahnarztpraxis: "dentist", Arztpraxis: "doctors", Apotheke: "pharmacy", Klinik: "clinic", Krankenhaus: "hospital", Bushaltestelle: "bus_stop" } as Record<string, string>)[art];
  if (!phrase) return null;
  return bester(await holen(`[${phrase}]`, 0.1), 0.34);
}

/** Details zu einem Ort über seine OSM-Kennung (z. B. „node-123“) */
export async function ortLaden(id: string): Promise<Ort | null> {
  const [typ, nr] = id.split("-");
  const k = ({ node: "N", way: "W", relation: "R" } as Record<string, string>)[typ];
  if (!k || !/^\d+$/.test(nr ?? "")) return null;
  const r = await holeJson<NomTreffer[]>(`${DIENSTE.nominatim}/lookup?${new URLSearchParams({ ...basis, osm_ids: k + nr })}`, "Ortsdaten");
  return r[0] ? alsOrt(r[0]) : null;
}

/* ---------- Route mit Schritten ---------- */

export interface Schritt { text: string; m: number }
export interface Route { s: number; m: number; line: LngLat[]; schritte: Schritt[]; /** Hauptstraßen laut Routendienst, z. B. „B49, L3020“ */ ueber?: string }

export interface OsrmSchritt { distance: number; name: string; maneuver: { type: string; modifier?: string; exit?: number } }

const RICHTUNG: Record<string, string> = {
  left: "links", right: "rechts", "slight left": "leicht links", "slight right": "leicht rechts",
  "sharp left": "scharf links", "sharp right": "scharf rechts", straight: "geradeaus", uturn: "wenden",
};

export function schrittText(s: OsrmSchritt): string {
  const { type, modifier, exit } = s.maneuver;
  const auf = s.name ? ` auf ${s.name}` : "";
  const r = modifier ? RICHTUNG[modifier] ?? "" : "";
  switch (type) {
    case "depart": return `Los${auf}`;
    case "arrive": return "Ziel erreicht";
    case "roundabout": case "rotary": return `Im Kreisverkehr ${exit ? `${exit}. Ausfahrt` : "abfahren"}${auf}`;
    case "continue": case "new name": return `Weiter${auf}`;
    default: return r === "geradeaus" ? `Geradeaus${auf}` : r === "wenden" ? "Wenden" : `${r ? r[0].toUpperCase() + r.slice(1) : "Weiter"} abbiegen${auf}`;
  }
}

/** Bis zu drei echte Routen (Hauptroute + Alternativen des Routendienstes) */
export async function routenLaden(start: LngLat, ziel: LngLat, m: Modus): Promise<Route[]> {
  const u = `${DIENSTE.routing[m]}/route/v1/${profil[m]}/${pkt(start)};${pkt(ziel)}?overview=full&geometries=geojson&steps=true&alternatives=true`;
  const r = await holeJson<{ code: string; routes?: { distance: number; duration: number; geometry: { coordinates: LngLat[] }; legs: { summary?: string; steps: OsrmSchritt[] }[] }[] }>(u, "Wegberechnung");
  if (r.code !== "Ok" || !r.routes?.length) throw new DienstFehler("Für diesen Weg gibt es gerade keine Route.");
  return r.routes.slice(0, 3).map((x) => ({
    s: x.duration, m: x.distance, line: x.geometry.coordinates,
    schritte: x.legs.flatMap((l) => l.steps).map((st) => ({ text: schrittText(st), m: st.distance })),
    ueber: x.legs.map((l) => l.summary).filter(Boolean).join(", "),
  }));
}

export async function routeLaden(start: LngLat, ziel: LngLat, m: Modus): Promise<Route> {
  return (await routenLaden(start, ziel, m))[0];
}
