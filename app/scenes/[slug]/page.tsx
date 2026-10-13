import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EngineFigure } from "@/components/figures/engine/figure";
import { HybridFigure } from "@/components/figures/hybrid/figure";
import { PhevFigure } from "@/components/figures/phev/figure";
import { EvFigure } from "@/components/figures/ev/figure";
import { SCENES, sceneOf } from "@/lib/scenes";

// The figure for each scene, server-rendered. Add a scene here and in lib/scenes.ts.
const FIGURES: Record<string, { lede: string; Figure: () => React.ReactNode }> = {
  "petrol-engine": {
    lede: "A petrol engine burns a squeezed charge of fuel and air above a piston. The push turns a crankshaft, a clutch hands that turn to a gearbox, the gearbox trades speed for torque, and a final drive and half shaft turn the wheel.",
    Figure: EngineFigure,
  },
  "hybrid-system": {
    lede: "A hybrid joins an engine and two electric motor-generators through one planetary gear set. The engine turns the planet carrier, one motor holds the sun gear, and the ring gear drives the wheels with the second motor. By changing how fast the first motor lets the sun turn, the system sets the engine's speed freely, moving power between engine, battery and wheels as you pull away, cruise, overtake and brake.",
    Figure: HybridFigure,
  },
  "plug-in-hybrid": {
    lede: "A plug-in hybrid carries a battery big enough to live on: charged from the wall, it drives the car on its electric motor for everyday trips. When the pull is hard, the road is long or the pack runs low, the engine starts and turns a generator whose current feeds the motor. At a steady cruise a clutch can lock the engine straight to the wheels, the most efficient way to use it at speed.",
    Figure: PhevFigure,
  },
  "electric-car": {
    lede: "An electric car has no engine, no gearbox and no clutch. A large battery of lithium iron phosphate cells feeds an inverter, which turns its direct current into the three-phase current that spins a permanent-magnet motor; two fixed gear stages slow that spin to wheel speed. Lift off or brake and the motor runs as a generator, sending energy back to the pack. Charging is AC through the car's own charger at home, or DC straight into the pack at a fast charger.",
    Figure: EvFigure,
  },
};

export function generateStaticParams() {
  return SCENES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const scene = sceneOf((await params).slug);
  return scene ? { title: scene.title, description: scene.summary } : {};
}

export default async function ScenePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const scene = sceneOf(slug);
  const entry = FIGURES[slug];
  if (!scene || !entry) notFound();
  const { Figure, lede } = entry;
  return (
    <main className="scene">
      <h1>{scene.title}</h1>
      <p>{lede}</p>
      <Figure />
    </main>
  );
}
