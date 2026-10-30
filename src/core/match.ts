import { BEGRIFFE } from "../data/begriffe";
import { FACHRICHTUNGEN, type FachId, type Fachrichtung } from "../data/fachrichtungen";
import { containsTerm, normalize } from "./normalize";

export interface Zuordnung {
  fach: Fachrichtung;
  /** Wörter aus der Eingabe, die zur Zuordnung geführt haben (ohne Doppelungen) */
  erkannt: string[];
  /** true = nichts oder nichts Eindeutiges erkannt, deshalb Hausarztpraxis */
  unsicher: boolean;
  /** zweitbeste Fachrichtung, wenn sie knapp dahinter liegt */
  alternative?: Fachrichtung;
}

/** Mindestvorsprung, damit die beste Fachrichtung als eindeutig gilt */
const VORSPRUNG = 1;

/**
 * Ordnet einen Freitext einer Fachrichtung zu.
 * Liefert NIE eine Krankheit, nur die zuständige Fachrichtung und die erkannten Wörter.
 * Muss nach dem Sicherheitsfilter aufgerufen werden.
 */
export function ordneZu(text: string): Zuordnung {
  const norm = normalize(text);
  const punkte = new Map<FachId, number>();
  const woerter = new Map<FachId, Set<string>>();

  for (const [begriff, fach, wort, gewicht = 1] of BEGRIFFE) {
    if (containsTerm(norm, begriff)) {
      punkte.set(fach, (punkte.get(fach) ?? 0) + gewicht);
      if (!woerter.has(fach)) woerter.set(fach, new Set());
      woerter.get(fach)!.add(wort);
    }
  }

  const rangliste = [...punkte.entries()].sort((a, b) => b[1] - a[1]);

  if (rangliste.length === 0) {
    return { fach: FACHRICHTUNGEN.allgemein, erkannt: [], unsicher: true };
  }

  const [erste, zweite] = rangliste;
  const knapp = zweite !== undefined && erste[1] - zweite[1] < VORSPRUNG;

  if (knapp) {
    return {
      fach: FACHRICHTUNGEN.allgemein,
      erkannt: [...(woerter.get(erste[0]) ?? []), ...(woerter.get(zweite[0]) ?? [])],
      unsicher: true,
      alternative: FACHRICHTUNGEN[erste[0]],
    };
  }

  return {
    fach: FACHRICHTUNGEN[erste[0]],
    erkannt: [...(woerter.get(erste[0]) ?? [])],
    unsicher: false,
    alternative: zweite && erste[1] - zweite[1] <= 2 ? FACHRICHTUNGEN[zweite[0]] : undefined,
  };
}
