// Everything that moves, rebuilt from the car's state each frame. Each live
// part is a fixed skeleton of keyed paths ([data-k]); a frame is a flat map of
// key -> value, where "k" writes d, "k@t" a transform, "k@o" an opacity and
// "k@on" toggles data-on.

import * as k from "../../iso/iso-kit.mjs";
import * as G from "../../iso/lathe.mjs";
import { PSD, COUNTER, MG2_PINION, FINAL, FIRING, MG2_TO_RING } from "./model.mjs";
import {
  P, at, ZA, ZB, ZD, C_AXIS, THROW, ROD, PIN_R, MAIN_R, WEB, RP, PISTON_H, PIN_TO_CROWN, CYL_X, CAM, DECK,
  SUN_R, PLANET_R, RING_R, CARRIER_R, DRIVE_R, DRIVEN_R, MG2P_R, FPIN_R, FRING_R, PSD_X, RING_X, SPIDER, MG2, MG1,
  FINAL_X, DAMPER, SHAFT, ROTOR, WHEEL, ROLLER, ROLLER_Y, PCU, PACK, LEVER, LEVER_X,
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

// ----- the power-split planetary -----
const A_F = FX(0, 0, ZA);
const B_F = FX(0, 0, ZB);
const C_F = FX(0, C_AXIS[0], C_AXIS[1]);
const D_F = FX(0, 0, ZD);

// Outline of a gear's teeth on its end face; `inward` teeth point at the axis (a ring gear).
function toothFace(F, s, r, count, phase, depth = 0.9, inward = false) {
  const points = [];
  const w = TAU / count;
  const land = inward ? r : r - 0.15;
  const root = inward ? r + depth : r - depth;
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

export const planetCentre = (carrier, j) => {
  const a = carrier + (j / PSD.planets) * TAU;
  return [CARRIER_R * Math.cos(a), ZA + CARRIER_R * Math.sin(a)];
};

function planetary(state, out) {
  const carrier = sense(state.crank);
  const sun = sense(state.sun);
  const ring = sense(state.ring);
  // each planet's spin, absolute: ωp = ωc − (ωs − ωc)·S/Pl
  const planet = carrier - (sun - carrier) * (PSD.sun / PSD.planet);
  gearParts("sun", A_F, PSD_X.x0, PSD_X.x1, SUN_R, PSD.sun, sun, out, 0.7);
  const ck = Math.round(((((carrier % TAU) + TAU) % TAU) / TAU) * 1440) % 1440;
  const cq = (ck / 1440) * TAU;
  Object.assign(out, memo(`carrier|${ck}`, () => {
    const part = {};
    for (let j = 0; j < PSD.planets; j++) {
      const [y, z] = planetCentre(cq, j);
      solidFrame(part, `planet${j}`, discX(PSD_X.x0, PSD_X.x1, PLANET_R - 0.6, y, z));
      part[`planet${j}.pin`] = [at([SPIDER.x1 + 0.2, y, z])];
      // a spider arm from the hub to each planet pin
      const a = cq + (j / PSD.planets) * TAU;
      const r = [Math.cos(a), Math.sin(a)];
      const t = [-Math.sin(a), Math.cos(a)];
      const arm = hull2([...circle2(y, z, 2.1, 14), [r[0] * 3.4 + t[0] * 1.7, ZA + r[1] * 3.4 + t[1] * 1.7], [r[0] * 3.4 - t[0] * 1.7, ZA + r[1] * 3.4 - t[1] * 1.7]]);
      solidFrame(part, `arm${j}`, prismX(arm, SPIDER.x0, SPIDER.x1));
    }
    part["hub.bolts"] = G.dotsOf(A_F, SPIDER.x1 + 1.4, 2.6, 6, P, { phase: cq, all: true });
    return part;
  }));
  for (let j = 0; j < PSD.planets; j++) {
    const [y, z] = planetCentre(cq, j);
    const F = FX(0, y, z);
    ribsQ(`planet${j}.teeth`, F, PSD_X.x0, PSD_X.x1, PLANET_R, PSD.planet, planet + j * 0.4, out).forEach((d, i) => (out[`planet${j}.teeth.${i}`] = d));
    const [q, p] = phaseStep(planet + j * 0.4, TAU / PSD.planet);
    out[`planet${j}.face`] = toothFace(F, PSD_X.x1, PLANET_R, PSD.planet, p, 0.6);
    void q;
  }
  // ring: internal teeth on its face, the counter drive teeth round its outside
  const [rq, rp] = phaseStep(ring, TAU / PSD.ring);
  out["ring.inner"] = memo(`ring.inner|${rq}`, () => toothFace(A_F, RING_X.x1, RING_R, PSD.ring, rp, 0.7, true));
  gearParts("drive", A_F, RING_X.x0, RING_X.x1, DRIVE_R, COUNTER.drive, ring, out);
}

function counterParts(state, out) {
  const counter = -sense(state.counter);
  gearParts("driven", B_F, RING_X.x0, RING_X.x1, DRIVEN_R, COUNTER.driven, counter + Math.PI / COUNTER.driven, out);
  out["driven.bolts"] = G.dotsOf(B_F, RING_X.x1, 10.6, 6, P, { phase: counter, all: true });
  gearParts("mg2p", C_F, RING_X.x0, RING_X.x1, MG2P_R, MG2_PINION, sense(state.mg2), out, 0.8);
  gearParts("fpin", B_F, FINAL_X.x0, FINAL_X.x1, FPIN_R, FINAL.pinion, counter, out, 0.8);
  const diff = sense(state.wheel);
  gearParts("fring", D_F, FINAL_X.x0, FINAL_X.x1, FRING_R, FINAL.ring, diff + Math.PI / FINAL.ring, out);
  out["fring.bolts"] = G.dotsOf(D_F, FINAL_X.x1, FRING_R - 4.6, 8, P, { phase: diff, all: true });
  out["diff.bolts"] = G.dotsOf(D_F, FINAL_X.x1 + 11.8, 7.6, 6, P, { phase: diff + 0.3, all: true });
}

// ----- motor-generators: the rotor's ends and the stripe on the sun sleeve -----
function motorParts(state, out) {
  const mg2 = sense(state.mg2);
  const MF = FX(0, C_AXIS[0], C_AXIS[1]);
  out["mg2.magnets"] = G.dotsOf(MF, MG2.x1 + 0.9, MG2.bore - 3, 8, P, { phase: mg2, all: true });
  out["mg2.key"] = G.spokesOf(MF, MG2.x1 + 0.9, 2.6, MG2.bore - 4.6, 1, P, { phase: mg2 + 0.3 });
  const sun = sense(state.sun);
  const stripe = [];
  for (const da of [0, Math.PI]) {
    const a = sun + da;
    const facing = G.dot3(G.radialOf(A_F, a), V);
    if (facing > 0.08) stripe.push({ d: k.pathOf([at(G.pointOf(A_F, MG1.x1 + MG1.turn + 0.4, 4.2, a)), at(G.pointOf(A_F, PSD_X.x0 - 2.4, 4.2, a))]), alpha: Math.min(1, facing * 2) });
  }
  buckets(stripe).forEach((d, i) => (out[`sleeve.stripe.${i}`] = d));
  out["mg1@on"] = Math.abs(state.mg1Kw ?? 0) > 0.6;
  out["mg2@on"] = Math.abs(state.mg2Kw ?? 0) > 0.6;
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
export const METER = { x: 22, y: PCU.y1, z: 113.4, r: 6.2, span: 100 }; // ±span/2 degrees for ±30 kW
export const SOC_DIAL = { x: PACK.x0 + 7.4, y: PACK.y1 - 2, z: 14, r: 5.2, from: 0.4, to: 0.8 };
const onFaceY = (c, r, deg) => [c.x + r * Math.sin(deg * RAD), c.y + 0.25, c.z + r * Math.cos(deg * RAD)];
export const meterAngle = (kw) => Math.max(-1, Math.min(1, kw / 30)) * (METER.span / 2);
export const socAngle = (soc) => -60 + 120 * Math.max(0, Math.min(1, (soc - SOC_DIAL.from) / (SOC_DIAL.to - SOC_DIAL.from)));

function gaugeParts(state, out) {
  const m = Math.round(meterAngle(state.batteryKw ?? 0) * 4) / 4;
  out["meter.needle"] = k.pathOf([at(onFaceY(METER, -1.4, m)), at(onFaceY(METER, METER.r - 1.2, m))]);
  const s = Math.round(socAngle(state.soc ?? 0.6) * 4) / 4;
  out["soc.needle"] = k.pathOf([at(onFaceY(SOC_DIAL, -1.4, s)), at(onFaceY(SOC_DIAL, SOC_DIAL.r - 1.2, s))]);
}

// ----- the lever gauge: three pointers, one straight bar -----
export const LEVER_FACE = LEVER.y + LEVER.t;
const leverZ = (rpm) => LEVER.zero + Math.max(-19, Math.min(19, rpm * LEVER.perRpm));
function leverParts(state, out) {
  const ring = (state.mg2Rpm ?? 0) / MG2_TO_RING;
  const heights = { sun: leverZ(state.mg1Rpm ?? 0), carrier: leverZ(state.engineRpm ?? 0), ring: leverZ(ring) };
  for (const name in heights) out[`lever.${name}@t`] = shift(0, 0, Math.round((heights[name] - LEVER.zero) * 20) / 20);
  const a = [LEVER_X.sun, LEVER_FACE + 2.2, heights.sun];
  const b = [LEVER_X.ring, LEVER_FACE + 2.2, heights.ring];
  const key = `bar|${a[2].toFixed(2)}|${b[2].toFixed(2)}`;
  Object.assign(out, memo(key, () => {
    const part = {};
    const d = G.sub3(b, a);
    const F = G.frameAlong(a, G.unit3(d));
    solidFrame(part, "lever.bar", G.disc(-1.2, G.len3(d) + 1.2, 0.55, F, P));
    return part;
  }));
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
  planetary(state, out);
  counterParts(state, out);
  motorParts(state, out);
  damperParts(state, out);
  wheelParts(state, out);
  gaugeParts(state, out);
  flowParts(state, out);
  sparkParts(state, out);
  leverParts(state, out);
  return out;
}

// skeleton markup for each live slot, filled from a frame
export function liveMarkup(id, f) {
  const solid = (key, options) => liveSolid(key, { fill: f[`${key}.f`], outline: f[`${key}.e`], crease: f[`${key}.c`], top: f[`${key}.t`], shades: [0, 1, 2, 3].map((n) => f[`${key}.s${n}`]) }, options);
  const dots = (key, size = 0.5, tone = "mid") => `<g class="iso-dots" data-tone="${tone}" data-k="${key}">${(f[key] || []).map(([x, y, a]) => `<circle cx="${tenth(x)}" cy="${tenth(y)}" r="${size}"${a !== undefined && a < 1 ? ` fill-opacity="${a.toFixed(2)}"` : ""}/>`).join("")}</g>`;
  const ribs = (key, tone = "lo") => bucketSvg(key, tone).replace(/data-k="([^"]+)" d=""/g, (_, kk) => `data-k="${kk}" d="${f[kk] || ""}"`).replace(/hyb-fade/g, "hyb-fade");
  const gear = (key, tone = "lo") => ribs(key, tone) + liveLine(`${key}.face`, f[`${key}.face`], "lo");
  let match = /^web(\d)([ab])$/.exec(id);
  if (match) return solid(id, { tone: "mid" });
  match = /^rod(\d)$/.exec(id);
  if (match) return solid(id, { tone: "mid" }) + liveLine(`${id}.web`, f[`${id}.web`], "faint") + liveLine(`${id}.cap`, f[`${id}.cap`], "lo") + dots(`${id}.bolts`, 0.45) + solid(`pin${match[1]}`, { tone: "mid", crease: "none" });
  match = /^lobe(\d)([ab])$/.exec(id);
  if (match) return solid(id, { tone: "hi" });
  match = /^planet(\d)$/.exec(id);
  if (match) return solid(id, { tone: "hi" }) + ribs(`${id}.teeth`) + liveLine(`${id}.face`, f[`${id}.face`], "lo");
  match = /^arm(\d)$/.exec(id);
  if (match) return solid(id, { tone: "mid" }) + dots(`planet${match[1]}.pin`, 0.7, "hi");
  match = /^spark(\d)$/.exec(id);
  if (match) return "";
  switch (id) {
    case "sun":
      return gear("sun");
    case "ring.inner":
      return liveLine("ring.inner", f["ring.inner"], "lo");
    case "driven":
      return gear("driven") + dots("driven.bolts", 0.55);
    case "drive":
    case "mg2p":
    case "fpin":
      return gear(id);
    case "fring":
      return gear("fring") + dots("fring.bolts", 0.5);
    case "diff":
      return dots("diff.bolts", 0.5);
    case "hub":
      return dots("hub.bolts", 0.45);
    case "mg2.end":
      return dots("mg2.magnets", 0.6, "lo") + liveLine("mg2.key", f["mg2.key"], "lo");
    case "sleeve":
      return ribs("sleeve.stripe", "mid");
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
    case "lever.bar":
      return solid("lever.bar", { tone: "hi", crease: "none" });
    case "meter":
      return `<path class="iso-line hyb-needle" data-free="" data-tone="hi" data-k="meter.needle" d="${f["meter.needle"]}"/>`;
    case "soc":
      return `<path class="iso-line hyb-needle" data-free="" data-tone="hi" data-k="soc.needle" d="${f["soc.needle"]}"/>`;
    default:
      break;
  }
  throw new Error(`no live slot ${id}`);
}

export { TAU, DECK, ZB, MG1 };
