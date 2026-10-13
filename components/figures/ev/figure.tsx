import { Plate } from "../../iso/react/draw";
import { EvArt } from "./art";
import { AC, BATTERY, BATTERY_KWH, BATTERY_VOLTS, CAR, DC, MOTOR, REDUCTION, SLOW, STAGE1, STAGE2, carAt, chargeRate, readoutOf, timeTo } from "./model.mjs";
import "../callouts.css";
import "./ev.css";

const resting = () => {
  const car = carAt();
  car.charge = "dc";
  car.kind = "dc";
  car.plug = 1;
  car.dcContact = 1;
  car.chargeKw = chargeRate("dc", car.soc);
  return readoutOf(car);
};

export function EvFigure() {
  const parked = carAt();
  return (
    <Plate
      fig="Fig 4"
      title="Electric car"
      hint={`Left brakes, right pulls · 1/${Math.round(1 / SLOW)} speed`}
      readout={resting()}
      keys={[
        { mark: "lit", label: "Windings, cables and charge lamps carrying current; the lit pulses run the way the power flows" },
        { mark: "flat", label: "Cut faces: the e-axle's case on one plane" },
        { mark: "dim", label: "Cavities: the case's inside, the inlet's sockets" },
      ]}
      caption={`A training rig of a battery-electric car in the manner of BYD's e-Platform 3.0. There is no gearbox and no clutch: a ${MOTOR.power} kW, ${MOTOR.torque} N·m permanent-magnet motor turns the wheels through two fixed gear stages (${STAGE1.pinion} to ${STAGE1.gear}, then ${STAGE2.pinion} to ${STAGE2.ring}, ${REDUCTION.toFixed(2)} : 1) and an open differential, up to ${MOTOR.max.toLocaleString("en-US")} rpm and ${CAR.top} km/h. Its inverter turns the pack's ${Math.round(BATTERY_VOLTS)} V into three-phase current, and back again when you lift off or brake: the motor becomes a generator and returns up to ${BATTERY.regen} kW, the friction brakes doing the rest. The Blade pack is ${BATTERY.cells} lithium iron phosphate cells of ${BATTERY.cellVolts} V and ${BATTERY.amphours} Ah in series, ${BATTERY_KWH.toFixed(2)} kWh. On AC the on-board charger converts the mains, ${AC.kw} kW, ${timeTo(parked, "ac", 1)} from ${Math.round(parked.soc * 100)}% to full. On DC the charger itself does that work: two more contactors close and up to ${DC.kw} kW goes straight to the cells, tapering as they fill, ${timeTo(parked, "dc", 0.8)} from ${Math.round(parked.soc * 100)}% to 80%. Conversion losses are left out, motion runs at 1/${Math.round(1 / SLOW)} of true speed, and the parts are drawn to no single scale.`}
    >
      <EvArt />
    </Plate>
  );
}
