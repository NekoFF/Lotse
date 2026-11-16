import { describe, expect, it } from "vitest";
import { raumFinden, zoneAn, type Rechteck, type Zone } from "./modell";
import { SCHULE } from "./schule";

const norm = ([a, b, c, d]: Rechteck): Rechteck => [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)];
const ueberlapp = (p: Rechteck, q: Rechteck) => {
  const [a, b, c, d] = norm(p), [e, f, g, h] = norm(q);
  return Math.max(0, Math.min(c, g) - Math.max(a, e)) * Math.max(0, Math.min(d, h) - Math.max(b, f));
};
/** berühren sich (gemeinsame Kante mit Länge > 0) */
const beruehren = (p: Rechteck, q: Rechteck) => {
  const [a, b, c, d] = norm(p), [e, f, g, h] = norm(q);
  const xKante = (c === e || g === a) && Math.min(d, h) - Math.max(b, f) > 0.4;
  const yKante = (d === f || h === b) && Math.min(c, g) - Math.max(a, e) > 0.4;
  return xKante || yKante || ueberlapp(p, q) > 0;
};
const zonenBeruehren = (x: Zone, y: Zone) => x.flaechen.some((p) => y.flaechen.some((q) => beruehren(p, q)));

describe("Schulgebäude als Modell", () => {
  it("drei Etagen, EG = Ebene 0", () => {
    expect(SCHULE.etagen.map((e) => e.ebene)).toEqual([0, 1, 2]);
  });

  for (const e of SCHULE.etagen) {
    describe(e.name, () => {
      it("keine Zonen überlappen", () => {
        const flaechen = e.zonen.flatMap((z) => z.flaechen.map((f) => ({ z: z.id, f })));
        const fehler: string[] = [];
        for (let i = 0; i < flaechen.length; i++) for (let j = i + 1; j < flaechen.length; j++)
          if (ueberlapp(flaechen[i].f, flaechen[j].f) > 0.01) fehler.push(`${flaechen[i].z} × ${flaechen[j].z}`);
        expect(fehler).toEqual([]);
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
      it("Flure hängen zusammen (je Bauteil)", () => {
        const flure = e.zonen.filter((z) => z.art === "flur" || z.art === "eingang");
        for (const z of flure) {
          // innerhalb einer Zone: alle Rechtecke über Kanten verbunden
          const offen = [0], gesehen = new Set([0]);
          while (offen.length) {
            const i = offen.pop()!;
            z.flaechen.forEach((f, j) => { if (!gesehen.has(j) && beruehren(z.flaechen[i], f)) { gesehen.add(j); offen.push(j); } });
          }
          expect(gesehen.size, z.id).toBe(z.flaechen.length);
        }
      });
      it("jede Raumgruppe, jedes WC und jede Treppe grenzt an einen Flur", () => {
        const wege = e.zonen.filter((z) => z.art === "flur" || z.art === "eingang");
        const ohne = e.zonen.filter((z) => ["raeume", "wc", "treppe"].includes(z.art) && !wege.some((w) => zonenBeruehren(z, w)));
        expect(ohne.map((z) => z.id)).toEqual([]);
      });
    });
  }

  it("Treppen liegen auf jeder Etage an derselben Stelle", () => {
    for (const t of SCHULE.treppen) for (const ebene of t.etagen) {
      const e = SCHULE.etagen.find((x) => x.ebene === ebene)!;
      const z = e.zonen.find((x) => x.id === t.id);
      expect(z?.flaechen[0], `${t.id} auf ${e.kurz}`).toEqual(t.flaeche);
    }
  });

  it("Raumsuche: Nummer → Etage und Bereich", () => {
    expect(raumFinden(SCHULE, "Raum 152")?.etage.kurz).toBe("1");
    expect(raumFinden(SCHULE, "152")?.zone?.name).toBe("Klassenräume");
    expect(raumFinden(SCHULE, "88")?.zone?.name).toBe("Laborräume Naturwissenschaften");
    expect(raumFinden(SCHULE, "247")?.etage.kurz).toBe("2");
    expect(raumFinden(SCHULE, "999")).toBeNull();
  });
});

import { umrissKanten } from "./modell";
describe("Wände aus Zonen", () => {
  it("L-Form: innere Kante fällt weg", () => {
    const k = umrissKanten({ id: "l", art: "raeume", flaechen: [[0, 0, 4, 2], [0, 2, 2, 4]] });
    const laenge = k.reduce((s, [a, b, c, d]) => s + Math.abs(c - a) + Math.abs(d - b), 0);
    expect(laenge).toBe(16); // Umfang der L-Form
    expect(k.some(([a, b, c, d]) => b === 2 && d === 2 && a === 0 && c === 2)).toBe(false);
  });
  it("Ring aus vier Rechtecken hat Außen- und Innenwand", () => {
    const k = umrissKanten({ id: "r", art: "flur", flaechen: [[0, 0, 10, 1], [0, 9, 10, 10], [0, 1, 1, 9], [9, 1, 10, 9]] });
    const laenge = k.reduce((s, [a, b, c, d]) => s + Math.abs(c - a) + Math.abs(d - b), 0);
    expect(laenge).toBe(40 + 32);
  });
});
