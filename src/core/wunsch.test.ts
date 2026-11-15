import { describe, expect, it } from "vitest";
import { istWunsch, wunschAus } from "./wunsch";

const SO = new Date(2026, 10, 15, 19, 0);

describe("Wünsche zerlegen", () => {
  it("Küche, Bezugspunkt, Stadt, jetzt geöffnet", () => {
    const w = wunschAus("wo kann ich jetzt Pizza essen nahe Römer in Frankfurt", SO);
    expect(w.kueche?.name).toBe("Pizza");
    expect(w.nahe).toBe("Römer");
    expect(w.ort).toBe("Frankfurt");
    expect(w.offen).toBe(true);
  });
  it("Döner beim Bahnhof", () => {
    const w = wunschAus("Döner beim Bahnhof", SO);
    expect(w.kueche?.name).toBe("Döner");
    expect(w.nahe).toBe("Bahnhof");
    expect(w.offen).toBe(false);
  });
  it("etwas Ruhiges mit den Eltern", () => {
    const w = wunschAus("wo kann ich mit meinen Eltern spazieren gehen", SO);
    expect(w.kategorie?.id).toBe("freizeit");
  });
  it("mit Uhrzeit", () => {
    const w = wunschAus("Sushi heute um 20 Uhr in Gießen", SO);
    expect(w.kueche?.name).toBe("Sushi");
    expect(w.ort).toBe("Gießen");
    expect(w.zeit?.getHours()).toBe(20);
  });
});

describe("istWunsch grenzt ab", () => {
  const j = new Date("2026-11-13T12:00:00");
  it("Termin bei Dr. Müller ist kein Wunsch", () => {
    expect(istWunsch(wunschAus("Termin morgen 10 Uhr bei Dr. Müller", j))).toBe(false);
  });
  it("Apotheke jetzt offen ist einer", () => {
    expect(istWunsch(wunschAus("Apotheke jetzt offen", j), true)).toBe(true);
  });
  it("Café nahe Dom nur mit Kategorie", () => {
    expect(istWunsch(wunschAus("Café nahe Dom", j))).toBe(false);
    expect(istWunsch(wunschAus("Café nahe Dom", j), true)).toBe(true);
  });
});

describe("Review-Fälle", () => {
  const j = new Date("2026-11-13T12:00:00");
  it("Thailand-Urlaub und Currywurst sind keine Küchen", () => {
    expect(wunschAus("Thailand Urlaub", j).kueche).toBeNull();
    expect(wunschAus("Currywurst", j).kueche).toBeNull();
  });
  it("Familie Schmidt / mit Oma zum Arzt sind keine Freizeit", () => {
    expect(wunschAus("Familie Schmidt in Wetzlar", j).kategorie).toBeNull();
    expect(wunschAus("Mit Oma zum Arzt in Wetzlar", j).kategorie).toBeNull();
    expect(wunschAus("mit meinen Eltern spazieren", j).kategorie?.id).toBe("freizeit");
  });
  it("„Die Wunde ist offen“ ist kein Wunsch", () => {
    expect(istWunsch(wunschAus("Die Wunde ist offen und eitert", j))).toBe(false);
  });
});
