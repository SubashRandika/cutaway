# Cutaway

Interactive isometric cutaway drawings of real machines: car drivetrains and a nuclear power plant. Each scene is a working rig drawn as a monochrome technical illustration: you drive it, and every moving part, gauge and readout comes from a small physical model of the real thing.

## Scenes

| Fig | Scene | What it shows | Controls |
| --- | --- | --- | --- |
| 1 | Petrol engine | A sectioned single-cylinder engine, clutch, five-speed gearbox, final drive and wheel; the combustion gas is a WebGL shader | ↑ ↓ throttle · ← → shift · 1–5 gear · N or 0 neutral |
| 2 | Hybrid system | A planetary power split between engine, two motor-generators and the wheels | ↑ ↓ pedal · Home coast · End floor it · B brake · 1–5 pedal position |
| 3 | Plug-in hybrid | Battery drive, series mode and the engine-lock clutch at cruise | As Fig 2, plus P plug in or unplug · S toggle Save |
| 4 | Electric car | Blade-cell pack, inverter, motor and fixed reduction; AC and DC charging | As Fig 2, plus A charge on AC · D charge on DC |
| 5 | Nuclear power plant | A pressurised water reactor: core and control rods, steam generator, turbines, condenser, generator and transformer; load following, a trip and decay heat | ↑ ↓ load · Home standby · End full · 1–4 load · S trip · R reset |

The sidebar groups the scenes by category (Vehicles, Power plants). On every figure you can also move the pointer across the drawing (hover or drag) as a pedal, throttle or load setting, toggle part labels, and switch between light and dark themes from the header. Leave a figure alone for a few seconds and it plays a short demo. Motion runs slower than true speed so the parts can be followed; each card's hint says by how much.

## Getting started

Requires Node.js 20.9 or later.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The home page redirects to the first scene.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build for production; every scene is prerendered as static HTML |
| `npm run start` | Serve the production build |

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, Turbopack) and React 19
- TypeScript, with the drawing code in plain ES modules (`.mjs`) so it runs unchanged in Node and the browser
- Tailwind CSS 4 and shadcn/ui (Radix) for the app shell; `next-themes` for light and dark
- SVG for the drawings and raw WebGL for the shader layers; no 3D or charting libraries

> Next.js 16 differs from earlier versions in places. Before changing framework code, read the matching guide in `node_modules/next/dist/docs/` (see [AGENTS.md](AGENTS.md)).

## Project structure

```text
app/
  layout.tsx              App shell: header, sidebar, theme provider
  page.tsx                Redirects to the first scene
  scenes/[slug]/page.tsx  One prerendered page per scene: heading, lede, figure
components/
  app/                    Header, sidebar, theme toggle
  ui/                     shadcn/ui primitives
  figures/
    callouts.tsx, .css    Part labels laid over a figure
    engine/ hybrid/ phev/ ev/ nuclear/   One folder per scene (see below)
  iso/                    The shared isometric drawing kit
    iso-kit.mjs           Projection, extruded solids, lines, dots, plate markup
    lathe.mjs             Solids of revolution, prisms, gears, frames, fillets
    tube.mjs              Shaded tubes for cables and pipes
    gl.mjs                WebGL layer in the figure's own camera
    react/                Plate, Stage and animation hooks
lib/scenes.ts             The scene list (slug, title, summary, icon, category) and the categories
scripts/                  Standalone preview pages for each scene
```

### How a figure is built

Each scene folder follows the same split:

| File | Role |
| --- | --- |
| `model.mjs` | The physics: state, a step function, and the readout text. Every number the card shows comes from here |
| `view.mjs` | World layout and dimensions, and the projection fitted to the 640 × 500 viewBox |
| `scene.mjs` | The static drawing in painter's order, with keyed slots where moving parts go |
| `frame.mjs` | Rebuilds the moving parts from the model's state each frame, as a flat map of keys to path data |
| `labels.mjs` | Named parts for the callouts |
| `live.tsx` | The client component: animation loop, pointer and keyboard input, demo tour, readout |
| `art.tsx`, `figure.tsx` | Server components that build the static drawing once and wrap it in the plate and caption |

The static art is computed on the server; in the browser, only the keyed parts are updated. Figures stop animating when off-screen and settle to a single still frame when the reader asks for reduced motion.

## Adding a scene

1. Create `components/figures/<name>/` with the files above, using an existing scene as a template.
2. Add the scene to `SCENES` in `lib/scenes.ts` with its `category` (add a new one to `CATEGORIES` if none fits). If it needs a new icon, add it to `ICONS` in `components/app/app-sidebar.tsx`.
3. Add its lede and figure to `FIGURES` in `app/scenes/[slug]/page.tsx`.

## Preview scripts

Each script writes one scene at rest as a standalone HTML page in `shots/` (gitignored), which helps when checking the drawing without running the app:

```bash
node scripts/preview-engine.mjs          # shots/engine-preview.html
node scripts/preview-ev.mjs --dark       # shots/ev-preview-dark.html
node scripts/preview-phev.mjs --pose     # an alternate pose, where supported (ev, phev, nuclear)
```
