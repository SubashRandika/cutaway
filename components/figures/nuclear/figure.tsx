import { Plate } from "../../iso/react/draw";
import { NuclearArt } from "./art";
import { CORE, CONDENSER, FAST, PLANT, PRIMARY, RODS, SLOW, STEAM, TRIP, TURBINE, mwe, plantAt, readoutOf } from "./model.mjs";
import "../callouts.css";
import "./nuclear.css";

const whole = (n: number) => Math.round(n).toLocaleString("en-US");

export function NuclearFigure() {
  const full = plantAt(1);
  return (
    <Plate
      fig="Fig 5"
      title="Nuclear power plant"
      hint={`Across sets the load · S trips · ${FAST}× time`}
      readout={readoutOf(full)}
      keys={[
        { mark: "lit", label: "The core's glow, the control rods you drive, and pulses of water, steam and current running the way they flow" },
        { mark: "flat", label: "Cut faces: the containment, the vessels and the turbine casings, each on its own centre plane" },
        { mark: "dim", label: "Water in the vessels, the condenser's hotwell and the canal" },
      ]}
      caption={`A model of a pressurised water reactor plant in the manner of a Westinghouse four-loop unit; one of its four loops is drawn. Fission in ${CORE.assemblies} fuel assemblies of ${CORE.rods} uranium oxide rods each heats water held at ${PRIMARY.bar} bar so it cannot boil: it leaves the core at about ${Math.round(PRIMARY.fullT + PRIMARY.coreRise / 2)} °C and returns at ${Math.round(PRIMARY.fullT - PRIMARY.coreRise / 2)} °C, ${whole(PRIMARY.flow)} kg/s pushed round by pumps turning at ${whole(PRIMARY.pumpRpm)} rpm. In the steam generators that water boils a separate feed of water into steam at ${STEAM.fullBar} bar, ${whole(STEAM.flow)} kg/s at full power, which spins the turbines at ${whole(TURBINE.rpm)} rpm and a ${TURBINE.poles}-pole generator at ${TURBINE.hz} Hz and ${TURBINE.kv} kV; the transformer steps that up to ${TURBINE.gridKv} kV. ${whole(PLANT.thermal)} MW of heat makes ${whole(mwe(full))} MW of electricity, about a third; the rest leaves in the condenser, at ${CONDENSER.kpa} kPa and ${CONDENSER.celsius} °C, to the cooling water. The load leads: open the governor valve and more steam leaves, the returning water runs cooler, cooler water slows neutrons better, and the core's power rises to match; the control rods then step, up to ${RODS.perMin} steps a minute over ${RODS.steps}, to bring the average temperature back to its programme. Above ${Math.round(TRIP.highFlux * 100)}% power, or at the trip button, every rod falls into the core in about ${RODS.dropS} s; fission stops, but decay heat, about 6.5% of full power at first, keeps coming and goes to the condenser through the steam dumps. Kinetics are one delayed-neutron group with fuel and moderator feedback. The plant's clock runs ${FAST} times faster than true, the rods fall at true speed, turning parts are drawn at 1/${Math.round(1 / SLOW)} of their speed, and the parts are drawn to no single scale.`}
    >
      <NuclearArt />
    </Plate>
  );
}
