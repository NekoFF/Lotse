/**
 * Alle externen Dienste an einer Stelle.
 *
 * Schulprojekt: kostenlose, öffentliche Dienste auf Basis von OpenStreetMap (fair use, kein Schlüssel).
 * Echtbetrieb: dieselben offenen Programme auf eigenen Servern oder bei einem Anbieter mieten
 * und hier nur die Adressen tauschen. Der übrige Code bleibt gleich.
 *
 * | Aufgabe          | jetzt (kostenlos)               | Echtbetrieb (Beispiel)                               |
 * |------------------|---------------------------------|------------------------------------------------------|
 * | Karte            | OpenFreeMap                     | eigene Kacheln (z. B. OpenMapTiles) oder MapTiler    |
 * | Adressen, Praxen | Nominatim (OSMF)                | eigene Nominatim-Instanz, Geoapify, LocationIQ        |
 * | Wege             | routing.openstreetmap.de (OSRM) | eigener OSRM/Valhalla-Server, GraphHopper, Stadia    |
 * | Bus & Bahn       | noch nicht angebunden           | Fahrplanauskunft des Verkehrsverbunds (z. B. RMV)    |
 */
export const DIENSTE = {
  kartenStil: {
    light: "https://tiles.openfreemap.org/styles/positron",
    dark: "https://tiles.openfreemap.org/styles/dark",
  },
  nominatim: "https://nominatim.openstreetmap.org",
  routing: {
    fuss: "https://routing.openstreetmap.de/routed-foot",
    rad: "https://routing.openstreetmap.de/routed-bike",
    auto: "https://routing.openstreetmap.de/routed-car",
  },
  /** Offizielle Arztsuche (Kassenärztliche Bundesvereinigung) als ehrlicher Ausweg */
  arztsuche: "https://arztsuche.116117.de/",
} as const;

/** Wartezeit, nach der eine Anfrage als gescheitert gilt (ms) */
export const ZEITLIMIT = 12000;

/** Höchstens so viele Praxen bekommen echte Fahrzeiten (die nächsten nach Luftlinie) */
export const MAX_ZIELE = 25;

/** Suchradien in km, nacheinander angeboten, wenn nichts gefunden wurde */
export const RADIEN = [4, 10, 25];
