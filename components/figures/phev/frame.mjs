// Everything that moves, rebuilt from the car's state each frame. Each live
// part is a fixed skeleton of keyed paths ([data-k]); a frame is a flat map of
// key -> value, where "k" writes d, "k@t" a transform, "k@o" an opacity and
// "k@on" toggles data-on.

import * as k from "../../iso/iso-kit.mjs";
import * as G from "../../iso/lathe.mjs";
import { tubePieces, tubeSvg } from "../../iso/tube.mjs";
import { DIRECT, MOTOR_PINION, FINAL, FIRING } from "./model.mjs";
import {
  P, at, ZA, ZB, ZD, C_AXIS, THROW, ROD, PIN_R, MAIN_R, WEB, RP, PISTON_H, PIN_TO_CROWN, CYL_X, CAM, DECK,
  DRIVE_R, DRIVEN_R, MPIN_R, FPIN_R, FRING_R, DRIVE_X, CLUTCH, GEN, MOTOR,
  FINAL_X, DAMPER, SHAFT, ROTOR, WHEEL, ROLLER, ROLLER_Y, PCU, PACK, OBC, INLET, PLUG, PLUG_OUT, CLIP,
} from "./view.mjs";
import { FX, TAU, RAD, V, buckets, bucketSvg, discX, hull2, circle2, liveLine, liveSolid, prismX, solidFrame } from "./parts.mjs";

const fade = [0.04, 0.5];

// Parts that repeat are cached by phase: teeth every tooth pitch, the crank every 0.5°.
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
const crankKey = (c) => Math.round((((c % 720) + 720) % 720) * 2) % 1440;
const tenth = (n) => Math.round(n * 10) / 10;
const shift = (dx, dy, dz) => k.translateAlong(P, [dx, dy, dz]);
const sense = (deg) => -deg * RAD; // drawing angle for a rotation measured like the crank

// ----- crank, rods, pistons, cams -----
const THROWS = [0, 180, 180, 0]; // crank pin angle of each cylinder
export const ROD_HALF = 2.2;
const webX = (i) => [
  [CYL_X[i] - WEB.gap - WEB.t, CYL_X[i] - WEB.gap],
  [CYL_X[i] + WEB.gap, CYL_X[i] + WEB.gap + WEB.t],
];

function webPolygon(c) {
  const t = c * RAD;
  const py = THROW * Math.sin(t);
  const pz = ZA + THROW * Math.cos(t);
  const away = Math.atan2(-Math.cos(t), -Math.sin(t));
  const points = [...circle2(py, pz, 5.6, 20), ...circle2(0, ZA, 5.4, 20)];
  for (let i = 0; i <= 16; i++) {
    const a = away + ((i / 16) * 2 - 1) * 60 * RAD;
    points.push([13.4 * Math.cos(a), ZA + 13.4 * Math.sin(a)]);
  }
  return hull2(points);
}

export const wristZ = (c) => {
  const t = c * RAD;
  const s = Math.sin(t);
  return ZA + THROW * Math.cos(t) + Math.sqrt(ROD * ROD - THROW * THROW * s * s);
};
export const REST_WRIST = wristZ(0);
export const PISTON = { r: RP, h: PISTON_H, crown: REST_WRIST + PIN_TO_CROWN };

function rodParts(i, c, out) {
  const x = CYL_X[i];
  const t = c * RAD;
  const py = THROW * Math.sin(t);
  const pz = ZA + THROW * Math.cos(t);
  const wz = wristZ(c);
  const hull = hull2([...circle2(py, pz, 5.2, 24), ...circle2(0, wz, 3.2, 20)]);
  solidFrame(out, `rod${i}`, prismX(hull, x - ROD_HALF, x + ROD_HALF));
  solidFrame(out, `pin${i}`, discX(x - WEB.gap, x + WEB.gap, PIN_R, py, pz));
  const ax = [0 - py, wz - pz];
  const len = Math.hypot(ax[0], ax[1]);
  const u = [ax[0] / len, ax[1] / len];
  const n = [-u[1], u[0]];
  const face = (a, b) => at([x + ROD_HALF, py + u[0] * a + n[0] * b, pz + u[1] * a + n[1] * b]);
  out[`rod${i}.cap`] = k.pathOf([face(-0.5, -5.1), face(-0.5, 5.1)]);
  out[`rod${i}.bolts`] = [face(1.2, -3.8), face(1.2, 3.8)];
  const slot = [];
  for (const [a, b] of [[5.4, -1.1], [len - 4.6, -0.8], [len - 4.6, 0.8], [5.4, 1.1]]) slot.push(face(a, b));
  out[`rod${i}.web`] = k.pathOf(slot, true);
}

// The intake cam: two lobes per cylinder, turning at half crank speed. A lobe's
// nose points down at its valve through the middle of that cylinder's intake stroke.
export const LOBE_X = CYL_X.flatMap((x) => [x - 4.2, x + 4.2]);
function lobe(i, c) {
  const points = [];
  const open = FIRING[i] + 360 + 90; // crank degrees at the middle of intake (720° cycle, fire at FIRING)
  for (let n = 0; n < 48; n++) {
    const b = (n / 48) * TAU;
    // angle from the nose, in cam radians
    const rel = Math.atan2(Math.sin(b), Math.cos(b));
    const lift = Math.abs(rel) < 1.15 ? CAM.lift * Math.cos((rel / 1.15) * (Math.PI / 2)) ** 2 : 0;
    const w = b + ((c - open) / 2) * RAD + Math.PI; // nose straight down at mid-intake
    points.push([CAM.y + (CAM.base + lift) * Math.sin(w), CAM.z + (CAM.base + lift) * Math.cos(w)]);
  }
  return hull2(points);
}

function engineParts(c, out) {
  for (let i = 0; i < 4; i++) {
    const ci = c + THROWS[i];
    const [[a0, a1], [b0, b1]] = webX(i);
    solidFrame(out, `web${i}a`, prismX(webPolygon(ci), a0, a1));
    solidFrame(out, `web${i}b`, prismX(webPolygon(ci), b0, b1));
    rodParts(i, ci, out);
    const poly = lobe(i, c);
    solidFrame(out, `lobe${i}a`, prismX(poly, LOBE_X[i * 2] - 1.6, LOBE_X[i * 2] + 1.6));
    solidFrame(out, `lobe${i}b`, prismX(poly, LOBE_X[i * 2 + 1] - 1.6, LOBE_X[i * 2 + 1] + 1.6));
  }
}

// ----- the gears: clutch output, counter, motor pinion, final drive -----
const A_F = FX(0, 0, ZA);
const B_F = FX(0, 0, ZB);
const C_F = FX(0, C_AXIS[0], C_AXIS[1]);
const D_F = FX(0, 0, ZD);

// Outline of a gear's teeth on its end face.
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
  const drive = sense(state.drive);
  gearParts("drive", A_F, DRIVE_X.x0, DRIVE_X.x1, DRIVE_R, DIRECT.drive, drive, out);
  out["drive.bolts"] = G.dotsOf(A_F, DRIVE_X.x1, 8.4, 6, P, { phase: drive, all: true });
  const counter = -sense(state.counter);
  gearParts("driven", B_F, DRIVE_X.x0, DRIVE_X.x1, DRIVEN_R, DIRECT.driven, counter + Math.PI / DIRECT.driven, out);
  out["driven.bolts"] = G.dotsOf(B_F, DRIVE_X.x1, 10.6, 6, P, { phase: counter, all: true });
  gearParts("mpin", C_F, DRIVE_X.x0, DRIVE_X.x1, MPIN_R, MOTOR_PINION, sense(state.motor), out, 0.8);
  gearParts("fpin", B_F, FINAL_X.x0, FINAL_X.x1, FPIN_R, FINAL.pinion, counter, out, 0.8);
  const diff = sense(state.wheel);
  gearParts("fring", D_F, FINAL_X.x0, FINAL_X.x1, FRING_R, FINAL.ring, diff + Math.PI / FINAL.ring, out);
  out["fring.bolts"] = G.dotsOf(D_F, FINAL_X.x1, FRING_R - 4.6, 8, P, { phase: diff, all: true });
  out["diff.bolts"] = G.dotsOf(D_F, FINAL_X.x1 + 11.8, 7.6, 6, P, { phase: diff + 0.3, all: true });
}

// ----- the lock-up clutch: the piston squeezes the plates back onto the backing ring -----
export const PLATES = 8;
export const BACKING = [CLUTCH.x0 + 0.4, CLUTCH.x0 + 1.6];
// plate i counts from the backing ring; at rest (open) each stands its share of the gaps away
export const plateAt = (i) => {
  const x0 = BACKING[1] + i * CLUTCH.t + (i + 1) * CLUTCH.gap;
  return [x0, x0 + CLUTCH.t];
};
export const PISTON_X = [plateAt(PLATES - 1)[1] + CLUTCH.gap, plateAt(PLATES - 1)[1] + CLUTCH.gap + CLUTCH.piston];
export const FINGERS = 8;
const fingerShape = (a) => {
  const r0 = CLUTCH.r - 1.1;
  const r1 = CLUTCH.r;
  const half = 0.13;
  return [[r0, a - half], [r1, a - half * 0.92], [r1, a + half * 0.92], [r0, a + half]].map(([r, t]) => [r * Math.cos(t), ZA + r * Math.sin(t)]);
};
const EMPTY = { fill: "", shades: [], top: "", crease: "", outline: "" };
function clutchParts(state, out) {
  const c = state.clutch ?? 0;
  for (let i = 0; i < PLATES; i++) out[`plate${i}@t`] = shift(-Math.round((i + 1) * CLUTCH.gap * c * 100) / 100, 0, 0);
  out["cpiston@t"] = shift(-Math.round((PLATES + 1) * CLUTCH.gap * c * 100) / 100, 0, 0);
  out["basket.bolts"] = G.dotsOf(A_F, CLUTCH.x1, 9.6, 8, P, { phase: sense(state.crank), all: true });
  // the basket's fingers turn with the engine; those behind the plates draw first
  const e = sense(state.crank);
  const span = TAU / FINGERS;
  const q = Math.round(((((e % span) + span) % span) / span) * 120) % 120;
  Object.assign(out, memo(`fingers|${q}`, () => {
    const part = {};
    const base = (q / 120) * span;
    const back = [];
    const front = [];
    for (let i = 0; i < FINGERS; i++) {
      const a = base + i * span;
      (G.dot3(G.radialOf(A_F, a), V) > 0 ? front : back).push(a);
    }
    for (const [name, list] of [["back", back], ["front", front]]) {
      for (let j = 0; j < 5; j++) {
        const a = list[j];
        solidFrame(part, `finger.${name}${j}`, a === undefined ? EMPTY : prismX(fingerShape(a), CLUTCH.x0, CLUTCH.x1 - CLUTCH.back));
      }
    }
    return part;
  }));
  // a stripe on the engine shaft between generator and basket
  const stripe = [];
  for (const da of [0, Math.PI]) {
    const a = e + da;
    const facing = G.dot3(G.radialOf(A_F, a), V);
    if (facing > 0.08) stripe.push({ d: k.pathOf([at(G.pointOf(A_F, GEN.x1 + GEN.turn + 0.3, 3.2, a)), at(G.pointOf(A_F, DRIVE_X.x0 - 1.9, 3.2, a))]), alpha: Math.min(1, facing * 2) });
  }
  buckets(stripe).forEach((d, i) => (out[`eshaft.stripe.${i}`] = d));
}

// ----- generator and motor: the rotor ends, windings lit while they carry current -----
function motorParts(state, out) {
  const e = sense(state.crank);
  out["gen.magnets"] = G.dotsOf(A_F, GEN.x1 + 0.8, GEN.bore - 2.8, 8, P, { phase: e, all: true });
  out["gen.key"] = G.spokesOf(A_F, GEN.x1 + 0.8, 3.4, GEN.bore - 4.4, 1, P, { phase: e + 0.3 });
  const m = sense(state.motor);
  out["motor.magnets"] = G.dotsOf(C_F, MOTOR.x1 + 0.9, MOTOR.bore - 3, 10, P, { phase: m, all: true });
  out["motor.key"] = G.spokesOf(C_F, MOTOR.x1 + 0.9, 2.8, MOTOR.bore - 4.6, 1, P, { phase: m + 0.3 });
  out["gen@on"] = Math.abs(state.genKw ?? 0) > 0.6;
  out["motor@on"] = Math.abs(state.motorKw ?? 0) > 0.6;
}

// ----- the plug: drawn back out of the inlet, then down onto the bench -----
export const PLUG_TAIL = [INLET.x, OBC.y1 + PLUG.body + PLUG.grip + 1.8, INLET.z];
export const plugShift = (plug) => {
  const out = 1 - plug;
  const a = Math.min(1, out * 2);
  const b = Math.max(0, out * 2 - 1);
  return [0, PLUG_OUT[1] * a, PLUG_OUT[2] * b];
};
export const LEAD_R = 1.25;
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
}

// ----- damper between the crank and the input shaft -----
function damperParts(state, out) {
  const c = sense(state.crank);
  const F = FX(0, 0, ZA);
  const windows = [];
  for (let i = 0; i < 6; i++) {
    const a = c + (i / 6) * TAU;
    // a closed window in the plate, and the spring inside it from end to end
    const slot = [];
    for (let n = 0; n <= 8; n++) slot.push(at(G.pointOf(F, DAMPER.x1, 18.2, a + (n / 8) * 0.62)));
    for (let n = 8; n >= 0; n--) slot.push(at(G.pointOf(F, DAMPER.x1, 13.8, a + (n / 8) * 0.62)));
    windows.push(k.pathOf(slot, true));
    const coil = [];
    for (let n = 0; n <= 8; n++) coil.push(at(G.pointOf(F, DAMPER.x1, n === 0 || n === 8 ? 16 : n % 2 ? 17.6 : 14.4, a + (n / 8) * 0.62)));
    windows.push(k.pathOf(coil));
  }
  out["damper.springs"] = windows.join("");
  out["damper.bolts"] = G.dotsOf(F, DAMPER.x1, 7.2, 6, P, { phase: c, all: true });
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

// ----- gauges: a centre-zero power meter on the inverter, charge on the pack -----
export const METER = { x: 22, y: PCU.y1, z: 113.4, r: 6.2, span: 100, kw: 60 }; // ±span/2 degrees for ±60 kW
export const SOC_DIAL = { x: PACK.x0 + 7.4, y: PACK.y1 - 2, z: 14, r: 5.2, from: 0, to: 1 };
const onFaceY = (c, r, deg) => [c.x + r * Math.sin(deg * RAD), c.y + 0.25, c.z + r * Math.cos(deg * RAD)];
export const meterAngle = (kw) => Math.max(-1, Math.min(1, kw / METER.kw)) * (METER.span / 2);
export const socAngle = (soc) => -60 + 120 * Math.max(0, Math.min(1, (soc - SOC_DIAL.from) / (SOC_DIAL.to - SOC_DIAL.from)));

function gaugeParts(state, out) {
  const m = Math.round(meterAngle(state.batteryKw ?? 0) * 4) / 4;
  out["meter.needle"] = k.pathOf([at(onFaceY(METER, -1.4, m)), at(onFaceY(METER, METER.r - 1.2, m))]);
  const s = Math.round(socAngle(state.soc ?? 0.8) * 4) / 4;
  out["soc.needle"] = k.pathOf([at(onFaceY(SOC_DIAL, -1.4, s)), at(onFaceY(SOC_DIAL, SOC_DIAL.r - 1.2, s))]);
}

// ----- current in the cables: lit chunks running toward where the power goes -----
export const FLOW = { dc: 0, mg1: 0, mg2: 0 };
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

// ----- sparks: a flash at each plug as its cylinder fires -----
function sparkParts(state, out) {
  const c = ((state.crank % 720) + 720) % 720;
  for (let i = 0; i < 4; i++) {
    const fire = (FIRING[i] - 8 + 720) % 720;
    let age = (c - fire) / 14;
    if (age < 0) age += 80;
    const flash = state.calm || !state.firing ? 0 : age > 1 ? 0 : Math.sin(Math.PI * Math.sqrt(age));
    out[`spark${i}@o`] = `${tenth(flash * 10) / 10}`;
  }
}

export function frameOf(state) {
  const out = {};
  const ck = crankKey(state.crank);
  const cq = ck / 2;
  Object.assign(out, memo(`crank|${ck}`, () => {
    const part = {};
    engineParts(cq, part);
    return part;
  }));
  for (let i = 0; i < 4; i++) out[`piston${i}@t`] = shift(0, 0, wristZ(state.crank + THROWS[i]) - REST_WRIST);
  gearTrain(state, out);
  clutchParts(state, out);
  motorParts(state, out);
  plugParts(state, out);
  damperParts(state, out);
  wheelParts(state, out);
  gaugeParts(state, out);
  flowParts(state, out);
  sparkParts(state, out);
  return out;
}

// skeleton markup for each live slot, filled from a frame
export function liveMarkup(id, f) {
  const solid = (key, options) => liveSolid(key, { fill: f[`${key}.f`], outline: f[`${key}.e`], crease: f[`${key}.c`], top: f[`${key}.t`], shades: [0, 1, 2, 3].map((n) => f[`${key}.s${n}`]) }, options);
  const dots = (key, size = 0.5, tone = "mid") => `<g class="iso-dots" data-tone="${tone}" data-k="${key}">${(f[key] || []).map(([x, y, a]) => `<circle cx="${tenth(x)}" cy="${tenth(y)}" r="${size}"${a !== undefined && a < 1 ? ` fill-opacity="${a.toFixed(2)}"` : ""}/>`).join("")}</g>`;
  const ribs = (key, tone = "lo") => bucketSvg(key, tone).replace(/data-k="([^"]+)" d=""/g, (_, kk) => `data-k="${kk}" d="${f[kk] || ""}"`).replace(/phv-fade/g, "phv-fade");
  const gear = (key, tone = "lo") => ribs(key, tone) + liveLine(`${key}.face`, f[`${key}.face`], "lo");
  let match = /^web(\d)([ab])$/.exec(id);
  if (match) return solid(id, { tone: "mid" });
  match = /^rod(\d)$/.exec(id);
  if (match) return solid(id, { tone: "mid" }) + liveLine(`${id}.web`, f[`${id}.web`], "faint") + liveLine(`${id}.cap`, f[`${id}.cap`], "lo") + dots(`${id}.bolts`, 0.45) + solid(`pin${match[1]}`, { tone: "mid", crease: "none" });
  match = /^lobe(\d)([ab])$/.exec(id);
  if (match) return solid(id, { tone: "hi" });
  match = /^spark(\d)$/.exec(id);
  if (match) return "";
  switch (id) {
    case "drive":
      return gear("drive") + dots("drive.bolts", 0.5);
    case "driven":
      return gear("driven") + dots("driven.bolts", 0.55);
    case "mpin":
    case "fpin":
      return gear(id);
    case "fring":
      return gear("fring") + dots("fring.bolts", 0.5);
    case "diff":
      return dots("diff.bolts", 0.5);
    case "gen.end":
      return dots("gen.magnets", 0.55, "lo") + liveLine("gen.key", f["gen.key"], "lo");
    case "motor.end":
      return dots("motor.magnets", 0.6, "lo") + liveLine("motor.key", f["motor.key"], "lo");
    case "basket":
      return dots("basket.bolts", 0.5);
    case "eshaft":
      return ribs("eshaft.stripe", "mid");
    case "fingers.back":
      return [0, 1, 2, 3, 4].map((j) => solid(`finger.back${j}`, { tone: "mid", crease: "none" })).join("");
    case "fingers.front":
      return [0, 1, 2, 3, 4].map((j) => solid(`finger.front${j}`, { tone: "mid", crease: "none" })).join("");
    case "lead":
      return `<g class="phv-cable" data-k="lead"${f["lead@on"] ? " data-on" : ""}>${f["lead@h"]}</g>`;
    case "damper":
      return liveLine("damper.springs", f["damper.springs"], "lo") + dots("damper.bolts", 0.5);
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
      return `<path class="iso-line phv-needle" data-free="" data-tone="hi" data-k="meter.needle" d="${f["meter.needle"]}"/>`;
    case "soc":
      return `<path class="iso-line phv-needle" data-free="" data-tone="hi" data-k="soc.needle" d="${f["soc.needle"]}"/>`;
    default:
      break;
  }
  throw new Error(`no live slot ${id}`);
}

export { TAU, DECK, ZB };
