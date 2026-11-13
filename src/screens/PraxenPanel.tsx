import { useEffect, useRef } from "react";
import type { Zuordnung } from "../core/match";
import type { Praxis } from "../data/praxen";
import { miniRoute } from "../lib/plan";
import { Gehen, Zurueck } from "../ui/icons";

export type Sortierung = "zeit" | "naehe" | "barrierefrei";

interface Props {
  z: Zuordnung;
  text: string;
  liste: Praxis[];
  sort: Sortierung;
  setSort: (s: Sortierung) => void;
  hover: string | null;
  setHover: (id: string | null) => void;
  onWahl: (id: string) => void;
  onZurueck: () => void;
  onAlternative: () => void;
  desktop: boolean;
}

export function PraxenPanel({ z, text, liste, sort, setSort, hover, setHover, onWahl, onZurueck, onAlternative, desktop }: Props) {
  const listeRef = useRef<HTMLDivElement>(null);

  // Pfeiltasten wählen, Enter öffnet, Esc zurück (Computer)
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

      {z.alternative && (
        <button type="button" className="hinweis-zeile" onClick={onAlternative}>
          Auch möglich: <b>{z.alternative.name}</b>
        </button>
      )}

      <div className="segment" role="tablist" aria-label="Sortierung">
        {([["zeit", "Schnellste"], ["naehe", "Nächste"], ["barrierefrei", "Barrierefrei"]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={sort === k} className={sort === k ? "an" : ""} onClick={() => setSort(k)}>{l}</button>
        ))}
      </div>

      <span className="unterzeile">{liste.length} Praxen · {sort === "naehe" ? "nach Luftlinie" : "nach Fahrzeit"} ab Wetzlar Bahnhof</span>

      <div className="liste" ref={listeRef}>
        {liste.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className={`karte-p${hover === p.id || (!hover && i === 0) ? " an" : ""}`}
            onMouseEnter={() => setHover(p.id)}
            onFocus={() => setHover(p.id)}
            onClick={() => onWahl(p.id)}
          >
            <span className="kp-l">
              <b>{p.name}</b>
              <span className="adr">{p.strasse}, {p.ort} · {String(p.entfernung).replace(".", ",")} km{p.barrierefrei ? " · barrierefrei" : ""}</span>
              <span className="mini">
                {miniRoute(p).map((s, k) => (
                  <span key={k} className="mini-teil">
                    {k > 0 && <span className="pfeil">›</span>}
                    {s.art === "fuss" ? <span className="geh"><Gehen size={14} /><span className="mono">{s.text}</span></span> : <span className={`linie ${s.text.startsWith("RB") || s.text.startsWith("S") ? "bahn" : ""}`}>{s.text}</span>}
                  </span>
                ))}
              </span>
            </span>
            <span className="kp-r"><b className="mono">{p.fahrzeit}</b><span>Min</span></span>
          </button>
        ))}
        {liste.length === 0 && <p className="fein">Keine barrierefreie Praxis in den Beispieldaten.</p>}
      </div>

      {desktop && (
        <div className="tasten">
          <span><span className="kbd">↑</span><span className="kbd">↓</span> wählen</span>
          <span><span className="kbd">↵</span> öffnen</span>
          <span><span className="kbd">esc</span> zurück</span>
        </div>
      )}
      <p className="fein">Beispieldaten: Praxen erfunden, Straßen echt. Fahrzeiten mit Bus geschätzt.</p>
    </div>
  );
}
