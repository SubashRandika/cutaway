// The static drawing, in painter's order, with the live slots placed where their
// parts physically sit. The figure has no shader, so it is one SVG.

import * as k from "../../iso/iso-kit.mjs";
import * as G from "../../iso/lathe.mjs";
import { tubePieces, tubeSvg } from "../../iso/tube.mjs";
import {
  P, at, BASE, CONT, DECK, RPV, SHIELD, CORE, ROD, RCCA_X, CRDM, SG, PZR, RCP, CRANE, ZT, HP, LP, GEN, EXC, BEARINGS, COND, MSR, VALVE, MSIV,
  FEEDPUMP, BREAKER, BUS_Y, BUS_Z, XFMR, LV_X, HV_X, HV_Y, HV_TOP, GANTRY, CANAL, CWP, DESK,
} from "./view.mjs";
import { frameOf, liveMarkup, SHAFT_F, HP_ROWS, LP_ROWS, STRIPES, RCP_F, FEED_F, CWP_F, PZR_INNER, DIALS, PANEL_Y, RODSCALE, STEM_LIFT } from "./frame.mjs";
import { S, Ln, Dt, box, plan, path3, ring3, FX, discX, cutSvg, cavSvg, clipSvg, rect, RAD, V } from "./parts.mjs";
import { arcZR, halfVessel, insideRing, turned } from "./shapes.mjs";

export const REST_STATE = { bank: 0.727, shutdown: 1, heat: 1, tavg: 307.2, level: 0.61, valve: 1, dump: 0, mwe: 1160, online: true, scram: false, turbine: 0, pump: 0, feed: 0, cw: 0, flow: {} };

const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const FZ = (x, y) => G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const unit = (v) => G.unit3(v);

// Pipes that carry a flow are cut into short chunks, keyed so the live code can light them
// one after another in the direction the water, steam or current moves.
const routes = {};
function pipe(name, points, r, { bend = 0, maxLength = 4.6, tone = "mid" } = {}) {
  const route = G.fillet(points, Math.max(2.6, bend || r * 2.4), 8, { P, tube: r });
  const pieces = tubePieces(route, r, P, { maxLength });
  routes[name] = pieces.length;
  return pieces.map((piece, i) => ({ piece, svg: `<g class="npp-pipe" data-k="${name}.${i}">${tubeSvg(piece, { tone })}</g>` }));
}
const putAll = (put, list, keep = () => true) => {
  for (const { piece, svg } of list) if (keep(piece.mid)) put(svg);
};

// a stub along a direction from a point: a short turned nozzle
const stub = (from, dir, length, r, tone = "mid") => S(G.disc(0, length, r, G.frameAlong(from, dir), P), { tone });
const flangeAt = (from, dir, r, tone = "mid") => S(G.disc(-0.7, 0.7, r, G.frameAlong(from, dir), P), { tone });

// A round dial on a face that looks along +y: bezel, face, ticks.
function dialFace(x, y, z, r, span, count, major) {
  const F = G.frameOf([x, y, z], [0, 1, 0], [0, 0, 1], [1, 0, 0]);
  const out = [];
  out.push(S(G.ringBand(-0.2, 1, r - 0.8, r + 0.7, F, P, { hole: [1, r - 0.8] }), { tone: "mid" }));
  out.push(`<path class="npp-dial" d="${G.circleOf(F, 0.3, r - 0.8, P, 56)}"/>`);
  const minor = [];
  const big = [];
  for (let i = 0; i <= count; i++) {
    const deg = -span / 2 + (span * i) / count;
    const isMajor = i % major === 0;
    const p0 = [x + (r - 1.05) * Math.sin(deg * RAD), y + 0.35, z + (r - 1.05) * Math.cos(deg * RAD)];
    const p1 = [x + (r - (isMajor ? 2.3 : 1.7)) * Math.sin(deg * RAD), y + 0.35, z + (r - (isMajor ? 2.3 : 1.7)) * Math.cos(deg * RAD)];
    (isMajor ? big : minor).push(k.pathOf([at(p0), at(p1)]));
  }
  out.push(Ln(minor.join(""), { tone: "lo" }), Ln(big.join(""), { tone: "mid" }));
  return out.join("");
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
    [BASE.x + 22, BASE.y + 18], [BASE.x + BASE.w - 22, BASE.y + 18], [BASE.x + 22, BASE.y + BASE.d - 18],
    [BASE.x + BASE.w - 22, BASE.y + BASE.d - 18], [BASE.x + BASE.w / 2, BASE.y + 18], [BASE.x + BASE.w / 2, BASE.y + BASE.d - 18],
  ]);
  for (const [x, y] of feet) put(S(k.cylinder(x, y, 7, -12, 1.6, P, 28), { tone: "lo" }), S(k.cylinder(x, y, 5.4, -10.4, 3.4, P, 28), { tone: "mid" }));
  put(S(k.slabOf(BASE, -7, 7, P, 8, 1.6), { tone: "mid", inner: Ln(k.sideSeam(BASE, -3.4, P, 8), { tone: "faint" }) }));
  put(Ln(k.planOutline(k.insetPlan(BASE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(BASE, 10);
  put(Ln(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }), Dt(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  {
    const strip = plan(70, 180, BASE.y + BASE.d - 21, BASE.y + BASE.d - 14, 1);
    put(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
    const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
    put(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
    const label = plan(-60, -16, BASE.y + BASE.d - 16, BASE.y + BASE.d - 5, 1.6);
    put(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }), Ln(k.planOutline(k.insetPlan(label, 1.6), 0.8, P), { tone: "faint" }));
    put(Ln([0, 1, 2].map((row) => k.lineOnTop([label.x + 7, label.y + 3.2 + row * 2.3], [label.x + (row === 1 ? 26 : 36), label.y + 3.2 + row * 2.3], 0.8, P)).join(""), { tone: "lo", free: true }));
    put(Dt([at([label.x + 3.2, label.y + label.d / 2, 0.8]), at([label.x + label.w - 3.2, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  }

  // ================= containment: basemat, then the back half's inside =================
  const C = CONT;
  put(S(k.cylinder(C.x, C.y, C.mat, 0, DECK, P, 120, 0.8), { tone: "lo", inner: Ln(k.sideArc(C.x, C.y, C.mat, DECK - 2.2, P, 96), { tone: "faint" }) }));
  // the floor's grating and the edge of the cut wall's footing, drawn on the basemat
  put(Ln(k.ring(C.x, C.y, C.r + C.wall + 1.8, DECK, P, 120), { tone: "faint" }));
  const outerC = [[C.z0, C.r + C.wall], [C.z1, C.r + C.wall], ...arcZR(C.z1, C.domeOut, C.r + C.wall, 0, 90, 16).slice(1)];
  const innerC = [[C.z0, C.r], [C.z1, C.r], ...arcZR(C.z1, C.dome, C.r, 0, 90, 16).slice(1)];
  const shell = halfVessel(C.x, C.y, outerC, innerC, { steps: 64, inner: "npp-inwall", open: true });
  put(shell.back);
  // the liner's horizontal seams and the ring girder's corbel line on the inside of the wall
  {
    const seams = [];
    for (let z = 22; z < C.z1; z += 16) seams.push(G.arcOf(FZ(C.x, C.y), z, C.r, P, { inward: true, from: Math.PI, to: 2 * Math.PI }));
    put(Ln(seams.join(""), { tone: "faint" }));
  }

  // ================= the polar crane, parked across the back =================
  {
    const b = plan(CRANE.x0 + 3, CRANE.x1 - 3, CRANE.y - 3, CRANE.y + 3, 0.6);
    for (const x of [CRANE.x0 + 3, CRANE.x1 - 6]) put(S(box(x, x + 3, CRANE.y - 5, CRANE.y + 5, CRANE.z - 3, CRANE.z + 1, 2, 0.3, 0.6), { tone: "mid" }));
    put(S(k.slabOf(b, CRANE.z, 4, P, 2, 0.4), { tone: "mid", inner: Ln(k.sideSeam(b, CRANE.z + 2, P, 2), { tone: "faint" }) }));
    const ribs = [];
    for (let x = b.x + 4; x < b.x + b.w - 2; x += 4.6) ribs.push(path3([[x, b.y + b.d, CRANE.z + 0.6], [x, b.y + b.d, CRANE.z + 3.4]]));
    put(Ln(ribs.join(""), { tone: "lo" }));
    const tx = -176;
    put(S(box(tx - 4, tx + 4, CRANE.y - 4, CRANE.y + 4, CRANE.z + 4, CRANE.z + 8, 2, 0.4, 0.8), { tone: "mid" }));
    put(Ln(path3([[tx - 1, CRANE.y, CRANE.z]]) + path3([[tx - 1, CRANE.y, CRANE.z], [tx - 1, CRANE.y, 86]]) + path3([[tx + 1, CRANE.y, CRANE.z], [tx + 1, CRANE.y, 86]]), { tone: "mid" }));
    put(S(box(tx - 2, tx + 2, CRANE.y - 1.4, CRANE.y + 1.4, 82, 86, 2, 0.3, 0.6), { tone: "mid" }));
    put(Ln(path3([[tx, CRANE.y, 82], [tx, CRANE.y, 80.4], [tx + 1.2, CRANE.y, 79.6], [tx + 1.2, CRANE.y, 78.4]]), { tone: "hi" }));
  }

  // ================= pressuriser on its platform =================
  {
    const pf = plan(PZR.x - 9, PZR.x + 9, PZR.y - 9, PZR.y + 9, 0.8);
    for (const [x, y] of byDepth(k.corners(pf, 1.6))) put(S(k.cylinder(x, y, 1, DECK, PZR.platform - 2 - DECK, P, 12), { tone: "lo" }));
    put(S(k.slabOf(pf, PZR.platform - 2, 2, P, 2, 0.3), { tone: "mid" }));
    put(S(k.cylinder(PZR.x, PZR.y, 4.4, PZR.platform, PZR.z0 + 2 - PZR.platform, P, 32), { tone: "mid" }));
    const outer = [[PZR.z0, 0], ...arcZR(PZR.z0 + PZR.r, PZR.r, PZR.r, -90, 0, 8), ...arcZR(PZR.z1 - PZR.r, PZR.r, PZR.r, 0, 90, 8)];
    const v = halfVessel(PZR.x, PZR.y, outer, [[PZR.z0 + 1, 0], ...PZR_INNER, [PZR.z1 - 1, 0]], { steps: 32 });
    put(v.back);
    live("prz.water");
    // the heater bundle up from the bottom, the spray head under the top
    const heaters = [];
    for (const dx of [-3, -1.5, 0, 1.5, 3]) heaters.push(path3([[PZR.x + dx, PZR.y, PZR.z0 + 1.6], [PZR.x + dx, PZR.y, PZR.z0 + 14]]));
    put(`<g class="npp-heat">${Ln(heaters.join(""), { tone: "mid" })}</g>`);
    put(Ln(path3([[PZR.x - 2.4, PZR.y, PZR.z1 - 2.4], [PZR.x + 2.4, PZR.y, PZR.z1 - 2.4]]), { tone: "mid" }), Dt([-1.6, 0, 1.6].map((dx) => at([PZR.x + dx, PZR.y, PZR.z1 - 3])), { size: 0.35, tone: "mid" }));
    put(v.outside, v.cut);
    put(S(k.cylinder(PZR.x + 1.6, PZR.y - 2, 0.9, PZR.z1 - 0.6, 2.4, P, 12), { tone: "mid" }), S(k.cylinder(PZR.x + 1.6, PZR.y - 2, 1.5, PZR.z1 + 1.4, 0.8, P, 14), { tone: "mid" }));
  }

  // ================= the hot leg's far end, the steam generator, its crossover leg, the pump =================
  const hot = RPV;
  const aHot = -15 * RAD;
  const aCold = -40 * RAD;
  const dHot = [Math.cos(aHot), Math.sin(aHot), 0];
  const dCold = [Math.cos(aCold), Math.sin(aCold), 0];
  const SGC = [SG.x, SG.y, SG.head];
  const inHot = unit([-0.68, -0.28, -0.68]);
  const outCold = unit([0.68, -0.28, -0.68]);
  const plus = (p, d, s) => [p[0] + d[0] * s, p[1] + d[1] * s, p[2] + d[2] * s];
  const nozzleHot = plus([hot.x, hot.y, hot.nozzleZ], dHot, 16.4);
  const hotLeg = pipe("hot", [nozzleHot, plus(nozzleHot, dHot, 4), [-160.8, -27, 40.2], plus(SGC, inHot, 16), plus(SGC, inHot, 11.2)], 2.6, { bend: 5 });
  putAll(put, hotLeg, (m) => m[0] > -160);
  const cross = pipe("cross", [plus(SGC, outCold, 11.2), plus(SGC, outCold, 15), [-133.4, -26.2, 9.6], [-133.4, -36, 9.6], [RCP.x, RCP.y, 9.6], [RCP.x, RCP.y, RCP.bowl[0] - 4]], 2.4, { bend: 5 });
  {
    const lower = [[SG.head - SG.headR, 0], ...arcZR(SG.head, SG.headR, SG.headR, -90, 0, 10).slice(1), [SG.lower[1], SG.r]];
    const outer = [...lower, ...[[SG.cone[1], SG.R], [SG.upper[1], SG.R]], ...arcZR(SG.upper[1], SG.top - SG.upper[1], SG.R, 0, 90, 10).slice(1)];
    const w = SG.wall;
    const inner = [[SG.head - SG.headR + w, 0], ...arcZR(SG.head, SG.headR - w, SG.headR - w, -90, 0, 10).slice(1), [SG.lower[1], SG.r - w], [SG.cone[1], SG.R - w], [SG.upper[1], SG.R - w], ...arcZR(SG.upper[1], SG.top - SG.upper[1] - w, SG.R - w, 0, 90, 10).slice(1)];
    const v = halfVessel(SG.x, SG.y, outer, inner, { steps: 36 });
    // its skirt and the two support columns under the channel head
    for (const dx of [-6, 6]) put(S(box(SG.x + dx - 1.4, SG.x + dx + 1.4, SG.y - 6, SG.y - 3, DECK, SG.head - 3, 2, 0.3, 0.6), { tone: "mid" }));
    put(stub(plus(SGC, inHot, SG.headR - 0.6), inHot, 3.4, 3.4), stub(plus(SGC, outCold, SG.headR - 0.6), outCold, 3.4, 3.1));
    put(v.back);
    const ring = insideRing(SG.x, SG.y, inner);
    defs.push(clipSvg("npp-sg", [ring]));
    put(`<g clip-path="url(#npp-sg)">`);
    put(`<path class="npp-water" d="${ring3(rect(SG.x - SG.R, SG.x + SG.R, SG.head - SG.headR, SG.level).map(([x, z]) => [x, SG.y, z]))}"/>`);
    put(Ln(path3([[SG.x - SG.R, SG.y, SG.level], [SG.x + SG.R, SG.y, SG.level]]), { tone: "mid" }));
    put(`</g>`);
    // channel head divider, tube sheet, the tube bundle's wrapper and its U-tubes
    put(cutSvg([rect(SG.x - 0.5, SG.x + 0.5, SG.head - SG.headR + w, SG.sheet[0]).map(([x, z]) => [x, SG.y, z])]));
    put(cutSvg([rect(SG.x - SG.r + w, SG.x + SG.r - w, SG.sheet[0], SG.sheet[1]).map(([x, z]) => [x, SG.y, z])]));
    const wrap = SG.r - w - 1.2;
    put(cutSvg([rect(SG.x - wrap - 0.4, SG.x - wrap, SG.sheet[1] + 3, SG.bend + 9.6).map(([x, z]) => [x, SG.y, z]), rect(SG.x + wrap, SG.x + wrap + 0.4, SG.sheet[1] + 3, SG.bend + 9.6).map(([x, z]) => [x, SG.y, z])]));
    const tubes = [];
    for (let i = 0; i < 6; i++) {
      const dx = 1.1 + i * 1.12;
      const pts = [[SG.x - dx, SG.y, SG.sheet[1]], [SG.x - dx, SG.y, SG.bend]];
      for (let s = 1; s < 12; s++) {
        const t = Math.PI - (s / 12) * Math.PI;
        pts.push([SG.x + dx * Math.cos(t), SG.y, SG.bend + dx * Math.sin(t)]);
      }
      pts.push([SG.x + dx, SG.y, SG.bend], [SG.x + dx, SG.y, SG.sheet[1]]);
      tubes.push(path3(pts));
    }
    put(`<g class="npp-tubes">${Ln(tubes.join(""), { tone: "mid" })}</g>`);
    const supports = [];
    for (const z of [61, 67, 73]) supports.push(path3([[SG.x - wrap, SG.y, z], [SG.x + wrap, SG.y, z]]));
    put(Ln(supports.join(""), { tone: "lo" }));
    // the feed ring, the swirl-vane separators and the chevron dryers above the water
    put(Dt([at([SG.x - SG.R + 2.6, SG.y, 92.6]), at([SG.x + SG.R - 2.6, SG.y, 92.6])], { size: 0.9, tone: "mid" }));
    const deck = cutSvg([rect(SG.x - SG.R + w, SG.x + SG.R - w, 89.4, 90.2).map(([x, z]) => [x, SG.y, z])]);
    put(deck);
    for (const dx of [-6.4, 0, 6.4]) {
      put(cutSvg([rect(SG.x + dx - 2.2, SG.x + dx - 1.8, 90.2, 99).map(([x, z]) => [x, SG.y, z]), rect(SG.x + dx + 1.8, SG.x + dx + 2.2, 90.2, 99).map(([x, z]) => [x, SG.y, z])]));
      put(Ln([0, 1, 2].map((i) => path3([[SG.x + dx - 1.8, SG.y, 92 + i * 2], [SG.x + dx + 1.8, SG.y, 93.2 + i * 2]])).join(""), { tone: "lo" }));
    }
    const chevron = [];
    for (let i = 0; i <= 18; i++) chevron.push([SG.x - 9.6 + i * (19.2 / 18), SG.y, 101.6 + (i % 2 ? 1.4 : 0)]);
    put(Ln(path3(chevron) + path3([[SG.x - 9.6, SG.y, 101], [SG.x + 9.6, SG.y, 101]]) + path3([[SG.x - 9.6, SG.y, 103.6], [SG.x + 9.6, SG.y, 103.6]]), { tone: "mid" }));
    put(v.outside, v.cut);
    put(stub([SG.x, SG.y, SG.top - 0.6], [0, 0, 1], SG.nozzle - SG.top + 0.6, 3.2), flangeAt([SG.x, SG.y, SG.nozzle], [0, 0, 1], 4));
    // manways on the upper shell's visible flank
    const mw = G.frameAlong([SG.x + SG.R * Math.cos(-20 * RAD), SG.y + SG.R * Math.sin(-20 * RAD), 98], [Math.cos(-20 * RAD), Math.sin(-20 * RAD), 0]);
    put(S(G.disc(-0.4, 1.4, 2.6, mw, P), { tone: "mid" }), Dt(G.dotsOf(mw, 1.4, 2, 8, P, { all: true }), { size: 0.35 }));
  }
  putAll(put, cross);
  // the reactor coolant pump: bowl, motor stand with its coupling, motor, flywheel cover
  {
    const R = RCP;
    put(S(k.cylinder(R.x, R.y, 2.6, R.bowl[0] - 4, 4.4, P, 20), { tone: "mid" }));
    put(S(turned([[R.bowl[0], 0], [R.bowl[0], 3], [R.bowl[0] + 1.6, R.r, 1], [R.bowl[1] - 1.6, R.r, 1], [R.bowl[1], R.r - 0.4], [R.bowl[1], 0]], R.x, R.y), { tone: "mid" }));
    put(S(k.cylinder(R.x, R.y, R.r + 0.8, R.bowl[1] - 0.6, 1.2, P, 32), { tone: "mid" }), Dt(G.dotsOf(RCP_F, R.bowl[1] + 0.6, R.r + 0.2, 10, P, { phase: 0.2 }), { size: 0.4 }));
    for (const a of [135, 225, 315, 45].map((d) => d * RAD).sort((p, q) => Math.sin(p) + Math.cos(p) - Math.sin(q) - Math.cos(q))) {
      put(S(k.cylinder(R.x + 3.6 * Math.cos(a), R.y + 3.6 * Math.sin(a), 0.7, R.bowl[1] + 0.6, R.motor[0] - R.bowl[1] - 0.6, P, 10), { tone: "lo" }));
    }
    put(S(k.cylinder(R.x, R.y, 1.9, R.bowl[1] + 0.6, R.motor[0] - R.bowl[1], P, 20), { tone: "mid" }));
    live("rcp");
    put(S(turned([[R.motor[0], 0], [R.motor[0], R.mr], [R.motor[1] - 1, R.mr, 1], [R.motor[1], R.mr - 0.8, 1], [R.motor[1], 0]], R.x, R.y), { tone: "mid", inner: Ln([42, 46, 50, 54].map((z) => G.arcOf(RCP_F, z, R.mr, P)).join(""), { tone: "faint" }) }));
    put(S(turned([[R.motor[1], 0], [R.motor[1], 3.8], [R.motor[1] + 2.6, 3.8, 1], [R.motor[1] + 3.6, 2.4, 1], [R.motor[1] + 3.8, 0]], R.x, R.y), { tone: "mid" }));
    // its discharge nozzle, toward the reactor
    put(stub([R.x, R.y + R.r - 0.6, 26], [0, 1, 0], 2.4, 2.6));
  }

  // ================= the reactor in its shield =================
  const nozzleCold = plus([hot.x, hot.y, hot.nozzleZ], dCold, 16.4);
  const cold = pipe("cold", [[RCP.x, RCP.y + RCP.r + 1.8, 26], [RCP.x, RCP.y + 12, 26], plus(nozzleCold, dCold, 7.4), nozzleCold], 2.4, { bend: 5 });
  {
    // primary shield: a thick concrete ring round the vessel's lower half, cut on y = 0
    const sh = halfVessel(hot.x, hot.y, [[DECK, SHIELD.r1], [SHIELD.z1, SHIELD.r1]], [[DECK, SHIELD.r0], [SHIELD.z1, SHIELD.r0]], { steps: 40, inner: "npp-inwall", open: true });
    put(sh.back);
    // the cavity floor's drain and the vessel's skirt support blocks
    for (const dx of [-9, 9]) put(S(box(hot.x + dx - 1.6, hot.x + dx + 1.6, -4, -1, DECK, 20, 2, 0.3, 0.6), { tone: "mid" }));
  }
  const outerR = [[hot.bottom, 0], ...arcZR(hot.shell0, hot.shell0 - hot.bottom, hot.r, -90, 0, 10).slice(1), [hot.flange[0], hot.r], [hot.flange[0], hot.flangeR], [hot.flange[1], hot.flangeR], [hot.flange[1], hot.r], ...arcZR(hot.head, hot.r, hot.r, 0, 90, 10).slice(1)];
  const ri = hot.r - hot.wall;
  const innerR = [[hot.bottom + hot.wall, 0], ...arcZR(hot.shell0, hot.shell0 - hot.bottom - hot.wall, ri, -90, 0, 10).slice(1), [hot.head, ri], ...arcZR(hot.head, ri, ri, 0, 90, 10).slice(1)];
  const vessel = halfVessel(hot.x, hot.y, outerR, innerR, { steps: 40 });
  put(vessel.back);
  {
    const X = hot.x;
    const Y = hot.y;
    const inside = insideRing(X, Y, innerR);
    defs.push(clipSvg("npp-rpv", [inside]));
    put(`<path class="npp-water" d="${ring3(inside)}"/>`);
    put(`<g clip-path="url(#npp-rpv)">`);
    // core barrel, lower support plate, upper core plate, upper support plate
    const plane = ([x, z]) => [x, Y, z];
    const b = CORE.barrel;
    put(cutSvg([rect(X - b - 0.7, X - b, 15, 55).map(plane), rect(X + b, X + b + 0.7, 15, 55).map(plane)]));
    put(cutSvg([rect(X - b, X + b, 16, 18).map(plane), rect(X - b, X + b, CORE.z1 + 1, CORE.z1 + 2).map(plane), rect(X - b - 1.6, X + b + 1.6, 52.6, 54.4).map(plane)]));
    // the fuel: seven assemblies across the cut, rods, grids and nozzles
    const pitch = (CORE.half * 2) / CORE.assemblies;
    const faces = [];
    const rodsL = [];
    const grids = [];
    for (let i = 0; i < CORE.assemblies; i++) {
      const x0 = X - CORE.half + i * pitch + 0.12;
      const x1 = x0 + pitch - 0.24;
      faces.push(rect(x0, x1, CORE.z0, CORE.z1).map(plane));
      for (let j = 1; j < 5; j++) rodsL.push(path3([[x0 + (j * (x1 - x0)) / 5, Y, CORE.z0 + 0.3], [x0 + (j * (x1 - x0)) / 5, Y, CORE.z1 - 0.3]]));
      for (let g = 0; g < 6; g++) grids.push(path3([[x0, Y, CORE.z0 + 1.6 + g * 3.4], [x1, Y, CORE.z0 + 1.6 + g * 3.4]]));
      put(cutSvg([rect(x0 + 0.2, x1 - 0.2, CORE.z1, CORE.z1 + 1).map(plane), rect(x0 + 0.2, x1 - 0.2, CORE.z0 - 1, CORE.z0).map(plane)]));
    }
    put(`<path class="npp-fuel" d="${faces.map(ring3).join("")}"/>`);
    put(`<path class="npp-glow" data-k="glow" style="opacity:${f["glow@o"]}" d="${faces.map(ring3).join("")}"/>`);
    put(Ln(rodsL.join(""), { tone: "lo" }), Ln(grids.join(""), { tone: "mid" }));
    // guide columns over the clusters, between the upper core plate and the support plate
    put(cutSvg(RCCA_X.flatMap((dx) => [rect(X + dx - 1.5, X + dx - 1.1, CORE.z1 + 2, 52.6).map(plane), rect(X + dx + 1.1, X + dx + 1.5, CORE.z1 + 2, 52.6).map(plane)])));
    put(`</g>`);
    // the rods: three clusters of bank D and, between them, two shutdown clusters, each with its drive shaft
    const housings = RCCA_X.map((dx) => rect(X + dx - 0.9, X + dx + 0.9, 64, CRDM.top).map(plane));
    const shutX = [-2.7, 2.7];
    const sdHousings = shutX.map((dx) => rect(X + dx - 0.9, X + dx + 0.9, 64, CRDM.top).map(plane));
    defs.push(clipSvg("npp-rods", [inside, ...housings, ...sdHousings]));
    const cluster = (dx, lit) => {
      const x = X + dx;
      const tip = ROD.tip0;
      const top = tip + ROD.length;
      const lines = [-0.55, 0.55].map((o) => path3([[x + o, Y + 0.1, tip], [x + o, Y + 0.1, top]])).join("");
      const spider = path3([[x - 1, Y + 0.1, top], [x + 1, Y + 0.1, top]]);
      const shaft = path3([[x, Y + 0.1, top], [x, Y + 0.1, top + 30]]);
      return `<g class="npp-rod"${lit ? " data-bank" : ""}>${Ln(lines + spider, { tone: "hi" })}${Ln(shaft, { tone: "mid" })}${Dt([at([x, Y + 0.1, top])], { size: 0.5, tone: "hi" })}</g>`;
    };
    put(`<g clip-path="url(#npp-rods)">`);
    put(moving("sdrods", shutX.map((dx) => cluster(dx, false)).join("")));
    put(moving("rods", RCCA_X.map((dx) => cluster(dx, true)).join("")));
    put(`</g>`);
  }
  // nozzles on the visible flank, then the vessel's outside and its section
  put(vessel.outside);
  put(stub(plus([hot.x, hot.y, hot.nozzleZ], dHot, hot.r - 0.6), dHot, 4, 3.6), stub(plus([hot.x, hot.y, hot.nozzleZ], dCold, hot.r - 0.6), dCold, 4, 3.4));
  // the drive housings behind the cut, standing on the head
  for (const [dy, xs] of CRDM.rows) {
    for (const dx of [...xs].sort((a, b) => a - b)) {
      const z0 = hot.head + Math.sqrt(Math.max(0, hot.r * hot.r - dx * dx - dy * dy)) - 0.4;
      put(S(k.cylinder(hot.x + dx, hot.y + dy, CRDM.r, z0, CRDM.top - z0, P, 14), { tone: "mid", crease: "none" }));
      put(S(k.cylinder(hot.x + dx, hot.y + dy, CRDM.r + 0.7, 78, 8, P, 16), { tone: "mid", inner: Ln(k.sideArc(hot.x + dx, hot.y + dy, CRDM.r + 0.7, 82, P, 12), { tone: "faint" }) }));
    }
  }
  put(vessel.cut);
  // the cut housings over the drawn clusters and the head's studs on the flange
  {
    const plane = ([x, z]) => [x, hot.y, z];
    const strips = [];
    for (const dx of [...RCCA_X, -2.7, 2.7]) {
      const z0 = hot.head + Math.sqrt(hot.r * hot.r - dx * dx) - 0.6;
      strips.push(rect(hot.x + dx - 1.4, hot.x + dx - 0.9, z0, CRDM.top).map(plane), rect(hot.x + dx + 0.9, hot.x + dx + 1.4, z0, CRDM.top).map(plane));
      strips.push(rect(hot.x + dx - 2.1, hot.x + dx - 1.4, 78, 86).map(plane), rect(hot.x + dx + 1.4, hot.x + dx + 2.1, 78, 86).map(plane));
    }
    put(cutSvg(strips));
    put(Dt([-14.6, 14.6].map((dx) => at([hot.x + dx, hot.y, hot.flange[1] + 0.4])), { size: 0.55 }));
    put(Dt(G.dotsOf(FZ(hot.x, hot.y), hot.flange[1], hot.flangeR - 0.9, 28, P, { from: Math.PI, phase: 0 }).filter(([x, y]) => y < at([hot.x, hot.y, hot.flange[1]])[1] + 4), { size: 0.4 }));
  }
  // the shield's cut and the cold leg, the hot leg's near end, the surge line
  {
    const sh = halfVessel(hot.x, hot.y, [[DECK, SHIELD.r1], [SHIELD.z1, SHIELD.r1]], [[DECK, SHIELD.r0], [SHIELD.z1, SHIELD.r0]], { steps: 40, inner: "npp-inwall", open: true });
    put(sh.outside, sh.cut);
  }
  putAll(put, cold);
  putAll(put, hotLeg, (m) => m[0] <= -160);
  const surge = pipe("surge", [[PZR.x, PZR.y, PZR.platform - 2], [PZR.x, PZR.y, 31], [-188, -30, 31], [-170.6, -14, 31], [-170.6, -12.6, 37.6]], 1.1, { bend: 3 });
  putAll(put, surge);

  // ================= steam and feed lines inside, then the containment's skin and section =================
  const steam = pipe("steam", [[SG.x, SG.y, SG.nozzle + 0.7], [SG.x, SG.y, 117], [-127, -22, 117], [-127, -22, 96], [MSIV.x + 1, -22, 96], [-100, -22, 96], [-100, -22, VALVE.z - 2], [VALVE.x - 4.2, -22, VALVE.z - 2]], 2.6, { bend: 4.4 });
  const feed = pipe("feed", [[FEEDPUMP.x + 4, FEEDPUMP.y, FEEDPUMP.z + 4.6], [FEEDPUMP.x + 4, FEEDPUMP.y, 80], [-104, -31.3, 80], [-124, -31.3, 80], [-124, -31.3, 93], [-136.2, -31.3, 93]], 1.9, { bend: 4 });
  const wallX = (y) => C.x + Math.sqrt((C.r + C.wall) ** 2 - y * y);
  putAll(put, feed, (m) => m[0] < wallX(-31.3) - 2);
  putAll(put, steam, (m) => m[0] < wallX(-22) - 2);
  put(shell.outside);
  {
    // the post-tensioning: tendon rings on the visible flank, a buttress, the equipment hatch
    const F = FZ(C.x, C.y);
    const rings = [];
    for (let z = 14; z < C.z1; z += 7) rings.push(G.arcOf(F, z, C.r + C.wall, P, { from: -48 * RAD, to: 0 }));
    put(Ln(rings.join(""), { tone: "faint" }));
    const a = -24 * RAD;
    const HF = G.frameAlong([C.x + (C.r + C.wall) * Math.cos(a), C.y + (C.r + C.wall) * Math.sin(a), 30], [Math.cos(a), Math.sin(a), 0]);
    put(S(G.ringBand(-0.4, 1.6, 6.2, 8, HF, P), { tone: "mid" }), S(G.disc(-0.4, 1, 6.2, HF, P), { tone: "mid" }));
    put(Dt(G.dotsOf(HF, 1.6, 7.1, 16, P, { all: true }), { size: 0.4 }));
    // penetration sleeves where the steam and feed lines leave
    for (const [y, z, r] of [[-22, 96, 4], [-31.3, 80, 3.2]]) put(stub([wallX(y) - 0.4, y, z], [1, 0, 0], 1.8, r));
  }
  put(shell.cut);
  {
    // the liner on the section, and a band of rebar dots in the dome
    const inset = (m, by) => m.map(([z, r]) => [z, r + by]);
    const liner = [...inset(innerC, 0.7)];
    const right = liner.map(([z, r]) => [C.x + r, C.y, z]);
    const left = liner.map(([z, r]) => [C.x - r, C.y, z]);
    put(Ln(path3(right) + path3(left), { tone: "lo" }));
  }
  putAll(put, feed, (m) => m[0] >= wallX(-31.3) - 2);

  // ================= turbine hall, back row: dump line, feed pump, MSR on its legs =================
  const dumpLine = pipe("dump", [[-100, -24.4, 86], [-100, -42, 86], [-100, -42, 26], [-50, -42, 26], [-50, -22, 26], [-50, -22, COND.z1 + 0.6]], 1.6, { bend: 3.6 });
  putAll(put, dumpLine, (m) => m[1] < -30);
  {
    // the dump valve on the vertical run, its stem rising with its opening
    const y = -42;
    put(S(k.cylinder(-100, y, 2.8, 52, 6, P, 22), { tone: "mid" }), S(k.cylinder(-100, y, 3.2, 57.4, 1, P, 22), { tone: "mid" }));
    put(moving("dump", S(k.cylinder(-100, y, 0.6, 58.4, 4.4, P, 10), { tone: "mid", crease: "none" }) + S(k.cylinder(-100, y, 1.6, 62.8 - 0.01, 0.9, P, 16), { tone: "hi" })));
    put(S(box(-102.2, -97.8, y - 1.6, y + 1.6, 62, 63, 2, 0.2, 0.4), { tone: "lo" }));
  }
  {
    // feed pump: motor, coupling, pump casing on one skid
    const Fp = FEEDPUMP;
    put(S(box(Fp.x - 12, Fp.x + 8, Fp.y - 6, Fp.y + 6, 0, 2.4, 2, 0.4, 1), { tone: "lo" }), Dt(k.corners(plan(Fp.x - 12, Fp.x + 8, Fp.y - 6, Fp.y + 6), 1.6).map(([x, y]) => at([x, y, 2.4])), { size: 0.4 }));
    for (const x of [Fp.x - 9, Fp.x - 2, Fp.x + 4.6]) put(S(box(x - 1.4, x + 1.4, Fp.y - 3.6, Fp.y + 3.6, 2.4, Fp.z - 2, 2, 0.3, 0.6), { tone: "mid" }));
    put(S(G.solidOf([[Fp.x - 11, 4], [Fp.x - 10, 4.8, 1], [Fp.x - 1.6, 4.8, 1], [Fp.x - 0.8, 4]], FEED_F, P), { tone: "mid", inner: Ln([Fp.x - 8.6, Fp.x - 6.4, Fp.x - 4.2].map((x) => G.arcOf(FEED_F, x, 4.8, P)).join(""), { tone: "faint" }) }));
    put(S(G.disc(Fp.x - 0.8, Fp.x + 4.6, 1.4, FEED_F, P), { tone: "mid", crease: "none" }));
    live("feed");
    put(S(G.solidOf([[Fp.x + 6.4, 3], [Fp.x + 7, 4.4, 1], [Fp.x + 10.4, 4.4, 1], [Fp.x + 11, 3.2], [Fp.x + 12.4, 2.4]], FEED_F, P), { tone: "hi" }));
    put(Dt(G.dotsOf(FEED_F, Fp.x + 10.4, 3.6, 8, P, { all: true }), { size: 0.35 }));
  }
  const suction = pipe("suction", [[COND.x0 - 0.2, -14, 8.6], [-66, -14, 8.6], [-66, -36, 8.6], [FEEDPUMP.x + 12.4, -36, FEEDPUMP.z]], 1.8, { bend: 3 });
  putAll(put, suction);
  {
    // moisture separator reheater: a long vessel on two saddles and legs
    const M = MSR;
    const MF = G.frameOf([0, M.y, M.z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    for (const x of [M.x0 + 4, M.x1 - 4]) {
      put(S(box(x - 1.6, x + 1.6, M.y - 3, M.y + 3, 0, M.z - 4.6, 2, 0.3, 0.6), { tone: "mid", inner: Ln(k.sideSeam(plan(x - 1.6, x + 1.6, M.y - 3, M.y + 3, 0.6), 6, P, 2), { tone: "faint" }) }));
      put(S(box(x - 2.4, x + 2.4, M.y - 4.4, M.y + 4.4, M.z - 6.6, M.z - 4.6, 2, 0.3, 0.6), { tone: "mid" }));
    }
    put(S(G.solidOf([[M.x0, 3.4], [M.x0 + 0.8, 5.2, 1], [M.x0 + 2.6, M.r, 1], [M.x1 - 2.6, M.r, 1], [M.x1 - 0.8, 5.2, 1], [M.x1, 3.4]], MF, P), { tone: "mid", inner: Ln([M.x0 + 12, M.x0 + 24, M.x0 + 34].map((x) => G.arcOf(MF, x, M.r, P)).join(""), { tone: "faint" }) }));
    put(S(G.disc(M.x1 - 0.4, M.x1 + 1.2, 2.6, MF, P), { tone: "mid" }), Dt(G.dotsOf(MF, M.x1 + 1.2, 1.9, 6, P, { all: true }), { size: 0.3 }));
  }
  const toMsr = pipe("xo1", [[-70, -6, 45.6], [-70, -6, 74], [-70, -27, 74], [-70, -27, MSR.z + MSR.r - 0.4]], 2.4, { bend: 4 });
  const toLp = pipe("xo2", [[-42, -27, MSR.z + MSR.r - 0.4], [-42, -27, 74], [-42, -6, 74], [-42, -6, 57]], 2.4, { bend: 4 });

  // ================= the steam line outside, the MSIV, the stop and governor valve =================
  putAll(put, steam, (m) => m[0] >= wallX(-22) - 2);
  {
    const MF = G.frameOf([0, -22, 96], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    put(S(G.solidOf([[MSIV.x - 3.4, 3.2], [MSIV.x - 2.6, 4.2, 1], [MSIV.x + 2.6, 4.2, 1], [MSIV.x + 3.4, 3.2]], MF, P), { tone: "mid" }));
    put(S(k.cylinder(MSIV.x, -22, 1.2, 99.6, 6, P, 12), { tone: "mid" }), S(box(MSIV.x - 2.4, MSIV.x + 2.4, -24.4, -19.6, 105.4, 109, 2, 0.4, 0.8), { tone: "mid" }));
    put(Dt([at([MSIV.x - 1.4, -19.6, 107.2]), at([MSIV.x + 1.4, -19.6, 107.2])], { size: 0.35 }));
  }
  putAll(put, dumpLine, (m) => m[1] >= -30 && m[2] > 40);
  // ================= HP turbine on its pedestal =================
  {
    const ped = plan(HP.x0 - 6, HP.x1 + 2, -12, 12, 1);
    put(S(k.slabOf(ped, 0, ZT - HP.r - 2.4, P, 3, 0.6), { tone: "mid", inner: Ln(k.sideSeam(ped, 4, P, 3), { tone: "faint" }) }));
    put(Dt(k.corners(ped, 2).map(([x, y]) => at([x, y, ZT - HP.r - 2.4])), { size: 0.45 }));
  }
  {
    // the valve chest: steam enters from the side, its stem lifts as the governor opens
    put(S(turned([[VALVE.z - 8, 0], [VALVE.z - 8, 3.6], [VALVE.z - 7, 4.2, 1], [VALVE.z + 2, 4.2, 1], [VALVE.z + 3, 3.6], [VALVE.z + 3, 0]], VALVE.x, VALVE.y), { tone: "mid" }));
    put(S(k.cylinder(VALVE.x, VALVE.y, 4.6, VALVE.z + 3, 1.2, P, 32), { tone: "mid" }), Dt(G.dotsOf(FZ(VALVE.x, VALVE.y), VALVE.z + 4.2, 3.8, 8, P, { phase: 0.3 }), { size: 0.35 }));
    for (const dx of [-2.6, 2.6]) put(S(k.cylinder(VALVE.x + dx, VALVE.y, 0.5, VALVE.z + 4.2, 6, P, 8), { tone: "lo", crease: "none" }));
    put(S(box(VALVE.x - 3.6, VALVE.x + 3.6, VALVE.y - 1.4, VALVE.y + 1.4, VALVE.z + 10.2, VALVE.z + 11.4, 2, 0.3, 0.5), { tone: "mid" }));
    put(moving("gov", S(k.cylinder(VALVE.x, VALVE.y, 0.6, VALVE.z + 4.2, 8.4 - STEM_LIFT, P, 10), { tone: "mid", crease: "none" }) + S(k.cylinder(VALVE.x, VALVE.y, 1.6, VALVE.z + 12.6 - STEM_LIFT, 1, P, 16), { tone: "hi" })));
    put(S(k.cylinder(VALVE.x + 6.6, VALVE.y, 2.4, VALVE.z + 10, 5.4, P, 20), { tone: "mid", inner: Ln(k.sideArc(VALVE.x + 6.6, VALVE.y, 2.4, VALVE.z + 12.6, P, 16), { tone: "faint" }) }));
    put(Ln(path3([[VALVE.x + 4.2, VALVE.y, VALVE.z + 11.6], [VALVE.x + 6.6, VALVE.y, VALVE.z + 11.6]]), { tone: "mid" }));
  }
  const hpIn = pipe("hpin", [[VALVE.x + 4.2, VALVE.y, VALVE.z - 4], [-82, -22, VALVE.z - 4], [-82, -6, VALVE.z - 4], [-82, -6, 49]], 2.2, { bend: 3.6 });
  putAll(put, hpIn, (m) => m[1] < -14);

  // the shaft line's turning parts, between two casings that are cut
  const shaftSeg = (x0, x1, r = 3.2) => S(G.disc(x0, x1, r, SHAFT_F, P), { tone: "mid", crease: "none" });
  const bearing = (x, h = ZT - 6) => {
    const pad = plan(x - 3, x + 3, -6, 6, 0.6);
    return S(k.slabOf(pad, h - 12, 12 - 1.4, P, 2, 0.3), { tone: "mid" }) + S(G.ringBand(x - 2.4, x + 2.4, 3.2, 5.4, SHAFT_F, P), { tone: "mid" }) + Dt([at([x - 2.4, 5, ZT + 2]), at([x + 2.4, 5, ZT + 2])], { size: 0.35 });
  };
  const turbine = (T, rows, ribsFrom, wide, label) => {
    const mid = (T.x0 + T.x1) / 2;
    const half = (T.x1 - T.x0) / 2;
    // the casing profile along x: the inlet in the middle, widening toward the two exhaust ends
    const prof = [];
    for (let i = 0; i <= 16; i++) {
      const x = T.x0 + (i / 16) * (T.x1 - T.x0);
      const t = Math.abs(x - mid) / half;
      prof.push([x, T.rIn + (T.r - T.rIn) * Math.min(1, t * 1.15) ** 1.4]);
    }
    const plane = ([x, z]) => [x, 0, z];
    // inside of the back half, as concave facets along x (round x, u = +y, v = +z: the back half is a in (π/2, 3π/2))
    const cav2 = [];
    for (let i = 0; i < prof.length - 1; i++) {
      const [x0, r0] = prof[i];
      const [x1, r1] = prof[i + 1];
      for (let j = 0; j < 24; j++) {
        const a0 = Math.PI / 2 + (j / 24) * Math.PI;
        const a1 = Math.PI / 2 + ((j + 1) / 24) * Math.PI;
        const am = (a0 + a1) / 2;
        const n = G.unit3([(r1 - r0) / (x1 - x0), -Math.cos(am), -Math.sin(am)]);
        if (G.dot3(n, V) <= 0) continue;
        const p = (x, r, a) => [x, r * Math.cos(a), ZT + r * Math.sin(a)];
        cav2.push(cavSvg([p(x0, r0 - 1, a0), p(x0, r0 - 1, a1), p(x1, r1 - 1, a1), p(x1, r1 - 1, a0)], Math.min(3, G.toneOf(n, P))));
      }
    }
    put(...cav2);
    // diaphragms (the fixed blade rows) on the back half, as arcs
    put(Ln(rows.map(([x0, , r]) => G.arcOf(SHAFT_F, x0 - 0.6, r + 0.4, P, { inward: true, from: Math.PI / 2, to: 1.5 * Math.PI })).join(""), { tone: "lo" }));
    // the casing's section on y = 0: upper and lower halves of the wall, the joint flange
    const top = prof.map(([x, r]) => [x, ZT + r]);
    const topIn = prof.map(([x, r]) => [x, ZT + r - 1.2]);
    const bot = prof.map(([x, r]) => [x, ZT - r]);
    const botIn = prof.map(([x, r]) => [x, ZT - r + 1.2]);
    put(cutSvg([[...bot, ...botIn.reverse()].map(plane)]));
    // the rotor: shaft, wheels and their blade rows
    put(shaftSeg(T.x0 - 1, T.x1 + 1, wide ? 4.4 : 3.6));
    const ordered = rows.map((row, i) => ({ row, i: i + ribsFrom })).sort((a, b) => a.row[0] - b.row[0]);
    for (const { row: [x0, x1, r], i } of ordered) {
      put(S(G.disc(x0, x1, r - 1.6, SHAFT_F, P), { tone: "mid", crease: "none" }));
      put(S(G.ringBand(x0 + 0.1, x1 - 0.1, r - 1.6, r, SHAFT_F, P), { tone: "hi", crease: "none" }));
      live(`row${i}`);
    }
    // the outside of the back half beyond the cut: its visible flank
    const flank = [];
    for (let i = 0; i < prof.length - 1; i++) {
      const [x0, r0] = prof[i];
      const [x1, r1] = prof[i + 1];
      for (let j = 0; j < 24; j++) {
        const a0 = Math.PI / 2 + (j / 24) * Math.PI;
        const a1 = Math.PI / 2 + ((j + 1) / 24) * Math.PI;
        const am = (a0 + a1) / 2;
        const n = G.unit3([-(r1 - r0) / (x1 - x0), Math.cos(am), Math.sin(am)]);
        if (G.dot3(n, V) <= 0) continue;
        const p = (x, r, a) => [x, r * Math.cos(a), ZT + r * Math.sin(a)];
        flank.push({ tone: Math.min(4, G.toneOf(n, P)), d: ring3([p(x0, r0, a0), p(x0, r0, a1), p(x1, r1, a1), p(x1, r1, a0)]) });
      }
    }
    const byTone = {};
    for (const { tone, d } of flank) (byTone[tone] ??= []).push(d);
    put(`<g class="npp-shell">${Object.entries(byTone).map(([t, list]) => `<path class="${Number(t) >= 4 ? "iso-top" : "iso-shade"}" data-shade="${t}" d="${list.join("")}"/>`).join("")}</g>`);
    put(cutSvg([[...top, ...topIn.reverse()].map(plane)]));
    const rEnd = prof[0][1];
    const gland = wide ? 5 : 4.2;
    put(cutSvg([rect(T.x0 - 0.9, T.x0, ZT - rEnd, ZT - gland).map(plane), rect(T.x0 - 0.9, T.x0, ZT + gland, ZT + rEnd).map(plane), rect(T.x1, T.x1 + 0.9, ZT - rEnd, ZT - gland).map(plane), rect(T.x1, T.x1 + 0.9, ZT + gland, ZT + rEnd).map(plane)]));
    // the joint's bolts along the top of the cut
    put(Dt(prof.filter((_, i) => i % 2 === 1).map(([x, r]) => at([x, -0.8, ZT + r - 0.2])), { size: 0.35 }));
    void label;
  };

  put(bearing(BEARINGS[0]));
  put(shaftSeg(HP.x0 - 7, HP.x0 - 1));
  live("stripe0");
  turbine(HP, HP_ROWS, 0, false, "HP");
  putAll(put, hpIn, (m) => m[1] >= -14);
  put(bearing(BEARINGS[1]), shaftSeg(HP.x1 + 1, LP.x0 - 1));
  live("stripe1");
  put(S(G.disc(HP.x1 + 0.4, HP.x1 + 1.2, 4.6, SHAFT_F, P), { tone: "mid" }));
  // ================= condenser under the LP turbine, the LP itself =================
  {
    const K = COND;
    const plane = ([x, z]) => [x, 0, z];
    // inside the shell: back wall, floor; the hotwell water, the tube bundle in section
    put(cavSvg(rect(K.x0, K.x1, K.z0, K.z1).map(([x, z]) => [x, K.y0 + 0.8, z]), 1));
    put(cavSvg(rect(K.x0, K.x1, K.y0, 0).map(([x, y]) => [x, y, K.z0 + 0.8]), "top"));
    put(`<path class="npp-water" d="${ring3(rect(K.x0 + 0.8, K.x1 - 0.8, K.z0 + 0.8, K.z0 + 3.6).map(plane))}"/>`);
    put(Ln(path3([[K.x0 + 0.8, 0, K.z0 + 3.6], [K.x1 - 0.8, 0, K.z0 + 3.6]]), { tone: "mid" }));
    const tubes = [];
    for (let z = K.z0 + 5.2; z < K.z1 - 2; z += 1.3) tubes.push(path3([[K.x0 + 2.6, 0, z], [K.x1 - 2.6, 0, z]]));
    put(`<g class="npp-tubes">${Ln(tubes.join(""), { tone: "lo" })}</g>`);
    put(cutSvg([rect(K.x0 + 2, K.x0 + 2.6, K.z0 + 4.4, K.z1 - 1).map(plane), rect(K.x1 - 2.6, K.x1 - 2, K.z0 + 4.4, K.z1 - 1).map(plane)]));
    // the shell's walls: back (behind), ends and the base on the cut
    put(S(box(K.x0 - 0.8, K.x1 + 0.8, K.y0 - 0.8, K.y0, K.z0, K.z1, 2, 0.3, 0.4), { tone: "mid" }));
    put(cutSvg([rect(K.x0 - 0.8, K.x0, K.z0, K.z1).map(plane), rect(K.x1, K.x1 + 0.8, K.z0, K.z1).map(plane), rect(K.x0 - 0.8, K.x1 + 0.8, K.z0 - 0.8, K.z0).map(plane)]));
    // the two-pass water box on the +x end: in below, out above
    put(S(box(K.x1 + 0.8, K.x1 + K.box + 0.8, K.y0, 0, K.z0, K.z1, 2, 0.4, 0.6), { tone: "mid", inner: Ln(path3([[K.x1 + K.box + 0.8, K.y0, (K.z0 + K.z1) / 2], [K.x1 + K.box + 0.8, 0, (K.z0 + K.z1) / 2]]), { tone: "faint" }) }));
    put(Dt([K.y0 + 1.4, -13, -1.4].flatMap((y) => [at([K.x1 + K.box + 0.8, y, K.z0 + 1.2]), at([K.x1 + K.box + 0.8, y, K.z1 - 1.2])]), { size: 0.4 }));
    put(Dt(rect(K.x0 + 2, K.x1 - 2, -3, -3).map(([x]) => at([x, -0.2, K.z0])), { size: 0.01 }));
  }
  {
    // the LP's exhaust hood stands on the condenser's neck
    const neck = plan(LP.x0 + 2, LP.x1 - 2, COND.y0 + 1, -0.4, 0.6);
    put(S(k.slabOf(neck, COND.z1, ZT - LP.r + 2.4 - COND.z1, P, 2, 0.3), { tone: "mid" }));
  }
  turbine(LP, LP_ROWS, HP_ROWS.length, true, "LP");
  putAll(put, toLp, (m) => m[2] < 60 && m[1] > -10);
  put(bearing(BEARINGS[2], COND.z1 + 8));
  put(shaftSeg(LP.x1 + 1, GEN.x0 - 1));
  live("stripe2");
  put(S(G.disc(LP.x1 + 0.4, LP.x1 + 1.2, 5, SHAFT_F, P), { tone: "mid" }));
  live("couplings");
  // the crossover arches: HP top to the MSR, MSR to the LP's inlet
  putAll(put, toMsr);
  putAll(put, toLp, (m) => !(m[2] < 60 && m[1] > -10));
  putAll(put, dumpLine, (m) => m[1] >= -30 && m[2] <= 40);

  // ================= cooling-water pipes from the water box to the canal =================
  const cwIn = pipe("cwin", [[CWP.x, CWP.y - 3.4, 13], [CWP.x, 46, 13], [CWP.x, 36, 8.4], [CWP.x, -7, 8.4], [COND.x1 + COND.box + 0.8, -7, 8.4]], 2.6, { bend: 4 });
  const cwOut = pipe("cwout", [[COND.x1 + COND.box + 0.8, -19, 15.6], [10.4, -19, 15.6], [10.4, 54, 15.6], [10.4, 61, 15.6], [10.4, 61, CANAL.water + 1]], 2.6, { bend: 4 });

  // ================= generator, exciter, the bus to the breaker and the transformer =================
  {
    const ped = plan(GEN.x0 - 4, EXC.x1 + 6, -12, 12, 1);
    put(S(k.slabOf(ped, 0, ZT - GEN.r - 2, P, 3, 0.6), { tone: "mid", inner: Ln(k.sideSeam(ped, 4, P, 3), { tone: "faint" }) }));
    put(Dt(k.corners(ped, 2).map(([x, y]) => at([x, y, ZT - GEN.r - 2])), { size: 0.45 }));
  }
  put(bearing(BEARINGS[3], ZT - 3));
  {
    const g = GEN;
    // stator frame: a turned body with end shields, cooler housing on top, feet on the pedestal
    for (const x of [g.x0 + 6, g.x1 - 6]) put(S(box(x - 3, x + 3, -g.r + 1, g.r - 1, ZT - g.r - 2, ZT - g.r + 4, 2, 0.4, 0.8), { tone: "mid" }));
    put(S(G.solidOf([[g.x0, 5], [g.x0 + 1.6, g.r - 3, 1], [g.x0 + 4, g.r, 1], [g.x1 - 4, g.r, 1], [g.x1 - 1.6, g.r - 3, 1], [g.x1, 5]], SHAFT_F, P), { tone: "mid", inner: Ln([g.x0 + 10, g.x0 + 16, g.x0 + 22, g.x0 + 28, g.x0 + 34].map((x) => G.arcOf(SHAFT_F, x, g.r, P)).join(""), { tone: "faint" }) }));
    const cooler = plan(g.x0 + 9, g.x1 - 9, -6, 6, 1);
    put(S(k.slabOf(cooler, ZT + g.r - 2.4, 6.4, P, 3, 0.6), { tone: "mid", inner: Ln(k.sideSeam(cooler, ZT + g.r + 1.4, P, 3), { tone: "faint" }) }));
    const fins = [];
    for (let x = cooler.x + 2; x <= cooler.x + cooler.w - 2; x += 1.6) fins.push(k.lineOnTop([x, cooler.y], [x, cooler.y + cooler.d], ZT + g.r + 4, P));
    put(Ln(fins.join(""), { tone: "lo" }));
    // the terminal box and its three bushings
    const tb = plan(g.x1 - 15, g.x1 - 8, -6.4, 6.4, 0.8);
    put(S(k.slabOf(tb, ZT + g.r - 1.6, 4, P, 2, 0.4), { tone: "mid" }));
    // a nameplate on the frame's front
    put(`<path class="npp-plate" d="${ring3(rect(g.x0 + 8, g.x0 + 18, ZT - 3, ZT + 3).map(([x, z]) => [x, g.r + 0.05, z]).map(([x, y, z]) => [x, Math.sqrt(Math.max(0, g.r * g.r - (z - ZT) ** 2)), z]))}"/>`);
  }
  put(shaftSeg(GEN.x1 + 1, EXC.x0 - 0.6));
  live("stripe3");
  put(bearing(BEARINGS[4], ZT - 4));
  {
    // the exciter: a small machine with a commutator-like ring of bars on its outboard end
    const e = EXC;
    put(S(G.solidOf([[e.x0, 3.4], [e.x0 + 1, e.r, 1], [e.x1 - 4, e.r, 1], [e.x1 - 3.4, e.r - 1.4], [e.x1 - 3.4, e.r - 2.2]], SHAFT_F, P), { tone: "mid" }));
    put(S(G.disc(e.x1 - 3.4, e.x1, e.r - 2.4, SHAFT_F, P), { tone: "mid" }));
    live("exc");
    put(S(G.disc(e.x1, e.x1 + 1.2, 2, SHAFT_F, P), { tone: "mid" }));
  }
  put(bearing(BEARINGS[5], ZT - 4));
  const bus = BUS_Y.map((y, i) => pipe(`bus${i}`, [[GEN.x1 - 11.5 + (i - 1) * 0.01, y, ZT + GEN.r + 2.4], [GEN.x1 - 11.5, y, BUS_Z], [BREAKER.x0, y, BUS_Z]], 1.3, { bend: 3, maxLength: 3.4 }));
  const bus2 = BUS_Y.map((y, i) => pipe(`busx${i}`, [[BREAKER.x1, y, BUS_Z], [LV_X - 0.01, y, BUS_Z], [LV_X, y, XFMR.z1 + 4.4]], 1.3, { bend: 3, maxLength: 3.4 }));
  for (const list of [...bus].reverse()) putAll(put, list);
  {
    // the generator breaker: a box on legs with a lamp that shows it closed
    const b = BREAKER;
    for (const [x, y] of byDepth([[b.x0 + 1.6, b.y0 + 1.6], [b.x1 - 1.6, b.y0 + 1.6], [b.x0 + 1.6, b.y1 - 1.6], [b.x1 - 1.6, b.y1 - 1.6]])) put(S(k.cylinder(x, y, 0.8, 0, b.z0, P, 10), { tone: "lo" }));
    const bp = plan(b.x0, b.x1, b.y0, b.y1, 0.8);
    put(S(k.slabOf(bp, b.z0, b.z1 - b.z0, P, 3, 0.5), { tone: "mid", inner: Ln(k.sideSeam(bp, b.z1 - 2.4, P, 3), { tone: "faint" }) }));
    const lamp = at([b.x1 - 2.4, b.y1, b.z0 + 2.6]);
    put(`<circle class="npp-led" data-k="brk" cx="${lamp[0].toFixed(1)}" cy="${lamp[1].toFixed(1)}" r="0.95"/>`);
    put(Ln(path3([[b.x0 + 2, b.y1, b.z0 + 5], [b.x0 + 6, b.y1, b.z0 + 5]]) + path3([[b.x0 + 2, b.y1, b.z0 + 3.4], [b.x0 + 4.6, b.y1, b.z0 + 3.4]]), { tone: "lo", free: true }));
  }
  for (const list of [...bus2].reverse()) putAll(put, list, (m) => m[2] > XFMR.z1 + 8);
  {
    // the step-up transformer: tank, radiators along its front, conservator, bushings
    const T = XFMR;
    const tank = plan(T.x0, T.x1, T.y0, T.y1, 1.6);
    put(S(k.slabOf(plan(T.x0 - 2, T.x1 + 2, T.y0 - 2, T.y1 + 2, 1), 0, T.z0, P, 3, 0.4), { tone: "lo" }));
    put(S(k.slabOf(tank, T.z0, T.z1 - T.z0, P, 4, 0.8), { tone: "mid", inner: Ln(k.sideSeam(tank, T.z1 - 3, P, 4) + k.sideSeam(tank, T.z0 + 3, P, 4), { tone: "faint" }) }));
    put(Dt(k.corners(tank, 1.6).map(([x, y]) => at([x, y, T.z1])), { size: 0.45 }));
    // conservator on two brackets
    const CF = G.frameOf([0, T.y0 + 4, T.z1 + 9], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    for (const x of [T.x0 + 6, T.x0 + 18]) put(S(box(x - 0.8, x + 0.8, T.y0 + 3, T.y0 + 5, T.z1, T.z1 + 6.4, 2, 0.2, 0.3), { tone: "mid" }));
    put(S(G.solidOf([[T.x0 + 2, 2.2], [T.x0 + 2.6, 3.4, 1], [T.x0 + 21.4, 3.4, 1], [T.x0 + 22, 2.2]], CF, P), { tone: "mid" }));
    // LV bushings at the left, short; HV bushings at the right, tall, with porcelain sheds
    for (const y of BUS_Y) put(S(G.solidOf([[0, 2.4], [1.2, 2.4], [1.6, 1.8], [4, 1.4]], G.frameOf([LV_X, y, T.z1], [0, 0, 1], [1, 0, 0], [0, 1, 0]), P, { smooth: false }), { tone: "hi" }));
    for (const y of HV_Y) {
      const F = G.frameOf([HV_X, y, T.z1], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
      const prof = [[0, 3], [2, 3], [2.4, 2]];
      for (let s = 0; s < 9; s++) {
        const z = 3.6 + s * 2.6;
        prof.push([z - 0.6, 1.5], [z, 2.6], [z + 0.6, 1.5]);
      }
      prof.push([HV_TOP - T.z1 - 1.4, 1.3], [HV_TOP - T.z1, 1.6]);
      put(S(G.solidOf(prof, F, P, { smooth: false }), { tone: "hi" }));
      put(S(k.cylinder(HV_X, y, 1.9, HV_TOP, 1.2, P, 16), { tone: "mid" }));
    }
    // radiator banks on the tank's front face
    for (let x = T.x0 + 3; x <= T.x1 - 3; x += 2.8) put(S(box(x - 0.4, x + 0.4, T.y1, T.y1 + 5, T.z0 + 4, T.z1 - 3, 2, 0.1, 0.2), { tone: "mid", crease: "none" }));
    put(S(box(T.x0 + 2, T.x1 - 2, T.y1, T.y1 + 5.4, T.z1 - 3, T.z1 - 2, 2, 0.2, 0.3), { tone: "mid" }), S(box(T.x0 + 2, T.x1 - 2, T.y1, T.y1 + 5.4, T.z0 + 3, T.z0 + 4, 2, 0.2, 0.3), { tone: "mid" }));
    put(`<path class="npp-plate" d="${ring3(rect(T.x0 + 3, T.x0 + 13, T.z1 - 9, T.z1 - 5).map(([x, z]) => [T.x0 - 0.05, T.y0 + 4 + (x - T.x0 - 3), z]))}"/>`);
  }
  for (const list of [...bus2].reverse()) putAll(put, list, (m) => m[2] <= XFMR.z1 + 8);
  {
    // the line gantry and the three conductors to the grid
    const g = GANTRY;
    for (const y of [g.y0, g.y1]) {
      put(S(box(g.x - 3, g.x + 3, y - 3, y + 3, 0, 1.6, 2, 0.3, 0.6), { tone: "lo" }));
      put(S(box(g.x - 1.4, g.x + 1.4, y - 1.4, y + 1.4, 1.6, g.z, 2, 0.3, 0.4), { tone: "mid", crease: "none" }));
    }
    put(S(box(g.x - 1.4, g.x + 1.4, g.y0 - 2, g.y1 + 2, g.z, g.z + 3, 2, 0.3, 0.4), { tone: "mid" }));
    const braces = [];
    for (let y = g.y0; y < g.y1; y += 8) braces.push(path3([[g.x + 1.4, y, g.z], [g.x + 1.4, y + 4, g.z + 3]]), path3([[g.x + 1.4, y + 4, g.z + 3], [g.x + 1.4, y + 8, g.z]]));
    put(Ln(braces.join(""), { tone: "lo" }));
  }
  const lines = HV_Y.map((y, i) => {
    const gy = GANTRY.y0 + 8 + i * 16;
    const end = [GANTRY.x - 0.6, gy, GANTRY.z - 7];
    return pipe(`hv${i}`, [[HV_X, y, HV_TOP + 1.2], [HV_X, y, HV_TOP + 4], [GANTRY.x - 8, gy, GANTRY.z - 7], end], 0.55, { bend: 4, maxLength: 4, tone: "hi" });
  });
  for (const list of lines) putAll(put, list);
  {
    // insulator strings hanging from the beam
    for (let i = 0; i < 3; i++) {
      const gy = GANTRY.y0 + 8 + i * 16;
      const F = G.frameOf([GANTRY.x, gy, GANTRY.z - 7.4], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
      const prof = [];
      for (let s = 0; s < 5; s++) prof.push([s * 1.5 + 0.2, 0.5], [s * 1.5 + 0.75, 1.5], [s * 1.5 + 1.3, 0.5]);
      put(S(G.solidOf(prof, F, P, { smooth: false }), { tone: "hi" }));
      // the conductor leaves toward the grid, fading out
      put(k.fadeLineSvg([at([GANTRY.x + 0.4, gy, GANTRY.z - 7]), at([GANTRY.x + 26, gy - 3, GANTRY.z - 1])], { fade: [0, 0.9], tone: "hi" }));
    }
  }

  // ================= in front: the canal, the cooling-water pump, the pipes into it =================
  {
    const W = CANAL;
    const floor = plan(W.x0, W.x1, W.y0, W.y1, 1.6);
    put(S(k.slabOf(floor, 0, 1.4, P, 3, 0.4), { tone: "lo" }));
    put(S(box(W.x0, W.x1, W.y0, W.y0 + 2, 1.4, W.z1, 2, 0.3, 0.6), { tone: "mid" }));
    put(S(box(W.x0, W.x0 + 2, W.y0 + 2, W.y1 - 2, 1.4, W.z1, 2, 0.3, 0.4), { tone: "mid" }));
    put(`<path class="npp-water" d="${ring3(rect(W.x0 + 2, W.x1, W.y0 + 2, W.y1 - 2).map(([x, y]) => [x, y, W.water]))}"/>`);
    const ripples = [];
    for (const [x, y, len] of [[-24, 58, 10], [-8, 66, 8], [22, 56, 9], [36, 64, 12], [48, 58, 6]]) ripples.push(k.lineOnTop([x, y], [x + len, y], W.water, P));
    put(Ln(ripples.join(""), { tone: "lo", free: true }));
    // the pump stands in the water: bowl below, column, motor above on a stool
    const F = CWP_F;
    put(S(k.cylinder(CWP.x, CWP.y, 2.2, 2, W.water - 2, P, 18), { tone: "mid" }));
    put(S(k.cylinder(CWP.x, CWP.y, 2.6, W.water, 6.6, P, 20), { tone: "mid" }));
    put(S(k.cylinder(CWP.x, CWP.y, 3.6, 13.6, 1, P, 24), { tone: "mid" }));
    live("cwp");
    put(S(G.solidOf([[16.6, 3.8], [17.4, 4.4, 1], [24, 4.4, 1], [25, 3.2, 1], [25.4, 0]], F, P), { tone: "mid", inner: Ln([19, 21, 23].map((z) => G.arcOf(F, z, 4.4, P)).join(""), { tone: "faint" }) }));
  }
  putAll(put, cwOut);
  putAll(put, cwIn);
  {
    const W = CANAL;
    put(S(box(W.x0, W.x1, W.y1 - 2, W.y1, 1.4, W.z1, 2, 0.3, 0.6), { tone: "mid", inner: Ln(k.sideSeam(plan(W.x0, W.x1, W.y1 - 2, W.y1, 0.6), W.z1 - 2.4, P, 2), { tone: "faint" }) }));
    put(Dt([W.x0 + 8, W.x0 + 34, W.x0 + 60, W.x0 + 86].map((x) => at([x, W.y1 - 1, W.z1])), { size: 0.4 }));
  }

  // ================= the control desk: three dials, the rod scale, the trip button =================
  {
    const D = DESK;
    const panel = plan(D.x0, D.x1, D.y0, PANEL_Y, 1);
    put(S(k.slabOf(panel, 0, 33, P, 3, 0.6), { tone: "mid", inner: Ln(k.sideSeam(panel, 30, P, 3), { tone: "faint" }) }));
    for (const d of DIALS) put(dialFace(d.x, PANEL_Y, d.z, d.r, d.span, 12, 3));
    for (const d of DIALS) live(d.key);
    for (const d of DIALS) put(Dt([at([d.x, PANEL_Y + 0.5, d.z])], { size: 0.65, tone: "hi" }));
    // engraved rules under each dial stand for its name
    put(Ln(DIALS.map((d) => path3([[d.x - 3, PANEL_Y, d.z - 6.6], [d.x + 3, PANEL_Y, d.z - 6.6]])).join(""), { tone: "lo", free: true }));
    // the rod-position scale: a slot with ticks, a pointer that rides with bank D
    const R = RODSCALE;
    put(`<path class="npp-cav" data-shade="1" d="${ring3(rect(R.x - 0.6, R.x + 0.6, R.z0 - 0.8, R.z1 + 0.8).map(([x, z]) => [x, PANEL_Y, z]))}"/>`);
    const ticks = [];
    for (let i = 0; i <= 12; i++) {
      const z = R.z0 + ((R.z1 - R.z0) * i) / 12;
      ticks.push(path3([[R.x + 1, PANEL_Y, z], [R.x + (i % 3 ? 2 : 2.8), PANEL_Y, z]]));
    }
    put(Ln(ticks.join(""), { tone: "lo" }), Ln(path3([[R.x + 1, PANEL_Y, R.z0 - 0.8], [R.x + 1, PANEL_Y, R.z1 + 0.8]]), { tone: "mid" }));
    put(moving("rodpos", S(box(R.x - 1.6, R.x + 0.4, PANEL_Y, PANEL_Y + 0.8, R.z0 - 0.5, R.z0 + 0.5, 2, 0.1, 0.2), { tone: "hi" })));
    // two lamps over the scale: reactor tripped, generator on the grid
    for (const [z, key] of [[31, "lamp.trip"], [28.6, "lamp.grid"]]) {
      const c = at([D.x1 - 2.4, PANEL_Y, z]);
      put(`<circle class="npp-led" data-k="${key}" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="0.8"/>`);
    }
    put(Dt(k.corners(plan(D.x0, D.x1, 0, 33), 1.6).map(([x, z]) => at([x, PANEL_Y, z])), { size: 0.4 }));
    // the desk in front, and the trip button under its guard
    const desk = plan(D.x0, D.x1, PANEL_Y, D.y1, 1.2);
    put(S(k.slabOf(desk, 0, 12, P, 3, 0.6), { tone: "mid", inner: Ln(k.sideSeam(desk, 9, P, 3), { tone: "faint" }) }));
    const keys = [];
    for (let i = 0; i < 6; i++) keys.push([D.x0 + 6 + i * 3.4, PANEL_Y + 6]);
    for (const [x, y] of byDepth(keys)) put(S(k.cylinder(x, y, 0.9, 12, 0.6, P, 12), { tone: "mid" }));
    const bx = D.x1 - 8;
    const by = D.y1 - 7;
    put(S(k.cylinder(bx, by, 3.6, 12, 0.8, P, 28), { tone: "lo" }));
    put(`<g class="npp-scram" data-k="scram">${S(k.cylinder(bx, by, 1.4, 12.8, 1.6, P, 18), { tone: "mid" })}${S(G.solidOf([[14.4, 2.6], [15.2, 2.6, 1], [16, 1.8, 1], [16.3, 0]], FZ(bx, by), P), { tone: "hi" })}</g>`);
    put(Ln(path3([[bx - 3.6, by + 3.4, 12], [bx - 3.6, by + 3.4, 17], [bx + 3.6, by + 3.4, 17], [bx + 3.6, by + 3.4, 12]]), { tone: "mid" }), Dt([at([bx - 3.6, by + 3.4, 12]), at([bx + 3.6, by + 3.4, 12])], { size: 0.4 }));
  }

  void FX;
  void discX;
  void G.arcOf;
  return { defs: defs.join(""), body: out.join(""), flows: { ...routes }, frame: f };
}
