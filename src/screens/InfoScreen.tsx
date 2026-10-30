import { Lock, Phone, Route, Shield } from "../ui/icons";

export function InfoScreen({ anim }: { anim: string }) {
  return (
    <main className={`screen ${anim}`}>
      <h1 className="t-large" style={{ marginTop: 34 }}>Über Lotse</h1>
      <p className="t-sub" style={{ marginTop: 4 }}>Vom Anliegen bis zur Tür.</p>

      <div className="section-head t-cap">So arbeitet Lotse</div>
      <div className="group">
        <div className="cell inset">
          <span className="icon-tile" style={{ background: "var(--accent)" }}><Route /></span>
          <div className="cell-main"><div className="cell-title">Wegweiser</div><div className="cell-sub">Ordnet dein Anliegen einer Fachrichtung zu und zeigt erreichbare Praxen.</div></div>
        </div>
        <div className="cell inset">
          <span className="icon-tile" style={{ background: "#8e8e93" }}><Shield /></span>
          <div className="cell-main"><div className="cell-title">Keine Diagnose</div><div className="cell-sub">Lotse nennt keine Krankheiten und schätzt nicht ein, wie dringend etwas ist.</div></div>
        </div>
        <div className="cell inset">
          <span className="icon-tile" style={{ background: "var(--good)" }}><Lock /></span>
          <div className="cell-main"><div className="cell-title">Nichts wird gespeichert</div><div className="cell-sub">Kein Konto, kein Verlauf. Deine Beschreibung bleibt auf deinem Gerät.</div></div>
        </div>
      </div>

      <div className="section-head t-cap">Im Notfall</div>
      <div className="group">
        <a className="cell inset" href="tel:112" style={{ color: "inherit", textDecoration: "none" }}>
          <span className="icon-tile" style={{ background: "var(--crit)" }}><Phone /></span>
          <div className="cell-main"><div className="cell-title">Notruf</div></div>
          <div className="cell-value mono">112</div>
        </a>
        <a className="cell inset" href="tel:116117" style={{ color: "inherit", textDecoration: "none" }}>
          <span className="icon-tile" style={{ background: "var(--warn)" }}><Phone /></span>
          <div className="cell-main"><div className="cell-title">Ärztlicher Bereitschaftsdienst</div></div>
          <div className="cell-value mono">116117</div>
        </a>
        <a className="cell inset" href="tel:116123" style={{ color: "inherit", textDecoration: "none" }}>
          <span className="icon-tile" style={{ background: "#5856d6" }}><Phone /></span>
          <div className="cell-main"><div className="cell-title">Telefonseelsorge</div></div>
          <div className="cell-value mono">116 123</div>
        </a>
      </div>

      <div className="section-head t-cap">Projekt</div>
      <div className="group">
        <div className="cell"><div className="cell-main"><div className="cell-title">Version</div></div><div className="cell-value mono">0.1 · Prototyp</div></div>
        <div className="cell"><div className="cell-main"><div className="cell-title">Team</div><div className="cell-sub">Dima, Mischal, Abdi, Fateme</div></div></div>
        <div className="cell"><div className="cell-main"><div className="cell-title">Schule</div><div className="cell-sub">Werner-von-Siemens-Schule, Schuljahr 2026/27</div></div></div>
      </div>
      <p className="section-foot t-foot">Praxen und Fahrzeiten sind im Prototyp Beispieldaten.</p>
    </main>
  );
}
