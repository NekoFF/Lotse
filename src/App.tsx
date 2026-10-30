import { useState } from "react";
import { ordneZu, type Zuordnung } from "./core/match";
import { pruefeSicherheit } from "./core/safety";
import type { Fachrichtung } from "./data/fachrichtungen";
import type { Notfallstufe } from "./data/notfall";
import type { Praxis } from "./data/praxen";
import { TabBar, type Tab } from "./ui/bars";
import { Eingabe } from "./screens/Eingabe";
import { Ergebnis } from "./screens/Ergebnis";
import { Praxen } from "./screens/Praxen";
import { PraxisSheet } from "./screens/PraxisSheet";
import { Notfall } from "./screens/Notfall";
import { Termine } from "./screens/Termine";
import { InfoScreen } from "./screens/InfoScreen";

/** Ein Bildschirm im Stapel des Tabs „Anliegen“. */
type Seite =
  | { name: "eingabe" }
  | { name: "ergebnis"; z: Zuordnung }
  | { name: "praxen"; fach: Fachrichtung };

export default function App() {
  const [tab, setTab] = useState<Tab>("anliegen");
  const [stapel, setStapel] = useState<Seite[]>([{ name: "eingabe" }]);
  const [richtung, setRichtung] = useState<"enter" | "enter-back" | "">("");
  const [text, setText] = useState("");
  const [alarm, setAlarm] = useState<Notfallstufe | null>(null);
  const [sheet, setSheet] = useState<Praxis | null>(null);

  const push = (s: Seite) => { setRichtung("enter"); setStapel((st) => [...st, s]); };
  const pop = () => { setRichtung("enter-back"); setStapel((st) => (st.length > 1 ? st.slice(0, -1) : st)); };

  // Sicherheitsfilter zuerst, erst danach die Zuordnung.
  const weiter = () => {
    const sicher = pruefeSicherheit(text);
    if (sicher.stufe) { setAlarm(sicher.stufe); return; }
    push({ name: "ergebnis", z: ordneZu(text) });
  };

  const oben = stapel[stapel.length - 1];
  const key = `${tab}-${stapel.length}`;

  return (
    <div className="app">
      {tab === "anliegen" && oben.name === "eingabe" && (
        <Eingabe key={key} text={text} setText={setText} onWeiter={weiter} anim={richtung} />
      )}
      {tab === "anliegen" && oben.name === "ergebnis" && (
        <Ergebnis key={key} z={oben.z} onBack={pop} onPraxen={(fach) => push({ name: "praxen", fach })} anim={richtung} />
      )}
      {tab === "anliegen" && oben.name === "praxen" && (
        <Praxen key={key} fach={oben.fach} onBack={pop} onOpen={setSheet} anim={richtung} />
      )}
      {tab === "termine" && <Termine anim="" />}
      {tab === "info" && <InfoScreen anim="" />}

      <TabBar tab={tab} onTab={(t) => { setRichtung(""); setTab(t); }} />

      {sheet && <PraxisSheet p={sheet} onClose={() => setSheet(null)} />}

      {alarm && (
        <Notfall
          stufe={alarm}
          onZurueck={() => setAlarm(null)}
          onWeiter={() => { setAlarm(null); push({ name: "ergebnis", z: ordneZu(text) }); }}
        />
      )}
    </div>
  );
}
