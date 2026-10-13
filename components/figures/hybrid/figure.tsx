import { Plate } from "../../iso/react/draw";
import { HybridArt } from "./art";
import { BATTERY, BATTERY_KWH, DISPLACEMENT, ENGINE, ENGINE_ON, EV_SPEED, MG2_POWER, MG2_TO_RING, PSD, RHO, RING_TO_WHEEL, SLOW, SYSTEM_POWER, carAt, readoutOf } from "./model.mjs";
import "./hybrid.css";

const resting = () => readoutOf(carAt());

export function HybridFigure() {
  const share = Math.round((1 / (1 + RHO)) * 100);
  return (
    <Plate
      fig="Fig 2"
      title="Power split"
      hint={`Left brakes, right pulls · 1/${Math.round(1 / SLOW)} speed`}
      readout={resting()}
      keys={[
        { mark: "lit", label: "Windings and cables carrying current; the lit pulses run the way the power flows" },
        { mark: "flat", label: "Cut faces: engine block, head and transaxle case on one plane" },
        { mark: "dim", label: "Cavities: bores, crankcase, cam cover, ring gear" },
      ]}
      caption={`A sectioned training rig of a power-split hybrid. A ${(DISPLACEMENT / 1000).toFixed(1)} litre Atkinson four (${ENGINE.power} kW) turns the carrier of a planetary set: ${PSD.sun}-tooth sun on motor-generator 1, ${PSD.planets} planets of ${PSD.planet}, ${PSD.ring}-tooth ring to the wheels. The ring takes ${share}% of the engine's torque straight through; MG1 holds the sun against the rest and turns that power into current, and because its speed is free, so is the engine's. MG2 (${MG2_POWER} kW, ${MG2_TO_RING.toFixed(2)} turns per turn of the ring) drives or brakes the counter gear from the ${Math.round(BATTERY.volts)} V, ${BATTERY_KWH.toFixed(2)} kWh nickel-metal hydride pack (${BATTERY.modules} modules, ±${BATTERY.discharge} kW). The car pulls away on the battery; the engine starts above ${ENGINE_ON} kW of demand or ${EV_SPEED} km/h, the battery adds up to ${SYSTEM_POWER} kW in all, and braking sends up to ${BATTERY.charge} kW back. Ring to wheel ${RING_TO_WHEEL.toFixed(2)} : 1; conversion losses are left out, motion runs at 1/${Math.round(1 / SLOW)} of true speed, and the parts are drawn to no single scale.`}
    >
      <HybridArt />
    </Plate>
  );
}
