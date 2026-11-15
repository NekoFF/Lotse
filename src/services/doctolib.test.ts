import { describe, expect, it } from "vitest";
import { doctolibLink, istDoctolib, stadtAus } from "./doctolib";
import type { Ort } from "./orte";

const ort = (teil: Partial<Ort>) => ({ id: "x", name: "Praxis", art: "Zahnarzt", lngLat: [8.5, 50.55], adresse: null, fach: null, ...teil }) as unknown as Ort;

describe("Doctolib nur als Link", () => {
  it("Stadt aus der Adresse", () => {
    expect(stadtAus("Bahnhofstraße 1, 35578 Wetzlar")).toBe("Wetzlar");
    expect(stadtAus("Bahnhofstraße 1")).toBeNull();
    expect(stadtAus(null)).toBeNull();
  });
  it("erkennt nur echte Doctolib-Adressen", () => {
    expect(istDoctolib("https://www.doctolib.de/zahnarzt/wetzlar/max")).toBe(true);
    expect(istDoctolib("https://doctolib.de.boese.example/")).toBe(false);
    expect(istDoctolib("kein link")).toBe(false);
    expect(istDoctolib(null)).toBe(false);
  });
  it("geprüfter Fach-Pfad mit Stadt, sonst Startseite", () => {
    expect(doctolibLink(ort({ fach: "zahn" as Ort["fach"], adresse: "Weg 2, 60311 Frankfurt am Main" }))).toBe("https://www.doctolib.de/zahnmedizin/frankfurt-am-main");
    expect(doctolibLink(ort({ fach: "zahn" as Ort["fach"], adresse: null }))).toBe("https://www.doctolib.de/");
    expect(doctolibLink(ort({ fach: null, adresse: "Weg 2, 35578 Wetzlar" }))).toBe("https://www.doctolib.de/");
  });
});
