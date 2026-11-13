import type { Map as MlMap } from "maplibre-gl";

/**
 * Eigene Kartensymbole von Lotse (selbst gezeichnet, keine fremden Vorlagen).
 * Die Ebenen in public/karte/stil-*.json verweisen auf diese Namen: lotse-bus, lotse-bahn, lotse-medizin, lotse-apotheke, lotse-ort.
 * Kein Kreuz (Rotes Kreuz/Schweizer Wappen geschützt) und kein Apotheken-„A“ (Marke): eigene Formen.
 */
export type SymbolArt = "bus" | "bahn" | "medizin" | "apotheke" | "ort";
export const SYMBOLE: SymbolArt[] = ["bus", "bahn", "medizin", "apotheke", "ort"];

const FARBE = {
  light: { bus: "#2447e6", bahn: "#1f7a4a", medizin: "#c2255c", apotheke: "#c2255c", ort: "#8e8e96", ring: "#ffffff" },
  dark: { bus: "#5873ff", bahn: "#2f9e64", medizin: "#d6336c", apotheke: "#d6336c", ort: "#82828c", ring: "#1c1d22" },
} as const;

/** Zeichen im 24er-Raster, weiß als Linie gezeichnet */
const ZEICHEN: Record<Exclude<SymbolArt, "ort">, { pfade: string[]; breite: number }> = {
  bus: {
    breite: 2,
    pfade: [
      "M7 4.5h10a2.5 2.5 0 0 1 2.5 2.5v9.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V7A2.5 2.5 0 0 1 7 4.5z",
      "M4.5 11h15", "M8 18v2", "M16 18v2", "M8 14.5h.01", "M16 14.5h.01",
    ],
  },
  bahn: {
    breite: 2,
    pfade: [
      "M8 3.5h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3z",
      "M5 10h14", "M9 17.5l-2 3", "M15 17.5l2 3", "M9 14h.01", "M15 14h.01",
    ],
  },
  // Stethoskop statt Kreuz: kein Zweifel an geschützten Zeichen (§ 125 OWiG)
  medizin: { breite: 2.2, pfade: ["M6 4v5a4 4 0 0 0 8 0V4", "M10 13v2.5a4.5 4.5 0 0 0 9 0V13", "M19 11.5a1.5 1.5 0 1 0 0-.01"] },
  apotheke: {
    breite: 2,
    pfade: ["M9.2 18.8a3.4 3.4 0 0 1-4.8-4.8l9.4-9.4a3.4 3.4 0 0 1 4.8 4.8z", "M9.9 9.9l4.2 4.2"],
  },
};

const PX = 2; // Pixeldichte der Symbole (scharf auf Retina)

function zeichne(art: SymbolArt, theme: "light" | "dark"): ImageData | null {
  const f = FARBE[theme];
  const groesse = art === "ort" ? 12 : 24;
  const c = document.createElement("canvas");
  c.width = c.height = groesse * PX;
  const x = c.getContext("2d");
  if (!x) return null;
  x.scale(PX, PX);

  if (art === "ort") {
    x.fillStyle = f.ring; x.beginPath(); x.arc(6, 6, 5.2, 0, Math.PI * 2); x.fill();
    x.fillStyle = f.ort; x.beginPath(); x.arc(6, 6, 3.6, 0, Math.PI * 2); x.fill();
    return x.getImageData(0, 0, c.width, c.height);
  }

  const rund = art === "medizin" || art === "apotheke";
  const form = (inset: number) => rund
    ? new Path2D(`M12 ${1 + inset}a${11 - inset} ${11 - inset} 0 1 1 0 ${22 - 2 * inset}a${11 - inset} ${11 - inset} 0 1 1 0 ${-(22 - 2 * inset)}z`)
    : new Path2D(`M${7 + inset} ${1 + inset}h${10 - 2 * inset}a${6 - inset} ${6 - inset} 0 0 1 ${6 - inset} ${6 - inset}v${10 - 2 * inset}a${6 - inset} ${6 - inset} 0 0 1 ${-(6 - inset)} ${6 - inset}h${-(10 - 2 * inset)}a${6 - inset} ${6 - inset} 0 0 1 ${-(6 - inset)} ${-(6 - inset)}v${-(10 - 2 * inset)}a${6 - inset} ${6 - inset} 0 0 1 ${6 - inset} ${-(6 - inset)}z`);
  x.fillStyle = f.ring; x.fill(form(0));
  x.fillStyle = f[art]; x.fill(form(1.6));

  const z = ZEICHEN[art];
  x.save();
  x.translate(12, 12); x.scale(0.6, 0.6); x.translate(-12, -12);
  x.strokeStyle = "#ffffff"; x.lineWidth = z.breite; x.lineCap = "round"; x.lineJoin = "round";
  for (const d of z.pfade) x.stroke(new Path2D(d));
  x.restore();
  return x.getImageData(0, 0, c.width, c.height);
}

/** Setzt (oder erneuert) alle Lotse-Symbole im aktuellen Kartenstil. */
export function symboleEinsetzen(m: MlMap, theme: "light" | "dark") {
  for (const art of SYMBOLE) {
    const name = `lotse-${art}`;
    const bild = zeichne(art, theme);
    if (!bild) continue;
    if (m.hasImage(name)) m.updateImage(name, bild);
    else m.addImage(name, bild, { pixelRatio: PX });
  }
}

/** Lesbare Art eines Kartenpunkts aus den OpenMapTiles-Feldern */
export function ortArt(klasse: string, unterklasse: string): string {
  if (klasse === "bus") return "Bushaltestelle";
  if (klasse === "railway" || klasse === "rail") return unterklasse === "tram_stop" ? "Straßenbahnhaltestelle" : "Bahnhof oder Haltestelle";
  const m: Record<string, string> = {
    doctors: "Arztpraxis", doctor: "Arztpraxis", dentist: "Zahnarztpraxis", clinic: "Klinik", hospital: "Krankenhaus", pharmacy: "Apotheke",
  };
  return m[unterklasse] ?? m[klasse] ?? "Ort";
}
