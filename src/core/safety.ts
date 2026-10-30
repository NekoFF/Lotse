import { NOTFALL_BEGRIFFE, type Notfallstufe } from "../data/notfall";
import { containsTerm, normalize } from "./normalize";

export interface SicherheitsErgebnis {
  /** null = keine Auffälligkeit, die Suche darf weiterlaufen */
  stufe: Notfallstufe | null;
  /** gefundene Begriffe, nur für Tests und Nachvollziehbarkeit — wird nie gespeichert */
  treffer: string[];
}

const RANG: Record<Notfallstufe, number> = { notruf: 3, seelsorge: 2, bereitschaft: 1 };

/**
 * Sicherheitsfilter. Läuft VOR jeder Zuordnung.
 * Liefert die schwerste gefundene Stufe. Notruf schlägt Seelsorge schlägt Bereitschaftsdienst.
 */
export function pruefeSicherheit(text: string): SicherheitsErgebnis {
  const norm = normalize(text);
  const treffer: string[] = [];
  let stufe: Notfallstufe | null = null;

  for (const { begriff, stufe: s } of NOTFALL_BEGRIFFE) {
    if (containsTerm(norm, normalize(begriff))) {
      treffer.push(begriff);
      if (stufe === null || RANG[s] > RANG[stufe]) stufe = s;
    }
  }
  return { stufe, treffer };
}
