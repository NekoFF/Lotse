import type { Gebaeude, Rechteck, Ringe, Zone } from "./modell";

/**
 * Hauptgebäude nach dem Orientierungsplan im Flur (Foto, 16.11.2026).
 * Erdgeschoss: genau nach Dimas Markierung (grau = begehbar, weiß = Räume, blau = Treppen),
 * Pixel für Pixel ausgelesen, Schräge des Schilds (0,556) und leichte Drehung (0,66°) herausgerechnet.
 * Maßstab: Abstand der beiden Südtreppen = 49 m; die Nordtreppen landen damit von selbst an ihrer Stelle (< 1 m).
 * 1. OG ebenso (Treppen passen mit < 0,25 m auf die EG-Treppen); der Anbau – auf dem Schild daneben gezeichnet –
 * wird über seine Treppe ausgerichtet und landet damit genau über dem EG-Anbau. 2. OG noch von Hand.
 */

// Treppenhäuser: auf jeder Etage genau dieselbe Form (aus der EG-Markierung)
const TREPPEN: Record<string, Ringe> = {
  sw: [[[22.25, 0.25], [18.25, 0.25], [18.25, 10.5], [22.25, 10.5]]],
  so: [[[71.25, 0.5], [70.75, 0], [67.5, 0], [67.25, 0.75], [67.25, 10.5], [71.25, 10.5]]],
  nw: [[[23.25, 40.5], [19, 40.5], [19, 50.75], [23.25, 50.75]]],
  no: [[[72, 50.5], [72, 40.5], [68, 40.5], [68, 51], [71.75, 51]]],
  anbau: [[[71, 57], [80.5, 57], [80.5, 60.5], [71.25, 60.5], [71, 60.75]]],
};
const treppen = (ebene: number): Zone[] =>
  Object.entries(TREPPEN).filter(([id]) => id !== "anbau" || ebene <= 1)
    .map(([id, ringe]) => ({ id: `treppe-${id}`, art: "treppe" as const, name: id === "anbau" ? "Treppe Anbau" : "Treppe", flaechen: [], ringe }));

// Obergeschosse: gemeinsamer Flurring
const RING: Rechteck[] = [
  [8.5, 10.5, 74.5, 14],  // Flur Süd
  [8.5, 37, 74.5, 40.5],  // Flur Nord
  [8.5, 14, 12, 37],      // Flur West
  [71, 14, 74.5, 37],     // Flur Ost
];
const wcSued = (): Zone[] => [
  { id: "wc-sw", art: "wc", name: "WC", flaechen: [[22.25, 6, 25.75, 10.5]] },
  { id: "wc-so", art: "wc", name: "WC", flaechen: [[63.75, 6, 67.25, 10.5]] },
];

export const SCHULE: Gebaeude = {
  id: "wvss-hauptgebaeude",
  name: "Werner-von-Siemens-Schule – Hauptgebäude",
  quelle: "Orientierungsplan im Flur (Foto vom 16.11.2026); Erdgeschoss nach Dimas Markierung ausgelesen",
  hinweise: [
    "Erdgeschoss genau nach der Markierung: grau = begehbar (Flure, Halle, Innenhof), weiß = Räume, blau = Treppen.",
    "Erdgeschoss und 1. OG (mit Anbau) nach Markierung; das 2. OG noch schematisch nach dem Foto.",
    "Der Anbau ist auf dem Schild daneben gezeichnet; hier über seine Treppe auf den Anbau im Erdgeschoss gesetzt.",
    "In der Mitte des 1. OG ist kein Raum: offen, man sieht auf das Dach des Erdgeschosses.",
    "Maßstab aus dem Abstand der Treppen und dem Gebäudeumriss in OpenStreetMap geschätzt; Geschosshöhe geschätzt.",
    "WCs sind im Erdgeschoss und 1. OG noch nicht markiert. Noch nicht auf die Karte gelegt (Himmelsrichtung des Plans fehlt).",
  ],
  geschosshoehe: 3.6,
  treppen: Object.entries(TREPPEN).map(([id, ringe]) => ({ id: `treppe-${id}`, ringe, etagen: id === "anbau" ? [0, 1] : [0, 1, 2] })),
  etagen: [
    /* ---------------- Erdgeschoss (nach Markierung) ---------------- */
    {
      id: "eg", kurz: "E", name: "Erdgeschoss", ebene: 0,
      zonen: [
        { id: "eg-flur", art: "flur", name: "Flure, Halle und Innenhof", flaechen: [], ringe: [[[85.25, 74.75], [87.5, 74.75], [88.5, 75.5], [100, 75.5], [100, 75.25], [100, 65.5], [85.25, 65.5], [85, 65.25], [85, 65.25], [84.5, 64.25], [84.5, 48.75], [89.5, 48.75], [89.5, 41], [84.25, 41], [84.25, 34], [85, 33], [97, 33], [97, 31], [96.5, 30.75], [85.25, 30.75], [84, 30], [84, 13.75], [84.75, 13], [106.75, 13], [106.75, 20.5], [110.5, 20.5], [111, 20.25], [111, 10.5], [1.25, 10.5], [1, 10.75], [1, 15], [0.25, 15.5], [0.25, 24.75], [1.5, 24.75], [1.5, 29.75], [4.75, 33.5], [7.5, 33.5], [7.5, 40], [10.25, 40], [11, 41], [11, 44.75], [13.75, 44.75], [13.75, 41.25], [14, 41], [14.5, 40.25], [31.5, 40.25], [32.5, 41.5], [32.5, 48.5], [35.25, 48.5], [35.25, 41.5], [35.75, 41], [36, 40.5], [54.25, 40.5], [55.25, 41.5], [55.25, 48.75], [58, 48.75], [58, 41.75], [58.5, 41], [58.75, 40.5], [80.5, 40.5], [80.5, 62.25], [80, 62.75], [80.25, 64.25], [79, 65.75], [79, 78], [84, 78], [84, 75.75]], [[80.5, 37.25], [67.5, 37.25], [67.5, 21.5], [23.5, 21.5], [22.5, 20.5], [22.5, 13.25], [23.25, 12.75], [79.5, 12.75], [80.5, 13.5]]] },
        { id: "eg-holz", art: "raeume", name: "Laborräume / Werkstätten Bau- u. Holztechnik", flaechen: [], ringe: [[[70.75, 60.75], [70.75, 85.5], [107.5, 85.5], [107.5, 56.5], [84.5, 56.5], [84.5, 64.25], [85, 65.25], [100, 65.25], [100, 75.25], [99.75, 75.75], [88.5, 75.75], [87.5, 75], [85.25, 75], [84, 75.75], [84, 78], [79, 78], [79, 65.75], [80, 64.25], [80, 62.75], [80.5, 61.75], [80.5, 60.75]]], nummern: ["075", "073", "070", "072"] },
        { id: "eg-nawi", art: "raeume", name: "Laborräume Naturwissenschaften", flaechen: [], ringe: [[[23.25, 53.5], [31.75, 53.5], [31.75, 57.5], [59, 57.5], [59, 53.75], [68, 53.75], [68, 40.5], [58.75, 40.5], [58.25, 41.75], [58.25, 48.75], [57.25, 49], [55, 49], [55, 41.5], [54.25, 40.5], [36, 40.5], [35.5, 41.5], [35.5, 48.25], [35, 48.75], [32.5, 48.75], [32.5, 41.5], [31.75, 40.5], [23.25, 40.5]]], nummern: ["088", "085", "083", "081"] },
        { id: "eg-ohne", art: "raeume", name: "Raum (im Plan ohne Beschriftung)", flaechen: [], ringe: [[[80.5, 57], [80.5, 40.75], [72, 40.75], [72, 57]]] },
        { id: "eg-info", art: "raeume", name: "Eingangsbereich (Telefon, barrierefreies WC)", flaechen: [], ringe: [[[19, 40.25], [14.5, 40.25], [13.75, 41.5], [13.75, 44.75], [11, 44.75], [11, 41.25], [10.25, 40.5], [5, 40.5], [5, 48.75], [19, 48.75]]] },
        { id: "eg-metall-ost", art: "raeume", name: "Laborräume Metall / Werkstätten Metall", flaechen: [], ringe: [[[106.5, 13], [84.75, 13], [84, 14], [84, 30], [85.25, 30.5], [97.25, 30.5], [97.25, 32], [97, 33], [85, 33], [84.25, 34], [84.25, 41], [107.25, 41]]], nummern: ["065", "063", "062", "058", "057"] },
        { id: "eg-metall-sv", art: "raeume", name: "Laborräume Metall / Klassenräume SV", flaechen: [], ringe: [[[80.5, 13.5], [79.5, 13], [23.25, 13], [22.75, 13.25], [22.75, 20.5], [23.5, 21.5], [67.75, 21.5], [67.75, 37.25], [80.5, 37.25]]], nummern: ["066", "019", "041", "047"] },
        { id: "eg-neben", art: "nebengebaeude", name: "Nebengebäude (im Plan ohne Beschriftung)", flaechen: [], ringe: [[[142, -1.75], [132.25, -1.75], [132.25, 22.5], [142, 22.5]]] },
        { id: "eg-metall-so", art: "raeume", name: "Laborräume Metall", flaechen: [], ringe: [[[111, 10.25], [111, 22], [123.75, 22], [123.75, -2], [71, -2], [71, 0.25], [71.25, 0.5], [71.25, 10.25]]], nummern: ["050", "054", "055", "056"] },
        { id: "eg-metall-sued", art: "raeume", name: "Laborräume Metall", flaechen: [], ringe: [[[67.25, 10.5], [67.25, 0.75], [67.5, 0], [63.5, 0], [63.5, 2], [62, 2], [62, 0], [27.5, 0], [27.5, 2], [26.5, 2], [26.5, 0], [22.25, 0], [22.25, 10.5]]], nummern: ["042", "048"] },
        { id: "eg-vortrag", art: "raeume", name: "Vortragsraum", flaechen: [], ringe: [[[1, 10.75], [1.25, 10.5], [18, 10.5], [18, 0.25], [16.75, 0.5], [16.75, 2.25], [16.25, 2.25], [16.25, 1.5], [3, 1.5], [2.75, 2.5], [1, 2.5]]], nummern: ["035"] },
        ...treppen(0),
      ],
      nummern: [{ nr: "075", x: 79.75, y: 79.25 }, { nr: "073", x: 100.25, y: 76.5 }, { nr: "070", x: 88, y: 63 }, { nr: "072", x: 100.5, y: 62.75 }, { nr: "088", x: 30, y: 41.75 }, { nr: "085", x: 38.75, y: 41.5 }, { nr: "083", x: 52.75, y: 41.5 }, { nr: "081", x: 61.25, y: 41.5 }, { nr: "065", x: 87.5, y: 34 }, { nr: "063", x: 101, y: 30.5 }, { nr: "062", x: 87.75, y: 28 }, { nr: "058", x: 87.75, y: 14 }, { nr: "057", x: 105.25, y: 14 }, { nr: "066", x: 78, y: 31.25 }, { nr: "019", x: 78, y: 15.5 }, { nr: "041", x: 26.5, y: 14 }, { nr: "047", x: 63.5, y: 14 }, { nr: "056", x: 114.75, y: 19 }, { nr: "050", x: 75.5, y: 8 }, { nr: "054", x: 110.75, y: 7.75 }, { nr: "055", x: 114.5, y: 9.5 }, { nr: "035", x: 16.75, y: 9 }, { nr: "042", x: 30.5, y: 8.75 }, { nr: "048", x: 61.5, y: 8 }],
      etiketten: [
        { text: "Innenhof", x: 38.7, y: 31.3 },
        { text: "Haupteingang", x: 5, y: 33 },
      ],
    },
    /* ---------------- 1. Obergeschoss (nach Markierung, mit Anbau) ---------------- */
    {
      id: "og1", kurz: "1", name: "1. Obergeschoss", ebene: 1,
      zonen: [
        { id: "og1-flur", art: "flur", name: "Flur", flaechen: [], ringe: [[[17.5, 13.25], [18.5, 14.25], [18.5, 22], [8.5, 22], [8.5, 40.25], [8.25, 40.75], [7.25, 40.75], [7.25, 43.5], [7.75, 44.25], [8, 44.5], [9.25, 43.5], [11.25, 43.5], [13, 41.75], [16.75, 41.75], [17.5, 40.25], [73.5, 40.25], [73.5, 42.75], [80, 42.75], [80, 40.75], [81.5, 40.5], [81.5, 33.5], [78.25, 33.5], [78.25, 37], [77.25, 38], [72.25, 38], [71.25, 37.25], [71.25, 14.25], [72.25, 13.25], [77.5, 13.25], [78, 14], [78, 20.25], [81.25, 20.25], [81.5, 19.75], [81.5, 10.5], [18, 10.5], [17.5, 10.75]], [[23.5, 37], [23.5, 22], [22.25, 22], [22.25, 14.5], [22.5, 13.5], [23.25, 13.25], [67, 13.25], [67.75, 14], [67.75, 21.75], [67.5, 22], [67.5, 22], [67.25, 22], [66.75, 22.25], [66.75, 37]], [[12, 37], [10.5, 36.25], [10.5, 27], [11, 26.25], [17.75, 26.25], [18.75, 26.75], [18.75, 35.75], [18.5, 37]]] },
        { id: "og1-flur-anbau", art: "flur", name: "Flur Anbau", flaechen: [[80.5, 57, 81.75, 60.5]] /* Anschluss an die Treppe: im 1. OG ist sie auf dem Schild etwas kürzer gezeichnet */, ringe: [[[101, 65.25], [86, 65.25], [85.25, 64], [85.25, 57], [81.75, 57], [81.75, 61.75], [81, 62.75], [81, 64.25], [80.25, 65.5], [80.25, 75.25], [80, 75.5], [72.25, 75.5], [72, 75.75], [72, 78], [101, 78]], [[98.25, 75.5], [86.25, 75.5], [85.25, 74.5], [85.25, 69.5], [85.5, 68.25], [86.5, 67.75], [98.25, 67.75], [99, 68.75], [99, 74.25], [98.25, 75.5]]] },
        { id: "og1-farbe", art: "raeume", name: "Laborräume / Werkstätten Farbtechnik / Raumgestaltung", flaechen: [], ringe: [[[67.75, 40.5], [23.25, 40.5], [23.25, 48.25], [67.75, 48.25]], [[67.75, 50.75], [67.75, 48.25], [23.25, 48.25], [23.25, 53], [31.75, 53], [31.75, 56.75], [59.25, 56.75], [59.25, 53], [67.75, 53]]], nummern: ["182", "180"] },
        { id: "og1-ost", art: "raeume", name: "Klassenräume / Seminarbereich", flaechen: [], ringe: [[[89.25, 40.5], [90.75, 40.25], [90.75, 32.5], [89, 32.5], [89, 18.25], [90.25, 18.25], [90.5, 18], [90.5, 10.5], [89, 10.25], [89, 2.5], [71.5, 2.5], [71.5, 10.5], [81.5, 10.5], [81.5, 19.75], [81.25, 20.5], [78, 20.5], [78, 14], [77.5, 13.25], [72.25, 13.25], [71.5, 14.25], [71.5, 37.25], [72.5, 37.75], [77.25, 37.75], [78.25, 37], [78.25, 33.5], [81.5, 33.5], [81.5, 40.5], [81.5, 40.75], [80, 40.75], [80, 42.75], [73.5, 42.75], [73.5, 40.25], [72, 40.25], [72, 48.25], [72.25, 48.5], [89.25, 48.5]]], nummern: ["163", "160", "155", "152"] },
        { id: "og1-west", art: "raeume", name: "Verwaltung / Lehrerzimmer / Bibliothek", flaechen: [], ringe: [[[19, 48], [19, 40.5], [17.5, 40.5], [16.75, 42], [12.75, 42], [11.25, 43.75], [9.25, 43.75], [8.25, 44.5], [7.25, 43.75], [7.25, 40.75], [8.25, 40.75], [8.25, 22], [18.5, 22], [18.5, 14.25], [17.5, 13.5], [17.5, 10.75], [18, 10.5], [18, 2.5], [17.75, 2.25], [3, 2.25], [3, 1.75], [1.75, 1.75], [1.25, 2.25], [0.5, 2], [-0.25, 3.75], [0.25, 5.75], [1.25, 32.5], [1, 33], [-0.25, 33], [-0.25, 34.5], [0.5, 34.5], [0.75, 35.25], [-1, 37.25], [0.75, 39.25], [0.75, 39.75], [0, 40], [0, 41.25], [1.5, 41.5], [1.5, 48.5], [18.75, 48.5]]], nummern: ["130", "134", "137", "139"] },
        { id: "og1-offen", art: "luftraum", name: "Offen – Blick aufs Dach des Erdgeschosses", flaechen: [], ringe: [[[66.75, 22], [23.75, 22], [23.75, 36.75], [66.75, 36.75]]] },
        { id: "og1-raum-west", art: "raeume", name: "Raum (im Plan ohne Beschriftung)", flaechen: [], ringe: [[[18.75, 35.75], [18.75, 27], [17.75, 26.25], [11, 26.25], [10.75, 27], [10.75, 36.25], [12.25, 36.75], [18.25, 36.75]]] },
        { id: "og1-metall-innen", art: "raeume", name: "Laborräume Metall", flaechen: [], ringe: [[[67.5, 14], [66.75, 13.25], [23.25, 13.25], [22.75, 13.5], [22.5, 14.5], [22.5, 22], [67.5, 22]]], nummern: ["145", "151"] },
        { id: "og1-sued", art: "raeume", name: "Laborräume Metall / Klassenräume", flaechen: [], ringe: [[[67.25, 1], [67.25, 0.5], [63, 0.5], [63, 2.5], [26.5, 2.5], [26.5, 0.5], [22.25, 0.5], [22.25, 10.5], [67.25, 10.5]]], nummern: ["144", "150"] },
        { id: "og1-anbau-ost", art: "raeume", name: "Klassenräume / Laborraum Bautechnik", flaechen: [], ringe: [[[108.5, 57], [85.25, 57], [85.25, 64], [86, 65.25], [101, 65.25], [101, 78], [100.75, 78.25], [72.25, 78.25], [72, 79], [72, 85.25], [108.5, 86]]], nummern: ["176", "173", "170", "172"] },
        { id: "og1-anbau-west", art: "raeume", name: "Klassenräume", flaechen: [], ringe: [[[80, 65.5], [81, 64.25], [81, 62.75], [81.5, 61.75], [81.5, 60.75], [71.75, 60.75], [71.75, 75.5], [80, 75.5]]], nummern: ["177", "178"] },
        { id: "og1-anbau-mitte", art: "raeume", name: "Raum (im Plan ohne Beschriftung)", flaechen: [], ringe: [[[99, 74.25], [99, 68.75], [98.25, 67.75], [86.5, 67.75], [85.5, 68.25], [85.25, 69.5], [85.25, 74.5], [86.25, 75.5], [98.25, 75.5]]] },
        ...treppen(1),
      ],
      nummern: [{ nr: "130", x: 14.75, y: 45.25 }, { nr: "134", x: 4.25, y: 41.5 }, { nr: "137", x: 3.75, y: 24.75 }, { nr: "182", x: 28, y: 43.5 }, { nr: "180", x: 64.5, y: 42.5 }, { nr: "163", x: 78, y: 44.25 }, { nr: "160", x: 83.75, y: 31.75 }, { nr: "155", x: 82.5, y: 21 }, { nr: "152", x: 76.75, y: 8.25 }, { nr: "139", x: 15, y: 21 }, { nr: "145", x: 25, y: 15 }, { nr: "151", x: 66.5, y: 14.25 }, { nr: "144", x: 31.75, y: 9.25 }, { nr: "150", x: 62.25, y: 8.25 }, { nr: "176", x: 75.5, y: 79.25 }, { nr: "173", x: 101, y: 79.75 }, { nr: "170", x: 88.5, y: 63.75 }, { nr: "172", x: 101.75, y: 64 }, { nr: "177", x: 77.5, y: 73.75 }, { nr: "178", x: 78.75, y: 62.5 }],
    },
    /* ---------------- 2. Obergeschoss ---------------- */
    {
      id: "og2", kurz: "2", name: "2. Obergeschoss", ebene: 2,
      zonen: [
        { id: "og2-flur", art: "flur", name: "Flur", flaechen: [...RING, [74.5, 37, 78, 40.5], [4, 29, 8.5, 37], [4, 14, 8.5, 18]] },
        { id: "og2-luftraum", art: "luftraum", name: "Luftraum über dem Innenhof", flaechen: [[12, 21, 71, 37]] },
        { id: "og2-terrasse", art: "terrasse", name: "Terrasse", flaechen: [[23.25, 40.5, 68, 50]] },
        { id: "og2-klassen-nw", art: "raeume", name: "Klassenräume", flaechen: [[0, 40.5, 19, 50]], nummern: ["230"] },
        { id: "og2-259", art: "raeume", name: "Raum 259", flaechen: [[72, 40.5, 90, 50]], nummern: ["259"] },
        { id: "og2-metall", art: "raeume", name: "Laborräume Metall", flaechen: [[0, 10.5, 4, 40.5], [4, 18, 8.5, 29], [4, 37, 8.5, 40.5], [4, 10.5, 8.5, 14]], nummern: ["234", "238"] },
        { id: "og2-etechnik", art: "raeume", name: "Laborräume E-Technik", flaechen: [[74.5, 10.5, 90, 37], [78, 37, 90, 40.5]] },
        { id: "og2-edv", art: "raeume", name: "Klassenräume / EDV-Räume", flaechen: [[12, 14, 71, 21]], nummern: ["241", "247"] },
        { id: "og2-240", art: "raeume", name: "Raum 240", flaechen: [[0, 0, 18.25, 10.5]], nummern: ["240"] },
        { id: "og2-klassen-sued", art: "raeume", name: "Klassenräume", flaechen: [[22.25, 0, 67.25, 6], [25.75, 6, 63.75, 10.5]], nummern: ["242", "248"] },
        { id: "og2-klassen-so", art: "raeume", name: "Klassenräume", flaechen: [[71.25, 0, 90, 10.5]], nummern: ["250"] },
        ...wcSued(),
        ...treppen(2),
      ],
      nummern: [
        { nr: "230", x: 15, y: 41.5 }, { nr: "259", x: 76, y: 41.5 }, { nr: "234", x: 6, y: 28 }, { nr: "238", x: 6, y: 19 },
        { nr: "241", x: 15, y: 15 }, { nr: "247", x: 67, y: 15 }, { nr: "240", x: 15, y: 8.5 }, { nr: "242", x: 28, y: 8.5 },
        { nr: "248", x: 61, y: 8.5 }, { nr: "250", x: 73.5, y: 8.5 },
      ],
    },
  ],
};
