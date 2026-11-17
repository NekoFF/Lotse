import maplibregl, { type CustomLayerInterface } from "maplibre-gl";
import daten from "./huelle3d.json";

/**
 * Echte Gebäudehülle aus dem amtlichen 3D-Gebäudemodell (LoD2, HVBG): Wände, geneigte Dächer, Glasdach.
 * Eigene WebGL-Ebene, weil fill-extrusion nur flache Dächer kann. Ecken liegen in Metern um MITTE (Ost, Nord, Höhe),
 * die Umrechnung in Mercator macht die Matrix – so bleibt die Genauigkeit von float32 im Zentimeterbereich.
 *
 * Modus „aussen“: Haus geschlossen. Modus „innen“: Dächer weg, Wände durchscheinend (Etagen sichtbar).
 */
export type HuellenModus = "aussen" | "innen" | "aus";

type Teil = { start: number; anzahl: number; farbe: [number, number, number]; deck: Record<HuellenModus, number> };

const VS = `
attribute vec3 a_pos; attribute vec3 a_norm;
uniform mat4 u_matrix;
varying float v_licht;
void main() {
  vec3 l = normalize(vec3(-0.35, -0.55, 0.75));
  v_licht = 0.62 + 0.38 * abs(dot(normalize(a_norm), l));
  gl_Position = u_matrix * vec4(a_pos, 1.0);
}`;
const FS = `
precision mediump float;
uniform vec3 u_farbe; uniform float u_deck;
varying float v_licht;
void main() { gl_FragColor = vec4(u_farbe * v_licht, u_deck); }`;

const farbe = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];

/** Matrix (Spalten zuerst) a · b */
function mal(a: ArrayLike<number>, b: number[]): number[] {
  const o = new Array<number>(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}

export function huellenEbene(id = "schule-huelle"): CustomLayerInterface & { setModus: (m: HuellenModus) => void } {
  let modus: HuellenModus = "aus";
  let karte: maplibregl.Map | null = null;
  let prog: WebGLProgram | null = null;
  let puffer: { pos: WebGLBuffer; norm: WebGLBuffer } | null = null;
  const teile: Teil[] = [];
  const ursprung = maplibregl.MercatorCoordinate.fromLngLat(daten.mitte as [number, number], 0);
  const s = ursprung.meterInMercatorCoordinateUnits();
  // Ost → +x, Nord → −y (Mercator-y wächst nach Süden), Höhe → +z
  const modell = [s, 0, 0, 0, 0, -s, 0, 0, 0, 0, s, 0, ursprung.x, ursprung.y, 0, 1];

  return {
    id, type: "custom", renderingMode: "3d",
    setModus(m) { modus = m; karte?.triggerRepaint(); },
    onAdd(map, gl) {
      karte = map;
      const shader = (art: number, src: string) => { const sh = gl.createShader(art)!; gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
      prog = gl.createProgram()!;
      gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      const pos: number[] = [], norm: number[] = [];
      const anhaengen = (liste: number[], f: string, deck: Record<HuellenModus, number>) => {
        const start = pos.length / 3;
        for (let i = 0; i + 8 < liste.length; i += 9) {
          const [ax, ay, az, bx, by, bz, cx, cy, cz] = liste.slice(i, i + 9);
          const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
          const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
          pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
          norm.push(...n, ...n, ...n);
        }
        teile.push({ start, anzahl: pos.length / 3 - start, farbe: farbe(f), deck });
      };
      // Reihenfolge: undurchsichtig zuerst, dann durchscheinend
      anhaengen(daten.wand, "#e4dfd6", { aussen: 1, innen: 0.16, aus: 0 });
      anhaengen(daten.dach, "#7d8593", { aussen: 1, innen: 0, aus: 0 });
      anhaengen(daten.glas, "#a9d6ef", { aussen: 0.55, innen: 0.18, aus: 0 });
      puffer = { pos: gl.createBuffer()!, norm: gl.createBuffer()! };
      gl.bindBuffer(gl.ARRAY_BUFFER, puffer.pos); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, puffer.norm); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(norm), gl.STATIC_DRAW);
    },
    render(gl, args) {
      if (modus === "aus" || !prog || !puffer) return;
      gl.useProgram(prog);
      gl.uniformMatrix4fv(gl.getUniformLocation(prog, "u_matrix"), false, new Float32Array(mal(args.defaultProjectionData.mainMatrix, modell)));
      const aPos = gl.getAttribLocation(prog, "a_pos"), aNorm = gl.getAttribLocation(prog, "a_norm");
      gl.bindBuffer(gl.ARRAY_BUFFER, puffer.pos); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, puffer.norm); gl.enableVertexAttribArray(aNorm); gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 0, 0);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.CULL_FACE);
      const uFarbe = gl.getUniformLocation(prog, "u_farbe"), uDeck = gl.getUniformLocation(prog, "u_deck");
      for (const t of teile) {
        const d = t.deck[modus];
        if (!d) continue;
        gl.depthMask(d >= 1); // Durchscheinendes schreibt keine Tiefe, damit Etagen dahinter sichtbar bleiben
        gl.uniform3fv(uFarbe, t.farbe); gl.uniform1f(uDeck, d);
        gl.drawArrays(gl.TRIANGLES, t.start, t.anzahl);
      }
      gl.depthMask(true);
      gl.disableVertexAttribArray(aPos); gl.disableVertexAttribArray(aNorm);
    },
    onRemove(_map, gl) {
      if (puffer) { gl.deleteBuffer(puffer.pos); gl.deleteBuffer(puffer.norm); }
      if (prog) gl.deleteProgram(prog);
      karte = null; prog = null; puffer = null; teile.length = 0;
    },
  };
}
