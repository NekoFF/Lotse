const BEISPIELE = [
  "Seit einer Woche tut mir der Rücken weh",
  "Ausschlag am Arm, juckt stark",
  "Mein Zahn pocht seit zwei Tagen",
  "Ich sehe seit gestern verschwommen",
  "Mein Sohn hat Ohrenschmerzen",
];

export function Eingabe({ text, setText, onWeiter, anim }: {
  text: string;
  setText: (t: string) => void;
  onWeiter: () => void;
  anim: string;
}) {
  const ok = text.trim().length >= 3;
  return (
    <main className={`screen ${anim}`}>
      <h1 className="t-large" style={{ marginTop: 34 }}>Was ist los?</h1>
      <p className="t-sub" style={{ marginTop: 4 }}>Beschreib es in deinen eigenen Worten. Fachbegriffe brauchst du nicht.</p>

      <div className="composer">
        <label htmlFor="anliegen" className="t-cap" style={{ position: "absolute", left: -9999 }}>Dein Anliegen</label>
        <textarea
          id="anliegen"
          value={text}
          maxLength={400}
          placeholder="Zum Beispiel: Mein Knie tut beim Treppensteigen weh"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && ok) { e.preventDefault(); onWeiter(); } }}
        />
        <div className="composer-foot">
          <span className="private"><i />Wird nicht gespeichert</span>
          <span className="count">{text.length}/400</span>
        </div>
      </div>

      <div className="chips" role="group" aria-label="Beispiele">
        {BEISPIELE.map((b) => (
          <button key={b} className="chip" onClick={() => setText(b)}>{b}</button>
        ))}
      </div>

      <div style={{ marginTop: 22 }}>
        <button className="btn btn-primary" disabled={!ok} onClick={onWeiter}>Weiter</button>
      </div>

      <p className="t-foot" style={{ marginTop: 18, textAlign: "center" }}>
        Lotse stellt keine Diagnose. Im Notfall: <b>112</b>
      </p>
    </main>
  );
}
