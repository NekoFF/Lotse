import { useEffect, useState, type ReactNode } from "react";
import { fotoLaden, type Foto } from "../services/foto";
import { DIENSTE } from "../config";
import type { Kategorie } from "../core/absicht";
import { KATEGORIEN } from "../core/absicht";
import { luftlinie, MODI, zeitenLesbar, type LngLat, type Modus, type Start } from "../data/praxen";
import type { KiStatus } from "../ki/assistent";
import type { WegStand } from "../lib/wege";
import { PUFFER_MIN, type Termin } from "../lib/termine";
import { telLink } from "../services/dienste";
import type { Ort } from "../services/orte";
import { Auto, Brief, Bus, Essen, Extern, Gehen, Kalender, Merken, Pille, Rad, Route as RouteIc, Schliessen, Standort, Stern, Stetho, Suche, Tasse, Teilen, Telefon, Uhr, Wagen, Zurueck } from "../ui/icons";

export const uhr = (d: Date) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
export const tagKurz = (d: Date) => d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
const km = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);
const min = (s: number) => Math.max(1, Math.round(s / 60));
export const MODUS_ICON: Record<Modus, ReactNode> = { fuss: <Gehen size={17} />, rad: <Rad size={17} />, auto: <Auto size={17} /> };
export const MODUS_NAME: Record<Modus, string> = { fuss: "zu Fuß", rad: "mit dem Rad", auto: "mit dem Auto" };
const MODUS_KURZ: Record<Modus, string> = { fuss: "Zu Fuß", rad: "Rad", auto: "Auto" };
const ROLLSTUHL: Record<string, string> = { yes: "rollstuhlgerecht", limited: "teilweise rollstuhlgerecht", no: "nicht rollstuhlgerecht" };

/** Kopfzeile einer Ansicht: Titel, Untertitel, Schließen */
export function Kopf({ titel, unter, onZu, onZurueck }: { titel: string; unter?: string; onZu?: () => void; onZurueck?: () => void }) {
  return (
    <div className="ansicht-kopf">
      {onZurueck && <button type="button" className="rund klein" aria-label="Zurück" onClick={onZurueck}><Zurueck size={17} /></button>}
      <div className="ansicht-titel"><h2>{titel}</h2>{unter && <span>{unter}</span>}</div>
      {onZu && <button type="button" className="rund klein" aria-label="Schließen" onClick={onZu}><Schliessen size={15} /></button>}
    </div>
  );
}

/* ---------- Ergebnisliste ---------- */

export interface ListenStand { titel: string; unter?: string; orte: Ort[]; laden: boolean; fehler?: string; hinweis?: string; /** von hier aus wurde gesucht */ bezug?: LngLat }

export function ListenInhalt({ l, aktiv, onOrt, onZu, onNeu }: {
  l: ListenStand; aktiv: string | null; onOrt: (o: Ort) => void; onZu: () => void; onNeu: () => void;
}) {
  const mitte = l.bezug ?? null;
  return (
    <div className="inhalt liste">
      <Kopf titel={l.titel} unter={l.unter} onZu={onZu} />
      {l.hinweis && <p className="hinweis">{l.hinweis}</p>}
      {l.laden && <div className="zeilen" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="zeile skelett"><span /><span /></div>)}</div>}
      {l.fehler && <div className="box"><span>{l.fehler}</span><button type="button" className="btn zweit" onClick={onNeu}>Erneut versuchen</button></div>}
      {!l.laden && !l.fehler && l.orte.length === 0 && (
        <div className="box"><b>Nichts gefunden.</b><span>Versuch es anders oder schieb die Karte woandershin.</span></div>
      )}
      {!l.laden && l.orte.length > 0 && (
        <div className="zeilen">
          {l.orte.map((o) => (
            <button key={o.id} type="button" className={`zeile${aktiv === o.id ? " an" : ""}`} onClick={() => onOrt(o)}>
              <span className="zeile-t"><b>{o.name}</b><span>{o.art}{o.adresse ? ` · ${o.adresse}` : ""}</span></span>
              {mitte && <span className="zeile-r">{km(luftlinie(mitte, o.lngLat) * 1000)}</span>}
            </button>
          ))}
        </div>
      )}
      {!l.laden && l.orte.length > 0 && mitte && <p className="fein">Entfernung Luftlinie. Echte Wege beim Antippen.</p>}
    </div>
  );
}

/* ---------- Ortskarte ---------- */

/** Freies Foto zum Ort (nur wenn in OSM mit Commons/Wikidata verknüpft) */
function useFoto(o: Ort): Foto | null {
  const [f, setF] = useState<{ id: string; foto: Foto | null }>({ id: "", foto: null });
  useEffect(() => {
    if (!o.bild) return;
    let aus = false;
    fotoLaden(o.bild).then((foto) => { if (!aus) setF({ id: o.id, foto }); }, () => { if (!aus) setF({ id: o.id, foto: null }); });
    return () => { aus = true; };
  }, [o.id, o.bild]);
  return f.id === o.id ? f.foto : null;
}

export function OrtInhalt({ o, laden, weg, modus, gespeichert, onSpeichern, onRoute, onTermin, onTeilen, onZu, onZurueck }: {
  o: Ort; laden: boolean; weg: WegStand; modus: Modus; gespeichert: boolean; onSpeichern: () => void;
  onRoute: () => void; onTermin: () => void; onTeilen: () => void; onZu: () => void; onZurueck?: () => void;
}) {
  const foto = useFoto(o);
  const zeiten = o.oeffnungszeiten ? zeitenLesbar(o.oeffnungszeiten) : [];
  return (
    <div className="inhalt ort">
      <Kopf titel={o.name} unter={[o.art, weg.route ? `${min(weg.route.s)} Min ${MODUS_NAME[modus]}` : null].filter(Boolean).join(" · ")} onZu={onZu} onZurueck={onZurueck} />
      {foto && (
        <figure className="ort-foto">
          <img src={foto.url} alt={o.name} loading="lazy" referrerPolicy="no-referrer" />
          <figcaption><a href={foto.seite} target="_blank" rel="noopener noreferrer">Foto: {foto.autor} · {foto.lizenz} · Wikimedia Commons</a></figcaption>
        </figure>
      )}
      <div className="aktionen-reihe">
        <button type="button" className="aktion primaer" onClick={onRoute}><RouteIc size={20} /><span>Route</span></button>
        <button type="button" className={`aktion${gespeichert ? " an" : ""}`} onClick={onSpeichern} aria-pressed={gespeichert}><Merken size={20} /><span>{gespeichert ? "Gespeichert" : "Speichern"}</span></button>
        {o.telefon && <a className="aktion" href={telLink(o.telefon)}><Telefon size={20} /><span>Anrufen</span></a>}
        {o.website && <a className="aktion" href={o.website} target="_blank" rel="noopener noreferrer"><Extern size={20} /><span>Website</span></a>}
        {o.email && <a className="aktion" href={`mailto:${o.email}`}><Brief size={20} /><span>E-Mail</span></a>}
        <button type="button" className="aktion" onClick={onTermin}><Kalender size={20} /><span>Termin</span></button>
        <button type="button" className="aktion" onClick={onTeilen}><Teilen size={20} /><span>Teilen</span></button>
      </div>
      <div className="infos">
        {o.adresse && <div className="info"><span>Adresse</span><b>{o.adresse}</b></div>}
        {zeiten.length > 0 && <div className="info"><span>Geöffnet</span><b>{zeiten.map((z) => <span key={z}>{z}</span>)}</b></div>}
        {o.telefon && <div className="info"><span>Telefon</span><b><a href={telLink(o.telefon)}>{o.telefon}</a></b></div>}
        {o.email && <div className="info"><span>E-Mail</span><b><a href={`mailto:${o.email}`}>{o.email}</a></b></div>}
        {o.website && <div className="info"><span>Website</span><b><a href={o.website} target="_blank" rel="noopener noreferrer">{new URL(o.website).hostname.replace(/^www\./, "")}</a></b></div>}
        {o.rollstuhl && ROLLSTUHL[o.rollstuhl] && <div className="info"><span>Zugang</span><b>{ROLLSTUHL[o.rollstuhl]}</b></div>}
        {laden && <div className="info"><span /><b className="leise">Lädt Details …</b></div>}
      </div>
      <p className="fein">Daten: <a href={DIENSTE.osmLizenz} target="_blank" rel="noopener noreferrer">OpenStreetMap</a>{o.id.startsWith("punkt") ? "" : <> · <a href={`https://www.openstreetmap.org/${o.id.replace("-", "/")}`} target="_blank" rel="noopener noreferrer">Eintrag</a></>}</p>
    </div>
  );
}

/* ---------- Route ---------- */

export function RouteInhalt({ o, start, modus, setModus, wege, wahl, setWahl, termin, onStartGps, onStartAdresse, onZurueck, onNeu, onZu }: {
  o: Ort; start: Start | null; modus: Modus; setModus: (m: Modus) => void;
  /** echte Routen je Verkehrsmittel (für die Zeiten oben) */
  wege: Record<Modus, WegStand>; wahl: number; setWahl: (i: number) => void; termin: Termin | null;
  onStartGps: () => void; onStartAdresse: (text: string) => void; onZurueck: () => void; onNeu: () => void; onZu: () => void;
}) {
  const [text, setText] = useState("");
  const [schritteAuf, setSchritteAuf] = useState(false);
  const weg = wege[modus];
  const r = weg.routen[wahl] ?? weg.route;
  const los = r && termin ? new Date(new Date(termin.zeit).getTime() - (PUFFER_MIN * 60 + min(r.s) * 60) * 1000) : null;
  return (
    <div className="inhalt route">
      <Kopf titel={o.name} unter="Route" onZurueck={onZurueck} onZu={onZu} />
      <div className="start-wahl">
        <span className="punkt-ic"><Standort size={15} /></span>
        {start ? <span className="start-name">{start.name}</span> : <span className="start-name leise">Startpunkt wählen</span>}
        <button type="button" className="link" onClick={onStartGps}>{start?.quelle === "gps" ? "Aktualisieren" : "Mein Standort"}</button>
      </div>
      {!start && (
        <form className="mini-suche" onSubmit={(e) => { e.preventDefault(); if (text.trim().length > 2) onStartAdresse(text.trim()); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="oder Startadresse eingeben" enterKeyHint="go" />
        </form>
      )}

      {/* Verkehrsmittel mit echter Zeit darunter – wie bei Google Maps */}
      <div className="modi" role="radiogroup" aria-label="Verkehrsmittel">
        {MODI.map((m) => {
          const w = wege[m];
          return (
            <button key={m} type="button" role="radio" aria-checked={modus === m} className={`modus${modus === m ? " an" : ""}`} onClick={() => { setModus(m); setWahl(0); setSchritteAuf(false); }}>
              {MODUS_ICON[m]}
              <span>{!start ? MODUS_KURZ[m] : w.route ? `${min(w.route.s)} Min` : w.status === "fehler" ? "–" : "…"}</span>
            </button>
          );
        })}
        <button type="button" className="modus" disabled title="Fahrplandaten folgen"><Bus size={17} /><span>folgt</span></button>
      </div>

      {start && weg.status === "laden" && <div className="zeilen"><div className="zeile skelett"><span /><span /></div></div>}
      {start && weg.status === "fehler" && <div className="box"><span>{weg.fehler}</span><button type="button" className="btn zweit" onClick={onNeu}>Erneut versuchen</button></div>}

      {weg.routen.length > 0 && (
        <div className="zeilen routen">
          {weg.routen.map((x, i) => (
            <button key={i} type="button" className={`zeile route-wahl${i === wahl ? " an" : ""}`} onClick={() => { setWahl(i); setSchritteAuf(false); }}>
              <span className="zeile-t"><b>{x.ueber ? `über ${x.ueber}` : MODUS_NAME[modus]}</b><span>{km(x.m)}{i === 0 ? " · schnellste" : ""}</span></span>
              <span className="route-min"><b className="mono">{min(x.s)}</b> Min</span>
            </button>
          ))}
        </div>
      )}

      {r && los && termin && (
        <div className="los-box"><Uhr size={18} /><span>Termin <b>{uhr(new Date(termin.zeit))}</b> – los um <b className="mono">{uhr(los)}</b> ({PUFFER_MIN} Min Puffer)</span></div>
      )}

      {r && (
        <>
          <button type="button" className="btn zweit" onClick={() => setSchritteAuf((x) => !x)} aria-expanded={schritteAuf}>
            {schritteAuf ? "Schritte ausblenden" : `Schritte anzeigen (${r.schritte.length})`}
          </button>
          {schritteAuf && (
            <ol className="schritte">
              {r.schritte.map((st, i) => <li key={i}><span>{st.text}</span>{st.m > 0 && <span className="leise">{km(st.m)}</span>}</li>)}
            </ol>
          )}
          <p className="fein">Wege: <a href={DIENSTE.routingInfo} target="_blank" rel="noopener noreferrer">OSRM (FOSSGIS)</a>, ohne aktuelle Verkehrslage · <a href={DIENSTE.osmFehlerMelden} target="_blank" rel="noopener noreferrer">Fehler melden</a></p>
        </>
      )}
    </div>
  );
}

/* ---------- Termin ---------- */

export function TerminInhalt({ o, vorschlag, vorhanden, onSpeichern, onLoeschen, onKalender, onZurueck, onZu }: {
  o: Ort; vorschlag: Date; vorhanden: Termin | null;
  onSpeichern: (d: Date) => void; onLoeschen: () => void; onKalender: () => void; onZurueck: () => void; onZu: () => void;
}) {
  const z = (n: number) => String(n).padStart(2, "0");
  const alsWert = (d: Date) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
  const [wert, setWert] = useState(alsWert(vorhanden ? new Date(vorhanden.zeit) : vorschlag));
  const d = new Date(wert);
  return (
    <div className="inhalt termin">
      <Kopf titel="Termin" unter={o.name} onZurueck={onZurueck} onZu={onZu} />
      <label className="feld-zeile"><span>Wann?</span><input type="datetime-local" value={wert} onChange={(e) => setWert(e.target.value)} /></label>
      <button type="button" className="btn primaer" disabled={isNaN(d.getTime())} onClick={() => onSpeichern(d)}>{vorhanden ? "Ändern" : "Merken"}</button>
      {vorhanden && (
        <div className="zwei">
          <button type="button" className="btn zweit" onClick={onKalender}><Kalender size={17} /> In Kalender</button>
          <button type="button" className="btn zweit" onClick={onLoeschen}>Löschen</button>
        </div>
      )}
      <p className="fein">Den Termin selbst vereinbarst du bei {o.telefon || o.website ? "der Praxis bzw. dem Ort" : "dem Ort"}. Lotse erinnert dich ans Losgehen.</p>
    </div>
  );
}

/* ---------- Daten & Quellen ---------- */

export function InfoInhalt({ onZurueck, onZu }: { onZurueck?: () => void; onZu: () => void }) {
  return (
    <div className="inhalt info-seite">
      <Kopf titel="Daten & Quellen" onZurueck={onZurueck} onZu={onZu} />
      <ul className="liste-punkte">
        <li><b>Deine Beschreibung</b> bleibt auf dem Gerät. Lotse ordnet sie nur einer Fachrichtung zu und stellt keine Diagnose.</li>
        <li><b>Suche und Orte</b>: Nominatim (OpenStreetMap). <b>Wege</b>: FOSSGIS-Routingserver. <b>Karte</b>: OpenFreeMap. Diese Dienste sehen deine IP-Adresse und den gesuchten Ort bzw. Startpunkt.</li>
        <li><b>KI</b> (wenn eingeschaltet) läuft im Browser. Nur das Modell wird einmal von Hugging Face geladen.</li>
        <li><b>Fotos</b> nur aus Wikimedia Commons, wenn ein Ort in OpenStreetMap damit verknüpft ist – immer mit Urheber und Lizenz.</li>
        <li><b>Termine, gespeicherte Orte und Startpunkt</b> bleiben in diesem Browser.</li>
      </ul>
      <p className="fein">
        Kartendaten <a href={DIENSTE.osmLizenz} target="_blank" rel="noopener noreferrer">© OpenStreetMap-Mitwirkende</a> ·
        {" "}<a href={`${import.meta.env.BASE_URL}karte/LIZENZ.txt`} target="_blank" rel="noopener noreferrer">Kartenstil und Lizenzen</a> ·
        {" "}<a href={DIENSTE.osmFehlerMelden} target="_blank" rel="noopener noreferrer">Kartenfehler melden</a> · Schulprojekt der Werner-von-Siemens-Schule Wetzlar.
      </p>
    </div>
  );
}

/* ---------- Schnellzugriff: nur Symbole ---------- */

const SCHNELL: { id: string; ic: ReactNode; farbe: string }[] = [
  { id: "essen", ic: <Essen size={15} />, farbe: "#f08c00" },
  { id: "cafe", ic: <Tasse size={15} />, farbe: "#a0612b" },
  { id: "apotheke", ic: <Pille size={15} />, farbe: "#d6336c" },
  { id: "arzt", ic: <Stetho size={15} />, farbe: "#c2255c" },
  { id: "einkaufen", ic: <Wagen size={15} />, farbe: "#1c7ed6" },
  { id: "freizeit", ic: <Stern size={15} />, farbe: "#7048e8" },
  { id: "haltestelle", ic: <Bus size={15} />, farbe: "#2f5bff" },
];

export function SchnellLeiste({ onKategorie }: { onKategorie: (k: Kategorie) => void }) {
  return (
    <div className="schnell" role="toolbar" aria-label="Schnellzugriff">
      {SCHNELL.map((s) => {
        const k = KATEGORIEN.find((x) => x.id === s.id)!;
        return (
          <button key={s.id} type="button" className="schnell-knopf" style={{ ["--f" as string]: s.farbe }} onClick={() => onKategorie(k)} aria-label={k.name} title={k.name}>
            {s.ic}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Vorschläge beim Tippen (nur vom Gerät, keine Anfrage beim Tippen – Nominatim-Regel) ---------- */

export type Vorschlag =
  | { art: "suchen"; text: string }
  | { art: "kategorie"; k: Kategorie }
  | { art: "zuletzt"; text: string }
  | { art: "termin"; t: Termin }
  | { art: "ort"; o: Ort };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");

export function vorschlaegeFuer(text: string, zuletzt: string[], termine: Termin[], gespeichert: Ort[] = []): Vorschlag[] {
  const q = norm(text.trim());
  if (!q) return [];
  const aus: Vorschlag[] = [{ art: "suchen", text: text.trim() }];
  for (const k of KATEGORIEN) if (norm(k.name).includes(q) || norm(k.id).startsWith(q)) aus.push({ art: "kategorie", k });
  for (const z of zuletzt) if (norm(z).includes(q) && norm(z) !== q) aus.push({ art: "zuletzt", text: z });
  for (const t of termine) if (norm(t.ort.name).includes(q)) aus.push({ art: "termin", t });
  for (const o of gespeichert) if (norm(o.name).includes(q)) aus.push({ art: "ort", o });
  return aus.slice(0, 8);
}

export function VorschlagInhalt({ text, zuletzt, termine, gespeichert, ki, onWahl, onInfo, onVerlaufLoeschen, onZu }: {
  text: string; zuletzt: string[]; termine: Termin[]; gespeichert: Ort[]; ki: KiStatus;
  onWahl: (v: Vorschlag) => void; onInfo: () => void; onVerlaufLoeschen: () => void; onZu: () => void;
}) {
  const liste = vorschlaegeFuer(text, zuletzt, termine, gespeichert);
  const kopf = <Kopf titel={text.trim() ? "Vorschläge" : "Suche"} onZu={onZu} />;
  if (text.trim()) {
    return (
      <div className="inhalt vorschlaege">
        {kopf}
        <div className="zeilen">
          {liste.map((v, i) => (
            <button key={i} type="button" className="zeile" onClick={() => onWahl(v)}>
              <span className="zeile-ic">{v.art === "suchen" ? <Suche size={16} /> : v.art === "zuletzt" ? <Uhr size={16} /> : v.art === "termin" ? <Kalender size={16} /> : v.art === "ort" ? <Merken size={16} /> : SCHNELL.find((s) => s.id === v.k.id)?.ic ?? <Suche size={16} />}</span>
              <span className="zeile-t">
                <b>{v.art === "suchen" ? `„${v.text}“` : v.art === "kategorie" ? v.k.name : v.art === "zuletzt" ? v.text : v.art === "ort" ? v.o.name : v.t.ort.name}</b>
                <span>{v.art === "suchen" ? (ki.art === "bereit" ? "Suchen oder fragen" : "Suchen") : v.art === "kategorie" ? "in der Nähe" : v.art === "zuletzt" ? "zuletzt gesucht" : v.art === "ort" ? `gespeichert · ${v.o.art}` : `Termin ${tagKurz(new Date(v.t.zeit))}, ${uhr(new Date(v.t.zeit))}`}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="inhalt vorschlaege">
      {kopf}
      {zuletzt.length > 0 && (
        <section>
          <div className="abschnitt-kopf"><h3 className="abschnitt">Zuletzt</h3><button type="button" className="link klein-link" onClick={onVerlaufLoeschen}>Löschen</button></div>
          <div className="zeilen">
            {zuletzt.slice(0, 5).map((z) => (
              <button key={z} type="button" className="zeile" onClick={() => onWahl({ art: "zuletzt", text: z })}>
                <span className="zeile-ic"><Uhr size={16} /></span><span className="zeile-t"><b>{z}</b></span>
              </button>
            ))}
          </div>
        </section>
      )}
      {gespeichert.length > 0 && (
        <section>
          <h3 className="abschnitt">Gespeichert</h3>
          <div className="zeilen">
            {gespeichert.slice(0, 5).map((o) => (
              <button key={o.id} type="button" className="zeile" onClick={() => onWahl({ art: "ort", o })}>
                <span className="zeile-ic akzent-ic"><Merken size={16} /></span>
                <span className="zeile-t"><b>{o.name}</b><span>{o.art}{o.adresse ? ` · ${o.adresse}` : ""}</span></span>
              </button>
            ))}
          </div>
        </section>
      )}
      {termine.length > 0 && (
        <section>
          <h3 className="abschnitt">Termine</h3>
          <div className="zeilen">
            {termine.slice(0, 4).map((t) => (
              <button key={t.id} type="button" className="zeile" onClick={() => onWahl({ art: "termin", t })}>
                <span className="zeile-ic akzent-ic"><Kalender size={16} /></span>
                <span className="zeile-t"><b>{t.ort.name}</b><span>{tagKurz(new Date(t.zeit))}, {uhr(new Date(t.zeit))}{t.los ? ` · los ${uhr(new Date(t.los))}` : ""}</span></span>
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="fuss-zeile">
        <span>Notfall <a href="tel:112" className="rot-t stark">112</a> · Bereitschaftsdienst <a href="tel:116117">116 117</a></span>
        <button type="button" className="link" onClick={onInfo}>Daten & Quellen</button>
      </div>
    </div>
  );
}
