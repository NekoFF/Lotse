import { useEffect, useRef } from "react";
import { DIENSTE, NOMINATIM_MAX } from "../config";
import type { Zuordnung } from "../core/match";
import { adresse, minuten, type Modus, type PraxisMitZeit, type Start } from "../data/praxen";
import { km, MODUS_KURZ, MODUS_NAME } from "../lib/plan";
import { Extern, Zurueck } from "../ui/icons";

export type Sortierung = "zeit" | "naehe" | "rollstuhl";
export type SuchStatus = "laden" | "fehler" | "leer" | "fertig";

interface Props {
  z: Zuordnung;
  text: string;
  start: Start;
  status: SuchStatus;
  fehler?: string;
  zeitFehler: string | null;
  liste: PraxisMitZeit[];
  gesamt: number;
  /** so viele Praxen dieser Fachrichtung hat die Suche gefunden (vor Kürzung auf die nächsten) */
  gefunden: number;
  gekappt: boolean;
  modus: Modus;
  setModus: (m: Modus) => void;
  sort: Sortierung;
  setSort: (s: Sortierung) => void;
  radius: number;
  kannErweitern: boolean;
  onErweitern: () => void;
  onNeu: () => void;
  hover: string | null;
  setHover: (id: string | null) => void;
  onWahl: (id: string) => void;
  onZurueck: () => void;
  onStartAendern: () => void;
  onHausarzt: () => void;
  onAlternative: () => void;
  desktop: boolean;
}

export function ModusWahl({ modus, setModus }: { modus: Modus; setModus: (m: Modus) => void }) {
  return (
    <div className="segment vier" role="tablist" aria-label="Verkehrsmittel">
      {(["fuss", "rad", "auto"] as Modus[]).map((m) => (
        <button key={m} type="button" role="tab" aria-selected={modus === m} className={modus === m ? "an" : ""} onClick={() => setModus(m)}>{MODUS_KURZ[m]}</button>
      ))}
      <button type="button" role="tab" aria-selected={false} disabled title="Fahrplandaten werden noch angebunden">Bus <span className="bald">folgt</span></button>
    </div>
  );
}

const rollstuhlText = (r: string | null) => (r === "yes" ? "rollstuhlgerecht" : r === "limited" ? "teilweise rollstuhlgerecht" : null);

export function PraxenPanel(props: Props) {
  const { z, text, start, status, fehler, zeitFehler, liste, gesamt, gefunden, gekappt, modus, setModus, sort, setSort, radius, kannErweitern, onErweitern, onNeu, hover, setHover, onWahl, onZurueck, onStartAendern, onHausarzt, onAlternative, desktop } = props;
  const listeRef = useRef<HTMLDivElement>(null);
  const modusFehlt = !!liste[0]?.nichtAbrufbar?.includes(modus);
  const modusLaedt = !!liste[0]?.ausstehend?.includes(modus);

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      const i = liste.findIndex((p) => p.id === hover);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = e.key === "ArrowDown" ? Math.min(liste.length - 1, i + 1) : Math.max(0, i - 1);
        setHover(liste[n]?.id ?? null);
        listeRef.current?.querySelectorAll<HTMLButtonElement>(".karte-p")[n]?.focus();
      } else if (e.key === "Escape") onZurueck();
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [liste, hover, setHover, onZurueck]);

  return (
    <div className="panel-in praxen">
      <div className="kopf-zurueck">
        <button type="button" className="rund" aria-label="Zurück zur Eingabe" onClick={onZurueck}><Zurueck size={18} /></button>
        <div className="titel">
          <h1>{z.fach.name}</h1>
          <span>{text ? `„${text}“` : "für fast alles der erste Anlaufpunkt"}</span>
        </div>
      </div>

      <button type="button" className="start-zeile" onClick={onStartAendern}>
        <span>ab <b>{start.name}</b></span><span className="link">ändern</span>
      </button>

      {z.alternative && (
        <button type="button" className="hinweis-zeile" onClick={onAlternative}>Auch möglich: <b>{z.alternative.name}</b></button>
      )}

      <ModusWahl modus={modus} setModus={setModus} />

      {status === "laden" && (
        <div className="liste" aria-busy="true" aria-label="Praxen werden gesucht">
          {[0, 1, 2].map((i) => <div key={i} className="karte-p skelett"><span /><span /></div>)}
          <p className="fein">Suche {z.fach.name}-Praxen im Umkreis von {radius} km und berechne echte Wege …</p>
        </div>
      )}

      {status === "fehler" && (
        <div className="leer-box" role="alert">
          <b>Praxisdaten gerade nicht erreichbar.</b>
          <span>{fehler}</span>
          <button type="button" className="btn zweit" onClick={onNeu}>Erneut versuchen</button>
        </div>
      )}

      {status === "leer" && (
        <div className="leer-box">
          <b>Keine {z.fach.name}-Praxis im Umkreis von {radius} km gefunden.</b>
          {gekappt
            ? <span>Der Suchdienst liefert höchstens {NOMINATIM_MAX} Arzt- bzw. Zahnarztpraxen aller Fachrichtungen pro Suche, und diese Grenze war erreicht. Es kann hier also trotzdem {z.fach.name}-Praxen geben.</span>
            : <span>Lotse zeigt nur Praxen, die in OpenStreetMap mit Fachrichtung eingetragen sind. Fehlt eine, ist sie dort (noch) nicht so eingetragen.</span>}
          {kannErweitern && <button type="button" className="btn zweit" onClick={onErweitern}>Umkreis erweitern</button>}
          <a className="btn zweit" href={DIENSTE.arztsuche} target="_blank" rel="noopener noreferrer">Offizielle Arztsuche 116117 <Extern size={16} /></a>
          {z.fach.id !== "allgemein" && <button type="button" className="link" onClick={onHausarzt}>Hausarztpraxen zeigen</button>}
        </div>
      )}

      {status === "fertig" && (
        <>
          {zeitFehler && <p className="hinweis-fehler" role="status">Fahrzeiten gerade nicht abrufbar ({zeitFehler}) Sortiert nach Luftlinie. <button type="button" className="link" onClick={onNeu}>Erneut versuchen</button></p>}
          <div className="segment" role="tablist" aria-label="Sortierung">
            {([["zeit", "Schnellste"], ["naehe", "Nächste"], ["rollstuhl", "Rollstuhl"]] as const).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={sort === k} className={sort === k ? "an" : ""} onClick={() => setSort(k)}>{l}</button>
            ))}
          </div>
          {!zeitFehler && modusFehlt && <p className="hinweis-fehler" role="status">Fahrzeiten {MODUS_NAME[modus]} gerade nicht abrufbar. Sortiert nach Luftlinie. <button type="button" className="link" onClick={onNeu}>Erneut versuchen</button></p>}
          <span className="unterzeile">{liste.length} von {gesamt} Praxen{gefunden > gesamt ? ` (die ${gesamt} nächsten von ${gefunden})` : ""} · {modusLaedt ? `Fahrzeiten ${MODUS_NAME[modus]} werden berechnet …` : sort === "naehe" || modusFehlt || zeitFehler ? "nach Luftlinie" : `nach Fahrzeit ${MODUS_NAME[modus]}`} · Umkreis {radius} km</span>

          <div className="liste" ref={listeRef}>
            {liste.map((p, i) => {
              const min = minuten(p, modus);
              const r = rollstuhlText(p.rollstuhl);
              return (
                <button key={p.id} type="button" className={`karte-p${hover === p.id || (!hover && i === 0) ? " an" : ""}`}
                  onMouseEnter={() => setHover(p.id)} onFocus={() => setHover(p.id)} onClick={() => onWahl(p.id)}>
                  <span className="kp-l">
                    <b>{p.name}</b>
                    <span className="adr">{adresse(p) || "Adresse nicht eingetragen"} · {km(p.entfernung)} km Luftlinie</span>
                    {r && <span className="marke-r">{r}</span>}
                  </span>
                  <span className="kp-r">
                    {min !== null ? <><b className="mono">{min}</b><span>Min</span></>
                      : p.ausstehend?.includes(modus) ? <><b className="mono">…</b><span>lädt</span></>
                      : p.nichtAbrufbar?.includes(modus) ? <><b className="mono">–</b><span>nicht verfügbar</span></>
                      : <><b className="mono">–</b><span>keine Route</span></>}
                  </span>
                </button>
              );
            })}
            {liste.length === 0 && <p className="fein">Keine Praxis in dieser Auswahl ist in OpenStreetMap als rollstuhlgerecht eingetragen.</p>}
            {gekappt && <p className="fein">Der Suchdienst liefert höchstens {NOMINATIM_MAX} Treffer pro Suche. Es kann weitere, auch näher gelegene Praxen geben.</p>}
            {kannErweitern && <button type="button" className="link mehr" onClick={onErweitern}>Größeren Umkreis durchsuchen</button>}
          </div>
        </>
      )}

      {desktop && status === "fertig" && (
        <div className="tasten">
          <span><span className="kbd">↑</span><span className="kbd">↓</span> wählen</span>
          <span><span className="kbd">↵</span> öffnen</span>
          <span><span className="kbd">esc</span> zurück</span>
        </div>
      )}
      <p className="fein">
        Praxen: <a href={DIENSTE.osmLizenz} target="_blank" rel="noopener noreferrer">© OpenStreetMap-Mitwirkende</a> ·
        Wege: <a href={DIENSTE.routingInfo} target="_blank" rel="noopener noreferrer">OSRM (FOSSGIS)</a>, ohne aktuelle Verkehrslage ·
        {" "}<a href={DIENSTE.osmFehlerMelden} target="_blank" rel="noopener noreferrer">Fehler melden</a> · Bus und Bahn werden noch angebunden.
      </p>
    </div>
  );
}
