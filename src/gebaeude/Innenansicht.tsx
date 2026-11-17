import { useMemo, useState } from "react";
import { Schliessen, Suche } from "../ui/icons";
import { grenzen, raumFinden, ringePfad, textPlatz, umrissKanten, zonenFlaeche, type Etage, type Gebaeude, type Rechteck, type Zone } from "./modell";
import "./innen.css";

const ART_NAME: Record<Zone["art"], string> = {
  raeume: "Räume", flur: "Flur", treppe: "Treppe", wc: "WC", eingang: "Eingang", hof: "Innenhof",
  luftraum: "offen (Luftraum)", terrasse: "Terrasse", nebengebaeude: "Nebengebäude",
};
const RAND = 4;
/** Schräge des Orientierungsplans im Flur (aus der Markierung gemessen): x verschiebt sich um 0,556 × y */
const SCHRAEG = 0.556;
const n = ([a, b, c, d]: Rechteck): Rechteck => [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)];

/** Form einer Zone: Rechtecke und/oder Vielecke */
function Form({ z }: { z: Zone }) {
  return (
    <>
      {z.flaechen.map((f, i) => { const [a, b, c, d] = n(f); return <rect key={i} x={a} y={b} width={c - a} height={d - b} />; })}
      {z.ringe && <path d={ringePfad(z.ringe)} fillRule="evenodd" />}
    </>
  );
}

/**
 * Innenansicht: ein Plan je Etage, alle Etagen im selben Raster (übereinander wie im echten Gebäude).
 * Die Etage darunter schimmert durch, damit man die Lage versteht.
 */
export function Innenansicht({ gebaeude, raum, onZu, on3D }: { gebaeude: Gebaeude; raum?: string; onZu: () => void; /** 3D auf der Karte, mit Etage und gewähltem Bereich */ on3D?: (ebene: number, zone: string | null) => void }) {
  const start = raum ? raumFinden(gebaeude, raum) : null;
  const [ebene, setEbene] = useState(start?.etage.ebene ?? 0);
  const [suche, setSuche] = useState(raum ?? "");
  const [ziel, setZiel] = useState(start);
  const [wahl, setWahl] = useState<Zone | null>(start?.zone ?? null);
  const [fehler, setFehler] = useState<string | null>(null);
  /** „wie das Schild“: dieselben Daten, schräg gezeichnet wie der Plan im Flur */
  const [schild, setSchild] = useState(true);

  const [x1, y1, x2, y2] = useMemo(() => grenzen(gebaeude), [gebaeude]);
  const etage = gebaeude.etagen.find((e) => e.ebene === ebene)!;
  const darunter = gebaeude.etagen.find((e) => e.ebene === ebene - 1) ?? null;
  const plaetze = useMemo(() => new Map(etage.zonen.map((z) => [z.id, textPlatz(z, (z.name ?? "").length)])), [etage]);
  // SVG: y zeigt nach unten, im Modell nach oben → spiegeln
  const k = schild ? SCHRAEG : 0;
  const vb = `${x1 + k * y1 - RAND} ${-(y2 + RAND)} ${x2 - x1 + k * (y2 - y1) + 2 * RAND} ${y2 - y1 + 2 * RAND}`;
  // Bildschirm-y = −Modell-y → x' = x − k · y_bildschirm
  const schraeg = k ? `matrix(1 0 ${-k} 1 0 0)` : undefined;

  const suchen = (t: string) => {
    const r = raumFinden(gebaeude, t);
    if (!r) { setFehler(`Raum „${t.trim()}“ steht nicht im Plan.`); setZiel(null); return; }
    setFehler(null); setZiel(r); setEbene(r.etage.ebene); setWahl(r.zone);
  };

  return (
    <div className="innen" role="dialog" aria-label={`Innenansicht ${gebaeude.name}`}>
      <div className="innen-kopf">
        <div className="innen-titel">
          <b>{gebaeude.name}</b>
          <span>{etage.name}</span>
        </div>
        <form className="innen-suche" onSubmit={(e) => { e.preventDefault(); suchen(suche); }}>
          <Suche size={15} />
          <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Raum, z. B. 152" inputMode="numeric" enterKeyHint="search" aria-label="Raumnummer suchen" />
        </form>
        <button type="button" className="rund" aria-label="Innenansicht schließen" onClick={onZu}><Schliessen size={16} /></button>
      </div>

      <div className="innen-flaeche">
        <svg className="innen-plan" viewBox={vb} preserveAspectRatio="xMidYMid meet" onClick={() => setWahl(null)}>
          <defs>
            <pattern id="innen-stufen" width="1.2" height="1.2" patternUnits="userSpaceOnUse">
              <rect width="1.2" height="1.2" className="z-treppe-grund" />
              <path d="M0 0.6h1.2" className="z-stufe" />
            </pattern>
          </defs>
          <g transform={schraeg}>
          <g transform="scale(1,-1)">
            {darunter && <Geist etage={darunter} />}
            {etage.zonen.map((z) => (
              <g key={z.id} className={`zone z-${z.art}${wahl?.id === z.id ? " gewaehlt" : ""}`}
                onClick={(e) => { e.stopPropagation(); setWahl(z); }}>
                <Form z={z} />
              </g>
            ))}
            {/* Wände: Umrisse aller Bereiche (auch Flure – deren Außenkante ist die Außenwand) */}
            {etage.zonen.filter((z) => z.art !== "hof").map((z) => (
              <g key={`w-${z.id}`} className={`wand w-${z.art}`}>
                {umrissKanten(z).map(([a, b, c, d], i) => <line key={i} x1={a} y1={b} x2={c} y2={d} />)}
              </g>
            ))}
          </g>
          </g>
          {/* Beschriftung (nicht gespiegelt, nicht schräg) */}
          {etage.zonen.filter((z) => ["raeume", "hof", "terrasse", "nebengebaeude", "eingang"].includes(z.art)).map((z) => {
            const p = plaetze.get(z.id);
            if (!p) return null;
            const [x, y, w, h] = p;
            if (w < 8 || h < 4.5) return null;
            const text = kurzName(z, w);
            const groesse = Math.min(2.2, h / 2.2, (w * 0.9) / Math.max(4, text.length * 0.56));
            return <text key={`t-${z.id}`} x={x + k * y} y={-y} className={`etikett e-${z.art}`} fontSize={groesse} textAnchor="middle" dominantBaseline="middle">{text}</text>;
          })}
          {etage.etiketten?.map((t) => (
            <text key={t.text} x={t.x + k * t.y} y={-t.y} className="etikett e-frei" fontSize={2.2} textAnchor="middle" dominantBaseline="middle">{t.text}</text>
          ))}
          {/* Nummern bleiben gerade lesbar: nur die Position wird verschoben */}
          {etage.nummern.map((m) => (
            <g key={m.nr} className={`nummer${ziel?.nummer.nr === m.nr && ziel.etage.ebene === ebene ? " ziel" : ""}`} transform={`translate(${m.x + k * m.y} ${-m.y})`}>
              {ziel?.nummer.nr === m.nr && ziel.etage.ebene === ebene && <circle r="3.2" className="puls" />}
              <rect x="-2.3" y="-1.1" width="4.6" height="2.2" rx="0.6" />
              <text fontSize="1.5" textAnchor="middle" dominantBaseline="central">{m.nr}</text>
            </g>
          ))}
        </svg>

        <div className="innen-ansichten">
          <button type="button" className="innen-ansicht" onClick={() => setSchild(!schild)} aria-pressed={schild}>
            {schild ? "Draufsicht" : "Wie das Schild"}
          </button>
          {on3D && <button type="button" className="innen-ansicht" onClick={() => on3D(ebene, wahl?.id ?? null)}>3D auf der Karte</button>}
        </div>
        <div className="innen-etagen" role="radiogroup" aria-label="Etage">
          {[...gebaeude.etagen].reverse().map((e) => (
            <button key={e.id} type="button" role="radio" aria-checked={e.ebene === ebene} aria-label={e.name}
              className={e.ebene === ebene ? "an" : ""} onClick={() => { setEbene(e.ebene); setWahl(null); }}>
              {e.kurz}
            </button>
          ))}
        </div>
      </div>

      <div className="innen-fuss">
        {fehler ? <p className="hinweis">{fehler}</p>
          : wahl ? <Auswahl zone={wahl} etage={etage} />
            : <p className="leise">Tippe auf einen Bereich oder suche eine Raumnummer.</p>}
        <Legende />
        <details className="innen-quelle">
          <summary>Woher kommt der Plan?</summary>
          <p>{gebaeude.quelle}.</p>
          <ul>{gebaeude.hinweise.map((h) => <li key={h}>{h}</li>)}</ul>
        </details>
      </div>
    </div>
  );
}

function kurzName(z: Zone, breite: number) {
  const name = z.name ?? ART_NAME[z.art];
  if (name.length * 1.1 <= breite) return name;
  return name.replace(/^Laborräume \/ Werkstätten /, "Werkstätten ").replace(/^Laborräume /, "Labor ").replace(/ \(.*\)$/, "");
}

function Geist({ etage }: { etage: Etage }) {
  return (
    <g className="geist" aria-hidden="true">
      {etage.zonen.filter((z) => z.art !== "luftraum").map((z) => <Form key={z.id} z={z} />)}
    </g>
  );
}

function Auswahl({ zone, etage }: { zone: Zone; etage: Etage }) {
  const m2 = Math.round(zonenFlaeche(zone) / 10) * 10;
  return (
    <div className="innen-auswahl">
      <b>{zone.name ?? ART_NAME[zone.art]}</b>
      <span>{etage.name} · {ART_NAME[zone.art]}{zone.art === "raeume" ? ` · ca. ${m2} m²` : ""}</span>
      {zone.nummern?.length ? <span className="mono">Räume laut Plan: {zone.nummern.join(", ")}</span> : null}
    </div>
  );
}

function Legende() {
  const arten: Zone["art"][] = ["raeume", "flur", "treppe", "wc", "hof", "luftraum"];
  return (
    <div className="innen-legende" aria-label="Legende">
      {arten.map((a) => <span key={a}><i className={`l-${a}`} />{ART_NAME[a]}</span>)}
    </div>
  );
}
