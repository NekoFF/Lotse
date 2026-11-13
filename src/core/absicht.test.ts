import { describe, expect, it } from "vitest";
import { klingtNachBeschwerde, verstehe, zeitAus } from "./absicht";
import { schrittText } from "../services/orte";

const FR = new Date(2026, 10, 13, 12, 0); // Freitag, 13.11.2026, 12:00

describe("Eine Eingabe für alles", () => {
  it("Sicherheitsfilter kommt vor allem anderen", () => {
    expect(verstehe("Termin morgen 10 Uhr, starke Schmerzen in der Brust", FR).typ).toBe("notfall");
    expect(verstehe("Café, ich will nicht mehr leben", FR).typ).toBe("notfall");
  });
  it("Kategorien", () => {
    const k = (t: string) => { const a = verstehe(t, FR); return a.typ === "kategorie" ? a.kategorie.id : a.typ; };
    expect(k("Apotheke in der Nähe")).toBe("apotheke");
    expect(k("wo gibt es Kaffee")).toBe("cafe");
    expect(k("Zahnarztpraxis")).toBe("zahnarzt");
    expect(k("Supermarkt")).toBe("einkaufen");
  });
  it("Fachrichtung beim Namen", () => {
    const a = verstehe("Orthopäde", FR);
    expect(a.typ === "fach" && a.fach).toBe("ortho");
    const b = verstehe("HNO Arzt", FR);
    expect(b.typ === "fach" && b.fach).toBe("hno");
  });
  it("Anliegen in Alltagssprache → Fachrichtung, keine Diagnose", () => {
    const a = verstehe("Mein Knie tut seit gestern weh", FR);
    expect(a.typ).toBe("anliegen");
    if (a.typ === "anliegen") expect(a.zuordnung.fach.id).toBe("ortho");
  });
  it("Alltagssätze sind keine Beschwerden", () => {
    const a = verstehe("ich möchte heute Abend einen Film sehen", FR);
    expect(a.typ === "kategorie" && a.kategorie.id).toBe("freizeit");
    expect(klingtNachBeschwerde("ich sehe seit gestern schlecht")).toBe(true);
    expect(klingtNachBeschwerde("wir wollen zusammen was sehen")).toBe(false);
  });
  it("alles andere ist eine normale Suche", () => {
    expect(verstehe("Domplatz Wetzlar", FR)).toEqual({ typ: "suche", text: "Domplatz Wetzlar" });
  });
  it("Termin mit Zeit wird erkannt", () => {
    const a = verstehe("Termin morgen 10 Uhr Zahnarzt", FR);
    expect(a.typ).toBe("termin");
    if (a.typ === "termin") expect(a.zeit).toEqual(new Date(2026, 10, 14, 10, 0));
  });
});

describe("Zeitangaben", () => {
  it("heute, morgen, Wochentag, Datum", () => {
    expect(zeitAus("heute 15:30", FR)).toEqual(new Date(2026, 10, 13, 15, 30));
    expect(zeitAus("morgen um 9", FR)).toEqual(new Date(2026, 10, 14, 9, 0));
    expect(zeitAus("am Montag 8 Uhr", FR)).toEqual(new Date(2026, 10, 16, 8, 0));
    expect(zeitAus("am 20.11. um 14 Uhr", FR)).toEqual(new Date(2026, 10, 20, 14, 0));
  });
  it("ohne Uhrzeit oder unmöglich: nichts erfinden", () => {
    expect(zeitAus("morgen", FR)).toBeNull();
    expect(zeitAus("um 27 Uhr", FR)).toBeNull();
  });
});

describe("Wegbeschreibung auf Deutsch", () => {
  it("übersetzt OSRM-Schritte", () => {
    expect(schrittText({ distance: 10, name: "Bahnhofstraße", maneuver: { type: "depart" } })).toBe("Los auf Bahnhofstraße");
    expect(schrittText({ distance: 10, name: "", maneuver: { type: "turn", modifier: "left" } })).toBe("Links abbiegen");
    expect(schrittText({ distance: 10, name: "Ring", maneuver: { type: "roundabout", exit: 2 } })).toBe("Im Kreisverkehr 2. Ausfahrt auf Ring");
    expect(schrittText({ distance: 0, name: "", maneuver: { type: "arrive" } })).toBe("Ziel erreicht");
  });
});
