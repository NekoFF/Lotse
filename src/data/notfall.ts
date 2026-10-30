/**
 * Begriffe, bei denen Lotse KEINE Praxissuche anbietet, sondern sofort auf Hilfe verweist.
 *
 * Stand: Version 0, vom Team zusammengestellt.
 * Wird durch AP „Begriffsliste für den Sicherheitsfilter“ (Abdi) anhand offizieller Quellen
 * (116117.de, Notfallseiten der Krankenkassen) geprüft und erweitert.
 *
 * Grundsatz: Im Zweifel abbrechen. Ein überflüssiger Hinweis ist harmlos, ein fehlender nicht.
 */

export type Notfallstufe = "notruf" | "seelsorge" | "bereitschaft";

export interface NotfallBegriff {
  begriff: string;
  stufe: Notfallstufe;
}

export const NOTFALL_BEGRIFFE: NotfallBegriff[] = [
  // Notruf 112
  { begriff: "brustschmerz", stufe: "notruf" },
  { begriff: "schmerzen in der brust", stufe: "notruf" },
  { begriff: "druck auf der brust", stufe: "notruf" },
  { begriff: "engegefuehl in der brust", stufe: "notruf" },
  { begriff: "atemnot", stufe: "notruf" },
  { begriff: "keine luft", stufe: "notruf" },
  { begriff: "kaum luft", stufe: "notruf" },
  { begriff: "schlecht luft", stufe: "notruf" },
  { begriff: "ersticke", stufe: "notruf" },
  { begriff: "bewusstlos", stufe: "notruf" },
  { begriff: "ohnmaechtig", stufe: "notruf" },
  { begriff: "nicht ansprechbar", stufe: "notruf" },
  { begriff: "krampfanfall", stufe: "notruf" },
  { begriff: "starke blutung", stufe: "notruf" },
  { begriff: "blutet stark", stufe: "notruf" },
  { begriff: "hoert nicht auf zu bluten", stufe: "notruf" },
  { begriff: "blut erbrochen", stufe: "notruf" },
  { begriff: "erbreche blut", stufe: "notruf" },
  { begriff: "gesicht haengt", stufe: "notruf" },
  { begriff: "laehmung", stufe: "notruf" },
  { begriff: "arm ist gelaehmt", stufe: "notruf" },
  { begriff: "kann nicht mehr sprechen", stufe: "notruf" },
  { begriff: "verwaschene sprache", stufe: "notruf" },
  { begriff: "vergiftung", stufe: "notruf" },
  { begriff: "vergiftet", stufe: "notruf" },
  { begriff: "allergischer schock", stufe: "notruf" },
  { begriff: "zunge schwillt", stufe: "notruf" },
  { begriff: "hals schwillt zu", stufe: "notruf" },
  { begriff: "schwer verletzt", stufe: "notruf" },
  { begriff: "notfall", stufe: "notruf" },

  // Seelische Krise: Telefonseelsorge 116 123 (zusätzlich 112 bei akuter Gefahr)
  { begriff: "suizid", stufe: "seelsorge" },
  { begriff: "selbstmord", stufe: "seelsorge" },
  { begriff: "mich umbringen", stufe: "seelsorge" },
  { begriff: "nicht mehr leben", stufe: "seelsorge" },
  { begriff: "will sterben", stufe: "seelsorge" },
  { begriff: "mir etwas antun", stufe: "seelsorge" },
  { begriff: "mir was antun", stufe: "seelsorge" },

  // Akut, aber ohne Lebensgefahr: ärztlicher Bereitschaftsdienst 116117
  { begriff: "hohes fieber", stufe: "bereitschaft" },
  { begriff: "ploetzlich", stufe: "bereitschaft" },
  { begriff: "unertraeglich", stufe: "bereitschaft" },
  { begriff: "sehr starke schmerzen", stufe: "bereitschaft" },
];
