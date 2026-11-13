import { useEffect, useRef, useState, type ReactNode } from "react";

/** Höhen des Blatts am Telefon: klein (nur Suche), mittel, groß */
export type Stufe = "klein" | "mittel" | "gross";
const HOEHE: Record<Stufe, () => number> = {
  klein: () => 148,
  mittel: () => Math.round(window.innerHeight * 0.48),
  gross: () => Math.round(window.innerHeight * 0.9),
};

interface Props {
  desktop: boolean;
  stufe: Stufe;
  setStufe: (s: Stufe) => void;
  /** immer oben: das Suchfeld */
  kopf: ReactNode;
  children: ReactNode;
  /** meldet die sichtbare Höhe (Telefon) bzw. Breite (Computer), damit die Karte Platz lässt */
  onGroesse: (g: { w: number; h: number }) => void;
}

/** EIN Blatt für alles (wie Apple/Google Maps): Suche bleibt, nur der Inhalt darunter wechselt. */
export function Blatt({ desktop, stufe, setStufe, kopf, children, onGroesse }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [zug, setZug] = useState<number | null>(null);
  const start = useRef<{ y: number; h: number } | null>(null);
  const bewegt = useRef(false);
  const hoehe = desktop ? undefined : zug ?? HOEHE[stufe]();

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => { const r = e.target.getBoundingClientRect(); onGroesse({ w: Math.round(r.width), h: Math.round(r.height) }); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [onGroesse]);

  const runter = (e: React.PointerEvent) => {
    if (desktop) return;
    start.current = { y: e.clientY, h: ref.current?.getBoundingClientRect().height ?? 0 };
    bewegt.current = false;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const zieh = (e: React.PointerEvent) => {
    if (!start.current) return;
    if (Math.abs(e.clientY - start.current.y) > 4) bewegt.current = true;
    setZug(Math.max(110, Math.min(window.innerHeight * 0.94, start.current.h + start.current.y - e.clientY)));
  };
  const los = () => {
    if (!start.current) return;
    const h = zug ?? start.current.h;
    start.current = null;
    setZug(null);
    const naechste = (Object.keys(HOEHE) as Stufe[]).sort((a, b) => Math.abs(HOEHE[a]() - h) - Math.abs(HOEHE[b]() - h))[0];
    setStufe(naechste);
  };

  return (
    <aside ref={ref} className={`blatt glas ${desktop ? "pc" : "tel"}${zug !== null ? " zieht" : ""}`} style={hoehe ? { height: hoehe } : undefined} aria-label="Lotse">
      {!desktop && (
        <div className="griff-zone" onPointerDown={runter} onPointerMove={zieh} onPointerUp={los} onPointerCancel={los}
          onClick={() => !bewegt.current && setStufe(stufe === "klein" ? "mittel" : stufe === "mittel" ? "gross" : "mittel")}
          role="button" aria-label="Blatt größer oder kleiner" tabIndex={0}>
          <div className="griff" />
        </div>
      )}
      <div className="blatt-kopf" onFocus={() => !desktop && stufe === "klein" && setStufe("mittel")}>{kopf}</div>
      <div className="blatt-inhalt">{children}</div>
    </aside>
  );
}
