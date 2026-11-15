import { useEffect, useRef } from "react";
import { plane, type Termin } from "./termine";

const uhr = (d: Date) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
/** alle 5 Minuten – sparsam (Transitous: < 720 Anfragen am Tag) */
const TAKT = 5 * 60_000;

/**
 * Prüft Termine der nächsten 18 Stunden regelmäßig neu (Bus & Bahn mit Echtzeit, Wege neu berechnet).
 * Muss man früher los (≥ 3 Minuten), sagt Lotse sofort Bescheid.
 */
export function useTerminWaechter(termine: Termin[], aktualisieren: (t: Termin) => void, melden: (text: string) => void) {
  const ref = useRef({ termine, aktualisieren, melden });
  ref.current = { termine, aktualisieren, melden };

  useEffect(() => {
    let aus = false;
    const pruefen = async () => {
      for (const t of ref.current.termine) {
        if (aus) return;
        if (!t.ort || !t.start || !t.verkehr) continue;
        const ms = new Date(t.zeit).getTime() - Date.now();
        if (ms < 0 || ms > 18 * 3600_000) continue;
        try {
          const p = await plane(t.ort, t.start, new Date(t.zeit), t.verkehr, t.puffer);
          if (aus) return;
          const alt = t.los ? new Date(t.los).getTime() : null;
          if (alt && p.los && alt - p.los.getTime() >= 3 * 60_000) {
            const text = `Früher los: ${t.titel} – jetzt um ${uhr(p.los)}${p.hinweis ? ` (${p.hinweis})` : ""}`;
            ref.current.melden(text);
            try { if ("Notification" in window && Notification.permission === "granted") new Notification("Lotse", { body: text }); } catch { /* egal */ }
          }
          ref.current.aktualisieren({ ...t, los: p.los?.toISOString() ?? t.los, dauerS: p.dauerS ?? t.dauerS, weg: p.weg ?? t.weg, hinweis: p.hinweis, geprueft: new Date().toISOString() });
        } catch { /* Dienst gerade nicht erreichbar – beim nächsten Takt wieder */ }
      }
    };
    const erst = window.setTimeout(pruefen, 4000);
    const takt = window.setInterval(pruefen, TAKT);
    return () => { aus = true; window.clearTimeout(erst); window.clearInterval(takt); };
  }, []);
}
