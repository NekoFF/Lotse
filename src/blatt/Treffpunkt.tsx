import { useState } from "react";
import { MODI, type Start } from "../data/praxen";
import { FARBEN, treffpunkteFinden, type Person, type Vorschlag } from "../lib/treffpunkt";
import type { Verkehr } from "../lib/termine";
import { fehlerText } from "../services/dienste";
import { suchen } from "../services/orte";
import { Bus, Plus, Schliessen, Standort } from "../ui/icons";
import { Kopf, MODUS_ICON } from "./Inhalte";

const ZIELE: { id: string; name: string; phrasen: string[] }[] = [
  { id: "cafe", name: "Café", phrasen: ["cafe"] },
  { id: "essen", name: "Essen", phrasen: ["restaurant", "fast_food"] },
  { id: "kino", name: "Kino", phrasen: ["cinema"] },
  { id: "park", name: "Park", phrasen: ["park"] },
  { id: "sehen", name: "Sehenswertes", phrasen: ["attraction", "museum"] },
];
const VK: Verkehr[] = [...MODI, "oepnv"];
const min = (s: number) => Math.max(1, Math.round(s / 60));

export function TreffpunktInhalt({ start, personen, setPersonen, ergebnis, setErgebnis, gewaehlt, onWahl, onOrt, onZu }: {
  start: Start | null;
  personen: Person[]; setPersonen: (p: Person[]) => void;
  ergebnis: Vorschlag[] | null; setErgebnis: (v: Vorschlag[] | null) => void;
  gewaehlt: number | null; onWahl: (i: number) => void; onOrt: (v: Vorschlag) => void; onZu: () => void;
}) {
  const [ziel, setZiel] = useState(ZIELE[0].id);
  const [status, setStatus] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [eingabe, setEingabe] = useState<Record<string, string>>({});

  const aendern = (id: string, teil: Partial<Person>) => { setPersonen(personen.map((p) => (p.id === id ? { ...p, ...teil } : p))); setErgebnis(null); };
  const adresse = async (p: Person) => {
    const t = eingabe[p.id]?.trim();
    if (!t || t.length < 3) return;
    setFehler(null);
    try {
      const r = await suchen(t, start?.lngLat ?? null);
      if (!r[0]) { setFehler(`Adresse für ${p.name} nicht gefunden.`); return; }
      aendern(p.id, { start: { lngLat: r[0].lngLat, name: r[0].adresse ?? r[0].name } });
    } catch (e) { setFehler(fehlerText(e)); }
  };
  const finden = async () => {
    setFehler(null); setErgebnis(null);
    try {
      const v = await treffpunkteFinden(personen, ZIELE.find((z) => z.id === ziel)!.phrasen, setStatus);
      setErgebnis(v);
      if (!v.length) setFehler("Zwischen euch nichts Passendes gefunden. Andere Art probieren?");
    } catch (e) { setFehler(fehlerText(e)); }
    setStatus(null);
  };
  const fahrer = personen.filter((p) => p.verkehr === "auto" && p.start);

  return (
    <div className="inhalt treffpunkt">
      <Kopf titel="Treffpunkt" unter="Ein Ort, der für alle passt" onZu={onZu} />

      <div className="personen">
        {personen.map((p, i) => (
          <div key={p.id} className="person" style={{ ["--p" as string]: p.farbe }}>
            <div className="person-kopf">
              <span className="person-punkt" />
              <input className="person-name" value={p.name} onChange={(e) => aendern(p.id, { name: e.target.value })} aria-label="Name" />
              {i > 1 && <button type="button" className="rund klein" aria-label="Person entfernen" onClick={() => { setPersonen(personen.filter((x) => x.id !== p.id).map((x) => (x.mitBei === p.id ? { ...x, mitBei: null } : x))); setErgebnis(null); }}><Schliessen size={13} /></button>}
            </div>
            {p.start ? (
              <button type="button" className="person-start" onClick={() => aendern(p.id, { start: null })}><Standort size={13} /> {p.start.name} <span className="leise">ändern</span></button>
            ) : (
              <form className="mini-suche" onSubmit={(e) => { e.preventDefault(); void adresse(p); }}>
                <input value={eingabe[p.id] ?? ""} onChange={(e) => setEingabe({ ...eingabe, [p.id]: e.target.value })} placeholder={i === 0 && start ? "Startadresse (oder unten: mein Start)" : "Startadresse"} enterKeyHint="go" />
                {i === 0 && start && <button type="button" className="link klein-link" onClick={() => aendern(p.id, { start: { lngLat: start.lngLat, name: start.name } })}>Mein Start: {start.name}</button>}
              </form>
            )}
            <div className="person-vk">
              {VK.map((v) => (
                <button key={v} type="button" className={p.verkehr === v && !p.mitBei ? "an" : ""} onClick={() => aendern(p.id, { verkehr: v, mitBei: null })} aria-label={v}>
                  {v === "oepnv" ? <Bus size={15} /> : MODUS_ICON[v]}
                </button>
              ))}
              {/* ein Fahrer nimmt eine Person mit; wer selbst jemanden abholt, fährt nicht bei anderen mit */}
              {!personen.some((x) => x.mitBei === p.id) && fahrer.filter((f) => f.id !== p.id && !f.mitBei && !personen.some((x) => x.mitBei === f.id && x.id !== p.id)).map((f) => (
                <button key={f.id} type="button" className={`mit${p.mitBei === f.id ? " an" : ""}`} onClick={() => aendern(p.id, { mitBei: p.mitBei === f.id ? null : f.id })}>mit {f.name}</button>
              ))}
            </div>
          </div>
        ))}
        {personen.length < 4 && (
          <button type="button" className="btn zweit" onClick={() => setPersonen([...personen, { id: `p${Date.now()}`, name: `Person ${personen.length + 1}`, farbe: FARBEN[personen.length], start: null, verkehr: "fuss", mitBei: null }])}>
            <Plus size={15} /> Person hinzufügen
          </button>
        )}
      </div>

      <div className="chips">
        {ZIELE.map((z) => <button key={z.id} type="button" className={`chip${ziel === z.id ? " an" : ""}`} onClick={() => { setZiel(z.id); setErgebnis(null); }}>{z.name}</button>)}
      </div>
      <button type="button" className="btn primaer" onClick={finden} disabled={!!status || personen.filter((p) => p.start).length < 2}>{status ?? "Treffpunkt finden"}</button>
      {fehler && <p className="hinweis">{fehler}</p>}

      {ergebnis && ergebnis.length > 0 && (
        <div className="zeilen routen">
          {ergebnis.map((v, i) => (
            <div key={v.ort.id} className={`zeile route-wahl treff${gewaehlt === i ? " an" : ""}`} role="button" tabIndex={0} onClick={() => onWahl(i)} onKeyDown={(e) => e.key === "Enter" && onWahl(i)}>
              <span className="zeile-t">
                <b>{v.ort.name}</b>
                <span className="linien">
                  {v.anreisen.map((a) => {
                    const p = personen.find((x) => x.id === a.personId)!;
                    return <span key={a.personId} className="zeit-chip" style={{ ["--p" as string]: p.farbe }} title={a.hinweis}>{p.name} {a.s != null ? `${min(a.s)}′` : "?"}</span>;
                  })}
                </span>
              </span>
              <span className="route-min"><b className="mono">{min(v.laengste)}</b> Min<br /><button type="button" className="link klein-link" onClick={(e) => { e.stopPropagation(); onOrt(v); }}>Ort</button></span>
            </div>
          ))}
        </div>
      )}
      <p className="fein">Fair = die längste Anreise ist möglichst kurz. Wege: OSRM (FOSSGIS), Bus & Bahn: Transitous.</p>
    </div>
  );
}
