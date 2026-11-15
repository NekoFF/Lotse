import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LngLat } from "../data/praxen";

// Netz ersetzen: zwei Kandidaten, feste Zeiten aus der „OSRM-Tabelle“
const A: LngLat = [8.60, 50.10], B: LngLat = [8.70, 50.10];
vi.mock("../services/orte", () => ({
  inDerNaehe: vi.fn(async () => [
    { id: "nah-an-1", name: "Café Eins", lngLat: [8.61, 50.10] },
    { id: "mitte", name: "Café Mitte", lngLat: [8.65, 50.10] },
  ]),
  routeLaden: vi.fn(),
}));
vi.mock("../services/oepnv", () => ({ verbindungen: vi.fn(async () => []) }));
const zeiten: Record<string, number[]> = {
  // Start → [Café Eins, Café Mitte] in Sekunden
  "8.60000,50.10000": [120, 900],
  "8.70000,50.10000": [2400, 1000],
};
vi.mock("../services/dienste", async (orig) => ({
  ...(await orig<typeof import("../services/dienste")>()),
  holeJson: vi.fn(async (url: string) => {
    const start = url.split("/").pop()!.split(";")[0].split("?")[0];
    return { code: "Ok", durations: [[0, ...(zeiten[start] ?? [600, 600])]] };
  }),
  pkt: (p: LngLat) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`,
}));

const { treffpunkteFinden } = await import("./treffpunkt");
const person = (id: string, start: LngLat, extra = {}) => ({ id, name: id, farbe: "#000", start: { lngLat: start, name: id }, verkehr: "fuss" as const, mitBei: null, ...extra });

describe("Treffpunkt ist fair", () => {
  beforeEach(() => vi.clearAllMocks());
  it("wählt den Ort mit der kürzesten längsten Anreise, nicht die kleinste Summe für eine Person", async () => {
    const v = await treffpunkteFinden([person("Anna", A), person("Ben", B)], ["cafe"], () => {});
    expect(v[0].ort.name).toBe("Café Mitte");
    expect(v[0].laengste).toBe(1000);
    expect(v[1].laengste).toBe(2400);
  });
  it("braucht mindestens zwei Startpunkte", async () => {
    await expect(treffpunkteFinden([person("Anna", A)], ["cafe"], () => {})).rejects.toThrow();
  });
  it("Mitfahrer: Fahrer braucht Abholweg plus Weiterfahrt", async () => {
    const v = await treffpunkteFinden([person("Anna", A, { verkehr: "auto" }), person("Ben", B, { mitBei: "Anna" })], ["cafe"], () => {});
    const mitte = v.find((x) => x.ort.name === "Café Mitte")!;
    const anna = mitte.anreisen.find((a) => a.personId === "Anna")!.s!;
    const ben = mitte.anreisen.find((a) => a.personId === "Ben")!.s!;
    // Anna → Ben (Tabelle ab A, erster Wert 120 als Platzhalter) + Ben → Ziel (1000)
    expect(ben).toBe(1000);
    expect(anna).toBe(120 + 1000);
    expect(mitte.anreisen.find((a) => a.personId === "Ben")!.hinweis).toContain("Anna");
  });
});
