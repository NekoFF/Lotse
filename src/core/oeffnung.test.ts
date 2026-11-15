import { describe, expect, it } from "vitest";
import { geoeffnet } from "./oeffnung";

const am = (tag: number, h: number, m = 0) => { const d = new Date(2026, 10, 15 + ((tag - 0 + 7) % 7), h, m); return d; }; // 15.11.2026 = Sonntag

describe("Öffnungszeiten aus OSM", () => {
  it("Werktage mit Mittagspause", () => {
    const oh = "Mo-Fr 08:00-12:00,14:00-18:00; Sa 09:00-12:00";
    expect(geoeffnet(oh, am(1, 9))?.offen).toBe(true);
    expect(geoeffnet(oh, am(1, 13))).toEqual({ offen: false, ab: "14:00" });
    expect(geoeffnet(oh, am(6, 11))?.offen).toBe(true);
    expect(geoeffnet(oh, am(0, 11))?.offen).toBe(false);
  });
  it("über Mitternacht und 24/7", () => {
    expect(geoeffnet("Mo-Su 18:00-02:00", am(2, 1))?.offen).toBe(true);
    expect(geoeffnet("24/7", am(3, 4))?.offen).toBe(true);
  });
  it("unbekanntes Format → null, keine Vermutung", () => {
    expect(geoeffnet("sunrise-sunset", am(1, 9))).toBeNull();
    expect(geoeffnet("Mo-Fr 08:00-18:00 \"nach Vereinbarung\"", am(1, 9))).toBeNull();
    expect(geoeffnet(null, am(1, 9))).toBeNull();
  });
});

describe("Öffnungszeiten – Grenzfälle aus dem Review", () => {
  it("„PH,Su off“ macht Sonntag zu", () => {
    expect(geoeffnet("Mo-Su 10:00-20:00; PH,Su off", new Date("2026-11-15T12:00:00"))?.offen).toBe(false);
  });
  it("an Feiertagen unbekannt statt geöffnet", () => {
    expect(geoeffnet("Mo-Su 10:00-20:00", new Date("2026-12-25T12:00:00"))).toBeNull();
    expect(geoeffnet("Mo-Su 10:00-20:00", new Date("2027-03-26T12:00:00"))).toBeNull(); // Karfreitag 2027
  });
  it("Endzeit nach Mitternacht (26:00) reicht in den nächsten Tag", () => {
    expect(geoeffnet("Mo-Fr 10:00-26:00", new Date("2026-11-14T01:00:00"))).toEqual({ offen: true, bis: "02:00" });
  });
  it("unmögliche Zeiten = unbekannt", () => {
    expect(geoeffnet("Mo-Fr 25:00-26:00", new Date("2026-11-13T12:00:00"))).toBeNull();
  });
  it("24:00 heißt bis 24:00", () => {
    expect(geoeffnet("Mo-Su 10:00-24:00", new Date("2026-11-13T12:00:00"))).toEqual({ offen: true, bis: "24:00" });
  });
});
