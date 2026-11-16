import type { Gebaeude, Rechteck, Ringe, Zone } from "./modell";

/**
 * Hauptgebäude nach dem Orientierungsplan im Flur (Foto, 16.11.2026).
 * Erdgeschoss: genau nach Dimas Markierung (grau = begehbar, weiß = Räume, blau = Treppen),
 * Pixel für Pixel ausgelesen, Schräge des Schilds (0,556) und leichte Drehung (0,66°) herausgerechnet.
 * Maßstab: Abstand der beiden Südtreppen = 49 m; die Nordtreppen landen damit von selbst an ihrer Stelle (< 1 m).
 * Obergeschosse: noch von Hand nach dem Foto, auf dieselben Treppen ausgerichtet.
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
// Anbau im 1. OG: liegt über dem Anbau des EG (dort genau markiert)
const A = (x1: number, y1: number, x2: number, y2: number): Rechteck => [x1, y1, x2, y2];

export const SCHULE: Gebaeude = {
  id: "wvss-hauptgebaeude",
  name: "Werner-von-Siemens-Schule – Hauptgebäude",
  quelle: "Orientierungsplan im Flur (Foto vom 16.11.2026); Erdgeschoss nach Dimas Markierung ausgelesen",
  hinweise: [
    "Erdgeschoss genau nach der Markierung: grau = begehbar (Flure, Halle, Innenhof), weiß = Räume, blau = Treppen.",
    "Obergeschosse noch schematisch nach dem Foto (Raumgruppen, keine einzelnen Wände zwischen Räumen).",
    "Maßstab aus dem Abstand der Treppen und dem Gebäudeumriss in OpenStreetMap geschätzt; Geschosshöhe geschätzt.",
    "WCs im Erdgeschoss sind noch nicht markiert. Noch nicht auf die Karte gelegt (Himmelsrichtung des Plans fehlt).",
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
    /* ---------------- 1. Obergeschoss ---------------- */
    {
      id: "og1", kurz: "1", name: "1. Obergeschoss", ebene: 1,
      zonen: [
        { id: "og1-flur", art: "flur", name: "Flur", flaechen: [
          ...RING, [12, 22, 22, 25], [12, 33, 22, 37], [12, 25, 14, 33], [19.5, 25, 22, 33],
          [4, 31, 8.5, 37], [2, 20, 8.5, 23.5], [74.5, 37, 80, 40.5], [76.5, 30, 80, 37], [74.5, 10.5, 78, 14], [74.5, 14, 78, 22],
        ] },
        { id: "og1-flur-anbau", art: "flur", name: "Flur Anbau", flaechen: [A(83, 56.5, 86, 80.5), A(86, 76.5, 103, 80.5), A(100, 66.5, 103, 76.5), A(86, 66.5, 100, 70.5), A(80.5, 56.5, 83, 62.5)] },
        { id: "og1-lichthof", art: "luftraum", name: "Lichthof", flaechen: [[14, 25, 19.5, 33]] },
        { id: "og1-luftraum", art: "luftraum", name: "Luftraum über dem Innenhof", flaechen: [[22, 22, 71, 37]] },
        { id: "og1-luftraum-anbau", art: "luftraum", name: "Luftraum", flaechen: [A(86, 70.5, 100, 76.5)] },
        { id: "og1-verwaltung-n", art: "raeume", name: "Verwaltung", flaechen: [[0, 40.5, 19, 50]], nummern: ["130"] },
        { id: "og1-farbe", art: "raeume", name: "Laborräume / Werkstätten Farbtechnik / Raumgestaltung", flaechen: [[23.25, 40.5, 68, 50], [26, 50, 64, 56]], nummern: ["182", "180"] },
        { id: "og1-klassen-no", art: "raeume", name: "Klassenräume", flaechen: [[72, 40.5, 90, 50]], nummern: ["163"] },
        { id: "og1-verwaltung-w", art: "raeume", name: "Verwaltung", flaechen: [[0, 23.5, 4, 40.5], [4, 23.5, 8.5, 31], [4, 37, 8.5, 40.5]], nummern: ["134"] },
        { id: "og1-lehrer", art: "raeume", name: "Lehrerzimmer", flaechen: [[0, 10.5, 8.5, 20], [0, 20, 2, 23.5]], nummern: ["137"] },
        { id: "og1-metall-innen", art: "raeume", name: "Laborräume Metall", flaechen: [[12, 14, 71, 22]], nummern: ["139", "145", "151"] },
        { id: "og1-seminar", art: "raeume", name: "Seminarbereich", flaechen: [[78, 14, 90, 22], [74.5, 22, 90, 30], [80, 30, 90, 40.5], [74.5, 30, 76.5, 37]], nummern: ["155", "160"] },
        { id: "og1-bibliothek", art: "raeume", name: "Bibliothek", flaechen: [[0, 0, 18.25, 10.5]] },
        { id: "og1-metall-sued", art: "raeume", name: "Laborräume Metall", flaechen: [[22.25, 0, 45, 6], [25.75, 6, 45, 10.5]], nummern: ["144"] },
        { id: "og1-klassen-sued", art: "raeume", name: "Klassenräume", flaechen: [[45, 0, 67.25, 6], [45, 6, 63.75, 10.5]], nummern: ["150"] },
        { id: "og1-klassen-so", art: "raeume", name: "Klassenräume", flaechen: [[71.25, 0, 90, 10.5]], nummern: ["152"] },
        { id: "og1-anbau-klassen-n", art: "raeume", name: "Klassenräume", flaechen: [A(77, 80.5, 107, 84.5)], nummern: ["176", "173"] },
        { id: "og1-anbau-klassen-w", art: "raeume", name: "Klassenräume", flaechen: [A(77, 62.5, 83, 80.5)], nummern: ["177", "178"] },
        { id: "og1-bautechnik", art: "raeume", name: "Laborraum Bautechnik", flaechen: [A(86, 56.5, 107, 66.5), A(103, 66.5, 107, 80.5)], nummern: ["170", "172"] },
        ...wcSued(),
        ...treppen(1),
      ],
      nummern: [
        { nr: "130", x: 15, y: 41.5 }, { nr: "182", x: 25, y: 41.5 }, { nr: "180", x: 64, y: 41.5 }, { nr: "163", x: 74, y: 41.5 },
        { nr: "134", x: 6, y: 38.5 }, { nr: "137", x: 6, y: 18.5 }, { nr: "139", x: 13.5, y: 20.5 }, { nr: "145", x: 15, y: 15 },
        { nr: "151", x: 67, y: 15 }, { nr: "155", x: 79, y: 21 }, { nr: "160", x: 81.5, y: 31 }, { nr: "144", x: 28, y: 8.5 },
        { nr: "150", x: 61, y: 8.5 }, { nr: "152", x: 73.5, y: 8.5 },
        { nr: "176", x: 85, y: 82.5 }, { nr: "173", x: 104, y: 82.5 }, { nr: "177", x: 81.5, y: 74.5 }, { nr: "178", x: 81.5, y: 64 },
        { nr: "170", x: 88, y: 65 }, { nr: "172", x: 101, y: 65 },
      ],
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
