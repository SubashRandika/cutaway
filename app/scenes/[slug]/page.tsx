import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EngineFigure } from "@/components/figures/engine/figure";
import { SCENES, sceneOf } from "@/lib/scenes";

// The figure for each scene, server-rendered. Add a scene here and in lib/scenes.ts.
const FIGURES: Record<string, { lede: string; Figure: () => React.ReactNode }> = {
  "petrol-engine": {
    lede: "A petrol engine burns a squeezed charge of fuel and air above a piston. The push turns a crankshaft, a clutch hands that turn to a gearbox, the gearbox trades speed for torque, and a final drive and half shaft turn the wheel.",
    Figure: EngineFigure,
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
