import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ordneZu, type Zuordnung } from "./core/match";
import { pruefeSicherheit } from "./core/safety";
import { FACHRICHTUNGEN, type FachId } from "./data/fachrichtungen";
import { START } from "./data/geo";
import type { Notfallstufe } from "./data/notfall";
import { praxenFuer, type Praxis } from "./data/praxen";
import { begleitLink, kalenderDatei, leseLink, leseTermine, merkeTermin, planeWeg, standardTermin, uhr, type Gemerkt } from "./lib/plan";
import { LotseMap, type Abstand, type Pin } from "./map/LotseMap";
import { Notfall } from "./screens/Notfall";
import { PraxenPanel, type Sortierung } from "./screens/PraxenPanel";
import { StartPanel } from "./screens/StartPanel";
import { WegPanel } from "./screens/WegPanel";
import { Info, Kalender, Minus, Plus, Standort } from "./ui/icons";

type Ansicht =
  | { art: "start" }
  | { art: "praxen"; z: Zuordnung }
  | { art: "weg"; z: Zuordnung; praxisId: string; geteilt?: boolean };

const fachVon = (id: string) => id.split("-")[0] as FachId;
const praxis = (id: string): Praxis | undefined => praxenFuer(fachVon(id)).find((p) => p.id === id);
const zuordnungFuer = (fach: FachId): Zuordnung => ({ fach: FACHRICHTUNGEN[fach], erkannt: [], unsicher: fach === "allgemein" });

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

export default function App() {
  const desktop = useMedia("(min-width: 900px)");
  const dunkel = useMedia("(prefers-color-scheme: dark)");
  const theme = dunkel ? "dark" : "light";

  const geteiltStart = useMemo(() => leseLink(window.location.hash), []);
  const [ansicht, setAnsicht] = useState<Ansicht>(() => {
    if (geteiltStart && praxis(geteiltStart.praxisId)) {
      return { art: "weg", z: zuordnungFuer(fachVon(geteiltStart.praxisId)), praxisId: geteiltStart.praxisId, geteilt: true };
    }
    return { art: "start" };
  });
  const [text, setText] = useState("");
  const [notfall, setNotfall] = useState<Notfallstufe | null>(null);
  const [sort, setSort] = useState<Sortierung>("zeit");
  const [hover, setHover] = useState<string | null>(null);
  const [termin, setTermin] = useState<Date>(() => geteiltStart?.termin ?? standardTermin());
  const [termine, setTermine] = useState<Gemerkt[]>(() => leseTermine());
  const [toast, setToast] = useState<string | null>(null);
  const [panelGroesse, setPanelGroesse] = useState({ w: 0, h: 0 });
  const panel = useRef<HTMLElement>(null);

  // Live-Zuordnung beim Tippen: Sicherheitsfilter immer zuerst
  const live = useMemo(() => {
    if (text.trim().length < 3) return null;
    return { s: pruefeSicherheit(text), z: ordneZu(text) };
  }, [text]);

  // Panelgröße messen, damit die Karte ihren sichtbaren Teil kennt
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
    window.setTimeout(() => setToast((x) => (x === t ? null : x)), 3200);
  }, []);

  const suchen = useCallback(() => {
    const s = pruefeSicherheit(text);
    if (s.stufe) { setNotfall(s.stufe); return; }
    setHover(null);
    setAnsicht({ art: "praxen", z: ordneZu(text) });
  }, [text]);

  const zurStart = useCallback(() => {
    setAnsicht({ art: "start" });
    setHover(null);
    if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  const zurueckAusWeg = useCallback(() => {
    if (ansicht.art !== "weg") return;
    if (ansicht.geteilt) zurStart();
    else setAnsicht({ art: "praxen", z: ansicht.z });
  }, [ansicht, zurStart]);

  // Liste der aktuellen Fachrichtung
  const liste = useMemo(() => {
    if (ansicht.art === "start") return [];
    const l = praxenFuer(ansicht.z.fach.id);
    if (sort === "naehe") return [...l].sort((a, b) => a.entfernung - b.entfernung);
    if (sort === "barrierefrei") return l.filter((p) => p.barrierefrei);
    return l;
  }, [ansicht, sort]);

  const gewaehlt = ansicht.art === "weg" ? praxis(ansicht.praxisId) ?? null : null;
  const plan = useMemo(() => (gewaehlt ? planeWeg(gewaehlt, termin) : null), [gewaehlt, termin]);

  // Karte: Pins, Route, Ausschnitt
  const pins: Pin[] = useMemo(() => {
    if (ansicht.art === "praxen") {
      const aktiv = hover ?? liste[0]?.id;
      return liste.map((p) => ({ id: p.id, lngLat: p.lngLat, label: `${p.fahrzeit} Min`, aktiv: p.id === aktiv }));
    }
    if (gewaehlt) return [{ id: gewaehlt.id, lngLat: gewaehlt.lngLat, label: gewaehlt.name.length > 22 ? `${gewaehlt.fahrzeit} Min` : gewaehlt.name, aktiv: true }];
    return [];
  }, [ansicht.art, liste, hover, gewaehlt]);

  const route = useMemo(() => (gewaehlt ? { linie: [...gewaehlt.weg.line, gewaehlt.lngLat], planb: gewaehlt.planb?.line ?? null, modus: gewaehlt.modus } : null), [gewaehlt]);

  const [rahmen, rahmenSchluessel] = useMemo((): [Praxis["lngLat"][], string] => {
    if (gewaehlt) return [[START.lngLat, ...gewaehlt.weg.line, ...(gewaehlt.planb?.line ?? [])], `weg-${gewaehlt.id}`];
    if (ansicht.art === "praxen") {
      const nah = liste.filter((p) => p.entfernung < 8).slice(0, 5);
      const pts = (nah.length ? nah : liste.slice(0, 3)).map((p) => p.lngLat);
      return [[START.lngLat, ...pts], `praxen-${ansicht.z.fach.id}-${sort}`];
    }
    return [[START.lngLat], "start"];
  }, [gewaehlt, ansicht, liste, sort]);

  const abstand: Abstand = desktop
    ? { top: 0, right: 70, bottom: 0, left: panelGroesse.w + 16 }
    : { top: 0, right: 0, bottom: panelGroesse.h, left: 0 };

  const kalender = () => {
    if (!gewaehlt || !plan) return;
    const blob = new Blob([kalenderDatei(gewaehlt, termin, plan)], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Lotse-${gewaehlt.name.replace(/[^\wäöüÄÖÜß-]+/g, "-")}.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
    setTermine(merkeTermin({ praxisId: gewaehlt.id, name: gewaehlt.name, termin: termin.toISOString(), los: plan.los.toISOString() }));
    zeigeToast(`Termin gemerkt. Erinnerung zum Losgehen um ${uhr(plan.los)}.`);
  };

  const teilen = async () => {
    if (!gewaehlt) return;
    const url = begleitLink(gewaehlt.id, termin);
    const daten = { title: `Termin: ${gewaehlt.name}`, text: `Kommst du mit? ${gewaehlt.name}, ${termin.toLocaleString("de-DE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`, url };
    try {
      if (navigator.share) { await navigator.share(daten); return; }
      await navigator.clipboard.writeText(url);
      zeigeToast("Link kopiert. Wer ihn öffnet, sieht Termin und Weg.");
    } catch { /* abgebrochen */ }
  };

  const oeffneTermin = (t: Gemerkt) => {
    const p = praxis(t.praxisId);
    if (!p) return;
    setTermin(new Date(t.termin));
    setAnsicht({ art: "weg", z: zuordnungFuer(p.fach), praxisId: p.id });
  };

  return (
    <div className={`app ${desktop ? "pc" : "tel"}${notfall ? " im-notfall" : ""}`}>
      <LotseMap
        theme={theme}
        start={START.lngLat}
        pins={pins}
        route={route}
        rahmen={rahmen}
        rahmenSchluessel={rahmenSchluessel}
        abstand={abstand}
        onPin={(id) => ansicht.art === "praxen" && setAnsicht({ art: "weg", z: ansicht.z, praxisId: id })}
        onPinHover={(id) => ansicht.art === "praxen" && setHover(id)}
      />

      <aside ref={panel} className={`panel glas ansicht-${ansicht.art}`} aria-label="Lotse">
        {!desktop && ansicht.art !== "start" && <div className="griff" aria-hidden="true" />}
        {ansicht.art === "start" && (
          <StartPanel
            text={text}
            setText={setText}
            live={live}
            termine={termine}
            onSuchen={suchen}
            onHausarzt={() => { setHover(null); setAnsicht({ art: "praxen", z: zuordnungFuer("allgemein") }); }}
            onTermin={oeffneTermin}
            desktop={desktop}
          />
        )}
        {ansicht.art === "praxen" && (
          <PraxenPanel
            z={ansicht.z}
            text={text}
            liste={liste}
            sort={sort}
            setSort={setSort}
            hover={hover}
            setHover={setHover}
            onWahl={(id) => setAnsicht({ art: "weg", z: ansicht.z, praxisId: id })}
            onZurueck={zurStart}
            onAlternative={() => ansicht.z.alternative && setAnsicht({ art: "praxen", z: { ...ansicht.z, fach: ansicht.z.alternative, alternative: ansicht.z.fach } })}
            desktop={desktop}
          />
        )}
        {ansicht.art === "weg" && gewaehlt && plan && (
          <WegPanel
            p={gewaehlt}
            termin={termin}
            setTermin={setTermin}
            plan={plan}
            geteilt={!!ansicht.geteilt}
            onZurueck={zurueckAusWeg}
            onKalender={kalender}
            onTeilen={teilen}
            onBuchen={() => zeigeToast("Beispielpraxis: Im echten Betrieb öffnet sich hier die Terminseite der Praxis.")}
          />
        )}
      </aside>

      {desktop && (
        <div className="werkzeug glas">
          <button type="button" aria-label="Deine Termine" title="Deine Termine" onClick={() => { zurStart(); setText(""); }}><Kalender size={19} /></button>
          <a href="../" aria-label="Über Lotse" title="Über Lotse"><Info size={19} /></a>
        </div>
      )}
      <div className="kartenknoepfe">
        <button type="button" className="glas" aria-label="Zum Startpunkt" title="Startpunkt (Beispiel: Wetzlar Bahnhof)" onClick={() => window.dispatchEvent(new CustomEvent("lotse:start"))}><Standort size={18} /></button>
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
          text={text}
          onZurueck={() => setNotfall(null)}
          onWeiter={() => { setNotfall(null); setHover(null); setAnsicht({ art: "praxen", z: ordneZu(text) }); }}
        />
      )}

      <div className={`toast glas${toast ? " zeigen" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
