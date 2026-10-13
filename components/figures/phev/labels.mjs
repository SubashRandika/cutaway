// The figure's main parts, named. Each anchor is a world point on the part's
// visible surface; `to` is where the name sits, in viewBox units, in the card's
// empty space.

import { at, DECK, ZA, ZB, ZD, C_AXIS, TANK, PCU, MOTOR, CLUTCH, DRIVE_X, OBC, WALLBOX, CORD_Y } from "./view.mjs";

const PARTS = [
  { name: "Engine · 1.5 L four", world: [-82, 0, DECK + 8], to: [128, 52], align: "end" },
  { name: "Pistons", world: [-104, 6, DECK - 6], to: [128, 96], align: "end" },
  { name: "Crankshaft", world: [-93, 10, ZA - 2], to: [128, 140], align: "end" },
  { name: "Fuel tank", world: [TANK.x + 10, TANK.y + 14, TANK.h + 1.4], to: [60, 196], align: "end" },
  { name: "Wall charger", world: [WALLBOX.x0 + 4, WALLBOX.y1, WALLBOX.z1 - 6], to: [96, 296], align: "end" },
  { name: "Traction motor", world: [MOTOR.x0 + 8, C_AXIS[0] + 12, C_AXIS[1] - 6], to: [150, 352], align: "end" },
  { name: "Charging cord", world: [40, CORD_Y, 2.6], to: [204, 404], align: "end" },
  { name: "Counter gear", world: [DRIVE_X.x1, 6, ZB - 14], to: [270, 440], align: "end" },
  { name: "Battery pack · 36 blades", world: [150, 30, 22.5], to: [384, 478], align: "end" },
  { name: "Inverter (PCU) · power meter", world: [26, -16, PCU.z1], to: [352, 96], align: "start" },
  { name: "Generator", world: [6, 10, ZA + 16], to: [282, 62], align: "start" },
  { name: "Lock-up clutch", world: [CLUTCH.x1, 0, ZA + 9], to: [404, 150], align: "start" },
  { name: "Final drive · differential", world: [95, 4, ZD + 12], to: [440, 200], align: "start" },
  { name: "Half shaft", world: [160, 0, ZD + 2], to: [482, 248], align: "start" },
  { name: "Wheel on rollers", world: [238, 0, ZD + 44], to: [560, 262], align: "start" },
  { name: "On-board charger · plug", world: [OBC.x1 - 4, OBC.y1, OBC.z1 - 4], to: [496, 484], align: "start" },
];

export const LABELS = PARTS.map(({ name, world, to, align }, i) => {
  const [x, y] = at(world);
  return { n: i + 1, name, at: [Math.round(x * 10) / 10, Math.round(y * 10) / 10], to, align };
});
