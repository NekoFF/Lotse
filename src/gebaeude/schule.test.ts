import { describe, expect, it } from "vitest";
import { inRingen, raumFinden, textPlatz, umrissKanten, zoneAn, zoneEnthaelt, zonenFlaeche, type Kante, type Zone } from "./modell";
import { SCHULE } from "./schule";

/** Abstand Punkt–Strecke */
function abstand(px: number, py: number, [x1, y1, x2, y2]: Kante) {
  const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
/** liegen zwei Zonen höchstens `tol` Meter auseinander (gemeinsame Wand)? Prüft Punkte entlang der Kanten. */
function grenzenAn(a: Zone, b: Zone, tol = 0.6) {
  const kb = umrissKanten(b);
  return umrissKanten(a).some(([x1, y1, x2, y2]) => {
    const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 0.5));
    for (let i = 0; i <= n; i++) {
      const x = x1 + ((x2 - x1) * i) / n, y = y1 + ((y2 - y1) * i) / n;
      if (kb.some((k) => abstand(x, y, k) <= tol)) return true;
    }
    return false;
  });
}

describe("Schulgebäude als Modell", () => {
  it("drei Etagen, EG = Ebene 0", () => {
    expect(SCHULE.etagen.map((e) => e.ebene)).toEqual([0, 1, 2]);
  });

  for (const e of SCHULE.etagen) {
    describe(e.name, () => {
      it("keine Zonen überlappen (Raster alle 0,5 m)", () => {
        const doppelt = new Map<string, number>();
        for (let x = -10; x <= 150; x += 0.5) for (let y = -10; y <= 95; y += 0.5) {
          const da = e.zonen.filter((z) => zoneEnthaelt(z, x + 0.13, y + 0.17));
          if (da.length > 1) { const k = da.map((z) => z.id).sort().join(" × "); doppelt.set(k, (doppelt.get(k) ?? 0) + 1); }
        }
        expect([...doppelt.entries()]).toEqual([]);
      });
      it("jede Raumnummer steht in ihrer Zone und passt zur Etage", () => {
        for (const n of e.nummern) {
          expect(n.nr[0], n.nr).toBe(String(e.ebene));
          const z = zoneAn(e, n.x, n.y);
          expect(z?.nummern ?? [], `${n.nr} liegt in ${z?.id}`).toContain(n.nr);
        }
        const gelistet = e.zonen.flatMap((z) => z.nummern ?? []).sort();
        expect(gelistet).toEqual(e.nummern.map((n) => n.nr).sort());
      });
      it("jede Raumgruppe, jedes WC und jede Treppe grenzt an einen Flur", () => {
        const wege = e.zonen.filter((z) => z.art === "flur" || z.art === "eingang");
        const ohne = e.zonen.filter((z) => ["raeume", "wc", "treppe"].includes(z.art) && !z.name?.includes("ohne Beschriftung") && !wege.some((w) => grenzenAn(z, w)));
        expect(ohne.map((z) => z.id)).toEqual([]);
      });
      it("Beschriftungen liegen innerhalb ihres Bereichs", () => {
        for (const z of e.zonen) {
          const p = textPlatz(z, (z.name ?? "").length);
          expect(p, z.id).not.toBeNull();
          expect(zoneEnthaelt(z, p![0], p![1]), `${z.id} bei ${p![0].toFixed(1)}, ${p![1].toFixed(1)}`).toBe(true);
        }
      });
      it("keine leeren oder winzigen Zonen", () => {
        for (const z of e.zonen) expect(zonenFlaeche(z), z.id).toBeGreaterThan(5);
      });
    });
  }

  it("Treppen haben auf jeder Etage genau dieselbe Form", () => {
    for (const t of SCHULE.treppen) for (const ebene of t.etagen) {
      const e = SCHULE.etagen.find((x) => x.ebene === ebene)!;
      const z = e.zonen.find((x) => x.id === t.id);
      expect(z?.ringe, `${t.id} auf ${e.kurz}`).toEqual(t.ringe);
    }
  });

  it("EG: Markierung vollständig übernommen (11 Bereiche + 5 Treppen) und plausibel groß", () => {
    const eg = SCHULE.etagen[0];
    expect(eg.zonen.filter((z) => z.art === "treppe")).toHaveLength(5);
    expect(eg.zonen.filter((z) => z.ringe && z.art !== "treppe")).toHaveLength(11);
    // Treppenhaus etwa 4 × 10 m
    const sw = eg.zonen.find((z) => z.id === "treppe-sw")!;
    expect(zonenFlaeche(sw)).toBeGreaterThan(35);
    expect(zonenFlaeche(sw)).toBeLessThan(50);
    // Innenhof-Beschriftung liegt im begehbaren Bereich
    const hof = eg.etiketten!.find((t) => t.text === "Innenhof")!;
    expect(zoneAn(eg, hof.x, hof.y)?.art).toBe("flur");
  });

  it("Raumsuche: Nummer → Etage und Bereich", () => {
    expect(raumFinden(SCHULE, "Raum 152")?.etage.kurz).toBe("1");
    expect(raumFinden(SCHULE, "152")?.zone?.name).toBe("Klassenräume");
    expect(raumFinden(SCHULE, "88")?.zone?.name).toBe("Laborräume Naturwissenschaften");
    expect(raumFinden(SCHULE, "247")?.etage.kurz).toBe("2");
    expect(raumFinden(SCHULE, "999")).toBeNull();
  });
});

describe("Geometrie-Hilfen", () => {
  it("L-Form aus Rechtecken: innere Kante fällt weg", () => {
    const k = umrissKanten({ id: "l", art: "raeume", flaechen: [[0, 0, 4, 2], [0, 2, 2, 4]] });
    const laenge = k.reduce((s, [a, b, c, d]) => s + Math.abs(c - a) + Math.abs(d - b), 0);
    expect(laenge).toBe(16);
  });
  it("Punkt im Vieleck mit Loch", () => {
    const ringe: [number, number][][] = [[[0, 0], [10, 0], [10, 10], [0, 10]], [[3, 3], [7, 3], [7, 7], [3, 7]]];
    expect(inRingen(ringe, 1, 1)).toBe(true);
    expect(inRingen(ringe, 5, 5)).toBe(false);
    expect(zonenFlaeche({ id: "x", art: "flur", flaechen: [], ringe })).toBe(84);
  });
});
