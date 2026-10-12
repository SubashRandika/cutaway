// Port and runner centrelines in the section plane x = 0, as (y, z) points.
// Shared by the SVG section and the gas shader so they register exactly.

import * as G from "../../iso/lathe.mjs";
import { HEAD, SEAT_Y, VALVE_TILT, seatZ } from "./view.mjs";

export const PORT_R = 3.5;
export const RUNNER_R = 4.4;

export function portLine(sign) {
  const seat = [SEAT_Y * sign, seatZ(SEAT_Y)];
  const up = [Math.sin(VALVE_TILT) * sign, Math.cos(VALVE_TILT)];
  const pts = G.fillet([[0, seat[0], seat[1]], [0, seat[0] + up[0] * 6, seat[1] + up[1] * 6], [0, sign * 15, 130], [0, sign * (HEAD.half + 0.01), 131.5]], 5, 8);
  return pts.map(([, y, z]) => [y, z]);
}

export const RUNNER = G.fillet([[0, HEAD.half, 131.5], [0, 36, 132], [0, 44, 142], [0, 44, 150]], 7, 8).map(([, y, z]) => [y, z]);

export const PORTS = { intake: portLine(1), exhaust: portLine(-1) };

// even resampling to a fixed count, for shader uniform arrays
export function resample2(points, count) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const total = lengths[lengths.length - 1];
  const out = [];
  let j = 0;
  for (let i = 0; i < count; i++) {
    const at = (total * i) / (count - 1);
    while (j < points.length - 2 && lengths[j + 1] < at) j++;
    const t = (at - lengths[j]) / (lengths[j + 1] - lengths[j] || 1);
    out.push([points[j][0] + (points[j + 1][0] - points[j][0]) * t, points[j][1] + (points[j + 1][1] - points[j][1]) * t]);
  }
  return out;
}
