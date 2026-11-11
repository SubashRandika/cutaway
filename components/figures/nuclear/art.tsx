import { buildScene } from "./scene.mjs";
import { NuclearLive } from "./live";
import { LABELS } from "./labels.mjs";
import type { Callout } from "../callouts";

const LABEL =
  "A pressurised water reactor plant built as a model on a bench. At the left the containment, a concrete cylinder with a shallow dome, is cut in half to show inside: the reactor vessel in its concrete shield, cut open so the fuel assemblies and the control rods hanging into them can be seen, with the rods' drive housings standing on its head; a pump, a tall pressuriser on a platform, and a steam generator, also cut open, full of inverted U-shaped tubes. Pipes join them in a loop. A steam line leaves through the wall, passes an isolation valve and a governor valve and enters a high-pressure turbine; crossover pipes carry its exhaust through a moisture separator to a larger low-pressure turbine standing over the condenser. Both turbine casings are cut open to show their blade rows. The shaft runs on to a generator and exciter; a bus runs through a breaker to the step-up transformer, whose tall bushings feed three lines to a gantry and away to the grid. In front are a cooling-water canal with its pump and a control desk with three dials, a rod-position scale and a trip button.";

// Static art is computed once on the server; the client only moves keyed parts.
const SCENE = buildScene();

export function NuclearArt() {
  return <NuclearLive label={LABEL} defs={SCENE.defs} body={SCENE.body} flows={SCENE.flows} labels={LABELS as Callout[]} />;
}
