import { DIENSTE } from "../config";
import { luftlinie, type LngLat, type Modus } from "../data/praxen";
import { DienstFehler, holeJson, pkt, profil } from "../services/dienste";
import { verbindungen } from "../services/oepnv";
import { inDerNaehe, routeLaden, type Ort } from "../services/orte";
import type { Verkehr } from "./termine";

/**
 * Treffpunkt für 2–4 Personen: Orte einer Art zwischen allen Startpunkten suchen, für jede Person die
 * ECHTE Wegzeit rechnen und die fairsten Orte vorschlagen (die längste Anreise möglichst kurz).
 * Mitfahren: Person B wird von A mit dem Auto abgeholt (A → B → Ziel).
 */
export interface Person {
  id: string;
  name: string;
  farbe: string;
  start: { lngLat: LngLat; name: string } | null;
  verkehr: Verkehr;
  /** id der Person, die mit dem Auto abholt */
  mitBei: string | null;
}

export interface Anreise { personId: string; s: number | null; hinweis?: string }
export interface Vorschlag { ort: Ort; anreisen: Anreise[]; laengste: number; summe: number }

export const FARBEN = ["#2f5bff", "#f08c00", "#18a058", "#c2255c"];

const mitte = (l: LngLat[]): LngLat => [l.reduce((a, p) => a + p[0], 0) / l.length, l.reduce((a, p) => a + p[1], 0) / l.length];

/** OSRM-Tabelle: Zeiten von einem Start zu vielen Zielen (eine Anfrage) */
async function tabelle(start: LngLat, ziele: LngLat[], m: Modus): Promise<(number | null)[]> {
  const coords = [start, ...ziele].map(pkt).join(";");
  const r = await holeJson<{ code: string; durations?: (number | null)[][] }>(`${DIENSTE.routing[m]}/table/v1/${profil[m]}/${coords}?sources=0`, "Wegberechnung");
  if (r.code !== "Ok" || !r.durations?.[0]) throw new DienstFehler("Wegberechnung lieferte keine Zeiten.");
  return r.durations[0].slice(1);
}

export async function treffpunkteFinden(personen: Person[], phrasen: string[], fortschritt: (text: string) => void): Promise<Vorschlag[]> {
  const mitStart = personen.filter((p) => p.start);
  if (mitStart.length < 2) throw new DienstFehler("Mindestens zwei Personen brauchen einen Startpunkt.");
  const starts = mitStart.map((p) => p.start!.lngLat);
  const m = mitte(starts);
  const spanne = Math.max(...starts.map((s) => luftlinie(m, s)));
  fortschritt("Suche Orte zwischen euch …");
  const kandidaten = (await inDerNaehe(phrasen, m, Math.min(8, Math.max(1.5, spanne * 0.6)))).slice(0, 12);
  if (!kandidaten.length) return [];
  const ziele = kandidaten.map((o) => o.lngLat);
  const zeiten = new Map<string, (number | null)[]>();

  // Selbstfahrer und Fußgänger/Radler: eine Tabelle pro Person
  for (const p of mitStart.filter((x) => !x.mitBei)) {
    fortschritt(`Wege für ${p.name} …`);
    if (p.verkehr === "oepnv") {
      // Bus & Bahn: nur die 5 nächsten Orte (sparsam), Rest unbekannt
      const nah = ziele.map((z, i) => ({ i, d: luftlinie(m, z) })).sort((a, b) => a.d - b.d).slice(0, 5).map((x) => x.i);
      const l: (number | null)[] = ziele.map(() => null);
      for (const i of nah) {
        const f = (await verbindungen(p.start!.lngLat, ziele[i], { ab: new Date() }).catch(() => []))[0];
        l[i] = f ? f.dauerS : null;
      }
      zeiten.set(p.id, l);
    } else {
      zeiten.set(p.id, await tabelle(p.start!.lngLat, ziele, p.verkehr));
    }
  }
  // Mitfahrer: Fahrer holt ab (Fahrer → Mitfahrer), dann gemeinsam zum Ziel
  for (const p of mitStart.filter((x) => x.mitBei)) {
    const fahrer = mitStart.find((x) => x.id === p.mitBei);
    if (!fahrer?.start) { zeiten.set(p.id, ziele.map(() => null)); continue; }
    fortschritt(`${fahrer.name} holt ${p.name} ab …`);
    const [hin] = await tabelle(fahrer.start.lngLat, [p.start!.lngLat], "auto");
    const weiter = await tabelle(p.start!.lngLat, ziele, "auto");
    zeiten.set(p.id, weiter);
    // Der Fahrer braucht dann länger: zu Mitfahrer + weiter zum Ziel
    zeiten.set(fahrer.id, weiter.map((w) => (w != null && hin != null ? hin + w : null)));
  }

  const vorschlaege: Vorschlag[] = kandidaten.map((ort, i) => {
    const anreisen = mitStart.map((p) => ({ personId: p.id, s: zeiten.get(p.id)?.[i] ?? null, hinweis: p.mitBei ? `abgeholt von ${mitStart.find((x) => x.id === p.mitBei)?.name}` : undefined }));
    const bekannt = anreisen.map((a) => a.s).filter((x): x is number => x != null);
    return { ort, anreisen, laengste: bekannt.length === anreisen.length ? Math.max(...bekannt) : Infinity, summe: bekannt.reduce((a, b) => a + b, 0) };
  });
  return vorschlaege.filter((v) => Number.isFinite(v.laengste)).sort((a, b) => a.laengste - b.laengste || a.summe - b.summe).slice(0, 5);
}

/** Wege aller Personen zum gewählten Ort (für Karte und Animation) */
export async function wegeZum(personen: Person[], ziel: LngLat): Promise<{ personId: string; farbe: string; line: LngLat[]; s: number }[]> {
  const aus = [];
  for (const p of personen.filter((x) => x.start)) {
    try {
      if (p.mitBei) {
        // Mitfahrer: ab eigenem Start mit dem Auto (Fahrer kommt vorbei)
        const r = await routeLaden(p.start!.lngLat, ziel, "auto");
        aus.push({ personId: p.id, farbe: p.farbe, line: r.line, s: r.s });
      } else if (p.verkehr === "oepnv") {
        const f = (await verbindungen(p.start!.lngLat, ziel, { ab: new Date() }))[0];
        if (f) aus.push({ personId: p.id, farbe: p.farbe, line: f.abschnitte.flatMap((a) => a.line), s: f.dauerS });
      } else {
        // Fahrer: erst zum Mitfahrer, dann gemeinsam zum Ziel
        const mitfahrer = personen.find((x) => x.mitBei === p.id);
        const r = mitfahrer?.start ? await routeLaden(p.start!.lngLat, mitfahrer.start.lngLat, "auto").then(async (a) => {
          const b = await routeLaden(mitfahrer.start!.lngLat, ziel, "auto");
          return { line: [...a.line, ...b.line], s: a.s + b.s };
        }) : await routeLaden(p.start!.lngLat, ziel, p.verkehr);
        aus.push({ personId: p.id, farbe: p.farbe, line: r.line, s: r.s });
      }
    } catch { /* Person ohne Weg – wird ausgelassen */ }
  }
  return aus;
}
