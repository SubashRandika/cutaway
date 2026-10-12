// Every scene the app can show. Metadata only, so the sidebar can import it
// without pulling any figure code into the client bundle.

export interface Scene {
  slug: string;
  title: string;
  summary: string;
  icon: "fuel";
}

export const SCENES: Scene[] = [
  {
    slug: "petrol-engine",
    title: "Petrol engine",
    summary: "Fuel to a turning wheel",
    icon: "fuel",
  },
];

export const sceneOf = (slug: string) => SCENES.find((scene) => scene.slug === slug);
export const hrefOf = (scene: Scene) => `/scenes/${scene.slug}`;
