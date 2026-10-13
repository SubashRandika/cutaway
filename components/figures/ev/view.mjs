// World layout. Units are about 4.5 mm of the real thing; x runs along every
// shaft toward the wheel, y toward the viewer's front, z up. The e-axle's case
// and the pack's tray are cut or open; everything that turns is drawn whole.

import { iso } from "../../iso/iso-kit.mjs";
import { STAGE1, STAGE2 } from "./model.mjs";

export const WIDTH = 640;
export const HEIGHT = 500;
export const AZIMUTH = 42;
const PAD = 22;

export const BASE = { x: -170, y: -68, w: 428, d: 134, r: 9 };
export const BASE_H = 7;

// ----- the reduction: three shafts in one case, all along x -----
export const M1 = 0.62; // module of the first stage
export const M2 = 0.72; // and of the second
export const P1_R = (STAGE1.pinion * M1) / 2;
export const G1_R = (STAGE1.gear * M1) / 2;
export const P2_R = (STAGE2.pinion * M2) / 2;
export const RING_R = (STAGE2.ring * M2) / 2;
export const ZD = 57.6; // differential and wheel axis
export const ZI = ZD + P2_R + RING_R; // intermediate shaft, above the differential
export const ZM = ZI - (P1_R + G1_R); // motor axis
export const STAGE1_X = { x0: 14, x1: 22 };
export const STAGE2_X = { x0: 82, x1: 90 };
export const MOTOR = { x0: -36, x1: 4, r: 26, bore: 15, turn: 3.4 };
export const CASE = { y0: -32, wall: 3 };
export const CASE_SIDE = [
  [-46, 28],
  [-46, 92],
  [6, 92],
  [10, 114],
  [30, 114],
  [36, 100],
  [108, 100],
  [108, 28],
];
export const MOUNTS = [-30, 42, 96];

export const SHAFT = { x0: 108, x1: 196, r: 2.2 };
export const UPRIGHT = { x0: 198, x1: 203 };
export const ROTOR = { x0: 206, x1: 210, r: 28 };
export const WHEEL = { x0: 210, x1: 238, rim: 34, r: 50, face: 233 };
export const ROLLER = { r: 8, z: 12, x0: 206, x1: 242 };
export const ROLLER_Y = Math.sqrt((WHEEL.r + ROLLER.r) ** 2 - (ZD - ROLLER.z) ** 2);

// ----- the electronics on the case: inverter over the motor, charger behind it -----
export const PCU = { x0: -40, x1: 2, y0: -30, y1: -9, z0: 95, z1: 117 };
export const PHASE_X = [-30, -26.6, -23.2]; // the motor's three phase leads leave the inverter's front here
export const OBC = { x0: 42, x1: 80, y0: -28, y1: -6, z0: 102, z1: 113 };

// ----- the Blade pack: two rows of 63 cells in an open tray, and its disconnect unit -----
export const TRAY = { x0: -166, x1: -64, y0: -44, y1: 44, floor: 3, wall: 2, top: 12 };
export const BLADE = { t: 1.1, gap: 0.36, x0: -160, z0: 4.4, z1: 22, rows: [[-40, -2.2], [2.2, 40]] };
export const BDU = { x0: -61, x1: -49, y0: 4, y1: 44, z0: 0, z1: 26 };
export const CONTACTORS = [18, 26, 33, 40]; // y of main +, main −, DC +, DC − // y of main +, main −, DC +, DC −

// ----- charging: the port box with the CCS2 inlet, the charger on its post -----
export const PORT = { x0: 114, x1: 133, y0: 16, y1: 46, z0: 0, z1: 26 };
export const INLET = { x: 123.5, z: 15.5, r: 4.6 }; // the AC socket; the DC pins sit 7.4 below
export const PLUG = { body: 8, grip: 5, r: 4 };
export const PLUG_OUT = [0, 3.2, -(INLET.z - 10.2)]; // drawn back, then down onto the bench
export const CORD_Y = 62;
export const CLIP = [108, CORD_Y, 1.4];
export const POST = { x: 72, y: 52, w: 6 };
export const CHARGER = { x0: 57, x1: 87, y0: 45.5, y1: 58.5, z0: 34, z1: 76 };

const box = ({ x, y, w, d }, z0, z1) => {
  const out = [];
  for (const px of [x, x + w]) for (const py of [y, y + d]) for (const z of [z0, z1]) out.push([px, py, z]);
  return out;
};
const flatOf = (points) => points.map((point) => iso(point, { origin: [0, 0], scale: 1, azimuth: AZIMUTH }));
const extent = (flat) => {
  const xs = flat.map(([x]) => x);
  const ys = flat.map(([, y]) => y);
  return { left: Math.min(...xs), right: Math.max(...xs), up: Math.min(...ys), down: Math.max(...ys) };
};

// The scale matches the other engine figures (the same bench, fitted with the
// petrol head's height); the picture is then centred on what this rig holds.
const SCALE_OF = [...box(BASE, -BASE_H - 5, 0), [-70, -24, 160], [WHEEL.x1, 0, ZD + WHEEL.r], [WHEEL.x1, WHEEL.r, ZD]];
const CONTENT = [...box(BASE, -BASE_H - 5, 0), [10, -32, 114], [PCU.x0, PCU.y0, PCU.z1 + 2], [CHARGER.x0, CHARGER.y1, CHARGER.z1], [WHEEL.x1, 0, ZD + WHEEL.r], [WHEEL.x1, WHEEL.r, ZD]];
function fit() {
  const s = extent(flatOf(SCALE_OF));
  const scale = Math.min((WIDTH - PAD * 2) / (s.right - s.left), (HEIGHT - PAD * 2) / (s.down - s.up));
  const c = extent(flatOf(CONTENT));
  return { origin: [WIDTH / 2 - ((c.left + c.right) / 2) * scale, HEIGHT / 2 - ((c.up + c.down) / 2) * scale], scale, azimuth: AZIMUTH };
}

export const P = fit();
export const at = (point) => iso(point, P);
