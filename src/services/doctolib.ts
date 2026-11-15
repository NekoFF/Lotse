import type { FachId } from "../data/fachrichtungen";
import type { Ort } from "./orte";

/**
 * Doctolib: nur LINKS (kein Auslesen der Seite – das verbieten die Nutzungsbedingungen, und es gibt keine offene Schnittstelle).
 * Die Fachgebiet-Pfade wurden am 15.11.2026 im Browser geprüft; für andere Fächer öffnet sich die Doctolib-Startseite.
 */
const PFAD: Partial<Record<FachId, string>> = {
  zahn: "zahnmedizin", allgemein: "allgemeinmedizin", derma: "hautarzt", auge: "augenheilkunde", gyn: "frauenarzt", uro: "urologie",
};

const slug = (s: string) => s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Stadt aus „Straße, 35578 Wetzlar“ */
export const stadtAus = (adresse: string | null) => adresse?.match(/\b\d{5}\s+([^,]+)$/)?.[1]?.trim() ?? null;

export function istDoctolib(url: string | null): boolean {
  if (!url) return false;
  try { return /(^|\.)doctolib\.(de|fr|it)$/i.test(new URL(url).hostname); } catch { return false; }
}

/** Link zur passenden Doctolib-Übersicht (Fach + Stadt) oder zur Startseite */
export function doctolibLink(o: Ort): string {
  const pfad = o.fach ? PFAD[o.fach] : undefined;
  const stadt = stadtAus(o.adresse);
  return pfad && stadt ? `https://www.doctolib.de/${pfad}/${slug(stadt)}` : "https://www.doctolib.de/";
}
