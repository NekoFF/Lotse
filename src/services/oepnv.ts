import type { LngLat } from "../data/praxen";
import { DienstFehler, holeJson } from "./dienste";

/**
 * Bus & Bahn über Transitous (offener MOTIS-Routingdienst, Daten DELFI/GTFS + Echtzeit, wo vorhanden).
 * Bedingungen: open source, nicht kommerziell, sparsam; Quellenlink sichtbar (transitous.org/sources).
 * Echtbetrieb/kommerziell: eigener MOTIS-Server mit denselben offenen Daten – nur die Adresse tauschen.
 */
export const TRANSITOUS = "https://api.transitous.org/api/v1/plan";
export const TRANSITOUS_QUELLEN = "https://transitous.org/sources/";

export interface Abschnitt {
  art: "fuss" | "oepnv";
  /** z. B. „RE99“, „Bus 170“ */
  linie: string;
  /** Bus, Bahn, Straßenbahn … */
  verkehrsmittel: string;
  von: string;
  nach: string;
  ab: Date;
  an: Date;
  /** Verspätung in Minuten laut Echtzeit (null = keine Echtzeit) */
  verspaetung: number | null;
  ausfall: boolean;
  richtung: string;
  line: LngLat[];
}

export interface Fahrt { ab: Date; an: Date; dauerS: number; umstiege: number; abschnitte: Abschnitt[] }

const ART: Record<string, string> = {
  BUS: "Bus", COACH: "Fernbus", TRAM: "Straßenbahn", SUBWAY: "U-Bahn", METRO: "S-Bahn", RAIL: "Zug", REGIONAL_RAIL: "Regionalzug",
  REGIONAL_FAST_RAIL: "Regionalexpress", HIGHSPEED_RAIL: "Fernzug", LONG_DISTANCE: "Fernzug", NIGHT_RAIL: "Nachtzug", FERRY: "Fähre", SUBURBAN: "S-Bahn",
};

/** Google-Polylinie (MOTIS: Genauigkeit 7) → Koordinaten */
export function polylinie(text: string, genauigkeit = 7): LngLat[] {
  const f = 10 ** genauigkeit;
  const aus: LngLat[] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < text.length) {
    for (const achse of [0, 1]) {
      let b, s = 0, r = 0;
      do { b = text.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20);
      const d = r & 1 ? ~(r >> 1) : r >> 1;
      if (achse === 0) lat += d; else lng += d;
    }
    aus.push([lng / f, lat / f]);
  }
  return aus;
}

interface MLeg {
  mode: string; startTime: string; endTime: string; scheduledStartTime: string; realTime: boolean; cancelled?: boolean;
  routeShortName?: string; displayName?: string; headsign?: string;
  from: { name: string }; to: { name: string }; legGeometry?: { points: string; precision?: number };
}

/** Verbindungen; mit ankunft = „spätestens dort sein“, sonst Abfahrt ab jetzt/ab */
export async function verbindungen(start: LngLat, ziel: LngLat, zeit: { ankunft?: Date; ab?: Date } = {}): Promise<Fahrt[]> {
  const p = new URLSearchParams({ fromPlace: `${start[1].toFixed(5)},${start[0].toFixed(5)}`, toPlace: `${ziel[1].toFixed(5)},${ziel[0].toFixed(5)}`, numItineraries: "3" });
  if (zeit.ankunft) { p.set("time", zeit.ankunft.toISOString()); p.set("arriveBy", "true"); }
  else if (zeit.ab) p.set("time", zeit.ab.toISOString());
  const r = await holeJson<{ itineraries?: { duration: number; startTime: string; endTime: string; transfers: number; legs: MLeg[] }[] }>(`${TRANSITOUS}?${p}`, "Fahrplanauskunft");
  if (!r.itineraries) throw new DienstFehler("Fahrplanauskunft lieferte keine Verbindungen.");
  return r.itineraries.map((it) => ({
    ab: new Date(it.startTime), an: new Date(it.endTime), dauerS: it.duration, umstiege: it.transfers,
    abschnitte: it.legs.map((l) => {
      const fuss = l.mode === "WALK" || l.mode === "BIKE";
      const plan = new Date(l.scheduledStartTime).getTime(), echt = new Date(l.startTime).getTime();
      const vm = ART[l.mode] ?? "ÖPNV";
      return {
        art: fuss ? "fuss" : "oepnv", verkehrsmittel: fuss ? "zu Fuß" : vm,
        linie: fuss ? "" : (l.displayName || l.routeShortName || vm),
        von: l.from.name === "START" ? "Start" : l.from.name, nach: l.to.name === "END" ? "Ziel" : l.to.name,
        ab: new Date(l.startTime), an: new Date(l.endTime),
        verspaetung: !fuss && l.realTime ? Math.round((echt - plan) / 60000) : null,
        ausfall: !!l.cancelled, richtung: l.headsign ?? "",
        line: l.legGeometry?.points ? polylinie(l.legGeometry.points, l.legGeometry.precision ?? 7) : [],
      } satisfies Abschnitt;
    }),
  }));
}
