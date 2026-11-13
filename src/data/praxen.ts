import type { FachId } from "./fachrichtungen";
import { ORTE, START, type LngLat, type Weg } from "./geo";

/**
 * BEISPIELDATEN für den Prototyp.
 * Namen, Adressen und Fahrzeiten sind erfunden. Wird durch den geprüften
 * Praxisdatensatz (AP Michal) und echte Fahrzeiten aus der Routenabfrage ersetzt.
 */
export interface Praxis {
  id: string;
  fach: FachId;
  name: string;
  strasse: string;
  ort: string;
  /** Fahrzeit ab Startpunkt in Minuten — vorerst Beispielwert */
  fahrzeit: number;
  /** Luftlinie in km — nur zum Vergleich, sortiert wird nach Fahrzeit */
  entfernung: number;
  verbindung: string;
  sprechzeiten: string;
  barrierefrei: boolean;
  /** Lage der Praxis (echte Straße, erfundene Praxis) */
  lngLat: LngLat;
  /** "fuss" = zu Fuß, "oepnv" = Bus/Bahn */
  modus: "fuss" | "oepnv";
  /** Weg auf der Karte (Beispiel, vorab berechnet) */
  weg: Weg;
  /** Ausweichweg für Plan B, falls vorhanden */
  planb: Weg | null;
}

type Roh = [name: string, strasse: string, ort: string, fahrzeit: number, entfernung: number, verbindung: string, barrierefrei: boolean];

const ROH: Record<FachId, Roh[]> = {
  ortho: [
    ["Praxis am Kornmarkt", "Kornmarkt 7", "Wetzlar", 14, 2.4, "Bus 12, direkt", true],
    ["Orthopädie am Dom", "Domplatz 3", "Wetzlar", 24, 0.9, "zu Fuß", false],
    ["Orthopädie Lahnblick", "Lahnstraße 41", "Wetzlar", 31, 1.6, "Bus 31, zweimal umsteigen", true],
    ["Gelenkzentrum Gießen", "Bahnhofstraße 18", "Gießen", 38, 14.2, "RB 40, dann zu Fuß", true],
  ],
  derma: [
    ["Hautarztpraxis Neustadt", "Neustadt 22", "Wetzlar", 19, 1.8, "Bus 12", true],
    ["Dermatologie am Park", "Parkstraße 5", "Gießen", 31, 13.6, "RB 40", false],
    ["Hautzentrum Mittelhessen", "Frankfurter Straße 90", "Gießen", 44, 15.1, "RB 40, Bus 2", true],
  ],
  zahn: [
    ["Zahnarztpraxis Silhöfer Tor", "Silhöfer Straße 12", "Wetzlar", 9, 0.7, "zu Fuß", false],
    ["Zahnmedizin am Dom", "Domplatz 9", "Wetzlar", 17, 0.9, "Bus 31", true],
    ["Praxis Lahn-Dill", "Hauptstraße 60", "Dillenburg", 26, 27.3, "RB 95", true],
  ],
  auge: [
    ["Augenarztpraxis Bahnhofstraße", "Bahnhofstraße 2", "Wetzlar", 16, 0.4, "Bus 12", true],
    ["Augenzentrum Gießen", "Liebigstraße 14", "Gießen", 29, 13.9, "RB 40", true],
  ],
  hno: [
    ["HNO-Praxis Langgasse", "Langgasse 31", "Wetzlar", 12, 1.1, "Bus 12", false],
    ["HNO am Seltersweg", "Seltersweg 64", "Gießen", 33, 14.4, "RB 40, zu Fuß", true],
  ],
  gyn: [
    ["Frauenarztpraxis am Schillerplatz", "Schillerplatz 4", "Wetzlar", 15, 1.3, "Bus 31", true],
    ["Frauenheilkunde Gießen-Mitte", "Marktplatz 11", "Gießen", 32, 14.0, "RB 40", true],
  ],
  uro: [
    ["Urologie Wetzlar-Ost", "Hermannsteiner Straße 25", "Wetzlar", 18, 2.9, "Bus 13", true],
    ["Urologische Praxis Gießen", "Ludwigstraße 50", "Gießen", 35, 14.8, "RB 40, Bus 1", false],
  ],
  kinder: [
    ["Kinder- und Jugendarztpraxis Büblingshausen", "Am Rosengärtchen 6", "Wetzlar", 13, 2.2, "Bus 15", true],
    ["Kinderarztpraxis Neustadt", "Neustadt 8", "Wetzlar", 18, 1.7, "Bus 12", true],
    ["Kinder- und Jugendmedizin Gießen", "Nordanlage 20", "Gießen", 34, 14.3, "RB 40", true],
  ],
  psych: [
    ["Psychotherapeutische Praxis Altstadt", "Krämerstraße 10", "Wetzlar", 11, 0.8, "zu Fuß", false],
    ["Psychotherapie am Lahnufer", "Uferstraße 3", "Wetzlar", 21, 1.4, "Bus 31", true],
    ["Psychotherapeutische Sprechstunde Gießen", "Goethestraße 12", "Gießen", 36, 14.1, "RB 40", true],
  ],
  allgemein: [
    ["Hausarztpraxis Neustadt", "Neustadt 15", "Wetzlar", 10, 1.6, "Bus 12", true],
    ["Allgemeinmedizin am Karl-Kellner-Ring", "Karl-Kellner-Ring 28", "Wetzlar", 14, 0.6, "zu Fuß", true],
    ["Hausärzte Niedergirmes", "Hauptstraße 102", "Wetzlar", 22, 2.5, "Bus 13", false],
  ],
};

const SPRECHZEITEN = "Mo–Fr 8–12 Uhr, Mo, Di, Do 15–18 Uhr";

/** Luftlinie in km zwischen zwei Punkten */
export function luftlinie(a: LngLat, b: LngLat): number {
  const r = Math.PI / 180, dLat = (b[1] - a[1]) * r, dLng = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function praxenFuer(fach: FachId): Praxis[] {
  return (ROH[fach] ?? []).map(([name, strasse, ort, fahrzeit, , verbindung, barrierefrei], i) => {
    const o = ORTE[`${strasse}|${ort}`];
    // Zu Fuß: Gehzeit aus dem echten Fußweg. Bus/Bahn: Beispielwert bis zur echten Fahrplanabfrage.
    const zeit = o.mode === "fuss" ? Math.max(1, Math.round(o.haupt.s / 60)) : fahrzeit;
    return {
      id: `${fach}-${i}`,
      fach,
      name,
      strasse,
      ort,
      fahrzeit: zeit,
      entfernung: Math.round(luftlinie(START.lngLat, o.lngLat) * 10) / 10,
      verbindung,
      sprechzeiten: SPRECHZEITEN,
      barrierefrei,
      lngLat: o.lngLat,
      modus: o.mode,
      weg: o.haupt,
      planb: o.planb,
    };
  }).sort((a, b) => a.fahrzeit - b.fahrzeit);
}
