import { buildScene, REST_STATE } from "./scene.mjs";
import { PhevLive } from "./live";
import { LABELS } from "./labels.mjs";
import type { Callout } from "../callouts";

const LABEL =
  "A sectioned plug-in hybrid on a bench: an inline four-cylinder engine cut open to show its pistons, crankshaft, camshaft and plugs turns, through a damper, a generator on its own shaft. Past the generator an output gear rides on a sleeve, and a multi-plate lock-up clutch at the shaft's end can join the engine to it. That gear, and the pinion of a large traction motor standing in front on its own cradles, both mesh one counter gear, which turns a final drive and differential, a half shaft and a road wheel on two rollers. An inverter with a power meter sits on the transaxle, cabled to both machines and to a pack of 36 lithium iron phosphate blade modules with a charge gauge and an on-board charger. A wall charger on a post at the front runs its cord along the bench to a plug in the charger's inlet; a fuel tank feeds the engine.";

// Static art is computed once on the server; the client only moves keyed parts.
const SCENE = buildScene();

export function PhevArt() {
  return <PhevLive label={LABEL} defs={SCENE.defs} body={SCENE.body} flows={SCENE.flows} restCrank={REST_STATE.crank} labels={LABELS as Callout[]} />;
}
