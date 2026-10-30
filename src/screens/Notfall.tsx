import type { Notfallstufe } from "../data/notfall";

const TEXT: Record<Notfallstufe, { titel: string; text: string }> = {
  notruf: {
    titel: "Hier hilft keine Terminsuche.",
    text: "Deine Beschreibung klingt nach einer akuten Notlage. Ruf jetzt den Notruf an. Lotse sucht in diesem Fall keine Praxis und plant keinen Weg.",
  },
  seelsorge: {
    titel: "Du musst das nicht allein tragen.",
    text: "Die Telefonseelsorge ist rund um die Uhr erreichbar, kostenlos und anonym. Wenn du in akuter Gefahr bist, ruf die 112 an.",
  },
  bereitschaft: {
    titel: "Das klingt dringend.",
    text: "Wenn es plötzlich begonnen hat oder sehr stark ist, hilft der ärztliche Bereitschaftsdienst, auch nachts und am Wochenende.",
  },
};

export function Notfall({ stufe, onWeiter, onZurueck }: {
  stufe: Notfallstufe;
  onWeiter: () => void;
  onZurueck: () => void;
}) {
  const t = TEXT[stufe];
  return (
    <section className={`alarm ${stufe} fade-in`} role="alertdialog" aria-labelledby="alarm-t">
      <h1 id="alarm-t">{t.titel}</h1>
      <p>{t.text}</p>

      <div className="calls">
        {stufe === "notruf" && (
          <>
            <a className="call primary" href="tel:112"><b>112</b><span>Notruf anrufen</span></a>
            <a className="call" href="tel:116117"><b>116117</b><span>Ärztlicher Bereitschaftsdienst</span></a>
          </>
        )}
        {stufe === "seelsorge" && (
          <>
            <a className="call primary" href="tel:116123"><b>116 123</b><span>Telefonseelsorge</span></a>
            <a className="call" href="tel:08001110111"><b>0800 111 0 111</b><span>Telefonseelsorge</span></a>
            <a className="call" href="tel:112"><b>112</b><span>Notruf bei akuter Gefahr</span></a>
          </>
        )}
        {stufe === "bereitschaft" && (
          <>
            <a className="call primary" href="tel:116117"><b>116117</b><span>Ärztlicher Bereitschaftsdienst</span></a>
            <a className="call" href="tel:112"><b>112</b><span>Notruf, wenn es lebensbedrohlich ist</span></a>
          </>
        )}
        {stufe === "bereitschaft" && (
          <button className="btn-ghost" onClick={onWeiter}>Nicht akut — trotzdem Praxis suchen</button>
        )}
        <button className="btn-ghost" onClick={onZurueck}>Zurück zur Eingabe</button>
      </div>
    </section>
  );
}
