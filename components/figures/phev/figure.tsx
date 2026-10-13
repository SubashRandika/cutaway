import { Plate } from "../../iso/react/draw";
import { PhevArt } from "./art";
import {
  BATTERY, BATTERY_KWH, CHARGER, DISPLACEMENT, ENGINE, ENGINE_TO_WHEEL, EV_ON, EV_TOP, GEN_POWER, LOCK_KMH, MOTOR_POWER, MOTOR_TO_WHEEL, SLOW, SYSTEM_POWER, carAt, readoutOf, fullIn,
} from "./model.mjs";
import "../callouts.css";
import "./phev.css";

const resting = () => {
  const car = carAt();
  car.plugged = true;
  car.plug = 1;
  car.chargeKw = CHARGER.kw;
  return readoutOf(car);
};

export function PhevFigure() {
  const parked = carAt();
  return (
    <Plate
      fig="Fig 3"
      title="Plug-in hybrid"
      hint={`Left brakes, right pulls · 1/${Math.round(1 / SLOW)} speed`}
      readout={resting()}
      keys={[
        { mark: "lit", label: "Windings, cables and charge lamps carrying current; the lit pulses run the way the power flows" },
        { mark: "flat", label: "Cut faces: engine block, head and transaxle case on one plane" },
        { mark: "dim", label: "Cavities: bores, crankcase, cam cover, the case's inside" },
      ]}
      caption={`A sectioned training rig of a plug-in series-parallel hybrid. A ${(DISPLACEMENT / 1000).toFixed(1)} litre Atkinson four (${ENGINE.power} kW) turns a ${GEN_POWER} kW generator on its own shaft; it never drives the wheels unless the lock-up clutch closes. A ${MOTOR_POWER} kW traction motor (${MOTOR_TO_WHEEL.toFixed(2)} turns per wheel turn) does the driving, fed from a ${Math.round(BATTERY.volts)} V, ${BATTERY_KWH.toFixed(1)} kWh lithium iron phosphate pack of ${BATTERY.cells} cells in ${BATTERY.modules} blade modules. Plugged in, a ${CHARGER.kw} kW on-board charger fills the pack from a ${CHARGER.volts} V wall charger: from ${Math.round(parked.soc * 100)}% that takes ${fullIn(parked)}. In Auto the car runs on the battery alone up to ${EV_ON} kW of demand or ${EV_TOP} km/h; past that, or with the pack near empty, the engine starts and runs as a generator (series), its current going straight to the motor. Save holds the charge: from ${LOCK_KMH} km/h the clutch locks and the engine turns the wheels through one fixed gear (${ENGINE_TO_WHEEL.toFixed(2)} : 1 to the wheel), the generator banking its spare torque and the motor helping on hills. Braking sends up to ${BATTERY.charge} kW back; the system gives up to ${SYSTEM_POWER} kW. Conversion losses are left out, motion runs at 1/${Math.round(1 / SLOW)} of true speed, and the parts are drawn to no single scale.`}
    >
      <PhevArt />
    </Plate>
  );
}
