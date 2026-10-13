import { Plate } from "../../iso/react/draw";
import { EngineArt } from "./art";
import { DISPLACEMENT, ENGINE, FINAL_RATIO, IDLE, PAIRS, RATIOS, REDLINE, SLOW, TYRE, driveAt, readoutOf } from "./model.mjs";
import { REST_STATE } from "./scene.mjs";
import "../callouts.css";
import "./engine.css";

const resting = () => {
  const drive = driveAt();
  drive.angle.crank = REST_STATE.crank;
  return readoutOf(drive);
};

export function EngineFigure() {
  const ratios = RATIOS.slice(1).map((ratio: number) => ratio.toFixed(2)).join(", ");
  return (
    <Plate
      fig="Fig 1"
      title="Fuel to wheel"
      hint={`Hover or drag throttle · click shifts · 1/${Math.round(1 / SLOW)} speed`}
      readout={resting()}
      keys={[
        { mark: "lit", label: "Gear pair carrying the drive" },
        { mark: "flat", label: "Cut faces: cylinder and head on one plane, crankcase and transaxle on another" },
        { mark: "dim", label: "Cavities: bore, ports, crankcase, gearbox" },
      ]}
      caption={`A sectioned training rig. A ${Math.round(DISPLACEMENT)} cc single (${ENGINE.bore} × ${ENGINE.stroke} mm) draws in fuel and air, squeezes it ${ENGINE.compression}:1, fires it from a spark ahead of top centre and pushes the burnt gas out, one power stroke every two turns. The crank turns the flywheel and clutch; the five-speed constant-mesh gearbox (${ratios} : 1, all ${PAIRS.length} pairs always turning, one locked by its collar) and the ${FINAL_RATIO.toFixed(2)} : 1 final drive turn a ${TYRE.size} wheel on a rolling road. Idle ${IDLE} rpm, redline ${REDLINE.toLocaleString("en-US")}; motion runs at 1/${Math.round(1 / SLOW)} of true speed, and the parts are drawn to no single scale.`}
    >
      <EngineArt />
    </Plate>
  );
}
