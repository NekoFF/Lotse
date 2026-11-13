import { useEffect, useRef } from "react";
import maplibregl, { type Map as MlMap, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LngLat } from "../data/geo";

/** Kostenlose Karte ohne Schlüssel: OpenFreeMap (Daten: OpenStreetMap). */
const STIL = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

const FARBE = {
  light: { accent: "#2447e6", casing: "#ffffff", planb: "#8597e6" },
  dark: { accent: "#6f8cff", casing: "#15161a", planb: "#5a6db5" },
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
  modus: "fuss" | "oepnv";
}

export interface Abstand { top: number; right: number; bottom: number; left: number }

interface Props {
  theme: "light" | "dark";
  start: LngLat;
  pins: Pin[];
  route: Route | null;
  /** Punkte, die sichtbar sein sollen; neu eingepasst, wenn sich rahmenSchluessel ändert */
  rahmen: LngLat[];
  rahmenSchluessel: string;
  abstand: Abstand;
  onPin?: (id: string) => void;
  onPinHover?: (id: string | null) => void;
}

export function LotseMap({ theme, start, pins, route, rahmen, rahmenSchluessel, abstand, onPin, onPinHover }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef(new Map<string, { m: Marker; el: HTMLButtonElement }>());
  const routeRef = useRef(route);
  const themeRef = useRef(theme);
  const cb = useRef({ onPin, onPinHover });
  cb.current = { onPin, onPinHover };
  routeRef.current = route;
  themeRef.current = theme;

  // Karte einmal anlegen
  useEffect(() => {
    if (!box.current) return;
    const m = new maplibregl.Map({
      container: box.current,
      style: STIL[themeRef.current],
      center: start,
      zoom: 14.2,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    m.touchZoomRotate.disableRotation();
    m.on("style.load", () => zeichneRoute(m, routeRef.current, themeRef.current));
    // Quellenangabe eingeklappt starten (bleibt per Klick auf „i“ erreichbar)
    m.once("load", () => box.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"));

    const me = document.createElement("div");
    me.className = "me";
    me.setAttribute("aria-label", "Startpunkt");
    new maplibregl.Marker({ element: me }).setLngLat(start).addTo(m);

    const zumStart = () => m.easeTo({ center: start, zoom: Math.max(m.getZoom(), 14.5), duration: 600 });
    const zoom = (e: Event) => m.easeTo({ zoom: m.getZoom() + (e as CustomEvent<number>).detail, duration: 300 });
    window.addEventListener("lotse:start", zumStart);
    window.addEventListener("lotse:zoom", zoom);

    map.current = m;
    return () => {
      window.removeEventListener("lotse:start", zumStart);
      window.removeEventListener("lotse:zoom", zoom);
      m.remove(); map.current = null; markers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hell/Dunkel
  useEffect(() => {
    const m = map.current;
    if (m) m.setStyle(STIL[theme]);
  }, [theme]);

  // Route
  useEffect(() => {
    const m = map.current;
    if (m && m.isStyleLoaded()) zeichneRoute(m, route, theme);
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

  // Ausschnitt einpassen
  useEffect(() => {
    const m = map.current;
    if (!m || rahmen.length === 0) return;
    const b = new maplibregl.LngLatBounds(rahmen[0], rahmen[0]);
    rahmen.forEach((p) => b.extend(p));
    const pad = { top: abstand.top + 70, right: abstand.right + 50, bottom: abstand.bottom + 40, left: abstand.left + 50 };
    // Gespeicherten Rand zurücksetzen, sonst addiert MapLibre alten und neuen Rand
    m.setPadding({ top: 0, right: 0, bottom: 0, left: 0 });
    if (rahmen.length === 1) m.easeTo({ center: rahmen[0], zoom: 14.6, padding: pad, duration: 700 });
    else m.fitBounds(b, { padding: pad, maxZoom: 16, duration: 800 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rahmenSchluessel, abstand.bottom, abstand.left]);

  return <div ref={box} className="karte" aria-label="Karte" />;
}

function zeichneRoute(m: MlMap, r: Route | null, theme: "light" | "dark") {
  const f = FARBE[theme];
  const daten: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: r
      ? [
          ...(r.planb ? [linie(r.planb, "planb")] : []),
          linie(r.linie, r.modus === "fuss" ? "fuss" : "oepnv"),
        ]
      : [],
  };
  const quelle = m.getSource("route") as maplibregl.GeoJSONSource | undefined;
  if (quelle) { quelle.setData(daten); return; }
  m.addSource("route", { type: "geojson", data: daten });
  const rund = { "line-cap": "round", "line-join": "round" } as const;
  m.addLayer({ id: "planb", type: "line", source: "route", filter: ["==", ["get", "art"], "planb"], layout: rund,
    paint: { "line-color": f.planb, "line-width": 4, "line-dasharray": [1.6, 1.6] } });
  m.addLayer({ id: "oepnv-rand", type: "line", source: "route", filter: ["==", ["get", "art"], "oepnv"], layout: rund,
    paint: { "line-color": f.casing, "line-width": 10 } });
  m.addLayer({ id: "oepnv", type: "line", source: "route", filter: ["==", ["get", "art"], "oepnv"], layout: rund,
    paint: { "line-color": f.accent, "line-width": 6 } });
  m.addLayer({ id: "fuss", type: "line", source: "route", filter: ["==", ["get", "art"], "fuss"], layout: rund,
    paint: { "line-color": f.accent, "line-width": 6, "line-dasharray": [0.01, 2] } });
}

function linie(coords: LngLat[], art: string): GeoJSON.Feature {
  return { type: "Feature", properties: { art }, geometry: { type: "LineString", coordinates: coords } };
}
