// The figure's main parts, named. Each anchor is a world point on the part's
// visible surface; `to` is where the name sits, in viewBox units, in the card's
// empty space.

import { at, ZM, ZI, ZD, STAGE2_X, PCU, OBC, BDU, PORT, CHARGER, CORD_Y, BLADE, INLET } from "./view.mjs";

const PARTS = [
  { name: "Blade pack · 126 LFP cells", world: [-120, 20, BLADE.z1], to: [150, 92], align: "end" },
  { name: "Cell monitoring", world: [-116, 0, BLADE.z1 + 1.9], to: [196, 52], align: "end" },
  { name: "Motor · 150 kW", world: [-16, 18, ZM + 16], to: [222, 76], align: "end" },
  { name: "Contactors", world: [BDU.x0 + 4.4, 40, BDU.z1 + 5], to: [100, 268], align: "end" },
  { name: "Charge gauge", world: [(BDU.x0 + BDU.x1) / 2, BDU.y1, 16], to: [142, 302], align: "end" },
  { name: "Charging post", world: [CHARGER.x0 + 4, CHARGER.y1, CHARGER.z1 - 6], to: [196, 338], align: "end" },
  { name: "Charging cord", world: [96, CORD_Y, 2.8], to: [262, 382], align: "end" },
  { name: "CCS2 plug", world: [INLET.x, 56, INLET.z], to: [304, 420], align: "end" },
  { name: "Charge port", world: [PORT.x1, 30, PORT.z1 - 6], to: [372, 456], align: "end" },
  { name: "Inverter · power meter", world: [-20, -20, PCU.z1], to: [310, 40], align: "start" },
  { name: "On-board charger", world: [60, -16, OBC.z1 + 1.8], to: [404, 72], align: "start" },
  { name: "Reduction gears · 11.05 : 1", world: [STAGE2_X.x1, 0, ZI + 5], to: [452, 140], align: "start" },
  { name: "Differential", world: [STAGE2_X.x1, 4, ZD - 14], to: [440, 196], align: "start" },
  { name: "Half shaft", world: [160, 0, ZD + 2], to: [482, 238], align: "start" },
  { name: "Wheel on rollers", world: [238, 0, ZD + 44], to: [560, 262], align: "start" },
];

export const LABELS = PARTS.map(({ name, world, to, align }, i) => {
  const [x, y] = at(world);
  return { n: i + 1, name, at: [Math.round(x * 10) / 10, Math.round(y * 10) / 10], to, align };
});
