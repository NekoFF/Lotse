/**
 * Fachrichtungen, die Lotse zuordnen kann.
 * Die Texte beschreiben, WOFÜR eine Fachrichtung zuständig ist — nie, was jemand hat.
 */
export type FachId =
  | "allgemein"
  | "ortho"
  | "derma"
  | "zahn"
  | "auge"
  | "hno"
  | "gyn"
  | "uro"
  | "kinder"
  | "psych";

export interface Fachrichtung {
  id: FachId;
  name: string;
  zustaendig: string;
}

export const FACHRICHTUNGEN: Record<FachId, Fachrichtung> = {
  allgemein: {
    id: "allgemein",
    name: "Hausarztpraxis",
    zustaendig:
      "Die Hausarztpraxis ist für fast alles der erste Anlaufpunkt. Sie schaut sich das Anliegen an und überweist bei Bedarf weiter.",
  },
  ortho: {
    id: "ortho",
    name: "Orthopädie",
    zustaendig: "Die Orthopädie ist für Rücken, Gelenke, Knochen und Muskeln zuständig.",
  },
  derma: {
    id: "derma",
    name: "Dermatologie",
    zustaendig: "Die Dermatologie ist für Haut, Haare und Nägel zuständig.",
  },
  zahn: {
    id: "zahn",
    name: "Zahnmedizin",
    zustaendig: "Die Zahnarztpraxis ist für Zähne, Zahnfleisch und Kiefer zuständig.",
  },
  auge: {
    id: "auge",
    name: "Augenheilkunde",
    zustaendig: "Die Augenarztpraxis ist für die Augen und das Sehen zuständig.",
  },
  hno: {
    id: "hno",
    name: "HNO",
    zustaendig: "Die Hals-Nasen-Ohren-Praxis ist für Ohren, Nase, Hals und Stimme zuständig.",
  },
  gyn: {
    id: "gyn",
    name: "Frauenheilkunde",
    zustaendig: "Die frauenärztliche Praxis ist für Brust, Unterleib, Zyklus, Verhütung und Schwangerschaft zuständig.",
  },
  uro: {
    id: "uro",
    name: "Urologie",
    zustaendig: "Die Urologie ist für Blase, Harnwege und Nieren sowie für die männlichen Geschlechtsorgane zuständig.",
  },
  kinder: {
    id: "kinder",
    name: "Kinder- und Jugendmedizin",
    zustaendig: "Für Kinder und Jugendliche ist die Kinder- und Jugendarztpraxis die erste Anlaufstelle.",
  },
  psych: {
    id: "psych",
    name: "Psychotherapeutische Sprechstunde",
    zustaendig:
      "Wenn die Seele belastet ist, kann man sich ohne Überweisung zur psychotherapeutischen Sprechstunde melden. Auch die Hausarztpraxis ist ein guter erster Schritt.",
  },
};
