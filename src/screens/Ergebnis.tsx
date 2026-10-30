import type { Zuordnung } from "../core/match";
import type { Fachrichtung } from "../data/fachrichtungen";
import { NavBar } from "../ui/bars";
import { Shield } from "../ui/icons";

export function Ergebnis({ z, onBack, onPraxen, anim }: {
  z: Zuordnung;
  onBack: () => void;
  onPraxen: (f: Fachrichtung) => void;
  anim: string;
}) {
  return (
    <>
      <NavBar title="Zuständig" backLabel="Anliegen" onBack={onBack} />
      <main className={`screen has-nav ${anim}`}>
        <section className="result-hero">
          <div className="t-cap">{z.unsicher ? "Erster Anlaufpunkt" : "Zuständige Fachrichtung"}</div>
          <h1 className="result-name">{z.fach.name}</h1>
          {z.erkannt.length > 0 && (
            <div className="tags" aria-label="Erkannt in deiner Beschreibung">
              {z.erkannt.map((w) => <span key={w} className="tag">{w}</span>)}
            </div>
          )}
        </section>

        <div className="why">{z.fach.zustaendig}</div>

        {z.unsicher && (
          <div className="unsure">
            {z.erkannt.length === 0
              ? "Aus deiner Beschreibung lässt sich keine Fachrichtung sicher ableiten. Die Hausarztpraxis ist dann der richtige erste Schritt."
              : "Deine Beschreibung passt zu mehreren Fachrichtungen. Die Hausarztpraxis hilft dir, den richtigen Weg zu finden."}
          </div>
        )}

        <div className="note"><Shield /><span>Lotse ordnet dein Anliegen einer Fachrichtung zu und stellt keine Diagnose. Es ersetzt keine ärztliche Beratung.</span></div>

        <div style={{ marginTop: 26, display: "grid", gap: 10 }}>
          <button className="btn btn-primary" onClick={() => onPraxen(z.fach)}>Praxen in der Nähe</button>
          {z.alternative && (
            <button className="btn btn-tinted" onClick={() => onPraxen(z.alternative!)}>
              Praxen für {z.alternative.name}
            </button>
          )}
        </div>
      </main>
    </>
  );
}
