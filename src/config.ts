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
 *
 * Nutzungsbedingungen der kostenlosen Dienste (verbindlich, im Code umgesetzt):
 * - Nominatim: https://operations.osmfoundation.org/policies/nominatim/
 *   Höchstens 1 Anfrage pro Sekunde für die GANZE App (alle Nutzer zusammen; im Code nur je Browser-Tab
 *   umsetzbar – für viele Nutzer braucht es einen eigenen Server oder Proxy), keine Suche beim Tippen
 *   (Autovervollständigung verboten), Ergebnisse zwischenspeichern, Quellenangabe OpenStreetMap,
 *   keine systematischen Abfragen. Nur bei „moderater“ Nutzerzahl erlaubt – Echtbetrieb: eigene Instanz.
 * - FOSSGIS-Routing: https://routing.openstreetmap.de/about.html
 *   Höchstens 1 Anfrage pro Sekunde, keine starke Last, Quellenangabe + Link „Kartenfehler melden“.
 *   Anfragen landen dort im Server-Log (Datenschutzerklärung des FOSSGIS e. V.).
 * - OSM-Quellenangabe: https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
 *   Auf der Karte beim Start sichtbar; darf nach 5 s oder bei Kartenbewegung einklappen.
 * Umsetzung: src/services/dienste.ts (Warteschlange je Dienst und Tab + Zwischenspeicher), src/map/LotseMap.tsx.
 */
export const DIENSTE = {
  /** Eigene Stile (aus den OpenFreeMap-Stilen erzeugt: scripts/kartenstil_bauen.py, Lizenzen: public/karte/LIZENZ.txt) */
  kartenStil: {
    light: `${import.meta.env.BASE_URL}karte/stil-hell.json`,
    dark: `${import.meta.env.BASE_URL}karte/stil-dunkel.json`,
  },
  nominatim: "https://nominatim.openstreetmap.org",
  routing: {
    fuss: "https://routing.openstreetmap.de/routed-foot",
    rad: "https://routing.openstreetmap.de/routed-bike",
    auto: "https://routing.openstreetmap.de/routed-car",
  },
  /** Offizielle Arztsuche (Kassenärztliche Bundesvereinigung) als ehrlicher Ausweg */
  arztsuche: "https://arztsuche.116117.de/",
  /** Quellenangabe und Fehlermeldung für OpenStreetMap-Daten (Bedingung von OSMF und FOSSGIS) */
  osmLizenz: "https://www.openstreetmap.org/copyright",
  osmFehlerMelden: "https://www.openstreetmap.org/fixthemap",
  routingInfo: "https://routing.openstreetmap.de/about.html",
} as const;

/** Wartezeit, nach der eine Anfrage als gescheitert gilt (ms) */
export const ZEITLIMIT = 12000;

/** Mindestabstand zwischen zwei Anfragen an denselben Dienst (ms). Bedingung von Nominatim und FOSSGIS: höchstens 1/s. */
export const ABSTAND_MS = 1100;

/** Nominatim liefert höchstens so viele Treffer pro Anfrage (Obergrenze des Dienstes) */
export const NOMINATIM_MAX = 40;

/** Startpunkt wird vor dem Senden auf 4 Nachkommastellen (etwa 10 m) gerundet: Datensparsamkeit */
export const START_STELLEN = 4;

/** Höchstens so viele Praxen bekommen echte Fahrzeiten (die nächsten nach Luftlinie) */
export const MAX_ZIELE = 25;

/** Suchradien in km, nacheinander angeboten, wenn nichts gefunden wurde */
export const RADIEN = [4, 10, 25];
