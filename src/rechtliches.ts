/**
 * Angaben für Impressum und Datenschutzerklärung.
 * VOR EINER VERÖFFENTLICHUNG von Dima einzutragen – der Build für die Veröffentlichung bricht ab,
 * solange hier noch „BITTE EINTRAGEN“ steht (.github/workflows/deploy.yml).
 * Hinweis: Diese Texte sind eine sorgfältige Vorlage für ein Schulprojekt, keine Rechtsberatung.
 */
export const ANBIETER = {
  name: "BITTE EINTRAGEN (Vor- und Nachname)",
  anschrift: "BITTE EINTRAGEN (Straße Nr., PLZ Ort)",
  email: "BITTE EINTRAGEN (Kontakt-E-Mail)",
  rahmen: "Schulprojekt an der Werner-von-Siemens-Schule Wetzlar, nicht kommerziell",
};

export const RECHT_VOLLSTAENDIG = !Object.values(ANBIETER).some((v) => v.includes("BITTE EINTRAGEN"));

/** Wer sieht was – jede Zeile muss zum Code passen (services/, map/, ki/, gebaeude/) */
export const EMPFAENGER: { dienst: string; wer: string; was: string; wann: string }[] = [
  { dienst: "Webseite selbst", wer: "GitHub Pages (GitHub Inc., USA)", was: "IP-Adresse, aufgerufene Datei, Zeitpunkt (Server-Protokoll)", wann: "beim Laden der App" },
  { dienst: "Karte", wer: "OpenFreeMap", was: "IP-Adresse, Kartenausschnitt", wann: "beim Anzeigen der Karte" },
  { dienst: "Suche, Orte, Adressen", wer: "Nominatim (OpenStreetMap Foundation, UK)", was: "IP-Adresse, Suchbegriff bzw. Ort/Kategorie, Kartenausschnitt", wann: "beim Suchen oder Antippen eines Orts" },
  { dienst: "Wege", wer: "FOSSGIS e. V. (routing.openstreetmap.de)", was: "IP-Adresse, Start- und Zielkoordinaten", wann: "bei Wegzeiten und Routen" },
  { dienst: "Bus & Bahn", wer: "Transitous (MOTIS, Freiwilligenprojekt)", was: "IP-Adresse, Start, Ziel, Zeit", wann: "bei Bus-&-Bahn-Verbindungen und Terminen" },
  { dienst: "Fotos von Orten", wer: "Wikimedia Commons / Wikidata (Wikimedia Foundation, USA)", was: "IP-Adresse, Bildname", wann: "wenn ein Ort ein verknüpftes Foto hat" },
  { dienst: "KI auf dem Gerät", wer: "Hugging Face (USA)", was: "IP-Adresse, Abruf der Modelldatei", wann: "nur wenn du die KI einschaltest – dein Text verlässt das Gerät nicht" },
];
