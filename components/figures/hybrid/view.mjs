// World layout. Units are about 4.5 mm of the real thing; x runs along every
// shaft toward the wheel, y toward the viewer's front, z up. The engine block
// and head, the transaxle case and the battery case are cut on y = 0 with their
// y > 0 half removed; everything that turns is drawn whole.

import { iso } from "../../iso/iso-kit.mjs";
import { PSD, COUNTER, MG2_PINION, FINAL } from "./model.mjs";

export const WIDTH = 640;
export const HEIGHT = 500;
export const AZIMUTH = 42;
const PAD = 22;

export const BASE = { x: -170, y: -68, w: 428, d: 126, r: 9 };
export const BASE_H = 7;

// ----- engine: an inline four, crank along x -----
export const ZA = 72; // crank and input axis
export const THROW = 9.8;
export const ROD = 31;
export const PIN_TO_CROWN = 6.5;
export const PISTON_H = 12;
export const RP = 8.7;
export const RB = 9;
export const DECK = ZA + THROW + ROD + PIN_TO_CROWN + 0.6;
export const CYL_X = [-104, -82, -60, -38];
export const PITCH = 22;
export const BLOCK = { x0: -117, x1: -25, y0: -26, z0: 52, z1: DECK, wall: 3 };
export const PAN = { x0: -114, x1: -28, y0: -23, z0: 40, z1: 52 };
export const HEAD = { x0: -117, x1: -25, y0: -24, z0: DECK, z1: DECK + 17 };
export const COVER = { x0: -114, x1: -28, y0: -22, z0: DECK + 17, z1: DECK + 29 };
export const CAM = { y: -9, z: DECK + 22, base: 3, lift: 1.6 };
export const MAIN_R = 3.4;
export const PIN_R = 3.2;
export const WEB = { gap: 2.6, t: 3.2 }; // each web stands 2.6 off the cylinder centre, 3.2 thick
export const MOUNTS = [-96, -46];

// ----- transaxle, all shafts along x -----
export const M_PSD = 0.45; // module of the power-split gears (world units of diameter per tooth)
export const M_CTR = 0.76;
export const M_FIN = 0.62;
export const SUN_R = (PSD.sun * M_PSD) / 2;
export const PLANET_R = (PSD.planet * M_PSD) / 2;
export const RING_R = (PSD.ring * M_PSD) / 2;
export const CARRIER_R = SUN_R + PLANET_R;
export const DRIVE_R = (COUNTER.drive * M_CTR) / 2; // ring gear's outer teeth
export const DRIVEN_R = (COUNTER.driven * M_CTR) / 2;
export const MG2P_R = (MG2_PINION * M_CTR) / 2;
export const FPIN_R = (FINAL.pinion * M_FIN) / 2;
export const FRING_R = (FINAL.ring * M_FIN) / 2;
export const ZB = ZA - (DRIVE_R + DRIVEN_R); // counter shaft
export const C_AXIS = [DRIVEN_R + MG2P_R, ZB]; // MG2's axis (y, z): in front of the counter gear, outside the cut case
export const ZD = ZB + FPIN_R + FRING_R; // differential and wheel axis

export const DAMPER = { x0: -21, x1: -14, r: 24 };
export const MG1 = { x0: -5, x1: 15, r: 23, bore: 13.4, turn: 3.2 }; // stator stack, end turns stand 3.2 proud
export const PSD_X = { x0: 25, x1: 33 };
export const RING_X = { x0: 24, x1: 34 };
export const SPIDER = { x0: 34, x1: 35.6 };
export const MG2 = { x0: -5, x1: 15, r: 18.5, bore: 10.6, turn: 3 };
export const FINAL_X = { x0: 82, x1: 90 };
export const CASE = { y0: -32, wall: 3 };
export const CASE_SIDE = [
  [-25, 40],
  [-25, 101],
  [36, 101],
  [62, 72],
  [72, 72],
  [80, 84],
  [108, 84],
  [108, 4],
  [20, 4],
  [16, 40],
];

export const SHAFT = { x0: 108, x1: 196, r: 2.2 };
export const UPRIGHT = { x0: 198, x1: 203 };
export const ROTOR = { x0: 206, x1: 210, r: 28 };
export const WHEEL = { x0: 210, x1: 238, rim: 34, r: 50, face: 233 };
export const ROLLER = { r: 8, z: 12, x0: 206, x1: 242 };
export const ROLLER_Y = Math.sqrt((WHEEL.r + ROLLER.r) ** 2 - (ZD - ROLLER.z) ** 2);

// ----- power electronics and storage -----
export const PCU = { x0: -6, x1: 36, y0: -29, y1: -4, z0: 104, z1: 122 };
export const PACK = { x0: 116, x1: 196, y0: 10, y1: 48, z0: 1.6, z1: 4.6 }; // the tray
export const MODULE = { t: 2.1, gap: 0.3, x0: 128, y0: 13, y1: 45, z0: 4.6, z1: 24 };
// The lever gauge: sun, carrier and ring speeds on three scales spaced R : S apart.
export const LEVER = { x0: -100, x1: -46, y: 40, t: 2, z0: 3, z1: 47, zero: 25, perRpm: 17 / 10000 };
export const LEVER_X = (() => {
  const s = LEVER.x0 + 5;
  const r = LEVER.x1 - 5;
  return { sun: s, carrier: s + ((r - s) * PSD.ring) / (PSD.sun + PSD.ring), ring: r };
})();
export const TANK = { x: -158, y: 14, w: 30, d: 34, r: 6, h: 26 };

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

export const P = fit([...box(BASE, -BASE_H - 5, 0), [-70, -24, COVER.z1 + 8], [WHEEL.x1, 0, ZD + WHEEL.r], [WHEEL.x1, WHEEL.r, ZD]]);
export const at = (point) => iso(point, P);
