// World layout. x runs from the reactor building toward the grid, y toward the
// viewer's front, z up; units are a model maker's, to no single scale. The
// containment and each vessel are cut on their own vertical centre plane (the
// half toward the viewer removed); pipes and machines that turn are drawn whole.

import { iso } from "../../iso/iso-kit.mjs";

export const WIDTH = 640;
export const HEIGHT = 500;
export const AZIMUTH = 42;
const PAD = 16;

export const BASE = { x: -250, y: -74, w: 432, d: 150, r: 9 };
export const BASE_H = 7;

// ----- containment: a post-tensioned concrete cylinder with a shallow dome, on a basemat -----
export const CONT = { x: -172, y: 0, r: 60, wall: 5, z0: 6, z1: 106, dome: 30, domeOut: 36, mat: 70 };
export const DECK = 6; // the floor inside, the basemat's top

// ----- the reactor pressure vessel in its primary shield -----
export const RPV = {
  x: -196, y: 0, r: 13, wall: 1.6,
  bottom: 12, // lowest point of the lower head
  shell0: 25, shell1: 54, // the cylindrical shell
  flange: [54, 58], flangeR: 15.6,
  head: 58, // the closure head's flange plane; the head is a hemisphere above it
  nozzleZ: 40,
};
export const SHIELD = { r0: 16.5, r1: 23, z1: 35 };
export const CORE = { z0: 19, z1: 39, half: 9.2, assemblies: 7, barrel: 10.4 };
export const ROD = { length: 20.6, tip0: 19.4, travel: 20 }; // tips at tip0 when in, tip0 + travel when out
export const RCCA_X = [-5.4, 0, 5.4]; // offsets of the clusters drawn in the cut
export const CRDM = { top: 90, r: 1.25, rows: [[-3.4, [-9, -5.4, -1.8, 1.8, 5.4, 9]], [-7.6, [-7.2, -3.6, 0, 3.6, 7.2]]] };

// ----- the steam generator, cut on its own centre plane -----
export const SG = {
  x: -144, y: -22,
  head: 52, headR: 8, // the channel head: a hemisphere below the tube sheet
  sheet: [52, 54.6],
  lower: [54.6, 86], r: 9, cone: [86, 91], upper: [91, 104], R: 12, top: 110, nozzle: 113,
  wall: 1.2, bend: 76, level: 95,
};

// ----- pressuriser on its platform, reactor coolant pump -----
export const PZR = { x: -205, y: -30, r: 6, z0: 47, z1: 98, platform: 42 };
export const RCP = { x: -185, y: -36, bowl: [18, 30], r: 5.2, motor: [36, 58], mr: 4.6 };
export const CRANE = { y: -51, z: 100, x0: -203.6, x1: -140.4 }; // on its ring girder at the cylinder's top

// ----- turbine hall: a shaft line on y = 0 at ZT -----
export const ZT = 40;
export const HP = { x0: -98, x1: -66, r: 10.6, rIn: 8.6 };
export const LP = { x0: -56, x1: -10, r: 19.8, rIn: 12.6 };
export const GEN = { x0: 20, x1: 62, r: 14 };
export const EXC = { x0: 66, x1: 76, r: 7 };
export const BEARINGS = [-102, -61, -6, 16, 64, 79];
export const COND = { x0: -60, x1: -4, y0: -26, y1: 0, z0: 3, z1: 20, box: 3.4 };
export const MSR = { x0: -78, x1: -34, y: -27, z: 60, r: 6 };
export const VALVE = { x: -92, y: -22, z: 62 }; // the turbine's stop and governor valve, a stem rising from its chest
export const MSIV = { x: -101, y: -22, z: 96 };
export const FEEDPUMP = { x: -88, y: -36, z: 9 };

// ----- the switchyard side -----
export const BREAKER = { x0: 84, x1: 94, y0: -9, y1: 9, z0: 60, z1: 70 };
export const BUS_Y = [-5, 0, 5];
export const BUS_Z = 65;
export const XFMR = { x0: 102, x1: 136, y0: -22, y1: 8, z0: 2, z1: 32 };
export const LV_X = 108;
export const HV_X = 128;
export const HV_Y = [-16, -7, 2];
export const HV_TOP = 58;
export const GANTRY = { x: 170, y0: -30, y1: 18, z: 98 };

// ----- in front: the cooling-water canal and its pump, the control desk -----
export const CANAL = { x0: -40, x1: 60, y0: 50, y1: 72, z1: 11, water: 7.4 };
export const CWP = { x: 3.6, y: 61 };
export const DESK = { x0: -122, x1: -78, y0: 44, y1: 62 };

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

const CONTENT = [
  ...box(BASE, -BASE_H - 5, 0),
  [CONT.x, CONT.y, CONT.z1 + CONT.domeOut],
  [CONT.x - CONT.r - CONT.wall, 0, CONT.z1],
  [GANTRY.x, GANTRY.y0, GANTRY.z + 4],
];
function fit() {
  const c = extent(flatOf(CONTENT));
  const scale = Math.min((WIDTH - PAD * 2) / (c.right - c.left), (HEIGHT - PAD * 2) / (c.down - c.up));
  return { origin: [WIDTH / 2 - ((c.left + c.right) / 2) * scale, HEIGHT / 2 - ((c.up + c.down) / 2) * scale], scale, azimuth: AZIMUTH };
}

export const P = fit();
export const at = (point) => iso(point, P);
