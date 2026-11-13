import { describe, expect, it } from "vitest";
import { containsTerm, normalize } from "./normalize";
import { pruefeSicherheit } from "./safety";
import { ordneZu } from "./match";

describe("normalize", () => {
  it("schreibt Umlaute aus und entfernt Satzzeichen", () => {
    expect(normalize("Mein Rücken tut WEH!")).toBe("mein ruecken tut weh");
    expect(normalize("Größe, Fuß")).toBe("groesse fuss");
  });
  it("trifft nur am Wortanfang", () => {
    const t = normalize("mir ist warm und der darm grummelt");
    expect(containsTerm(t, "arm")).toBe(false);
    expect(containsTerm(normalize("die Armbeuge tut weh"), "arm")).toBe(true);
  });
});

describe("Sicherheitsfilter", () => {
  it("erkennt Notruf-Lagen", () => {
    expect(pruefeSicherheit("Starke Schmerzen in der Brust und ich bekomme schlecht Luft").stufe).toBe("notruf");
    expect(pruefeSicherheit("Er ist bewusstlos").stufe).toBe("notruf");
  });
  it("erkennt seelische Krisen", () => {
    expect(pruefeSicherheit("ich will nicht mehr leben").stufe).toBe("seelsorge");
  });
  it("Notruf hat Vorrang vor Seelsorge", () => {
    expect(pruefeSicherheit("ich habe mich vergiftet und will sterben").stufe).toBe("notruf");
  });
  it("erkennt akute, nicht lebensbedrohliche Lagen", () => {
    expect(pruefeSicherheit("ich sehe plötzlich verschwommen").stufe).toBe("bereitschaft");
  });
  it("lässt gewöhnliche Anliegen durch", () => {
    expect(pruefeSicherheit("Seit einer Woche tut mir der Rücken weh").stufe).toBeNull();
    expect(pruefeSicherheit("Mein Zahn pocht").stufe).toBeNull();
  });
});

describe("Zuordnung", () => {
  const fall = (text: string) => ordneZu(text).fach.id;

  it("ordnet typische Anliegen richtig zu", () => {
    expect(fall("Seit einer Woche tut mir der Rücken weh")).toBe("ortho");
    expect(fall("Ausschlag am Arm, juckt stark")).toBe("derma");
    expect(fall("Mein Zahn pocht seit zwei Tagen")).toBe("zahn");
    expect(fall("Ich sehe seit gestern verschwommen")).toBe("auge");
    expect(fall("Pfeifen im Ohr")).toBe("hno");
    expect(fall("Es brennt beim Wasserlassen")).toBe("uro");
    expect(fall("Meine Periode ist unregelmäßig")).toBe("gyn");
    expect(fall("Ich kann nicht schlafen und bin dauernd traurig")).toBe("psych");
    expect(fall("Ich brauche eine Krankschreibung")).toBe("allgemein");
  });
  it("Kinder gehen zur Kinder- und Jugendmedizin, egal welcher Körperteil", () => {
    expect(fall("Mein Sohn hat Ohrenschmerzen")).toBe("kinder");
    expect(fall("Unser Baby hat Ausschlag")).toBe("kinder");
  });
  it("ohne Treffer: Hausarztpraxis, als unsicher markiert", () => {
    const z = ordneZu("Mir geht es irgendwie nicht gut");
    expect(z.fach.id).toBe("allgemein");
    expect(z.unsicher).toBe(true);
  });
  it("gibt die erkannten Wörter zurück, nie eine Krankheit", () => {
    const z = ordneZu("Mein Knie und die Hüfte tun weh");
    expect(z.erkannt).toEqual(expect.arrayContaining(["Knie", "Hüfte"]));
  });
  it("Arm trifft nicht in warm oder Darm", () => {
    expect(fall("Mir ist warm")).toBe("allgemein");
  });
});

import { fachAusOsm } from "./osmFach";
import beispiel from "../../scripts/beispieldaten/wetzlar-2026-11-13.json";

describe("Fachrichtung aus OpenStreetMap", () => {
  it("liest das Tag healthcare:speciality", () => {
    expect(fachAusOsm({ "healthcare:speciality": "orthopaedics" }, "Dr. A", "doctors")).toBe("ortho");
    expect(fachAusOsm({ "healthcare:speciality": "dermatology;plastic_surgery" }, "Dr. B", "doctors")).toBe("derma");
  });
  it("Zahnarzt über den Typ", () => {
    expect(fachAusOsm({}, "Praxis Müller", "dentist")).toBe("zahn");
  });
  it("eindeutiges Wort im Namen", () => {
    expect(fachAusOsm({}, "Fachärztin f. Allgemeinmedizin", "doctors")).toBe("allgemein");
  });
  it("erfindet nichts, wenn nichts erkennbar ist", () => {
    expect(fachAusOsm({}, "Dr. med. Schmidt", "doctors")).toBeNull();
    expect(fachAusOsm({ "healthcare:speciality": "radiology" }, "Radiologie Mitte", "doctors")).toBeNull();
  });
  it("echte Beispieldaten Wetzlar haben Fachrichtung, Koordinaten und Name", () => {
    const l = (beispiel as { praxen: { name: string; fach: string; lngLat: number[] }[] }).praxen;
    expect(l.length).toBeGreaterThan(20);
    for (const p of l) { expect(p.name).toBeTruthy(); expect(p.fach).toBeTruthy(); expect(p.lngLat).toHaveLength(2); }
  });
});
