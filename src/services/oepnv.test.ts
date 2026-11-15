import { describe, expect, it } from "vitest";
import { polylinie } from "./oepnv";

describe("polylinie", () => {
  it("dekodiert das offizielle Google-Beispiel (Genauigkeit 5)", () => {
    const p = polylinie("_p~iF~ps|U_ulLnnqC_mqNvxq`@", 5);
    expect(p).toHaveLength(3);
    expect(p[0][0]).toBeCloseTo(-120.2, 5); expect(p[0][1]).toBeCloseTo(38.5, 5);
    expect(p[2][0]).toBeCloseTo(-126.453, 5); expect(p[2][1]).toBeCloseTo(43.252, 5);
  });
  it("leerer Text ergibt leere Linie", () => expect(polylinie("")).toEqual([]));
});
