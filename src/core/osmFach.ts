import type { FachId } from "../data/fachrichtungen";

/**
 * Fachrichtung einer Praxis aus OpenStreetMap ablesen.
 * Nur aus dem OSM-Tag healthcare:speciality oder einem eindeutigen Wort im Namen.
 * Lässt sich nichts sicher ablesen, kommt null zurück und die Praxis wird nicht angezeigt.
 */
const TAG: Record<string, FachId> = {
  general: "allgemein", internal: "allgemein", orthopaedics: "ortho", dermatology: "derma", skin: "derma",
  ophthalmology: "auge", otolaryngology: "hno", gynaecology: "gyn", urology: "uro", paediatrics: "kinder",
  child_psychiatry: "kinder", psychiatry: "psych", psychotherapy: "psych", neuropsychiatry: "psych",
  depth: "psych", behavior: "psych", dentist: "zahn", orthodontics: "zahn",
};

const NAME: [RegExp, FachId][] = [
  [/allgemeinmedizin|hausarzt|hausärzt/, "allgemein"],
  [/orthop(ä|ae)d/, "ortho"],
  [/dermatolog|hautarzt|hautärzt/, "derma"],
  [/augenarzt|augenärzt|augenheil/, "auge"],
  [/\bhno\b|hals-nasen-ohren/, "hno"],
  [/frauenarzt|frauenärzt|gynäkolog/, "gyn"],
  [/urolog/, "uro"],
  [/kinderarzt|kinderärzt|kinder- und jugendmedizin|pädiatr/, "kinder"],
  [/psychotherap|psychiatr/, "psych"],
  [/zahnarzt|zahnärzt|zahnheil|kieferorthop/, "zahn"],
];

export function fachAusOsm(tags: Record<string, string>, name: string, typ: string): FachId | null {
  if (typ === "dentist") return "zahn";
  for (const teil of (tags["healthcare:speciality"] ?? "").split(/[;,]/)) {
    const f = TAG[teil.trim()];
    if (f) return f;
  }
  const n = name.toLowerCase();
  for (const [muster, f] of NAME) if (muster.test(n)) return f;
  return null;
}
