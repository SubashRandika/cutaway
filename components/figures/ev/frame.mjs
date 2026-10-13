// Everything that moves, rebuilt from the car's state each frame. Each live
// part is a fixed skeleton of keyed paths ([data-k]); a frame is a flat map of
// key -> value, where "k" writes d, "k@t" a transform, "k@o" an opacity, "k@on"
// toggles data-on and "k@h" replaces the part's inner markup.

import * as k from "../../iso/iso-kit.mjs";
import * as G from "../../iso/lathe.mjs";
import { tubePieces, tubeSvg } from "../../iso/tube.mjs";
import { STAGE1, STAGE2 } from "./model.mjs";
import {
  P, at, ZM, ZI, ZD, P1_R, G1_R, P2_R, RING_R, STAGE1_X, STAGE2_X, MOTOR, SHAFT, ROTOR, WHEEL, ROLLER, ROLLER_Y,
  PCU, BDU, CONTACTORS, PORT, INLET, PLUG, PLUG_OUT, CLIP,
} from "./view.mjs";
import { FX, TAU, RAD, V, buckets, bucketSvg, hull2, liveLine, liveSolid, prismX, solidFrame } from "./parts.mjs";

const fade = [0.04, 0.5];

// Parts that repeat are cached by phase: teeth every tooth pitch.
const CACHE = new Map();
const memo = (key, build) => {
  let value = CACHE.get(key);
  if (value === undefined) {
    if (CACHE.size > 6000) CACHE.clear();
    value = build();
    CACHE.set(key, value);
  }
  return value;
};
const STEPS = 32;
const phaseStep = (phase, period) => {
  const q = Math.round(((((phase % period) + period) % period) / period) * STEPS) % STEPS;
  return [q, (q * period) / STEPS];
};
function ribsQ(key, F, s0, s1, r, count, phase) {
  const [q, p] = phaseStep(phase, TAU / count);
  return memo(`${key}|${s0.toFixed(2)}|${F.o.map((n) => n.toFixed(1)).join(",")}|${q}`, () => buckets(G.ribsOf(F, s0, s1, r, count, P, { phase: p, fade })));
}
const tenth = (n) => Math.round(n * 10) / 10;
const shift = (dx, dy, dz) => k.translateAlong(P, [dx, dy, dz]);
const sense = (deg) => -deg * RAD; // drawing angle for a rotation measured like the motor

// ----- the reduction gears -----
export const M_F = FX(0, 0, ZM);
export const I_F = FX(0, 0, ZI);
export const D_F = FX(0, 0, ZD);

function toothFace(F, s, r, count, phase, depth = 0.9) {
  const points = [];
  const w = TAU / count;
  const land = r - 0.15;
  const root = r - depth;
  for (let i = 0; i < count; i++) {
    const a = phase + i * w;
    for (const [da, rr] of [[-0.25, land], [-0.12, land], [-0.08, root], [0.08, root], [0.12, land], [0.25, land]]) points.push(at(G.pointOf(F, s, rr, a + da * w)));
  }
  return k.pathOf(points, true);
}

function gearParts(key, F, x0, x1, r, count, phase, out, depth = 0.9) {
  ribsQ(key, F, x0, x1, r, count, phase).forEach((d, i) => (out[`${key}.${i}`] = d));
  const [q, p] = phaseStep(phase, TAU / count);
  out[`${key}.face`] = memo(`${key}.face|${F.o.join(",")}|${q}`, () => toothFace(F, x1, r, count, p, depth));
}

function gearTrain(state, out) {
  const motor = sense(state.motor);
  gearParts("p1", M_F, STAGE1_X.x0, STAGE1_X.x1, P1_R, STAGE1.pinion, motor, out, 0.7);
  const inter = -sense(state.inter);
  gearParts("g1", I_F, STAGE1_X.x0, STAGE1_X.x1, G1_R, STAGE1.gear, inter + Math.PI / STAGE1.gear, out);
  out["g1.bolts"] = G.dotsOf(I_F, STAGE1_X.x1, 9.2, 6, P, { phase: inter, all: true });
  gearParts("p2", I_F, STAGE2_X.x0, STAGE2_X.x1, P2_R, STAGE2.pinion, inter, out, 0.8);
  const diff = sense(state.wheel);
  gearParts("ring", D_F, STAGE2_X.x0, STAGE2_X.x1, RING_R, STAGE2.ring, diff + Math.PI / STAGE2.ring, out);
  out["ring.bolts"] = G.dotsOf(D_F, STAGE2_X.x1, RING_R - 4.6, 8, P, { phase: diff, all: true });
  out["diff.bolts"] = G.dotsOf(D_F, STAGE2_X.x1 + 11.8, 7.6, 6, P, { phase: diff + 0.3, all: true });
}

// ----- the motor: the rotor's end with its magnets, a stripe on its shaft, the windings lit -----
function motorParts(state, out) {
  const m = sense(state.motor);
  out["motor.magnets"] = G.dotsOf(M_F, MOTOR.x1 + 0.9, MOTOR.bore - 3.4, 8, P, { phase: m, all: true });
  out["motor.key"] = G.spokesOf(M_F, MOTOR.x1 + 0.9, 3.6, MOTOR.bore - 5.4, 1, P, { phase: m + 0.3 });
  const stripe = [];
  for (const da of [0, Math.PI]) {
    const a = m + da;
    const facing = G.dot3(G.radialOf(M_F, a), V);
    if (facing > 0.08) stripe.push({ d: k.pathOf([at(G.pointOf(M_F, MOTOR.x1 + MOTOR.turn + 0.6, 3.4, a)), at(G.pointOf(M_F, STAGE1_X.x0 - 1.8, 3.4, a))]), alpha: Math.min(1, facing * 2) });
  }
  buckets(stripe).forEach((d, i) => (out[`mshaft.stripe.${i}`] = d));
  out["motor@on"] = Math.abs(state.motorKw ?? 0) > 0.6;
}

// ----- the DC contactors: their armatures drop when they close -----
export const ARMATURE_DROP = 1.1;
function contactorParts(state, out) {
  const dc = state.dcContact ?? 0;
  out["dcplus@t"] = shift(0, 0, -Math.round(ARMATURE_DROP * dc * 100) / 100);
  out["dcminus@t"] = out["dcplus@t"];
}

// ----- the plug: drawn back out of the inlet, then down onto the bench -----
export const PLUG_TAIL = [INLET.x, PORT.y1 + 0.6 + PLUG.body + PLUG.grip + 1.8, INLET.z];
export const plugShift = (plug) => {
  const out = 1 - plug;
  const a = Math.min(1, out * 2);
  const b = Math.max(0, out * 2 - 1);
  return [0, PLUG_OUT[1] * a, PLUG_OUT[2] * b];
};
export const LEAD_R = 1.4;
export function leadSvg(plug) {
  const [dx, dy, dz] = plugShift(plug);
  const t = [PLUG_TAIL[0] + dx, PLUG_TAIL[1] + dy, PLUG_TAIL[2] + dz];
  const points = [t, [t[0], t[1] + 1.6, t[2]], [t[0] - 4, t[1] + 1.6, Math.max(LEAD_R + 0.2, t[2] - 5)], [CLIP[0] + 5, CLIP[1], CLIP[2]], [CLIP[0], CLIP[1], CLIP[2]]];
  const route = G.fillet(points.filter((p, i) => i === 0 || Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1], p[2] - points[i - 1][2]) > 0.4), 2.4, 8, { P, tube: LEAD_R });
  return tubePieces(route, LEAD_R, P, { maxLength: 80 }).map((piece) => tubeSvg(piece, { tone: "mid" })).join("");
}
function plugParts(state, out) {
  const plug = Math.round((state.plug ?? 0) * 40) / 40;
  const [dx, dy, dz] = plugShift(plug);
  out["plug@t"] = shift(dx, dy, dz);
  out["lead@h"] = memo(`lead|${plug}`, () => leadSvg(plug));
  const charging = (state.chargeKw ?? 0) > 0.05;
  out["lead@on"] = charging;
  out["led@on"] = charging;
  out["ledac@on"] = charging && state.kind === "ac";
  out["leddc@on"] = charging && state.kind === "dc";
}

// ----- shaft, rotor, wheel, rollers -----
function wheelParts(state, out) {
  const w = sense(state.wheel);
  const shaftF = FX(0, 0, ZD);
  const stripe = [];
  for (const da of [0, Math.PI]) {
    const a = w + da;
    const facing = G.dot3(G.radialOf(shaftF, a), V);
    if (facing > 0.08) stripe.push({ d: k.pathOf([at(G.pointOf(shaftF, SHAFT.x0 + 22, SHAFT.r, a)), at(G.pointOf(shaftF, SHAFT.x1 - 16, SHAFT.r, a))]), alpha: Math.min(1, facing * 2) });
  }
  buckets(stripe).forEach((d, i) => (out[`shaft.stripe.${i}`] = d));
  out["rotor.holes"] = G.dotsOf(shaftF, ROTOR.x1, 20, 24, P, { phase: w, all: true });
  out["rotor.holes2"] = G.dotsOf(shaftF, ROTOR.x1, 16.6, 24, P, { phase: w + Math.PI / 24, all: true });
  const sq = Math.round(((((w % (TAU / 5)) + TAU / 5) % (TAU / 5)) / (TAU / 5)) * 240) % 240;
  Object.assign(out, memo(`spokes|${sq}`, () => {
    const part = {};
    const ws = (sq / 240) * (TAU / 5);
    for (let i = 0; i < 5; i++) {
      const a = ws + (i / 5) * TAU;
      const poly = [];
      for (const [r, half] of [[9.5, 3.6], [WHEEL.rim - 1.2, 2.6]]) {
        for (const side of [-1, 1]) {
          const radial = [Math.cos(a), Math.sin(a)];
          const across = [-Math.sin(a), Math.cos(a)];
          poly.push([radial[0] * r + across[0] * half * side, ZD + radial[1] * r + across[1] * half * side]);
        }
      }
      solidFrame(part, `spoke${i}`, prismX(hull2(poly), WHEEL.face - 3.2, WHEEL.face));
    }
    return part;
  }));
  out["lugs"] = G.dotsOf(shaftF, WHEEL.face + 0.6, 7.2, 5, P, { phase: w + Math.PI / 5, all: true });
  out["valve.stem"] = [at(G.pointOf(shaftF, WHEEL.face + 0.4, WHEEL.rim - 2.4, w + 0.5))];
  ribsQ("tread", shaftF, WHEEL.x0 + 9, WHEEL.x1 - 9, WHEEL.r, 72, w).forEach((d, i) => (out[`tread.${i}`] = d));
  const roller = -w * (WHEEL.r / ROLLER.r);
  for (const [key, y] of [["rollerB", -ROLLER_Y], ["rollerF", ROLLER_Y]]) ribsQ(key, FX(0, y, ROLLER.z), ROLLER.x0, ROLLER.x1, ROLLER.r, 28, roller).forEach((d, i) => (out[`${key}.knurl.${i}`] = d));
}

// ----- gauges: a centre-zero power meter on the inverter, charge on the disconnect unit -----
export const METER = { x: -6, y: PCU.y1, z: 104, r: 6.2, span: 100, kw: 160 }; // ±span/2 degrees for ±160 kW
export const SOC_DIAL = { x: (BDU.x0 + BDU.x1) / 2, y: BDU.y1, z: 16, r: 4.6, from: 0, to: 1 };
const onFaceY = (c, r, deg) => [c.x + r * Math.sin(deg * RAD), c.y + 0.25, c.z + r * Math.cos(deg * RAD)];
export const meterAngle = (kw) => Math.max(-1, Math.min(1, kw / METER.kw)) * (METER.span / 2);
export const socAngle = (soc) => -60 + 120 * Math.max(0, Math.min(1, (soc - SOC_DIAL.from) / (SOC_DIAL.to - SOC_DIAL.from)));

function gaugeParts(state, out) {
  const m = Math.round(meterAngle(state.batteryKw ?? 0) * 4) / 4;
  out["meter.needle"] = k.pathOf([at(onFaceY(METER, -1.4, m)), at(onFaceY(METER, METER.r - 1.2, m))]);
  const s = Math.round(socAngle(state.soc ?? 0.4) * 4) / 4;
  out["soc.needle"] = k.pathOf([at(onFaceY(SOC_DIAL, -1.2, s)), at(onFaceY(SOC_DIAL, SOC_DIAL.r - 1.1, s))]);
}

// ----- current in the cables: lit chunks running toward where the power goes -----
function flowParts(state, out) {
  const lines = state.flow ?? {};
  for (const name in lines) {
    const { count, phase, power } = lines[name];
    const on = Math.abs(power) > 0.6;
    for (let i = 0; i < count; i++) {
      const at0 = ((i - phase) % 6 + 6) % 6;
      out[`${name}.${i}@on`] = on && at0 < 1.5;
    }
  }
}

export function frameOf(state) {
  const out = {};
  gearTrain(state, out);
  motorParts(state, out);
  contactorParts(state, out);
  plugParts(state, out);
  wheelParts(state, out);
  gaugeParts(state, out);
  flowParts(state, out);
  return out;
}

// skeleton markup for each live slot, filled from a frame
export function liveMarkup(id, f) {
  const solid = (key, options) => liveSolid(key, { fill: f[`${key}.f`], outline: f[`${key}.e`], crease: f[`${key}.c`], top: f[`${key}.t`], shades: [0, 1, 2, 3].map((n) => f[`${key}.s${n}`]) }, options);
  const dots = (key, size = 0.5, tone = "mid") => `<g class="iso-dots" data-tone="${tone}" data-k="${key}">${(f[key] || []).map(([x, y, a]) => `<circle cx="${tenth(x)}" cy="${tenth(y)}" r="${size}"${a !== undefined && a < 1 ? ` fill-opacity="${a.toFixed(2)}"` : ""}/>`).join("")}</g>`;
  const ribs = (key, tone = "lo") => bucketSvg(key, tone).replace(/data-k="([^"]+)" d=""/g, (_, kk) => `data-k="${kk}" d="${f[kk] || ""}"`);
  const gear = (key, tone = "lo") => ribs(key, tone) + liveLine(`${key}.face`, f[`${key}.face`], "lo");
  switch (id) {
    case "p1":
    case "p2":
      return gear(id);
    case "g1":
      return gear("g1") + dots("g1.bolts", 0.55);
    case "ring":
      return gear("ring") + dots("ring.bolts", 0.5);
    case "diff":
      return dots("diff.bolts", 0.5);
    case "motor.end":
      return dots("motor.magnets", 0.65, "lo") + liveLine("motor.key", f["motor.key"], "lo");
    case "mshaft":
      return ribs("mshaft.stripe", "mid");
    case "lead":
      return `<g class="elv-cable" data-k="lead"${f["lead@on"] ? " data-on" : ""}>${f["lead@h"]}</g>`;
    case "shaft":
      return ribs("shaft.stripe", "mid");
    case "rotor":
      return dots("rotor.holes", 0.55, "lo") + dots("rotor.holes2", 0.55, "lo");
    case "spokes":
      return [0, 1, 2, 3, 4].map((i) => solid(`spoke${i}`, { tone: "hi" })).join("");
    case "lugs":
      return dots("lugs", 0.95, "hi") + dots("valve.stem", 0.7, "mid");
    case "tread":
      return ribs("tread", "lo");
    case "rollerB":
    case "rollerF":
      return ribs(`${id}.knurl`, "lo");
    case "meter":
      return `<path class="iso-line elv-needle" data-free="" data-tone="hi" data-k="meter.needle" d="${f["meter.needle"]}"/>`;
    case "soc":
      return `<path class="iso-line elv-needle" data-free="" data-tone="hi" data-k="soc.needle" d="${f["soc.needle"]}"/>`;
    default:
      break;
  }
  throw new Error(`no live slot ${id}`);
}

export { TAU, CONTACTORS };
