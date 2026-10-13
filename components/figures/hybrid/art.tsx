import { buildScene, REST_STATE } from "./scene.mjs";
import { HybridLive } from "./live";

const LABEL =
  "A sectioned power-split hybrid on a bench: an inline four-cylinder engine cut open to show its pistons, crankshaft, camshaft and plugs drives, through a damper, the carrier of an open planetary gear set. Motor-generator 1 behind it holds the sun gear; the ring gear's outer teeth drive a counter gear that motor-generator 2, standing in front on its own shaft, also drives. A final drive and differential turn a half shaft to a road wheel on two rollers. An inverter with a power meter sits on the transaxle, cabled to both motors and to a battery pack of 28 modules with a charge gauge; a fuel tank feeds the engine.";

// Static art is computed once on the server; the client only moves keyed parts.
const SCENE = buildScene();

export function HybridArt() {
  return <HybridLive label={LABEL} defs={SCENE.defs} body={SCENE.body} flows={SCENE.flows} restCrank={REST_STATE.crank} />;
}
