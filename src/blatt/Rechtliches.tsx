import { ANBIETER, EMPFAENGER, RECHT_VOLLSTAENDIG } from "../rechtliches";
import { Kopf } from "./Inhalte";

/** Impressum und Datenschutz – kurz, ehrlich, passend zum Code */
export function RechtlichesInhalt({ onZurueck, onZu }: { onZurueck?: () => void; onZu: () => void }) {
  return (
    <div className="inhalt info-seite recht">
      <Kopf titel="Impressum & Datenschutz" onZurueck={onZurueck} onZu={onZu} />
      {!RECHT_VOLLSTAENDIG && <p className="hinweis">Vorschau: Die Angaben zum Anbieter fehlen noch. So darf Lotse nicht veröffentlicht werden.</p>}

      <h3 className="abschnitt">Impressum</h3>
      <p>{ANBIETER.name}<br />{ANBIETER.anschrift}<br />E-Mail: {ANBIETER.email}</p>
      <p className="fein">{ANBIETER.rahmen}.</p>

      <h3 className="abschnitt">Datenschutz in Kürze</h3>
      <ul className="liste-punkte">
        <li><b>Kein Konto, keine Cookies, kein Tracking.</b> Lotse speichert nichts auf eigenen Servern.</li>
        <li><b>Beschreibungen von Beschwerden</b> bleiben auf deinem Gerät. Lotse schickt nur die Fachrichtung (z. B. „Zahnarzt“) und den Kartenausschnitt an die Ortssuche – daraus kann man auf ein Gesundheitsthema schließen, deshalb fragt Lotse vorher.</li>
        <li><b>Im Browser gespeichert</b> (nur auf diesem Gerät): Termine, gespeicherte Orte, letzte Suchen, deine Einwilligung, ein Zähler der Fahrplananfragen (nur die Anzahl), das KI-Modell (falls geladen) und der Startpunkt (bis der Tab geschlossen wird). Löschen: „Alle meine Daten löschen“.</li>
        <li><b>Standort</b> wird nur genutzt, wenn du „Mein Standort“ antippst und es erlaubst; er wird gerundet an die Wegberechnung geschickt.</li>
      </ul>

      <h3 className="abschnitt">Wer sieht was</h3>
      <div className="recht-tabelle">
        {EMPFAENGER.map((e) => (
          <div key={e.dienst} className="recht-zeile">
            <b>{e.dienst}</b>
            <span>{e.wer}</span>
            <span className="fein">{e.was} · {e.wann}</span>
          </div>
        ))}
      </div>

      <h3 className="abschnitt">Rechtsgrundlagen und Rechte</h3>
      <p className="fein">
        Abruf der Dienste: Art. 6 Abs. 1 lit. f DSGVO (die von dir angefragte Funktion bereitstellen). Suche nach Praxen anhand einer Beschwerde: deine Einwilligung,
        Art. 9 Abs. 2 lit. a DSGVO – jederzeit widerrufbar über „Alle meine Daten löschen“. Bei Diensten außerhalb der EU (USA, UK) gelten die dortigen Bedingungen
        der Anbieter. Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch und Beschwerde bei einer Aufsichtsbehörde
        (in Hessen: Der Hessische Beauftragte für Datenschutz und Informationsfreiheit). Lotse selbst hält keine Daten über dich.
      </p>
    </div>
  );
}

/** Einmalige Einwilligung, bevor anhand einer Beschwerde nach Praxen gesucht wird (Art. 9 DSGVO) */
export function Einwilligung({ onJa, onNein }: { onJa: () => void; onNein: () => void }) {
  return (
    <div className="einwilligung-schleier" role="dialog" aria-modal="true" aria-labelledby="einw-titel">
      <div className="einwilligung">
        <h2 id="einw-titel">Kurz zur Praxissuche</h2>
        <p>Deine Beschreibung bleibt auf diesem Gerät. Für die Suche schickt Lotse nur die <b>Fachrichtung</b> (z. B. „Zahnarzt“) und den <b>Kartenausschnitt</b> an die Ortssuche (Nominatim) und Start/Ziel an die Wegberechnung. Daraus könnte jemand auf ein Gesundheitsthema schließen.</p>
        <p>Lotse stellt keine Diagnose. Im Notfall: 112.</p>
        <div className="knoepfe">
          <button type="button" className="btn zweit" onClick={onNein}>Abbrechen</button>
          <button type="button" className="btn primaer" onClick={onJa}>Einverstanden</button>
        </div>
        <p className="fein">Widerruf jederzeit unter Daten &amp; Quellen → „Alle meine Daten löschen“.</p>
      </div>
    </div>
  );
}
