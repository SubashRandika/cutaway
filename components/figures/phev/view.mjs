// World layout. Units are about 4.5 mm of the real thing; x runs along every
// shaft toward the wheel, y toward the viewer's front, z up. The engine block
// and head and the transaxle case are cut on y = 0 with their y > 0 half
// removed; everything that turns is drawn whole.

import { iso } from "../../iso/iso-kit.mjs";
import { DIRECT, MOTOR_PINION, FINAL } from "./model.mjs";

export const WIDTH = 640;
export const HEIGHT = 500;
export const AZIMUTH = 42;
const PAD = 22;

export const BASE = { x: -170, y: -68, w: 428, d: 134, r: 9 };
export const BASE_H = 7;

// ----- engine: an inline four, crank along x -----
export const ZA = 72; // crank, generator and clutch axis
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
export const WEB = { gap: 2.6, t: 3.2 };
export const MOUNTS = [-96, -46];

// ----- transaxle, all shafts along x -----
export const ZB = 30.6; // counter shaft
export const M_DIR = (2 * (ZA - ZB)) / (DIRECT.drive + DIRECT.driven); // module of the clutch gear pair, set by the centre distance
export const M_FIN = 0.62;
export const DRIVE_R = (DIRECT.drive * M_DIR) / 2; // the clutch's output gear
export const DRIVEN_R = (DIRECT.driven * M_DIR) / 2; // the counter shaft's one driven gear
export const MPIN_R = (MOTOR_PINION * M_DIR) / 2; // the motor's pinion meshes the same gear
export const FPIN_R = (FINAL.pinion * M_FIN) / 2;
export const FRING_R = (FINAL.ring * M_FIN) / 2;
export const C_AXIS = [DRIVEN_R + MPIN_R, ZB]; // the motor's axis (y, z): in front of the counter gear, outside the cut case
export const ZD = ZB + FPIN_R + FRING_R; // differential and wheel axis

export const DAMPER = { x0: -21, x1: -14, r: 24 };
export const GEN = { x0: -5, x1: 14, r: 19.5, bore: 11.6, turn: 3 }; // stator stack, end turns stand 3 proud
// The output gear rides on a sleeve over the engine shaft; the clutch at the shaft's
// end joins the two: a finger basket closed at its +x end on the engine shaft, an
// apply piston, four steel and four friction plates and a backing ring at the open
// end, where the sleeve's hub comes in.
export const DRIVE_X = { x0: 20, x1: 28 };
export const CLUTCH = { x0: 30, back: 1.4, x1: 47, r: 15.2, steel: [9.4, 14.2], friction: [6.6, 13.4], t: 0.9, gap: 0.5, piston: 2 };
export const MOTOR = { x0: -15, x1: 11, r: 21, bore: 12.6, turn: 3 };
export const FINAL_X = { x0: 82, x1: 90 };
export const CASE = { y0: -32, wall: 3 };
export const CASE_SIDE = [
  [-25, 40],
  [-25, 101],
  [48, 101],
  [64, 76],
  [72, 76],
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

// ----- power electronics, storage and charging -----
export const PCU = { x0: -6, x1: 36, y0: -29, y1: -4, z0: 104, z1: 122 };
export const PACK = { x0: 116, x1: 196, y0: 8, y1: 48, z0: 1.6, z1: 4.6 }; // the tray
export const MODULE = { t: 1.0, gap: 0.22, x0: 128, y0: 11, y1: 45, z0: 4.6, z1: 22 };
export const OBC = { x0: 175, x1: 195, y0: 10, y1: 46, z0: 4.6, z1: 25 }; // on-board charger, the inlet on its front
export const INLET = { x: 185, z: 14.6, r: 4.6 };
// The plug, seated: its nose in the inlet, the grip toward the viewer.
export const PLUG = { nose: 2.4, body: 8, grip: 5, r: 4 };
export const PLUG_OUT = [0, 3.2, -(INLET.z - 4.1)]; // drawn back, then down onto the bench
export const CORD_Y = 61; // the charging cord runs along the bench's front edge
export const CLIP = [170, CORD_Y, 1.4]; // the cord clip where the plug's lead starts
// The wall charger stands on a post at the bench's front left.
export const POST = { x: -64, y: 50, w: 6 };
export const WALLBOX = { x0: -78, x1: -50, y0: 44, y1: 56, z0: 34, z1: 66 };
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
