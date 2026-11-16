import type { Gebaeude, Rechteck, Zone } from "./modell";

/**
 * Hauptgebäude nach dem Orientierungsplan im Flur (Foto, 16.11.2026).
 * Der Plan ist schräg gezeichnet; hier „gerade gerückt“ und auf ein gemeinsames Raster gelegt.
 * Ausgerichtet an den Treppenhäusern: die vier Treppen des Hauptbaus liegen auf allen Etagen an derselben Stelle.
 */

// Gemeinsame Bauteile aller Etagen des Hauptbaus
const RING: Rechteck[] = [
  [8.5, 10, 74.5, 13.5],  // Flur Süd
  [8.5, 37, 74.5, 40.5],  // Flur Nord
  [8.5, 13.5, 12, 37],    // Flur West
  [71, 13.5, 74.5, 37],   // Flur Ost
];
const TREPPEN_HAUPT: Rechteck[] = [[18.5, -2, 22, 10], [67.5, -2, 71, 10], [18.5, 40.5, 22, 52], [67.5, 40.5, 71, 52]];
const TREPPE_ANBAU: Rechteck = [64, 52, 70, 58];

const treppen = (ebene: number): Zone[] => [
  ...TREPPEN_HAUPT.map((f, i) => ({ id: `treppe-${["sw", "so", "nw", "no"][i]}`, art: "treppe" as const, name: "Treppe", flaechen: [f] })),
  ...(ebene <= 1 ? [{ id: "treppe-anbau", art: "treppe" as const, name: "Treppe Anbau", flaechen: [TREPPE_ANBAU] }] : []),
];
const wcSued = (): Zone[] => [
  { id: "wc-sw", art: "wc", name: "WC", flaechen: [[22, 6, 25.5, 10]] },
  { id: "wc-so", art: "wc", name: "WC", flaechen: [[64, 6, 67.5, 10]] },
];

export const SCHULE: Gebaeude = {
  id: "wvss-hauptgebaeude",
  name: "Werner-von-Siemens-Schule – Hauptgebäude",
  quelle: "Orientierungsplan im Flur (Foto vom 16.11.2026), schräge Zeichnung gerade gerückt",
  hinweise: [
    "Schematisch: Der Plan zeigt Raumgruppen und Flure, keine einzelnen Wände zwischen den Räumen.",
    "Maßstab geschätzt (Hauptbau etwa 90 × 50 m, passend zum Gebäudeumriss in OpenStreetMap), Geschosshöhe geschätzt.",
    "Noch nicht auf die Karte gelegt: dafür fehlt die Himmelsrichtung des Plans.",
  ],
  geschosshoehe: 3.6,
  treppen: [
    ...TREPPEN_HAUPT.map((f, i) => ({ id: `treppe-${["sw", "so", "nw", "no"][i]}`, flaeche: f, etagen: [0, 1, 2] })),
    { id: "treppe-anbau", flaeche: TREPPE_ANBAU, etagen: [0, 1] },
  ],
  etagen: [
    /* ---------------- Erdgeschoss ---------------- */
    {
      id: "eg", kurz: "E", name: "Erdgeschoss", ebene: 0,
      zonen: [
        { id: "eg-halle", art: "eingang", name: "Haupteingang / Halle", flaechen: [[0, 10, 12, 37]] },
        { id: "eg-flur", art: "flur", name: "Flur", flaechen: [
          [12, 10, 92, 13.5], [8.5, 37, 80, 40.5], [71, 13.5, 74.5, 37], [74.5, 29.5, 86, 31.5],
          [28, 40.5, 30, 49], [53, 40.5, 55, 49], [76, 40.5, 79, 76], [79, 62, 96, 66], [70, 52, 76, 58],
        ] },
        { id: "eg-hof", art: "hof", name: "Innenhof", flaechen: [[12, 21, 61, 37]] },
        { id: "eg-info", art: "raeume", name: "Eingangsbereich (Telefon, barrierefreies WC)", flaechen: [[4, 40.5, 18.5, 47]] },
        { id: "eg-nawi", art: "raeume", name: "Laborräume Naturwissenschaften", flaechen: [[22, 40.5, 28, 50], [30, 40.5, 53, 56], [55, 40.5, 67.5, 50]], nummern: ["088", "085", "083", "081"] },
        { id: "eg-metall-innen", art: "raeume", name: "Laborräume Metall", flaechen: [[12, 13.5, 61, 21]], nummern: ["041", "047"] },
        { id: "eg-sv", art: "raeume", name: "Klassenräume SV", flaechen: [[61, 13.5, 71, 37]], nummern: ["066", "019"] },
        { id: "eg-metall-no", art: "raeume", name: "Laborräume Metall", flaechen: [[74.5, 31.5, 90, 37], [80, 37, 90, 40.5]], nummern: ["065", "063"] },
        { id: "eg-werkstatt-metall", art: "raeume", name: "Laborräume / Werkstätten Metall", flaechen: [[74.5, 13.5, 90, 29.5]], nummern: ["062", "058", "057"] },
        { id: "eg-vortrag", art: "raeume", name: "Vortragsraum", flaechen: [[0, 0, 18.5, 10]], nummern: ["035"] },
        { id: "eg-metall-sued", art: "raeume", name: "Laborräume Metall", flaechen: [[22, 0, 67.5, 6], [25.5, 6, 64, 10]], nummern: ["042", "048"] },
        { id: "eg-metall-so", art: "raeume", name: "Laborräume Metall", flaechen: [[71, -6, 105, 10]], nummern: ["050", "054", "055"] },
        { id: "eg-056", art: "raeume", name: "Raum 056", flaechen: [[92, 10, 105, 22]], nummern: ["056"] },
        { id: "eg-holz-nord", art: "raeume", name: "Laborräume / Werkstätten Bau- u. Holztechnik", flaechen: [[79, 66, 100, 80], [76, 76, 79, 80]], nummern: ["075", "073"] },
        { id: "eg-holz-sued", art: "raeume", name: "Laborräume / Werkstätten Bau- u. Holztechnik", flaechen: [[79, 50, 100, 62]], nummern: ["070", "072"] },
        { id: "eg-wc-anbau", art: "wc", name: "WC", flaechen: [[70, 58, 76, 64]] },
        { id: "eg-neben", art: "nebengebaeude", name: "Nebengebäude (im Plan ohne Beschriftung)", flaechen: [[108, -6, 114, 22]] },
        ...wcSued(),
        ...treppen(0),
      ],
      nummern: [
        { nr: "088", x: 24, y: 41.5 }, { nr: "085", x: 32, y: 41.5 }, { nr: "083", x: 51, y: 41.5 }, { nr: "081", x: 57, y: 41.5 },
        { nr: "041", x: 14.5, y: 14.5 }, { nr: "047", x: 58, y: 14.5 }, { nr: "066", x: 69, y: 35.5 }, { nr: "019", x: 69, y: 15 },
        { nr: "065", x: 76.5, y: 32.5 }, { nr: "063", x: 88, y: 32.5 }, { nr: "062", x: 76.5, y: 28 }, { nr: "058", x: 76.5, y: 15 },
        { nr: "057", x: 88, y: 15 }, { nr: "035", x: 15, y: 8.5 }, { nr: "042", x: 28, y: 8.5 }, { nr: "048", x: 61, y: 8.5 },
        { nr: "050", x: 73.5, y: 8.5 }, { nr: "054", x: 86, y: 8.5 }, { nr: "055", x: 95, y: 8.5 }, { nr: "056", x: 94, y: 12 },
        { nr: "075", x: 81, y: 78 }, { nr: "073", x: 97, y: 67.5 }, { nr: "070", x: 81, y: 60.5 }, { nr: "072", x: 97, y: 60.5 },
      ],
    },
    /* ---------------- 1. Obergeschoss ---------------- */
    {
      id: "og1", kurz: "1", name: "1. Obergeschoss", ebene: 1,
      zonen: [
        { id: "og1-flur", art: "flur", name: "Flur", flaechen: [
          ...RING, [12, 22, 22, 25], [12, 33, 22, 37], [12, 25, 14, 33], [19.5, 25, 22, 33],
          [4, 31, 8.5, 37], [2, 20, 8.5, 23.5], [74.5, 37, 80, 40.5], [76.5, 30, 80, 37], [74.5, 10, 78, 13.5], [74.5, 13.5, 78, 22],
        ] },
        { id: "og1-flur-anbau", art: "flur", name: "Flur Anbau", flaechen: [[76, 52, 79, 76], [79, 72, 96, 76], [93, 62, 96, 72], [79, 62, 93, 66], [70, 52, 76, 58]] },
        { id: "og1-lichthof", art: "luftraum", name: "Lichthof", flaechen: [[14, 25, 19.5, 33]] },
        { id: "og1-luftraum", art: "luftraum", name: "Luftraum über dem Innenhof", flaechen: [[22, 22, 71, 37]] },
        { id: "og1-luftraum-anbau", art: "luftraum", name: "Luftraum", flaechen: [[79, 66, 93, 72]] },
        { id: "og1-verwaltung-n", art: "raeume", name: "Verwaltung", flaechen: [[0, 40.5, 18.5, 50]], nummern: ["130"] },
        { id: "og1-farbe", art: "raeume", name: "Laborräume / Werkstätten Farbtechnik / Raumgestaltung", flaechen: [[22, 40.5, 67.5, 50], [26, 50, 64, 56]], nummern: ["182", "180"] },
        { id: "og1-klassen-no", art: "raeume", name: "Klassenräume", flaechen: [[71, 40.5, 90, 50]], nummern: ["163"] },
        { id: "og1-verwaltung-w", art: "raeume", name: "Verwaltung", flaechen: [[0, 23.5, 4, 40.5], [4, 23.5, 8.5, 31], [4, 37, 8.5, 40.5]], nummern: ["134"] },
        { id: "og1-lehrer", art: "raeume", name: "Lehrerzimmer", flaechen: [[0, 10, 8.5, 20], [0, 20, 2, 23.5]], nummern: ["137"] },
        { id: "og1-metall-innen", art: "raeume", name: "Laborräume Metall", flaechen: [[12, 13.5, 71, 22]], nummern: ["139", "145", "151"] },
        { id: "og1-seminar", art: "raeume", name: "Seminarbereich", flaechen: [[78, 13.5, 90, 22], [74.5, 22, 90, 30], [80, 30, 90, 40.5], [74.5, 30, 76.5, 37]], nummern: ["155", "160"] },
        { id: "og1-bibliothek", art: "raeume", name: "Bibliothek", flaechen: [[0, 0, 18.5, 10]] },
        { id: "og1-metall-sued", art: "raeume", name: "Laborräume Metall", flaechen: [[22, 0, 45, 6], [25.5, 6, 45, 10]], nummern: ["144"] },
        { id: "og1-klassen-sued", art: "raeume", name: "Klassenräume", flaechen: [[45, 0, 67.5, 6], [45, 6, 64, 10]], nummern: ["150"] },
        { id: "og1-klassen-so", art: "raeume", name: "Klassenräume", flaechen: [[71, 0, 90, 10]], nummern: ["152"] },
        { id: "og1-anbau-klassen-n", art: "raeume", name: "Klassenräume", flaechen: [[70, 76, 100, 80]], nummern: ["176", "173"] },
        { id: "og1-anbau-klassen-w", art: "raeume", name: "Klassenräume", flaechen: [[70, 58, 76, 76]], nummern: ["177", "178"] },
        { id: "og1-bautechnik", art: "raeume", name: "Laborraum Bautechnik", flaechen: [[79, 52, 100, 62], [96, 62, 100, 76]], nummern: ["170", "172"] },
        ...wcSued(),
        ...treppen(1),
      ],
      nummern: [
        { nr: "130", x: 15, y: 41.5 }, { nr: "182", x: 25, y: 41.5 }, { nr: "180", x: 64, y: 41.5 }, { nr: "163", x: 74, y: 41.5 },
        { nr: "134", x: 6, y: 38.5 }, { nr: "137", x: 6, y: 18.5 }, { nr: "139", x: 13.5, y: 20.5 }, { nr: "145", x: 15, y: 14.5 },
        { nr: "151", x: 67, y: 14.5 }, { nr: "155", x: 79, y: 21 }, { nr: "160", x: 81.5, y: 31 }, { nr: "144", x: 28, y: 8.5 },
        { nr: "150", x: 61, y: 8.5 }, { nr: "152", x: 73.5, y: 8.5 },
        { nr: "176", x: 78, y: 78 }, { nr: "173", x: 97, y: 78 }, { nr: "177", x: 74.5, y: 70 }, { nr: "178", x: 74.5, y: 59.5 },
        { nr: "170", x: 81, y: 60.5 }, { nr: "172", x: 94, y: 60.5 },
      ],
    },
    /* ---------------- 2. Obergeschoss ---------------- */
    {
      id: "og2", kurz: "2", name: "2. Obergeschoss", ebene: 2,
      zonen: [
        { id: "og2-flur", art: "flur", name: "Flur", flaechen: [...RING, [74.5, 37, 78, 40.5], [4, 29, 8.5, 37], [4, 13.5, 8.5, 18]] },
        { id: "og2-luftraum", art: "luftraum", name: "Luftraum über dem Innenhof", flaechen: [[12, 21, 71, 37]] },
        { id: "og2-terrasse", art: "terrasse", name: "Terrasse", flaechen: [[22, 40.5, 67.5, 50]] },
        { id: "og2-klassen-nw", art: "raeume", name: "Klassenräume", flaechen: [[0, 40.5, 18.5, 50]], nummern: ["230"] },
        { id: "og2-259", art: "raeume", name: "Raum 259", flaechen: [[71, 40.5, 90, 50]], nummern: ["259"] },
        { id: "og2-metall", art: "raeume", name: "Laborräume Metall", flaechen: [[0, 10, 4, 40.5], [4, 18, 8.5, 29], [4, 37, 8.5, 40.5], [4, 10, 8.5, 13.5]], nummern: ["234", "238"] },
        { id: "og2-etechnik", art: "raeume", name: "Laborräume E-Technik", flaechen: [[74.5, 10, 90, 37], [78, 37, 90, 40.5]] },
        { id: "og2-edv", art: "raeume", name: "Klassenräume / EDV-Räume", flaechen: [[12, 13.5, 71, 21]], nummern: ["241", "247"] },
        { id: "og2-240", art: "raeume", name: "Raum 240", flaechen: [[0, 0, 18.5, 10]], nummern: ["240"] },
        { id: "og2-klassen-sued", art: "raeume", name: "Klassenräume", flaechen: [[22, 0, 67.5, 6], [25.5, 6, 64, 10]], nummern: ["242", "248"] },
        { id: "og2-klassen-so", art: "raeume", name: "Klassenräume", flaechen: [[71, 0, 90, 10]], nummern: ["250"] },
        ...wcSued(),
        ...treppen(2),
      ],
      nummern: [
        { nr: "230", x: 15, y: 41.5 }, { nr: "259", x: 76, y: 41.5 }, { nr: "234", x: 6, y: 28 }, { nr: "238", x: 6, y: 19 },
        { nr: "241", x: 15, y: 14.5 }, { nr: "247", x: 67, y: 14.5 }, { nr: "240", x: 15, y: 8.5 }, { nr: "242", x: 28, y: 8.5 },
        { nr: "248", x: 61, y: 8.5 }, { nr: "250", x: 73.5, y: 8.5 },
      ],
    },
  ],
};
