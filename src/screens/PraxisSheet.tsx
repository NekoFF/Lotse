import type { Praxis } from "../data/praxen";
import { Close } from "../ui/icons";

const PUFFER = 10;
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function PraxisSheet({ p, onClose }: { p: Praxis; onClose: () => void }) {
  const termin = 9 * 60;
  const los = termin - p.fahrzeit - PUFFER;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <section className="sheet" role="dialog" aria-modal="true" aria-label={p.name}>
        <div className="grabber" />
        <div className="sheet-head">
          <div>
            <h2 className="t-title2">{p.name}</h2>
            <p className="t-sub" style={{ marginTop: 2 }}>{p.strasse}, {p.ort}</p>
          </div>
          <button className="close" onClick={onClose} aria-label="Schließen"><Close /></button>
        </div>

        <div className="depart">
          <div>
            <div className="t-cap">Bei Termin um 09:00</div>
            <div className="big">{hm(los)}</div>
            <div className="t-foot" style={{ marginTop: 4 }}>losgehen</div>
          </div>
          <div className="route-line" style={{ minWidth: 0 }}>
            <div className="stop">Wetzlar Bahnhof</div>
            <div className="stop">{p.verbindung}</div>
            <div className="stop">an {hm(los + p.fahrzeit)}, {PUFFER} Min Puffer</div>
          </div>
        </div>

        <div className="section-head t-cap">Praxis</div>
        <div className="group">
          <div className="cell"><div className="cell-main"><div className="cell-title">Fahrzeit</div></div><div className="cell-value mono">{p.fahrzeit} Min</div></div>
          <div className="cell"><div className="cell-main"><div className="cell-title">Sprechzeiten</div><div className="cell-sub">{p.sprechzeiten}</div></div></div>
          <div className="cell"><div className="cell-main"><div className="cell-title">Barrierefrei</div></div><div className="cell-value">{p.barrierefrei ? "Ja" : "Keine Angabe"}</div></div>
        </div>

        <div style={{ marginTop: 22, display: "grid", gap: 10 }}>
          <button className="btn btn-primary" disabled>Termin bei der Praxis vereinbaren</button>
          <button className="btn btn-tinted" disabled>Termin im Kalender eintragen</button>
        </div>
        <p className="t-foot" style={{ marginTop: 12, textAlign: "center" }}>
          Beispieldaten. Die Terminvergabe führt später direkt zur Praxis, der Kalender folgt in Etappe 3.
        </p>
      </section>
    </>
  );
}
