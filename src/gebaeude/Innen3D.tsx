import { Schliessen } from "../ui/icons";
import { HUELLE_QUELLE } from "./karte";
import type { Gebaeude } from "./modell";
import { zoneAusFeature } from "./drei";
import "./innen.css";

/** Steuerung für das Schulgebäude in 3D auf der Karte: Etage wählen, Bereich anzeigen, zurück zum Plan */
export function Innen3D({ gebaeude, ebene, zone, onEbene, onPlan, onZu }: {
  gebaeude: Gebaeude; ebene: number; zone: string | null;
  onEbene: (e: number) => void; onPlan: () => void; onZu: () => void;
}) {
  const etage = gebaeude.etagen.find((e) => e.ebene === ebene)!;
  const z = zoneAusFeature(gebaeude, ebene, zone ?? undefined);
  return (
    <div className="innen3d" aria-label="Schulgebäude in 3D">
      <div className="innen3d-kopf">
        <div>
          <b>{z?.name ?? gebaeude.name}</b>
          <span>{etage.name}{z?.nummern?.length ? ` · ${z.nummern.join(", ")}` : " · Bereich antippen"}</span>
        </div>
        <button type="button" className="innen-ansicht" onClick={onPlan}>Plan</button>
        <button type="button" className="rund" aria-label="3D schließen" onClick={onZu}><Schliessen size={15} /></button>
      </div>
      <div className="innen-etagen" role="radiogroup" aria-label="Etage">
        {[...gebaeude.etagen].reverse().map((e) => (
          <button key={e.id} type="button" role="radio" aria-checked={e.ebene === ebene} aria-label={e.name}
            className={e.ebene === ebene ? "an" : ""} onClick={() => onEbene(e.ebene)}>{e.kurz}</button>
        ))}
      </div>
      <div className="innen3d-quelle">{HUELLE_QUELLE}</div>
    </div>
  );
}
