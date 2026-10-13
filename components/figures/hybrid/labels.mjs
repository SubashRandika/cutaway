// The figure's main parts, named. Each anchor is a world point on the part's
// visible surface; `to` is where the name sits, in viewBox units, in the card's
// empty space.

import { at, DECK, ZA, ZB, ZD, C_AXIS, TANK, LEVER, PCU, MG2, SPIDER } from "./view.mjs";

const PARTS = [
  { name: "Engine · 1.8 L four", world: [-82, 0, DECK + 8], to: [128, 52], align: "end" },
  { name: "Pistons", world: [-104, 6, DECK - 6], to: [128, 96], align: "end" },
  { name: "Crankshaft", world: [-93, 10, ZA - 2], to: [128, 142], align: "end" },
  { name: "Fuel tank", world: [TANK.x + 10, TANK.y + 14, TANK.h + 1.4], to: [64, 176], align: "end" },
  { name: "Speed lever", world: [-73, LEVER.y + 2, LEVER.z1 - 6], to: [118, 300], align: "end" },
  { name: "MG2 · drive motor", world: [MG2.x0 + 6, C_AXIS[0] + 12, C_AXIS[1] - 6], to: [198, 344], align: "end" },
  { name: "Counter gear", world: [29, 8, ZB - 14], to: [300, 352], align: "end" },
  { name: "Battery pack", world: [150, 30, 24], to: [376, 438], align: "end" },
  { name: "Inverter (PCU) · power meter", world: [26, -16, PCU.z1], to: [352, 104], align: "start" },
  { name: "MG1 · generator", world: [12, 12, ZA + 19.6], to: [286, 66], align: "start" },
  { name: "Power-split planetary", world: [SPIDER.x1 + 2.6, 0, ZA], to: [392, 150], align: "start" },
  { name: "Final drive · differential", world: [95, 4, ZD + 12], to: [440, 200], align: "start" },
  { name: "Half shaft", world: [160, 0, ZD + 2], to: [482, 248], align: "start" },
  { name: "Wheel on rollers", world: [238, 0, ZD + 44], to: [560, 262], align: "start" },
];

export const LABELS = PARTS.map(({ name, world, to, align }, i) => {
  const [x, y] = at(world);
  return { n: i + 1, name, at: [Math.round(x * 10) / 10, Math.round(y * 10) / 10], to, align };
});
