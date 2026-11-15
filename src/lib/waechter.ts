import { useEffect, useRef } from "react";
import { plane, type Termin } from "./termine";

const uhr = (d: Date) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
/** etwa alle 5 Minuten – sparsam (Transitous: < 720 Anfragen am Tag, dazu Tagesgrenze in oepnv.ts) */
const TAKT = 5 * 60_000;
/** nur Termine, bei denen man in den nächsten 3 Stunden los muss, höchstens 3 gleichzeitig */
const FENSTER = 3 * 3600_000, HOECHSTENS = 3;

/**
 * Prüft bald anstehende Bus-&-Bahn-Termine regelmäßig mit Echtzeit neu (Verspätung, Ausfall).
 * Fuß/Rad/Auto nicht: der Routingdienst kennt keine aktuelle Verkehrslage, neu fragen brächte nichts.
 * Muss man früher los (≥ 3 Minuten), sagt Lotse sofort Bescheid.
 */
export function useTerminWaechter(termine: Termin[], aktualisieren: (t: Termin) => void, melden: (text: string) => void) {
  const ref = useRef({ termine, aktualisieren, melden });
  ref.current = { termine, aktualisieren, melden };

  useEffect(() => {
    let aus = false;
    const pruefen = async () => {
      if (document.visibilityState === "hidden") return; // Hintergrund-Tab: nicht fragen
      const jetzt = Date.now();
      const bald = ref.current.termine.filter((t) => {
        if (!t.ort || !t.start || t.verkehr !== "oepnv") return false;
        const bis = new Date(t.los ?? t.zeit).getTime() - jetzt;
        return new Date(t.zeit).getTime() > jetzt && bis < FENSTER;
      }).slice(0, HOECHSTENS);
      for (const t of bald) {
        if (aus) return;
        try {
          const p = await plane(t.ort!, t.start!, new Date(t.zeit), "oepnv", t.puffer, true);
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
