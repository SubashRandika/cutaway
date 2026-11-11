// The figure's main parts, named. Each anchor is a world point on the part's
// visible surface; `to` is where the name sits, in viewBox units, in the card's
// empty space.

import { at, CONT, PZR, RPV, RCP, SG, MSIV, VALVE, MSR, HV_X, HV_Y, GANTRY, CWP, DESK, CRANE } from "./view.mjs";

const PARTS = [
  { name: "Containment · post-tensioned concrete", world: [CONT.x + 20, -30, 138], to: [300, 20], align: "start" },
  { name: "Polar crane", world: [-190, CRANE.y + 3, CRANE.z + 4], to: [112, 40], align: "end" },
  { name: "Pressuriser · 155 bar", world: [PZR.x, PZR.y - 4, 92], to: [112, 62], align: "end" },
  { name: "Control rods · bank D", world: [RPV.x + 5.4, 0.1, 52], to: [112, 98], align: "end" },
  { name: "Core · 193 assemblies", world: [RPV.x - 3, 0, 30], to: [112, 158], align: "end" },
  { name: "Reactor coolant pump", world: [RCP.x, RCP.y + 4.6, 54], to: [112, 128], align: "end" },
  { name: "Steam generator · U-tubes", world: [SG.x + 6, SG.y, 100], to: [330, 46], align: "start" },
  { name: "Main steam isolation valve", world: [MSIV.x, -22, 109], to: [356, 74], align: "start" },
  { name: "Governor valve", world: [VALVE.x, VALVE.y, 74], to: [380, 104], align: "start" },
  { name: "Moisture separator reheater", world: [-50, MSR.y, MSR.z + MSR.r], to: [420, 140], align: "start" },
  { name: "HP and LP turbines · 1,500 rpm", world: [-30, 0, 60], to: [452, 176], align: "start" },
  { name: "Generator · 24 kV", world: [40, 5, 54], to: [470, 226], align: "start" },
  { name: "To the grid · 400 kV", world: [GANTRY.x, GANTRY.y0, GANTRY.z + 3], to: [606, 214], align: "end" },
  { name: "Step-up transformer", world: [HV_X, HV_Y[2], 58], to: [486, 424], align: "start" },
  { name: "Condenser", world: [-40, 0, 10], to: [282, 436], align: "end" },
  { name: "Cooling-water pump", world: [CWP.x, CWP.y, 25], to: [232, 404], align: "end" },
  { name: "Trip button", world: [DESK.x1 - 8, DESK.y1 - 7, 16.3], to: [160, 334], align: "end" },
  { name: "Desk · power, Tavg, MWe", world: [DESK.x0 + 18, DESK.y0 + 3.4, 30], to: [140, 290], align: "end" },
];

export const LABELS = PARTS.map(({ name, world, to, align }, i) => {
  const [x, y] = at(world);
  return { n: i + 1, name, at: [Math.round(x * 10) / 10, Math.round(y * 10) / 10], to, align };
});
