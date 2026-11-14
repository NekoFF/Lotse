/**
 * KI auf dem Gerät (WebLLM, Modell Qwen2.5-0.5B-Instruct, Apache-2.0).
 * Läuft komplett im Browser: der eingegebene Text verlässt das Gerät nicht. Nur das Modell (~0,4 GB) wird einmal
 * von Hugging Face geladen und im Browser gespeichert.
 * Rolle: ÜBERSETZER, nicht Entscheider. Die KI macht aus freiem Text eine Suchanweisung nach festem Schema.
 * Sie stellt keine Diagnose und gibt keine medizinischen Ratschläge; der Sicherheitsfilter läuft immer vorher.
 */
import type { MLCEngineInterface } from "@mlc-ai/web-llm";
import { KATEGORIEN } from "../core/absicht";

export const KI_MODELL = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

export type KiStatus = { art: "aus" } | { art: "laedt"; anteil: number; text: string } | { art: "bereit" } | { art: "fehler"; text: string };

export interface KiAnweisung {
  /** suche = Ort/Adresse finden, kategorie = Orte einer Art in der Nähe */
  aktion: "suche" | "kategorie";
  /** Suchtext (Adresse, Name) oder leer */
  suchtext: string;
  /** eine der festen Kategorien oder leer */
  kategorie: string;
}

const SCHEMA = {
  type: "object",
  properties: {
    aktion: { type: "string", enum: ["suche", "kategorie"] },
    suchtext: { type: "string" },
    kategorie: { type: "string", enum: ["", ...KATEGORIEN.map((k) => k.id)] },
  },
  required: ["aktion", "suchtext", "kategorie"],
};

const SYSTEM = `Du übersetzt Anfragen für eine Karten-App in JSON. Antworte NUR mit JSON nach Schema.
Kategorien: ${KATEGORIEN.map((k) => `${k.id} (${k.name})`).join(", ")}.
Wenn nach einer Art Ort gefragt wird: aktion "kategorie" und passende kategorie.
Wenn eine Adresse, Stadt, Straße oder ein Name gemeint ist: aktion "suche" und suchtext = nur die Adresse/der Name.
Gib nie medizinische Ratschläge.`;

const BEISPIELE: [string, KiAnweisung][] = [
  ["ich habe Hunger und will was Leckeres", { aktion: "kategorie", suchtext: "", kategorie: "essen" }],
  ["wo bekomme ich Medikamente", { aktion: "kategorie", suchtext: "", kategorie: "apotheke" }],
  ["was kann man heute Abend unternehmen", { aktion: "kategorie", suchtext: "", kategorie: "freizeit" }],
  ["wie komme ich zum Domplatz in Wetzlar", { aktion: "suche", suchtext: "Domplatz Wetzlar", kategorie: "" }],
  ["ich muss noch einkaufen gehen", { aktion: "kategorie", suchtext: "", kategorie: "einkaufen" }],
];

export const webGpuDa = () => typeof navigator !== "undefined" && "gpu" in navigator;

let motor: MLCEngineInterface | null = null;
let laden: Promise<MLCEngineInterface> | null = null;

export function kiStarten(fortschritt: (s: KiStatus) => void): Promise<MLCEngineInterface> {
  if (motor) return Promise.resolve(motor);
  if (laden) return laden;
  if (!webGpuDa()) return Promise.reject(new Error("Dieser Browser kann keine KI auf dem Gerät ausführen (WebGPU fehlt)."));
  laden = import("@mlc-ai/web-llm").then(({ CreateMLCEngine }) =>
    CreateMLCEngine(KI_MODELL, { initProgressCallback: (p) => fortschritt({ art: "laedt", anteil: p.progress, text: p.text }) }),
  ).then((m) => { motor = m; fortschritt({ art: "bereit" }); return m; })
    .catch((e) => { laden = null; throw e; });
  return laden;
}

/** Übersetzt freien Text in eine geprüfte Anweisung. Ungültige Antworten → null (dann normale Suche). */
export async function kiVerstehen(text: string): Promise<KiAnweisung | null> {
  if (!motor) return null;
  const r = await motor.chat.completions.create({
    messages: [
      { role: "system", content: SYSTEM },
      // Beispiele (few-shot), damit auch das kleine Modell zuverlässig antwortet
      ...BEISPIELE.flatMap(([f, a]) => [{ role: "user" as const, content: f }, { role: "assistant" as const, content: JSON.stringify(a) }]),
      { role: "user", content: text.slice(0, 300) },
    ],
    temperature: 0,
    max_tokens: 80,
    response_format: { type: "json_object", schema: JSON.stringify(SCHEMA) },
  });
  try {
    const j = JSON.parse(r.choices[0]?.message?.content ?? "") as KiAnweisung;
    if (j.aktion === "kategorie" && KATEGORIEN.some((k) => k.id === j.kategorie)) return j;
    if (j.aktion === "suche" && typeof j.suchtext === "string" && j.suchtext.trim().length >= 2) return { ...j, suchtext: j.suchtext.trim().slice(0, 120) };
  } catch { /* ungültig */ }
  return null;
}

/* ---------- Chat: sehr kurze Antworten, möglichst gleich ein Ergebnis ---------- */

export interface KiAntwort {
  /** höchstens ein kurzer Satz */
  antwort: string;
  aktion: "keine" | "suche" | "kategorie";
  /** Adresse/Name (bei Tippfehlern korrigiert) */
  suchtext: string;
  kategorie: string;
  /** Stadt/Ort, falls genannt („in Frankfurt“) */
  ort: string;
}

// Reihenfolge wichtig: erst entscheiden (Aktion, Kategorie, Ort, Suchtext), dann der kurze Satz – kleine Modelle füllen sonst die Felder nicht
const CHAT_SCHEMA = {
  type: "object",
  properties: {
    aktion: { type: "string", enum: ["keine", "suche", "kategorie"] },
    kategorie: { type: "string", enum: ["keine", ...KATEGORIEN.map((k) => k.id)] },
    ort: { type: "string" },
    suchtext: { type: "string" },
    antwort: { type: "string", maxLength: 100 },
  },
  required: ["aktion", "kategorie", "ort", "suchtext", "antwort"],
};

const CHAT_SYSTEM = `Du bist Lotse, ein Karten-Assistent. Antworte NUR mit JSON nach Schema.
Zuerst entscheiden: aktion "kategorie" (Art von Orten; "kategorie" = passende Kategorie; "ort" = genannte Stadt oder leer),
aktion "suche" ("suchtext" = die gemeinte Adresse oder der Name, Tippfehler verbessert) oder aktion "keine".
Kategorien: ${KATEGORIEN.map((k) => `${k.id} (${k.name})`).join(", ")}.
Dann "antwort": höchstens EIN sehr kurzer Satz auf Deutsch, kein Smalltalk.
Gib nie medizinische Ratschläge und stelle keine Diagnosen.`;

const a = (aktion: KiAntwort["aktion"], kategorie: string, ort: string, suchtext: string, antwort: string): KiAntwort => ({ aktion, kategorie, ort, suchtext, antwort });
const CHAT_BEISPIELE: [string, KiAntwort][] = [
  ["hi", a("keine", "keine", "", "", "Hallo! Was suchst du?")],
  ["wo sind die besten Orte in Frankfurt", a("kategorie", "sehenswert", "Frankfurt am Main", "", "Sehenswertes in Frankfurt:")],
  ["Bahnhofstrase 1 Wetzlr", a("suche", "keine", "", "Bahnhofstraße 1, Wetzlar", "Meintest du das?")],
  ["Goethestrsse 5 Gisen", a("suche", "keine", "", "Goethestraße 5, Gießen", "Meintest du das?")],
  ["ich habe Hunger", a("kategorie", "essen", "", "", "Essen in der Nähe:")],
  ["wie geht es dir", a("keine", "keine", "", "", "Gut! Wohin soll es gehen?")],
  ["Cafés in Gießen", a("kategorie", "cafe", "Gießen", "", "Cafés in Gießen:")],
];

/** Stadt aus „… in Frankfurt“ (Ersatz, falls das Modell „ort“ leer lässt) */
export function ortAusText(text: string): string {
  const m = text.match(/\b(?:in|im|um|bei)\s+([A-ZÄÖÜ][\wäöüß.-]+(?:\s+(?:am|an der|im)\s+[A-ZÄÖÜ][\wäöüß-]+)?)/);
  return m ? m[1] : "";
}

/** Kategorie aus dem Antwortsatz ablesen (Ersatz, falls das Modell das Feld leer lässt) */
export function kategorieAusSatz(satz: string): string {
  const n = satz.toLowerCase();
  return KATEGORIEN.find((k) => n.includes(k.name.toLowerCase()))?.id ?? "";
}

export async function kiChat(text: string): Promise<KiAntwort | null> {
  if (!motor) return null;
  const r = await motor.chat.completions.create({
    messages: [
      { role: "system", content: CHAT_SYSTEM },
      ...CHAT_BEISPIELE.flatMap(([f, a]) => [{ role: "user" as const, content: f }, { role: "assistant" as const, content: JSON.stringify(a) }]),
      { role: "user", content: text.slice(0, 300) },
    ],
    temperature: 0,
    max_tokens: 120,
    response_format: { type: "json_object", schema: JSON.stringify(CHAT_SCHEMA) },
  });
  try {
    const j = JSON.parse(r.choices[0]?.message?.content ?? "") as KiAntwort;
    const antwort = String(j.antwort ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
    const ort = (String(j.ort ?? "").trim() || ortAusText(text)).slice(0, 60);
    const kategorie = KATEGORIEN.some((k) => k.id === j.kategorie) ? j.kategorie : kategorieAusSatz(antwort);
    const suchtext = String(j.suchtext ?? "").trim().slice(0, 120);
    if (j.aktion === "kategorie" && kategorie) return { aktion: "kategorie", kategorie, ort, suchtext: "", antwort };
    if (j.aktion === "suche" && suchtext.length >= 2) return { aktion: "suche", kategorie: "", ort, suchtext, antwort };
    if (j.aktion === "suche") return { aktion: "suche", kategorie: "", ort, suchtext: "", antwort }; // App versucht es dann unscharf
    return { antwort: antwort || "Dazu finde ich nichts. Versuch es mit einem Ort oder einer Adresse.", aktion: "keine", suchtext: "", kategorie: "", ort: "" };
  } catch {
    return null;
  }
}
