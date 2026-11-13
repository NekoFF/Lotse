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
