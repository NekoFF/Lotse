import { useEffect, useRef } from "react";
import type { Zuordnung } from "../core/match";
import type { SicherheitsErgebnis } from "../core/safety";
import { praxenFuer } from "../data/praxen";
import { tag, uhr, type Gemerkt } from "../lib/plan";
import { Marke, Pfeil, Schliessen, Suche, Telefon, Weiter } from "../ui/icons";

const BEISPIELE = ["Zahn abgebrochen", "Ausschlag am Arm", "Ohr tut seit gestern weh", "Rücken nach dem Heben"];

interface Props {
  text: string;
  setText: (t: string) => void;
  live: { z: Zuordnung; s: SicherheitsErgebnis } | null;
  termine: Gemerkt[];
  onSuchen: () => void;
  onHausarzt: () => void;
  onTermin: (t: Gemerkt) => void;
  desktop: boolean;
}

export function StartPanel({ text, setText, live, termine, onSuchen, onHausarzt, onTermin, desktop }: Props) {
  const feld = useRef<HTMLInputElement>(null);

  // "/" springt ins Eingabefeld (Computer)
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/INPUT|TEXTAREA/.test(t.tagName)) { e.preventDefault(); feld.current?.focus(); }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);

  const notfall = live?.s.stufe ?? null;
  const z = live?.z;
  const anzahl = z ? praxenFuer(z.fach.id).length : 0;
  const leer = text.trim().length < 3;

  return (
    <div className="panel-in start">
      <div className="kopf">
        <span className="brand"><Marke />Lotse</span>
        <span className="hinweis">Wegweiser, keine Diagnose</span>
      </div>

      <h1 className="gross">Was ist los?</h1>

      <form className="feld-form" onSubmit={(e) => { e.preventDefault(); if (!leer) onSuchen(); }}>
        <label className={`feld${text ? " aktiv" : ""}`}>
          <Suche size={19} />
          <span className="sr">Anliegen in eigenen Worten</span>
          <input
            ref={feld}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={desktop ? "In eigenen Worten beschreiben" : "In eigenen Worten, z. B. Knie tut weh"}
            autoComplete="off"
            enterKeyHint="search"
            onKeyDown={(e) => { if (e.key === "Escape") setText(""); }}
          />
          {text ? (
            <button type="button" className="feld-x" aria-label="Eingabe löschen" onClick={() => { setText(""); feld.current?.focus(); }}><Schliessen size={15} /></button>
          ) : desktop ? <span className="kbd">/</span> : null}
        </label>
      </form>

      {leer && (
        <>
          <div className="chips">
            {BEISPIELE.map((b) => <button key={b} type="button" className="chip" onClick={() => setText(b)}>{b}</button>)}
          </div>
          {termine.length > 0 && (
            <div className="termine">
              <h2 className="klein">Deine Termine</h2>
              {termine.slice(0, 3).map((t) => {
                const d = new Date(t.termin);
                return (
                  <button key={t.praxisId + t.termin} type="button" className="termin" onClick={() => onTermin(t)}>
                    <span className="datum"><span>{d.toLocaleDateString("de-DE", { weekday: "short" }).toUpperCase().replace(".", "")}</span><b className="mono">{d.getDate()}</b></span>
                    <span className="termin-t"><b>{t.name}</b><span>{tag(d)} · {uhr(d)} · los <span className="mono akzent">{uhr(new Date(t.los))}</span></span></span>
                    <Weiter size={16} />
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {!leer && notfall && (
        <div className="live notfall" role="alert">
          <span className="klein-l">Achtung</span>
          <b>Das klingt nach einem Notfall.</b>
          <span>Lotse sucht dafür keine Praxis.</span>
          <button type="button" className="btn rot" onClick={onSuchen}>Hilfe anzeigen <Pfeil size={17} /></button>
        </div>
      )}

      {!leer && !notfall && z && !z.unsicher && (
        <>
          <div className="live" aria-live="polite">
            <div className="live-kopf"><span>Passt zu</span><span>live beim Tippen</span></div>
            <b className="fach">{z.fach.name}</b>
            <p>{z.fach.zustaendig}</p>
            <div className="erkannt"><span>Erkannt:</span>{z.erkannt.map((w) => <span key={w} className="mono wort">{w}</span>)}</div>
          </div>
          <button type="button" className="btn primaer" onClick={onSuchen}>
            {anzahl} Praxen in der Nähe {desktop ? <span className="kbd hell">↵</span> : <Pfeil size={18} />}
          </button>
          <p className="fein mitte">Nicht sicher? Eine <button type="button" className="link" onClick={onHausarzt}>Hausarztpraxis</button> passt immer. Lotse ordnet nur zu und stellt keine Diagnose.</p>
        </>
      )}

      {!leer && !notfall && z?.unsicher && (
        <div className="live neutral">
          <b>Noch nichts Eindeutiges erkannt.</b>
          <span>Schreib, wo es weh tut oder was dich stört. Oder geh zuerst zur Hausarztpraxis, sie ist für fast alles der erste Anlaufpunkt.</span>
          <button type="button" className="btn zweit" onClick={onHausarzt}>Hausarztpraxis zeigen</button>
        </div>
      )}

      <div className="fuss">
        <span><Telefon size={15} className="rot-t" /> Akuter Notfall: <a href="tel:112" className="rot-t stark">112</a> · Bereitschaftsdienst <a href="tel:116117">116 117</a></span>
        {desktop && <span className="fein">Eingaben bleiben auf diesem Gerät.</span>}
      </div>
    </div>
  );
}
