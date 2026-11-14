import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Ablage unter der Suchleiste (Computer). Ruhe: kleine Symbole. Fokus: die Symbole gleiten nach oben weg,
 * die Ablage wächst weich nach unten und zeigt die Vorschläge – dieselbe Fläche, kein neues Fenster.
 */
export function Ablage({ offen, top, symbole, inhalt }: { offen: boolean; top: number; symbole: ReactNode; inhalt: ReactNode }) {
  const innen = useRef<HTMLDivElement>(null);
  const [hoehe, setHoehe] = useState<number | null>(null);

  // Höhe des sichtbaren Inhalts messen, damit die Ablage weich wachsen/schrumpfen kann
  useLayoutEffect(() => {
    const el = innen.current;
    if (!el) return;
    const messen = () => setHoehe(el.scrollHeight);
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, [offen]);

  return (
    <div className={`ablage${offen ? " offen" : ""}`} style={{ top }}>
      <div className="ablage-rahmen" style={{ ...(hoehe !== null ? { height: hoehe } : {}), maxHeight: `calc(100dvh - ${top + 30}px)` }}>
        <div className="ablage-symbole" aria-hidden={offen}>{symbole}</div>
        <div ref={innen} className="ablage-innen">{offen ? <div className="ablage-vorschlaege">{inhalt}</div> : <div className="ablage-platz" />}</div>
      </div>
    </div>
  );
}
