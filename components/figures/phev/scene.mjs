// The static drawing, in painter's order, with the live slots placed where
// their parts physically sit. The figure has no shader, so it is one SVG.

import * as k from "../../iso/iso-kit.mjs";
import * as G from "../../iso/lathe.mjs";
import { tubePieces, tubeSvg } from "../../iso/tube.mjs";
import {
  P, at, BASE, ZA, ZB, ZD, C_AXIS, RB, DECK, CYL_X, BLOCK, PAN, HEAD, COVER, CAM, MAIN_R, WEB, MOUNTS, THROW,
  DRIVE_R, DRIVEN_R, MPIN_R, FPIN_R, FRING_R, DRIVE_X, CLUTCH, DAMPER, GEN, MOTOR, FINAL_X, CASE, CASE_SIDE,
  SHAFT, UPRIGHT, ROTOR, WHEEL, ROLLER, ROLLER_Y, PCU, PACK, MODULE, OBC, INLET, PLUG, CORD_Y, CLIP, POST, WALLBOX, TANK,
} from "./view.mjs";
import { BATTERY } from "./model.mjs";
import { frameOf, liveMarkup, PISTON, LOBE_X, METER, SOC_DIAL, socAngle, meterAngle, PLATES, BACKING, plateAt, PISTON_X } from "./frame.mjs";
import { S, Ln, Dt, box, plan, path3, ring3, FX, FY, FZ, prismX, prismY, discX, discZ, onY, cutSvg, cavSvg, cavLine, rect, arcPts, circle2, clipSvg, TAU, RAD, V } from "./parts.mjs";

export const REST_STATE = {
  crank: 40, drive: 0, counter: 0, motor: 0, wheel: 0, clutch: 0, plug: 1, chargeKw: 0,
  firing: false, calm: true, soc: 0.82, batteryKw: 0, genKw: 0, motorKw: 0, flow: {},
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
  return pieces.map((piece, i) => ({ piece, svg: `<g class="phv-cable" data-k="${name}.${i}">${tubeSvg(piece, { tone: "mid" })}</g>` }));
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
  parts.push(`<path class="phv-dial" d="${G.circleOf(F, s - 0.4, r - 0.9, P, 64)}"/>`);
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
  const strip = plan(-56, 104, BASE.y + BASE.d - 21, BASE.y + BASE.d - 14, 1);
  put(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  put(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
  const label = plan(-156, -114, BASE.y + BASE.d - 16, BASE.y + BASE.d - 5, 1.6);
  put(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }), Ln(k.planOutline(k.insetPlan(label, 1.6), 0.8, P), { tone: "faint" }));
  put(Ln([0, 1, 2].map((row) => k.lineOnTop([label.x + 7, label.y + 3.2 + row * 2.3], [label.x + (row === 1 ? 26 : 34), label.y + 3.2 + row * 2.3], 0.8, P)).join(""), { tone: "lo", free: true }));
  put(Dt([at([label.x + 3.2, label.y + label.d / 2, 0.8]), at([label.x + label.w - 3.2, label.y + label.d / 2, 0.8])], { size: 0.45 }));

  // ================= fuel tank and its line, which runs behind the engine to the rail =================
  const tank = TANK;
  for (const [x, y] of byDepth([[tank.x + 5, tank.y + 5], [tank.x + tank.w - 5, tank.y + 5], [tank.x + 5, tank.y + tank.d - 5], [tank.x + tank.w - 5, tank.y + tank.d - 5]])) put(S(k.cylinder(x, y, 2.4, 0, 1.4, P, 16), { tone: "lo" }));
  const tankPlan = plan(tank.x, tank.x + tank.w, tank.y, tank.y + tank.d, tank.r);
  const straps = [8, 18].map((z) => k.sideSeam(tankPlan, 1.4 + z, P, 6)).join("");
  put(S(k.slabOf(tankPlan, 1.4, tank.h, P, 6, 1.2), { tone: "mid", inner: Ln(straps, { tone: "lo" }) }));
  const gauge = [[tank.x + 8, 5], [tank.x + 11, 5], [tank.x + 11, 22], [tank.x + 8, 22]].map(([x, z]) => [x, tank.y + tank.d, z]);
  put(`<path class="iso-line" data-tone="lo" d="${ring3(gauge)}"/>`, Ln(path3([[tank.x + 8, tank.y + tank.d, 15], [tank.x + 11, tank.y + tank.d, 15]]), { tone: "mid" }));
  const pumpC = [tank.x + 19, tank.y + 11];
  put(S(k.cylinder(pumpC[0], pumpC[1], 6, 1.4 + tank.h, 1.2, P, 28), { tone: "mid" }), Dt(G.dotsOf(FZ(pumpC[0], pumpC[1], 0), 1.4 + tank.h + 1.2, 4.6, 6, P, { all: true }), { size: 0.4 }));
  put(S(k.cylinder(pumpC[0], pumpC[1], 2.4, 2.6 + tank.h, 3.2, P, 16), { tone: "mid" }));
  const capC = [tank.x + 8, tank.y + 25];
  put(S(k.cylinder(capC[0], capC[1], 4.2, 1.4 + tank.h, 2, P, 24), { tone: "mid" }), Ln(k.knurl(capC[0], capC[1], 4.2, 1.4 + tank.h, 3.4 + tank.h, 22, P), { tone: "lo" }));
  {
    const top = [pumpC[0], pumpC[1], 1.4 + tank.h + 4.4];
    const FUEL_R = 0.85;
    const fuel = G.fillet([top, [top[0], top[1], 36], [-124, -2, 36], [-121, -34, 36], [-110, -34, 36], [-110, -34, DECK + 6]], 5, 8, { P, tube: FUEL_R });
    for (const piece of tubePieces(fuel, FUEL_R, P, { maxLength: 16 })) put(tubeSvg(piece, { tone: "mid" }));
    put(Dt([at(top)], { size: 0.9, tone: "hi" }));
  }

  // ================= engine mounts =================
  for (const x of MOUNTS) {
    put(S(box(x - 9, x + 9, -24, -2, 0, 1.4, 2, 0.3), { tone: "lo" }), Dt([at([x - 7, -22, 1.4]), at([x + 7, -4, 1.4]), at([x - 7, -4, 1.4]), at([x + 7, -22, 1.4])], { size: 0.45 }));
    put(S(box(x - 6, x + 6, -20, -6, 1.4, 34, 2, 0.6, 1.2), { tone: "mid", inner: Ln(k.sideSeam(plan(x - 6, x + 6, -20, -6, 1.2), 30, P, 2), { tone: "faint" }) }));
    put(S(box(x - 5, x + 5, -19, -7, 34, 37.4, 2, 0.3), { tone: "lo", className: "phv-rubber" }));
    put(S(box(x - 6, x + 6, -20, -6, 37.4, PAN.z0, 2, 0.4, 1), { tone: "mid" }));
  }

  // ================= engine block: back half, cut on y = 0 =================
  const blockPlan = plan(BLOCK.x0, BLOCK.x1, BLOCK.y0, 0, 2);
  put(S(box(PAN.x0, PAN.x1, PAN.y0, 0, PAN.z0, PAN.z1, 3, 0.6, 2), { tone: "mid", inner: Ln(k.sideSeam(plan(PAN.x0, PAN.x1, PAN.y0, 0, 2), PAN.z1 - 1.4, P, 3), { tone: "faint" }) }));
  put(S(discX(PAN.x1, PAN.x1 + 1.6, 2, -12, PAN.z0 + 3), { tone: "mid" }));
  put(S(k.slabOf(blockPlan, BLOCK.z0, DECK - BLOCK.z0, P, 3, 0.8), { tone: "mid" }));
  const CASE_TOP = ZA + 16;
  // inside the crankcase and the pan, seen through the cut
  const cave = [[BLOCK.x0 + 3, PAN.z0 + 2], [BLOCK.x1 - 3, PAN.z0 + 2], [BLOCK.x1 - 3, CASE_TOP], [BLOCK.x0 + 3, CASE_TOP]];
  put(cavSvg(cave.map(([x, z]) => [x, BLOCK.y0 + 3, z]), 1));
  put(cavSvg(rect(BLOCK.x0 + 3, BLOCK.x1 - 3, BLOCK.y0 + 3, 0).map(([x, y]) => [x, y, PAN.z0 + 2]), "top"));
  put(cavSvg(rect(BLOCK.y0 + 3, 0, PAN.z0 + 2, CASE_TOP).map(([y, z]) => [BLOCK.x0 + 3, y, z]), 3));
  put(cavLine([[BLOCK.x0 + 3, BLOCK.y0 + 3, PAN.z0 + 2], [BLOCK.x1 - 3, BLOCK.y0 + 3, PAN.z0 + 2]]), cavLine([[BLOCK.x0 + 3, BLOCK.y0 + 3, PAN.z0 + 2], [BLOCK.x0 + 3, BLOCK.y0 + 3, CASE_TOP]]));
  // oil in the pan, seen in section
  put(`<path class="phv-oil-cut" d="${ring3(rect(PAN.x0 + 2, PAN.x1 - 2, PAN.z0 + 2, PAN.z0 + 6).map(onY(0)))}"/>`);
  for (const c of CYL_X) put(...boreFacets(c, RB, CASE_TOP, DECK));
  // the section: walls, bulkheads between the cylinders, deck, pan
  const comb = [[BLOCK.x0 + 3, BLOCK.z0], [BLOCK.x0 + 3, CASE_TOP]];
  for (const c of CYL_X) comb.push([c - RB, CASE_TOP], [c - RB, DECK], [c + RB, DECK], [c + RB, CASE_TOP]);
  comb.push([BLOCK.x1 - 3, CASE_TOP], [BLOCK.x1 - 3, BLOCK.z0]);
  put(cutSvg([[[BLOCK.x0, BLOCK.z0], [BLOCK.x1, BLOCK.z0], [BLOCK.x1, DECK], [BLOCK.x0, DECK]].map(onY(0)), comb.map(onY(0))]));
  put(cutSvg([[[PAN.x0, PAN.z0], [PAN.x1, PAN.z0], [PAN.x1, PAN.z1], [PAN.x1 - 2, PAN.z1], [PAN.x1 - 2, PAN.z0 + 2], [PAN.x0 + 2, PAN.z0 + 2], [PAN.x0 + 2, PAN.z1], [PAN.x0, PAN.z1]].map(onY(0))]));
  // water jackets in the walls between the bores
  for (let i = 0; i < 3; i++) {
    const x = (CYL_X[i] + CYL_X[i + 1]) / 2;
    put(cavSvg(rect(x - 1.1, x + 1.1, CASE_TOP + 8, DECK - 3).map(onY(0)), 0));
  }
  for (const x of [BLOCK.x0 + 1.6, BLOCK.x1 - 1.6]) put(cavSvg(rect(x - 0.7, x + 0.7, CASE_TOP + 6, DECK - 3).map(onY(0)), 0));
  // main bearing bulkheads, cut, with their caps
  const BULK = [CYL_X[0] - 11, CYL_X[0] + 11, CYL_X[1] + 11, CYL_X[2] + 11, CYL_X[3] + 11];
  for (const x of BULK) {
    const w = 1.8;
    const ring = [[x - w, BLOCK.z0 + 2], [x + w, BLOCK.z0 + 2], [x + w, CASE_TOP], [x - w, CASE_TOP]].map(onY(0));
    put(cutSvg([ring, circle2(x, ZA, MAIN_R + 0.5, 20).map(([a, b]) => [a, 0, b])]));
    put(Ln(path3([[x - w, 0, ZA - 6.8], [x + w, 0, ZA - 6.8]]), { tone: "lo" }));
  }

  // ================= crank, rods: one cylinder at a time, far end first =================
  put(S(discX(BLOCK.x0 + 0.4, BULK[0] - 1.8, MAIN_R + 1.2, 0, ZA), { tone: "mid" }));
  for (let i = 0; i < 4; i++) {
    const c = CYL_X[i];
    put(S(discX(BULK[i] - 1.8, c - WEB.gap - WEB.t, MAIN_R, 0, ZA), { tone: "mid", crease: "none" }));
    live(`web${i}a`);
    live(`rod${i}`);
    live(`web${i}b`);
    put(S(discX(c + WEB.gap + WEB.t, BULK[i + 1] + 1.8, MAIN_R, 0, ZA), { tone: "mid", crease: "none" }));
  }
  // the walls between the bores again, over the back of the crank throws
  {
    const walls = [];
    walls.push([[BLOCK.x0, CASE_TOP], [CYL_X[0] - RB, CASE_TOP], [CYL_X[0] - RB, DECK], [BLOCK.x0, DECK]]);
    for (let i = 0; i < 3; i++) walls.push([[CYL_X[i] + RB, CASE_TOP], [CYL_X[i + 1] - RB, CASE_TOP], [CYL_X[i + 1] - RB, DECK], [CYL_X[i] + RB, DECK]]);
    walls.push([[CYL_X[3] + RB, CASE_TOP], [BLOCK.x1, CASE_TOP], [BLOCK.x1, DECK], [CYL_X[3] + RB, DECK]]);
    put(cutSvg(walls.map((w) => w.map(onY(0)))));
    for (let i = 0; i < 3; i++) {
      const x = (CYL_X[i] + CYL_X[i + 1]) / 2;
      put(cavSvg(rect(x - 1.1, x + 1.1, CASE_TOP + 8, DECK - 3).map(onY(0)), 0));
    }
    for (const x of [BLOCK.x0 + 1.6, BLOCK.x1 - 1.6]) put(cavSvg(rect(x - 0.7, x + 0.7, CASE_TOP + 6, DECK - 3).map(onY(0)), 0));
  }
  // pistons, each with three ring grooves and a pin boss
  const crown = PISTON.crown;
  for (let i = 0; i < 4; i++) {
    const c = CYL_X[i];
    const seams = [crown - 1.6, crown - 2.9, crown - 4.2].map((z) => k.sideArc(c, 0, 8.7, z, P, 28)).join("");
    const piston = S(k.cylinder(c, 0, 8.7, crown - 12, 12, P, 40), { tone: "hi", inner: Ln(seams, { tone: "lo" }) }) + Ln(k.ring(c, 0, 6.2, crown, P, 32), { tone: "faint" });
    put(moving(`piston${i}`, piston));
  }

  // ================= cylinder head, cut =================
  put(S(k.slabOf(plan(HEAD.x0, HEAD.x1, HEAD.y0, 0, 2), HEAD.z0, HEAD.z1 - HEAD.z0, P, 3, 0.8), { tone: "mid" }));
  {
    const pieces = [];
    const z0 = HEAD.z0;
    const roof = z0 + 3.6;
    const well = 2.2;
    const left = (c) => [[c - 8.2, z0], [c - 8.2, z0 + 2.2], [c - 6.6, roof], [c - well, roof], [c - well, HEAD.z1]];
    const right = (c) => [[c + well, HEAD.z1], [c + well, roof], [c + 6.6, roof], [c + 8.2, z0 + 2.2], [c + 8.2, z0]];
    pieces.push([[HEAD.x0, HEAD.z1], [HEAD.x0, z0], ...left(CYL_X[0])]);
    for (let i = 0; i < 3; i++) pieces.push([...right(CYL_X[i]), ...left(CYL_X[i + 1])]);
    pieces.push([...right(CYL_X[3]), [HEAD.x1, z0], [HEAD.x1, HEAD.z1]]);
    // the chambers' back halves, behind the cut
    for (const c of CYL_X) put(cavSvg([[c - 8.2, -6, z0], [c + 8.2, -6, z0], [c + 8.2, -6, z0 + 2.2], [c + 6.6, -4, roof], [c - 6.6, -4, roof], [c - 8.2, -6, z0 + 2.2]], 1));
    put(cutSvg(pieces.map((piece) => piece.map(onY(0)))));
    // coolant passages over the chambers
    for (let i = 0; i < 5; i++) {
      const x0 = i === 0 ? HEAD.x0 + 2 : CYL_X[i - 1] + 4;
      const x1 = i === 4 ? HEAD.x1 - 2 : CYL_X[i] - 4;
      put(cavSvg([[x0, HEAD.z0 + 6.4], [x1, HEAD.z0 + 6.4], [x1, HEAD.z0 + 11.6], [x0, HEAD.z0 + 11.6]].map(onY(0)), 0));
    }
    put(Ln(path3([[HEAD.x0, 0, HEAD.z0], [HEAD.x1, 0, HEAD.z0]]), { tone: "lo" }));
  }

  // ================= cam cover with the intake camshaft inside =================
  put(S(k.slabOf(plan(COVER.x0, COVER.x1, COVER.y0, 0, 2.5), COVER.z0, COVER.z1 - COVER.z0, P, 3, 0.8), { tone: "mid" }));
  const coverIn = { x0: COVER.x0 + 2, x1: COVER.x1 - 2, z0: COVER.z0, z1: COVER.z1 - 2 };
  put(cavSvg(rect(coverIn.x0, coverIn.x1, coverIn.z0, coverIn.z1).map(([x, z]) => [x, COVER.y0 + 2, z]), 1));
  put(cavSvg(rect(coverIn.x0, coverIn.x1, COVER.y0 + 2, 0).map(([x, y]) => [x, y, coverIn.z0]), "top"));
  put(cavSvg(rect(COVER.y0 + 2, 0, coverIn.z0, coverIn.z1).map(([y, z]) => [coverIn.x0, y, z]), 3));
  // cam bearing caps between the lobes
  for (const c of CYL_X) put(S(box(c - 1.3, c + 1.3, CAM.y - 4, CAM.y + 4, COVER.z0, CAM.z - 0.4, 2, 0.2), { tone: "mid" }));
  put(S(discX(coverIn.x0, coverIn.x1, 1.9, CAM.y, CAM.z), { tone: "mid", crease: "none" }));
  for (let i = 0; i < 4; i++) {
    live(`lobe${i}a`);
    live(`lobe${i}b`);
  }
  for (const c of CYL_X) put(S(box(c - 1.3, c + 1.3, CAM.y - 4, CAM.y + 4, CAM.z + 0.4, CAM.z + 3.4, 2, 0.2), { tone: "mid" }), Dt([at([c, CAM.y - 2.6, CAM.z + 3.4]), at([c, CAM.y + 2.6, CAM.z + 3.4])], { size: 0.4 }));
  // the cover's section, with a plug tube at each cylinder
  {
    const pieces = [];
    const t = 3.2;
    const tubeL = (c) => [[c - t, COVER.z0], [c - t, COVER.z1]];
    pieces.push([[COVER.x0, COVER.z0], [coverIn.x0, COVER.z0], [coverIn.x0, coverIn.z1], [CYL_X[0] - t, coverIn.z1], [CYL_X[0] - t, COVER.z1], [COVER.x0 + 2.5, COVER.z1], [COVER.x0, COVER.z1 - 2.5]]);
    for (let i = 0; i < 3; i++) pieces.push([[CYL_X[i] + t, COVER.z1], [CYL_X[i] + t, coverIn.z1], [CYL_X[i + 1] - t, coverIn.z1], [CYL_X[i + 1] - t, COVER.z1]]);
    pieces.push([[CYL_X[3] + t, COVER.z1], [CYL_X[3] + t, coverIn.z1], [coverIn.x1, coverIn.z1], [coverIn.x1, COVER.z0], [COVER.x1, COVER.z0], [COVER.x1, COVER.z1 - 2.5], [COVER.x1 - 2.5, COVER.z1]]);
    for (const c of CYL_X) pieces.push([[c - t, COVER.z0], [c - 2.2, COVER.z0], [c - 2.2, COVER.z1], [c - t, COVER.z1]], [[c + 2.2, COVER.z0], [c + t, COVER.z0], [c + t, COVER.z1], [c + 2.2, COVER.z1]]);
    void tubeL;
    put(cutSvg(pieces.map((piece) => piece.map(onY(0)))));
  }
  // spark plugs down the wells, a coil on each, with the spark at the gap
  for (let i = 0; i < 4; i++) {
    const c = CYL_X[i];
    const F = FZ(c, 0, 0);
    put(S(G.disc(HEAD.z0 + 3.2, HEAD.z0 + 9, 1.3, F, P), { tone: "mid", crease: "none" }));
    put(S(G.lathe([[HEAD.z0 + 9, 0], [HEAD.z0 + 9, 2.1], [HEAD.z0 + 12, 2.1], [HEAD.z0 + 12, 1.5], [COVER.z1 + 0.5, 1.5], [COVER.z1 + 0.5, 0]], F, P), { tone: "hi" }));
    put(`<g data-k="spark${i}" style="opacity:${f[`spark${i}@o`]}"><circle class="phv-spark" cx="${at([c, 0, HEAD.z0 + 3])[0].toFixed(1)}" cy="${at([c, 0, HEAD.z0 + 3])[1].toFixed(1)}" r="2.2"/><circle class="phv-spark-core" cx="${at([c, 0, HEAD.z0 + 3])[0].toFixed(1)}" cy="${at([c, 0, HEAD.z0 + 3])[1].toFixed(1)}" r="0.9"/></g>`);
    put(S(G.disc(COVER.z1, COVER.z1 + 9, 3.1, F, P), { tone: "mid", inner: Ln(G.arcOf(F, COVER.z1 + 3, 3.1, P), { tone: "faint" }) }));
    put(S(box(c - 2.2, c + 2.2, -9.4, -3, COVER.z1 + 4.6, COVER.z1 + 8.4, 2, 0.3), { tone: "mid" }), Dt([at([c, -8.4, COVER.z1 + 8.4])], { size: 0.45 }));
  }
  // a low harness rail along the coils
  put(S(box(CYL_X[0] - 4, CYL_X[3] + 4, -13, -9.4, COVER.z1, COVER.z1 + 3, 2, 0.3, 1), { tone: "lo" }));

  // ================= damper and bell =================
  const A_F = FX(0, 0, ZA);
  put(S(discX(BLOCK.x1 - 1, DAMPER.x0, 5.4, 0, ZA), { tone: "mid" }));
  const outer = CASE_SIDE;
  const innerSide = inset(outer, CASE.wall);
  const wall = (i) => [outer[i], outer[(i + 1) % outer.length], innerSide[(i + 1) % outer.length], innerSide[i]];
  const wallSolid = (i, cls = "") => S(prismY(wall(i), CASE.y0, 0), { tone: "mid", className: cls });
  const wallCut = (i) => cutSvg([wall(i).map(onY(0))]);
  // back plate and the walls the parts stand in front of
  // the back wall's inside face (the walls' own tops cover its top edge)
  put(cavSvg(innerSide.map(([x, z]) => [x, CASE.y0 + CASE.wall, z]), 1));
  put(wallSolid(7, "phv-cavsolid"), wallCut(7), wallSolid(8, "phv-cavsolid"), wallCut(8), wallSolid(9, "phv-cavsolid"), wallCut(9));
  // the bell's left wall carries the crank's seal
  put(wallSolid(0, "phv-cavsolid"));
  put(cutSvg([[[-25, 40], [-22, 40], [-22, ZA - 6], [-25, ZA - 6]].map(onY(0)), [[-25, ZA + 6], [-22, ZA + 6], [-22, 101], [-25, 101]].map(onY(0))]));
  put(S(discX(DAMPER.x0, DAMPER.x1, DAMPER.r, 0, ZA, { bevel: 0.5 }), { tone: "mid", inner: Ln(G.arcOf(A_F, DAMPER.x1 - 0.1, DAMPER.r - 4, P, { least: -1 }), { tone: "faint" }) }));
  live("damper");
  put(S(discX(DAMPER.x1, GEN.x0 - GEN.turn - 0.4, 2.8, 0, ZA), { tone: "mid", crease: "none" }));

  // ================= the generator on the engine's own shaft =================
  {
    const F = A_F;
    const laminations = [];
    for (let x = GEN.x0 + 1.2; x < GEN.x1 - 0.6; x += 1.2) laminations.push(G.arcOf(F, x, GEN.r, P));
    put(`<g data-k="gen" class="phv-wind">`);
    put(S(G.ringBand(GEN.x0 - GEN.turn, GEN.x0, GEN.bore + 0.6, GEN.r - 3.4, F, P), { tone: "mid", className: "phv-copper" }));
    put(`</g>`);
    put(S(G.disc(GEN.x0, GEN.x1, GEN.r, F, P), { tone: "mid", inner: Ln(laminations.join(""), { tone: "faint" }) }));
    put(Dt(G.dotsOf(F, GEN.x1, GEN.r - 1.6, 12, P, { all: true, phase: 0.2 }), { size: 0.4 }));
    put(`<g data-k="gen" class="phv-wind">`);
    put(S(G.ringBand(GEN.x1, GEN.x1 + GEN.turn, GEN.bore + 0.6, GEN.r - 3.4, F, P, { hole: [GEN.x1 + GEN.turn, GEN.bore + 0.6] }), { tone: "mid", className: "phv-copper" }));
    put(`</g>`);
    // the rotor's end, seen inside the windings, then the engine shaft on to the clutch
    put(S(G.disc(GEN.x1, GEN.x1 + 0.8, GEN.bore - 0.4, F, P), { tone: "mid" }));
    live("gen.end");
    put(S(discX(GEN.x1 + 0.8, DRIVE_X.x0 - 1.6, 3.2, 0, ZA), { tone: "mid", crease: "none" }));
    live("eshaft");
  }

  // ================= the traction motor: its own axis in front of the counter gear, on cradles =================
  const B_F = FX(0, 0, ZB);
  const C_F = FX(0, C_AXIS[0], C_AXIS[1]);
  const D_F = FX(0, 0, ZD);
  const MOTOR_LOW = C_AXIS[1] - MOTOR.r;
  for (const x of [MOTOR.x0 + 4, MOTOR.x1 - 4]) {
    put(S(box(x - 5, x + 5, C_AXIS[0] - 12, C_AXIS[0] + 12, 0, 1.4, 2, 0.3, 0.8), { tone: "lo" }), Dt([at([x - 3.4, C_AXIS[0] - 10, 1.4]), at([x + 3.4, C_AXIS[0] + 10, 1.4])], { size: 0.45 }));
    put(S(box(x - 3, x + 3, C_AXIS[0] - 10, C_AXIS[0] + 10, 1.4, MOTOR_LOW + 0.6, 2, 0.5, 0.8), { tone: "mid" }));
  }
  {
    const F = C_F;
    put(`<g data-k="motor" class="phv-wind">`);
    put(S(G.ringBand(MOTOR.x0 - MOTOR.turn, MOTOR.x0, MOTOR.bore + 0.6, MOTOR.r - 3.2, F, P), { tone: "mid", className: "phv-copper" }));
    put(`</g>`);
    const laminations = [];
    for (let x = MOTOR.x0 + 1.2; x < MOTOR.x1 - 0.6; x += 1.2) laminations.push(G.arcOf(F, x, MOTOR.r, P));
    put(S(G.disc(MOTOR.x0, MOTOR.x1, MOTOR.r, F, P), { tone: "mid", inner: Ln(laminations.join(""), { tone: "faint" }) }));
    put(Dt(G.dotsOf(F, MOTOR.x1, MOTOR.r - 1.6, 14, P, { all: true, phase: 0.3 }), { size: 0.4 }));
    put(`<g data-k="motor" class="phv-wind">`);
    put(S(G.ringBand(MOTOR.x1, MOTOR.x1 + MOTOR.turn, MOTOR.bore + 0.6, MOTOR.r - 3.2, F, P, { hole: [MOTOR.x1 + MOTOR.turn, MOTOR.bore + 0.6] }), { tone: "mid", className: "phv-copper" }));
    put(`</g>`);
    put(S(G.disc(MOTOR.x1, MOTOR.x1 + 0.9, MOTOR.bore - 0.3, F, P), { tone: "mid" }));
    live("motor.end");
    // the phase leads' terminal box on a pad on top of the stator
    const pad = G.frameAlong([MOTOR.x0 + 7, C_AXIS[0], C_AXIS[1]], [0, 0, 1]);
    put(S(G.saddleOf(pad, 3.6, MOTOR.r, MOTOR.r + 2.2, P), { tone: "mid" }));
    put(S(box(MOTOR.x0 + 2, MOTOR.x0 + 12, C_AXIS[0] - 4.6, C_AXIS[0] + 4.6, C_AXIS[1] + MOTOR.r + 2.2, C_AXIS[1] + MOTOR.r + 6, 2, 0.4, 0.8), { tone: "mid" }), Dt([at([MOTOR.x0 + 3.2, C_AXIS[0] - 3.6, C_AXIS[1] + MOTOR.r + 6]), at([MOTOR.x0 + 10.8, C_AXIS[0] + 3.6, C_AXIS[1] + MOTOR.r + 6])], { size: 0.4 }));
    put(S(G.disc(MOTOR.x1 + 0.9, DRIVE_X.x0, 2.6, F, P), { tone: "mid", crease: "none" }));
  }

  // ================= the counter gear and the motor's pinion =================
  put(S(discX(19, DRIVE_X.x0, 3.2, 0, ZB), { tone: "mid", crease: "none" }));
  put(S(discX(DRIVE_X.x0, DRIVE_X.x1, DRIVEN_R - 0.5, 0, ZB), { tone: "hi", inner: Ln(G.circleOf(B_F, DRIVE_X.x1, DRIVEN_R - 4.2, P, 96) + G.circleOf(B_F, DRIVE_X.x1, 7.2, P, 64), { tone: "faint" }) }));
  live("driven");
  put(S(discX(DRIVE_X.x1, FINAL_X.x0, 3.2, 0, ZB), { tone: "mid", crease: "none" }));
  put(S(discX(DRIVE_X.x0, DRIVE_X.x1, MPIN_R - 0.5, C_AXIS[0], C_AXIS[1]), { tone: "hi" }));
  live("mpin");
  put(S(discX(DRIVE_X.x1, DRIVE_X.x1 + 1.4, 2.2, C_AXIS[0], C_AXIS[1]), { tone: "mid" }));

  // ================= the output gear on its sleeve =================
  put(S(discX(DRIVE_X.x0 - 1.6, DRIVE_X.x0, 5.4, 0, ZA), { tone: "mid" }));
  put(S(discX(DRIVE_X.x0, DRIVE_X.x1, DRIVE_R - 0.5, 0, ZA), { tone: "hi", inner: Ln(G.circleOf(A_F, DRIVE_X.x1, DRIVE_R - 4.4, P, 96), { tone: "faint" }) }));
  live("drive");

  // ================= the lock-up clutch: basket, backing ring, plates, piston =================
  {
    const C = CLUTCH;
    live("fingers.back");
    // the sleeve's hub, which carries the friction plates
    put(S(discX(DRIVE_X.x1, C.x1 - C.back - 1.2, 5.6, 0, ZA), { tone: "mid", crease: "none" }));
    put(S(G.ringBand(BACKING[0], BACKING[1], C.steel[0], C.steel[1] + 0.4, A_F, P, { hole: [BACKING[1], C.steel[0]] }), { tone: "mid" }));
    // the plate pack, nearest the backing ring first: steel plates on the basket, friction plates on the hub
    for (let i = 0; i < PLATES; i++) {
      const [x0, x1] = plateAt(i);
      const steel = i % 2 === 1;
      const [r0, r1] = steel ? C.steel : C.friction;
      const face = steel ? "" : Ln(G.circleOf(A_F, x1, r1 - 1.6, P, 64), { tone: "faint" });
      put(moving(`plate${i}`, S(G.ringBand(x0, x1, r0, r1, A_F, P, { hole: [x1, r0] }), { tone: steel ? "mid" : "hi", crease: "none", inner: face })));
    }
    // the apply piston, pressed by oil from behind
    const [p0, p1] = PISTON_X;
    put(moving("cpiston", S(G.ringBand(p0, p1, 5.8, C.r - 1.2, A_F, P, { hole: [p1, 5.8] }), { tone: "mid" })));
    live("fingers.front");
    // the basket's closed end, on the engine shaft
    put(S(discX(C.x1 - C.back, C.x1, C.r, 0, ZA, { bevel: 0.4 }), { tone: "mid", inner: Ln(G.circleOf(A_F, C.x1, C.r - 2.4, P, 96), { tone: "faint" }) }));
    live("basket");
    put(S(discX(C.x1, C.x1 + 1.6, 4.4, 0, ZA), { tone: "mid" }), S(discX(C.x1 + 1.6, C.x1 + 2.6, 2.6, 0, ZA), { tone: "mid" }));
  }

  // ================= case: the top wall over MG1 and the planetary =================
  put(wallSolid(1), wallCut(1));
  put(wallSolid(2), wallCut(2), wallSolid(3), wallCut(3), wallSolid(4), wallCut(4));
  {
    // three cast ribs across the slant, a breather on the step, bolts along the top flats
    const [a, b] = [outer[2], outer[3]];
    for (const t of [0.28, 0.52, 0.76]) {
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[1] + (b[1] - a[1]) * t;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      const n = [-d[1], d[0]];
      const rib = [[x - d[0] * 0.9, z - d[1] * 0.9], [x + d[0] * 0.9, z + d[1] * 0.9], [x + d[0] * 0.9 + n[0] * 1.6, z + d[1] * 0.9 + n[1] * 1.6], [x - d[0] * 0.9 + n[0] * 1.6, z - d[1] * 0.9 + n[1] * 1.6]];
      put(S(prismY(rib, CASE.y0 + 1, -1), { tone: "mid" }));
    }
    put(S(k.cylinder(68, -12, 1.8, 76, 2.4, P, 16), { tone: "mid" }), S(k.cylinder(68, -12, 2.6, 78.4, 1, P, 16), { tone: "mid" }));
    put(Dt([-20, -8, 4].map((x) => at([x, -1.6, 101])).concat([86, 96].map((x) => at([x, -1.6, 84]))), { size: 0.45 }));
  }

  // ================= final drive and differential =================
  put(S(discX(FINAL_X.x0, FINAL_X.x1, FPIN_R - 0.5, 0, ZB), { tone: "hi" }));
  live("fpin");
  put(S(discX(FINAL_X.x1, 104.6, 3.2, 0, ZB), { tone: "mid", crease: "none" }));
  put(S(G.ringBand(FINAL_X.x0, FINAL_X.x1, 12, FRING_R - 0.5, D_F, P), { tone: "hi" }));
  live("fring");
  put(S(G.solidOf([[FINAL_X.x1, 12.6], [FINAL_X.x1 + 2, 12.6], [FINAL_X.x1 + 4, 11.4, 1], [FINAL_X.x1 + 8, 10, 1], [FINAL_X.x1 + 11, 8.6], [FINAL_X.x1 + 11, 7.4], [FINAL_X.x1 + 12.6, 7.4], [FINAL_X.x1 + 12.6, 6], [106, 6]], D_F, P), { tone: "mid" }));
  live("diff");
  put(wallSolid(5), wallCut(5), wallSolid(6), wallCut(6));
  // the case's +x end: a bolted cover with the axle seal, a drain plug and an ID plate
  {
    const E = 108;
    const face = (y, z) => [E, y, z];
    put(`<path class="iso-line" data-tone="lo" d="${ring3([face(-29.6, 6.4), face(-2.4, 6.4), face(-2.4, 81.6), face(-29.6, 81.6)])}"/>`);
    const bolts = [];
    for (let i = 0; i <= 6; i++) bolts.push(face(-28.2, 8 + (i / 6) * 72), face(-3.8, 8 + (i / 6) * 72));
    for (let i = 1; i < 4; i++) bolts.push(face(-28.2 + (i / 4) * 24.4, 8), face(-28.2 + (i / 4) * 24.4, 80));
    put(Dt(bolts.map(at), { size: 0.5 }));
    put(S(G.ringBand(E, E + 2.4, 3.4, 7.4, D_F, P), { tone: "mid" }));
    put(S(discX(E, E + 1.4, 1.8, -20, 10), { tone: "mid" }));
    const idp = [face(-26, 30), face(-12, 30), face(-12, 38), face(-26, 38)];
    put(`<path class="phv-plate" d="${ring3(idp.map(([x, y, z]) => [x + 0.3, y, z]))}"/>`);
    put(Ln([0, 1, 2].map((row) => path3([[E + 0.3, -24, 36 - row * 2.2], [E + 0.3, row === 1 ? -17 : -14.4, 36 - row * 2.2]])).join(""), { tone: "lo", free: true }));
    put(Dt([at([E + 0.3, -25, 31.2]), at([E + 0.3, -13, 31.2])], { size: 0.4 }));
  }

  // ================= PCU on the case, its bus bars down to MG1 =================
  {
    const lid = plan(PCU.x0, PCU.x1, PCU.y0, PCU.y1, 2.4);
    for (const [x, y] of byDepth([[PCU.x0 + 4, PCU.y0 + 5], [PCU.x1 - 4, PCU.y0 + 5], [PCU.x0 + 4, PCU.y1 - 5], [PCU.x1 - 4, PCU.y1 - 5]])) put(S(k.cylinder(x, y, 2.4, 101, 3, P, 16), { tone: "lo" }));
    put(S(k.slabOf(lid, 104, PCU.z1 - 4 - 104, P, 4, 0.6), { tone: "mid", inner: Ln(k.sideSeam(lid, 110, P, 4), { tone: "faint" }) }));
    put(S(k.slabOf(k.insetPlan(lid, -0.4), PCU.z1 - 4, 4, P, 4, 0.8), { tone: "mid" }));
    const lidScrews = k.corners(lid, 3.4);
    put(Dt(lidScrews.map(([x, y]) => at([x, y, PCU.z1])), { size: 0.5 }));
    // cooling ribs on the lid
    const ribs = [];
    for (let x = PCU.x0 + 9; x <= PCU.x1 - 9; x += 3) ribs.push(k.planOutline(plan(x - 0.6, x + 0.6, PCU.y0 + 6, PCU.y1 - 13, 0.6), PCU.z1, P, 2));
    put(Ln(ribs.join(""), { tone: "lo" }));
    const tag = plan(PCU.x0 + 6, PCU.x0 + 22, PCU.y1 - 10, PCU.y1 - 4, 1);
    put(S(k.slabOf(tag, PCU.z1, 0.5, P, 3), { tone: "lo", crease: "none" }), Ln([0, 1].map((row) => k.lineOnTop([tag.x + 2.4, tag.y + 2 + row * 2], [tag.x + (row ? 9 : 13), tag.y + 2 + row * 2], PCU.z1 + 0.5, P)).join(""), { tone: "lo", free: true }));
    // the power meter on the front face
    const MF = G.frameAlong([METER.x, PCU.y1, METER.z], [0, 1, 0]);
    void MF;
    const MFD = G.frameOf([METER.x, PCU.y1, METER.z], [0, 1, 0], [0, 0, 1], [1, 0, 0]);
    const marks = [];
    for (let i = 0; i <= 12; i++) marks.push(-METER.span / 2 + (i / 12) * METER.span);
    put(dialFace(MFD, 1.2, METER.r, marks, [0, 6, 12]));
    // centre-zero: the zero mark stands out
    put(Ln(k.pathOf([at(G.pointOf(MFD, 0.9, METER.r - 1.15, 0)), at(G.pointOf(MFD, 0.9, METER.r - 3.2, 0))]), { tone: "hi" }));
    live("meter");
    put(Dt([at(G.pointOf(MFD, 1.3, 0, 0))], { size: 0.9, tone: "hi" }));
    // HV connectors: the battery's pair on the +x face, the motor's three on the front
    for (const y of [-24, -20.4]) put(S(discX(PCU.x1, PCU.x1 + 1.6, 1.5, y, 108.4), { tone: "mid" }));
    for (const x of [6.2, 9.4, 12.6]) put(S(G.disc(0, 1.6, 1.3, G.frameAlong([x, PCU.y1, 107.4], [0, 1, 0]), P), { tone: "mid" }));
    // the generator's terminal block and three bus bars from the PCU's front face
    put(S(box(-20, -9, -9, -2, 101, 104.6, 2, 0.4, 0.8), { tone: "mid" }));
    for (const x of [-17.4, -14.5, -11.6]) put(S(k.cylinder(x, -5.5, 0.9, 104.6, 0.8, P, 12), { tone: "lo" }));
  }

  // ================= cables: MG1, MG2 and the battery's DC pair =================
  const gen = [-11.6, -14.5, -17.4].map((x, i) => cableRoute(`genc${i}`, [[-1 - i * 1.6, PCU.y1, 106.4 - i * 0.6], [-1 - i * 1.6, PCU.y1 + 1.8, 106.4 - i * 0.6], [x + 1.2, -1.8, 106.4 - i * 0.6], [x, -5.5, 106.4 - i * 0.6], [x, -5.5, 105.4]], 0.7));
  const mot = [6.2, 9.4, 12.6].map((x, i) => cableRoute(`motc${i}`, [[x, PCU.y1 + 1.6, 107.4], [x, 4, 107.4], [x, C_AXIS[0] + 1.4 - i * 1.2, 96], [x, C_AXIS[0] + 1.4 - i * 1.2, 64], [MOTOR.x0 + 4 + i * 3, C_AXIS[0] + 1.4 - i * 1.2, 58], [MOTOR.x0 + 4 + i * 3, C_AXIS[0] + 1.4 - i * 1.2, C_AXIS[1] + MOTOR.r + 6]], 0.9));
  // the pack's DC pair: up from the junction box, along the case's top and down its slant to the inverter
  const dc = [-24, -20.4].map((y, i) => cableRoute(`dc${i}`, [[MODULE.x0 - 8 - i * 3.4, 30, 24.6], [MODULE.x0 - 8 - i * 3.4, 30, 32], [114 - i * 0.2, 12, 32], [114 - i * 0.2, y, 32], [114 - i * 0.2, y, 86], [100, y, 86], [80, y, 86], [73, y, 78.6], [64.6, y, 78.6], [49.4, y, 103.2], [PCU.x1 + 3.6, y, 108.4], [PCU.x1 + 1.6, y, 108.4]], 1.05));
  for (const cable of gen) for (const { svg } of cable) put(svg);
  for (const cable of mot) for (const { svg } of cable) put(svg);
  for (const cable of dc) for (const { piece, svg } of cable) if (piece.mid[0] < 112 || piece.mid[2] > 60) put(svg);

  // ================= battery pack: 36 blade modules on a tray, the charger at its far end =================
  {
    const tray = plan(PACK.x0, PACK.x1, PACK.y0, PACK.y1, 2);
    for (const [x, y] of byDepth([[PACK.x0 + 6, PACK.y0 + 6], [PACK.x1 - 6, PACK.y0 + 6], [PACK.x0 + 6, PACK.y1 - 6], [PACK.x1 - 6, PACK.y1 - 6]])) put(S(k.cylinder(x, y, 3, 0, 1.6, P, 16), { tone: "lo" }));
    put(S(k.slabOf(tray, PACK.z0, PACK.z1 - PACK.z0, P, 3, 0.6), { tone: "lo" }));
    // junction box at the -x end: contactors, the service plug, the charge gauge on its front
    const jb = plan(PACK.x0 + 1.4, MODULE.x0 - 3, PACK.y0 + 2, PACK.y1 - 2, 1.2);
    put(S(k.slabOf(jb, PACK.z1, 24 - PACK.z1, P, 3, 0.6), { tone: "mid", inner: Ln(k.sideSeam(jb, 20.4, P, 3), { tone: "faint" }) }));
    put(Dt(k.corners(jb, 1.8).map(([x, y]) => at([x, y, 24])), { size: 0.45 }));
    put(S(box(jb.x + 2, jb.x + 7, jb.y + 3, jb.y + 13, 24, 27.4, 2, 0.3, 0.8), { tone: "hi" }));
    put(S(box(jb.x + 3, jb.x + 6, jb.y + 6, jb.y + 10, 27.4, 29, 2, 0.2, 0.5), { tone: "mid" }));
    for (const y of [30, 33.4]) put(S(k.cylinder(MODULE.x0 - 8 - (y - 30), y, 1.6, 24, 0.6, P, 14), { tone: "lo" }));
    // end plates and the tie rods that clamp the stack
    put(S(box(MODULE.x0 - 1.6, MODULE.x0, MODULE.y0 - 1, MODULE.y1 + 1, PACK.z1, MODULE.z1 + 1, 2, 0.4, 0.6), { tone: "mid" }));
    const pitch = MODULE.t + MODULE.gap;
    const count = BATTERY.modules;
    const stackEnd = MODULE.x0 + pitch * count - MODULE.gap;
    for (let i = 0; i < count; i++) {
      const x0 = MODULE.x0 + i * pitch;
      const m = plan(x0, x0 + MODULE.t, MODULE.y0, MODULE.y1, 0.3);
      put(S(k.slabOf(m, MODULE.z0, MODULE.z1 - MODULE.z0, P, 2), { tone: "mid", crease: "faint" }));
      // each blade's two terminals, one at each end
      put(Dt([at([x0 + MODULE.t / 2, MODULE.y0 + 3, MODULE.z1]), at([x0 + MODULE.t / 2, MODULE.y1 - 3, MODULE.z1])], { size: 0.4, tone: "lo" }));
    }
    // bus bars join the blades in series, alternating ends
    for (let i = 0; i < count - 1; i++) {
      const x0 = MODULE.x0 + i * pitch + MODULE.t / 2;
      const y = i % 2 ? MODULE.y1 - 3 : MODULE.y0 + 3;
      put(S(k.slabOf(plan(x0 - 0.3, x0 + pitch + 0.3, y - 0.9, y + 0.9, 0.3), MODULE.z1, 0.5, P, 2), { tone: "lo", crease: "none" }));
    }
    put(S(box(stackEnd, stackEnd + 1.6, MODULE.y0 - 1, MODULE.y1 + 1, PACK.z1, MODULE.z1 + 1, 2, 0.4, 0.6), { tone: "mid" }));
    for (const y of [MODULE.y0 - 0.2, MODULE.y1 + 0.2]) put(S(discX(MODULE.x0 - 1.6, stackEnd + 1.6, 0.7, y, MODULE.z1 - 3), { tone: "mid", crease: "none" }));
    // the state-of-charge gauge on the junction box's front face
    const SF = G.frameOf([SOC_DIAL.x, PACK.y1 - 2, SOC_DIAL.z], [0, 1, 0], [0, 0, 1], [1, 0, 0]);
    const marks = [];
    for (let i = 0; i <= 8; i++) marks.push(-60 + i * 15);
    put(dialFace(SF, 1.2, SOC_DIAL.r, marks, [0, 4, 8]));
    live("soc");
    put(Dt([at(G.pointOf(SF, 1.3, 0, 0))], { size: 0.85, tone: "hi" }));

    // the on-board charger: a finned case, the charge inlet and its open flap on the front
    const obc = plan(OBC.x0, OBC.x1, OBC.y0, OBC.y1, 1.6);
    put(S(k.slabOf(obc, OBC.z0, OBC.z1 - OBC.z0, P, 3, 0.6), { tone: "mid", inner: Ln(k.sideSeam(obc, OBC.z1 - 3.4, P, 3), { tone: "faint" }) }));
    const fins = [];
    for (let y = OBC.y0 + 4; y <= OBC.y1 - 4; y += 2.6) fins.push(S(k.slabOf(plan(OBC.x0 + 3, OBC.x1 - 3, y - 0.45, y + 0.45, 0.3), OBC.z1, 1.8, P, 2), { tone: "mid", crease: "none" }));
    put(...fins);
    put(Dt(k.corners(obc, 1.6).map(([x, y]) => at([x, y, OBC.z1])), { size: 0.45 }));
    // the bus bars from the charger to the end of the stack
    for (const y of [MODULE.y0 + 6, MODULE.y0 + 10]) put(S(k.slabOf(plan(stackEnd + 0.4, OBC.x0 + 1.4, y - 0.9, y + 0.9, 0.3), MODULE.z1 + 1, 0.5, P, 2), { tone: "lo", crease: "none" }), Dt([at([OBC.x0 + 0.8, y, MODULE.z1 + 1.5])], { size: 0.4 }));
    // front face: the inlet's socket ring and pins, a charge lamp, screws
    const IF = G.frameAlong([INLET.x, OBC.y1, INLET.z], [0, 1, 0]);
    put(S(G.ringBand(0, 0.9, INLET.r - 0.6, INLET.r + 1.2, IF, P, { hole: [0.9, INLET.r - 0.6] }), { tone: "mid" }));
    put(`<path class="phv-cav" data-shade="0" d="${G.circleOf(IF, 0.1, INLET.r - 0.6, P, 48)}"/>`);
    const pins = [[0, 0], [-1.6, 1.4], [1.6, 1.4], [-2.4, -0.4], [2.4, -0.4], [-1.1, -2], [1.1, -2]].map(([u, v]) => at([INLET.x + u, OBC.y1 + 0.15, INLET.z + v]));
    put(Dt(pins, { size: 0.5, tone: "mid" }));
    put(`<circle class="phv-led" data-k="led" cx="${at([OBC.x0 + 3.4, OBC.y1, OBC.z1 - 3.4])[0].toFixed(1)}" cy="${at([OBC.x0 + 3.4, OBC.y1, OBC.z1 - 3.4])[1].toFixed(1)}" r="0.9"/>`);
    put(Dt([[OBC.x0 + 2, OBC.z0 + 2], [OBC.x1 - 2, OBC.z0 + 2], [OBC.x1 - 2, OBC.z1 - 2]].map(([x, z]) => at([x, OBC.y1, z])), { size: 0.4 }));
    // the flap stands open on its hinge at the inlet's left
    put(S(box(INLET.x - INLET.r - 2.6, INLET.x - INLET.r - 2, OBC.y1, OBC.y1 + 9.4, INLET.z - 5, INLET.z + 5, 2, 0.2, 0.3), { tone: "mid" }));
    put(Dt([at([INLET.x - INLET.r - 2, OBC.y1 + 0.6, INLET.z + 3.6]), at([INLET.x - INLET.r - 2, OBC.y1 + 0.6, INLET.z - 3.6])], { size: 0.4 }));
  }
  for (const cable of dc) for (const { piece, svg } of cable) if (!(piece.mid[0] < 112 || piece.mid[2] > 60)) put(svg);

  // ================= half shaft =================
  const SH_F = FX(0, 0, ZD);
  put(S(G.solidOf([[110.4, 5], [111.4, 6.4], [115, 6.4, 1], [116, 5.4]], SH_F, P), { tone: "mid" }));
  const boot = (from, dir) => {
    const prof = [];
    const steps = [5.6, 5.8, 4.9, 5.1, 4.2, 4.3, 3.5, 3.5, 2.9];
    steps.forEach((r, i) => prof.push([from + dir * i * 1.4, r]));
    if (dir < 0) prof.reverse();
    return S(G.solidOf(prof, SH_F, P, { smooth: false }), { tone: "lo", className: "phv-rubber" });
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
  defs.push(`<clipPath id="phv-rim"><path d="${G.circleOf(SH_F, WHEEL.x1 - 1, WHEEL.rim, P, 96)}"/></clipPath>`);
  defs.push(`<clipPath id="phv-well"><path d="${G.circleOf(SH_F, WHEEL.x0 + 1, WHEEL.rim - 1, P, 96)}"/></clipPath>`);
  put(`<g clip-path="url(#phv-rim)">`);
  put(...innerFacets(SH_F, WHEEL.x0 + 1, WHEEL.x1 - 1, WHEEL.rim - 1));
  put(`<g clip-path="url(#phv-well)">`);
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


  // ================= the wall charger on its post, the cord along the bench's front edge =================
  {
    const W = WALLBOX;
    const base = plan(POST.x - 9, POST.x + 9, POST.y - 7, POST.y + 7, 1.6);
    put(S(k.slabOf(base, 0, 1.2, P, 3, 0.4), { tone: "lo" }), Dt(k.corners(base, 2.2).map(([x, y]) => at([x, y, 1.2])), { size: 0.45 }));
    const post = plan(POST.x - POST.w / 2, POST.x + POST.w / 2, POST.y - POST.w / 2, POST.y + POST.w / 2, 0.8);
    put(S(k.slabOf(post, 1.2, W.z0 - 1.2, P, 3, 0.3), { tone: "mid", inner: Ln(k.sideSeam(post, 5, P, 3), { tone: "faint" }) }));
    // the cord leaves the box through a gland underneath, drops beside the post and runs along the floor
    const gland = [W.x1 - 6, W.y0 + 6];
    put(S(k.cylinder(gland[0], gland[1], 2.2, W.z0 - 2.6, 2.6, P, 18), { tone: "mid" }));
    const cord = cableRoute("evse", [[gland[0], gland[1], W.z0 - 2.6], [gland[0], gland[1], 10], [gland[0] + 3, CORD_Y, 1.3], [gland[0] + 12, CORD_Y, 1.3], [CLIP[0], CORD_Y, 1.3]], 1.3);
    // the cord runs behind the post's base on its way down, so the box goes on after it
    for (const { svg } of cord) put(svg);
    // floor clips hold it down
    for (const x of [8, 96, CLIP[0]]) put(S(box(x - 1.6, x + 1.6, CORD_Y - 2.6, CORD_Y + 2.6, 0, 3, 2, 0.3, 0.6), { tone: "mid" }), Dt([at([x, CORD_Y - 1.8, 3]), at([x, CORD_Y + 1.8, 3])], { size: 0.35 }));
    // the box: rounded case, a bezel round the front, the status ring and a small screen
    const head = plan(W.x0, W.x1, W.y0, W.y1, 2.6);
    put(S(k.slabOf(head, W.z0, W.z1 - W.z0, P, 4, 1.2), { tone: "mid", inner: Ln(k.sideSeam(head, W.z1 - 4, P, 4), { tone: "faint" }) }));
    const RF = G.frameAlong([(W.x0 + W.x1) / 2, W.y1, W.z1 - 13], [0, 1, 0]);
    put(S(G.ringBand(0, 0.6, 4.2, 6.2, RF, P, { hole: [0.6, 4.2] }), { tone: "mid" }));
    put(`<path class="phv-led" data-k="led" fill-rule="evenodd" d="${G.circleOf(RF, 0.65, 5.8, P, 64)}${G.circleOf(RF, 0.65, 4.6, P, 64)}"/>`);
    put(`<path class="phv-dial" d="${G.circleOf(RF, 0.62, 4.2, P, 48)}"/>`);
    // the lightning mark is a single engraved stroke: the box's one small label
    put(Ln(path3([[RF.o[0] + 0.8, W.y1 + 0.7, RF.o[2] + 2.4], [RF.o[0] - 0.9, W.y1 + 0.7, RF.o[2] - 0.2], [RF.o[0] + 0.9, W.y1 + 0.7, RF.o[2] + 0.2], [RF.o[0] - 0.8, W.y1 + 0.7, RF.o[2] - 2.4]]), { tone: "mid", free: true }));
    const screen = [[W.x0 + 7, W.z0 + 4], [W.x1 - 7, W.z0 + 4], [W.x1 - 7, W.z0 + 9], [W.x0 + 7, W.z0 + 9]].map(([x, z]) => [x, W.y1, z]);
    put(`<path class="phv-cav" data-shade="1" d="${ring3(screen)}"/>`);
    put(Ln([0, 1].map((row) => path3([[W.x0 + 8.6, W.y1, W.z0 + 7.4 - row * 1.8], [W.x0 + (row ? 13 : 16), W.y1, W.z0 + 7.4 - row * 1.8]])).join(""), { tone: "lo", free: true }));
    put(Dt([[W.x0 + 2.4, W.z0 + 2.4], [W.x1 - 2.4, W.z0 + 2.4], [W.x0 + 2.4, W.z1 - 2.4], [W.x1 - 2.4, W.z1 - 2.4]].map(([x, z]) => at([x, W.y1, z])), { size: 0.45 }));
    // the holster on the box's right side, where the plug hangs when it's put away
    const HF = G.frameAlong([W.x1, (W.y0 + W.y1) / 2, W.z0 + 12], [1, 0, 0]);
    put(S(G.lathe([[0, 0], [0, 4.4], [3.4, 4.4], [3.4, 3.4], [3.6, 0]], HF, P), { tone: "mid" }));
    put(`<path class="phv-cav" data-shade="0" d="${G.circleOf(HF, 3.5, 3.2, P, 40)}"/>`);
  }

  // ================= the plug, its lead to the last clip =================
  {
    // the lead is rebuilt as the plug moves; it starts under the last clip
    live("lead");
    const PF = G.frameAlong([INLET.x, OBC.y1, INLET.z], [0, 1, 0]);
    const body = S(G.lathe([[0, 0], [0, PLUG.r - 0.5], [0.5, PLUG.r, 1], [PLUG.body - 0.6, PLUG.r, 1], [PLUG.body, PLUG.r - 0.6], [PLUG.body, 0]], PF, P), { tone: "hi", inner: Ln(G.arcOf(PF, 1.6, PLUG.r, P) + G.arcOf(PF, PLUG.body - 2.2, PLUG.r, P), { tone: "lo" }) });
    // the grip, its latch button on top and the strain relief the lead leaves through
    const g0 = OBC.y1 + PLUG.body;
    const g1 = g0 + PLUG.grip;
    const grip = S(box(INLET.x - 3, INLET.x + 3, g0 - 0.4, g1, INLET.z - 3.4, INLET.z + 3.6, 3, 0.8, 1.4), { tone: "mid", inner: Ln(k.sideSeam(plan(INLET.x - 3, INLET.x + 3, g0 - 0.4, g1, 1.4), INLET.z, P, 3), { tone: "faint" }) });
    const latch = S(box(INLET.x - 1.4, INLET.x + 1.4, g0 + 0.6, g0 + 3.6, INLET.z + 3.6, INLET.z + 4.6, 2, 0.3, 0.6), { tone: "mid" });
    const RF = G.frameAlong([INLET.x, g1, INLET.z], [0, 1, 0]);
    const relief = S(G.lathe([[0, 0], [0, 2.4], [1, 2.1, 1], [1.8, 1.55], [1.8, 0]], RF, P), { tone: "lo", className: "phv-rubber" });
    put(moving("plug", body + grip + latch + relief));
  }

  void THROW;
  void socAngle;
  void meterAngle;
  void LOBE_X;
  return { defs: defs.join(""), body: out.join(""), flows: { ...routes }, frame: f };
}
