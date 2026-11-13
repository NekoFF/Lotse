import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ABSTAND_MS, NOMINATIM_MAX } from "../config";
import beispiel from "../../scripts/beispieldaten/wetzlar-2026-11-13.json";
import { _zuruecksetzen, alsPraxis, ersteNummer, praxenSuchen, runden, sichereWebsite, telLink, zeitenBerechnen, type NomTreffer } from "./dienste";
import type { LngLat, Praxis } from "../data/praxen";

/** Echte Beispieldaten (Wetzlar, OSM) in der Form, wie Nominatim sie liefert */
interface BspPraxis { id: string; name: string; fach: string; lngLat: [number, number]; strasse: string | null; ort: string | null; website: string | null; telefon: string | null; oeffnungszeiten: string | null; rollstuhl: string | null }
const BSP = (beispiel as unknown as { start: { lngLat: LngLat }; praxen: BspPraxis[] });
const START = BSP.start.lngLat;
const SPEZ: Record<string, string> = { allgemein: "general", ortho: "orthopaedics", derma: "dermatology", auge: "ophthalmology", hno: "otolaryngology", gyn: "gynaecology", uro: "urology", kinder: "paediatrics", psych: "psychiatry" };
const alsNominatim = (p: BspPraxis): NomTreffer => ({
  osm_type: p.id.split("-")[0], osm_id: Number(p.id.split("-")[1]), lon: String(p.lngLat[0]), lat: String(p.lngLat[1]),
  name: p.name, display_name: p.name, type: p.fach === "zahn" ? "dentist" : "doctors",
  extratags: { ...(p.fach !== "zahn" ? { "healthcare:speciality": SPEZ[p.fach] } : {}), ...(p.website ? { website: p.website } : {}), ...(p.telefon ? { phone: p.telefon } : {}) },
  address: { road: p.strasse ?? undefined, city: p.ort ?? undefined },
});

const antwort = (daten: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => daten }) as Response;
let aufrufe: { url: string; zeit: number }[] = [];

beforeEach(() => {
  _zuruecksetzen();
  aufrufe = [];
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function fetchMit(antworten: (url: string) => Response) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => { aufrufe.push({ url, zeit: Date.now() }); return antworten(url); }));
}

describe("Daten aus OSM übernehmen, ohne etwas zu erfinden", () => {
  it("Website nur als echte http(s)-Adresse", () => {
    expect(sichereWebsite("praxis-mueller.de")).toBe("https://praxis-mueller.de/");
    expect(sichereWebsite("https://a.de; https://b.de")).toBe("https://a.de/");
    expect(sichereWebsite("javascript:alert(1)")).toBeNull();
    expect(sichereWebsite("keine-domain")).toBeNull();
    expect(sichereWebsite(undefined)).toBeNull();
  });
  it("bei mehreren Telefonnummern nur die erste, tel:-Link nur aus Ziffern", () => {
    expect(ersteNummer("+49 6441 1234; +49 6441 5678")).toBe("+49 6441 1234");
    expect(ersteNummer("k. A.")).toBeNull();
    expect(telLink("+49 (6441) 12-34")).toBe("tel:+4964411234");
  });
  it("Praxis ohne erkennbare Fachrichtung wird weggelassen", () => {
    expect(alsPraxis({ osm_type: "node", osm_id: 1, lat: "50", lon: "8", name: "Dr. med. Schmidt", display_name: "", type: "doctors", extratags: {} })).toBeNull();
  });
  it("Startpunkt wird auf 4 Stellen (~10 m) gerundet", () => {
    expect(runden(8.504371234)).toBe(8.5044);
    expect(runden(50.565081)).toBe(50.5651);
  });
});

describe("Praxissuche (Nominatim, gemockt mit echten Wetzlar-Daten)", () => {
  it("findet nur die gesuchte Fachrichtung im KREIS um den Start und sendet keine Fachrichtung", async () => {
    fetchMit(() => antwort(BSP.praxen.slice(0, 30).map(alsNominatim)));
    const { praxen, gekappt } = await praxenSuchen(START, "zahn", 1);
    const url = decodeURIComponent(aufrufe[0].url);
    expect(url).toContain("q=[dentist]");
    expect(url).not.toMatch(/zahn|ortho|psych|haut|ruecken|rücken/i);
    expect(praxen.length).toBeGreaterThan(0);
    for (const p of praxen) {
      expect(p.fach).toBe("zahn");
      const dx = (p.lngLat[0] - START[0]) * 111 * Math.cos((START[1] * Math.PI) / 180), dy = (p.lngLat[1] - START[1]) * 111;
      expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(1.01);
    }
    expect(gekappt).toBe(false);
  });
  it("meldet, wenn der Dienst seine Höchstzahl geliefert hat", async () => {
    const viele = Array.from({ length: NOMINATIM_MAX }, (_, i) => alsNominatim(BSP.praxen[i % BSP.praxen.length]));
    fetchMit(() => antwort(viele));
    expect((await praxenSuchen(START, "ortho", 4)).gekappt).toBe(true);
  });
});

describe("Fahrzeiten (FOSSGIS-Routing) – Nutzungsbedingungen und ehrliche Ausfälle", () => {
  const ziele: Praxis[] = BSP.praxen.slice(0, 3).map((p) => alsPraxis(alsNominatim(p))!).filter(Boolean);
  const tabelle = () => antwort({ code: "Ok", durations: [[0, 120, 300, 600]], distances: [[0, 100, 400, 900]] });

  it("höchstens 1 Anfrage pro Sekunde, auch wenn mehrere Berechnungen gleichzeitig starten", async () => {
    fetchMit(tabelle);
    const p = Promise.all([zeitenBerechnen(START, ziele), zeitenBerechnen([START[0] + 0.01, START[1]], ziele)]);
    await vi.advanceTimersByTimeAsync(20000);
    await p;
    expect(aufrufe.length).toBe(6);
    for (let i = 1; i < aufrufe.length; i++) expect(aufrufe[i].zeit - aufrufe[i - 1].zeit).toBeGreaterThanOrEqual(ABSTAND_MS);
  });
  it("gleiche Anfrage wird nicht doppelt gesendet (Zwischenspeicher)", async () => {
    fetchMit(tabelle);
    const p = zeitenBerechnen(START, ziele).then(() => zeitenBerechnen(START, ziele));
    await vi.advanceTimersByTimeAsync(10000);
    await p;
    expect(aufrufe.length).toBe(3);
  });
  it("fällt ein Verkehrsmittel aus (429), heißt das „nicht verfügbar“, nicht „kein Weg“", async () => {
    fetchMit((url) => (url.includes("routed-car") ? antwort({}, 429) : tabelle()));
    const p = zeitenBerechnen(START, ziele);
    await vi.advanceTimersByTimeAsync(10000);
    const { liste, fehler } = await p;
    expect(fehler).toBeNull();
    expect(liste[0].zeiten.fuss).not.toBeNull();
    expect(liste[0].zeiten.auto).toBeNull();
    expect(liste[0].nichtAbrufbar).toEqual(["auto"]);
  });
  it("fallen alle aus, bleibt die Liste ohne Zeiten und mit Fehlersatz", async () => {
    fetchMit(() => antwort({}, 503));
    const p = zeitenBerechnen(START, ziele);
    await vi.advanceTimersByTimeAsync(10000);
    const { liste, fehler } = await p;
    expect(liste.length).toBe(ziele.length);
    expect(liste.every((x) => x.zeiten.fuss === null && x.zeiten.rad === null && x.zeiten.auto === null)).toBe(true);
    expect(fehler).toMatch(/nicht erreichbar/);
  });
  it("das gewählte Verkehrsmittel kommt zuerst, Zwischenstände markieren den Rest als „lädt“", async () => {
    fetchMit(tabelle);
    const teile: { auto: boolean; fuss: boolean; aus: string[] }[] = [];
    const p = zeitenBerechnen(START, ziele, "auto", (l) => teile.push({ auto: l[0].zeiten.auto !== null, fuss: l[0].zeiten.fuss !== null, aus: l[0].ausstehend ?? [] }));
    await vi.advanceTimersByTimeAsync(10000);
    const { liste } = await p;
    expect(aufrufe[0].url).toContain("routed-car");
    expect(teile[0]).toEqual({ auto: true, fuss: false, aus: ["fuss", "rad"] });
    expect(liste[0].ausstehend).toBeUndefined();
  });
  it("ein Fehler wird nicht zwischengespeichert: erneut versuchen fragt wieder an", async () => {
    let n = 0;
    fetchMit(() => (n++ === 0 ? antwort({}, 503) : tabelle()));
    const p = zeitenBerechnen(START, ziele.slice(0, 1)).then(() => zeitenBerechnen(START, ziele.slice(0, 1)));
    await vi.advanceTimersByTimeAsync(20000);
    const { liste } = await p;
    expect(liste[0].zeiten.fuss).not.toBeNull();
  });
});
