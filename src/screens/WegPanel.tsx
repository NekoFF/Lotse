import { useEffect } from "react";
import { adresse, osmLink, zeitenLesbar, type Modus, type PraxisMitZeit, type Start } from "../data/praxen";
import { alsEingabe, km, MODUS_NAME, PUFFER, tag, uhr, type Plan } from "../lib/plan";
import { Extern, Kalender, Teilen, Telefon, Zurueck } from "../ui/icons";
import { ModusWahl } from "./PraxenPanel";

export type WegStatus = "leer" | "laden" | "fehler" | "fertig";

interface Props {
  p: PraxisMitZeit | null;
  start: Start;
  termin: Date;
  setTermin: (d: Date) => void;
  modus: Modus;
  setModus: (m: Modus) => void;
  plan: Plan | null;
  wegStatus: WegStatus;
  fehler?: string;
  geteilt: boolean;
  onNeu: () => void;
  onZurueck: () => void;
  onKalender: () => void;
  onTeilen: () => void;
  onStartAendern: () => void;
}

export function WegPanel({ p, start, termin, setTermin, modus, setModus, plan, wegStatus, fehler, geteilt, onNeu, onZurueck, onKalender, onTeilen, onStartAendern }: Props) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === "Escape" && (e.target as HTMLElement).tagName !== "INPUT") onZurueck(); };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onZurueck]);

  if (!p) {
    return (
      <div className="panel-in weg">
        <div className="kopf-zurueck">
          <button type="button" className="rund" aria-label="Zurück" onClick={onZurueck}><Zurueck size={18} /></button>
          <div className="titel"><h1>{wegStatus === "fehler" ? "Praxis nicht geladen" : "Praxis wird geladen …"}</h1></div>
        </div>
        {wegStatus === "fehler" && (
          <div className="leer-box" role="alert"><span>{fehler}</span><button type="button" className="btn zweit" onClick={onNeu}>Erneut versuchen</button></div>
        )}
      </div>
    );
  }

  const vorbei = plan ? plan.los.getTime() < Date.now() : false;
  const zeiten = p.oeffnungszeiten ? zeitenLesbar(p.oeffnungszeiten) : null;

  return (
    <div className="panel-in weg">
      {geteilt && <div className="geteilt">Dieser Termin wurde mit dir geteilt. Dein eigener Weg ist geplant.</div>}
      <div className="kopf-zurueck">
        <button type="button" className="rund" aria-label={geteilt ? "Zur Startseite" : "Zurück zur Liste"} onClick={onZurueck}><Zurueck size={18} /></button>
        <div className="titel">
          <h1>{p.name}</h1>
          <span>{adresse(p) || "Adresse nicht eingetragen"}</span>
        </div>
      </div>

      <ModusWahl modus={modus} setModus={setModus} />

      <div className="abfahrt">
        <label className="termin-feld">
          <span>Termin</span>
          <input type="datetime-local" value={alsEingabe(termin)} onChange={(e) => { const d = new Date(e.target.value); if (!isNaN(d.getTime())) setTermin(d); }} />
        </label>
        {plan ? (
          <>
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
            <span className="klein-g">{tag(termin)} · {plan.min} Min {MODUS_NAME[plan.modus]} · {km(plan.km)} km</span>
          </>
        ) : (
          <span className="klein-g">Für diesen Weg {MODUS_NAME[modus]} gibt es gerade keine Berechnung. Wähle ein anderes Verkehrsmittel.</span>
        )}
      </div>

      <button type="button" className="start-zeile" onClick={onStartAendern}>
        <span>ab <b>{start.name}</b></span><span className="link">ändern</span>
      </button>

      {wegStatus === "laden" && <p className="fein">Weg wird auf der Karte eingezeichnet …</p>}
      {wegStatus === "fehler" && <p className="hinweis-fehler">{fehler} Die Fahrzeit oben stimmt trotzdem. <button type="button" className="link" onClick={onNeu}>Erneut versuchen</button></p>}

      <div className="planb">
        <span className="pb">PLAN B</span>
        {plan?.planb
          ? <span>{plan.planb.min} Min {MODUS_NAME[plan.planb.modus]}, dann los um <b className="mono">{uhr(plan.planb.los)}</b>. Auf der Karte gestrichelt.</span>
          : <span>Kein zweiter Weg berechnet.</span>}
      </div>

      <div className="infos">
        <div className="info-z">
          <span className="info-k">Öffnungszeiten</span>
          {zeiten ? <span className="info-w">{zeiten.map((z, i) => <span key={i}>{z}</span>)}</span> : <span className="info-w leise">Nicht eingetragen. Vor dem Besuch anrufen.</span>}
        </div>
        <div className="info-z">
          <span className="info-k">Zugang</span>
          <span className={`info-w${p.rollstuhl ? "" : " leise"}`}>{p.rollstuhl === "yes" ? "rollstuhlgerecht" : p.rollstuhl === "limited" ? "teilweise rollstuhlgerecht" : p.rollstuhl === "no" ? "nicht rollstuhlgerecht" : "Keine Angabe"}</span>
        </div>
      </div>

      <div className="aktionen">
        {p.website ? (
          <a className="btn primaer" href={p.website} target="_blank" rel="noopener noreferrer">Website der Praxis <Extern size={17} /></a>
        ) : p.telefon ? (
          <a className="btn primaer" href={`tel:${p.telefon.replace(/[^\d+]/g, "")}`}><Telefon size={17} /> {p.telefon}</a>
        ) : (
          <div className="leer-box klein">
            <span>Weder Website noch Telefon sind in OpenStreetMap eingetragen.</span>
            <a href={osmLink(p)} target="_blank" rel="noopener noreferrer">Eintrag auf OpenStreetMap ansehen</a>
          </div>
        )}
        {p.website && p.telefon && <a className="btn zweit" href={`tel:${p.telefon.replace(/[^\d+]/g, "")}`}><Telefon size={17} /> {p.telefon}</a>}
        <div className="zwei">
          <button type="button" className="btn zweit" onClick={onKalender} disabled={!plan}><Kalender size={17} /> In Kalender</button>
          <button type="button" className="btn zweit" onClick={onTeilen}><Teilen size={17} /> Begleitung</button>
        </div>
      </div>
      <p className="fein">Praxisdaten: © OpenStreetMap-Mitwirkende, <a href={osmLink(p)} target="_blank" rel="noopener noreferrer">Eintrag</a>. Wege: OSRM (FOSSGIS). Termine bucht man direkt bei der Praxis.</p>
    </div>
  );
}
