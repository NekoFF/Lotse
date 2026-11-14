import { holeJson } from "./dienste";

/**
 * Fotos nur aus Wikimedia Commons (freie Lizenzen), verknüpft über die OSM-Tags
 * wikimedia_commons, image (Commons-Link) oder wikidata (Eigenschaft P18).
 * Immer mit Urheber und Lizenz anzeigen.
 */
export interface Foto { url: string; autor: string; lizenz: string; seite: string }
export interface BildHinweis { commons?: string; wikidata?: string }

const ohneHtml = (s: string) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/** Dateiname „File:…“ aus OSM-Tags ableiten */
export function commonsDatei(tags: Record<string, string>): string | null {
  const c = tags.wikimedia_commons?.trim();
  if (c?.startsWith("File:")) return c;
  const img = tags.image?.trim();
  if (img && /commons\.wikimedia\.org|upload\.wikimedia\.org/.test(img)) {
    const name = decodeURIComponent(img.split("/").pop() ?? "").replace(/^File:/, "");
    if (name && /\.(jpe?g|png|webp|tiff?)$/i.test(name)) return `File:${name}`;
  }
  return null;
}

export async function fotoLaden(h: BildHinweis): Promise<Foto | null> {
  let datei = h.commons ?? null;
  if (!datei && h.wikidata && /^Q\d+$/.test(h.wikidata)) {
    const w = await holeJson<{ claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] } }>(
      `https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: "wbgetclaims", format: "json", origin: "*", entity: h.wikidata, property: "P18" })}`, "Foto");
    const name = w.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (name) datei = `File:${name}`;
  }
  if (!datei) return null;
  const r = await holeJson<{ query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[] }> } }>(
    `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: "query", format: "json", origin: "*", prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "800", titles: datei })}`, "Foto");
  const info = Object.values(r.query?.pages ?? {})[0]?.imageinfo?.[0];
  if (!info?.thumburl || !info.descriptionurl) return null;
  const m = info.extmetadata ?? {};
  return { url: info.thumburl, seite: info.descriptionurl, autor: ohneHtml(m.Artist?.value ?? "unbekannt"), lizenz: ohneHtml(m.LicenseShortName?.value ?? "siehe Commons") };
}
