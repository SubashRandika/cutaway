// World layout. Units are about 3 mm of the real thing; x runs along every
// shaft toward the wheel, y toward the viewer's front, z up. The rig is cut by
// a stepped section: the cylinder and head on x = 0 (their x > 0 half removed),
// the crankcase, bellhousing and transaxle on y = 0 (their y > 0 half removed).

import { iso } from "../../iso/iso-kit.mjs";
import { FINAL, PAIRS } from "./model.mjs";

export const WIDTH = 640;
export const HEIGHT = 500;
export const AZIMUTH = 42;
const PAD = 26;

export const BASE = { x: -84, y: -62, w: 386, d: 130, r: 9 };
export const BASE_H = 7;
export const FOOT_H = 5;

// ----- engine -----
export const ZC = 46; // crank axis height
export const THROW = 14;
export const ROD = 47;
export const PIN_TO_CROWN = 10.5;
export const PISTON_H = 19;
export const RP = 13.6; // piston
export const RB = 14; // bore
export const DECK = ZC + THROW + ROD + PIN_TO_CROWN + 0.6;

export const CASE = { x0: -34, x1: 34, y0: -30, z0: 18, z1: 70, wall: 4 };
export const SUMP = { x0: -32, x1: 32, y0: -28, z0: 9, z1: 18 };
export const BARREL = { half: 18, fin: 26, z0: CASE.z1, z1: DECK };
export const FINS = [76, 82, 88, 94, 100, 106, 112];
export const HEAD = { half: 24, z0: DECK, z1: 142 };
export const COVER = { half: 22, z0: 142, z1: 158 };

export const VALVE_TILT = (20 * Math.PI) / 180;
export const SEAT_Y = 6.5;
export const ROOF_APEX = DECK + RB * Math.tan(VALVE_TILT);
export const seatZ = (y) => DECK + (RB - Math.abs(y)) * Math.tan(VALVE_TILT);
export const VALVE = { head: 5, stem: 1, cam: 30, bucket: 4, bucketH: 5, base: 5, lift: 3.2 };

export const MAIN_R = 4.5;
export const WEB = { inner: 4, outer: 9.5 };
export const PIN_R = 4.2;

// ----- drivetrain -----
export const FLY = { x0: 40, x1: 45, r: 31 };
export const DISC = { x0: 45.6, x1: 47.6, r: 25 };
export const PLATE = { x0: 48, x1: 50.4, r: 26 };
export const COVER_C = { x0: 45, x1: 55, r: 29 };
export const BELL = { x0: 35, x1: 70, r: 41 };
export const BEARING = { x0: 57, x1: 60.5, r: 5.6 };
export const GAP = 1.4; // the clutch plate's free travel

export const ZO = ZC - 20; // output shaft
export const GEAR_W = 5;
export const PAIR_X = [78, 88, 98, 108, 118];
export const COLLAR_X = [83, 103, 123];
export const COLLAR_TRAVEL = 2.2;
export const MODULE_FINAL = 1.6;
export const PINION_X = 140;
export const RING_R = (FINAL.ring * MODULE_FINAL) / 2;
export const PINION_R = (FINAL.pinion * MODULE_FINAL) / 2;
export const ZD = ZO + RING_R + PINION_R; // diff and wheel axis
export const BOX = { x0: 70, x1: 170, y0: -24 };
export const BOX_SIDE = [
  [70, 8],
  [70, 64],
  [128, 64],
  [142, 86],
  [170, 86],
  [170, 28],
  [160, 8],
];
export const gearRadii = (index) => [PAIRS[index].input / 2, PAIRS[index].output / 2];

export const SHAFT = { x0: 170, x1: 240, r: 2.2 };
export const UPRIGHT = { x0: 242, x1: 247 };
export const ROTOR = { x0: 250, x1: 254, r: 28 };
export const WHEEL = { x: 268, x0: 254, x1: 282, rim: 34, r: 50, face: 277 };
export const ROLLER = { r: 8, z: 12, x0: 250, x1: 286 };
export const ROLLER_Y = Math.sqrt((WHEEL.r + ROLLER.r) ** 2 - (ZD - ROLLER.z) ** 2);

export const TANK = { x: -76, y: 14, w: 28, d: 32, r: 6, h: 24 };

function fit(points) {
  const unit = { origin: [0, 0], scale: 1, azimuth: AZIMUTH };
  const flat = points.map((point) => iso(point, unit));
  const xs = flat.map(([x]) => x);
  const ys = flat.map(([, y]) => y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const up = Math.min(...ys);
  const down = Math.max(...ys);
  const scale = Math.min((WIDTH - PAD * 2) / (right - left), (HEIGHT - PAD * 2) / (down - up));
  return { origin: [WIDTH / 2 - ((left + right) / 2) * scale, HEIGHT / 2 - ((up + down) / 2) * scale], scale, azimuth: AZIMUTH };
}

const box = ({ x, y, w, d }, z0, z1) => {
  const out = [];
  for (const px of [x, x + w]) for (const py of [y, y + d]) for (const z of [z0, z1]) out.push([px, py, z]);
  return out;
};

export const P = fit([...box(BASE, -BASE_H - FOOT_H, 0), [-16, 34, 180], [0, 9, 170]]);
export const at = (point) => iso(point, P);
