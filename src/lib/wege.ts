import { useEffect, useState } from "react";
import type { LngLat, Modus } from "../data/praxen";
import { fehlerText } from "../services/dienste";
import { routeLaden, type Route } from "../services/orte";

export interface WegStand { route: Route | null; status: "aus" | "laden" | "ok" | "fehler"; fehler?: string }

/** Echte Route vom Start zum Ziel; nur gültig für genau diesen Start, dieses Ziel und dieses Verkehrsmittel. */
export function useRoute(start: LngLat | null, ziel: LngLat | null, modus: Modus, versuch: number): WegStand {
  const key = start && ziel ? `${start.join(",")}|${ziel.join(",")}|${modus}` : "";
  const [s, setS] = useState<WegStand & { key: string }>({ key: "", route: null, status: "aus" });
  useEffect(() => {
    if (!key) return;
    let aus = false;
    setS({ key, route: null, status: "laden" });
    routeLaden(start!, ziel!, modus).then(
      (route) => { if (!aus) setS({ key, route, status: "ok" }); },
      (e) => { if (!aus) setS({ key, route: null, status: "fehler", fehler: fehlerText(e) }); },
    );
    return () => { aus = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, versuch]);
  if (!key) return { route: null, status: "aus" };
  return s.key === key ? s : { route: null, status: "laden" };
}
