// Bodies of revolution about a vertical axis, cut on the plane through their
// axis that faces the viewer (y = cy) with the near half taken away. What is
// left: the back half's inside, seen as concave facets, a sliver of its outside
// on the right, and the section itself on the cut plane.

import * as k from "../../iso/iso-kit.mjs";
import * as G from "../../iso/lathe.mjs";
import { P, at } from "./view.mjs";
import { ring3, TAU } from "./parts.mjs";

const V = G.viewOf(P);

// Points along an elliptical arc in (z, r): t runs from t0 to t1 in degrees, 0 at the equator.
export function arcZR(zc, rz, rr, t0, t1, steps = 10) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = ((t0 + ((t1 - t0) * i) / steps) * Math.PI) / 180;
    out.push([zc + rz * Math.sin(t), Math.max(0, rr * Math.cos(t))]);
  }
  return out;
}

const point = (cx, cy, a, [z, r]) => [cx + r * Math.cos(a), cy + r * Math.sin(a), z];
const outward = (a, [z0, r0], [z1, r1]) => G.unit3([Math.cos(a) * (z1 - z0), Math.sin(a) * (z1 - z0), -(r1 - r0)]);
const toneName = (t) => (t >= 4 ? "top" : String(t));

// Facets of the back half's skin, grouped by tone. `inside` looks at the concave face.
function skin(cx, cy, meridian, inside, steps) {
  const groups = {};
  const lo = [];
  for (let i = 0; i < meridian.length - 1; i++) {
    const m0 = meridian[i];
    const m1 = meridian[i + 1];
    if (Math.abs(m0[0] - m1[0]) < 1e-9 && Math.abs(m0[1] - m1[1]) < 1e-9) continue;
    let least = null;
    for (let j = 0; j < steps; j++) {
      const a0 = Math.PI + (j / steps) * Math.PI;
      const a1 = Math.PI + ((j + 1) / steps) * Math.PI;
      const mid = (a0 + a1) / 2;
      let n = outward(mid, m0, m1);
      if (inside) n = G.mul3(n, -1);
      if (G.dot3(n, V) <= 1e-6) continue;
      if (least === null) least = a0;
      const tone = Math.min(4, G.toneOf(n, P));
      const ring = [point(cx, cy, a0, m0), point(cx, cy, a1, m0), point(cx, cy, a1, m1), point(cx, cy, a0, m1)];
      (groups[tone] ??= []).push(ring3(ring));
    }
    lo.push(least === null ? null : [i, least]);
  }
  return { groups, lo };
}

// A section through the wall on y = cy: the band between outer and inner meridians, both sides.
export function sectionRings(cx, cy, outer, inner, open = false) {
  const side = (meridian, s) => meridian.map(([z, r]) => [cx + s * r, cy, z]);
  if (open) return [[...side(outer, 1), ...side(outer, -1).reverse(), ...side(inner, -1), ...side(inner, 1).reverse()]];
  return [[...side(outer, 1), ...side(outer, -1).reverse()], [...side(inner, 1), ...side(inner, -1).reverse()]];
}

export function halfVessel(cx, cy, outer, inner, { steps = 40, inner: innerClass = "npp-cav", open = false, outline = true } = {}) {
  const back = skin(cx, cy, inner, true, steps);
  const front = skin(cx, cy, outer, false, steps);
  const cav = Object.entries(back.groups).map(([tone, list]) => `<path class="${innerClass}" data-shade="${toneName(Number(tone))}" d="${list.join("")}"/>`).join("");
  const shell = Object.entries(front.groups).map(([tone, list]) => `<path class="${Number(tone) >= 4 ? "iso-top" : "iso-shade"}" data-shade="${toneName(Number(tone))}" d="${list.join("")}"/>`).join("");
  // the silhouette: the left edge of the visible outside, row by row
  const chain = [];
  for (const row of front.lo) {
    if (!row) continue;
    const [i, a] = row;
    if (a <= Math.PI + 1e-6) continue;
    chain.push(at(point(cx, cy, a, outer[i])), at(point(cx, cy, a, outer[i + 1])));
  }
  const edge = outline && chain.length ? k.lineSvg(k.pathOf(chain), { tone: "mid" }) : "";
  const rings = sectionRings(cx, cy, outer, inner, open);
  const cut = `<path class="npp-cut" d="${rings.map(ring3).join("")}"/>`;
  return { back: cav, outside: `<g class="npp-shell">${shell}</g>${edge}`, cut, rings };
}

// The inside of a body on the cut plane, as a clip ring (for water, glow, rods).
export function insideRing(cx, cy, inner) {
  return [...inner.map(([z, r]) => [cx + r, cy, z]), ...inner.map(([z, r]) => [cx - r, cy, z]).reverse()];
}

// A whole body of revolution on a vertical axis, with the kit's shading.
export const turned = (profile, x, y, options) => G.solidOf(profile.map(([z, r, s]) => (s ? [z, r, s] : [z, r])), G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), P, options);

export { TAU };
