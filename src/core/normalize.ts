/**
 * Bringt Freitext in eine vergleichbare Form:
 * Kleinbuchstaben, Umlaute ausgeschrieben, Satzzeichen entfernt, Leerraum vereinheitlicht.
 * „Mein Rücken tut WEH!“ -> "mein ruecken tut weh"
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Prüft, ob ein Begriff am Wortanfang im Text vorkommt.
 * "arm" trifft "arm", "armbeuge", "armen" — aber nicht "warm" oder "darm".
 * Mehrwortbegriffe („keine luft“) werden als zusammenhängende Folge gesucht.
 */
export function containsTerm(normText: string, normTerm: string): boolean {
  if (!normTerm) return false;
  const padded = " " + normText;
  return padded.includes(" " + normTerm);
}
