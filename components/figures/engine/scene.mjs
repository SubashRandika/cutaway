// The static drawing, in painter's order, with the live slots placed where
// their parts physically sit. Two strings come out: what lies behind the gas
// canvas (back) and what lies in front of it (front).

import * as k from "../../iso/iso-kit.mjs";
import * as G from "../../iso/lathe.mjs";
import { tubePieces, tubeSvg } from "../../iso/tube.mjs";
import { PAIRS, FINAL } from "./model.mjs";
import {
  P, at, BASE, ZC, RB, RP, DECK, CASE, SUMP, BARREL, FINS, HEAD, COVER, VALVE, VALVE_TILT, SEAT_Y, seatZ, ROOF_APEX, MAIN_R, WEB,
  FLY, DISC, PLATE, BELL, BEARING, ZO, ZD, GEAR_W, PAIR_X, COLLAR_X, PINION_X, PINION_R, RING_R, BOX, BOX_SIDE, SHAFT, UPRIGHT, ROTOR, WHEEL, ROLLER, ROLLER_Y, TANK, PISTON_H,
} from "./view.mjs";
import { PORTS, PORT_R, RUNNER, RUNNER_R } from "./ports.mjs";
import { INJECTOR } from "./gas.mjs";
import { frameOf, liveMarkup, THROTTLE, PISTON, VALVE_AXES, valveFrame, CAM_CENTRES, LEVER_BALL, GAP_POINT } from "./frame.mjs";
import {
  S, Ln, Dt, box, plan, path3, ring3, FX, FY, FZ, prismX, prismY, discX, discZ, onX, onY, cutSvg, cavSvg, cavLine, rect, arcPts, circle2, clipSvg, TAU, RAD, V, hull2,
} from "./parts.mjs";

const RESTING = { throttle: 0, crank: 52, input: 52, output: 0, wheel: 0, clutch: 1, gear: 0, want: 0, from: 0, phase: "run", selector: 0, rpm: 900, calm: true };
export const REST_STATE = RESTING;

const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const offset2 = (points, d) =>
  points.map((p, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const ty = b[0] - a[0];
    const tz = b[1] - a[1];
    const len = Math.hypot(ty, tz) || 1;
    return [p[0] - (tz / len) * d, p[1] + (ty / len) * d];
  });

export function buildScene(state = RESTING) {
  const f = frameOf(state);
  const back = [];
  const front = [];
  const defs = [];
  let list = back;
  const put = (...svg) => list.push(...svg);
  const live = (id) => list.push(liveMarkup(id, f));
  const moving = (key, inner, extra = "") => `<g data-k="${key}" transform="${f[`${key}@t`] || ""}"${extra}>${inner}</g>`;

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
  // two T-slots along the bench
  for (const y of [22, 36]) put(Ln(k.planOutline(plan(40, 232, y, y + 4, 2), 0, P, 4), { tone: "lo" }), Ln(k.planOutline(plan(41.5, 230.5, y + 1.2, y + 2.8, 0.8), 0, P, 3), { tone: "faint" }));
  // ruler strip along the front edge
  const strip = plan(16, 292, BASE.y + BASE.d - 13, BASE.y + BASE.d - 6, 1);
  put(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  put(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
  // label plate
  const label = plan(-66, -24, BASE.y + BASE.d - 16, BASE.y + BASE.d - 5, 1.6);
  put(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }), Ln(k.planOutline(k.insetPlan(label, 1.6), 0.8, P), { tone: "faint" }));
  put(Ln([0, 1, 2].map((row) => k.lineOnTop([label.x + 7, label.y + 3.2 + row * 2.3], [label.x + (row === 1 ? 26 : 34), label.y + 3.2 + row * 2.3], 0.8, P)).join(""), { tone: "lo", free: true }));
  put(Dt([at([label.x + 3.2, label.y + label.d / 2, 0.8]), at([label.x + label.w - 3.2, label.y + label.d / 2, 0.8])], { size: 0.45 }));

  // ================= fuel tank =================
  const tank = TANK;
  for (const [x, y] of byDepth([[tank.x + 5, tank.y + 5], [tank.x + tank.w - 5, tank.y + 5], [tank.x + 5, tank.y + tank.d - 5], [tank.x + tank.w - 5, tank.y + tank.d - 5]])) put(S(k.cylinder(x, y, 2.4, 0, 1.4, P, 16), { tone: "lo" }));
  const tankPlan = plan(tank.x, tank.x + tank.w, tank.y, tank.y + tank.d, tank.r);
  const straps = [7, 17].map((z) => k.sideSeam(tankPlan, 1.4 + z, P, 6)).join("");
  put(S(k.slabOf(tankPlan, 1.4, tank.h, P, 6, 1.2), { tone: "mid", inner: Ln(straps, { tone: "lo" }) }));
  // sight gauge, a closed slot on the front face
  const gauge = [[tank.x + 8, 5], [tank.x + 11, 5], [tank.x + 11, 20], [tank.x + 8, 20]].map(([x, z]) => [x, tank.y + tank.d, z]);
  put(`<path class="iso-line" data-tone="lo" d="${ring3(gauge)}"/>`, Ln(path3([[tank.x + 8, tank.y + tank.d, 13], [tank.x + 11, tank.y + tank.d, 13]]), { tone: "mid" }));
  const pumpC = [tank.x + 18, tank.y + 12];
  put(S(k.cylinder(pumpC[0], pumpC[1], 6, 1.4 + tank.h, 1.2, P, 28), { tone: "mid" }), Dt(G.dotsOf(FZ(pumpC[0], pumpC[1], 0), 1.4 + tank.h + 1.2, 4.6, 6, P, { all: true }), { size: 0.4 }));
  put(S(k.cylinder(pumpC[0], pumpC[1], 2.4, 2.6 + tank.h, 3.2, P, 16), { tone: "mid" }));
  const capC = [tank.x + 8, tank.y + 24];
  put(S(k.cylinder(capC[0], capC[1], 4.2, 1.4 + tank.h, 2, P, 24), { tone: "mid" }), Ln(k.knurl(capC[0], capC[1], 4.2, 1.4 + tank.h, 3.4 + tank.h, 22, P), { tone: "lo" }));

  // ================= exhaust: header behind the engine, silencer on the bench =================
  {
    const EX_R = 2.6;
    const route = G.fillet([[0, -HEAD.half - 1.2, 131.5], [0, -38, 131.5], [0, -38, 22], [-34, -38, 22], [-46, -42, 22]], 8, 8, { P, tube: EX_R });
    const pieces = tubePieces(route, EX_R, P, { maxLength: 18, gaps: [] });
    // silencer can along x, on two saddles
    const SF = FX(0, -44, 22);
    for (const x of [-70, -52]) put(S(box(x - 2, x + 2, -50, -38, 0, 14.5, 2, 0.4, 1), { tone: "lo" }), Dt([at([x, -49, 14.5]), at([x, -39, 14.5])], { size: 0.4 }));
    put(S(G.solidOf([[-80, 5.4], [-78, 8.6, 1], [-75, 9], [-49, 9], [-46, 8.6, 1], [-44.5, 5.4], [-44.5, 3.4]], SF, P), { tone: "mid", inner: Ln(G.arcOf(SF, -61, 9, P), { tone: "faint" }) }));
    put(S(G.ringBand(-86, -79.6, 1.8, 2.6, SF, P), { tone: "mid" }));
    const flange = [0, -HEAD.half - 0.6, 131.5];
    put(S(G.disc(-0.6, 0.6, 5.2, G.frameAlong(flange, [0, 1, 0]), P), { tone: "mid" }));
    put(...pieces.map((piece) => tubeSvg(piece, { tone: "mid" })));
  }

  // ================= engine mounts =================
  for (const x0 of [-32, 20]) {
    put(S(box(x0, x0 + 12, -26, -6, 0, 1.4, 2, 0.3), { tone: "lo" }), Dt([at([x0 + 2, -24, 1.4]), at([x0 + 10, -8, 1.4])], { size: 0.45 }));
    put(S(box(x0 + 2, x0 + 10, -24, -8, 1.4, 5.6, 2), { tone: "lo", className: "eng-rubber" }));
    put(S(box(x0 + 1, x0 + 11, -25, -7, 5.6, SUMP.z0, 2, 0.3), { tone: "mid" }));
  }

  // ================= crankcase =================
  const caveC = [[-30, 12], [30, 12], [30, 66], [14, 66], [14, 70], [-14, 70], [-14, 66], [-30, 66]].map(onY(0));
  defs.push(clipSvg("eng-cave", [caveC]));
  put(S(box(SUMP.x0, SUMP.x1, SUMP.y0, 0, SUMP.z0, SUMP.z1, 3, 0.6, 2), { tone: "mid", inner: Ln(k.sideSeam(plan(SUMP.x0, SUMP.x1, SUMP.y0, 0, 2), SUMP.z1 - 1.2, P, 3), { tone: "faint" }) }));
  put(S(discX(SUMP.x1, SUMP.x1 + 1.6, 2, -14, 12.5), { tone: "mid" }));
  put(S(box(CASE.x0, CASE.x1, CASE.y0, 0, CASE.z0, CASE.z1, 3, 0.8, 2), { tone: "mid" }));
  put(cutSvg([[[-32, 9], [32, 9], [32, 18], [29, 18], [29, 12], [-29, 12], [-29, 18], [-32, 18]].map(onY(0))]));
  put(cutSvg([[[-34, 18], [-30, 18], [-30, 66], [-14, 66], [-14, 70], [-34, 70]].map(onY(0)), [[14, 70], [14, 66], [30, 66], [30, 18], [34, 18], [34, 70]].map(onY(0))]));
  // inside the crankcase, seen through the cut
  put(`<g clip-path="url(#eng-cave)">`);
  put(cavSvg(rect(-30, 30, 12, 66).map(([x, z]) => [x, -26, z]), 1));
  put(cavSvg(rect(-30, 30, -26, 0).map(([x, y]) => [x, y, 12]), "top"));
  put(cavSvg(rect(-26, 0, 12, 66).map(([y, z]) => [-30, y, z]), 3));
  put(cavSvg(rect(-14, 14, -26, 0).map(([x, y]) => [x, y, 66]).map(([x, y, z]) => [x, y, z + 4]), 0));
  put(cavLine([[-30, -26, 12], [30, -26, 12]]), cavLine([[-30, -26, 12], [-30, -26, 66]]), cavLine([[-30, -26, 12], [-30, 0, 12]]));
  // main bearing bosses on the end walls
  put(`</g>`);

  // ================= cylinder: back half =================
  const finsBack = [];
  const finPlan = (half) => {
    const ring = [[0, -half], [-half + 4, -half], ...arcPts(-half + 4, -half + 4, 4, -Math.PI / 2, -Math.PI, 4), [-half, 14]];
    ring.push([0, 14]);
    for (const [x, y] of arcPts(0, 0, RB, Math.PI / 2, (3 * Math.PI) / 2, 24)) ring.push([x, y]);
    return ring;
  };
  const barrelRing = finPlan(BARREL.half);
  const finRing = finPlan(BARREL.fin);
  let z = BARREL.z0;
  for (const zf of [...FINS, BARREL.z1]) {
    put(S(k.extrude(barrelRing, z, zf - z, P, { convex: false }), { tone: "mid" }));
    if (zf < BARREL.z1) put(S(k.extrude(finRing, zf, 2, P, { convex: false }), { tone: "mid" }));
    z = zf + 2;
    finsBack.push(zf);
  }
  // the bore, seen through the cut on x = 0: concave facets of the back half
  const roofZ = (y) => DECK + (RB - Math.abs(y)) * Math.tan(VALVE_TILT);
  const boreFacets = [];
  for (let i = 0; i < 36; i++) {
    const a0 = Math.PI / 2 + (i / 36) * Math.PI;
    const a1 = Math.PI / 2 + ((i + 1) / 36) * Math.PI;
    const mid = (a0 + a1) / 2;
    const n = [-Math.cos(mid), -Math.sin(mid), 0];
    if (G.dot3(n, V) <= 0) continue;
    const tone = Math.min(3, G.toneOf(n, P));
    const p = (a, zz) => [RB * Math.cos(a), RB * Math.sin(a), zz];
    boreFacets.push(cavSvg([p(a0, BARREL.z0), p(a1, BARREL.z0), p(a1, roofZ(RB * Math.sin(a1))), p(a0, roofZ(RB * Math.sin(a0)))], tone));
  }
  put(...boreFacets);
  // back jaw comb: the cut through the barrel and its fins on x = 0
  const comb = (sign) => {
    const ring = [];
    const inner = sign * RB;
    ring.push([inner, BARREL.z0]);
    ring.push([sign * BARREL.half, BARREL.z0]);
    for (const zf of FINS) ring.push([sign * BARREL.half, zf], [sign * BARREL.fin, zf], [sign * BARREL.fin, zf + 2], [sign * BARREL.half, zf + 2]);
    ring.push([sign * BARREL.half, BARREL.z1], [inner, BARREL.z1]);
    return ring.map(onX(0));
  };
  put(cutSvg([comb(-1)]));

  // ================= head and its cavities (body behind the gas) =================
  put(S(box(-HEAD.half, 0, -HEAD.half, HEAD.half, HEAD.z0, HEAD.z1, 3, 0.8, 2), { tone: "mid" }));
  // ports as channels in the section plane
  const ports = PORTS;
  for (const name of ["intake", "exhaust"]) {
    const line = ports[name];
    const a = offset2(line, PORT_R);
    const b = offset2(line, -PORT_R);
    put(cavSvg([...a, ...b.reverse()].map(onX(0)), 1));
    put(cavLine(line.map(onX(-0.01))));
  }
  {
    const a = offset2(RUNNER, RUNNER_R);
    const b = offset2(RUNNER, -RUNNER_R);
    put(cavSvg([...a, ...[...b].reverse()].map(onX(0)), 1), cavLine(RUNNER.map(onX(-0.01))));
    put(cavSvg(rect(THROTTLE.y - 4.4, THROTTLE.y + 4.4, 150, 163).map(onX(0)), 1));
  }

  // ================= crank =================
  put(S(discX(CASE.x0 + 1, -WEB.outer, MAIN_R, 0, ZC), { tone: "mid", crease: "none" }));
  live("webL");
  // the crankcase top wall, left of the bore, in front of the left web
  put(cutSvg([[[-30, 66], [-14, 66], [-14, 70], [-30, 70]].map(onY(0))]));
  live("rod");
  live("webR");
  put(S(discX(WEB.outer, CASE.x1 + 6, MAIN_R, 0, ZC), { tone: "mid", crease: "none" }));
  // crankcase right end wall and top wall, in front of the crank
  put(S(box(CASE.x1 - 4, CASE.x1, CASE.y0, 0, CASE.z0, CASE.z1, 2, 0.8, 1), { tone: "mid" }));
  put(cutSvg([[[14, 70], [14, 66], [30, 66], [30, 18], [34, 18], [34, 70]].map(onY(0))]));
  put(S(k.extrude([[0, -RB], [0, CASE.y0], [CASE.x1 - 4, CASE.y0], [CASE.x1 - 4, 0], [RB, 0], ...arcPts(0, 0, RB, 0, -Math.PI / 2, 12).slice(1, -1)], CASE.z1 - 4, 4, P, { convex: false }), { tone: "mid", crease: "faint" }));

  // ================= piston: back half, behind the gas =================
  const half = (sign) => {
    const ring = [];
    for (let i = 0; i <= 24; i++) {
      const a = -Math.PI / 2 + (i / 24) * Math.PI;
      ring.push([sign * RP * Math.cos(a), RP * Math.sin(a)]);
    }
    return ring;
  };
  const crown = PISTON.crown;
  const skirt = crown - PISTON_H;
  const pistonBack = S(k.extrude(half(-1), skirt, PISTON_H, P, { convex: true }), { tone: "hi" });
  put(moving("pistonB", pistonBack));

  // ================= the gas layer sits here =================
  list = front;

  // piston front half, rings, pin boss
  const ringSeams = [crown - 2.2, crown - 4, crown - 5.8].map((zz) => G.arcOf(FZ(0, 0, 0), zz, RP, P, { from: -Math.PI / 2, to: Math.PI / 2 }));
  const pistonFront = S(k.extrude(half(1), skirt, PISTON_H, P, { convex: true }), { tone: "hi", inner: Ln(ringSeams.join(""), { tone: "lo" }) });
  const pinBoss = Ln(k.sideRing([RP - 0.1, 0, crown - PISTON.h + 8.5 + 1.4], 2.6, "x", P), { tone: "lo" });
  put(moving("pistonF", pistonFront + pinBoss + Ln(k.ring(0, 0, RP - 3, crown, P, 32), { tone: "faint" })));

  // cylinder front jaw: barrel and fin parts y >= RB, then the front comb
  const jaw = (half) => [[0, RB], [0, half], [-half + 4, half], ...arcPts(-half + 4, half - 4, 4, Math.PI / 2, Math.PI, 4).slice(1), [-half, RB]];
  z = BARREL.z0;
  for (const zf of [...FINS, BARREL.z1]) {
    put(S(k.extrude(jaw(BARREL.half), z, zf - z, P), { tone: "mid" }));
    if (zf < BARREL.z1) put(S(k.extrude(jaw(BARREL.fin), zf, 2, P), { tone: "mid" }));
    z = zf + 2;
  }
  put(cutSvg([comb(1)]));

  // head section: material in front of the gas, ports and chamber as notches
  const throat = (sign, which) => {
    const y = sign * (SEAT_Y + which * 4);
    return [y, roofZ(y)];
  };
  const aI = offset2(ports.intake, PORT_R);
  const bI = offset2(ports.intake, -PORT_R);
  const aE = offset2(ports.exhaust, PORT_R);
  const bE = offset2(ports.exhaust, -PORT_R);
  const lowerOf = (a, b) => (a[a.length - 1][1] < b[b.length - 1][1] ? a : b);
  const upperOf = (a, b) => (a[a.length - 1][1] < b[b.length - 1][1] ? b : a);
  const upI = upperOf(aI, bI);
  const loI = lowerOf(aI, bI);
  const upE = upperOf(aE, bE);
  const loE = lowerOf(aE, bE);
  const pieceA = [[-HEAD.half, HEAD.z1], [HEAD.half, HEAD.z1], [HEAD.half, upI[upI.length - 1][1]], ...[...upI].reverse().slice(1), throat(1, -1), [2.6, roofZ(2.6)], [0, ROOF_APEX], [-2.6, roofZ(2.6)], throat(-1, -1), ...upE.slice(1), [-HEAD.half, upE[upE.length - 1][1]]];
  const pieceB = [[HEAD.half, HEAD.z0], [HEAD.half, loI[loI.length - 1][1]], ...[...loI].reverse().slice(1), throat(1, 1), [RB, HEAD.z0]];
  const pieceC = [[-HEAD.half, HEAD.z0], [-RB, HEAD.z0], throat(-1, 1), ...loE.slice(1), [-HEAD.half, loE[loE.length - 1][1]]];
  put(cutSvg([pieceA.map(onX(0)), pieceB.map(onX(0)), pieceC.map(onX(0))]));
  // guides, spring pockets and the plug bore: cavities the gas never reaches
  for (const name of ["intake", "exhaust"]) {
    const F = valveFrame(name);
    const along = (s, r) => [G.pointOf(F, s, r, Math.PI / 2), G.pointOf(F, s, r, -Math.PI / 2)];
    const pocket = (s0, s1, r) => {
      const [a0, b0] = along(s0, r);
      const [a1, b1] = along(s1, r);
      return [a0, a1, b1, b0];
    };
    put(cavSvg(pocket(PORT_R + 1.5, 9, 1.35), 0));
    put(cavSvg(pocket(9, (HEAD.z1 - seatZ(SEAT_Y)) / Math.cos(VALVE_TILT) + 0.4, 4.6), 1));
  }
  put(cavSvg(rect(-2.4, 2.4, ROOF_APEX - 0.4, HEAD.z1).map(onX(0)), 0));

  // valves, behind their springs' front coils
  for (const name of ["intake", "exhaust"]) {
    const F = valveFrame(name);
    live(`${name}.springB`);
    const head = G.lathe([[-1.0, 0], [-1.0, VALVE.head], [0.2, VALVE.head], [0.9, VALVE.head - 1.2, 1], [2.2, 2.2, 1], [3.6, VALVE.stem]], F, P, { rims: "first" });
    const stem = G.disc(3.4, 24.5, VALVE.stem, F, P);
    const retainer = G.disc(17.0, 18.0 - 0.9 + 0.9, 2.7, F, P);
    put(moving(name, S(stem, { tone: "hi", crease: "none" }) + S(head, { tone: "hi" }) + S(G.disc(16.6, 17.4, 2.7, F, P), { tone: "mid" })));
    live(`${name}.springF`);
  }

  // cam cover with its cam chambers and bucket bores
  put(S(box(-COVER.half, 0, -COVER.half, COVER.half, COVER.z0, COVER.z1, 3, 1, 3), { tone: "mid" }));
  const coverRing = [[-COVER.half, COVER.z0], [COVER.half, COVER.z0], [COVER.half, COVER.z1 - 3], [COVER.half - 3, COVER.z1], [-COVER.half + 3, COVER.z1], [-COVER.half, COVER.z1 - 3]];
  put(cutSvg([coverRing.map(onX(0))]));
  for (const name of ["intake", "exhaust"]) {
    const c = CAM_CENTRES[name];
    put(cavSvg(circle2(c[1], c[2], 9.2, 36).map(onX(0)), 0));
    const F = valveFrame(name);
    const s0 = (COVER.z0 - seatZ(SEAT_Y)) / Math.cos(VALVE_TILT) - 0.6;
    put(cavSvg([G.pointOf(F, s0, 4.4, Math.PI / 2), G.pointOf(F, 22, 4.4, Math.PI / 2), G.pointOf(F, 22, 4.4, -Math.PI / 2), G.pointOf(F, s0, 4.4, -Math.PI / 2)], 1));
  }
  put(cavSvg(rect(-3.6, 3.6, COVER.z0, COVER.z1).map(onX(0)), 0));
  // buckets ride the valves
  for (const name of ["intake", "exhaust"]) {
    const F = valveFrame(name);
    const bucketS = VALVE.cam - VALVE.base - VALVE.bucketH;
    put(moving(`${name}`, S(G.disc(bucketS, bucketS + VALVE.bucketH, VALVE.bucket, F, P), { tone: "mid" }), ` data-follow="1"`));
  }
  // camshafts and lobes
  for (const name of ["intake", "exhaust"]) {
    const c = CAM_CENTRES[name];
    put(S(discX(-COVER.half + 1, -3.6, 3.2, c[1], c[2]), { tone: "mid", crease: "none" }));
    live(`cam.${name}`);
    put(S(discX(3.6, 7.6, 3.2, c[1], c[2]), { tone: "mid" }));
  }
  // spark plug, coil on top
  const plugF = FZ(0, 0, 0);
  put(S(G.disc(ROOF_APEX - 1.0, ROOF_APEX + 7, 1.9, plugF, P), { tone: "mid", crease: "none" }));
  put(S(G.lathe([[HEAD.z1 - 6, 0], [HEAD.z1 - 6, 3.3], [HEAD.z1 - 1, 3.3], [HEAD.z1 - 1, 2.2], [COVER.z1 + 1, 2.2], [COVER.z1 + 1, 0]], plugF, P), { tone: "hi" }));
  put(S(G.disc(COVER.z1 - 1, COVER.z1 + 9, 4, plugF, P), { tone: "mid", inner: Ln(G.arcOf(plugF, COVER.z1 + 3, 4, P), { tone: "faint" }) }));
  put(S(box(-3, 3, 3.4, 9, COVER.z1 + 3.5, COVER.z1 + 8, 2, 0.3), { tone: "mid" }));
  live("spark");

  // ================= intake: runner, throttle body, air box (sectioned on x = 0) =================
  const runner = RUNNER;
  const RR = RUNNER_R;
  const RW = 1.6;
  const outerA = offset2(runner, RR + RW);
  const innerA = offset2(runner, RR);
  const innerB = offset2(runner, -RR);
  const outerB = offset2(runner, -RR - RW);
  // the back half's top, seen from above: the upper outer line swept back to x = -(R + W)
  const upper = outerA[0][1] > outerB[0][1] ? outerA : outerB;
  put(`<path class="iso-top eng-band" style="stroke:var(--anatomy-mid);stroke-width:.6px;vector-effect:non-scaling-stroke;stroke-linejoin:round" d="${ring3([...upper.map(([y, zz]) => [0, y, zz]), ...[...upper].reverse().map(([y, zz]) => [-(RR + RW) * 0.8, y - 1, zz - 1.4])])}"/>`);
  put(cutSvg([[...outerA, ...[...innerA].reverse()].map(onX(0)), [...innerB, ...[...outerB].reverse()].map(onX(0))]));
  put(cutSvg([rect(HEAD.half, HEAD.half + 1.6, 124, 139).map(onX(0))]));
  // throttle body: a sectioned bore with the butterfly on its spindle
  const TB = { y0: THROTTLE.y - 6, y1: THROTTLE.y + 6, z0: 149, z1: 163 };
  put(S(box(-6, 0, TB.y0, TB.y1, TB.z0, TB.z1, 2, 0.5, 1.2), { tone: "mid" }));
  put(cutSvg([rect(TB.y0, THROTTLE.y - 4.4, TB.z0, TB.z1).map(onX(0)), rect(THROTTLE.y + 4.4, TB.y1, TB.z0, TB.z1).map(onX(0))]));
  put(`<path class="eng-cav" data-shade="1" d="${ring3(rect(THROTTLE.y - 4.4, THROTTLE.y + 4.4, TB.z0, TB.z1).map(onX(0)))}"/>`);
  put(S(discX(-8.5, 0, 0.9, THROTTLE.y, THROTTLE.z), { tone: "mid", crease: "none" }));
  live("butterfly");
  put(S(discX(-10, -6, 3.2, THROTTLE.y, THROTTLE.z), { tone: "mid" }), Dt([at([-10, THROTTLE.y + 2, THROTTLE.z + 1])], { size: 0.5, tone: "hi" }));
  // air box with a pleated paper element, also sectioned
  const AB = { x0: -16, y0: 34, y1: 58, z0: 163, z1: 179 };
  put(S(box(AB.x0, 0, AB.y0, AB.y1, AB.z0, AB.z1, 3, 0.8, 2.5), { tone: "mid", inner: Ln(k.sideSeam(plan(AB.x0, 0, AB.y0, AB.y1, 2.5), 171, P, 3), { tone: "faint" }) }));
  put(cutSvg([rect(AB.y0, AB.y1, AB.z0, AB.z1).map(onX(0)), rect(AB.y0 + 1.6, AB.y1 - 1.6, AB.z0 + 1.6, AB.z1 - 1.6).map(onX(0))]));
  put(`<path class="eng-cav" data-shade="2" d="${ring3(rect(AB.y0 + 1.6, AB.y1 - 1.6, AB.z0 + 1.6, AB.z1 - 1.6).map(onX(0)))}"/>`);
  {
    const pleat = [];
    const count = 9;
    for (let i = 0; i <= count * 2; i++) pleat.push([AB.y0 + 1.6 + (i / (count * 2)) * (AB.y1 - AB.y0 - 3.2), i % 2 ? 173 : 168]);
    const strip = [...pleat, ...[...pleat].reverse().map(([y, zz]) => [y, zz + 0.9])];
    put(cutSvg([strip.map(onX(0))]));
  }
  put(S(G.ringBand(AB.y1, AB.y1 + 5, 3, 4.2, FY(-8, 0, 174), P, { hole: [AB.y1 + 5, 3] }), { tone: "mid" }));
  // injector on its boss in the head, aimed at the intake valve
  const INJ = { tip: [0, INJECTOR.tip[0], INJECTOR.tip[1]], up: [0, -INJECTOR.aim[0], -INJECTOR.aim[1]] };
  const IF = G.frameAlong(INJ.tip, INJ.up);
  put(S(G.solidOf([[0, 0.8], [1.6, 1.2], [2, 2.2], [8.4, 2.2], [8.4, 1.6], [10.4, 1.6]], IF, P), { tone: "hi" }));
  put(S(G.disc(5.2, 6.4, 2.9, IF, P), { tone: "mid" }));
  const injTop = G.pointOf(IF, 10.4, 0, 0);
  // stanchion that carries the fuel line and the ignition coil
  const POST = { x: -44, y: 30 };
  put(S(k.cylinder(POST.x, POST.y, 5.4, 0, 1.6, P, 24), { tone: "lo" }), Dt(G.dotsOf(FZ(POST.x, POST.y, 0), 1.6, 4, 3, P, { all: true, phase: 0.5 }), { size: 0.4 }));
  put(S(k.cylinder(POST.x, POST.y, 1.8, 1.6, 150, P, 20), { tone: "mid", crease: "none" }));
  const COIL = { z0: 76, z1: 92 };
  put(S(box(POST.x + 1.8, POST.x + 9, POST.y - 4, POST.y + 4, COIL.z0, COIL.z1, 2, 0.5, 1), { tone: "mid", inner: Ln(k.sideSeam(plan(POST.x + 1.8, POST.x + 9, POST.y - 4, POST.y + 4, 1), COIL.z1 - 3, P, 2), { tone: "faint" }) }));
  put(S(k.cylinder(POST.x + 5.4, POST.y, 1.6, COIL.z1, 2.4, P, 16), { tone: "mid" }));
  const clampAt = (z) => put(S(box(POST.x - 2.4, POST.x + 4, POST.y - 2.4, POST.y + 2.4, z, z + 2.2, 2, 0.3, 1), { tone: "lo" }));
  // fuel: tank pump outlet, up the stanchion, over to the injector
  const pumpTop = [TANK.x + 18, TANK.y + 12, 1.4 + TANK.h + 4.4];
  const FUEL_R = 0.85;
  const fuel = G.fillet([pumpTop, [pumpTop[0], pumpTop[1], 36], [POST.x + 2.6, POST.y + 1.4, 40], [POST.x + 2.6, POST.y + 1.4, 146], [-14, 27, 150], [0, injTop[1] + 1.6, injTop[2] + 3.2], injTop], 6, 8, { P, tube: FUEL_R });
  // ignition: coil top, up the stanchion, to the plug's coil connector
  const leadTop = [0, 9, COVER.z1 + 5.8];
  const lead = G.fillet([[POST.x + 5.4, POST.y, COIL.z1 + 2.4], [POST.x + 5.4, POST.y, 100], [POST.x + 3, POST.y - 2.6, 104], [POST.x + 3, POST.y - 2.6, 150], [-30, 12, leadTop[2]], [-7, 9, leadTop[2]], leadTop], 6, 8, { P, tube: 0.75 });
  clampAt(58);
  for (const piece of tubePieces(fuel, FUEL_R, P, { maxLength: 22 })) put(tubeSvg(piece, { tone: "mid" }));
  for (const piece of tubePieces(lead, 0.75, P, { maxLength: 22 })) put(tubeSvg(piece, { tone: "mid" }));
  clampAt(122);
  put(Dt([at(pumpTop), at(injTop), at(leadTop), at([POST.x + 5.4, POST.y, COIL.z1 + 2.4])], { size: 0.9, tone: "hi" }));

  // ================= bellhousing =================
  const oct = (apothem, from, to) => {
    const pts = [];
    for (const deg of [from, to]) pts.push([(apothem / Math.cos(22.5 * RAD)) * Math.cos(deg * RAD), ZC + (apothem / Math.cos(22.5 * RAD)) * Math.sin(deg * RAD)]);
    return pts;
  };
  const facet = (from, to, clipTop) => {
    const a = (deg, ap) => {
      const r = ap / Math.cos(22.5 * RAD);
      return [r * Math.cos(deg * RAD), ZC + r * Math.sin(deg * RAD)];
    };
    const edge = (ap) => {
      let p0 = a(from, ap);
      let p1 = a(to, ap);
      if (clipTop !== undefined) {
        // cut the half facet on y = 0
        const t = (0 - p0[0]) / (p1[0] - p0[0]);
        const cut = [0, p0[1] + (p1[1] - p0[1]) * t];
        if (clipTop === "start") p0 = cut;
        else p1 = cut;
      }
      return [p0, p1];
    };
    const [i0, i1] = edge(37);
    const [o0, o1] = edge(40);
    return [i0, i1, o1, o0];
  };
  const facetSolid = (poly, cls) => S(prismX(poly, BELL.x0, BELL.x1), { tone: "mid", className: cls });
  const R8 = 40 / Math.cos(22.5 * RAD);
  const halfOct = [[0, ZC + 40], ...[112.5, 157.5, 202.5, 247.5].map((d) => [R8 * Math.cos(d * RAD), ZC + R8 * Math.sin(d * RAD)]), [0, ZC - 40]];
  const endPlate = (x0, x1) => S(prismX(halfOct, x0, x1), { tone: "mid" });
  put(endPlate(BELL.x0, BELL.x0 + 2));
  put(facetSolid(facet(247.5, 270, "end"), "eng-cavsolid"), facetSolid(facet(202.5, 247.5), "eng-cavsolid"), facetSolid(facet(157.5, 202.5), "eng-cavsolid"), facetSolid(facet(112.5, 157.5), "eng-cavsolid"));
  put(cutSvg([[[BELL.x0, ZC - 40], [BELL.x1, ZC - 40], [BELL.x1, ZC - 37], [BELL.x0 + 2, ZC - 37], [BELL.x0 + 2, ZC + 37], [BELL.x0, ZC + 37]].map(onY(0))]));
  // crank flange, flywheel and clutch
  put(S(discX(CASE.x1 + 4, FLY.x0, 7, 0, ZC), { tone: "mid" }));
  put(S(discX(FLY.x0, FLY.x1, FLY.r, 0, ZC, { bevel: 0.6 }), { tone: "mid", inner: Ln(G.arcOf(FX(0, 0, ZC), FLY.x1 - 0.1, FLY.r - 3.4, P, { least: -1 }), { tone: "faint" }) }));
  live("fly");
  put(S(discX(DISC.x0, DISC.x1, DISC.r + 2, 0, ZC), { tone: "lo" }));
  live("disc");
  put(moving("plate", S(discX(PLATE.x0, PLATE.x1, PLATE.r, 0, ZC), { tone: "mid" })));
  live("diaphragm");
  // input shaft through the release bearing guide
  put(S(discX(DISC.x0, BELL.x1 + 6, 3, 0, ZC), { tone: "mid", crease: "none" }));
  put(S(discX(BEARING.x0 + 2, BELL.x1 - 2, 4.4, 0, ZC), { tone: "mid" }));
  put(moving("bearing", S(G.ringBand(BEARING.x0, BEARING.x1, 4.4, BEARING.r, FX(0, 0, ZC), P, { hole: [BEARING.x1, 4.4] }), { tone: "hi" })));
  put(facetSolid(facet(90, 112.5, "start"), ""));
  put(cutSvg([[[BELL.x0, ZC + 37], [BELL.x1, ZC + 37], [BELL.x1, ZC + 40], [BELL.x0, ZC + 40]].map(onY(0))]));
  put(endPlate(BELL.x1 - 3, BELL.x1));
  put(cutSvg([[[BELL.x1 - 3, ZC - 40], [BELL.x1, ZC - 40], [BELL.x1, ZC - 3.2], [BELL.x1 - 3, ZC - 3.2]].map(onY(0)), [[BELL.x1 - 3, ZC + 3.2], [BELL.x1, ZC + 3.2], [BELL.x1, ZC + 40], [BELL.x1 - 3, ZC + 40]].map(onY(0))]));

  // ================= transaxle =================
  const inset = (poly, by) => {
    const n = poly.length;
    const lines = poly.map((p, i) => {
      const q = poly[(i + 1) % n];
      const dx = q[0] - p[0];
      const dz = q[1] - p[1];
      const len = Math.hypot(dx, dz);
      const nx = -dz / len;
      const nz = dx / len; // inward for a clockwise-on-screen... decided below
      return { p, d: [dx / len, dz / len], n: [nx, nz] };
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
  };
  const outer = BOX_SIDE;
  const inner = inset(outer, 4);
  const wall = (i) => [outer[i], outer[(i + 1) % outer.length], inner[(i + 1) % outer.length], inner[i]];
  // edges: 0 left, 1 stack top, 2 slant, 3 diff top, 4 right, 5 bottom right, 6 bottom
  const wallSolid = (i, cls = "") => S(prismY(wall(i), BOX.y0, 0), { tone: "mid", className: cls });
  const wallCut = (i) => cutSvg([wall(i).map(onY(0))]);
  put(S(prismY(inner, BOX.y0, BOX.y0 + 4), { tone: "mid", className: "eng-cavsolid" }));
  put(wallSolid(6, "eng-cavsolid"), wallCut(6), wallSolid(5, "eng-cavsolid"), wallCut(5), wallSolid(0, "eng-cavsolid"), wallCut(0));
  // shift rail and the bosses that carry it
  put(S(discX(BOX.x0 + 4, 130, 1.3, -18, ZO), { tone: "mid", crease: "none" }));
  // shafts and gears, left to right
  const IN_F = FX(0, 0, ZC);
  const OUT_F = FX(0, 0, ZO);
  let inX = BOX.x0 - 4;
  let outX = BOX.x0 + 2;
  const segIn = (to) => {
    if (to > inX + 0.2) put(S(discX(inX, to, 3, 0, ZC), { tone: "mid", crease: "none" }));
    inX = to;
  };
  const segOut = (to) => {
    if (to > outX + 0.2) put(S(discX(outX, to, 3.4, 0, ZO), { tone: "mid", crease: "none" }));
    outX = to;
  };
  const collarAt = (j) => {
    const cx = COLLAR_X[j];
    segOut(cx - 1.5);
    put(moving(`collar${j}`, S(box(cx - 1, cx + 1, -18, -6.2, ZO - 1.6, ZO + 1.6, 2, 0.2), { tone: "lo" }), ` data-fork="${j}"`));
    put(moving(`collar${j}`, S(discX(cx - 1.5, cx + 1.5, 6.4, 0, ZO), { tone: "mid" })));
    live(`collar${j}.teeth`);
    outX = cx + 1.5;
  };
  PAIRS.forEach((pair, i) => {
    const x0 = PAIR_X[i] - GEAR_W / 2;
    const x1 = PAIR_X[i] + GEAR_W / 2;
    if (i === 1) collarAt(0);
    if (i === 3) collarAt(1);
    segOut(x0);
    put(`<g data-k="pair${i}">`);
    put(S(discX(x0, x1, pair.output / 2, 0, ZO), { tone: "hi" }));
    live(`go${i}`);
    put(`</g>`);
    segIn(x0);
    put(`<g data-k="pair${i}" data-input="1">`);
    put(S(discX(x0, x1, pair.input / 2, 0, ZC), { tone: "hi" }));
    live(`gi${i}`);
    put(`</g>`);
    outX = x1;
    inX = x1;
  });
  collarAt(2);
  segIn(124);
  put(S(discX(124, 127, 5, 0, ZC), { tone: "mid" }));
  segOut(PINION_X - 3);
  put(wallSolid(1), wallCut(1));
  // final drive
  put(S(discX(PINION_X - 3, PINION_X + 3, PINION_R, 0, ZO), { tone: "hi" }));
  live("pinion");
  outX = PINION_X + 3;
  segOut(PINION_X + 8);
  put(S(discX(PINION_X + 8, PINION_X + 11, 5.4, 0, ZO), { tone: "mid" }));
  const RING_F = FX(0, 0, ZD);
  put(S(G.ringBand(PINION_X - 3, PINION_X + 3, 14, RING_R, RING_F, P), { tone: "hi" }));
  live("ring");
  put(S(G.solidOf([[PINION_X + 3, 15], [PINION_X + 5, 15], [PINION_X + 7, 13.6, 1], [150, 12.4, 1], [154, 10.6, 1], [156, 9], [156, 8.2], [158, 8.2], [158, 7], [BOX.x1 - 2, 7]], RING_F, P), { tone: "mid" }));
  live("diff");
  put(wallSolid(2), wallCut(2), wallSolid(3), wallCut(3), wallSolid(4), wallCut(4));
  // gear lever turret and gaiter on top of the stack
  const leverBase = [LEVER_BALL[0], LEVER_BALL[1]];
  put(S(discZ(64, 67.5, 7, leverBase[0], leverBase[1]), { tone: "mid" }), Dt(G.dotsOf(FZ(leverBase[0], leverBase[1], 0), 67.5, 5.6, 4, P, { all: true, phase: 0.4 }), { size: 0.45 }));
  put(S(G.solidOf([[67.5, 5], [69, 4.6, 1], [70.5, 3.7, 1], [72, 2.4]], FZ(leverBase[0], leverBase[1], 0), P), { tone: "lo", className: "eng-rubber" }));
  live("lever");

  // ================= half shaft =================
  const SH_F = FX(0, 0, ZD);
  put(S(G.solidOf([[BOX.x1, 5], [BOX.x1 + 1, 6.8], [BOX.x1 + 6, 6.8, 1], [BOX.x1 + 7, 5.6]], SH_F, P), { tone: "mid" }));
  const boot = (from, dir) => {
    const prof = [];
    const steps = [6, 6.2, 5.2, 5.4, 4.4, 4.5, 3.6, 3.6, 2.9];
    steps.forEach((r, i) => prof.push([from + dir * i * 1.5, r]));
    if (dir < 0) prof.reverse();
    return S(G.solidOf(prof, SH_F, P, { smooth: false }), { tone: "lo", className: "eng-rubber" });
  };
  put(boot(BOX.x1 + 7, 1));
  put(S(discX(BOX.x1 + 18, SHAFT.x1 - 18, SHAFT.r, 0, ZD), { tone: "mid", crease: "none" }));
  live("shaft");
  put(boot(SHAFT.x1 - 6, -1));
  put(S(G.solidOf([[SHAFT.x1 - 6, 5.6], [SHAFT.x1 - 4, 7, 1], [SHAFT.x1, 7.2, 1], [SHAFT.x1 + 3, 6.4, 1], [UPRIGHT.x0 + 0.5, 4.6]], SH_F, P), { tone: "mid" }));

  // ================= upright, hub, rollers, wheel =================
  for (const [x0, x1] of [[ROLLER.x0 - 4, ROLLER.x0], [ROLLER.x1, ROLLER.x1 + 4]]) {
    if (x0 > ROLLER.x1) continue;
    put(S(box(x0, x1, -ROLLER_Y - 7, -ROLLER_Y + 7, 0, ROLLER.z + 4, 2, 0.4, 1), { tone: "mid" }));
  }
  put(S(discX(ROLLER.x0, ROLLER.x1, ROLLER.r, -ROLLER_Y, ROLLER.z), { tone: "mid" }));
  live("rollerB");
  put(S(box(ROLLER.x1, ROLLER.x1 + 4, -ROLLER_Y - 7, -ROLLER_Y + 7, 0, ROLLER.z + 4, 2, 0.4, 1), { tone: "mid" }));
  put(S(box(UPRIGHT.x0 - 6, UPRIGHT.x1 + 6, -14, 14, 0, 1.6, 2, 0.4, 1.5), { tone: "lo" }), Dt([at([UPRIGHT.x0 - 3, -11, 1.6]), at([UPRIGHT.x1 + 3, 11, 1.6]), at([UPRIGHT.x0 - 3, 11, 1.6]), at([UPRIGHT.x1 + 3, -11, 1.6])], { size: 0.45 }));
  put(S(box(UPRIGHT.x0, UPRIGHT.x1, -9, 9, 1.6, ZD + 16, 2, 0.6, 1.5), { tone: "mid" }));
  put(S(discX(UPRIGHT.x0 - 1, ROTOR.x0 - 2, 9, 0, ZD), { tone: "mid" }));

  // tyre with the rim's hole, then the rim seen through it
  const tyre = [[WHEEL.x0 + 1, WHEEL.rim], [WHEEL.x0, WHEEL.rim + 4], [WHEEL.x0 + 0.4, 43, 1], [WHEEL.x0 + 2.4, 47.6, 1], [WHEEL.x0 + 6, WHEEL.r], [WHEEL.x1 - 6, WHEEL.r], [WHEEL.x1 - 2.4, 47.6, 1], [WHEEL.x1 - 0.4, 43, 1], [WHEEL.x1, WHEEL.rim + 4], [WHEEL.x1 - 1, WHEEL.rim]];
  put(S(G.lathe(tyre, SH_F, P, { hole: [WHEEL.x1 - 1, WHEEL.rim] }), { tone: "mid", inner: Ln(G.arcOf(SH_F, WHEEL.x0 + 9, WHEEL.r, P) + G.arcOf(SH_F, WHEEL.x1 - 9, WHEEL.r, P), { tone: "faint" }) }));
  live("tread");
  const hole = G.circleOf(SH_F, WHEEL.x1 - 1, WHEEL.rim, P, 96);
  defs.push(`<clipPath id="eng-rim"><path d="${hole}"/></clipPath>`);
  defs.push(`<clipPath id="eng-well"><path d="${G.circleOf(SH_F, WHEEL.x0 + 1, WHEEL.rim - 1, P, 96)}"/></clipPath>`);
  put(`<g clip-path="url(#eng-rim)">`);
  // rim barrel, concave, seen from inside
  for (let i = 0; i < 48; i++) {
    const a0 = (i / 48) * TAU;
    const a1 = ((i + 1) / 48) * TAU;
    const mid = (a0 + a1) / 2;
    const n = [0, -Math.cos(mid), -Math.sin(mid)];
    if (G.dot3(n, V) <= 0) continue;
    const p = (a, x) => [x, (WHEEL.rim - 1) * Math.cos(a), ZD + (WHEEL.rim - 1) * Math.sin(a)];
    put(cavSvg([p(a0, WHEEL.x0 + 1), p(a1, WHEEL.x0 + 1), p(a1, WHEEL.x1 - 1), p(a0, WHEEL.x1 - 1)], Math.min(3, G.toneOf(n, P))));
  }
  put(`<g clip-path="url(#eng-well)">`);
  put(S(discX(ROTOR.x0 - 2, ROTOR.x0, 10, 0, ZD), { tone: "mid" }));
  put(S(G.ringBand(ROTOR.x0, ROTOR.x1, 12, ROTOR.r, SH_F, P), { tone: "mid" }));
  live("rotor");
  // caliper on the upright, over the rotor's back-top edge
  const cal = [];
  for (const [r, a] of [[19, 118], [30, 118], [30, 152], [19, 152]]) cal.push([r * Math.cos(a * RAD), ZD + r * Math.sin(a * RAD)]);
  put(S(prismX(cal, ROTOR.x0 - 3, ROTOR.x1 + 3), { tone: "hi" }));
  put(S(discX(ROTOR.x1, WHEEL.x0 + 2, 10, 0, ZD), { tone: "mid" }));
  put(`</g>`);
  live("spokes");
  put(S(discX(WHEEL.face - 3.2, WHEEL.face + 0.8, 10.4, 0, ZD), { tone: "hi" }));
  put(S(discX(WHEEL.face + 0.8, WHEEL.face + 2.2, 4.4, 0, ZD), { tone: "mid" }));
  live("lugs");
  put(`</g>`);
  put(S(G.ringBand(WHEEL.x1 - 4, WHEEL.x1 - 0.6, WHEEL.rim - 1.4, WHEEL.rim + 1.2, SH_F, P, { hole: [WHEEL.x1 - 0.6, WHEEL.rim - 1.4] }), { tone: "hi" }));
  // front roller after the wheel
  put(S(box(ROLLER.x0 - 4, ROLLER.x0, ROLLER_Y - 7, ROLLER_Y + 7, 0, ROLLER.z + 4, 2, 0.4, 1), { tone: "mid" }));
  put(S(discX(ROLLER.x0, ROLLER.x1, ROLLER.r, ROLLER_Y, ROLLER.z), { tone: "mid" }));
  live("rollerF");
  put(S(box(ROLLER.x1, ROLLER.x1 + 4, ROLLER_Y - 7, ROLLER_Y + 7, 0, ROLLER.z + 4, 2, 0.4, 1), { tone: "mid" }));

  return { defs: defs.join(""), back: back.join(""), front: front.join(""), frame: f };
}
