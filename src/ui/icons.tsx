/* Schlichte Symbole im Stil der SF Symbols, als Inline-SVG (keine externe Bibliothek). */
type P = { className?: string };
const s = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const ChevronLeft = ({ className }: P) => (
  <svg className={className} viewBox="0 0 13 21" aria-hidden="true"><path d="M11 2 2.5 10.5 11 19" {...s} strokeWidth={2.6} /></svg>
);
export const ChevronRight = ({ className = "chev" }: P) => (
  <svg className={className} viewBox="0 0 8 13" aria-hidden="true"><path d="m1.5 1.5 5 5-5 5" {...s} strokeWidth={2} /></svg>
);
export const Bubble = ({ className }: P) => (
  <svg className={className} viewBox="0 0 28 28" aria-hidden="true"><path d="M5 6.5C5 5.1 6.1 4 7.5 4h13C21.9 4 23 5.1 23 6.5v9c0 1.4-1.1 2.5-2.5 2.5H12l-5 4.5V18h0c-1.1 0-2-.9-2-2V6.5Z" {...s} strokeWidth={2} /><path d="M10 9.5h8M10 13h5" {...s} strokeWidth={2} /></svg>
);
export const Calendar = ({ className }: P) => (
  <svg className={className} viewBox="0 0 28 28" aria-hidden="true"><rect x="4.5" y="6" width="19" height="17" rx="3.5" {...s} strokeWidth={2} /><path d="M4.5 11.5h19M9.5 3.5v4M18.5 3.5v4" {...s} strokeWidth={2} /><circle cx="10" cy="16" r="1.3" fill="currentColor" /><circle cx="14" cy="16" r="1.3" fill="currentColor" /><circle cx="18" cy="16" r="1.3" fill="currentColor" /></svg>
);
export const Info = ({ className }: P) => (
  <svg className={className} viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="10" {...s} strokeWidth={2} /><path d="M14 12.5v6.5" {...s} strokeWidth={2.2} /><circle cx="14" cy="8.8" r="1.4" fill="currentColor" /></svg>
);
export const Close = ({ className }: P) => (
  <svg className={className} viewBox="0 0 12 12" aria-hidden="true"><path d="m2 2 8 8M10 2l-8 8" {...s} strokeWidth={2.2} /></svg>
);
export const Shield = ({ className }: P) => (
  <svg className={className} viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 2.5 3.5v4c0 3.3 2.3 5.8 5.5 7 3.2-1.2 5.5-3.7 5.5-7v-4L8 1.5Z" {...s} strokeWidth={1.4} /></svg>
);
export const Route = ({ className }: P) => (
  <svg className={className} viewBox="0 0 20 20" aria-hidden="true"><circle cx="5" cy="15" r="2.2" {...s} strokeWidth={1.8} /><circle cx="15" cy="5" r="2.2" {...s} strokeWidth={1.8} /><path d="M7 15h4.5a3 3 0 0 0 0-6h-3a3 3 0 0 1 0-6H13" {...s} strokeWidth={1.8} /></svg>
);
export const Lock = ({ className }: P) => (
  <svg className={className} viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="9" width="11" height="8" rx="2" {...s} strokeWidth={1.8} /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" {...s} strokeWidth={1.8} /></svg>
);
export const Phone = ({ className }: P) => (
  <svg className={className} viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 3h3l1.5 4-2 1.2a9 9 0 0 0 4.8 4.8L13 11l4 1.5v3a1.5 1.5 0 0 1-1.6 1.5C8.6 16.6 3.4 11.4 3 4.6A1.5 1.5 0 0 1 4.5 3Z" {...s} strokeWidth={1.7} /></svg>
);
