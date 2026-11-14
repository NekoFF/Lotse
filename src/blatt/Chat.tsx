import { useEffect, useRef } from "react";
import { luftlinie, type LngLat } from "../data/praxen";
import type { Ort } from "../services/orte";
import { Ki, Schliessen } from "../ui/icons";

export interface Nachricht {
  id: number;
  von: "ich" | "ki";
  text?: string;
  /** Ergebnis als Liste statt als Gerede */
  orte?: Ort[];
  /** true = die KI hat die Anfrage gedeutet (Symbol ✦ „überlegt“) */
  gedeutet?: boolean;
  denkt?: boolean;
  knopf?: "ki-laden";
}

const km = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);

/** Chatverlauf über der Suchleiste: eigene Nachrichten rechts, Lotse links – kurz, Ergebnisse als Liste */
export function ChatVerlauf({ nachrichten, bezug, onOrt, onKi, onZu }: {
  nachrichten: Nachricht[]; bezug: LngLat; onOrt: (o: Ort) => void; onKi: () => void; onZu: () => void;
}) {
  const ende = useRef<HTMLDivElement>(null);
  useEffect(() => { ende.current?.scrollIntoView({ block: "end" }); }, [nachrichten]);
  return (
    <div className="chat">
      <div className="chat-kopf">
        <span><Ki size={14} /> Lotse</span>
        <button type="button" className="rund klein" aria-label="Chat schließen" onClick={onZu}><Schliessen size={14} /></button>
      </div>
      <div className="chat-verlauf" role="log" aria-live="polite">
        {nachrichten.map((n) => (
          <div key={n.id} className={`blase ${n.von}${n.orte ? " mit-liste" : ""}`}>
            {n.denkt ? <span className="denkt" aria-label="überlegt"><i /><i /><i /></span> : (
              <>
                {n.text && <p>{n.gedeutet && <Ki size={13} />} {n.text}</p>}
                {n.knopf === "ki-laden" && <button type="button" className="btn zweit klein-btn" onClick={onKi}><Ki size={15} /> KI einschalten</button>}
                {n.orte && n.orte.length > 0 && (
                  <div className="zeilen">
                    {n.orte.slice(0, 6).map((o) => (
                      <button key={o.id} type="button" className="zeile" onClick={() => onOrt(o)}>
                        <span className="zeile-t"><b>{o.name}</b><span>{o.art}{o.adresse ? ` · ${o.adresse}` : ""}</span></span>
                        <span className="zeile-r">{km(luftlinie(bezug, o.lngLat) * 1000)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {n.orte && n.orte.length === 0 && <p className="leise">Nichts gefunden.</p>}
              </>
            )}
          </div>
        ))}
        <div ref={ende} />
      </div>
    </div>
  );
}
