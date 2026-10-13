// The static drawing, in painter's order, with the live slots placed where
// their parts physically sit. The figure has no shader, so it is one SVG.

import * as k from "../../iso/iso-kit.mjs";
import * as G from "../../iso/lathe.mjs";
import { tubePieces, tubeSvg } from "../../iso/tube.mjs";
import {
  P, at, BASE, ZM, ZI, ZD, P1_R, G1_R, P2_R, RING_R, STAGE1_X, STAGE2_X, MOTOR, CASE, CASE_SIDE, MOUNTS,
  SHAFT, UPRIGHT, ROTOR, WHEEL, ROLLER, ROLLER_Y, PCU, OBC, TRAY, BLADE, BDU, CONTACTORS, PORT, INLET, PLUG, CORD_Y, CLIP, POST, CHARGER, PHASE_X,
} from "./view.mjs";
import { BATTERY } from "./model.mjs";
import { frameOf, liveMarkup, METER, SOC_DIAL, ARMATURE_DROP } from "./frame.mjs";
import { S, Ln, Dt, box, plan, path3, ring3, FX, prismX, prismY, discX, onY, cutSvg, cavSvg, TAU, RAD, V } from "./parts.mjs";

export const REST_STATE = {
  motor: 0, inter: 0, wheel: 0, plug: 1, kind: "dc", dcContact: 1, chargeKw: 0,
  calm: true, soc: 0.42, batteryKw: 0, motorKw: 0, flow: {},
};

const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// Cables carrying current: each one is cut into short chunks, keyed so the live
// code can light them one after another in the direction the power flows.
const CABLE_R = 1.05;
const routes = {};
function cableRoute(name, points, r = CABLE_R) {
  const route = G.fillet(points, Math.max(3, r * 2.8), 8, { P, tube: r });
  const pieces = tubePieces(route, r, P, { maxLength: 4.2 });
  routes[name] = pieces.length;
  return pieces.map((piece, i) => ({ piece, svg: `<g class="elv-cable" data-k="${name}.${i}">${tubeSvg(piece, { tone: "mid" })}</g>` }));
}

// Inset a closed (x, z) polygon by `by`, toward its inside.
function inset(poly, by) {
  const n = poly.length;
  const lines = poly.map((p, i) => {
    const q = poly[(i + 1) % n];
    const dx = q[0] - p[0];
    const dz = q[1] - p[1];
    const len = Math.hypot(dx, dz);
    return { p, d: [dx / len, dz / len], n: [-dz / len, dx / len] };
  });
  const area = poly.reduce((acc, p, i) => acc + p[0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * p[1], 0);
  const sgn = area > 0 ? 1 : -1;
  return poly.map((_, i) => {
    const a = lines[(i - 1 + n) % n];
    const b = lines[i];
    const pa = [a.p[0] + a.n[0] * by * sgn, a.p[1] + a.n[1] * by * sgn];
    const pb = [b.p[0] + b.n[0] * by * sgn, b.p[1] + b.n[1] * by * sgn];
    const cross = a.d[0] * b.d[1] - a.d[1] * b.d[0];
    if (Math.abs(cross) < 1e-9) return pb;
    const t = ((pb[0] - pa[0]) * b.d[1] - (pb[1] - pa[1]) * b.d[0]) / cross;
    return [pa[0] + a.d[0] * t, pa[1] + a.d[1] * t];
  });
}

// The back half of a vertical bore, seen from inside: concave facets.
function boreFacets(cx, r, z0, z1) {
  const out = [];
  for (let i = 0; i < 28; i++) {
    const a0 = Math.PI + (i / 28) * Math.PI;
    const a1 = Math.PI + ((i + 1) / 28) * Math.PI;
    const mid = (a0 + a1) / 2;
    const n = [-Math.cos(mid), -Math.sin(mid), 0];
    if (G.dot3(n, V) <= 0) continue;
    const p = (a, z) => [cx + r * Math.cos(a), r * Math.sin(a), z];
    out.push(cavSvg([p(a0, z0), p(a1, z0), p(a1, z1), p(a0, z1)], Math.min(3, G.toneOf(n, P))));
  }
  return out;
}

// The inside of a tube along x, seen from its open +x end: concave facets.
function innerFacets(F, x0, x1, r, steps = 48) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    const a0 = (i / steps) * TAU;
    const a1 = ((i + 1) / steps) * TAU;
    const mid = (a0 + a1) / 2;
    const n = G.mul3(G.radialOf(F, mid), -1);
    if (G.dot3(n, V) <= 0) continue;
    out.push(cavSvg([G.pointOf(F, x0, r, a0), G.pointOf(F, x0, r, a1), G.pointOf(F, x1, r, a1), G.pointOf(F, x1, r, a0)], Math.min(3, G.toneOf(n, P))));
  }
  return out;
}

// A round dial on a face: bezel, face, ticks and the zero mark, then its needle slot.
function dialFace(F, s, r, ticks, major) {
  const parts = [];
  parts.push(S(G.ringBand(s - 1.2, s, r - 0.9, r + 0.7, F, P, { hole: [s, r - 0.9] }), { tone: "mid" }));
  parts.push(`<path class="elv-dial" d="${G.circleOf(F, s - 0.4, r - 0.9, P, 64)}"/>`);
  const minor = [];
  const big = [];
  ticks.forEach((deg, i) => {
    const a0 = G.pointOf(F, s - 0.3, r - 1.15, deg * RAD);
    const a1 = G.pointOf(F, s - 0.3, r - (major.includes(i) ? 2.6 : 1.9), deg * RAD);
    (major.includes(i) ? big : minor).push(k.pathOf([at(a0), at(a1)]));
  });
  parts.push(Ln(`<path d="${G.circleOf(F, s - 0.35, r - 1.15, P, 64)}"/>`.replace(/<path d="|"\/>/g, ""), { tone: "faint" }));
  parts.push(Ln(minor.join(""), { tone: "lo" }), Ln(big.join(""), { tone: "mid" }));
  return parts.join("");
}

export function buildScene(state = REST_STATE) {
  const f = frameOf(state);
  const out = [];
  const defs = [];
  const put = (...svg) => out.push(...svg);
  const live = (id) => out.push(liveMarkup(id, f));
  const moving = (key, inner, extra = "") => `<g data-k="${key}" transform="${f[`${key}@t`] || ""}"${extra}>${inner}</g>`;
  for (const name in routes) delete routes[name];

  // ================= bench =================
  put(`<path class="iso-halo" d="${k.haloOf(BASE, -12, 12, P)}"/>`);
  const feet = byDepth([
    [BASE.x + 20, BASE.y + 18], [BASE.x + BASE.w - 20, BASE.y + 18], [BASE.x + 20, BASE.y + BASE.d - 18],
    [BASE.x + BASE.w - 20, BASE.y + BASE.d - 18], [BASE.x + BASE.w / 2, BASE.y + 18], [BASE.x + BASE.w / 2, BASE.y + BASE.d - 18],
  ]);
  for (const [x, y] of feet) put(S(k.cylinder(x, y, 7, -12, 1.6, P, 28), { tone: "lo" }), S(k.cylinder(x, y, 5.4, -10.4, 3.4, P, 28), { tone: "mid" }));
  put(S(k.slabOf(BASE, -7, 7, P, 8, 1.6), { tone: "mid" }));
  put(Ln(k.planOutline(k.insetPlan(BASE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(BASE, 10);
  put(Ln(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }), Dt(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the front edge, label plate at the left
  const strip = plan(-40, 48, BASE.y + BASE.d - 21, BASE.y + BASE.d - 14, 1);
  put(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  put(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
  const label = plan(-156, -114, BASE.y + BASE.d - 16, BASE.y + BASE.d - 5, 1.6);
  put(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }), Ln(k.planOutline(k.insetPlan(label, 1.6), 0.8, P), { tone: "faint" }));
  put(Ln([0, 1, 2].map((row) => k.lineOnTop([label.x + 7, label.y + 3.2 + row * 2.3], [label.x + (row === 1 ? 26 : 34), label.y + 3.2 + row * 2.3], 0.8, P)).join(""), { tone: "lo", free: true }));
  put(Dt([at([label.x + 3.2, label.y + label.d / 2, 0.8]), at([label.x + label.w - 3.2, label.y + label.d / 2, 0.8])], { size: 0.45 }));

  // ================= the Blade pack: an open tray, two rows of 63 cells =================
  const T = TRAY;
  {
    // the tray sits on two skids bolted to the bench
    for (const y of [T.y0 + 10, T.y1 - 10]) {
      const skid = plan(T.x0 + 4, T.x1 - 4, y - 4, y + 4, 1);
      put(S(k.slabOf(skid, 0, 1.4, P, 2, 0.3), { tone: "lo" }), Dt([at([skid.x + 3, y, 1.4]), at([skid.x + skid.w - 3, y, 1.4])], { size: 0.45 }));
    }
    const floor = plan(T.x0, T.x1, T.y0, T.y1, 2.4);
    put(S(k.slabOf(floor, 1.4, T.floor, P, 4, 0.6), { tone: "lo", inner: Ln(k.sideSeam(floor, 2.6, P, 4), { tone: "faint" }) }));
    // the walls behind the cells: back and left
    const back = plan(T.x0, T.x1, T.y0, T.y0 + T.wall, 1);
    const left = plan(T.x0, T.x0 + T.wall, T.y0 + T.wall, T.y1 - T.wall, 0.4);
    put(S(k.slabOf(back, 1.4 + T.floor, T.top - T.floor - 1.4, P, 3, 0.3), { tone: "mid" }));
    put(S(k.slabOf(left, 1.4 + T.floor, T.top - T.floor - 1.4, P, 3, 0.3), { tone: "mid" }));
    // the cells: far row first, each row from the far end
    const pitch = BLADE.t + BLADE.gap;
    const count = BATTERY.cells / BATTERY.rows;
    const rowOf = ([y0, y1], tag) => {
      const cells = [];
      const tabs = [];
      for (let i = 0; i < count; i++) {
        const x0 = BLADE.x0 + i * pitch;
        cells.push(S(k.slabOf(plan(x0, x0 + BLADE.t, y0, y1, 0.25), BLADE.z0, BLADE.z1 - BLADE.z0, P, 2), { tone: "mid", crease: "faint" }));
        tabs.push(at([x0 + BLADE.t / 2, y0 + 1.6, BLADE.z1]), at([x0 + BLADE.t / 2, y1 - 1.6, BLADE.z1]));
      }
      put(...cells);
      // the series links: a bar across every other gap, alternating ends
      const bars = [];
      for (let i = 0; i < count - 1; i++) {
        const x0 = BLADE.x0 + i * pitch + BLADE.t / 2;
        const y = i % 2 ? y1 - 1.6 : y0 + 1.6;
        bars.push(S(k.slabOf(plan(x0 - 0.25, x0 + pitch + 0.25, y - 0.7, y + 0.7, 0.2), BLADE.z1, 0.4, P, 2), { tone: "lo", crease: "none" }));
      }
      put(...bars, Dt(tabs, { size: 0.32, tone: "lo" }));
      void tag;
    };
    rowOf(BLADE.rows[0], "back");
    // the cross member between the rows carries the cell-monitoring boards and their ribbon
    const cross = plan(T.x0 + T.wall, T.x1 - T.wall, -1.8, 1.8, 0.4);
    put(S(k.slabOf(cross, 1.4 + T.floor, BLADE.z1 - 1.4 - T.floor, P, 3, 0.3), { tone: "mid" }));
    put(S(k.slabOf(plan(cross.x + 3, cross.x + cross.w - 3, -0.7, 0.7, 0.3), BLADE.z1, 0.5, P, 2), { tone: "lo", crease: "none" }));
    for (const x of [-146, -116, -86]) {
      const board = plan(x - 5, x + 5, -1.6, 1.6, 0.4);
      put(S(k.slabOf(board, BLADE.z1 + 0.5, 1.4, P, 2, 0.2), { tone: "hi" }), Dt([at([x - 2.6, 0, BLADE.z1 + 1.9]), at([x, 0, BLADE.z1 + 1.9]), at([x + 2.6, 0, BLADE.z1 + 1.9])], { size: 0.4, tone: "lo" }));
    }
    rowOf(BLADE.rows[1], "front");
    // the walls in front of the cells: front and right, with the lid's bolt flange round the top
    const front = plan(T.x0, T.x1, T.y1 - T.wall, T.y1, 1);
    const right = plan(T.x1 - T.wall, T.x1, T.y0 + T.wall, T.y1 - T.wall, 0.4);
    put(S(k.slabOf(right, 1.4 + T.floor, T.top - T.floor - 1.4, P, 3, 0.3), { tone: "mid" }));
    put(S(k.slabOf(front, 1.4 + T.floor, T.top - T.floor - 1.4, P, 3, 0.3), { tone: "mid", inner: Ln(k.sideSeam(front, 8, P, 3), { tone: "faint" }) }));
    const flange = [];
    for (let x = T.x0 + 5; x <= T.x1 - 5; x += 9.4) flange.push(at([x, T.y0 + 1, T.top]), at([x, T.y1 - 1, T.top]));
    for (let y = T.y0 + 9; y <= T.y1 - 9; y += 9.4) flange.push(at([T.x0 + 1, y, T.top]), at([T.x1 - 1, y, T.top]));
    put(Dt(flange, { size: 0.4 }));
    // the pack's own bus bars, from the row ends over the wall to the disconnect unit
    for (const y of [10, 14]) put(S(k.slabOf(plan(BLADE.x0 + count * pitch - 1, BDU.x0 + 0.6, y - 1, y + 1, 0.3), BLADE.z1 + 0.4, 0.6, P, 2), { tone: "lo", crease: "none" }), Dt([at([BDU.x0 + 0.1, y, BLADE.z1 + 1])], { size: 0.4 }));
  }

  // ================= the battery disconnect unit: contactors on top, the charge gauge in front =================
  const dcp = [8.4, 11.8].map((y, i) => cableRoute(`dcp${i}`, [[129 - i * 3, 30, PORT.z1], [129 - i * 3, 30, 31], [121 - i * 2.4, 14, 31], [121 - i * 2.4, -42 - i * 2.6, 31], [121 - i * 2.4, -42 - i * 2.6, 3.4], [-38, -42 - i * 2.6, 3.4], [-44, y, 3.4 + i * 3.4], [BDU.x1 + 1.6, y, 3.4 + i * 3.4], [BDU.x1, y, 3.4 + i * 3.4]], 1.3));
  // the DC pair runs behind the case, so it goes on before it
  for (const cable of dcp) for (const { piece, svg } of cable) if (piece.mid[1] < -20) put(svg);
  {
    const B = BDU;
    const body = plan(B.x0, B.x1, B.y0, B.y1, 1.2);
    put(S(k.slabOf(body, B.z0, B.z1 - B.z0, P, 3, 0.6), { tone: "mid", inner: Ln(k.sideSeam(body, B.z1 - 3.6, P, 3), { tone: "faint" }) }));
    put(Dt(k.corners(body, 1.6).map(([x, y]) => at([x, y, B.z1])), { size: 0.45 }));
    // four contactors: main + and −, which stay closed while the car is on, and DC + and − for fast charging
    const cx = B.x0 + 4.4;
    CONTACTORS.forEach((y, i) => {
      const dc = i >= 2;
      put(S(k.cylinder(cx, y, 2.3, B.z1, 3.6, P, 24), { tone: "mid" }), Dt([at([cx + 1.6, y + 1.6, B.z1 + 3.6])], { size: 0.35 }));
      const cap = S(k.cylinder(cx, y, 1.5, B.z1 + 3.6 - ARMATURE_DROP, 1.6 + ARMATURE_DROP, P, 20), { tone: dc ? "hi" : "mid" }) + S(k.cylinder(cx, y, 0.7, B.z1 + 5.2, 0.6, P, 14), { tone: "mid" });
      if (dc) put(moving(i === 2 ? "dcplus" : "dcminus", cap));
      else put(`<g transform="${k.translateAlong(P, [0, 0, -ARMATURE_DROP])}">${cap}</g>`);
    });
    // the HV terminals the inverter's pair leaves from, and the service plug
    for (const y of [7.4, 10.8]) put(S(k.cylinder(B.x1 - 2.4, y, 1.2, B.z1, 1.2, P, 14), { tone: "lo" }));
    put(S(box(B.x1 - 4, B.x1 - 1, 15, 23, B.z1, B.z1 + 3, 2, 0.3, 0.6), { tone: "hi" }));
    // the gauge on the front face
    const SF = G.frameOf([SOC_DIAL.x, B.y1, SOC_DIAL.z], [0, 1, 0], [0, 0, 1], [1, 0, 0]);
    const marks = [];
    for (let i = 0; i <= 8; i++) marks.push(-60 + i * 15);
    put(dialFace(SF, 1.0, SOC_DIAL.r, marks, [0, 4, 8]));
    live("soc");
    put(Dt([at(G.pointOf(SF, 1.1, 0, 0))], { size: 0.75, tone: "hi" }));
  }
  const bus = [[7.4, -20], [10.8, -16.6]].map(([y0, y], i) => cableRoute(`bus${i}`, [[BDU.x1 - 2.4, y0, BDU.z1 + 1.2], [BDU.x1 - 2.4, y0, 92 + i * 3.4], [BDU.x1 - 2.4, y, 100.4 + i * 3.4], [PCU.x0 - 1.6, y, 100.4 + i * 3.4], [PCU.x0, y, 100.4 + i * 3.4]], 1.05));
  for (const cable of bus) for (const { piece, svg } of cable) if (piece.mid[2] < 93) put(svg);

  // ================= the e-axle's mounts and case =================
  for (const x of MOUNTS) {
    put(S(box(x - 8, x + 8, -26, -4, 0, 1.4, 2, 0.3), { tone: "lo" }), Dt([at([x - 6, -24, 1.4]), at([x + 6, -6, 1.4]), at([x - 6, -6, 1.4]), at([x + 6, -24, 1.4])], { size: 0.45 }));
    put(S(box(x - 5, x + 5, -22, -8, 1.4, 22, 2, 0.6, 1.2), { tone: "mid", inner: Ln(k.sideSeam(plan(x - 5, x + 5, -22, -8, 1.2), 18, P, 2), { tone: "faint" }) }));
    put(S(box(x - 4, x + 4, -21, -9, 22, 25, 2, 0.3), { tone: "lo", className: "elv-rubber" }));
    put(S(box(x - 5, x + 5, -22, -8, 25, 28, 2, 0.4, 1), { tone: "mid" }));
  }
  const outer = CASE_SIDE;
  const innerSide = inset(outer, CASE.wall);
  const wall = (i) => [outer[i], outer[(i + 1) % outer.length], innerSide[(i + 1) % outer.length], innerSide[i]];
  const wallSolid = (i, cls = "") => S(prismY(wall(i), CASE.y0, 0), { tone: "mid", className: cls });
  const wallCut = (i) => cutSvg([wall(i).map(onY(0))]);
  put(cavSvg(innerSide.map(([x, z]) => [x, CASE.y0 + CASE.wall, z]), 1));
  put(wallSolid(7, "elv-cavsolid"), wallCut(7), wallSolid(0, "elv-cavsolid"), wallCut(0));
  // ribs cast into the back wall's inside, between the bearing bosses
  for (const x of [-20, 50, 66]) put(cavSvg([[x - 0.8, CASE.y0 + CASE.wall + 0.1, 31], [x + 0.8, CASE.y0 + CASE.wall + 0.1, 31], [x + 0.8, CASE.y0 + CASE.wall + 0.1, x < 0 ? 89 : 97], [x - 0.8, CASE.y0 + CASE.wall + 0.1, x < 0 ? 89 : 97]], 0));

  // ================= the motor: stator, end windings, the rotor's end =================
  const M_F = FX(0, 0, ZM);
  const I_F = FX(0, 0, ZI);
  const D_F = FX(0, 0, ZD);
  {
    const F = M_F;
    const laminations = [];
    for (let x = MOTOR.x0 + 1.2; x < MOTOR.x1 - 0.6; x += 1.2) laminations.push(G.arcOf(F, x, MOTOR.r, P));
    put(`<g data-k="motor" class="elv-wind">`);
    put(S(G.ringBand(MOTOR.x0 - MOTOR.turn, MOTOR.x0, MOTOR.bore + 0.6, MOTOR.r - 3.6, F, P), { tone: "mid", className: "elv-copper" }));
    put(`</g>`);
    put(S(G.disc(MOTOR.x0, MOTOR.x1, MOTOR.r, F, P), { tone: "mid", inner: Ln(laminations.join(""), { tone: "faint" }) }));
    put(Dt(G.dotsOf(F, MOTOR.x1, MOTOR.r - 1.6, 16, P, { all: true, phase: 0.2 }), { size: 0.4 }));
    put(`<g data-k="motor" class="elv-wind">`);
    put(S(G.ringBand(MOTOR.x1, MOTOR.x1 + MOTOR.turn, MOTOR.bore + 0.6, MOTOR.r - 3.6, F, P, { hole: [MOTOR.x1 + MOTOR.turn, MOTOR.bore + 0.6] }), { tone: "mid", className: "elv-copper" }));
    put(`</g>`);
    put(S(G.disc(MOTOR.x1, MOTOR.x1 + 0.9, MOTOR.bore - 0.4, F, P), { tone: "mid" }));
    live("motor.end");
    put(S(discX(MOTOR.x1 + 0.9, STAGE1_X.x0 - 1.6, 3.4, 0, ZM), { tone: "mid", crease: "none" }));
    live("mshaft");
    put(S(discX(STAGE1_X.x0 - 1.6, STAGE1_X.x0, 5.2, 0, ZM), { tone: "mid" }));
  }

  // ================= the reduction: first stage, intermediate shaft, second stage =================
  put(S(discX(9, STAGE1_X.x0, 3.4, 0, ZI), { tone: "mid", crease: "none" }));
  put(S(discX(STAGE1_X.x0, STAGE1_X.x1, G1_R - 0.5, 0, ZI), { tone: "hi", inner: Ln(G.circleOf(I_F, STAGE1_X.x1, G1_R - 4.2, P, 96) + G.circleOf(I_F, STAGE1_X.x1, 6.4, P, 64), { tone: "faint" }) }));
  live("g1");
  put(S(discX(STAGE1_X.x0, STAGE1_X.x1, P1_R - 0.5, 0, ZM), { tone: "hi" }));
  live("p1");
  put(S(discX(STAGE1_X.x1, STAGE1_X.x1 + 1.4, 2.6, 0, ZM), { tone: "mid" }));
  put(S(discX(STAGE1_X.x1, STAGE2_X.x0, 3.4, 0, ZI), { tone: "mid", crease: "none" }));
  put(S(G.ringBand(STAGE2_X.x0, STAGE2_X.x1, 12, RING_R - 0.5, D_F, P), { tone: "hi" }));
  live("ring");
  put(S(discX(STAGE2_X.x0, STAGE2_X.x1, P2_R - 0.5, 0, ZI), { tone: "hi" }));
  live("p2");
  put(S(discX(STAGE2_X.x1, 104.6, 3.4, 0, ZI), { tone: "mid", crease: "none" }));
  put(S(G.solidOf([[STAGE2_X.x1, 12.6], [STAGE2_X.x1 + 2, 12.6], [STAGE2_X.x1 + 4, 11.4, 1], [STAGE2_X.x1 + 8, 10, 1], [STAGE2_X.x1 + 11, 8.6], [STAGE2_X.x1 + 11, 7.4], [STAGE2_X.x1 + 12.6, 7.4], [STAGE2_X.x1 + 12.6, 6], [106, 6]], D_F, P), { tone: "mid" }));
  live("diff");

  // ================= case: the top walls and the +x end =================
  put(wallSolid(1), wallCut(1), wallSolid(2), wallCut(2), wallSolid(3), wallCut(3), wallSolid(4), wallCut(4), wallSolid(5), wallCut(5));
  {
    // cast ribs across the slants, bolts along the flats, a breather on the hump
    for (const seg of [1, 2, 4]) {
      const [a, b] = [outer[seg], outer[seg + 1]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      const n = [-d[1], d[0]];
      if (seg === 1) continue;
      for (const t of [0.34, 0.66]) {
        const x = a[0] + (b[0] - a[0]) * t;
        const z = a[1] + (b[1] - a[1]) * t;
        const rib = [[x - d[0] * 0.9, z - d[1] * 0.9], [x + d[0] * 0.9, z + d[1] * 0.9], [x + d[0] * 0.9 + n[0] * 1.6, z + d[1] * 0.9 + n[1] * 1.6], [x - d[0] * 0.9 + n[0] * 1.6, z - d[1] * 0.9 + n[1] * 1.6]];
        put(S(prismY(rib, CASE.y0 + 1, -1), { tone: "mid" }));
      }
    }
    put(S(k.cylinder(20, -24, 1.8, 114, 2.4, P, 16), { tone: "mid" }), S(k.cylinder(20, -24, 2.6, 116.4, 1, P, 16), { tone: "mid" }));
    put(Dt([-42, 0, 14, 26, 40, 60, 100].map((x) => at([x, -1.6, x < 6 ? 92 : x < 32 ? 114 : 100])), { size: 0.45 }));
  }
  put(wallSolid(6), wallCut(6));
  {
    // the +x end: a bolted cover with the axle seal, a drain plug and an ID plate
    const E = 108;
    const face = (y, z) => [E, y, z];
    put(`<path class="iso-line" data-tone="lo" d="${ring3([face(-29.6, 30.4), face(-2.4, 30.4), face(-2.4, 97.6), face(-29.6, 97.6)])}"/>`);
    const bolts = [];
    for (let i = 0; i <= 5; i++) bolts.push(face(-28.2, 32 + (i / 5) * 64), face(-3.8, 32 + (i / 5) * 64));
    for (let i = 1; i < 4; i++) bolts.push(face(-28.2 + (i / 4) * 24.4, 32), face(-28.2 + (i / 4) * 24.4, 96));
    put(Dt(bolts.map(at), { size: 0.5 }));
    put(S(G.ringBand(E, E + 2.4, 3.4, 7.4, D_F, P), { tone: "mid" }));
    put(S(discX(E, E + 1.4, 1.8, -20, 34), { tone: "mid" }));
    const idp = [face(-26, 76), face(-12, 76), face(-12, 84), face(-26, 84)];
    put(`<path class="elv-plate" d="${ring3(idp.map(([x, y, z]) => [x + 0.3, y, z]))}"/>`);
    put(Ln([0, 1, 2].map((row) => path3([[E + 0.3, -24, 82 - row * 2.2], [E + 0.3, row === 1 ? -17 : -14.4, 82 - row * 2.2]])).join(""), { tone: "lo", free: true }));
    put(Dt([at([E + 0.3, -25, 77.2]), at([E + 0.3, -13, 77.2])], { size: 0.4 }));
  }

  // ================= on the case: the inverter over the motor, the charger behind the gears =================
  for (const cable of bus) for (const { piece, svg } of cable) if (piece.mid[2] >= 93) put(svg);
  {
    const lid = plan(PCU.x0, PCU.x1, PCU.y0, PCU.y1, 2.4);
    for (const [x, y] of byDepth([[PCU.x0 + 4, PCU.y0 + 4], [PCU.x1 - 4, PCU.y0 + 4], [PCU.x0 + 4, PCU.y1 - 4], [PCU.x1 - 4, PCU.y1 - 4]])) put(S(k.cylinder(x, y, 2.2, 92, PCU.z0 - 92, P, 16), { tone: "lo" }));
    put(S(k.slabOf(lid, PCU.z0, PCU.z1 - 4 - PCU.z0, P, 4, 0.6), { tone: "mid", inner: Ln(k.sideSeam(lid, PCU.z0 + 6, P, 4), { tone: "faint" }) }));
    put(S(k.slabOf(k.insetPlan(lid, -0.4), PCU.z1 - 4, 4, P, 4, 0.8), { tone: "mid" }));
    put(Dt(k.corners(lid, 3.4).map(([x, y]) => at([x, y, PCU.z1])), { size: 0.5 }));
    const ribs = [];
    for (let x = PCU.x0 + 7; x <= PCU.x1 - 9; x += 3) ribs.push(k.planOutline(plan(x - 0.6, x + 0.6, PCU.y0 + 5, PCU.y1 - 10, 0.6), PCU.z1, P, 2));
    put(Ln(ribs.join(""), { tone: "lo" }));
    const tag = plan(PCU.x0 + 6, PCU.x0 + 22, PCU.y1 - 8, PCU.y1 - 3, 1);
    put(S(k.slabOf(tag, PCU.z1, 0.5, P, 3), { tone: "lo", crease: "none" }), Ln([0, 1].map((row) => k.lineOnTop([tag.x + 2.4, tag.y + 1.6 + row * 1.8], [tag.x + (row ? 9 : 13), tag.y + 1.6 + row * 1.8], PCU.z1 + 0.5, P)).join(""), { tone: "lo", free: true }));
    // the power meter on the front face, centre zero
    const MFD = G.frameOf([METER.x, PCU.y1, METER.z], [0, 1, 0], [0, 0, 1], [1, 0, 0]);
    const marks = [];
    for (let i = 0; i <= 12; i++) marks.push(-METER.span / 2 + (i / 12) * METER.span);
    put(dialFace(MFD, 1.2, METER.r, marks, [0, 6, 12]));
    put(Ln(k.pathOf([at(G.pointOf(MFD, 0.9, METER.r - 1.15, 0)), at(G.pointOf(MFD, 0.9, METER.r - 3.2, 0))]), { tone: "hi" }));
    live("meter");
    put(Dt([at(G.pointOf(MFD, 1.3, 0, 0))], { size: 0.9, tone: "hi" }));
    // the motor's three phase connectors, its terminal block on the case top, and the charger's pair on the +x face
    for (const x of PHASE_X) put(S(G.disc(0, 1.6, 1.3, G.frameAlong([x, PCU.y1, 99], [0, 1, 0]), P), { tone: "mid" }));
    put(S(box(PHASE_X[0] - 3, PHASE_X[2] + 3, -7.4, -1, 92, 95.2, 2, 0.4, 0.8), { tone: "mid" }));
    for (const x of PHASE_X) put(S(k.cylinder(x, -3.4, 0.9, 95.2, 0.7, P, 12), { tone: "lo" }));
    for (const y of [-24, -20.4]) put(S(discX(PCU.x1, PCU.x1 + 1.6, 1.4, y, 104), { tone: "mid" }));
    // the on-board charger: finned, on four standoffs, its AC inlet pair on the +x face, its DC pair on the -x face
    const obc = plan(OBC.x0, OBC.x1, OBC.y0, OBC.y1, 1.8);
    for (const [x, y] of byDepth([[OBC.x0 + 4, OBC.y0 + 4], [OBC.x1 - 4, OBC.y0 + 4], [OBC.x0 + 4, OBC.y1 - 4], [OBC.x1 - 4, OBC.y1 - 4]])) put(S(k.cylinder(x, y, 2, 100, OBC.z0 - 100, P, 16), { tone: "lo" }));
    put(S(k.slabOf(obc, OBC.z0, OBC.z1 - OBC.z0, P, 3, 0.6), { tone: "mid", inner: Ln(k.sideSeam(obc, OBC.z0 + 3.4, P, 3), { tone: "faint" }) }));
    for (let x = OBC.x0 + 4; x <= OBC.x1 - 4; x += 2.6) put(S(k.slabOf(plan(x - 0.45, x + 0.45, OBC.y0 + 3, OBC.y1 - 3, 0.3), OBC.z1, 1.8, P, 2), { tone: "mid", crease: "none" }));
    put(Dt(k.corners(obc, 1.6).map(([x, y]) => at([x, y, OBC.z1])), { size: 0.45 }));
    for (const y of [-24, -20.4]) put(S(discX(OBC.x1, OBC.x1 + 1.6, 1.3, y, 107), { tone: "mid" }));
    for (const y of [-24, -20.4]) put(S(discX(OBC.x0 - 1.6, OBC.x0, 1.3, y, 107), { tone: "mid" }));
  }
  const mot = PHASE_X.map((x, i) => cableRoute(`mot${i}`, [[x, PCU.y1 + 1.6, 99], [x, -3.4, 99], [x, -3.4, 95.9]], 0.75));
  for (const cable of mot) for (const { svg } of cable) put(svg);
  // the charger's DC pair arches over the gear hump to the inverter's bus
  const obcBus = [-24, -20.4].map((y, i) => cableRoute(`obc${i}`, [[OBC.x0 - 1.6, y, 107], [36, y, 107], [30, y, 118.4 + i * 0.2], [10, y, 118.4 + i * 0.2], [5, y, 104], [PCU.x1 + 1.6, y, 104]], 1));
  for (const cable of obcBus) for (const { svg } of cable) put(svg);
  // the AC pair from the charge port climbs the case's +x end to the charger
  const acp = [-24, -20.4].map((y, i) => cableRoute(`acp${i}`, [[118 + i * 3, 30, PORT.z1], [118 + i * 3, 30, 33], [114 + i * 0.4, 12, 33], [114 + i * 0.4, y, 33], [114 + i * 0.4, y, 107], [OBC.x1 + 3.6, y, 107], [OBC.x1 + 1.6, y, 107]], 1));
  for (const cable of acp) for (const { piece, svg } of cable) if (piece.mid[0] < 112 || piece.mid[2] > 60) put(svg);

  // ================= the charge port box: CCS2 inlet in front, the two pairs leaving on top =================
  {
    const box0 = plan(PORT.x0, PORT.x1, PORT.y0, PORT.y1, 1.6);
    for (const [x, y] of byDepth([[PORT.x0 + 3, PORT.y0 + 3], [PORT.x1 - 3, PORT.y0 + 3], [PORT.x0 + 3, PORT.y1 - 3], [PORT.x1 - 3, PORT.y1 - 3]])) put(S(k.cylinder(x, y, 2, 0, 1.4, P, 14), { tone: "lo" }));
    put(S(k.slabOf(box0, 1.4, PORT.z1 - 1.4, P, 3, 0.6), { tone: "mid", inner: Ln(k.sideSeam(box0, PORT.z1 - 3.4, P, 3), { tone: "faint" }) }));
    put(Dt(k.corners(box0, 1.6).map(([x, y]) => at([x, y, PORT.z1])), { size: 0.45 }));
    for (const [x, r] of [[118, 1.8], [121, 1.8], [126, 2.2], [129, 2.2]]) put(S(k.cylinder(x, 30, r, PORT.z1, 1.2, P, 16), { tone: "mid" }));
    // the inlet: the AC socket above, the two DC pins below, in one moulded surround
    const IF = G.frameAlong([INLET.x, PORT.y1, INLET.z], [0, 1, 0]);
    const DF = (x) => G.frameAlong([x, PORT.y1, INLET.z - 7.4], [0, 1, 0]);
    put(S(box(INLET.x - INLET.r - 1.4, INLET.x + INLET.r + 1.4, PORT.y1, PORT.y1 + 0.6, INLET.z - 10.6, INLET.z + INLET.r + 1.4, 2, 0.3, 2.4), { tone: "mid" }));
    put(`<path class="elv-cav" data-shade="0" d="${G.circleOf(IF, 0.7, INLET.r - 0.4, P, 48)}"/>`);
    for (const x of [INLET.x - 2.6, INLET.x + 2.6]) put(`<path class="elv-cav" data-shade="0" d="${G.circleOf(DF(x), 0.7, 1.7, P, 28)}"/>`);
    const pins = [[0, 0], [-1.6, 1.4], [1.6, 1.4], [-2.4, -0.4], [2.4, -0.4], [-1.1, -2], [1.1, -2]].map(([u, v]) => at([INLET.x + u, PORT.y1 + 0.75, INLET.z + v]));
    put(Dt(pins, { size: 0.5, tone: "mid" }));
    put(Dt([at([INLET.x - 2.6, PORT.y1 + 0.75, INLET.z - 7.4]), at([INLET.x + 2.6, PORT.y1 + 0.75, INLET.z - 7.4])], { size: 0.8, tone: "mid" }));
    put(`<circle class="elv-led" data-k="led" cx="${at([PORT.x0 + 3, PORT.y1, PORT.z1 - 3.4])[0].toFixed(1)}" cy="${at([PORT.x0 + 3, PORT.y1, PORT.z1 - 3.4])[1].toFixed(1)}" r="0.9"/>`);
    // the flap stands open on its hinge at the inlet's left
    put(S(box(INLET.x - INLET.r - 3.4, INLET.x - INLET.r - 2.8, PORT.y1 + 0.6, PORT.y1 + 10, INLET.z - 10, INLET.z + 5, 2, 0.2, 0.3), { tone: "mid" }));
    put(Dt([at([INLET.x - INLET.r - 2.8, PORT.y1 + 1.2, INLET.z + 3.6]), at([INLET.x - INLET.r - 2.8, PORT.y1 + 1.2, INLET.z - 8.6])], { size: 0.4 }));
  }
  for (const cable of dcp) for (const { piece, svg } of cable) if (!(piece.mid[1] < -20)) put(svg);
  for (const cable of acp) for (const { piece, svg } of cable) if (!(piece.mid[0] < 112 || piece.mid[2] > 60)) put(svg);


  // ================= half shaft =================
  const SH_F = FX(0, 0, ZD);
  put(S(G.solidOf([[110.4, 5], [111.4, 6.4], [115, 6.4, 1], [116, 5.4]], SH_F, P), { tone: "mid" }));
  const boot = (from, dir) => {
    const prof = [];
    const steps = [5.6, 5.8, 4.9, 5.1, 4.2, 4.3, 3.5, 3.5, 2.9];
    steps.forEach((r, i) => prof.push([from + dir * i * 1.4, r]));
    if (dir < 0) prof.reverse();
    return S(G.solidOf(prof, SH_F, P, { smooth: false }), { tone: "lo", className: "elv-rubber" });
  };
  put(boot(116, 1));
  put(S(discX(127, SHAFT.x1 - 17, SHAFT.r, 0, ZD), { tone: "mid", crease: "none" }));
  live("shaft");
  put(boot(SHAFT.x1 - 6, -1));
  put(S(G.solidOf([[SHAFT.x1 - 6, 5.4], [SHAFT.x1 - 4, 6.8, 1], [SHAFT.x1, 7, 1], [SHAFT.x1 + 2, 6.2, 1], [UPRIGHT.x0 + 0.5, 4.6]], SH_F, P), { tone: "mid" }));

  // ================= upright, hub, rollers, wheel =================
  put(S(box(ROLLER.x0 - 4, ROLLER.x0, -ROLLER_Y - 7, -ROLLER_Y + 7, 0, ROLLER.z + 4, 2, 0.4, 1), { tone: "mid" }));
  put(S(discX(ROLLER.x0, ROLLER.x1, ROLLER.r, -ROLLER_Y, ROLLER.z), { tone: "mid" }));
  live("rollerB");
  put(S(box(ROLLER.x1, ROLLER.x1 + 4, -ROLLER_Y - 7, -ROLLER_Y + 7, 0, ROLLER.z + 4, 2, 0.4, 1), { tone: "mid" }));
  put(S(box(UPRIGHT.x0 - 6, UPRIGHT.x1 + 6, -14, 14, 0, 1.6, 2, 0.4, 1.5), { tone: "lo" }), Dt([at([UPRIGHT.x0 - 3, -11, 1.6]), at([UPRIGHT.x1 + 3, 11, 1.6]), at([UPRIGHT.x0 - 3, 11, 1.6]), at([UPRIGHT.x1 + 3, -11, 1.6])], { size: 0.45 }));
  put(S(box(UPRIGHT.x0, UPRIGHT.x1, -9, 9, 1.6, ZD + 16, 2, 0.6, 1.5), { tone: "mid" }));
  put(S(discX(UPRIGHT.x0 - 1, ROTOR.x0 - 2, 9, 0, ZD), { tone: "mid" }));
  const tyre = [[WHEEL.x0 + 1, WHEEL.rim], [WHEEL.x0, WHEEL.rim + 4], [WHEEL.x0 + 0.4, 43, 1], [WHEEL.x0 + 2.4, 47.6, 1], [WHEEL.x0 + 6, WHEEL.r], [WHEEL.x1 - 6, WHEEL.r], [WHEEL.x1 - 2.4, 47.6, 1], [WHEEL.x1 - 0.4, 43, 1], [WHEEL.x1, WHEEL.rim + 4], [WHEEL.x1 - 1, WHEEL.rim]];
  put(S(G.lathe(tyre, SH_F, P, { hole: [WHEEL.x1 - 1, WHEEL.rim] }), { tone: "mid", inner: Ln(G.arcOf(SH_F, WHEEL.x0 + 9, WHEEL.r, P) + G.arcOf(SH_F, WHEEL.x1 - 9, WHEEL.r, P), { tone: "faint" }) }));
  live("tread");
  defs.push(`<clipPath id="elv-rim"><path d="${G.circleOf(SH_F, WHEEL.x1 - 1, WHEEL.rim, P, 96)}"/></clipPath>`);
  defs.push(`<clipPath id="elv-well"><path d="${G.circleOf(SH_F, WHEEL.x0 + 1, WHEEL.rim - 1, P, 96)}"/></clipPath>`);
  put(`<g clip-path="url(#elv-rim)">`);
  put(...innerFacets(SH_F, WHEEL.x0 + 1, WHEEL.x1 - 1, WHEEL.rim - 1));
  put(`<g clip-path="url(#elv-well)">`);
  put(S(discX(ROTOR.x0 - 2, ROTOR.x0, 10, 0, ZD), { tone: "mid" }));
  put(S(G.ringBand(ROTOR.x0, ROTOR.x1, 12, ROTOR.r, SH_F, P), { tone: "mid" }));
  live("rotor");
  const cal = [];
  for (const [r, a] of [[19, 118], [30, 118], [30, 152], [19, 152]]) cal.push([r * Math.cos(a * RAD), ZD + r * Math.sin(a * RAD)]);
  put(S(prismX(cal, ROTOR.x0 - 3, ROTOR.x1 + 3), { tone: "mid" }));
  put(S(discX(ROTOR.x1, WHEEL.x0 + 2, 10, 0, ZD), { tone: "mid" }));
  put(`</g>`);
  live("spokes");
  put(S(discX(WHEEL.face - 3.2, WHEEL.face + 0.8, 10.4, 0, ZD), { tone: "hi" }));
  put(S(discX(WHEEL.face + 0.8, WHEEL.face + 2.2, 4.4, 0, ZD), { tone: "mid" }));
  live("lugs");
  put(`</g>`);
  put(S(G.ringBand(WHEEL.x1 - 4, WHEEL.x1 - 0.6, WHEEL.rim - 1.4, WHEEL.rim + 1.2, SH_F, P, { hole: [WHEEL.x1 - 0.6, WHEEL.rim - 1.4] }), { tone: "hi" }));
  put(S(box(ROLLER.x0 - 4, ROLLER.x0, ROLLER_Y - 7, ROLLER_Y + 7, 0, ROLLER.z + 4, 2, 0.4, 1), { tone: "mid" }));
  put(S(discX(ROLLER.x0, ROLLER.x1, ROLLER.r, ROLLER_Y, ROLLER.z), { tone: "mid" }));
  live("rollerF");
  put(S(box(ROLLER.x1, ROLLER.x1 + 4, ROLLER_Y - 7, ROLLER_Y + 7, 0, ROLLER.z + 4, 2, 0.4, 1), { tone: "mid" }));



  // ================= the charger on its post, the cord along the bench's front edge =================
  {
    const W = CHARGER;
    const base = plan(POST.x - 9, POST.x + 9, POST.y - 7, POST.y + 7, 1.6);
    put(S(k.slabOf(base, 0, 1.2, P, 3, 0.4), { tone: "lo" }), Dt(k.corners(base, 2.2).map(([x, y]) => at([x, y, 1.2])), { size: 0.45 }));
    const post = plan(POST.x - POST.w / 2, POST.x + POST.w / 2, POST.y - POST.w / 2, POST.y + POST.w / 2, 0.8);
    put(S(k.slabOf(post, 1.2, W.z0 - 1.2, P, 3, 0.3), { tone: "mid", inner: Ln(k.sideSeam(post, 5, P, 3), { tone: "faint" }) }));
    // the cord leaves the cabinet through a gland underneath, drops beside the post and runs along the floor
    const gland = [W.x1 - 6, W.y0 + 6];
    put(S(k.cylinder(gland[0], gland[1], 2.4, W.z0 - 2.6, 2.6, P, 18), { tone: "mid" }));
    const cord = cableRoute("evse", [[gland[0], gland[1], W.z0 - 2.6], [gland[0], gland[1], 10], [gland[0] + 3, CORD_Y, 1.5], [gland[0] + 12, CORD_Y, 1.5], [CLIP[0], CORD_Y, 1.5]], 1.5);
    for (const { svg } of cord) put(svg);
    put(S(box(CLIP[0] - 1.6, CLIP[0] + 1.6, CORD_Y - 2.8, CORD_Y + 2.8, 0, 3.4, 2, 0.3, 0.6), { tone: "mid" }), Dt([at([CLIP[0], CORD_Y - 2, 3.4]), at([CLIP[0], CORD_Y + 2, 3.4])], { size: 0.35 }));
    // the cabinet: rounded case, the status ring, an AC lamp and a DC lamp, a screen, a vent
    const head = plan(W.x0, W.x1, W.y0, W.y1, 2.8);
    put(S(k.slabOf(head, W.z0, W.z1 - W.z0, P, 4, 1.2), { tone: "mid", inner: Ln(k.sideSeam(head, W.z1 - 4, P, 4) + k.sideSeam(head, W.z0 + 4, P, 4), { tone: "faint" }) }));
    const cx = (W.x0 + W.x1) / 2;
    const RF = G.frameAlong([cx, W.y1, W.z1 - 13], [0, 1, 0]);
    put(S(G.ringBand(0, 0.6, 4.4, 6.4, RF, P, { hole: [0.6, 4.4] }), { tone: "mid" }));
    put(`<path class="elv-led" data-k="led" fill-rule="evenodd" d="${G.circleOf(RF, 0.65, 6, P, 64)}${G.circleOf(RF, 0.65, 4.8, P, 64)}"/>`);
    put(`<path class="elv-dial" d="${G.circleOf(RF, 0.62, 4.4, P, 48)}"/>`);
    put(Ln(path3([[cx + 0.8, W.y1 + 0.7, RF.o[2] + 2.4], [cx - 0.9, W.y1 + 0.7, RF.o[2] - 0.2], [cx + 0.9, W.y1 + 0.7, RF.o[2] + 0.2], [cx - 0.8, W.y1 + 0.7, RF.o[2] - 2.4]]), { tone: "mid", free: true }));
    for (const [dx, key] of [[-4.4, "ledac"], [4.4, "leddc"]]) {
      const c = at([cx + dx, W.y1, W.z1 - 22.6]);
      put(`<circle class="elv-led" data-k="${key}" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="1.05"/>`);
    }
    // a single and a double tick under the lamps: one bar for AC, two for DC
    put(Ln(path3([[cx - 5.2, W.y1, W.z1 - 25], [cx - 3.6, W.y1, W.z1 - 25]]) + path3([[cx + 3.4, W.y1, W.z1 - 25], [cx + 5.4, W.y1, W.z1 - 25]]) + path3([[cx + 3.4, W.y1, W.z1 - 26], [cx + 5.4, W.y1, W.z1 - 26]]), { tone: "lo", free: true }));
    const screen = [[W.x0 + 6, W.z0 + 6], [W.x1 - 6, W.z0 + 6], [W.x1 - 6, W.z0 + 13], [W.x0 + 6, W.z0 + 13]].map(([x, z]) => [x, W.y1, z]);
    put(`<path class="elv-cav" data-shade="1" d="${ring3(screen)}"/>`);
    put(Ln([0, 1, 2].map((row) => path3([[W.x0 + 8, W.y1, W.z0 + 11 - row * 1.9], [W.x0 + (row === 1 ? 14 : 19), W.y1, W.z0 + 11 - row * 1.9]])).join(""), { tone: "lo", free: true }));
    put(Dt([[W.x0 + 2.6, W.z0 + 2.6], [W.x1 - 2.6, W.z0 + 2.6], [W.x0 + 2.6, W.z1 - 2.6], [W.x1 - 2.6, W.z1 - 2.6]].map(([x, z]) => at([x, W.y1, z])), { size: 0.45 }));
    // the holster on the cabinet's right side, where the plug hangs when it's put away
    const HF = G.frameAlong([W.x1, (W.y0 + W.y1) / 2, W.z0 + 14], [1, 0, 0]);
    put(S(G.lathe([[0, 0], [0, 4.8], [3.6, 4.8], [3.6, 3.8], [3.8, 0]], HF, P), { tone: "mid" }));
    put(`<path class="elv-cav" data-shade="0" d="${G.circleOf(HF, 3.7, 3.6, P, 40)}"/>`);
    // vent slots on the right side, closed at both ends
    for (let i = 0; i < 4; i++) {
      const z = W.z1 - 8 - i * 2.4;
      put(`<path class="elv-cav" data-shade="1" d="${ring3([[W.x1, W.y0 + 3, z], [W.x1, W.y1 - 3, z], [W.x1, W.y1 - 3, z + 0.9], [W.x1, W.y0 + 3, z + 0.9]])}"/>`);
    }
  }

  // ================= the plug, its lead to the clip =================
  {
    live("lead");
    const y0 = PORT.y1 + 0.6;
    const PF = G.frameAlong([INLET.x, y0, INLET.z], [0, 1, 0]);
    const body = S(G.lathe([[0, 0], [0, PLUG.r - 0.5], [0.5, PLUG.r, 1], [PLUG.body - 0.6, PLUG.r, 1], [PLUG.body, PLUG.r - 0.6], [PLUG.body, 0]], PF, P), { tone: "hi", inner: Ln(G.arcOf(PF, 1.6, PLUG.r, P) + G.arcOf(PF, PLUG.body - 2.2, PLUG.r, P), { tone: "lo" }) });
    // the lower lobe that carries the two DC pins
    const lobe = S(box(INLET.x - 4, INLET.x + 4, y0, y0 + PLUG.body - 1, INLET.z - 10, INLET.z - 4.2, 2, 0.6, 1.6), { tone: "hi" });
    const g0 = y0 + PLUG.body;
    const g1 = g0 + PLUG.grip;
    const grip = S(box(INLET.x - 3.2, INLET.x + 3.2, g0 - 0.4, g1, INLET.z - 9, INLET.z + 3.6, 3, 0.8, 1.4), { tone: "mid", inner: Ln(k.sideSeam(plan(INLET.x - 3.2, INLET.x + 3.2, g0 - 0.4, g1, 1.4), INLET.z - 3, P, 3), { tone: "faint" }) });
    const latch = S(box(INLET.x - 1.4, INLET.x + 1.4, g0 + 0.6, g0 + 3.6, INLET.z + 3.6, INLET.z + 4.6, 2, 0.3, 0.6), { tone: "mid" });
    const RF = G.frameAlong([INLET.x, g1, INLET.z], [0, 1, 0]);
    const relief = S(G.lathe([[0, 0], [0, 2.6], [1, 2.2, 1], [1.8, 1.7], [1.8, 0]], RF, P), { tone: "lo", className: "elv-rubber" });
    put(moving("plug", lobe + body + grip + latch + relief));
  }

  void TAU;
  void RAD;
  void V;
  void prismX;
  void ROLLER_Y;
  return { defs: defs.join(""), body: out.join(""), flows: { ...routes }, frame: f };
}
