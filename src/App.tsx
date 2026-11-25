import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { wunschAus, istWunsch } from "./core/wunsch";
import { geoeffnet } from "./core/oeffnung";
import { gesundheitlich, istGespraech, klingtNachBeschwerde, ohneZeit, siehtAusWieAdresse, verstehe, KATEGORIEN, type Kategorie } from "./core/absicht";
import type { Zuordnung } from "./core/match";
import { FACHRICHTUNGEN, type FachId } from "./data/fachrichtungen";
import type { Notfallstufe } from "./data/notfall";
import type { LngLat, Modus, Start } from "./data/praxen";
import { kiChat, kiStarten, type KiStatus } from "./ki/assistent";
import { erinnerungenPlanen, kalenderLaden, leseTermine, loescheTermin, speichereTermin, type Termin } from "./lib/termine";
import { useTerminWaechter } from "./lib/waechter";
import { TerminForm, TermineListe } from "./blatt/Termine";
import { TreffpunktInhalt } from "./blatt/Treffpunkt";
import { FARBEN, wegeZum, type Person, type Vorschlag as TreffVorschlag } from "./lib/treffpunkt";
import { useFahrten, useRoute } from "./lib/wege";
import { leseGespeichert, umschalten } from "./lib/gespeichert";
import { LotseMap, type Abstand, type Pin } from "./map/LotseMap";
import { Notfall } from "./screens/Notfall";
import { fehlerText, gpsStandort } from "./services/dienste";
import { inDerNaehe, ortAnStelle, ortLaden, ortMitNamen, suchen as ortSuchen, type Ort } from "./services/orte";
import { Ablage } from "./blatt/Ablage";
import { Einwilligung, RechtlichesInhalt } from "./blatt/Rechtliches";
import { allesLoeschen, einwilligen, hatEinwilligung } from "./lib/datenLoeschen";
import { Innenansicht } from "./gebaeude/Innenansicht";
import { SCHULE } from "./gebaeude/schule";
import { raumFinden, zoneAn } from "./gebaeude/modell";
import { Innen3D } from "./gebaeude/Innen3D";
import { szene3D } from "./gebaeude/drei";
import { karteNachPlan, MITTE as SCHULE_MITTE, PEILUNG_PLAN_OBEN } from "./gebaeude/karte";
import { ChatVerlauf, type Nachricht } from "./blatt/Chat";
import { Blatt, type Stufe } from "./blatt/Blatt";
import { InfoInhalt, ListenInhalt, OrtInhalt, RouteInhalt, SchnellLeiste, VorschlagInhalt, type ListenStand, type Vorschlag } from "./blatt/Inhalte";
import { Ki, Marke, Standort, Suche, Plus, Minus } from "./ui/icons";
import "./blatt/blatt.css";

type Ansicht =
  | { art: "start" }
  | { art: "liste"; l: ListenStand; neu: () => void }
  | { art: "ort"; ort: Ort; laden: boolean }
  | { art: "route"; ort: Ort }
  | { art: "termin"; ort: Ort | null; zeit: Date | null; id?: string }
  | { art: "termine" }
  | { art: "treffpunkt" }
  | { art: "info" }
  | { art: "recht" };

/** Ohne Kartenbewegung: Wetzlar als Kartenmitte (nur Anzeige, nie als Startpunkt verwendet) */
const WETZLAR: LngLat = [8.5044, 50.5558];

function useMedia(q: string) {
  const [an, setAn] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setAn(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, [q]);
  return an;
}

const leseStart = (): Start | null => { try { return JSON.parse(sessionStorage.getItem("lotse.start") ?? "null"); } catch { return null; } };
const morgenNeun = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; };
const leererOrt = (l: LngLat, name: string, art: string): Ort => ({ id: `punkt-${l[0].toFixed(5)},${l[1].toFixed(5)}`, name, art, lngLat: l, adresse: null, website: null, telefon: null, oeffnungszeiten: null, rollstuhl: null, fach: null });

export default function App() {
  const desktop = useMedia("(min-width: 900px)");
  const dunkel = useMedia("(prefers-color-scheme: dark)");
  const [verlauf, setVerlauf] = useState<Ansicht[]>([{ art: "start" }]);
  const [chat, setChat] = useState<Nachricht[]>([]);
  const ansicht = verlauf[verlauf.length - 1];
  const [text, setText] = useState("");
  const [notfall, setNotfall] = useState<{ stufe: Notfallstufe; text: string } | null>(null);
  const [start, setStartRoh] = useState<Start | null>(leseStart);
  const [mitte, setMitte] = useState<LngLat>(WETZLAR);
  const [modus, setModus] = useState<Modus>("fuss");
  const [stufe, setStufe] = useState<Stufe>("klein");
  const [groesse, setGroesse] = useState({ w: 0, h: 0 });
  const [termine, setTermine] = useState<Termin[]>(leseTermine);
  const [vorgemerkt, setVorgemerkt] = useState<Date | null>(null);
  /** Innenansicht des Schulgebäudes (optional mit gesuchter Raumnummer) */
  const [innen, setInnen] = useState<{ raum?: string } | null>(null);
  /** Schulgebäude in 3D auf der Karte */
  const [innen3d, setInnen3d] = useState<{ ebene: number; zone: string | null; aussen?: boolean } | null>(null);
  const innen3dDaten = useMemo(() => (innen3d ? {
    daten: innen3d.aussen ? { type: "FeatureCollection" as const, features: [] } : szene3D(SCHULE, innen3d.ebene, innen3d.zone),
    mitte: SCHULE_MITTE, peilung: PEILUNG_PLAN_OBEN, boden: innen3d.ebene * SCHULE.geschosshoehe + 0.3,
    modus: (innen3d.aussen ? "aussen" : "innen") as "aussen" | "innen",
  } : null), [innen3d]);
  const [gespeichert, setGespeichert] = useState<Ort[]>(leseGespeichert);
  // Treffpunkt
  const [personen, setPersonen] = useState<Person[]>(() => [
    { id: "p1", name: "Ich", farbe: FARBEN[0], start: null, verkehr: "fuss", mitBei: null },
    { id: "p2", name: "Person 2", farbe: FARBEN[1], start: null, verkehr: "fuss", mitBei: null },
  ]);
  const [treffErgebnis, setTreffErgebnis] = useState<TreffVorschlag[] | null>(null);
  const [treffWahl, setTreffWahl] = useState<number | null>(null);
  const [gruppeWege, setGruppeWege] = useState<{ personId: string; name: string; farbe: string; line: LngLat[]; s: number }[] | null>(null);
  const [ki, setKi] = useState<KiStatus>({ art: "aus" });
  const [toast, setToast] = useState<string | null>(null);
  const [dreiD, setDreiD] = useState(false);
  const [versuch, setVersuch] = useState(0);

  const zeige = useCallback((t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? null : x)), 3500); }, []);
  const gehe = useCallback((a: Ansicht, ersetzen = false) => {
    setVerlauf((v) => (ersetzen ? [...v.slice(0, -1), a] : [...v, a]));
    if (!desktop) setStufe((s) => (s === "klein" ? "mittel" : s));
  }, [desktop]);
  const zurueck = useCallback(() => setVerlauf((v) => (v.length > 1 ? v.slice(0, -1) : v)), []);
  const zurStart = useCallback(() => { setVerlauf([{ art: "start" }]); setText(""); setVorgemerkt(null); setChat([]); }, []);
  // Suchfeld aktiv → Schublade mit Vorschlägen; sonst nur Suchleiste (+ Symbole)
  const [fokus, setFokus] = useState(false);
  const [zuletzt, setZuletzt] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("lotse.zuletzt") ?? "[]"); } catch { return []; } });
  /** Nur Orts- und Kategoriesuchen merken – nie Beschwerden oder Termine */
  const merke = useCallback((t: string) => setZuletzt((l) => {
    const neu = [t, ...l.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8);
    try { localStorage.setItem("lotse.zuletzt", JSON.stringify(neu)); } catch { /* egal */ }
    return neu;
  }), []);

  const setStart = useCallback((s: Start) => { setStartRoh(s); try { sessionStorage.setItem("lotse.start", JSON.stringify(s)); } catch { /* egal */ } }, []);
  const nahe = start?.lngLat ?? mitte;

  // Erinnerungen ans Losgehen, solange Lotse offen ist
  useEffect(() => erinnerungenPlanen(termine, zeige), [termine, zeige]);
  // Wege der nächsten Termine regelmäßig neu prüfen (Echtzeit) und warnen, wenn man früher los muss
  useTerminWaechter(termine, (t) => setTermine(speichereTermin(t)), zeige);

  // Geteilter Link: #o=node-123 öffnet den Ort; wer ihn öffnet, plant seinen eigenen Weg
  useEffect(() => {
    const id = new URLSearchParams(location.hash.slice(1)).get("o");
    if (!id || !/^(node|way|relation)-\d+$/.test(id)) return;
    history.replaceState(null, "", location.pathname + location.search); // nur einmal öffnen
    ortLaden(id).then((o) => o && setVerlauf((v) => [...v, { art: "ort", ort: o, laden: false }])).catch((e) => zeige(fehlerText(e)));
  }, [zeige]);

  /* ---------- Suchen ---------- */

  const liste = useCallback((titel: string, laden: () => Promise<Ort[]>, extra: Partial<ListenStand> = {}) => {
    const lauf = () => {
      const basis: ListenStand = { titel, orte: [], laden: true, bezug: nahe, ...extra };
      setVerlauf((v) => {
        const neu: Ansicht = { art: "liste", l: basis, neu: lauf };
        return v[v.length - 1].art === "liste" ? [...v.slice(0, -1), neu] : [...v, neu];
      });
      laden().then(
        (orte) => setVerlauf((v) => v.map((a) => (a.art === "liste" && a.l === basis ? { ...a, l: { ...basis, orte, laden: false } } : a))),
        (e) => setVerlauf((v) => v.map((a) => (a.art === "liste" && a.l === basis ? { ...a, l: { ...basis, laden: false, fehler: fehlerText(e) } } : a))),
      );
    };
    lauf();
    if (!desktop) setStufe("mittel");
  }, [desktop, nahe]);

  /** Vor der ersten Praxissuche anhand einer Beschwerde: Einwilligung (Art. 9 DSGVO) */
  const [einwilligungFrage, setEinwilligungFrage] = useState<(() => void) | null>(null);
  const fachSuche = useCallback((fach: FachId, z?: Zuordnung) => {
    if (z && !hatEinwilligung()) { setEinwilligungFrage(() => () => fachSuche(fach, z)); return; }
    const f = FACHRICHTUNGEN[fach];
    liste(f.name, async () => (await inDerNaehe([fach === "zahn" ? "dentist" : "doctors"], nahe, 5)).filter((o) => o.fach === fach),
      { unter: z ? "passt zu deiner Beschreibung · keine Diagnose" : "in der Nähe", hinweis: z?.alternative ? `Auch möglich: ${z.alternative.name}` : undefined });
  }, [liste, nahe]);

  const kategorieSuche = useCallback((k: Kategorie) => liste(k.name, () => inDerNaehe(k.phrasen, nahe, 3), { unter: "in der Nähe" }), [liste, nahe]);

  const anfrage = useRef(0);

  /* ---------- Chat mit der KI: kurz, möglichst gleich Ergebnisse ---------- */
  const chatNr = useRef(0);
  const sag = (n: Omit<Nachricht, "id">) => { const id = ++chatNr.current; setChat((c) => [...c, { ...n, id }]); return id; };
  const ersetze = (id: number, n: Omit<Nachricht, "id">) => setChat((c) => c.map((x) => (x.id === id ? { ...n, id } : x)));

  const chatSenden = async (t: string, nr: number, schonGesucht = false) => {
    const v = verstehe(t);
    if ((v.typ === "anliegen" || klingtNachBeschwerde(t)) && v.typ !== "notfall" && !hatEinwilligung()) {
      setEinwilligungFrage(() => () => chatSenden(t, nr, schonGesucht)); return;
    }
    sag({ von: "ich", text: t });
    setText("");
    let a = verstehe(t);
    if (a.typ === "notfall") { setNotfall({ stufe: a.stufe, text: t }); return; }
    if (a.typ === "termin") { setVorgemerkt(a.zeit); const rest = ohneZeit(t.replace(/termin/gi, " ")); a = rest.length > 1 ? verstehe(rest) : a; }
    const id = sag({ von: "ki", denkt: true });
    try {
      // Wünsche wie „Pizza nahe Römer in Frankfurt, jetzt geöffnet“ – feste Regeln, echte Daten
      const w = wunschAus(t);
      if (istWunsch(w, a.typ === "kategorie") && a.typ !== "anliegen" && a.typ !== "fach" && (a.typ === "kategorie" || !klingtNachBeschwerde(t))) {
        // Gesundheitsbezug: kein Text an Nominatim („Apotheke offen bei Migräne“ → nicht „Migräne“ suchen)
        const privat = gesundheitlich(t);
        if (privat) { w.nahe = ""; w.ort = ""; }
        const bezug = w.nahe ? `${w.nahe}${w.ort ? `, ${w.ort}` : ""}` : w.ort;
        const mitte = bezug ? (await ortSuchen(bezug, nahe))[0]?.lngLat ?? null : nahe;
        if (!mitte) return ersetze(id, { von: "ki", text: `„${bezug}“ finde ich nicht.` });
        const art = w.kueche ?? (a.typ === "kategorie" ? { name: a.kategorie.name, phrasen: a.kategorie.phrasen } : w.kategorie ? { name: w.kategorie.name, phrasen: w.kategorie.phrasen } : KATEGORIEN.find((k) => k.id === "essen")!);
        let orte = await inDerNaehe(art.phrasen, mitte, w.nahe ? 1.5 : 3);
        if (w.kueche) orte = orte.filter((o) => w.kueche!.osm.test((o.kueche ?? "").toLowerCase()) || w.kueche!.wort.test(o.name.toLowerCase()));
        const status: Record<string, string> = {};
        if (w.zeit) {
          const bewertet = orte.map((o) => ({ o, g: geoeffnet(o.oeffnungszeiten, w.zeit!) }));
          bewertet.forEach(({ o, g }) => { status[o.id] = g ? (g.offen ? `geöffnet${g.bis ? ` bis ${g.bis}` : ""}` : `geschlossen${g.ab ? ` · ab ${g.ab}` : ""}`) : "Öffnungszeiten unbekannt"; });
          // geöffnete zuerst, geschlossene raus, unbekannte dahinter
          orte = [...bewertet.filter((x) => x.g?.offen), ...bewertet.filter((x) => !x.g)].map((x) => x.o);
          if (!orte.length && bewertet.length) {
            const notdienst = art.name.startsWith("Apothek") ? " Notdienst-Apotheken findest du unter aponet.de (Notdienstsuche der Apothekerverbände)." : "";
            return ersetze(id, { von: "ki", text: `Laut OpenStreetMap hat von ${bewertet.length} ${art.name} in der Nähe gerade keine geöffnet.${notdienst}` });
          }
        }
        const wann = w.zeit ? (Math.abs(w.zeit.getTime() - Date.now()) < 5 * 60000 ? " · jetzt geöffnet" : ` · geöffnet ${w.zeit.toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" })}`) : "";
        return ersetze(id, { von: "ki", text: `${art.name}${w.nahe ? ` nahe ${w.nahe}` : ""}${w.ort ? ` in ${w.ort}` : ""}${wann}:`, orte, status, mitte });
      }
      if (a.typ === "fach") {
        const f = FACHRICHTUNGEN[a.fach];
        return ersetze(id, { von: "ki", text: `${f.name} in der Nähe:`, orte: (await inDerNaehe([a.fach === "zahn" ? "dentist" : "doctors"], nahe, 5)).filter((o) => o.fach === a.fach) });
      }
      if (a.typ === "kategorie") return ersetze(id, { von: "ki", text: `${a.kategorie.name} in der Nähe:`, orte: await inDerNaehe(a.kategorie.phrasen, nahe, 3) });
      const beschwerde = klingtNachBeschwerde(t);
      if (a.typ === "anliegen" && (beschwerde || ki.art !== "bereit")) {
        const f = a.zuordnung.fach;
        return ersetze(id, { von: "ki", text: `${f.name} – passt zu deiner Beschreibung, keine Diagnose:`, orte: (await inDerNaehe([f.id === "zahn" ? "dentist" : "doctors"], nahe, 5)).filter((o) => o.fach === f.id) });
      }
      if (beschwerde) {
        // unklare Beschwerde: nie als Text an Dienste – Hausarztpraxis zeigen
        return ersetze(id, { von: "ki", text: "Hausarztpraxen – der erste Anlaufpunkt, keine Diagnose:", orte: (await inDerNaehe(["doctors"], nahe, 5)).filter((o) => o.fach === "allgemein") });
      }
      if (!schonGesucht && !istGespraech(t) && a.typ !== "anliegen") {
        if (gesundheitlich(t)) return ersetze(id, { von: "ki", text: "Das klingt nach Gesundheit – solche Sätze schicke ich nicht an Suchdienste. Beschreib kurz, was weh tut, dann zeige ich die passende Fachrichtung." });
        const r = await ortSuchen(t, nahe);
        if (r.length) return ersetze(id, { von: "ki", text: `„${t}“:`, orte: r });
      }
      if (ki.art !== "bereit") return ersetze(id, { von: "ki", text: "Dazu habe ich nichts gefunden. Mit der KI verstehe ich auch Fragen und Tippfehler.", knopf: "ki-laden" });
      const k = await kiChat(t);
      if (nr !== anfrage.current) return;
      if (!k) return ersetze(id, { von: "ki", text: "Das habe ich nicht verstanden. Versuch es mit einem Ort." });
      const kat = k.aktion === "kategorie" ? KATEGORIEN.find((x) => x.id === k.kategorie) : undefined;
      // Gesundheitsbezug im Satz: auch was die KI daraus macht, geht nicht als Text an Suchdienste
      const privat = gesundheitlich(t);
      // Bei möglichen Beschwerden keine medizinischen Kategorien von der KI
      if (kat && !(a.typ === "anliegen" && ["arzt", "zahnarzt", "apotheke", "krankenhaus"].includes(kat.id))) {
        const mitte = k.ort && !privat && !gesundheitlich(k.ort) ? (await ortSuchen(k.ort, null))[0]?.lngLat ?? nahe : nahe;
        return ersetze(id, { von: "ki", text: k.antwort || `${kat.name}:`, orte: await inDerNaehe(kat.phrasen, mitte, 3), gedeutet: true });
      }
      if (a.typ === "anliegen") {
        const f = a.zuordnung.fach;
        return ersetze(id, { von: "ki", text: `${f.name} – keine Diagnose:`, orte: (await inDerNaehe([f.id === "zahn" ? "dentist" : "doctors"], nahe, 5)).filter((o) => o.fach === f.id) });
      }
      // Sieht wie eine Adresse aus: nie mit Smalltalk antworten, sondern immer Adresssuche versuchen
      if (!privat && (k.aktion === "suche" || siehtAusWieAdresse(t))) {
        // KI-Korrektur zuerst; sonst einfache Tippfehler-Varianten (Straße, ohne den vertippten Ort – Suche bleibt in deiner Nähe)
        const korr = (x: string) => x.replace(/stra(s|ss)e\b|strsse\b|str\b\.?/gi, "straße");
        const varianten = [k.aktion === "suche" ? k.suchtext : "", korr(t), korr(t).split(/\s+/).slice(0, -1).join(" ")].filter((x, i, l) => x && x.length > 2 && l.indexOf(x) === i);
        for (const v of varianten) {
          const r = await ortSuchen(v, nahe);
          if (r.length) return ersetze(id, { von: "ki", text: k.aktion === "suche" && k.antwort ? k.antwort : "Meintest du das?", orte: r, gedeutet: true });
        }
        return ersetze(id, { von: "ki", text: "Diese Adresse finde ich nicht. Prüf die Schreibweise." });
      }
      ersetze(id, { von: "ki", text: k.antwort });
    } catch (e) {
      ersetze(id, { von: "ki", text: fehlerText(e) });
    }
  };

  const absenden = useCallback(async (eingabe: string) => {
    let t = eingabe.trim();
    if (t.length < 2) return;
    const nr = ++anfrage.current;
    // „Raum 152“, „wo ist R 247“ → Innenansicht der Schule auf der richtigen Etage
    const raum = t.match(/\b(?:raum|zimmer|r\.?)\s*(\d{2,3})\b/i)?.[1];
    if (raum && raumFinden(SCHULE, raum)) { setText(""); setInnen({ raum }); return; }
    let a = verstehe(t);
    if (a.typ === "notfall") { setNotfall({ stufe: a.stufe, text: t }); return; }
    // Chat offen, Gesprächs-/Fragesatz oder genauer Wunsch (Küche, „nahe …“, „jetzt offen“) → Chat mit Ergebnisliste
    const w = wunschAus(t);
    if (chat.length > 0 || istGespraech(t) || (istWunsch(w, a.typ === "kategorie" || (a.typ === "termin" && verstehe(ohneZeit(t.replace(/termin/gi, " "))).typ === "kategorie")) && a.typ !== "anliegen" && a.typ !== "fach")) return chatSenden(t, nr);
    if (a.typ === "termin") {
      setVorgemerkt(a.zeit);
      // Zeitangaben gehören nicht in die Ortssuche
      t = ohneZeit(t.replace(/termin/gi, " "));
      if (t.length < 2) { zeige("Termin vorgemerkt – such jetzt den Ort oder tippe ihn auf der Karte an."); return; }
      a = verstehe(t);
      if (a.typ === "notfall") { setNotfall({ stufe: a.stufe, text: t }); return; }
    }
    if (a.typ === "fach") return fachSuche(a.fach);
    if (a.typ === "kategorie") { merke(t); return kategorieSuche(a.kategorie); }
    const beschwerde = a.typ === "anliegen" || klingtNachBeschwerde(t) || gesundheitlich(t);
    // Beschwerden nie als Text an Dienste schicken: nur Fachrichtung (oder Hausarzt, wenn unklar)
    if (beschwerde && !(ki.art === "bereit" && a.typ === "anliegen" && !klingtNachBeschwerde(t))) {
      return a.typ === "anliegen" ? fachSuche(a.zuordnung.fach.id, a.zuordnung) : fachSuche("allgemein", { fach: FACHRICHTUNGEN.allgemein, erkannt: [], unsicher: true });
    }
    // Kein Hinweis auf Beschwerden und KI an (z. B. „einen Film sehen“): die KI im Chat entscheiden lassen
    if (ki.art === "bereit" && a.typ === "anliegen" && !klingtNachBeschwerde(t)) return chatSenden(t, nr);
    if (a.typ === "anliegen") return fachSuche(a.zuordnung.fach.id, a.zuordnung);
    // Adresse/Ort: erst genau suchen; nichts gefunden → Chat (die KI kann Tippfehler deuten)
    merke(t);
    const r = await ortSuchen(t, nahe).catch((e) => { zeige(fehlerText(e)); return null; });
    if (r === null || nr !== anfrage.current) return;
    if (r.length) liste(t, async () => r);
    else void chatSenden(t, nr, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fachSuche, kategorieSuche, liste, ki.art, nahe, zeige, merke, chat.length]);

  const fertig = () => { setFokus(false); (document.activeElement as HTMLElement | null)?.blur(); };
  /** Kreuz in der Ablage: alles schließen, zurück zur Ruhe-Ansicht */
  const schliessen = () => { fertig(); zurStart(); if (!desktop) setStufe("klein"); };
  const waehle = (v: Vorschlag) => {
    fertig();
    if (v.art === "suchen") void absenden(v.text);
    else if (v.art === "zuletzt") { setText(v.text); void absenden(v.text); }
    else if (v.art === "kategorie") { setText(v.k.name); kategorieSuche(v.k); }
    else if (v.art === "ort") gehe({ art: "ort", ort: v.o, laden: false });
    else gehe({ art: "termin", ort: v.t.ort, zeit: null, id: v.t.id });
  };

  /* ---------- Orte öffnen, Karte antippen ---------- */

  const oeffneOrt = useCallback((o: Ort, mitDetails: boolean) => {
    gehe({ art: "ort", ort: o, laden: mitDetails }, ansicht.art === "ort");
    if (!mitDetails) return;
    const ersetze = (f: (a: Extract<Ansicht, { art: "ort" }>) => Ansicht) =>
      setVerlauf((v) => v.map((a) => (a.art === "ort" && a.ort.id === o.id ? f(a) : a)));
    const punkt = o.name === "Punkt auf der Karte";
    // Kartensymbol: erst über den Namen suchen (volle OSM-Daten: Website, Telefon, Öffnungszeiten)
    const zuerst = punkt ? Promise.resolve(null) : ortMitNamen(o.name, o.lngLat, o.art).catch(() => null);
    zuerst.then((genau) => {
      if (genau) { ersetze(() => ({ art: "ort", ort: { ...genau, art: genau.art !== "Ort" ? genau.art : o.art }, laden: false })); return; }
      return ortAnStelle(o.lngLat).then((d) => {
      // Details nur übernehmen, wenn sie zu genau diesem Ort passen
      const neu: Ort = punkt
        ? { ...d, id: o.id, lngLat: o.lngLat, name: d.adresse ? `In der Nähe: ${d.name}` : d.name, website: null, telefon: null, oeffnungszeiten: null, rollstuhl: null, fach: null }
        : d.name === o.name ? { ...d, lngLat: o.lngLat, art: o.art } : { ...o, adresse: d.adresse };
      ersetze(() => ({ art: "ort", ort: neu, laden: false }));
      });
    }).catch(() => ersetze((a) => ({ ...a, laden: false })));
  }, [gehe, ansicht.art]);

  const karteTipp = useCallback((l: LngLat, poi: { name: string; art: string } | null) => {
    if (ansicht.art === "route") return;
    setFokus(false);
    setText("");
    oeffneOrt(leererOrt(l, poi?.name ?? "Punkt auf der Karte", poi?.art ?? "Ort"), true);
  }, [ansicht.art, oeffneOrt]);

  /* ---------- Start, Weg, Termin ---------- */

  const gps = useCallback(() => {
    zeige("Standort wird bestimmt …");
    gpsStandort().then((s) => { setStart(s); zeige("Start: dein Standort"); }, (e) => zeige(fehlerText(e)));
  }, [zeige, setStart]);

  const startAdresse = useCallback((t: string) => {
    ortSuchen(t, mitte).then((r) => {
      if (!r[0]) { zeige("Adresse nicht gefunden."); return; }
      setStart({ lngLat: [Number(r[0].lngLat[0].toFixed(4)), Number(r[0].lngLat[1].toFixed(4))], name: r[0].adresse ?? r[0].name, quelle: "adresse" });
    }, (e) => zeige(fehlerText(e)));
  }, [mitte, zeige, setStart]);

  const zielOrt = ansicht.art === "ort" || ansicht.art === "route" || ansicht.art === "termin" ? ansicht.ort : null;
  const weg = useRoute(start?.lngLat ?? null, zielOrt?.lngLat ?? null, modus, versuch);
  // Im Routen-Blatt: Zeiten für alle Verkehrsmittel (gleiche Anfrage wie oben wird aus dem Speicher bedient)
  const routeZiel = ansicht.art === "route" ? ansicht.ort.lngLat : null;
  const wegFuss = useRoute(start?.lngLat ?? null, routeZiel, "fuss", versuch);
  const wegRad = useRoute(start?.lngLat ?? null, routeZiel, "rad", versuch);
  const wegAuto = useRoute(start?.lngLat ?? null, routeZiel, "auto", versuch);
  const [routeWahl, setRouteWahl] = useState(0);
  const [oepnv, setOepnv] = useState(false);
  const [fahrtWahl, setFahrtWahl] = useState(0);
  const fahrten = useFahrten(start?.lngLat ?? null, routeZiel, versuch);
  const gewaehlteRoute = weg.routen[routeWahl] ?? weg.route;
  const terminFuer = (o: Ort | null) => (o ? termine.find((t) => t.ort?.id === o.id) ?? null : null);

  const terminSpeichern = (t: Termin) => {
    setTermine(speichereTermin(t));
    setVorgemerkt(null);
    try { if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission(); } catch { /* egal */ }
    zeige(t.los ? `Gemerkt. Lotse erinnert dich um ${new Date(t.los).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} ans Losgehen.` : "Termin gemerkt.");
    zurueck();
  };

  const teilen = async (o: Ort) => {
    const url = o.id.startsWith("punkt")
      ? `https://www.openstreetmap.org/?mlat=${o.lngLat[1]}&mlon=${o.lngLat[0]}#map=18/${o.lngLat[1]}/${o.lngLat[0]}`
      : `${location.origin}${location.pathname}#o=${o.id}`;
    try {
      if (navigator.share) await navigator.share({ title: o.name, url });
      else { await navigator.clipboard.writeText(url); zeige("Link kopiert."); }
    } catch { /* abgebrochen */ }
  };

  const kiUmschalten = () => {
    if (ki.art === "bereit" || ki.art === "laedt") return;
    setKi({ art: "laedt", anteil: 0, text: "" });
    kiStarten(setKi).catch((e) => setKi({ art: "fehler", text: e instanceof Error ? e.message : "KI konnte nicht starten." }));
  };

  /* ---------- Karte ---------- */

  // Ergebnisse aus dem Chat (letzte Liste) gehören auch auf die Karte
  const chatListe = useMemo(() => [...chat].reverse().find((n) => n.orte?.length) ?? null, [chat]);
  const listenOrte = useMemo(() => (ansicht.art === "liste" ? ansicht.l.orte : chatListe?.orte ?? []), [ansicht, chatListe]);
  const pins: Pin[] = useMemo(() => {
    if (ansicht.art === "treffpunkt" && treffErgebnis) return treffErgebnis.map((v, i) => ({ id: v.ort.id, lngLat: v.ort.lngLat, label: v.ort.name.length > 18 ? v.ort.name.slice(0, 16) + "…" : v.ort.name, aktiv: i === treffWahl }));
    if (zielOrt) return [{ id: zielOrt.id, lngLat: zielOrt.lngLat, label: zielOrt.name.length > 24 ? zielOrt.name.slice(0, 22) + "…" : zielOrt.name, aktiv: true }];
    return listenOrte.slice(0, 40).map((o) => ({ id: o.id, lngLat: o.lngLat, label: o.name.length > 18 ? o.name.slice(0, 16) + "…" : o.name, aktiv: false }));
  }, [zielOrt, listenOrte, ansicht.art, treffErgebnis, treffWahl]);

  const fahrt = oepnv ? fahrten.fahrten[fahrtWahl] ?? null : null;
  const routeLinie = useMemo(() => (ansicht.art === "route" && oepnv
    ? (fahrt ? { linie: fahrt.abschnitte.flatMap((a) => a.line), planb: null, modus: "auto" as const, abschnitte: fahrt.abschnitte.map((a) => ({ line: a.line, art: a.art })) } : null)
    : ansicht.art === "route" && gewaehlteRoute
    ? { linie: gewaehlteRoute.line, planb: null, modus, alternativen: weg.routen.filter((x) => x !== gewaehlteRoute).map((x) => x.line) }
    : null), [ansicht.art, gewaehlteRoute, weg.routen, modus, oepnv, fahrt]);
  const [rahmen, rahmenKey] = useMemo((): [LngLat[], string] => {
    if (ansicht.art === "treffpunkt") {
      const punkte = [...personen.flatMap((p) => (p.start ? [p.start.lngLat] : [])), ...(gruppeWege ?? []).flatMap((g) => g.line), ...(treffErgebnis ?? []).map((v) => v.ort.lngLat)];
      if (punkte.length) return [punkte, `treff-${personen.map((p) => p.start?.lngLat.join()).join()}-${treffErgebnis?.length ?? 0}-${treffWahl}-${gruppeWege?.length ?? 0}`];
    }
    if (routeLinie) return [[...routeLinie.linie, ...(routeLinie.alternativen ?? []).flat()], `route-${zielOrt?.id}-${oepnv ? `oepnv${fahrtWahl}` : modus}-${start?.lngLat.join()}`];
    if (zielOrt) return [[zielOrt.lngLat], `ort-${zielOrt.id}`];
    if (listenOrte.length) return [[ansicht.art !== "liste" && chatListe?.mitte ? chatListe.mitte : nahe, ...listenOrte.slice(0, 8).map((o) => o.lngLat)], `liste-${listenOrte.slice(0, 3).map((o) => o.id).join()}`];
    return start ? [[start.lngLat], `start-${start.lngLat.join()}`] : [[], "leer"];
    // nahe absichtlich nicht: die Karte soll beim Verschieben nicht zurückspringen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeLinie, zielOrt, listenOrte, chatListe, start, modus, ansicht.art, personen, gruppeWege, treffErgebnis, treffWahl]);

  const abstand: Abstand = desktop ? { top: 0, right: 70, bottom: 0, left: groesse.w + 16 } : { top: 0, right: 0, bottom: groesse.h, left: 0 };

  // Escape = zurück
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === "Escape" && !notfall && (e.target as HTMLElement).tagName !== "INPUT") zurueck(); };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [zurueck, notfall]);

  const kiTitel = ki.art === "aus" ? "KI laden – läuft auf deinem Gerät, einmal ca. 0,4 GB" : ki.art === "laedt" ? `KI lädt … ${Math.round(ki.anteil * 100)} %` : ki.art === "bereit" ? "KI an – dein Text bleibt auf dem Gerät" : `KI nicht verfügbar: ${ki.text}`;
  const kopf = (
    <form className="suche" onSubmit={(e) => { e.preventDefault(); fertig(); void absenden(text); }}>
      {desktop && (
        <button type="button" className="brand-mini" aria-label="Lotse – alles schließen" data-tip="Alles schließen"
          onMouseDown={(e) => e.preventDefault()} onClick={() => { fertig(); zurStart(); setDreiD(false); }}>
          <Marke size={32} />
        </button>
      )}
      <label className={`suchfeld${text || fokus ? " aktiv" : ""}`}>
        <Suche size={18} />
        <span className="sr">Suche oder Frage</span>
        <input value={text} onChange={(e) => setText(e.target.value)} onFocus={() => { setFokus(true); if (!desktop) setStufe("gross"); }}
          onKeyDown={(e) => { if (e.key === "Escape") fertig(); }}
          placeholder={ki.art === "bereit" ? "Frag Lotse" : "Suchen"} autoComplete="off" enterKeyHint="search" />
        <button type="button" className={`ki-knopf ${ki.art}`} data-tip={kiTitel} aria-label={kiTitel} onMouseDown={(e) => e.preventDefault()} onClick={kiUmschalten}
          style={ki.art === "laedt" ? { ["--anteil" as string]: `${Math.round(ki.anteil * 360)}deg` } : undefined}>
          <Ki size={17} />
        </button>
      </label>
    </form>
  );

  const chatEl = chat.length > 0 ? (
    <ChatVerlauf nachrichten={chat} bezug={nahe} onOrt={(o) => oeffneOrt(o, false)} onKi={kiUmschalten} onZu={() => setChat([])} />
  ) : null;

  // Inhalt (Vorschläge, Ergebnisse, Ort, Route …): Telefon im Blatt, Computer in der Ablage unter der Suchleiste
  const inhalt = (
    <>
        {vorgemerkt && ansicht.art !== "termin" && (
          <div className="vorgemerkt">Termin {vorgemerkt.toLocaleString("de-DE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}: Ort wählen <button type="button" className="link" onClick={() => setVorgemerkt(null)}>verwerfen</button></div>
        )}
        <div className="wechsel" key={`${verlauf.length}-${ansicht.art}`}>
          {fokus && (
            <VorschlagInhalt text={text} zuletzt={zuletzt} termine={termine} gespeichert={gespeichert} ki={ki} onWahl={waehle}
              onInfo={() => { fertig(); gehe({ art: "info" }); }}
              onVerlaufLoeschen={() => { setZuletzt([]); try { localStorage.removeItem("lotse.zuletzt"); } catch { /* egal */ } }} onZu={schliessen}
              onTermine={() => { fertig(); gehe({ art: "termine" }); }}
              onTreffpunkt={() => { fertig(); gehe({ art: "treffpunkt" }); }}
              onGebaeude={() => { fertig(); setInnen({}); }} />
          )}
          {!fokus && !desktop && ansicht.art === "start" && <SchnellLeiste onKategorie={(k) => { setText(k.name); kategorieSuche(k); }} />}
          {!fokus && ansicht.art === "liste" && (
            <ListenInhalt l={ansicht.l} aktiv={null} onOrt={(o) => oeffneOrt(o, false)} onZu={schliessen} onNeu={ansicht.neu} />
          )}
          {!fokus && ansicht.art === "ort" && (
            <OrtInhalt o={ansicht.ort} laden={ansicht.laden} weg={weg} modus={modus} onZu={schliessen}
              onInnen={/werner-von-siemens-schule/i.test(ansicht.ort.name) ? () => setInnen({}) : undefined}
              gespeichert={gespeichert.some((x) => x.id === ansicht.ort.id)}
              onSpeichern={() => { const l = umschalten(ansicht.ort); setGespeichert(l); zeige(l.some((x) => x.id === ansicht.ort.id) ? "Gespeichert." : "Nicht mehr gespeichert."); }}
              onZurueck={verlauf.length > 1 && verlauf[verlauf.length - 2].art !== "start" ? zurueck : undefined}
              onRoute={() => gehe({ art: "route", ort: ansicht.ort })}
              onTermin={() => gehe({ art: "termin", ort: ansicht.ort, zeit: vorgemerkt })}
              onTeilen={() => void teilen(ansicht.ort)} />
          )}
          {!fokus && ansicht.art === "route" && (
            <RouteInhalt o={ansicht.ort} start={start} modus={modus} setModus={setModus}
              oepnv={oepnv} setOepnv={setOepnv} fahrten={fahrten} fahrtWahl={fahrtWahl} setFahrtWahl={setFahrtWahl} wege={{ fuss: wegFuss, rad: wegRad, auto: wegAuto }}
              wahl={routeWahl} setWahl={setRouteWahl} termin={terminFuer(ansicht.ort)}
              onStartGps={gps} onStartAdresse={startAdresse} onZurueck={zurueck} onNeu={() => setVersuch((n) => n + 1)} onZu={schliessen} />
          )}
          {!fokus && ansicht.art === "termin" && (() => {
            const vorhanden = ansicht.id ? termine.find((t) => t.id === ansicht.id) ?? null : null;
            return (
              <TerminForm key={ansicht.id ?? ansicht.ort?.id ?? "neu"} vorhanden={vorhanden} ort={ansicht.ort} vorschlag={ansicht.zeit ?? morgenNeun()} start={start}
                onStartGps={gps} onSpeichern={terminSpeichern} onZurueck={verlauf.length > 1 ? zurueck : undefined} onZu={schliessen}
                onLoeschen={() => { if (vorhanden) setTermine(loescheTermin(vorhanden.id)); zurueck(); }}
                onKalender={kalenderLaden} />
            );
          })()}
          {!fokus && ansicht.art === "treffpunkt" && (
            <TreffpunktInhalt start={start} personen={personen} setPersonen={(p) => { setPersonen(p); setGruppeWege(null); setTreffWahl(null); }}
              ergebnis={treffErgebnis} setErgebnis={(v) => { setTreffErgebnis(v); setGruppeWege(null); setTreffWahl(null); }}
              gewaehlt={treffWahl} onZu={schliessen} onOrt={(v) => oeffneOrt(v.ort, false)}
              onWahl={(i) => {
                setTreffWahl(i);
                const v = treffErgebnis?.[i];
                if (!v) return;
                wegeZum(personen, v.ort.lngLat).then((w) => setGruppeWege(w.map((x) => ({ ...x, name: personen.find((p) => p.id === x.personId)?.name ?? "" }))), (e) => zeige(fehlerText(e)));
              }} />
          )}
          {!fokus && ansicht.art === "termine" && (
            <TermineListe termine={termine} onZu={schliessen}
              onTermin={(t) => gehe({ art: "termin", ort: t.ort, zeit: null, id: t.id })}
              onNeu={() => gehe({ art: "termin", ort: null, zeit: null })} />
          )}
          {!fokus && ansicht.art === "info" && <InfoInhalt onZu={schliessen} onRecht={() => gehe({ art: "recht" })}
            onLoeschen={async () => {
              if (!window.confirm("Alle Termine, gespeicherten Orte, Verlauf, Einwilligung und das KI-Modell auf diesem Gerät löschen? Das lässt sich nicht rückgängig machen.")) return;
              await allesLoeschen(); window.location.reload();
            }} />}
          {!fokus && ansicht.art === "recht" && <RechtlichesInhalt onZurueck={zurueck} onZu={schliessen} />}
        </div>
    </>
  );

  return (
    <div className={`app ${desktop ? "pc" : "tel"}${notfall ? " im-notfall" : ""}`}>
      {einwilligungFrage && <Einwilligung onNein={() => setEinwilligungFrage(null)} onJa={() => { einwilligen(); const f = einwilligungFrage; setEinwilligungFrage(null); f(); }} />}
      {innen && <Innenansicht gebaeude={SCHULE} raum={innen.raum} onZu={() => setInnen(null)} on3D={(ebene, zone) => { setInnen(null); setInnen3d({ ebene, zone }); }} />}
      {innen3d && <Innen3D gebaeude={SCHULE} ebene={innen3d.ebene} zone={innen3d.zone} aussen={!!innen3d.aussen}
        onAussen={(aussen) => setInnen3d((v) => (v ? { ...v, aussen } : v))}
        onEbene={(ebene) => setInnen3d({ ebene, zone: null })} onPlan={() => { setInnen3d(null); setInnen({}); }} onZu={() => setInnen3d(null)} />}
      <LotseMap
        theme={dunkel ? "dark" : "light"}
        start={start?.lngLat ?? null}
        pins={pins}
        route={routeLinie}
        rahmen={rahmen}
        rahmenSchluessel={rahmenKey}
        abstand={abstand}
        dreiD={dreiD}
        onPin={(id) => { const o = listenOrte.find((x) => x.id === id); if (o) oeffneOrt(o, false); }}
        onKarteTipp={karteTipp}
        onMitte={setMitte}
        onLeer={() => { if (fokus) fertig(); }}
        gruppe={ansicht.art === "treffpunkt" ? gruppeWege : null}
        innen3d={innen3dDaten}
        onInnenTipp={(ll) => setInnen3d((v) => {
          if (!v) return v;
          const etage = SCHULE.etagen.find((e) => e.ebene === v.ebene)!;
          if (v.aussen) return v; // von außen gibt es nichts anzutippen
          const z = ll ? zoneAn(etage, ...karteNachPlan(ll)) : null;
          return { ...v, zone: z && z.art !== "luftraum" ? z.id : null };
        })}
      />

      <Blatt desktop={desktop} stufe={stufe} setStufe={setStufe} kopf={kopf} oben={desktop ? chatEl : undefined} onGroesse={setGroesse}>
        {!desktop && chatEl}
        {!desktop && inhalt}
      </Blatt>

      {/* Computer: ALLES erscheint in der Ablage unter der Suchleiste – Ruhe: Symbole; sonst Vorschläge, Ergebnisse, Ort, Route */}
      {desktop && groesse.h > 0 && (
        <Ablage offen={fokus || ansicht.art !== "start"} top={16 + groesse.h - 12}
          symbole={<SchnellLeiste onKategorie={(k) => { setText(k.name); kategorieSuche(k); }} />}
          inhalt={inhalt} />
      )}
      <div className="kartenknoepfe">
        <button type="button" className="glas" aria-label="Mein Standort" title="Mein Standort" onClick={() => (start?.quelle === "gps" ? window.dispatchEvent(new CustomEvent("lotse:start")) : gps())}><Standort size={18} /></button>
        <button type="button" className={`glas drei-d${dreiD ? " an" : ""}`} aria-pressed={dreiD} aria-label="3D-Gebäude" onClick={() => setDreiD((x) => !x)}>{dreiD ? "2D" : "3D"}</button>
        {desktop && (
          <div className="zoom glas">
            <button type="button" aria-label="Vergrößern" onClick={() => window.dispatchEvent(new CustomEvent("lotse:zoom", { detail: 1 }))}><Plus size={18} /></button>
            <span />
            <button type="button" aria-label="Verkleinern" onClick={() => window.dispatchEvent(new CustomEvent("lotse:zoom", { detail: -1 }))}><Minus size={18} /></button>
          </div>
        )}
      </div>

      {notfall && (
        <Notfall stufe={notfall.stufe} text={notfall.text} onZurueck={() => setNotfall(null)}
          onWeiter={() => { setNotfall(null); fachSuche("allgemein"); }} />
      )}
      <div className={`toast glas${toast ? " zeigen" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
