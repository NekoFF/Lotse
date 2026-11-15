import { useEffect, useRef, useState } from "react";
import { MODI, type Start } from "../data/praxen";
import { fehlerText } from "../services/dienste";
import type { Ort } from "../services/orte";
import { ART_NAME, PUFFER, plane, type Planung, type Termin, type TerminArt, type Verkehr } from "../lib/termine";
import { Bus, Kalender, Plus, Standort, Uhr } from "../ui/icons";
import { Kopf, MODUS_ICON, tagKurz, uhr } from "./Inhalte";

const VERKEHR_NAME: Record<Verkehr, string> = { fuss: "Zu Fuß", rad: "Rad", auto: "Auto", oepnv: "Bus & Bahn" };
const z = (n: number) => String(n).padStart(2, "0");
const alsWert = (d: Date) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
const min = (s: number) => Math.max(1, Math.round(s / 60));

/* ---------- Termin anlegen / bearbeiten ---------- */

export function TerminForm({ vorhanden, ort, vorschlag, start, onStartGps, onSpeichern, onLoeschen, onKalender, onZurueck, onZu }: {
  vorhanden: Termin | null; ort: Ort | null; vorschlag: Date; start: Start | null;
  onStartGps: () => void; onSpeichern: (t: Termin) => void; onLoeschen: () => void; onKalender: (t: Termin) => void;
  onZurueck?: () => void; onZu: () => void;
}) {
  const o = vorhanden?.ort ?? ort;
  const [art, setArt] = useState<TerminArt>(vorhanden?.art ?? (o?.fach || /arzt|praxis|klinik/i.test(o?.art ?? "") ? "arzt" : o ? "treffen" : "erinnerung"));
  const [titel, setTitel] = useState(vorhanden?.titel ?? (o?.name ?? ""));
  const [wert, setWert] = useState(alsWert(vorhanden ? new Date(vorhanden.zeit) : vorschlag));
  const [verkehr, setVerkehr] = useState<Verkehr>(vorhanden?.verkehr ?? "fuss");
  const [puffer, setPuffer] = useState(vorhanden?.puffer ?? 10);
  const [plan, setPlan] = useState<{ key: string; p: Planung | null; laden: boolean; fehler?: string }>({ key: "", p: null, laden: false });
  const zeit = new Date(wert);
  const gueltig = !isNaN(zeit.getTime()) && titel.trim().length > 0;
  const planStart = vorhanden?.start ?? start;

  // Weg live berechnen (leicht verzögert, damit nicht jede Eingabe eine Anfrage auslöst)
  const key = o && planStart && gueltig ? `${o.id}|${planStart.lngLat.join()}|${wert}|${verkehr}|${puffer}` : "";
  const keyRef = useRef(key);
  keyRef.current = key;
  useEffect(() => {
    if (!key || !o || !planStart) return;
    setPlan({ key, p: null, laden: true });
    const t = window.setTimeout(() => {
      plane(o, planStart, zeit, verkehr, puffer).then(
        (p) => { if (keyRef.current === key) setPlan({ key, p, laden: false }); },
        (e) => { if (keyRef.current === key) setPlan({ key, p: null, laden: false, fehler: fehlerText(e) }); },
      );
    }, 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const p = plan.key === key ? plan.p : null;

  const speichern = () => onSpeichern({
    id: vorhanden?.id ?? `t-${Date.now().toString(36)}`, art, titel: titel.trim(), ort: art === "erinnerung" && !o ? null : o, zeit: zeit.toISOString(),
    start: o ? planStart : null, verkehr: o ? verkehr : null, puffer,
    los: p?.los?.toISOString() ?? null, dauerS: p?.dauerS ?? null, weg: p?.weg ?? null, hinweis: p?.hinweis ?? null, geprueft: p ? new Date().toISOString() : null,
  });

  return (
    <div className="inhalt termin">
      <Kopf titel={vorhanden ? "Termin" : "Neuer Termin"} unter={o?.name} onZurueck={onZurueck} onZu={onZu} />
      <div className="chips">
        {(Object.keys(ART_NAME) as TerminArt[]).map((a) => (
          <button key={a} type="button" className={`chip${art === a ? " an" : ""}`} onClick={() => setArt(a)}>{ART_NAME[a]}</button>
        ))}
      </div>
      <div className="infos formular">
        <label className="info"><span>Titel</span><input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder={art === "treffen" ? "z. B. Kino mit Anna" : art === "arzt" ? "z. B. Zahnarzt" : "Woran erinnern?"} /></label>
        <label className="info"><span>Wann</span><input type="datetime-local" value={wert} onChange={(e) => setWert(e.target.value)} /></label>
        {o && <div className="info"><span>Wo</span><b>{o.name}{o.adresse ? <span className="leise">{o.adresse}</span> : null}</b></div>}
      </div>

      {o && (
        <>
          <div className="start-wahl">
            <span className="punkt-ic"><Standort size={15} /></span>
            {planStart ? <span className="start-name">ab {planStart.name}</span> : <span className="start-name leise">Startpunkt fehlt</span>}
            {!vorhanden && <button type="button" className="link" onClick={onStartGps}>{planStart?.quelle === "gps" ? "Aktualisieren" : "Mein Standort"}</button>}
          </div>
          <div className="modi" role="radiogroup" aria-label="Wie kommst du hin?">
            {[...MODI, "oepnv" as const].map((m) => (
              <button key={m} type="button" role="radio" aria-checked={verkehr === m} className={`modus${verkehr === m ? " an" : ""}`} onClick={() => setVerkehr(m)}>
                {m === "oepnv" ? <Bus size={17} /> : MODUS_ICON[m]}<span>{VERKEHR_NAME[m]}</span>
              </button>
            ))}
          </div>
          <div className="segment" role="radiogroup" aria-label="Puffer">
            {PUFFER.map((x) => (
              <button key={x.min} type="button" role="radio" aria-checked={puffer === x.min} className={puffer === x.min ? "an" : ""} onClick={() => setPuffer(x.min)}>{x.name} · {x.min} Min</button>
            ))}
          </div>
          {planStart && (
            <div className={`los-box gross${p?.hinweis ? " warnung" : ""}`}>
              <Uhr size={20} />
              {plan.laden && <span>Weg wird berechnet …</span>}
              {!plan.laden && p?.los && <span>Los um <b className="mono">{uhr(p.los)}</b>{p.dauerS ? ` · ${min(p.dauerS)} Min unterwegs` : ""}{p.weg ? <><br /><span className="leise">{p.weg}</span></> : null}{p.hinweis ? <><br /><b className="rot-t">{p.hinweis}</b></> : null}</span>}
              {!plan.laden && !p?.los && <span>{plan.fehler ?? p?.hinweis ?? "Kein Weg berechenbar."}</span>}
            </div>
          )}
        </>
      )}

      <button type="button" className="btn primaer" disabled={!gueltig} onClick={speichern}>{vorhanden ? "Speichern" : "Termin merken"}</button>
      {vorhanden && (
        <div className="zwei">
          <button type="button" className="btn zweit" onClick={() => onKalender(vorhanden)}><Kalender size={17} /> In Kalender</button>
          <button type="button" className="btn zweit" onClick={onLoeschen}>Löschen</button>
        </div>
      )}
      <p className="fein">{o ? "Lotse prüft den Weg regelmäßig neu (Bus & Bahn mit Echtzeit) und sagt Bescheid, wenn du früher los musst. Den Termin selbst vereinbarst du beim Ort." : "Lotse erinnert dich zur eingestellten Zeit, solange die App offen ist – zuverlässig über „In Kalender“."}</p>
    </div>
  );
}

/* ---------- Alle Termine ---------- */

export function TermineListe({ termine, onTermin, onNeu, onZu }: { termine: Termin[]; onTermin: (t: Termin) => void; onNeu: () => void; onZu: () => void }) {
  const heute = new Date().toDateString();
  const morgen = new Date(Date.now() + 86400_000).toDateString();
  const gruppe = (t: Termin) => { const d = new Date(t.zeit).toDateString(); return d === heute ? "Heute" : d === morgen ? "Morgen" : "Später"; };
  const gruppen = ["Heute", "Morgen", "Später"].map((g) => ({ g, l: termine.filter((t) => gruppe(t) === g) })).filter((x) => x.l.length);
  return (
    <div className="inhalt termine-liste">
      <Kopf titel="Termine" onZu={onZu} />
      <button type="button" className="btn zweit" onClick={onNeu}><Plus size={16} /> Neue Erinnerung</button>
      {gruppen.length === 0 && <div className="box"><b>Noch keine Termine.</b><span>Öffne einen Ort und tippe auf „Termin“ – oder schreib z. B. „Termin morgen 10 Uhr Zahnarzt“.</span></div>}
      {gruppen.map(({ g, l }) => (
        <section key={g}>
          <h3 className="abschnitt">{g}</h3>
          <div className="zeilen">
            {l.map((t) => {
              const d = new Date(t.zeit);
              return (
                <button key={t.id} type="button" className="zeile" onClick={() => onTermin(t)}>
                  <span className="zeile-ic akzent-ic"><Kalender size={16} /></span>
                  <span className="zeile-t">
                    <b>{t.titel}</b>
                    <span>{tagKurz(d)}, {uhr(d)}{t.los ? ` · los ${uhr(new Date(t.los))}` : ""}{t.weg ? ` · ${t.weg}` : ""}</span>
                    {t.hinweis && <span className="rot-t">{t.hinweis}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
