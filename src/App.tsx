import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RADIEN } from "./config";
import { ordneZu, type Zuordnung } from "./core/match";
import { pruefeSicherheit } from "./core/safety";
import { FACHRICHTUNGEN, type FachId } from "./data/fachrichtungen";
import type { Notfallstufe } from "./data/notfall";
import { minuten, type LngLat, type Modus, type Praxis, type PraxisMitZeit, type Start, type Weg } from "./data/praxen";
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
  | { art: "weg"; z: Zuordnung; praxisId: string; geteilt?: boolean };

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

  const [suche, setSuche] = useState<{ schluessel: string; status: SuchStatus; liste: PraxisMitZeit[]; fehler?: string; zeitFehler?: string | null }>({ schluessel: "", status: "leer", liste: [] });
  const [extra, setExtra] = useState<PraxisMitZeit | null>(null); // geteilte oder gemerkte Praxis außerhalb der Liste
  const [weg, setWeg] = useState<{ schluessel: string; status: WegStatus; haupt?: Weg; planb?: Weg; fehler?: string }>({ schluessel: "", status: "leer" });
  const [neuVersuch, setNeuVersuch] = useState(0);
  const sucheKey = useRef("");
  const wegKey = useRef("");

  const setStart = (s: Start) => {
    setStartRoh(s);
    setStandortWahl(false);
    try { sessionStorage.setItem("lotse.start", JSON.stringify(s)); } catch { /* egal */ }
  };

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
  const fach = ansicht.art === "start" ? null : ansicht.z.fach.id;
  const radius = RADIEN[radiusIdx];
  useEffect(() => {
    if (!fach || !start || ansicht.art !== "praxen") return;
    const schluessel = `${fach}|${start.lngLat.join(",")}|${radius}|${neuVersuch}`;
    if (sucheKey.current === schluessel) return;
    sucheKey.current = schluessel;
    let ab = false;
    setSuche({ schluessel, status: "laden", liste: [] });
    (async () => {
      try {
        const roh = await praxenSuchen(start.lngLat, fach, radius);
        const { liste, fehler: zeitFehler } = await zeitenBerechnen(start.lngLat, roh);
        if (!ab) setSuche({ schluessel, status: liste.length ? "fertig" : "leer", liste, zeitFehler });
      } catch (e) {
        if (!ab) setSuche({ schluessel, status: "fehler", liste: [], fehler: text(e) });
      }
    })();
    return () => { ab = true; if (sucheKey.current === schluessel) sucheKey.current = ""; };
  }, [fach, start, radius, neuVersuch, ansicht.art]);

  // Geteilte oder gemerkte Praxis: einzeln laden und Zeiten ab eigenem Startpunkt rechnen
  const wegId = ansicht.art === "weg" ? ansicht.praxisId : null;
  const ausListe = wegId ? suche.liste.find((p) => p.id === wegId) ?? null : null;
  useEffect(() => {
    if (!wegId || ausListe || !start) return;
    if (extra?.id === wegId && extra.zeiten && Object.values(extra.zeiten).some(Boolean)) return;
    let ab = false;
    setWeg({ schluessel: "", status: "laden" });
    (async () => {
      try {
        const basis: Praxis | null = extra?.id === wegId ? extra : await praxisLaden(wegId);
        if (!basis) throw new DienstFehler("Diese Praxis ist in OpenStreetMap nicht mehr zu finden.");
        const { liste: [mit] } = await zeitenBerechnen(start.lngLat, [basis]);
        if (!ab) {
          setExtra(mit);
          if (ansicht.art === "weg" && ansicht.geteilt) setAnsicht({ ...ansicht, z: zuordnungFuer(mit.fach) });
        }
      } catch (e) {
        if (!ab) setWeg({ schluessel: "", status: "fehler", fehler: text(e) });
      }
    })();
    return () => { ab = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wegId, ausListe, start, neuVersuch]);

  const gewaehlt: PraxisMitZeit | null = ausListe ?? (extra && extra.id === wegId ? extra : null);
  const plan = useMemo(() => (gewaehlt ? planeWeg(gewaehlt, termin, modus) : null), [gewaehlt, termin, modus]);

  // Weglinie (und Plan-B-Linie) für die Karte nachladen
  useEffect(() => {
    if (!gewaehlt || !start || !plan) return;
    const schluessel = `${gewaehlt.id}|${start.lngLat.join(",")}|${modus}|${neuVersuch}`;
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
  }, [gewaehlt?.id, start, modus, !!plan, plan?.planb?.modus, neuVersuch]);

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
    if (ansicht.geteilt || !suche.liste.length) zurStart();
    else setAnsicht({ art: "praxen", z: ansicht.z });
  }, [ansicht, suche.liste.length, zurStart]);

  const liste = useMemo(() => {
    const l = [...suche.liste];
    if (sort === "naehe" || suche.zeitFehler) return l.sort((a, b) => a.entfernung - b.entfernung);
    const nachZeit = (a: PraxisMitZeit, b: PraxisMitZeit) => (minuten(a, modus) ?? 1e9) - (minuten(b, modus) ?? 1e9);
    if (sort === "rollstuhl") return l.filter((p) => p.rollstuhl === "yes" || p.rollstuhl === "limited").sort(nachZeit);
    return l.sort(nachZeit);
  }, [suche.liste, suche.zeitFehler, sort, modus]);

  /* ---------- Karte ---------- */
  const pins: Pin[] = useMemo(() => {
    if (ansicht.art === "praxen") {
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
  }, [ansicht.art, liste, hover, gewaehlt, modus]);

  const route = useMemo(() => (gewaehlt && weg.haupt
    ? { linie: [...weg.haupt.line, gewaehlt.lngLat] as LngLat[], planb: weg.planb?.line ?? null, modus }
    : null), [gewaehlt, weg.haupt, weg.planb, modus]);

  const [rahmen, rahmenSchluessel] = useMemo((): [LngLat[], string] => {
    const s = start?.lngLat;
    if (gewaehlt) {
      const pts = [gewaehlt.lngLat, ...(s ? [s] : []), ...(weg.haupt?.line ?? [])];
      return [pts, `weg-${gewaehlt.id}-${modus}-${weg.haupt ? "linie" : "punkt"}`];
    }
    if (ansicht.art === "praxen" && liste.length) {
      return [[...(s ? [s] : []), ...liste.slice(0, 6).map((p) => p.lngLat)], `praxen-${suche.schluessel}-${sort}`];
    }
    return s ? [[s], `start-${s.join(",")}`] : [[], "ueberblick"];
  }, [gewaehlt, ansicht.art, liste, start, weg.haupt, modus, suche.schluessel, sort]);

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
    URL.revokeObjectURL(a.href);
    const { entfernung: _e, zeiten: _z, ...praxis } = gewaehlt;
    setTermine(merkeTermin({ praxis, termin: termin.toISOString(), los: plan.los.toISOString(), modus }));
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
    setExtra({ ...t.praxis, entfernung: 0, zeiten: { fuss: null, rad: null, auto: null } });
    setAnsicht({ art: "weg", z: zuordnungFuer(t.praxis.fach), praxisId: t.praxis.id });
  };

  const brauchtStart = ansicht.art !== "start" && (!start || standortWahl);

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
        onPin={(id) => ansicht.art === "praxen" && setAnsicht({ art: "weg", z: ansicht.z, praxisId: id })}
        onPinHover={(id) => ansicht.art === "praxen" && setHover(id)}
      />

      <aside ref={panel} className={`panel glas ansicht-${brauchtStart ? "standort" : ansicht.art}`} aria-label="Lotse">
        {!desktop && ansicht.art !== "start" && <div className="griff" aria-hidden="true" />}

        {ansicht.art === "start" && (
          <StartPanel
            text={eingabe}
            setText={setEingabe}
            live={live}
            termine={termine}
            start={start}
            onSuchen={suchen}
            onHausarzt={() => { setHover(null); setRadiusIdx(0); setAnsicht({ art: "praxen", z: zuordnungFuer("allgemein") }); }}
            onTermin={oeffneTermin}
            onStartAendern={() => { setStandortWahl(true); setAnsicht({ art: "praxen", z: live?.z ?? zuordnungFuer("allgemein") }); }}
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
            modus={modus}
            setModus={setModus}
            sort={sort}
            setSort={setSort}
            radius={radius}
            kannErweitern={radiusIdx < RADIEN.length - 1}
            onErweitern={() => setRadiusIdx((i) => Math.min(RADIEN.length - 1, i + 1))}
            onNeu={() => setNeuVersuch((n) => n + 1)}
            hover={hover}
            setHover={setHover}
            onWahl={(id) => setAnsicht({ art: "weg", z: ansicht.z, praxisId: id })}
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
            wegStatus={weg.status}
            fehler={weg.fehler}
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
