import { useEffect, useRef } from "react";
import type { Notfallstufe } from "../data/notfall";
import { Telefon } from "../ui/icons";

const TEXT: Record<Notfallstufe, { kopf: string; titel: string; text: string }> = {
  notruf: {
    kopf: "Notfall",
    titel: "Ruf jetzt die 112.",
    text: "Deine Beschreibung klingt nach einer akuten Notlage. Warte nicht auf einen Praxistermin.",
  },
  seelsorge: {
    kopf: "Du bist nicht allein",
    titel: "Du musst das nicht allein tragen.",
    text: "Die Telefonseelsorge ist rund um die Uhr erreichbar, kostenlos und anonym. Wenn du in akuter Gefahr bist, ruf die 112 an.",
  },
  bereitschaft: {
    kopf: "Dringend",
    titel: "Das klingt dringend.",
    text: "Wenn es plötzlich begonnen hat oder sehr stark ist, hilft der ärztliche Bereitschaftsdienst, auch nachts und am Wochenende.",
  },
};

const NUMMERN: Record<Notfallstufe, { tel: string; nr: string; was: string }[]> = {
  notruf: [{ tel: "112", nr: "112", was: "anrufen" }, { tel: "116117", nr: "116 117", was: "Ärztlicher Bereitschaftsdienst" }],
  seelsorge: [{ tel: "08001110111", nr: "0800 111 0 111", was: "Telefonseelsorge" }, { tel: "116123", nr: "116 123", was: "Telefonseelsorge" }, { tel: "112", nr: "112", was: "Notruf bei akuter Gefahr" }],
  bereitschaft: [{ tel: "116117", nr: "116 117", was: "anrufen" }, { tel: "112", nr: "112", was: "Notruf, wenn es lebensbedrohlich ist" }],
};

export function Notfall({ stufe, text, onWeiter, onZurueck }: {
  stufe: Notfallstufe;
  text: string;
  onWeiter: () => void;
  onZurueck: () => void;
}) {
  const t = TEXT[stufe];
  const [erste, ...weitere] = NUMMERN[stufe];
  const knopf = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    knopf.current?.focus();
    const f = (e: KeyboardEvent) => { if (e.key === "Escape") onZurueck(); };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onZurueck]);

  return (
    <section className={`alarm ${stufe}`} role="alertdialog" aria-labelledby="alarm-t" aria-describedby="alarm-p">
      <div className="alarm-oben">
        <span className="zitat">„{text}“</span>
        <button type="button" className="alarm-zurueck" onClick={onZurueck}><span className="kbd hell nur-pc">esc</span> Zurück zur Eingabe</button>
      </div>
      <div className="alarm-mitte">
        <span className="alarm-kopf">{t.kopf.toUpperCase()}</span>
        <h1 id="alarm-t">{t.titel}</h1>
        <p id="alarm-p">{t.text}</p>
        <a ref={knopf} className="alarm-knopf" href={`tel:${erste.tel}`}><Telefon size={22} /> {erste.nr} {erste.was}</a>
        <div className="alarm-weitere">
          {weitere.map((n) => <a key={n.tel} href={`tel:${n.tel}`}><b>{n.nr}</b><span>{n.was}</span></a>)}
        </div>
        {stufe === "bereitschaft"
          ? <button type="button" className="alarm-leise" onClick={onWeiter}>Nicht akut? Trotzdem Praxis suchen</button>
          : <p className="alarm-fein">Lotse sucht in diesem Fall keine Praxis.</p>}
      </div>
    </section>
  );
}
