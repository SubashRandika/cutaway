// Everything that moves, rebuilt from the drivetrain state each frame. Each live
// part is a fixed skeleton of keyed paths ([data-k]); a frame is a flat map of
// key -> value, where "k" writes d, "k@t" a transform and "k@o" an opacity.

import * as k from "../../iso/iso-kit.mjs";
import * as G from "../../iso/lathe.mjs";
import { FINAL, PAIRS, RATIOS, VALVES, liftOf, pinRise, advanceOf } from "./model.mjs";
import { P, at, ZC, THROW, ROD, PIN_R, WEB, RP, PISTON_H, PIN_TO_CROWN, VALVE, VALVE_TILT, SEAT_Y, seatZ, FLY, DISC, PLATE, BEARING, GAP, ZO, ZD, PAIR_X, GEAR_W, COLLAR_X, COLLAR_TRAVEL, PINION_X, PINION_R, RING_R, SHAFT, ROTOR, WHEEL, ROLLER, ROLLER_Y, ROOF_APEX } from "./view.mjs";
import { FX, TAU, RAD, V, buckets, bucketSvg, discX, hull2, circle2, helix, liveLine, liveSolid, prismX, solidFrame, turn2 } from "./parts.mjs";

const fade = [0.04, 0.5];

// Parts that repeat are cached by phase: teeth every tooth pitch, the crank every
// 0.5°, spokes every 72°. One quantum moves nothing more than a quarter pixel.
const CACHE = new Map();
const memo = (key, build) => {
  let value = CACHE.get(key);
  if (value === undefined) {
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
  return memo(`${key}|${s0.toFixed(2)}|${q}`, () => buckets(G.ribsOf(F, s0, s1, r, count, P, { phase: p, fade })));
}
const crankKey = (c) => Math.round((((c % 720) + 720) % 720) * 2) % 1440;
const crankOf = (key) => key / 2;
const tenth = (n) => Math.round(n * 10) / 10;
const shift = (dx, dy, dz) => k.translateAlong(P, [dx, dy, dz]);

// ----- crank, rod, piston -----
const WEB_X = [
  [-WEB.outer, -WEB.inner],
  [WEB.inner, WEB.outer],
];
export const ROD_HALF = 2.8;

function webPolygon(c) {
  const t = c * RAD;
  const py = THROW * Math.sin(t);
  const pz = ZC + THROW * Math.cos(t);
  const away = Math.atan2(-Math.cos(t), -Math.sin(t)); // angle in (y,z) of the counterweight
  const points = [...circle2(py, pz, 7.4, 20), ...circle2(0, ZC, 7.2, 20)];
  for (let i = 0; i <= 16; i++) {
    const a = away + ((i / 16) * 2 - 1) * 62 * RAD;
    points.push([19 * Math.cos(a), ZC + 19 * Math.sin(a)]);
  }
  return hull2(points);
}

export const wristZ = (c) => ZC + pinRise(c, THROW, ROD);
export const REST_WRIST = wristZ(0);

function rodParts(c, out) {
  const t = c * RAD;
  const py = THROW * Math.sin(t);
  const pz = ZC + THROW * Math.cos(t);
  const wz = wristZ(c);
  const hull = hull2([...circle2(py, pz, 7.2, 24), ...circle2(0, wz, 4.4, 20)]);
  solidFrame(out, "rod", prismX(hull, -ROD_HALF, ROD_HALF));
  solidFrame(out, "pin", discX(-WEB.inner, WEB.inner, PIN_R, py, pz));
  // the rod cap split line and its two bolts, on the +x face
  const ax = [0 - py, wz - pz];
  const len = Math.hypot(ax[0], ax[1]);
  const u = [ax[0] / len, ax[1] / len];
  const n = [-u[1], u[0]];
  const face = (a, b) => at([ROD_HALF, py + u[0] * a + n[0] * b, pz + u[1] * a + n[1] * b]);
  out["rod.cap"] = k.pathOf([face(-0.6, -7.1), face(-0.6, 7.1)]);
  out["rod.bolts"] = [face(1.4, -5.2), face(1.4, 5.2), face(-2.6, -5.2), face(-2.6, 5.2)];
  // the I-beam recess down the shank, a closed slot on the face
  const slot = [];
  for (const [a, b] of [[6.4, -1.5], [len - 6.4, -1.1], [len - 6.4, 1.1], [6.4, 1.5]]) slot.push(face(a, b));
  out["rod.web"] = k.pathOf(slot, true);
}

// ----- valves -----
export const VALVE_AXES = {
  intake: { up: [0, Math.sin(VALVE_TILT), Math.cos(VALVE_TILT)], seat: [0, SEAT_Y, seatZ(SEAT_Y)] },
  exhaust: { up: [0, -Math.sin(VALVE_TILT), Math.cos(VALVE_TILT)], seat: [0, -SEAT_Y, seatZ(SEAT_Y)] },
};
export const valveFrame = (name) => G.frameAlong(VALVE_AXES[name].seat, VALVE_AXES[name].up);
const BUCKET_S = VALVE.cam - VALVE.base - VALVE.bucketH;
const SPRING_SEAT = 9;

function valveParts(name, c, out) {
  const lift = VALVE.lift * liftOf(c, VALVES[name]);
  const F = valveFrame(name);
  const coil = helix(F, SPRING_SEAT, BUCKET_S - 0.9 - lift, 3.1, 5.5, 0.4);
  out[`${name}.springB`] = coil.back;
  out[`${name}.springF`] = coil.front;
  const up = VALVE_AXES[name].up;
  out[`${name}@t`] = shift(-up[0] * lift, -up[1] * lift, -up[2] * lift);
  return lift;
}

// ----- cams -----
export const CAM_CENTRES = {
  intake: G.add3(VALVE_AXES.intake.seat, G.mul3(VALVE_AXES.intake.up, VALVE.cam)),
  exhaust: G.add3(VALVE_AXES.exhaust.seat, G.mul3(VALVE_AXES.exhaust.up, VALVE.cam)),
};
const FOLLOWER = { intake: 180 + 16, exhaust: 180 - 16 }; // degrees, (sin, cos) convention in (y, z)

function lobe(name, c) {
  const centre = CAM_CENTRES[name];
  const timing = VALVES[name];
  const points = [];
  for (let i = 0; i < 72; i++) {
    const b = (i / 72) * 360;
    const crank = 2 * (FOLLOWER[name] - b);
    const rho = VALVE.base + VALVE.lift * liftOf(crank, timing);
    const w = (b + c / 2) * RAD;
    points.push([centre[1] + rho * Math.sin(w), centre[2] + rho * Math.cos(w)]);
  }
  return hull2(points);
}

function camParts(name, c, out) {
  const centre = CAM_CENTRES[name];
  solidFrame(out, `cam.${name}`, prismX(lobe(name, c), -3.6, 3.6));
  const w = (c / 2) * RAD;
  out[`cam.${name}.dowel`] = [at([7.6, centre[1] + 1.9 * Math.sin(w), centre[2] + 1.9 * Math.cos(w)])];
}

// ----- flywheel, clutch -----
const CRANK_F = FX(0, 0, ZC);
const sense = (deg) => -deg * RAD; // drawing angle for a rotation measured like the crank

function clutchParts(state, out) {
  const crank = sense(state.crank);
  const input = sense(state.input);
  const open = 1 - state.clutch;
  const ribs = (key, s0, s1, r, count, phase) => ribsQ(key, CRANK_F, s0, s1, r, count, phase).forEach((d, i) => (out[`${key}.${i}`] = d));
  ribs("fly.teeth", FLY.x0, FLY.x1, FLY.r, 64, crank);
  out["fly.mark"] = G.spokesOf(CRANK_F, FLY.x1, FLY.r - 3.4, FLY.r - 0.4, 1, P, { phase: crank + 0.4 });
  ribs("disc.lining", DISC.x0, DISC.x1, DISC.r, 36, input);
  const plateX = open * GAP;
  out["plate@t"] = shift(plateX, 0, 0);
  // the diaphragm: a cone from the plate rim to the finger tips the bearing pushes
  const tip = BEARING.x0 - 0.4 - open * 1.8;
  const cone = memo(`cone|${open.toFixed(2)}`, () => G.lathe([[PLATE.x1 + plateX, 0], [PLATE.x1 + plateX, PLATE.r - 1], [tip, 8.6], [tip, 0]], CRANK_F, P, { smooth: false, rims: "first" }));
  solidFrame(out, "diaphragm", cone);
  const slots = [];
  for (let i = 0; i < 18; i++) {
    const a = crank + (i / 18) * TAU;
    const p0 = G.pointOf(CRANK_F, tip, 8.6, a);
    const p1 = G.pointOf(CRANK_F, PLATE.x1 + plateX, PLATE.r - 1, a);
    const facing = G.dot3(G.radialOf(CRANK_F, a), V);
    if (facing > -0.2) slots.push(k.pathOf([at(p0), at(p1)]));
  }
  out["diaphragm.fingers"] = slots.join("");
  out["plate.lugs"] = G.dotsOf(CRANK_F, PLATE.x1 + plateX, PLATE.r - 1.6, 3, P, { phase: crank + 0.5, fade: [0, 0.4] });
  out["bearing@t"] = shift(-open * 1.8, 0, 0);
}

// ----- gears -----
const OUT_F = FX(0, 0, ZO);
const IN_F = FX(0, 0, ZC);
const RING_F = FX(0, 0, ZD);

function toothFace(F, s, r, count, phase) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * TAU;
    const w = TAU / count;
    for (const [da, rr] of [[-0.25, r - 0.15], [-0.12, r - 0.15], [-0.08, r - 1.05], [0.08, r - 1.05], [0.12, r - 0.15], [0.25, r - 0.15]]) points.push(at(G.pointOf(F, s, rr, a + da * w)));
  }
  return k.pathOf(points, true);
}

function gearParts(key, F, x0, x1, r, count, phase, out) {
  ribsQ(key, F, x0, x1, r, count, phase).forEach((d, i) => (out[`${key}.${i}`] = d));
  const [q, p] = phaseStep(phase, TAU / count);
  out[`${key}.face`] = memo(`${key}.face|${q}`, () => toothFace(F, x1, r, count, p));
}

export function selectorTravel(state) {
  // each collar's offset along x: -1 slides toward the lower pair it sits between
  const offsets = [0, 0, 0];
  const place = (gear, amount) => {
    if (gear === 1) offsets[0] = -amount;
    if (gear === 2) offsets[0] = amount;
    if (gear === 3) offsets[1] = -amount;
    if (gear === 4) offsets[1] = amount;
    if (gear === 5) offsets[2] = -amount;
  };
  if (state.phase === "select") {
    place(state.from, 1 - state.selector);
    place(state.want, state.selector);
  } else place(state.gear, 1);
  return offsets;
}

function gearbox(state, out) {
  const input = sense(state.input);
  const output = sense(state.output);
  PAIRS.forEach((pair, i) => {
    const x0 = PAIR_X[i] - GEAR_W / 2;
    const x1 = PAIR_X[i] + GEAR_W / 2;
    gearParts(`gi${i}`, IN_F, x0, x1, pair.input / 2, pair.input, input + i * 0.37, out);
    // constant mesh: each output gear turns at input / ratio, the opposite way
    const turned = -(input / RATIOS[i + 1]) + Math.PI / pair.output + i * 0.21;
    gearParts(`go${i}`, OUT_F, x0, x1, pair.output / 2, pair.output, turned, out);
    out[`pair${i}@on`] = state.gear === i + 1 && state.clutch > 0.5;
  });
  const travel = selectorTravel(state);
  COLLAR_X.forEach((cx, j) => {
    const dx = Math.round(travel[j] * COLLAR_TRAVEL * 20) / 20;
    out[`collar${j}@t`] = shift(dx, 0, 0);
    ribsQ(`collar${j}`, OUT_F, cx - 1.5 + dx, cx + 1.5 + dx, 6.4, 14, output).forEach((d, i) => (out[`collar${j}.teeth.${i}`] = d));
  });
  const ring = output * (-FINAL.pinion / FINAL.ring);
  gearParts("pinion", OUT_F, PINION_X - 3, PINION_X + 3, PINION_R, FINAL.pinion, output + 0.2, out);
  gearParts("ring", RING_F, PINION_X - 3, PINION_X + 3, RING_R, FINAL.ring, ring + Math.PI / FINAL.ring, out);
  out["ring.bolts"] = G.dotsOf(RING_F, PINION_X + 3, RING_R - 5.5, 8, P, { phase: ring, all: true });
  out["diff.bolts"] = G.dotsOf(RING_F, 156, 9.5, 6, P, { phase: ring + 0.3, all: true });
}

// ----- gear lever -----
export const LEVER_BALL = [98, -10, 72.5];
function leverParts(state, out) {
  const travel = selectorTravel(state);
  const gate = [travel[0] !== 0 ? 1 : 0, travel[1] !== 0 ? 1 : 0, travel[2] !== 0 ? 1 : 0];
  const across = gate[0] ? 1 : gate[2] ? -1 : 0;
  const lean = travel[0] + travel[1] + travel[2];
  const share = Math.max(Math.abs(travel[0]), Math.abs(travel[1]), Math.abs(travel[2]));
  const tiltY = Math.round(across * 0.22 * Math.min(1, share * 3) * 200) / 200;
  const tiltX = Math.round(lean * 0.26 * 200) / 200;
  Object.assign(out, memo(`lever|${tiltX}|${tiltY}`, () => {
    const part = {};
  const dir = G.unit3([Math.sin(tiltX), Math.sin(tiltY), 1]);
  const F = G.frameAlong(LEVER_BALL, dir);
    solidFrame(part, "lever.rod", G.disc(0, 30, 1.1, F, P, { rims: "last" }));
    const knob = G.add3(LEVER_BALL, G.mul3(dir, 33));
    solidFrame(part, "lever.knob", G.sphereOf(knob, 4.2, P, { steps: 40 }));
    return part;
  }));
}

// ----- shaft, rotor, wheel, rollers -----
function wheelParts(state, out) {
  const w = sense(state.wheel);
  const shaftF = FX(0, 0, ZD);
  const stripe = [];
  for (const da of [0, Math.PI]) {
    const a = w + da;
    const facing = G.dot3(G.radialOf(shaftF, a), V);
    if (facing > 0.08) stripe.push({ d: k.pathOf([at(G.pointOf(shaftF, SHAFT.x0 + 16, SHAFT.r, a)), at(G.pointOf(shaftF, SHAFT.x1 - 16, SHAFT.r, a))]), alpha: Math.min(1, facing * 2) });
  }
  buckets(stripe).forEach((d, i) => (out[`shaft.stripe.${i}`] = d));
  out["rotor.holes"] = G.dotsOf(shaftF, ROTOR.x1, 20, 24, P, { phase: w, all: true });
  out["rotor.holes2"] = G.dotsOf(shaftF, ROTOR.x1, 16.6, 24, P, { phase: w + Math.PI / 24, all: true });
  // five spokes, prisms in the face plane, cached over one 72° period
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

// ----- throttle butterfly -----
export const THROTTLE = { y: 44, z: 156, r: 4.25 };
function butterflyParts(state, out) {
  const deg = Math.round(8 + 77 * Math.min(1, Math.max(0, state.throttle ?? 0)));
  Object.assign(out, memo(`fly|${deg}`, () => {
    const part = {};
    const a = (deg * Math.PI) / 180;
    const n = [0, -Math.sin(a), Math.cos(a)];
    solidFrame(part, "butterfly", G.disc(-0.35, 0.35, THROTTLE.r, G.frameAlong([0, THROTTLE.y, THROTTLE.z], n), P));
    return part;
  }));
}

// ----- the spark -----
export const GAP_POINT = [0, 0, ROOF_APEX - 1.6];
function sparkParts(state, out) {
  const at0 = 360 - advanceOf(state.rpm);
  const c = ((state.crank % 720) + 720) % 720;
  const age = (c - at0) / 7;
  const flash = state.calm ? 0 : age < 0 || age > 1 ? 0 : Math.sin(Math.PI * Math.sqrt(age));
  out["spark@o"] = `${tenth(flash * 10) / 10}`;
}

export function frameOf(state) {
  const out = {};
  const c = state.crank;
  const ck = crankKey(c);
  const cq = crankOf(ck);
  Object.assign(out, memo(`crank|${ck}`, () => {
    const part = {};
    for (const [index, [x0, x1]] of WEB_X.entries()) solidFrame(part, index ? "webR" : "webL", prismX(webPolygon(cq), x0, x1));
    rodParts(cq, part);
    valveParts("intake", cq, part);
    valveParts("exhaust", cq, part);
    camParts("intake", cq, part);
    camParts("exhaust", cq, part);
    return part;
  }));
  const dz = wristZ(c) - REST_WRIST;
  out["pistonB@t"] = shift(0, 0, dz);
  out["pistonF@t"] = shift(0, 0, dz);
  clutchParts(state, out);
  gearbox(state, out);
  leverParts(state, out);
  wheelParts(state, out);
  sparkParts(state, out);
  butterflyParts(state, out);
  return out;
}

export const PISTON = { r: RP, h: PISTON_H, crown: REST_WRIST + PIN_TO_CROWN };

// skeleton markup for each live slot, filled from a frame
export function liveMarkup(id, f) {
  const solid = (key, options) => liveSolid(key, { fill: f[`${key}.f`], outline: f[`${key}.e`], crease: f[`${key}.c`], top: f[`${key}.t`], shades: [0, 1, 2, 3].map((n) => f[`${key}.s${n}`]) }, options);
  const dots = (key, size = 0.5, tone = "mid") => `<g class="iso-dots" data-tone="${tone}" data-k="${key}">${(f[key] || []).map(([x, y, a]) => `<circle cx="${tenth(x)}" cy="${tenth(y)}" r="${size}"${a !== undefined && a < 1 ? ` fill-opacity="${a.toFixed(2)}"` : ""}/>`).join("")}</g>`;
  const ribs = (key, tone = "lo") => bucketSvg(key, tone).replace(/data-k="([^"]+)" d=""/g, (_, kk) => `data-k="${kk}" d="${f[kk] || ""}"`);
  switch (id) {
    case "webL":
      return solid("webL", { tone: "mid" });
    case "webR":
      return solid("webR", { tone: "mid" });
    case "rod":
      return solid("rod", { tone: "mid" }) + liveLine("rod.web", f["rod.web"], "faint") + liveLine("rod.cap", f["rod.cap"], "lo") + dots("rod.bolts", 0.55) + solid("pin", { tone: "mid", crease: "none" });
    case "spark":
      return `<g data-k="spark" style="opacity:${f["spark@o"]}"><circle class="eng-spark" cx="${tenth(at(GAP_POINT)[0])}" cy="${tenth(at(GAP_POINT)[1])}" r="2.6"/><circle class="eng-spark-core" cx="${tenth(at(GAP_POINT)[0])}" cy="${tenth(at(GAP_POINT)[1])}" r="1.1"/></g>`;
    case "butterfly":
      return solid("butterfly", { tone: "hi" });
    case "fly":
      return ribs("fly.teeth") + liveLine("fly.mark", f["fly.mark"], "hi");
    case "disc":
      return ribs("disc.lining", "mid");
    case "diaphragm":
      return solid("diaphragm", { tone: "mid" }) + liveLine("diaphragm.fingers", f["diaphragm.fingers"], "lo") + dots("plate.lugs", 0.6);
    case "lever":
      return solid("lever.rod", { tone: "mid", crease: "none" }) + solid("lever.knob", { tone: "hi", crease: "none" });
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
    case "ring":
      return ribs("ring") + liveLine("ring.face", f["ring.face"], "lo") + dots("ring.bolts", 0.55);
    case "diff":
      return dots("diff.bolts", 0.55);
    case "pinion":
      return ribs("pinion") + liveLine("pinion.face", f["pinion.face"], "lo");
    default:
      break;
  }
  let match = /^cam\.(intake|exhaust)$/.exec(id);
  if (match) return solid(id, { tone: "hi" }) + dots(`${id}.dowel`, 0.6, "hi");
  match = /^(intake|exhaust)\.(springB|springF)$/.exec(id);
  if (match) return liveLine(id, f[id], match[2] === "springB" ? "lo" : "mid");
  match = /^g([io])(\d)$/.exec(id);
  if (match) return ribs(id) + liveLine(`${id}.face`, f[`${id}.face`], "lo");
  match = /^collar(\d)\.teeth$/.exec(id);
  if (match) return ribs(id, "lo");
  throw new Error(`no live slot ${id}`);
}

export { TAU };
