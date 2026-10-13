// The figure's main parts, named. Each anchor is a world point on the part's
// visible surface; `to` is where the name sits, in viewBox units, in the card's
// empty space.

import { at, ZC, ZO, ZD, HEAD, COVER, FLY, PAIR_X, PINION_X, SHAFT, WHEEL, TANK, DECK } from "./view.mjs";

const PARTS = [
  { name: "Air box and throttle", world: [-8, 46, 179], to: [112, 34], align: "end" },
  { name: "Cams and valves", world: [0, 12, COVER.z0 + 4], to: [112, 74], align: "end" },
  { name: "Combustion chamber", world: [0, -4, DECK + 3], to: [112, 112], align: "end" },
  { name: "Piston", world: [0, 10, DECK - 18], to: [112, 150], align: "end" },
  { name: "Fuel tank", world: [TANK.x + 8, TANK.y + 12, TANK.h + 1.4], to: [70, 186], align: "end" },
  { name: "Connecting rod and crank", world: [0, 12, ZC + 4], to: [150, 290], align: "end" },
  { name: "Flywheel and clutch", world: [FLY.x1, 18, ZC - 14], to: [214, 336], align: "end" },
  { name: "Five-speed gearbox", world: [PAIR_X[2], 12, ZO - 6], to: [292, 386], align: "end" },
  { name: "Spark plug and coil", world: [0, 3, COVER.z1 + 7], to: [262, 30], align: "start" },
  { name: "Cylinder head", world: [-HEAD.half + 4, -HEAD.half, HEAD.z1], to: [262, 62], align: "start" },
  { name: "Gear lever", world: [98, -10, 105], to: [376, 126], align: "start" },
  { name: "Final drive and differential", world: [PINION_X + 10, 6, ZD + 12], to: [428, 186], align: "start" },
  { name: "Half shaft", world: [205, 0, ZD + 2.2], to: [478, 236], align: "start" },
  { name: "Wheel and rollers", world: [WHEEL.x1, 0, ZD + 44], to: [548, 270], align: "start" },
];

export const LABELS = PARTS.map(({ name, world, to, align }, i) => {
  const [x, y] = at(world);
  return { n: i + 1, name, at: [Math.round(x * 10) / 10, Math.round(y * 10) / 10], to, align };
});

void SHAFT;
