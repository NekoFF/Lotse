import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { klingtNachBeschwerde, ohneZeit, verstehe, KATEGORIEN, type Kategorie } from "./core/absicht";
import type { Zuordnung } from "./core/match";
import { FACHRICHTUNGEN, type FachId } from "./data/fachrichtungen";
import type { Notfallstufe } from "./data/notfall";
import type { LngLat, Modus, Start } from "./data/praxen";
import { kiStarten, kiVerstehen, type KiStatus } from "./ki/assistent";
import { erinnerungenPlanen, kalenderLaden, leseTermine, loescheTermin, losgehzeit, speichereTermin, type Termin } from "./lib/termine";
import { useRoute } from "./lib/wege";
import { LotseMap, type Abstand, type Pin } from "./map/LotseMap";
import { Notfall } from "./screens/Notfall";
import { fehlerText, gpsStandort } from "./services/dienste";
import { inDerNaehe, ortAnStelle, ortLaden, suchen as ortSuchen, type Ort } from "./services/orte";
import { Ablage } from "./blatt/Ablage";
import { Blatt, type Stufe } from "./blatt/Blatt";
import { InfoInhalt, ListenInhalt, OrtInhalt, RouteInhalt, SchnellLeiste, TerminInhalt, VorschlagInhalt, type ListenStand, type Vorschlag } from "./blatt/Inhalte";
import { Ki, Marke, Schliessen, Standort, Suche, Plus, Minus } from "./ui/icons";
import "./blatt/blatt.css";

type Ansicht =
  | { art: "start" }
  | { art: "liste"; l: ListenStand; neu: () => void }
  | { art: "ort"; ort: Ort; laden: boolean }
  | { art: "route"; ort: Ort }
  | { art: "termin"; ort: Ort; zeit: Date | null }
  | { art: "info" };

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
  const zurStart = useCallback(() => { setVerlauf([{ art: "start" }]); setText(""); setVorgemerkt(null); }, []);
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

  const fachSuche = useCallback((fach: FachId, z?: Zuordnung) => {
    const f = FACHRICHTUNGEN[fach];
    liste(f.name, async () => (await inDerNaehe([fach === "zahn" ? "dentist" : "doctors"], nahe, 5)).filter((o) => o.fach === fach),
      { unter: z ? "passt zu deiner Beschreibung · keine Diagnose" : "in der Nähe", hinweis: z?.alternative ? `Auch möglich: ${z.alternative.name}` : undefined });
  }, [liste, nahe]);

  const kategorieSuche = useCallback((k: Kategorie) => liste(k.name, () => inDerNaehe(k.phrasen, nahe, 3), { unter: "in der Nähe" }), [liste, nahe]);

  const anfrage = useRef(0);
  const absenden = useCallback(async (eingabe: string) => {
    let t = eingabe.trim();
    if (t.length < 2) return;
    const nr = ++anfrage.current;
    let a = verstehe(t);
    if (a.typ === "notfall") { setNotfall({ stufe: a.stufe, text: t }); return; }
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
    const beschwerde = a.typ === "anliegen" || klingtNachBeschwerde(t);
    // Beschwerden nie als Text an Dienste schicken: nur Fachrichtung (oder Hausarzt, wenn unklar)
    if (beschwerde && !(ki.art === "bereit" && a.typ === "anliegen" && !klingtNachBeschwerde(t))) {
      return a.typ === "anliegen" ? fachSuche(a.zuordnung.fach.id, a.zuordnung) : fachSuche("allgemein", { fach: FACHRICHTUNGEN.allgemein, erkannt: [], unsicher: true });
    }
    // Ganze Sätze: die KI auf dem Gerät übersetzt sie (nur wenn eingeschaltet)
    if (ki.art === "bereit" && t.split(/\s+/).length >= 3) {
      const k = await kiVerstehen(t).catch(() => null);
      if (nr !== anfrage.current) return; // inzwischen neue Suche
      const kat = k?.aktion === "kategorie" ? KATEGORIEN.find((x) => x.id === k.kategorie) : undefined;
      // Bei möglichen Beschwerden nur nicht-medizinische Kategorien von der KI annehmen, nie eine Textsuche
      if (kat && !(a.typ === "anliegen" && ["arzt", "zahnarzt", "apotheke", "krankenhaus"].includes(kat.id))) return kategorieSuche(kat);
      if (a.typ === "anliegen") return fachSuche(a.zuordnung.fach.id, a.zuordnung);
      if (k?.aktion === "suche") { merke(k.suchtext); return liste(k.suchtext, () => ortSuchen(k.suchtext, nahe), { unter: "von der KI verstanden" }); }
    }
    if (a.typ === "anliegen") return fachSuche(a.zuordnung.fach.id, a.zuordnung);
    merke(t);
    liste(t, () => ortSuchen(t, nahe));
  }, [fachSuche, kategorieSuche, liste, ki.art, nahe, zeige, merke]);

  const fertig = () => { setFokus(false); (document.activeElement as HTMLElement | null)?.blur(); };
  const waehle = (v: Vorschlag) => {
    fertig();
    if (v.art === "suchen") void absenden(v.text);
    else if (v.art === "zuletzt") { setText(v.text); void absenden(v.text); }
    else if (v.art === "kategorie") { setText(v.k.name); kategorieSuche(v.k); }
    else gehe({ art: "ort", ort: v.t.ort, laden: false });
  };

  /* ---------- Orte öffnen, Karte antippen ---------- */

  const oeffneOrt = useCallback((o: Ort, mitDetails: boolean) => {
    gehe({ art: "ort", ort: o, laden: mitDetails }, ansicht.art === "ort");
    if (!mitDetails) return;
    const ersetze = (f: (a: Extract<Ansicht, { art: "ort" }>) => Ansicht) =>
      setVerlauf((v) => v.map((a) => (a.art === "ort" && a.ort.id === o.id ? f(a) : a)));
    ortAnStelle(o.lngLat).then((d) => {
      // Details nur übernehmen, wenn sie zu genau diesem Ort passen
      const punkt = o.name === "Punkt auf der Karte";
      const neu: Ort = punkt
        ? { ...d, id: o.id, lngLat: o.lngLat, name: d.adresse ? `In der Nähe: ${d.name}` : d.name, website: null, telefon: null, oeffnungszeiten: null, rollstuhl: null, fach: null }
        : d.name === o.name ? { ...d, lngLat: o.lngLat, art: o.art } : { ...o, adresse: d.adresse };
      ersetze(() => ({ art: "ort", ort: neu, laden: false }));
    }, () => ersetze((a) => ({ ...a, laden: false })));
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
  const terminFuer = (o: Ort) => termine.find((t) => t.ort.id === o.id) ?? null;

  const terminSpeichern = (o: Ort, d: Date) => {
    const los = weg.route ? losgehzeit(d, weg.route.s) : null;
    const t: Termin = { id: terminFuer(o)?.id ?? `${o.id}-${d.getTime()}`, ort: o, zeit: d.toISOString(), los: los?.toISOString() ?? null, modus: weg.route ? modus : null };
    setTermine(speichereTermin(t));
    setVorgemerkt(null);
    try { if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission(); } catch { /* egal */ }
    zeige(los ? `Gemerkt. Erinnerung um ${los.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} zum Losgehen.` : "Gemerkt. Mit Startpunkt rechnet Lotse auch die Losgehzeit.");
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

  const listenOrte = useMemo(() => (ansicht.art === "liste" ? ansicht.l.orte : []), [ansicht]);
  const pins: Pin[] = useMemo(() => {
    if (zielOrt) return [{ id: zielOrt.id, lngLat: zielOrt.lngLat, label: zielOrt.name.length > 24 ? zielOrt.name.slice(0, 22) + "…" : zielOrt.name, aktiv: true }];
    return listenOrte.slice(0, 40).map((o) => ({ id: o.id, lngLat: o.lngLat, label: o.name.length > 18 ? o.name.slice(0, 16) + "…" : o.name, aktiv: false }));
  }, [zielOrt, listenOrte]);

  const routeLinie = useMemo(() => (ansicht.art === "route" && weg.route ? { linie: weg.route.line, planb: null, modus } : null), [ansicht.art, weg.route, modus]);
  const [rahmen, rahmenKey] = useMemo((): [LngLat[], string] => {
    if (routeLinie) return [routeLinie.linie, `route-${zielOrt?.id}-${modus}-${start?.lngLat.join()}`];
    if (zielOrt) return [[zielOrt.lngLat], `ort-${zielOrt.id}`];
    if (listenOrte.length) return [[nahe, ...listenOrte.slice(0, 8).map((o) => o.lngLat)], `liste-${listenOrte.slice(0, 3).map((o) => o.id).join()}`];
    return start ? [[start.lngLat], `start-${start.lngLat.join()}`] : [[], "leer"];
    // nahe absichtlich nicht: die Karte soll beim Verschieben nicht zurückspringen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeLinie, zielOrt, listenOrte, start, modus]);

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
      {desktop && <span className="brand-mini" title="Lotse"><Marke size={30} /></span>}
      <label className={`suchfeld${text || fokus ? " aktiv" : ""}`}>
        <Suche size={18} />
        <span className="sr">Suche oder Frage</span>
        <input value={text} onChange={(e) => setText(e.target.value)} onFocus={() => { setFokus(true); if (!desktop) setStufe("gross"); }}
          onKeyDown={(e) => { if (e.key === "Escape") fertig(); }}
          placeholder={ki.art === "bereit" ? "Frag Lotse" : "Suchen"} autoComplete="off" enterKeyHint="search" />
        {text && <button type="button" className="feld-x" aria-label="Schließen" onMouseDown={(e) => e.preventDefault()} onClick={() => { fertig(); zurStart(); if (!desktop) setStufe("klein"); }}><Schliessen size={14} /></button>}
        <button type="button" className={`ki-knopf ${ki.art}`} data-tip={kiTitel} aria-label={kiTitel} onMouseDown={(e) => e.preventDefault()} onClick={kiUmschalten}
          style={ki.art === "laedt" ? { ["--anteil" as string]: `${Math.round(ki.anteil * 360)}deg` } : undefined}>
          <Ki size={17} />
        </button>
      </label>
    </form>
  );

  return (
    <div className={`app ${desktop ? "pc" : "tel"}${notfall ? " im-notfall" : ""}`}>
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
      />

      <Blatt desktop={desktop} stufe={stufe} setStufe={setStufe} kopf={kopf} onGroesse={setGroesse}>
        {vorgemerkt && ansicht.art !== "termin" && (
          <div className="vorgemerkt">Termin {vorgemerkt.toLocaleString("de-DE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}: Ort wählen <button type="button" className="link" onClick={() => setVorgemerkt(null)}>verwerfen</button></div>
        )}
        <div className="wechsel" key={`${verlauf.length}-${ansicht.art}`}>
          {fokus && !desktop && (
            <VorschlagInhalt text={text} zuletzt={zuletzt} termine={termine} ki={ki} onWahl={waehle}
              onInfo={() => { fertig(); gehe({ art: "info" }); }}
              onVerlaufLoeschen={() => { setZuletzt([]); try { localStorage.removeItem("lotse.zuletzt"); } catch { /* egal */ } }} />
          )}
          {!fokus && !desktop && ansicht.art === "start" && <SchnellLeiste onKategorie={(k) => { setText(k.name); kategorieSuche(k); }} />}
          {!fokus && ansicht.art === "liste" && (
            <ListenInhalt l={ansicht.l} aktiv={null} onOrt={(o) => oeffneOrt(o, false)} onZu={zurStart} onNeu={ansicht.neu} />
          )}
          {!fokus && ansicht.art === "ort" && (
            <OrtInhalt o={ansicht.ort} laden={ansicht.laden} weg={weg} modus={modus} onZu={zurueck}
              onRoute={() => gehe({ art: "route", ort: ansicht.ort })}
              onTermin={() => gehe({ art: "termin", ort: ansicht.ort, zeit: vorgemerkt })}
              onTeilen={() => void teilen(ansicht.ort)} />
          )}
          {!fokus && ansicht.art === "route" && (
            <RouteInhalt o={ansicht.ort} start={start} modus={modus} setModus={setModus} weg={weg} termin={terminFuer(ansicht.ort)}
              onStartGps={gps} onStartAdresse={startAdresse} onZurueck={zurueck} onNeu={() => setVersuch((n) => n + 1)} />
          )}
          {!fokus && ansicht.art === "termin" && (
            <TerminInhalt o={ansicht.ort} vorschlag={ansicht.zeit ?? morgenNeun()} vorhanden={terminFuer(ansicht.ort)} onZurueck={zurueck}
              onSpeichern={(d) => terminSpeichern(ansicht.ort, d)}
              onLoeschen={() => { const t = terminFuer(ansicht.ort); if (t) setTermine(loescheTermin(t.id)); zurueck(); }}
              onKalender={() => { const t = terminFuer(ansicht.ort); if (t) kalenderLaden(t); }} />
          )}
          {!fokus && ansicht.art === "info" && <InfoInhalt onZurueck={zurueck} />}
        </div>
      </Blatt>

      {/* Computer: „Ablage“ unter der Suchleiste – Symbole im Ruhezustand, beim Tippen wächst sie zur Vorschlagsliste */}
      {desktop && (fokus || ansicht.art === "start") && groesse.h > 0 && (
        <Ablage offen={fokus} top={16 + groesse.h - 14}
          symbole={<SchnellLeiste onKategorie={(k) => { setText(k.name); kategorieSuche(k); }} />}
          vorschlaege={<VorschlagInhalt text={text} zuletzt={zuletzt} termine={termine} ki={ki} onWahl={waehle}
            onInfo={() => { fertig(); gehe({ art: "info" }); }}
            onVerlaufLoeschen={() => { setZuletzt([]); try { localStorage.removeItem("lotse.zuletzt"); } catch { /* egal */ } }} />} />
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
