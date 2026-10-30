import { Calendar } from "../ui/icons";

export function Termine({ anim }: { anim: string }) {
  return (
    <main className={`screen ${anim}`}>
      <h1 className="t-large" style={{ marginTop: 34 }}>Termine</h1>
      <div className="empty">
        <Calendar className="ic" />
        <h2>Noch keine Termine</h2>
        <p>Hast du bei einer Praxis einen Termin bekommen, trägst du ihn hier ein. Lotse rechnet dann aus, wann du losmusst, und erinnert dich am Vorabend.</p>
        <span className="pill">in Arbeit · Etappe 3</span>
      </div>
    </main>
  );
}
