import { buildScene } from "./scene.mjs";
import { EvLive } from "./live";
import { LABELS } from "./labels.mjs";
import type { Callout } from "../callouts";

const LABEL =
  "A battery-electric drivetrain on a bench. At the left an open tray holds a Blade pack of 126 long, thin lithium iron phosphate cells in two rows, with cell-monitoring boards on the member between them and a battery disconnect unit at its corner carrying four contactors and a charge gauge. Beside it the e-axle's case is cut open: a large motor turns a small pinion, a big intermediate gear and its own pinion, and the differential's ring gear, which drives a half shaft to a road wheel on two rollers. On top of the case sit the inverter with a power meter and a finned on-board charger. A charging post at the front runs its cord to a plug in a CCS2 inlet on a charge port box, whose cables run to the charger for AC and straight to the pack for DC.";

// Static art is computed once on the server; the client only moves keyed parts.
const SCENE = buildScene();

export function EvArt() {
  return <EvLive label={LABEL} defs={SCENE.defs} body={SCENE.body} flows={SCENE.flows} labels={LABELS as Callout[]} />;
}
