// Every scene the app can show, and the categories the sidebar groups them in.
// Metadata only, so the sidebar can import it without pulling any figure code
// into the client bundle.

export type Category = "vehicles" | "power-plants";

export interface Scene {
  slug: string;
  title: string;
  summary: string;
  icon: "fuel" | "hybrid" | "plug" | "electric" | "atom";
  category: Category;
}

// In sidebar order. Add a category here before giving a scene a new one.
export const CATEGORIES: Array<{ id: Category; title: string }> = [
  { id: "vehicles", title: "Vehicles" },
  { id: "power-plants", title: "Power plants" },
];

export const SCENES: Scene[] = [
  {
    slug: "petrol-engine",
    title: "Petrol engine",
    summary: "Fuel to a turning wheel",
    icon: "fuel",
    category: "vehicles",
  },
  {
    slug: "hybrid-system",
    title: "Hybrid system",
    summary: "Engine, motors and battery, split",
    icon: "hybrid",
    category: "vehicles",
  },
  {
    slug: "plug-in-hybrid",
    title: "Plug-in hybrid",
    summary: "Charge at the wall, drive on the battery",
    icon: "plug",
    category: "vehicles",
  },
  {
    slug: "electric-car",
    title: "Electric car",
    summary: "Battery, motor and one fixed gear",
    icon: "electric",
    category: "vehicles",
  },
  {
    slug: "nuclear-power-plant",
    title: "Nuclear power plant",
    summary: "Fission heat to steam to the grid",
    icon: "atom",
    category: "power-plants",
  },
];

export const sceneOf = (slug: string) => SCENES.find((scene) => scene.slug === slug);
export const hrefOf = (scene: Scene) => `/scenes/${scene.slug}`;
export const scenesIn = (category: Category) => SCENES.filter((scene) => scene.category === category);
