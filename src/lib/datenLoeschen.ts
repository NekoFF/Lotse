/** Alles löschen, was Lotse in diesem Browser abgelegt hat (Termine, Orte, Verlauf, Einwilligung, Zähler, KI-Modell). */
export async function allesLoeschen(): Promise<void> {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("lotse.")) localStorage.removeItem(k);
    for (const k of Object.keys(sessionStorage)) if (k.startsWith("lotse.")) sessionStorage.removeItem(k);
  } catch { /* privates Fenster */ }
  try {
    if ("caches" in window) for (const n of await caches.keys()) if (/webllm|mlc|tvmjs/i.test(n)) await caches.delete(n);
  } catch { /* egal */ }
  try {
    const dbs = (await indexedDB.databases?.()) ?? [];
    for (const d of dbs) if (d.name && /webllm|mlc|tvmjs/i.test(d.name)) await new Promise<void>((fertig) => { const r = indexedDB.deleteDatabase(d.name!); r.onsuccess = r.onerror = r.onblocked = () => fertig(); });
  } catch { /* egal */ }
}

export const EINWILLIGUNG = "lotse.einwilligung.gesundheit";
export const hatEinwilligung = () => { try { return localStorage.getItem(EINWILLIGUNG) === "ja"; } catch { return false; } };
export const widerrufen = () => { try { localStorage.removeItem(EINWILLIGUNG); } catch { /* egal */ } };
export const einwilligen = () => { try { localStorage.setItem(EINWILLIGUNG, "ja"); } catch { /* privates Fenster: gilt nur für diesen Aufruf */ } };
