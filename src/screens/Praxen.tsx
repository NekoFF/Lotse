import { useMemo, useState } from "react";
import type { Fachrichtung } from "../data/fachrichtungen";
import { praxenFuer, type Praxis } from "../data/praxen";
import { NavBar } from "../ui/bars";
import { ChevronRight } from "../ui/icons";

export function Praxen({ fach, onBack, onOpen, anim }: {
  fach: Fachrichtung;
  onBack: () => void;
  onOpen: (p: Praxis) => void;
  anim: string;
}) {
  const [sort, setSort] = useState<"zeit" | "km">("zeit");
  const liste = useMemo(() => {
    const p = praxenFuer(fach.id);
    return [...p].sort((a, b) => (sort === "zeit" ? a.fahrzeit - b.fahrzeit : a.entfernung - b.entfernung));
  }, [fach.id, sort]);
  const schnellste = useMemo(() => Math.min(...praxenFuer(fach.id).map((p) => p.fahrzeit)), [fach.id]);

  return (
    <>
      <NavBar title={fach.name} backLabel="Zurück" onBack={onBack} />
      <main className={`screen has-nav ${anim}`}>
        <h1 className="t-title2" style={{ marginTop: 10 }}>{fach.name}</h1>
        <p className="t-sub" style={{ marginTop: 2 }}>ab Wetzlar Bahnhof · mit Bus und Bahn</p>

        <div className="segmented" role="group" aria-label="Sortierung">
          <button aria-pressed={sort === "zeit"} onClick={() => setSort("zeit")}>Nach Fahrzeit</button>
          <button aria-pressed={sort === "km"} onClick={() => setSort("km")}>Nach Entfernung</button>
        </div>

        <div className="section-head t-cap" style={{ marginTop: 22 }}>{liste.length} Praxen</div>
        <div className="group">
          {liste.map((p) => (
            <button key={p.id} className={`cell p-cell ${p.fahrzeit === schnellste ? "best" : ""}`} onClick={() => onOpen(p)}>
              <div className="cell-main">
                <div className="cell-title">
                  {p.name}
                  {p.fahrzeit === schnellste && <span className="badge">am schnellsten</span>}
                </div>
                <div className="cell-sub">{p.ort} · {p.verbindung}</div>
              </div>
              <div className="time">
                <b>{p.fahrzeit} Min</b>
                <span className="mono">{p.entfernung.toLocaleString("de-DE")} km</span>
              </div>
              <ChevronRight />
            </button>
          ))}
        </div>
        <p className="section-foot t-foot">
          {sort === "km"
            ? "Nach Luftlinie sortiert. Die nächste Praxis ist nicht immer die, die du am schnellsten erreichst."
            : "Beispieldaten im Prototyp. Praxen und Fahrzeiten sind erfunden und werden durch echte Daten ersetzt."}
        </p>
      </main>
    </>
  );
}
