// Everything that moves, rebuilt from the plant's state each frame. Each live
// part is a fixed skeleton of keyed paths ([data-k]); a frame is a flat map of
// key -> value, where "k" writes d, "k@t" a transform, "k@o" an opacity, "k@on"
// toggles data-on and "k@h" replaces the part's inner markup.

import * as k from "../../iso/iso-kit.mjs";
import * as G from "../../iso/lathe.mjs";
import { P, at, ZT, HP, LP, GEN, EXC, RCP, PZR, DESK, ROD, CWP, FEEDPUMP, RPV } from "./view.mjs";
import { RAD, buckets, bucketSvg, liveLine } from "./parts.mjs";
import { insideRing, arcZR } from "./shapes.mjs";
import { ring3 } from "./parts.mjs";

const TAU = Math.PI * 2;
const fade = [0.04, 0.5];
const tenth = (n) => Math.round(n * 10) / 10;
const shift = (dx, dy, dz) => k.translateAlong(P, [dx, dy, dz]);
const sense = (deg) => -deg * RAD;

const CACHE = new Map();
const memo = (key, build) => {
  let value = CACHE.get(key);
  if (value === undefined) {
    if (CACHE.size > 8000) CACHE.clear();
    value = build();
    CACHE.set(key, value);
  }
  return value;
};
const STEPS = 24;
const phaseStep = (phase, period) => {
  const q = Math.round(((((phase % period) + period) % period) / period) * STEPS) % STEPS;
  return [q, (q * period) / STEPS];
};
function ribsQ(key, F, s0, s1, r, count, phase) {
  const [q, p] = phaseStep(phase, TAU / count);
  return memo(`${key}|${q}`, () => buckets(G.ribsOf(F, s0, s1, r, count, P, { phase: p, fade })));
}

// ----- the shaft line: blade rows of the two turbines, stripes on the shaft between machines -----
export const SHAFT_F = G.frameOf([0, 0, ZT], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
// [x0, x1, tip radius, blade count] for each row; the HP and LP are double flow, rows growing outward
const rowsOf = (mid, half, first, grow, count, width, n) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = first + grow * i;
    const off = 2.2 + i * half;
    out.push([mid - off - width, mid - off, r, count], [mid + off, mid + off + width, r, count]);
  }
  return out;
};
export const HP_ROWS = rowsOf((HP.x0 + HP.x1) / 2, 3.1, 6.2, 0.55, 40, 1.4, 4);
export const LP_ROWS = rowsOf((LP.x0 + LP.x1) / 2, 4.1, 10.2, 1.7, 44, 1.8, 5);
export const STRIPES = [[HP.x0 - 6, HP.x0 - 1.4], [HP.x1 + 1.4, LP.x0 - 1.4], [LP.x1 + 1.4, GEN.x0 - 2.4], [GEN.x1 + 2.4, EXC.x0 - 1]];

function shaftParts(state, out) {
  const a = sense(state.turbine ?? 0);
  [...HP_ROWS, ...LP_ROWS].forEach(([x0, x1, r, count], i) => ribsQ(`row${i}`, SHAFT_F, x0, x1, r, count, a).forEach((d, j) => (out[`row${i}.${j}`] = d)));
  STRIPES.forEach(([x0, x1], i) => {
    const list = [];
    for (const da of [0, Math.PI]) {
      const facing = G.dot3(G.radialOf(SHAFT_F, a + da), G.viewOf(P));
      if (facing > 0.08) list.push({ d: k.pathOf([at(G.pointOf(SHAFT_F, x0, 3.2, a + da)), at(G.pointOf(SHAFT_F, x1, 3.2, a + da))]), alpha: Math.min(1, facing * 2) });
    }
    buckets(list).forEach((d, j) => (out[`stripe${i}.${j}`] = d));
  });
  out["exc.ribs"] = undefined;
  ribsQ("exc", SHAFT_F, EXC.x0 + 1.4, EXC.x1 - 4.4, EXC.r - 2.2, 28, a).forEach((d, j) => (out[`exc.${j}`] = d));
  out["couplings"] = [GEN.x0 - 1.6, LP.x1 + 0.8, HP.x1 + 0.8].flatMap((x) => G.dotsOf(SHAFT_F, x, 4.2, 6, P, { phase: a, all: true }));
}

// ----- pumps: the reactor coolant pump's coupling, the feed pump's, the cooling-water pump's -----
export const RCP_F = G.frameOf([RCP.x, RCP.y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
export const FEED_F = G.frameOf([0, FEEDPUMP.y, FEEDPUMP.z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
export const CWP_F = G.frameOf([CWP.x, CWP.y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
function pumpParts(state, out) {
  ribsQ("rcp", RCP_F, RCP.bowl[1] + 1.4, RCP.motor[0] - 0.6, 1.9, 10, sense(state.pump ?? 0)).forEach((d, j) => (out[`rcp.${j}`] = d));
  ribsQ("feed", FEED_F, FEEDPUMP.x + 4.6, FEEDPUMP.x + 6.4, 1.8, 10, sense(state.feed ?? 0)).forEach((d, j) => (out[`feed.${j}`] = d));
  ribsQ("cwp", CWP_F, 14.6, 16.6, 1.8, 10, sense(state.cw ?? 0)).forEach((d, j) => (out[`cwp.${j}`] = d));
}

// ----- the rods, the core's glow, the pressuriser's level -----
export const PZR_INNER = (() => {
  const ri = PZR.r - 1;
  return [...arcZR(PZR.z0 + PZR.r, ri, ri, -90, 0, 8), ...arcZR(PZR.z1 - PZR.r, ri, ri, 0, 90, 8)];
})();
export const levelZ = (level) => PZR.z0 + PZR.r + (PZR.z1 - PZR.z0 - 2 * PZR.r) * level;
function waterBelow(meridian, z) {
  const out = [];
  for (let i = 0; i < meridian.length; i++) {
    const p = meridian[i];
    if (p[0] <= z) out.push(p);
    const q = meridian[i + 1];
    if (q && (p[0] - z) * (q[0] - z) < 0) out.push([z, p[1] + ((q[1] - p[1]) * (z - p[0])) / (q[0] - p[0])]);
  }
  return out;
}
export const przWater = (level) => ring3(insideRing(PZR.x, PZR.y, waterBelow(PZR_INNER, levelZ(level))));

function coreParts(state, out) {
  out["rods@t"] = shift(0, 0, Math.round((state.bank ?? 0) * ROD.travel * 50) / 50);
  out["sdrods@t"] = shift(0, 0, Math.round((state.shutdown ?? 0) * ROD.travel * 50) / 50);
  out["glow@o"] = (Math.round(Math.min(1, Math.sqrt(Math.max(0, state.heat ?? 0))) * 100) / 100).toString();
  out["prz.water"] = memo(`prz|${Math.round((state.level ?? 0.5) * 200)}`, () => przWater(Math.round((state.level ?? 0.5) * 200) / 200));
}

// ----- valves: the governor valve's stem lifts with its opening, the dump valve's likewise -----
export const STEM_LIFT = 2.6;
function valveParts(state, out) {
  out["gov@t"] = shift(0, 0, Math.round((state.valve ?? 0) * STEM_LIFT * 20) / 20);
  out["dump@t"] = shift(0, 0, Math.round(Math.min(1, (state.dump ?? 0) / 0.4) * STEM_LIFT * 20) / 20);
}

// ----- the desk: three dials, the rod-position scale, the trip and breaker lamps -----
export const PANEL_Y = DESK.y0 + 3.4;
export const DIALS = [
  { key: "dial.power", x: DESK.x0 + 7, z: 25, r: 4.8, span: 240 }, // core thermal power, 0 … 120%
  { key: "dial.tavg", x: DESK.x0 + 18, z: 25, r: 4.8, span: 240 }, // average coolant temperature, 280 … 320 °C
  { key: "dial.mwe", x: DESK.x0 + 29, z: 25, r: 4.8, span: 240 }, // generator output, 0 … 1,200 MWe
];
export const RODSCALE = { x: DESK.x1 - 6.4, z0: 13, z1: 30 };
const onFaceY = (c, r, deg) => [c.x + r * Math.sin(deg * RAD), PANEL_Y + 0.3, c.z + r * Math.cos(deg * RAD)];
const dialAngle = (share, span) => -span / 2 + span * Math.max(0, Math.min(1, share));
function deskParts(state, out) {
  const values = [(state.heat ?? 0) / 1.2, ((state.tavg ?? 291.7) - 280) / 40, (state.mwe ?? 0) / 1200];
  DIALS.forEach((d, i) => {
    const deg = Math.round(dialAngle(values[i], d.span) * 2) / 2;
    out[d.key] = k.pathOf([at(onFaceY(d, -1.2, deg)), at(onFaceY(d, d.r - 1.1, deg))]);
  });
  out["rodpos@t"] = shift(0, 0, Math.round((state.bank ?? 0) * (RODSCALE.z1 - RODSCALE.z0) * 20) / 20);
  out["lamp.trip@on"] = Boolean(state.scram);
  out["lamp.grid@on"] = Boolean(state.online);
  out["scram@on"] = Boolean(state.scram);
  out["brk@on"] = Boolean(state.online);
}

// ----- water, steam and current in the pipes and on the bus: lit chunks running the way they flow -----
function flowParts(state, out) {
  const lines = state.flow ?? {};
  for (const name in lines) {
    const { count, phase, on } = lines[name];
    for (let i = 0; i < count; i++) {
      const at0 = (((i - phase) % 6) + 6) % 6;
      out[`${name}.${i}@on`] = on && at0 < 1.5;
    }
  }
}

export function frameOf(state) {
  const out = {};
  shaftParts(state, out);
  pumpParts(state, out);
  coreParts(state, out);
  valveParts(state, out);
  deskParts(state, out);
  flowParts(state, out);
  delete out["exc.ribs"];
  return out;
}

// skeleton markup for each live slot, filled from a frame
export function liveMarkup(id, f) {
  const dots = (key, size = 0.5, tone = "mid") => `<g class="iso-dots" data-tone="${tone}" data-k="${key}">${(f[key] || []).map(([x, y, a]) => `<circle cx="${tenth(x)}" cy="${tenth(y)}" r="${size}"${a !== undefined && a < 1 ? ` fill-opacity="${a.toFixed(2)}"` : ""}/>`).join("")}</g>`;
  const ribs = (key, tone = "lo") => bucketSvg(key, tone).replace(/data-k="([^"]+)" d=""/g, (_, kk) => `data-k="${kk}" d="${f[kk] || ""}"`);
  const needle = (key) => `<path class="iso-line npp-needle" data-free="" data-tone="hi" data-k="${key}" d="${f[key]}"/>`;
  if (/^row\d+$/.test(id) || /^stripe\d+$/.test(id)) return ribs(id, id.startsWith("row") ? "lo" : "mid");
  switch (id) {
    case "exc":
    case "rcp":
    case "feed":
    case "cwp":
      return ribs(id, "lo");
    case "couplings":
      return dots("couplings", 0.45, "mid");
    case "prz.water":
      return `<path class="npp-water" data-k="prz.water" d="${f["prz.water"]}"/>`;
    case "dial.power":
    case "dial.tavg":
    case "dial.mwe":
      return needle(id);
    default:
      break;
  }
  throw new Error(`no live slot ${id}`);
}

export { RPV };
