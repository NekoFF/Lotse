import { useState } from "react";
import type { Start } from "../data/praxen";
import { adresseSuchen, DienstFehler, gpsStandort } from "../services/dienste";
import { Standort, Suche, Zurueck } from "../ui/icons";

interface Props {
  fachName: string;
  geteilt: boolean;
  onStart: (s: Start) => void;
  onZurueck: () => void;
}

/** Fragt nach dem Startpunkt: eigener Standort oder Adresse. Ohne Startpunkt keine Fahrzeiten. */
export function StandortPanel({ fachName, geteilt, onStart, onZurueck }: Props) {
  const [adresse, setAdresse] = useState("");
  const [treffer, setTreffer] = useState<Start[] | null>(null);
  const [laeuft, setLaeuft] = useState<"gps" | "adresse" | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const gps = async () => {
    setLaeuft("gps"); setFehler(null);
    try { onStart(await gpsStandort()); } catch (e) { setFehler(e instanceof DienstFehler ? e.message : "Standort nicht bestimmbar."); }
    setLaeuft(null);
  };

  const suchen = async () => {
    if (adresse.trim().length < 3) return;
    setLaeuft("adresse"); setFehler(null); setTreffer(null);
    try {
      const t = await adresseSuchen(adresse.trim());
      setTreffer(t);
      if (!t.length) setFehler("Keine passende Adresse gefunden. Versuch es mit Straße und Ort.");
    } catch (e) { setFehler(e instanceof DienstFehler ? e.message : "Adresssuche fehlgeschlagen."); }
    setLaeuft(null);
  };

  return (
    <div className="panel-in standort">
      <div className="kopf-zurueck">
        <button type="button" className="rund" aria-label="Zurück" onClick={onZurueck}><Zurueck size={18} /></button>
        <div className="titel">
          <h1>Wo startest du?</h1>
          <span>{geteilt ? "Der Termin wurde mit dir geteilt. Lotse plant deinen eigenen Weg." : fachName ? `Damit Lotse ${fachName}-Praxen nach echter Fahrzeit sortieren kann.` : "Von hier aus rechnet Lotse alle Wege."}</span>
        </div>
      </div>

      <button type="button" className="btn primaer" onClick={gps} disabled={laeuft !== null}>
        <Standort size={18} /> {laeuft === "gps" ? "Standort wird bestimmt …" : "Meinen Standort verwenden"}
      </button>

      <div className="oder"><span>oder</span></div>

      <form onSubmit={(e) => { e.preventDefault(); suchen(); }}>
        <label className={`feld${adresse ? " aktiv" : ""}`}>
          <Suche size={19} />
          <span className="sr">Startadresse</span>
          <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Adresse, z. B. Bahnhofstraße 1, Wetzlar" autoComplete="street-address" enterKeyHint="search" />
        </label>
      </form>

      {laeuft === "adresse" && <p className="fein">Suche Adresse …</p>}
      {fehler && <p className="hinweis-fehler" role="alert">{fehler}</p>}
      {treffer && treffer.length > 0 && (
        <div className="treffer">
          {treffer.map((t, i) => (
            <button key={i} type="button" className="treffer-z" onClick={() => onStart(t)}>{t.name}</button>
          ))}
        </div>
      )}

      <p className="fein">Der Startpunkt bleibt nur in diesem Fenster und wird nirgends gespeichert. Adresssuche: Nominatim, © OpenStreetMap-Mitwirkende.</p>
    </div>
  );
}
