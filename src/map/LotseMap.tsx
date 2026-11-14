import { useEffect, useRef } from "react";
import maplibregl, { type Map as MlMap, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DIENSTE } from "../config";
import type { LngLat } from "../data/praxen";
import { ortArt, symboleEinsetzen } from "./kartenSymbole";

const STIL = DIENSTE.kartenStil;
/** Ohne Startpunkt: Wetzlar (Schulort) */
const UEBERBLICK = { center: [8.5044, 50.5558] as LngLat, zoom: 13.6 };

const FARBE = {
  light: { accent: "#2f5bff", rand: "#1a36a8", casing: "#ffffff", rad: "#18a058", planb: "#8597e6" },
  dark: { accent: "#6f8cff", rand: "#24357d", casing: "#15161a", rad: "#3ccf82", planb: "#5a6db5" },
};

export interface Pin {
  id: string;
  lngLat: LngLat;
  label: string;
  aktiv: boolean;
}

export interface Route {
  linie: LngLat[];
  planb: LngLat[] | null;
  modus: "fuss" | "rad" | "auto";
}

export interface Abstand { top: number; right: number; bottom: number; left: number }

interface Props {
  theme: "light" | "dark";
  start: LngLat | null;
  pins: Pin[];
  route: Route | null;
  /** Punkte, die sichtbar sein sollen; neu eingepasst, wenn sich rahmenSchluessel ändert */
  rahmen: LngLat[];
  rahmenSchluessel: string;
  abstand: Abstand;
  onPin?: (id: string) => void;
  onPinHover?: (id: string | null) => void;
  /** 3D-Gebäude und geneigte Ansicht */
  dreiD?: boolean;
  /** Tipp auf einen Kartenpunkt (Haltestelle, Praxis, Laden …) aus OpenStreetMap */
  /** Tipp irgendwo auf die Karte; poi = getroffenes Kartensymbol (Name/Art aus OpenStreetMap) */
  onKarteTipp?: (lngLat: LngLat, poi: { name: string; art: string } | null) => void;
  /** Kartenmitte nach jeder Bewegung (für „in der Nähe“) */
  onMitte?: (lngLat: LngLat) => void;
  /** Klick auf eine leere Stelle */
  onLeer?: () => void;
}

/** Ebenen mit antippbaren Kartenpunkten (aus public/karte/stil-*.json) */
const ORT_EBENEN = ["lotse-poi-oepnv", "lotse-poi-medizin", "lotse-poi-orte"];
const LIZENZ_URL = `${import.meta.env.BASE_URL}karte/LIZENZ.txt`;

export function LotseMap({ theme, start, pins, route, rahmen, rahmenSchluessel, abstand, onPin, onPinHover, dreiD = false, onKarteTipp, onMitte, onLeer }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef(new Map<string, { m: Marker; el: HTMLButtonElement }>());
  const routeRef = useRef(route);
  const themeRef = useRef(theme);
  const meRef = useRef<Marker | null>(null);
  const startRef = useRef(start);
  startRef.current = start;
  const cb = useRef({ onPin, onPinHover, onKarteTipp, onMitte, onLeer });
  cb.current = { onPin, onPinHover, onKarteTipp, onMitte, onLeer };
  const dreiDRef = useRef(dreiD);
  dreiDRef.current = dreiD;
  routeRef.current = route;
  themeRef.current = theme;

  // Karte einmal anlegen
  useEffect(() => {
    if (!box.current) return;
    const m = new maplibregl.Map({
      container: box.current,
      style: STIL[themeRef.current],
      center: start ?? UEBERBLICK.center,
      zoom: start ? 14.2 : UEBERBLICK.zoom,
      // Bedingung von FOSSGIS: Link „Kartenfehler melden“; OSM-Quellenangabe kommt aus dem Kartenstil
      // Kartenstil nach BSD/CC BY: Herkunft und Lizenzen verlinkt
      attributionControl: {
        compact: true,
        customAttribution: [
          '<a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">Kartenfehler melden</a>',
          `<a href="${LIZENZ_URL}" target="_blank" rel="noopener noreferrer">Kartenstil: OpenMapTiles, CARTO (CC BY)</a>`,
        ],
      },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    m.touchZoomRotate.disableRotation();
    m.on("style.load", () => {
      symboleEinsetzen(m, themeRef.current);
      zeige3D(m, dreiDRef.current);
      zeichneRoute(m, routeRef.current, themeRef.current);
    });
    // falls ein Symbol vor dem Einsetzen gebraucht wird
    m.on("styleimagemissing", (e) => { if (e.id.startsWith("lotse-")) symboleEinsetzen(m, themeRef.current); });
    // Kartenpunkte antippen: Name und Art aus OpenStreetMap
    m.on("moveend", () => { const c = m.getCenter(); cb.current.onMitte?.([c.lng, c.lat]); });
    m.on("click", (e) => {
      const ebenen = ORT_EBENEN.filter((id) => m.getLayer(id));
      const f = ebenen.length ? m.queryRenderedFeatures([[e.point.x - 10, e.point.y - 10], [e.point.x + 10, e.point.y + 10]], { layers: ebenen })[0] : undefined;
      const p = f?.properties;
      const name = p ? String(p["name:de"] ?? p.name_de ?? p.name ?? "") : "";
      const poi = name ? { name, art: ortArt(String(p!.class ?? ""), String(p!.subclass ?? "")) } : null;
      const g = f?.geometry.type === "Point" ? (f.geometry.coordinates as LngLat) : null;
      // Wie Google Maps: ein Klick öffnet nur echte Kartensymbole; leere Stellen erst per Doppelklick / langem Drücken
      if (poi && g) cb.current.onKarteTipp?.([g[0], g[1]], poi);
      else cb.current.onLeer?.();
    });
    m.doubleClickZoom.disable();
    const punkt = (e: maplibregl.MapMouseEvent) => { e.preventDefault(); cb.current.onKarteTipp?.([e.lngLat.lng, e.lngLat.lat], null); };
    m.on("dblclick", punkt);
    m.on("contextmenu", punkt); // Rechtsklick bzw. langes Drücken am Telefon
    for (const id of ORT_EBENEN) {
      m.on("mouseenter", id, () => { m.getCanvas().style.cursor = "pointer"; });
      m.on("mouseleave", id, () => { m.getCanvas().style.cursor = ""; });
    }
    // OSMF-Richtlinie: beim Start sichtbar, darf nach 5 s einklappen (MapLibre klappt beim Verschieben ohnehin ein; „i“ öffnet wieder)
    m.once("load", () => window.setTimeout(() => box.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"), 5000));

    const me = document.createElement("div");
    me.className = "me";
    me.setAttribute("aria-label", "Startpunkt");
    meRef.current = new maplibregl.Marker({ element: me }).setLngLat(start ?? UEBERBLICK.center);
    if (start) meRef.current.addTo(m);

    const zumStart = () => { const s = startRef.current; if (s) m.easeTo({ center: s, zoom: Math.max(m.getZoom(), 14.5), duration: 600 }); };
    const zoom = (e: Event) => m.easeTo({ zoom: m.getZoom() + (e as CustomEvent<number>).detail, duration: 300 });
    window.addEventListener("lotse:start", zumStart);
    window.addEventListener("lotse:zoom", zoom);

    map.current = m;
    // nur im Entwicklungsmodus: Karte in der Konsole prüfen (fehlt im fertigen Build)
    if (import.meta.env.DEV) (window as unknown as { __lotseKarte?: MlMap }).__lotseKarte = m;
    return () => {
      window.removeEventListener("lotse:start", zumStart);
      window.removeEventListener("lotse:zoom", zoom);
      m.remove(); map.current = null; markers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Startpunkt setzen oder verschieben
  useEffect(() => {
    const m = map.current, me = meRef.current;
    if (!m || !me) return;
    if (start) me.setLngLat(start).addTo(m); else me.remove();
  }, [start]);

  // 3D an/aus
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (m.isStyleLoaded()) zeige3D(m, dreiD);
    m.easeTo({ pitch: dreiD ? 50 : 0, zoom: dreiD ? Math.max(m.getZoom(), 15.8) : m.getZoom(), duration: 700 });
  }, [dreiD]);

  // Hell/Dunkel
  useEffect(() => {
    const m = map.current;
    if (m) m.setStyle(STIL[theme]);
  }, [theme]);

  // Route: immer zeichnen – isStyleLoaded() ist auch beim bloßen Nachladen von Kacheln false,
  // dann ging die Linie beim Wechsel des Verkehrsmittels verloren
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const zeichne = () => zeichneRoute(m, routeRef.current, themeRef.current);
    if (m.getSource("route") || m.isStyleLoaded()) zeichne();
    else m.once("idle", zeichne);
  }, [route, theme]);

  // Pins als HTML-Marker (bleiben beim Stilwechsel erhalten)
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const neu = new Set(pins.map((p) => p.id));
    for (const [id, { m: mk }] of markers.current) {
      if (!neu.has(id)) { mk.remove(); markers.current.delete(id); }
    }
    for (const p of pins) {
      let e = markers.current.get(p.id);
      if (!e) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "pin";
        el.addEventListener("click", (ev) => { ev.stopPropagation(); cb.current.onPin?.(p.id); });
        el.addEventListener("mouseenter", () => cb.current.onPinHover?.(p.id));
        el.addEventListener("mouseleave", () => cb.current.onPinHover?.(null));
        const mk = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(p.lngLat).addTo(m);
        e = { m: mk, el };
        markers.current.set(p.id, e);
      }
      e.el.textContent = p.label;
      e.el.setAttribute("aria-label", p.label);
      e.el.classList.toggle("aktiv", p.aktiv);
      e.el.style.zIndex = p.aktiv ? "3" : "1";
    }
  }, [pins]);

  // Ausschnitt einpassen – nur wenn sich der Inhalt ändert (nicht bei jeder Größenänderung des Blatts: das ruckelte)
  const abstandRef = useRef(abstand);
  abstandRef.current = abstand;
  useEffect(() => {
    const m = map.current;
    if (!m || rahmen.length === 0) return;
    const a = abstandRef.current;
    const pad = { top: a.top + 70, right: a.right + 50, bottom: a.bottom + 40, left: a.left + 50 };
    // Gespeicherten Rand zurücksetzen, sonst addiert MapLibre alten und neuen Rand
    m.setPadding({ top: 0, right: 0, bottom: 0, left: 0 });
    if (rahmen.length === 1) {
      // Ein Punkt (z. B. angetippt): nur verschieben, wenn er verdeckt wäre – wie Apple/Google Maps
      const p = m.project(rahmen[0]), c = m.getCanvas();
      const sichtbar = p.x > pad.left && p.x < c.clientWidth - pad.right && p.y > pad.top && p.y < c.clientHeight - pad.bottom;
      if (!sichtbar) m.easeTo({ center: rahmen[0], zoom: Math.max(m.getZoom(), 15), padding: pad, duration: 450 });
      return;
    }
    const b = new maplibregl.LngLatBounds(rahmen[0], rahmen[0]);
    rahmen.forEach((p) => b.extend(p));
    m.fitBounds(b, { padding: pad, maxZoom: 16, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rahmenSchluessel]);

  return <div ref={box} className="karte" aria-label="Karte" />;
}

function zeige3D(m: MlMap, an: boolean) {
  if (m.getLayer("lotse-3d")) m.setLayoutProperty("lotse-3d", "visibility", an ? "visible" : "none");
}

/** Breite wächst mit dem Zoom (wie bei Apple/Google Maps) */
const breite = (bei12: number, bei18: number) => ["interpolate", ["exponential", 1.5], ["zoom"], 12, bei12, 18, bei18] as unknown as number;

function zeichneRoute(m: MlMap, r: Route | null, theme: "light" | "dark") {
  const f = FARBE[theme];
  const daten: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: r ? [...(r.planb ? [linie(r.planb, "planb")] : []), linie(r.linie, r.modus)] : [],
  };
  const quelle = m.getSource("route") as maplibregl.GeoJSONSource | undefined;
  if (quelle) { quelle.setData(daten); return; }
  m.addSource("route", { type: "geojson", data: daten });
  // unter die Beschriftungen legen, damit Straßennamen lesbar bleiben
  const vor = m.getStyle().layers?.find((l) => l.type === "symbol")?.id;
  const rund = { "line-cap": "round", "line-join": "round" } as const;
  const ist = (art: string) => ["==", ["get", "art"], art] as maplibregl.FilterSpecification;
  const ebene = (id: string, art: string, paint: Record<string, unknown>) =>
    m.addLayer({ id, type: "line", source: "route", filter: ist(art), layout: rund, paint } as maplibregl.LineLayerSpecification, vor);

  ebene("planb", "planb", { "line-color": f.planb, "line-width": breite(3, 7), "line-dasharray": [1.4, 1.4], "line-opacity": 0.9 });
  // Auto: kräftige Linie mit dunklerem Rand
  ebene("auto-rand", "auto", { "line-color": f.rand, "line-width": breite(7, 18) });
  ebene("auto", "auto", { "line-color": f.accent, "line-width": breite(4.5, 13) });
  // Rad: grün mit hellem Rand
  ebene("rad-rand", "rad", { "line-color": f.casing, "line-width": breite(6, 15) });
  ebene("rad", "rad", { "line-color": f.rad, "line-width": breite(3.5, 10) });
  // Zu Fuß: runde Punkte auf zarter Spur
  ebene("fuss-spur", "fuss", { "line-color": f.accent, "line-opacity": 0.18, "line-width": breite(4, 10) });
  ebene("fuss", "fuss", { "line-color": f.accent, "line-width": breite(5, 12), "line-dasharray": [0, 1.7] });
}

function linie(coords: LngLat[], art: string): GeoJSON.Feature {
  return { type: "Feature", properties: { art }, geometry: { type: "LineString", coordinates: coords } };
}
