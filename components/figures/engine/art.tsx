import { buildScene, REST_STATE } from "./scene.mjs";
import { EngineLive } from "./live";

const LABEL =
  "A sectioned training rig on a bench: a single-cylinder petrol engine cut open to show its piston, connecting rod, crankshaft, two valves with springs and cams, spark plug and ports, bolted through a flywheel and clutch to a five-speed gearbox whose gears all turn, a final drive and differential, and a half shaft to a road wheel standing on two rollers. A fuel tank sits on the bench.";

// Static art is computed once on the server; the client only moves keyed parts.
const SCENE = buildScene();

export function EngineArt() {
  return <EngineLive label={LABEL} defs={SCENE.defs} back={SCENE.back} front={SCENE.front} restCrank={REST_STATE.crank} />;
}
