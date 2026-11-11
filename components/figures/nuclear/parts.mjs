// Small drawing helpers over the kit, shared by the static scene and the
// per-frame builder. Everything here is pure and runs in Node and the browser.

import * as k from "../../iso/iso-kit.mjs";
import * as G from "../../iso/lathe.mjs";
import { P, at } from "./view.mjs";

export const TAU = Math.PI * 2;
export const RAD = Math.PI / 180;
export const V = G.viewOf(P);
export const L = G.lightOf(P);

export const S = (paths, options) => k.solidSvg(paths, options);
export const Ln = (d, options) => (d ? k.lineSvg(d, options) : "");
export const Dt = (points, options) => (points.length ? k.dotsSvg(points, options) : "");

export const box = (x0, x1, y0, y1, z0, z1, steps = 2, bevel = 0, r = 0.6) => k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r }, z0, z1 - z0, P, steps, bevel);
export const plan = (x0, x1, y0, y1, r = 0.6) => ({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r });

export const path3 = (points, closed = false) => k.pathOf(points.map(at), closed);
export const ring3 = (points) => k.pathOf(points.map(at), true);

// frames whose polygon coordinates are world axes: FX takes (y, z), FY (x, z), FZ (x, y)
export const FX = (x = 0, y = 0, z = 0) => G.frameOf([x, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
export const FY = (x = 0, y = 0, z = 0) => G.frameOf([x, y, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
export const FZ = (x = 0, y = 0, z = 0) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);

export const prismX = (polygon, x0, x1) => G.prismOf(FX(), polygon, x0, x1, P);
export const prismY = (polygon, y0, y1) => G.prismOf(FY(), polygon, y0, y1, P);
export const discX = (x0, x1, r, y, z, options) => G.disc(x0, x1, r, FX(0, y, z), P, options);
export const discZ = (z0, z1, r, x, y, options) => G.disc(z0, z1, r, FZ(x, y, 0), P, options);

// points on planes
export const onY = (y) => ([x, z]) => [x, y, z];
export const onX = (x) => ([y, z]) => [x, y, z];

// a section face: one or more closed rings (holes as extra rings, even-odd)
export const cutSvg = (rings, extra = "") => `<path class="npp-cut"${extra} d="${rings.map(ring3).join("")}"/>`;
export const cavSvg = (ring, shade) => `<path class="npp-cav" data-shade="${shade}" d="${ring3(ring)}"/>`;
export const cavLine = (points, closed = false) => `<path class="npp-cav-line" d="${path3(points, closed)}"/>`;

export const rect = (a0, a1, b0, b1) => [
  [a0, b0],
  [a1, b0],
  [a1, b1],
  [a0, b1],
];

export const arcPts = (cx, cy, r, from, to, steps = 24) => Array.from({ length: steps + 1 }, (_, i) => {
  const t = from + ((to - from) * i) / steps;
  return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
});

export const circle2 = (cx, cy, r, steps = 32) => Array.from({ length: steps }, (_, i) => [cx + r * Math.cos((i / steps) * TAU), cy + r * Math.sin((i / steps) * TAU)]);

// A clip path from world rings, for content seen through an opening.
export const clipSvg = (id, rings) => `<clipPath id="${id}"><path d="${rings.map(ring3).join("")}"/></clipPath>`;

// Lines that carry an opacity, grouped into four buckets so a live part keeps a fixed DOM.
export function buckets(list) {
  const out = ["", "", "", ""];
  for (const item of list) {
    const d = Array.isArray(item) ? item[0] : item.d;
    const alpha = Array.isArray(item) ? item[1] : item.alpha;
    if (alpha < 0.12) continue;
    out[alpha < 0.37 ? 0 : alpha < 0.62 ? 1 : alpha < 0.87 ? 2 : 3] += d;
  }
  return out;
}

export const bucketSvg = (key, tone = "lo", extra = "") =>
  [1, 2, 3, 4].map((n) => `<path class="iso-line${n < 4 ? ` npp-fade-${n}` : ""}"${extra} data-tone="${tone}" data-k="${key}.${n - 1}" d=""/>`).join("");

// A helix round any axis, split into the half that faces away (back) and toward the viewer.
export function helix(F, s0, s1, r, turns, phase = 0, perTurn = 18) {
  const count = Math.max(8, Math.round(turns * perTurn));
  const back = [];
  const front = [];
  let run = [];
  let facing = null;
  for (let i = 0; i <= count; i++) {
    const share = i / count;
    const angle = phase + share * turns * TAU;
    const point = G.pointOf(F, s0 + (s1 - s0) * share, r, angle);
    const near = G.dot3(G.radialOf(F, angle), V) > 0;
    const flat = at(point);
    if (facing === null) facing = near;
    if (near !== facing) {
      run.push(flat);
      (facing ? front : back).push(run);
      run = [flat];
      facing = near;
      continue;
    }
    run.push(flat);
  }
  if (run.length > 1) (facing ? front : back).push(run);
  return { back: back.map((points) => k.pathOf(points)).join(""), front: front.map((points) => k.pathOf(points)).join("") };
}

// Rotate a 2D point list about a centre.
export const turn2 = (points, cx, cy, angle) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return points.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
};

export const hull2 = (points) => G.hullOf(points);

// Solid skeleton for a live part: the same structure as solidSvg, every path keyed.
export function liveSolid(key, paths, { tone = "hi", crease = "faint", lit = false, className = "", extra = "" } = {}) {
  const shades = [0, 1, 2, 3].map((n) => `<path class="iso-shade" data-shade="${n}" data-k="${key}.s${n}" d="${paths.shades[n] || ""}"/>`).join("");
  return `<g class="iso-solid${className ? ` ${className}` : ""}"${lit ? " data-lit" : ""}${extra}><path class="iso-fill" data-k="${key}.f" d="${paths.fill}"/>${shades}<path class="iso-top" data-k="${key}.t" d="${paths.top}"/>${crease === "none" ? "" : `<path class="iso-line iso-crease" data-tone="${crease}" data-k="${key}.c" d="${paths.crease}"/>`}<path class="iso-line iso-edge" data-tone="${tone}" data-k="${key}.e" d="${paths.outline}"/></g>`;
}

export function solidFrame(out, key, paths) {
  out[`${key}.f`] = paths.fill;
  for (let n = 0; n < 4; n++) out[`${key}.s${n}`] = paths.shades[n] || "";
  out[`${key}.t`] = paths.top;
  out[`${key}.c`] = paths.crease;
  out[`${key}.e`] = paths.outline;
}

export const liveLine = (key, d, tone = "lo", extra = "") => `<path class="iso-line"${extra} data-tone="${tone}" data-k="${key}" d="${d}"/>`;
