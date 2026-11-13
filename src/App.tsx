import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RADIEN } from "./config";
import { ordneZu, type Zuordnung } from "./core/match";
import { pruefeSicherheit } from "./core/safety";
import { FACHRICHTUNGEN, type FachId } from "./data/fachrichtungen";
import type { Notfallstufe } from "./data/notfall";
import { luftlinie, minuten, MODI, nurPraxis, type LngLat, type Modus, type Praxis, type PraxisMitZeit, type Start, type Weg } from "./data/praxen";
import { begleitLink, kalenderDatei, leseLink, leseTermine, merkeTermin, planeWeg, standardTermin, uhr, type Gemerkt } from "./lib/plan";
import { LotseMap, type Abstand, type Pin } from "./map/LotseMap";
import { DienstFehler, praxenSuchen, praxisLaden, wegLaden, zeitenBerechnen } from "./services/dienste";
import { Notfall } from "./screens/Notfall";
import { PraxenPanel, type Sortierung, type SuchStatus } from "./screens/PraxenPanel";
import { StandortPanel } from "./screens/StandortPanel";
import { StartPanel } from "./screens/StartPanel";
import { WegPanel, type WegStatus } from "./screens/WegPanel";
import { Info, Kalender, Minus, Plus, Standort } from "./ui/icons";

type Ansicht =
  | { art: "start" }
  | { art: "praxen"; z: Zuordnung }
  | { art: "weg"; z: Zuordnung; praxisId: string; geteilt?: boolean; ausListe?: boolean };

const zuordnungFuer = (fach: FachId): Zuordnung => ({ fach: FACHRICHTUNGEN[fach], erkannt: [], unsicher: fach === "allgemein" });
const text = (e: unknown) => (e instanceof DienstFehler ? e.message : "Etwas ist schiefgelaufen. Bitte erneut versuchen.");

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

/** Startpunkt nur für diese Sitzung merken (nicht dauerhaft gespeichert) */
function leseStart(): Start | null {
  try { return JSON.parse(sessionStorage.getItem("lotse.start") ?? "null"); } catch { return null; }
}

export default function App() {
  const desktop = useMedia("(min-width: 900px)");
  const dunkel = useMedia("(prefers-color-scheme: dark)");
  const theme = dunkel ? "dark" : "light";

  const geteiltStart = useMemo(() => leseLink(window.location.hash), []);
  const [ansicht, setAnsicht] = useState<Ansicht>(() =>
    geteiltStart ? { art: "weg", z: zuordnungFuer("allgemein"), praxisId: geteiltStart.praxisId, geteilt: true } : { art: "start" });
  const [eingabe, setEingabe] = useState("");
  const [notfall, setNotfall] = useState<Notfallstufe | null>(null);
  const [start, setStartRoh] = useState<Start | null>(leseStart);
  const [standortWahl, setStandortWahl] = useState(false);
  const [modus, setModus] = useState<Modus>(geteiltStart?.modus ?? "fuss");
  const [sort, setSort] = useState<Sortierung>("zeit");
  const [radiusIdx, setRadiusIdx] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [termin, setTermin] = useState<Date>(() => geteiltStart?.termin ?? standardTermin());
  const [termine, setTermine] = useState<Gemerkt[]>(() => leseTermine());
  const [toast, setToast] = useState<string | null>(null);
  const [panelGroesse, setPanelGroesse] = useState({ w: 0, h: 0 });
  const panel = useRef<HTMLElement>(null);

  const [suche, setSuche] = useState<{ schluessel: string; startKey: string; status: SuchStatus; liste: PraxisMitZeit[]; fehler?: string; zeitFehler?: string | null; gekappt?: boolean; gefunden?: number }>({ schluessel: "", startKey: "", status: "leer", liste: [] });
  // geteilte, gemerkte oder nicht (mehr) in der Liste stehende Praxis – mit dem Startpunkt, für den ihre Zeiten gelten
  const [extra, setExtra] = useState<{ p: PraxisMitZeit; startKey: string } | null>(null);
  const [einzel, setEinzel] = useState<{ status: WegStatus; fehler?: string }>({ status: "leer" });
  const [weg, setWeg] = useState<{ schluessel: string; status: WegStatus; haupt?: Weg; planb?: Weg; fehler?: string }>({ schluessel: "", status: "leer" });
  const [neuVersuch, setNeuVersuch] = useState(0);
  const [dreiD, setDreiD] = useState(false);
  const sucheKey = useRef("");
  const wegKey = useRef("");

  const setStart = (s: Start) => {
    setStartRoh(s);
    setStandortWahl(false);
    try { sessionStorage.setItem("lotse.start", JSON.stringify(s)); } catch { /* egal */ }
  };
  const startKey = start ? start.lngLat.join(",") : "";

  // Live-Zuordnung beim Tippen: Sicherheitsfilter immer zuerst
  const live = useMemo(() => (eingabe.trim().length < 3 ? null : { s: pruefeSicherheit(eingabe), z: ordneZu(eingabe) }), [eingabe]);

  useEffect(() => {
    if (!panel.current) return;
    const ro = new ResizeObserver(([e]) => {
      const r = e.target.getBoundingClientRect();
      setPanelGroesse({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(panel.current);
    return () => ro.disconnect();
  }, []);

  const zeigeToast = useCallback((t: string) => {
    setToast(t);
    window.setTimeout(() => setToast((x) => (x === t ? null : x)), 3600);
  }, []);

  /* ---------- Praxissuche (live) ---------- */
  // Die Suche läuft weiter, wenn man eine Praxis aus der Liste öffnet (sonst blieben Zeiten „ausstehend“)
  const suchFach = ansicht.art === "praxen" || (ansicht.art === "weg" && ansicht.ausListe) ? ansicht.z.fach.id : null;
  const radius = RADIEN[radiusIdx];
  useEffect(() => {
    if (!suchFach || !start) return;
    const schluessel = `${suchFach}|${startKey}|${radius}|${neuVersuch}`;
    if (sucheKey.current === schluessel) return;
    sucheKey.current = schluessel;
    let ab = false;
    // Die alte Liste bleibt (mit IHREM Startpunkt) stehen, bis die neue da ist: so bleibt eine geöffnete Praxis sichtbar,
    // aber Zeiten gelten nur, wenn der Startpunkt der Liste zum aktuellen passt.
    setSuche((x) => ({ ...x, schluessel, status: "laden", fehler: undefined }));
    (async () => {
      try {
        const { praxen: roh, gekappt } = await praxenSuchen(start.lngLat, suchFach, radius);
        // Liste zeigen, sobald das gewählte Verkehrsmittel da ist; die anderen kommen nach (1 Anfrage/s)
        const { liste, fehler: zeitFehler } = await zeitenBerechnen(start.lngLat, roh, modus, (teil) => {
          if (!ab) setSuche({ schluessel, startKey, status: "fertig", liste: teil, zeitFehler: null, gekappt, gefunden: roh.length });
        }, () => ab);
        if (!ab) setSuche({ schluessel, startKey, status: liste.length ? "fertig" : "leer", liste, zeitFehler, gekappt, gefunden: roh.length });
      } catch (e) {
        if (!ab) setSuche({ schluessel, startKey, status: "fehler", liste: [], fehler: text(e) });
      }
    })();
    return () => { ab = true; if (sucheKey.current === schluessel) sucheKey.current = ""; };
    // modus nur für die Reihenfolge beim Start der Suche; ein Wechsel startet keine neue Suche
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suchFach, startKey, radius, neuVersuch]);

  // Praxis im Weg-Panel: aus der Liste (nur wenn für DIESEN Startpunkt berechnet) oder einzeln
  const wegId = ansicht.art === "weg" ? ansicht.praxisId : null;
  const ausListe = wegId && suche.startKey === startKey ? suche.liste.find((p) => p.id === wegId) ?? null : null;
  // Praxis aus der Liste: auf die Liste für den aktuellen Startpunkt warten statt doppelt anzufragen
  const listeLaedt = ansicht.art === "weg" && !!ansicht.ausListe && (suche.status === "laden" || suche.startKey !== startKey);
  const extraAktuell = !!extra && extra.p.id === wegId && extra.startKey === startKey;
  useEffect(() => {
    if (!wegId || ausListe || listeLaedt || !start) return;
    // schon vollständig für diesen Startpunkt geladen? (bei Teil-Ausfall oder ausstehenden Zeiten neu versuchen dürfen)
    if (extraAktuell && Object.values(extra!.p.zeiten).some(Boolean) && !extra!.p.nichtAbrufbar?.length && !extra!.p.ausstehend?.length) return;
    let ab = false;
    setEinzel({ status: "laden" });
    (async () => {
      try {
        const bekannt = extra?.p.id === wegId ? extra.p : suche.liste.find((p) => p.id === wegId);
        const basis: Praxis | null = bekannt ? nurPraxis(bekannt) : await praxisLaden(wegId);
        if (!basis) throw new DienstFehler("Diese Praxis ist in OpenStreetMap nicht mehr zu finden.");
        const { liste: [mit] } = await zeitenBerechnen(start.lngLat, [basis], modus, (teil) => { if (!ab) setExtra({ p: teil[0], startKey }); }, () => ab);
        if (!ab) {
          setExtra({ p: mit, startKey });
          setEinzel({ status: "fertig" });
          if (ansicht.art === "weg" && ansicht.geteilt) setAnsicht({ ...ansicht, z: zuordnungFuer(mit.fach) });
        }
      } catch (e) {
        if (!ab) setEinzel({ status: "fehler", fehler: text(e) });
      }
    })();
    return () => { ab = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wegId, !!ausListe, listeLaedt, startKey, neuVersuch]);

  const gewaehlt: PraxisMitZeit | null = useMemo(() => {
    if (!wegId) return null;
    if (ausListe) return ausListe;
    if (extraAktuell) return extra!.p;
    // Praxis bekannt, Zeiten für den neuen Startpunkt kommen noch: ehrlich als „wird berechnet“ zeigen, nie alte Zeiten
    const b = extra?.p.id === wegId ? extra.p : suche.liste.find((p) => p.id === wegId);
    return b && start ? { ...nurPraxis(b), entfernung: Math.round(luftlinie(start.lngLat, b.lngLat) * 10) / 10, zeiten: { fuss: null, rad: null, auto: null }, ausstehend: [...MODI] } : null;
  }, [wegId, ausListe, extraAktuell, extra, suche.liste, start]);
  const plan = useMemo(() => (gewaehlt ? planeWeg(gewaehlt, termin, modus) : null), [gewaehlt, termin, modus]);

  // Weglinie (und Plan-B-Linie) für die Karte nachladen
  useEffect(() => {
    if (!gewaehlt || !start || !plan) return;
    const schluessel = `${gewaehlt.id}|${startKey}|${modus}|${plan.planb?.modus ?? "-"}|${neuVersuch}`;
    if (wegKey.current === schluessel) return;
    wegKey.current = schluessel;
    let ab = false;
    setWeg({ schluessel, status: "laden" });
    (async () => {
      try {
        const [haupt, planb] = await Promise.all([
          wegLaden(start.lngLat, gewaehlt.lngLat, modus),
          plan.planb ? wegLaden(start.lngLat, gewaehlt.lngLat, plan.planb.modus).catch(() => undefined) : Promise.resolve(undefined),
        ]);
        if (!ab) setWeg({ schluessel, status: "fertig", haupt, planb });
      } catch (e) {
        if (!ab) setWeg({ schluessel, status: "fehler", fehler: text(e) });
      }
    })();
    return () => { ab = true; if (wegKey.current === schluessel) wegKey.current = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gewaehlt?.id, startKey, modus, !!plan, plan?.planb?.modus, neuVersuch]);

  /* ---------- Navigation ---------- */
  const suchen = useCallback(() => {
    const s = pruefeSicherheit(eingabe);
    if (s.stufe) { setNotfall(s.stufe); return; }
    setHover(null); setRadiusIdx(0);
    setAnsicht({ art: "praxen", z: ordneZu(eingabe) });
  }, [eingabe]);

  const zurStart = useCallback(() => {
    setAnsicht({ art: "start" }); setHover(null); setStandortWahl(false);
    if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  const zurueckAusWeg = useCallback(() => {
    if (ansicht.art !== "weg") return;
    if (ansicht.geteilt || !ansicht.ausListe) zurStart();
    else setAnsicht({ art: "praxen", z: ansicht.z });
  }, [ansicht, zurStart]);

  const liste = useMemo(() => {
    // Rollstuhl-Filter immer zuerst (nur laut OSM „yes“/„limited“), dann sortieren
    const l = sort === "rollstuhl" ? suche.liste.filter((p) => p.rollstuhl === "yes" || p.rollstuhl === "limited") : [...suche.liste];
    // Fehlen die Zeiten für dieses Verkehrsmittel, ehrlich nach Luftlinie sortieren
    if (sort === "naehe" || suche.zeitFehler || l[0]?.nichtAbrufbar?.includes(modus) || l[0]?.ausstehend?.includes(modus)) return l.sort((a, b) => a.entfernung - b.entfernung);
    return l.sort((a, b) => (minuten(a, modus) ?? 1e9) - (minuten(b, modus) ?? 1e9));
  }, [suche.liste, suche.zeitFehler, sort, modus]);

  /* ---------- Karte ---------- */
  const pins: Pin[] = useMemo(() => {
    if (ansicht.art === "praxen") {
      if (suche.status === "laden") return [];
      // Mehrere Praxen im selben Haus teilen sich einen Pin
      const aktiv = hover ?? liste[0]?.id;
      const gruppen = new Map<string, PraxisMitZeit[]>();
      for (const p of liste) {
        const k = `${p.lngLat[0].toFixed(4)},${p.lngLat[1].toFixed(4)}`;
        gruppen.set(k, [...(gruppen.get(k) ?? []), p]);
      }
      return [...gruppen.values()].map((g) => {
        const m = minuten(g[0], modus);
        const zeit = m === null ? "–" : `${m} Min`;
        const treffer = g.find((p) => p.id === aktiv);
        return { id: (treffer ?? g[0]).id, lngLat: g[0].lngLat, label: g.length > 1 ? `${zeit} · ${g.length} Praxen` : zeit, aktiv: !!treffer };
      });
    }
    if (gewaehlt) return [{ id: gewaehlt.id, lngLat: gewaehlt.lngLat, label: gewaehlt.name.length > 26 ? gewaehlt.name.slice(0, 24) + "…" : gewaehlt.name, aktiv: true }];
    return [];
  }, [ansicht.art, liste, hover, gewaehlt, modus, suche.status]);

  // Weglinie nur zeigen, wenn sie zu Praxis, Startpunkt und Verkehrsmittel von JETZT gehört
  const wegAktuell = !!gewaehlt && !!plan && weg.schluessel.startsWith(`${gewaehlt.id}|${startKey}|${modus}|`);
  const route = useMemo(() => (gewaehlt && wegAktuell && weg.haupt
    ? { linie: [...weg.haupt.line, gewaehlt.lngLat] as LngLat[], planb: weg.planb?.line ?? null, modus }
    : null), [gewaehlt, wegAktuell, weg.haupt, weg.planb, modus]);

  const [rahmen, rahmenSchluessel] = useMemo((): [LngLat[], string] => {
    const s = start?.lngLat;
    if (gewaehlt) {
      const linie = wegAktuell ? weg.haupt?.line ?? [] : [];
      const pts = [gewaehlt.lngLat, ...(s ? [s] : []), ...linie];
      return [pts, `weg-${gewaehlt.id}-${modus}-${linie.length ? "linie" : "punkt"}`];
    }
    if (ansicht.art === "praxen" && liste.length) {
      return [[...(s ? [s] : []), ...liste.slice(0, 6).map((p) => p.lngLat)], `praxen-${suche.schluessel}-${sort}`];
    }
    return s ? [[s], `start-${s.join(",")}`] : [[], "ueberblick"];
  }, [gewaehlt, ansicht.art, liste, start, weg.haupt, wegAktuell, modus, suche.schluessel, sort]);

  const abstand: Abstand = desktop
    ? { top: 0, right: 70, bottom: 0, left: panelGroesse.w + 16 }
    : { top: 0, right: 0, bottom: panelGroesse.h, left: 0 };

  /* ---------- Aktionen ---------- */
  const kalender = () => {
    if (!gewaehlt || !plan) return;
    const blob = new Blob([kalenderDatei(gewaehlt, termin, plan)], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Lotse-${gewaehlt.name.replace(/[^\wäöüÄÖÜß-]+/g, "-")}.ics`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    setTermine(merkeTermin({ praxis: nurPraxis(gewaehlt), termin: termin.toISOString(), los: plan.los.toISOString(), modus }));
    zeigeToast(`Termin gemerkt. Erinnerung zum Losgehen um ${uhr(plan.los)}.`);
  };

  const teilen = async () => {
    if (!gewaehlt) return;
    const url = begleitLink(gewaehlt.id, termin, modus);
    const daten = { title: `Termin: ${gewaehlt.name}`, text: `Kommst du mit? ${gewaehlt.name}, ${termin.toLocaleString("de-DE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}. Dein eigener Weg wird für dich geplant.`, url };
    try {
      if (navigator.share) { await navigator.share(daten); return; }
      await navigator.clipboard.writeText(url);
      zeigeToast("Link kopiert. Wer ihn öffnet, bekommt den Termin und plant seinen eigenen Weg.");
    } catch { /* abgebrochen */ }
  };

  const oeffneTermin = (t: Gemerkt) => {
    setTermin(new Date(t.termin));
    setModus(t.modus);
    setExtra({ p: { ...t.praxis, entfernung: 0, zeiten: { fuss: null, rad: null, auto: null } }, startKey: "" });
    setAnsicht({ art: "weg", z: zuordnungFuer(t.praxis.fach), praxisId: t.praxis.id });
  };

  // „Wo startest du?“ – auch vom Startbildschirm aus, ohne die Praxissuche (und damit den Sicherheitsfilter) zu umgehen
  const brauchtStart = standortWahl || (ansicht.art !== "start" && !start);

  return (
    <div className={`app ${desktop ? "pc" : "tel"}${notfall ? " im-notfall" : ""}`}>
      <LotseMap
        theme={theme}
        start={start?.lngLat ?? null}
        pins={pins}
        route={route}
        rahmen={rahmen}
        rahmenSchluessel={rahmenSchluessel}
        abstand={abstand}
        onPin={(id) => ansicht.art === "praxen" && setAnsicht({ art: "weg", z: ansicht.z, praxisId: id, ausListe: true })}
        onPinHover={(id) => ansicht.art === "praxen" && setHover(id)}
        dreiD={dreiD}
        onOrt={(name, art) => zeigeToast(`${art}: ${name} · laut OpenStreetMap`)}
      />

      <aside ref={panel} className={`panel glas ansicht-${brauchtStart ? "standort" : ansicht.art}`} aria-label="Lotse">
        {!desktop && ansicht.art !== "start" && <div className="griff" aria-hidden="true" />}

        {!brauchtStart && ansicht.art === "start" && (
          <StartPanel
            text={eingabe}
            setText={setEingabe}
            live={live}
            termine={termine}
            start={start}
            onSuchen={suchen}
            onHausarzt={() => { setHover(null); setRadiusIdx(0); setAnsicht({ art: "praxen", z: zuordnungFuer("allgemein") }); }}
            onTermin={oeffneTermin}
            onStartAendern={() => setStandortWahl(true)}
            desktop={desktop}
          />
        )}

        {brauchtStart && (
          <StandortPanel
            fachName={ansicht.art === "praxen" ? ansicht.z.fach.name : ""}
            geteilt={ansicht.art === "weg" && !!ansicht.geteilt}
            onStart={setStart}
            onZurueck={start ? () => setStandortWahl(false) : zurStart}
          />
        )}

        {!brauchtStart && ansicht.art === "praxen" && (
          <PraxenPanel
            z={ansicht.z}
            text={eingabe}
            start={start!}
            status={suche.status}
            fehler={suche.fehler}
            zeitFehler={suche.zeitFehler ?? null}
            liste={liste}
            gesamt={suche.liste.length}
            gefunden={suche.gefunden ?? suche.liste.length}
            gekappt={!!suche.gekappt}
            modus={modus}
            setModus={setModus}
            sort={sort}
            setSort={setSort}
            radius={radius}
            kannErweitern={radiusIdx < RADIEN.length - 1 && !suche.gekappt}
            onErweitern={() => setRadiusIdx((i) => Math.min(RADIEN.length - 1, i + 1))}
            onNeu={() => setNeuVersuch((n) => n + 1)}
            hover={hover}
            setHover={setHover}
            onWahl={(id) => setAnsicht({ art: "weg", z: ansicht.z, praxisId: id, ausListe: true })}
            onZurueck={zurStart}
            onStartAendern={() => setStandortWahl(true)}
            onHausarzt={() => { setRadiusIdx(0); setAnsicht({ art: "praxen", z: zuordnungFuer("allgemein") }); }}
            onAlternative={() => ansicht.z.alternative && setAnsicht({ art: "praxen", z: { ...ansicht.z, fach: ansicht.z.alternative, alternative: ansicht.z.fach } })}
            desktop={desktop}
          />
        )}

        {!brauchtStart && ansicht.art === "weg" && (
          <WegPanel
            p={gewaehlt}
            start={start!}
            termin={termin}
            setTermin={setTermin}
            modus={modus}
            setModus={setModus}
            plan={plan}
            wegStatus={gewaehlt ? (wegAktuell ? weg.status : "leer") : listeLaedt ? "laden" : einzel.status}
            fehler={gewaehlt ? weg.fehler : einzel.fehler}
            geteilt={!!ansicht.geteilt}
            onNeu={() => setNeuVersuch((n) => n + 1)}
            onZurueck={zurueckAusWeg}
            onKalender={kalender}
            onTeilen={teilen}
            onStartAendern={() => setStandortWahl(true)}
          />
        )}
      </aside>

      {desktop && (
        <div className="werkzeug glas">
          <button type="button" aria-label="Deine Termine" title="Deine Termine" onClick={() => { zurStart(); setEingabe(""); }}><Kalender size={19} /></button>
          <a href="../" aria-label="Über Lotse" title="Über Lotse"><Info size={19} /></a>
        </div>
      )}
      <div className="kartenknoepfe">
        <button type="button" className="glas" aria-label="Zum Startpunkt" title="Zum Startpunkt" onClick={() => window.dispatchEvent(new CustomEvent("lotse:start"))}><Standort size={18} /></button>
        <button type="button" className={`glas drei-d${dreiD ? " an" : ""}`} aria-pressed={dreiD} aria-label={dreiD ? "Zurück zur flachen Karte" : "3D-Gebäude zeigen"} title={dreiD ? "2D" : "3D-Gebäude"} onClick={() => setDreiD((x) => !x)}>{dreiD ? "2D" : "3D"}</button>
        {desktop && (
          <div className="zoom glas">
            <button type="button" aria-label="Vergrößern" onClick={() => window.dispatchEvent(new CustomEvent("lotse:zoom", { detail: 1 }))}><Plus size={18} /></button>
            <span />
            <button type="button" aria-label="Verkleinern" onClick={() => window.dispatchEvent(new CustomEvent("lotse:zoom", { detail: -1 }))}><Minus size={18} /></button>
          </div>
        )}
      </div>

      {notfall && (
        <Notfall
          stufe={notfall}
          text={eingabe}
          onZurueck={() => setNotfall(null)}
          onWeiter={() => { setNotfall(null); setHover(null); setAnsicht({ art: "praxen", z: ordneZu(eingabe) }); }}
        />
      )}

      <div className={`toast glas${toast ? " zeigen" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
