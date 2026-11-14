import type { Ort } from "../services/orte";

/** Gespeicherte Orte – nur in diesem Browser */
const KEY = "lotse.gespeichert.v1";

export function leseGespeichert(): Ort[] {
  try { return (JSON.parse(localStorage.getItem(KEY) ?? "[]") as Ort[]).filter((o) => o?.id && Array.isArray(o.lngLat)); } catch { return []; }
}

export function umschalten(o: Ort): Ort[] {
  const l = leseGespeichert();
  const neu = l.some((x) => x.id === o.id) ? l.filter((x) => x.id !== o.id) : [o, ...l].slice(0, 50);
  try { localStorage.setItem(KEY, JSON.stringify(neu)); } catch { /* privates Fenster */ }
  return neu;
}
