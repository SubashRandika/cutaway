// Every scene the app can show. Metadata only, so the sidebar can import it
// without pulling any figure code into the client bundle.

export interface Scene {
  slug: string;
  title: string;
  summary: string;
  icon: "fuel" | "hybrid" | "plug" | "electric";
}

export const SCENES: Scene[] = [
  {
    slug: "petrol-engine",
    title: "Petrol engine",
    summary: "Fuel to a turning wheel",
    icon: "fuel",
  },
  {
    slug: "hybrid-system",
    title: "Hybrid system",
    summary: "Engine, motors and battery, split",
    icon: "hybrid",
  },
  {
    slug: "plug-in-hybrid",
    title: "Plug-in hybrid",
    summary: "Charge at the wall, drive on the battery",
    icon: "plug",
  },
  {
    slug: "electric-car",
    title: "Electric car",
    summary: "Battery, motor and one fixed gear",
    icon: "electric",
  },
];

export const sceneOf = (slug: string) => SCENES.find((scene) => scene.slug === slug);
export const hrefOf = (scene: Scene) => `/scenes/${scene.slug}`;
