import { useEffect } from "react";
import type { Praxis } from "../data/praxen";
import { alsEingabe, PUFFER, tag, uhr, type Plan } from "../lib/plan";
import { Bus, Extern, Gehen, Kalender, Teilen, Zurueck } from "../ui/icons";

interface Props {
  p: Praxis;
  termin: Date;
  setTermin: (d: Date) => void;
  plan: Plan;
  geteilt: boolean;
  onZurueck: () => void;
  onKalender: () => void;
  onTeilen: () => void;
  onBuchen: () => void;
}

export function WegPanel({ p, termin, setTermin, plan, geteilt, onZurueck, onKalender, onTeilen, onBuchen }: Props) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === "Escape" && (e.target as HTMLElement).tagName !== "INPUT") onZurueck(); };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onZurueck]);

  const mehr = p.planb ? Math.max(1, Math.round((p.planb.s - p.weg.s) / 60)) : 0;
  const vorbei = plan.los.getTime() < Date.now();

  return (
    <div className="panel-in weg">
      {geteilt && <div className="geteilt">Dieser Termin wurde mit dir geteilt. Dein Weg ist schon geplant.</div>}
      <div className="kopf-zurueck">
        <button type="button" className="rund" aria-label={geteilt ? "Zur Startseite" : "Zurück zur Liste"} onClick={onZurueck}><Zurueck size={18} /></button>
        <div className="titel">
          <h1>{p.name}</h1>
          <span>{p.strasse}, {p.ort}{p.barrierefrei ? " · barrierefrei" : ""}</span>
        </div>
      </div>

      <div className="abfahrt">
        <label className="termin-feld">
          <span>Termin</span>
          <input
            type="datetime-local"
            value={alsEingabe(termin)}
            onChange={(e) => { const d = new Date(e.target.value); if (!isNaN(d.getTime())) setTermin(d); }}
          />
        </label>
        <div className="los-zeile">
          <div>
            <span className="klein-g">{vorbei ? "Hättest losgehen müssen um" : "Losgehen um"}</span>
            <b className="los mono">{uhr(plan.los)}</b>
          </div>
          <div className="rechts">
            <b>an <span className="mono">{uhr(plan.an)}</span></b>
            <span>{PUFFER} Min Puffer</span>
          </div>
        </div>
        <span className="klein-g">{tag(termin)} · {p.fahrzeit} Min unterwegs</span>
      </div>

      <ol className="schritte">
        {plan.schritte.map((s, i) => (
          <li key={i}>
            <span className="mono zeit">{uhr(s.zeit)}</span>
            <span className={`punkt ${s.art}`}>{s.art === "fuss" ? <Gehen size={15} /> : <Bus size={15} />}</span>
            <span className="s-t"><b>{s.titel}</b><span>{s.detail}</span></span>
          </li>
        ))}
      </ol>

      <div className="planb">
        <span className="pb">PLAN B</span>
        {plan.linie && p.planb && <span>Fällt {plan.linie} aus, nimmt Lotse den Ausweichweg: etwa <b>{mehr} Min länger</b>, auf der Karte gestrichelt.</span>}
        {plan.linie && !p.planb && <span>Fällt {plan.linie} aus, kommt die nächste Fahrt. Mit echten Fahrplandaten rechnet Lotse sie vorab mit.</span>}
        {!plan.linie && <span>Zu Fuß bist du unabhängig vom Fahrplan. Kein zweiter Weg nötig.</span>}
      </div>

      <div className="aktionen">
        <button type="button" className="btn primaer" onClick={onBuchen}>Bei der Praxis buchen <Extern size={17} /></button>
        <div className="zwei">
          <button type="button" className="btn zweit" onClick={onKalender}><Kalender size={17} /> In Kalender</button>
          <button type="button" className="btn zweit" onClick={onTeilen}><Teilen size={17} /> Begleitung</button>
        </div>
      </div>
      <p className="fein">Beispieldaten: Praxis erfunden, Weg echt berechnet. Busfahrzeiten geschätzt.</p>
    </div>
  );
}
