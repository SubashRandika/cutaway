// Writes shots/ev-preview.html (and -dark): the scene at rest as one standalone page.
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { buildScene, REST_STATE } from "../components/figures/ev/scene.mjs";
import { WIDTH, HEIGHT } from "../components/figures/ev/view.mjs";
import { ISO_CSS } from "../components/iso/iso-kit.mjs";

const theme = process.argv.includes("--dark") ? "dark" : "light";
const t0 = performance.now();
const pose = process.argv.includes("--pose");
const scene = pose ? buildScene({ ...REST_STATE, plug: 0, dcContact: 0, motor: 140, inter: 40, wheel: 20 }) : buildScene();
const ms = (performance.now() - t0).toFixed(0);
const css = readFileSync(new URL("../components/figures/ev/ev.css", import.meta.url), "utf8");
const svg = `<svg class="iso-svg" viewBox="0 0 ${WIDTH} ${HEIGHT}"><defs>${scene.defs}</defs>${scene.body}</svg>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${ISO_CSS}${css} body{margin:0;background:var(--anatomy-page)} .wrap{max-width:900px;margin:20px auto}</style></head><body class="iso" data-theme="${theme}"><div class="wrap"><figure class="iso-figure"><div class="iso-plate"><div class="elv">${svg}</div></div></figure></div></body></html>`;
mkdirSync(new URL("../shots/", import.meta.url), { recursive: true });
writeFileSync(new URL(`../shots/ev-preview${theme === "dark" ? "-dark" : ""}${pose ? "-pose" : ""}.html`, import.meta.url), html);
console.log(`built in ${ms} ms, ${(html.length / 1024).toFixed(0)} KB, flows ${JSON.stringify(scene.flows)}`);
