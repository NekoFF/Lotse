import { describe, expect, it } from "vitest";
import { szene3D } from "./drei";
import { HUELLE, karteNachPlan, MITTE, planNachKarte } from "./karte";
import { SCHULE } from "./schule";

describe("Schule in 3D auf der Karte", () => {
  it("Plan liegt auf dem Schulgrundstück an der Dammstraße (Wetzlar)", () => {
    const [lng, lat] = planNachKarte(45, 25);
    expect(lng).toBeGreaterThan(8.511); expect(lng).toBeLessThan(8.516);
    expect(lat).toBeGreaterThan(50.575); expect(lat).toBeLessThan(50.578);
    expect(Math.hypot((MITTE[0] - lng) * 70900, (MITTE[1] - lat) * 111200)).toBeLessThan(40);
  });
  it("Maßstab stimmt: Abstand der Südtreppen ≈ 47 m echte Meter", () => {
    const a = planNachKarte(20.25, 5), b = planNachKarte(69.25, 5);
    const m = Math.hypot((a[0] - b[0]) * 70900, (a[1] - b[1]) * 111200);
    expect(m).toBeGreaterThan(46); expect(m).toBeLessThan(48.5);
  });
  it("Umkehrung Karte → Plan trifft wieder den Ausgangspunkt", () => {
    const [x, y] = karteNachPlan(planNachKarte(37.5, 61.25));
    expect(x).toBeCloseTo(37.5, 6); expect(y).toBeCloseTo(61.25, 6);
  });
  it("Hülle: 26 Teile mit gemessenen Höhen bis 18,2 m", () => {
    expect(HUELLE).toHaveLength(26);
    expect(Math.max(...HUELLE.map((t) => t.h))).toBeCloseTo(18.19, 1);
  });
  it("jede Etage: Böden auf ihrer Höhe, Wände darüber, obere Etagen ausgeblendet", () => {
    for (const e of SCHULE.etagen) {
      const f = szene3D(SCHULE, e.ebene).features as GeoJSON.Feature<GeoJSON.Polygon, { art: string; basis: number; hoehe: number }>[];
      const boden = f.filter((x) => x.properties.art === "boden");
      expect(boden.length, e.name).toBeGreaterThan(5);
      for (const b of boden) expect(b.properties.basis).toBeCloseTo(e.ebene * SCHULE.geschosshoehe, 5);
      const wand = f.filter((x) => x.properties.art === "wand");
      expect(wand.length).toBeGreaterThan(20);
      expect(Math.max(...f.filter((x) => x.properties.art !== "huelle").map((x) => x.properties.hoehe))).toBeLessThan((e.ebene + 1) * SCHULE.geschosshoehe);
      // alle Punkte nahe der Schule
      for (const x of f) for (const [lng, lat] of x.geometry.coordinates[0]) expect(Math.abs(lng - MITTE[0]) + Math.abs(lat - MITTE[1])).toBeLessThan(0.003);
    }
  });
});

import huelle3d from "./huelle3d.json";
describe("echte Dächer (LoD2-Dreiecke)", () => {
  it("Dreiecke vollständig, um die Schulmitte, Höhen 0–19 m", () => {
    for (const art of ["wand", "dach", "glas"] as const) {
      const v = huelle3d[art];
      expect(v.length % 9, art).toBe(0);
      expect(v.length, art).toBeGreaterThan(0);
      for (let i = 0; i < v.length; i += 3) {
        expect(Math.abs(v[i]), `${art} Ost`).toBeLessThan(110);
        expect(Math.abs(v[i + 1]), `${art} Nord`).toBeLessThan(110);
        expect(v[i + 2]).toBeGreaterThanOrEqual(-0.5);
        expect(v[i + 2]).toBeLessThan(19);
      }
    }
    expect(huelle3d.mitte[0]).toBeCloseTo(MITTE[0], 5);
    expect(huelle3d.mitte[1]).toBeCloseTo(MITTE[1], 5);
  });
  it("Glasdach liegt über dem Innenhof (Plan-Mitte), Dachflächen sind auch geneigt", () => {
    const g = huelle3d.glas;
    const ost = g.filter((_, i) => i % 3 === 0), nord = g.filter((_, i) => i % 3 === 1);
    const c = [ost.reduce((a, b) => a + b) / ost.length, nord.reduce((a, b) => a + b) / nord.length];
    // Mitte des Innenhofs im Plan ≈ (40, 28) → in Metern um MITTE
    const [lng, lat] = planNachKarte(40, 28);
    const soll = [(lng - MITTE[0]) * 70900, (lat - MITTE[1]) * 111200];
    expect(Math.hypot(c[0] - soll[0], c[1] - soll[1])).toBeLessThan(15);
    const d = huelle3d.dach; let geneigt = 0;
    for (let i = 0; i < d.length; i += 9) if (Math.max(d[i + 2], d[i + 5], d[i + 8]) - Math.min(d[i + 2], d[i + 5], d[i + 8]) > 0.5) geneigt++;
    expect(geneigt).toBeGreaterThan(10);
  });
});
