import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Ic({ size = 20, children, ...rest }: P) {
  return (
    <svg className="ic" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const Suche = (p: P) => <Ic {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></Ic>;
export const Kalender = (p: P) => <Ic {...p}><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></Ic>;
export const Info = (p: P) => <Ic {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></Ic>;
export const Standort = (p: P) => <Ic {...p}><path d="M20 4L4 11l7 2 2 7z" /></Ic>;
export const Zurueck = (p: P) => <Ic {...p}><path d="M15 5l-7 7 7 7" /></Ic>;
export const Weiter = (p: P) => <Ic {...p}><path d="M9 5l7 7-7 7" /></Ic>;
export const Schliessen = (p: P) => <Ic {...p}><path d="M6 6l12 12M18 6L6 18" /></Ic>;
export const Pfeil = (p: P) => <Ic {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Ic>;
export const Telefon = (p: P) => <Ic {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" /></Ic>;
export const Extern = (p: P) => <Ic {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></Ic>;
export const Teilen = (p: P) => <Ic {...p}><path d="M12 15V4M8 8l4-4 4 4M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" /></Ic>;
export const Gehen = (p: P) => <Ic {...p}><circle cx="13" cy="4.5" r="1.8" /><path d="M9 21l2.5-6.5L14 17v4M8 12l2.5-4 3.5 1 2 3M11.5 14.5L10.5 9" /></Ic>;
export const Bus = (p: P) => <Ic {...p}><rect x="6" y="4" width="12" height="13" rx="3" /><path d="M6 11h12M9 20l-1.5 1.5M15 20l1.5 1.5" /></Ic>;
export const Plus = (p: P) => <Ic {...p}><path d="M12 5v14M5 12h14" /></Ic>;
export const Minus = (p: P) => <Ic {...p}><path d="M5 12h14" /></Ic>;

/** Lotse-Zeichen: Pfeil eines Lotsen im abgerundeten Quadrat */
export function Marke({ size = 26 }: { size?: number }) {
  return (
    <span className="marke" style={{ width: size, height: size, borderRadius: size * 0.3 }} aria-hidden="true">
      {/* Lotse-Zeichen: geschwungene Route mit Start- und Zielpunkt */}
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 20 20" className="marke-route">
        <path d="M5.5 15.5C5.5 10.5 14.5 9.5 14.5 4.5" />
        <circle cx="5.5" cy="15.5" r="1.6" />
        <circle cx="14.5" cy="4.5" r="1.6" />
      </svg>
    </span>
  );
}
export const Rad = (p: P) => <Ic {...p}><circle cx="6" cy="16" r="3.5" /><circle cx="18" cy="16" r="3.5" /><path d="M6 16l4-8h5l3 8M10 8l2 8h-6M14 5h2" /></Ic>;
export const Auto = (p: P) => <Ic {...p}><path d="M5 16V12l2-5h10l2 5v4M5 16h14M5 16v2M19 16v2M4 12h16" /><path d="M8 14h.01M16 14h.01" /></Ic>;
export const Ki = (p: P) => <Ic {...p}><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z" /></Ic>;
export const Uhr = (p: P) => <Ic {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Ic>;
export const Route = (p: P) => <Ic {...p}><path d="M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /><path d="M8 17h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" /></Ic>;
export const Essen = (p: P) => <Ic {...p}><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 0-3.5 2.5-3.5 6S15 13 17 13" /></Ic>;
export const Tasse = (p: P) => <Ic {...p}><path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3" /></Ic>;
export const Pille = (p: P) => <Ic {...p}><path d="M9.2 18.8a3.9 3.9 0 0 1-5.5-5.5l9.6-9.6a3.9 3.9 0 0 1 5.5 5.5zM8.5 8.5l7 7" /></Ic>;
export const Stetho = (p: P) => <Ic {...p}><path d="M6 3v5a4 4 0 0 0 8 0V3M10 12v2.5a4.5 4.5 0 0 0 9 0V12" /><circle cx="19" cy="10" r="2" /></Ic>;
export const Wagen = (p: P) => <Ic {...p}><path d="M3 4h2.5l2 11h10l2-8H7" /><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></Ic>;
export const Stern = (p: P) => <Ic {...p}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></Ic>;
export const Merken = (p: P) => <Ic {...p}><path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z" /></Ic>;
