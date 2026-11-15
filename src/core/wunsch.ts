import { KATEGORIEN, zeitAus, type Kategorie } from "./absicht";
import { normalize } from "./normalize";

/**
 * Wünsche wie „Pizza nahe Römer in Frankfurt, jetzt geöffnet“ in Bausteine zerlegen.
 * Feste Regeln (zuverlässig), die KI wird dafür nicht gebraucht.
 */
export interface Kueche { name: string; wort: RegExp; osm: RegExp; phrasen: string[] }

export const KUECHEN: Kueche[] = [
  { name: "Pizza", wort: /pizz/, osm: /pizza|italian/, phrasen: ["restaurant", "fast_food"] },
  { name: "Döner", wort: /doener|doner|kebab|kebap/, osm: /kebab|turkish|doner|döner/, phrasen: ["fast_food", "restaurant"] },
  { name: "Burger", wort: /burger/, osm: /burger/, phrasen: ["fast_food", "restaurant"] },
  { name: "Sushi", wort: /sushi/, osm: /sushi|japanese/, phrasen: ["restaurant"] },
  { name: "Asiatisch", wort: /asiat|chines|\bthai(?!land)|vietnam/, osm: /asian|chinese|thai|vietnamese/, phrasen: ["restaurant", "fast_food"] },
  { name: "Indisch", wort: /indisch|\bcurry(?!wurst)/, osm: /indian/, phrasen: ["restaurant"] },
  { name: "Eis", wort: /\beis\b|eiscafe|eisdiele/, osm: /ice_cream/, phrasen: ["ice_cream", "cafe"] },
];

export interface Wunsch {
  kueche: Kueche | null;
  kategorie: Kategorie | null;
  /** Stadt („in Frankfurt“) */
  ort: string;
  /** Bezugspunkt („nahe Römer“, „beim Bahnhof“) */
  nahe: string;
  /** gewünschter Zeitpunkt (jetzt oder genannt) */
  zeit: Date | null;
  /** nur geöffnete Orte gewünscht */
  offen: boolean;
  /** ausdrücklich „jetzt / offen / geöffnet“ gesagt */
  sofort: boolean;
}

const kat = (id: string) => KATEGORIEN.find((k) => k.id === id) ?? null;

export function wunschAus(text: string, jetzt = new Date()): Wunsch {
  const n = normalize(text);
  const kueche = KUECHEN.find((k) => k.wort.test(n)) ?? null;
  // Stimmung nur mit Freizeit-Bezug („mit Oma spazieren“), nicht „Familie Schmidt“ oder „mit Oma zum Arzt“
  const ruhig = /\b(ruhig|entspann|spazier|nicht (zu )?laut|gemuetlich|ausflug)/.test(n)
    || (/\bmit (meiner |meinen |meinem |der |den )?(eltern|familie|oma|opa|kindern)\b/.test(n) && !/\b(arzt|aerztin|praxis|apotheke|klinik|krankenhaus)/.test(n));
  const kategorie = ruhig ? kat("freizeit") : null;
  const ort = text.match(/\b(?:in|im)\s+([A-ZÄÖÜ][\wäöüß.-]+(?:\s+(?:am|an der)\s+[A-ZÄÖÜ][\wäöüß-]+)?)/)?.[1] ?? "";
  const nahe = text.match(/\b(?:nahe(?:\s+(?:dem|der|vom))?|in der N[äa]he (?:von|vom|der|des)|bei(?:m)?|vom|von der)\s+([A-ZÄÖÜ][^,?.!]*?)(?=\s+(?:in|im|um|jetzt|heute|morgen|gerade|offen|ge[öo]ffnet)\b|[,?.!]|$)/)?.[1]?.trim() ?? "";
  const genannt = zeitAus(text, jetzt);
  const sofort = /\b(jetzt|gerade|sofort|noch offen|offen|geoeffnet|auf hat|aufhat)\b/.test(n);
  return { kueche, kategorie, ort: ort === nahe ? "" : ort, nahe, zeit: genannt ?? (sofort ? jetzt : null), offen: sofort || !!genannt, sofort };
}

/** Lohnt sich die Wunsch-Suche? (sonst normale Regeln) */
/** Lohnt sich die Wunsch-Suche? Nur mit Küche, Stimmung, „jetzt offen“ oder Kategorie + „nahe X“.
 *  Eine bloße Zeit oder „bei Dr. Müller“ (Termin!) reicht nicht. */
export const istWunsch = (w: Wunsch, istKategorie = false) => !!(w.kueche || w.kategorie || (istKategorie && (w.nahe || w.sofort)));
