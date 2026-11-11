// Writes shots/nuclear-preview.html (and -dark): the scene at rest as one standalone page.
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { buildScene, REST_STATE } from "../components/figures/nuclear/scene.mjs";
import { WIDTH, HEIGHT } from "../components/figures/nuclear/view.mjs";
import { ISO_CSS } from "../components/iso/iso-kit.mjs";

const theme = process.argv.includes("--dark") ? "dark" : "light";
const pose = process.argv.includes("--pose");
const t0 = performance.now();
const scene = pose ? buildScene({ ...REST_STATE, bank: 0, shutdown: 0, heat: 0.02, scram: true, online: false, valve: 0, mwe: 0, level: 0.25, tavg: 291.7, turbine: 30, pump: 40 }) : buildScene();
const ms = (performance.now() - t0).toFixed(0);
const css = readFileSync(new URL("../components/figures/nuclear/nuclear.css", import.meta.url), "utf8");
const svg = `<svg class="iso-svg" viewBox="0 0 ${WIDTH} ${HEIGHT}"><defs>${scene.defs}</defs>${scene.body}</svg>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${ISO_CSS}${css} body{margin:0;background:var(--anatomy-page)} .wrap{max-width:900px;margin:20px auto}</style></head><body class="iso" data-theme="${theme}"><div class="wrap"><figure class="iso-figure"><div class="iso-plate"><div class="npp">${svg}</div></div></figure></div></body></html>`;
mkdirSync(new URL("../shots/", import.meta.url), { recursive: true });
writeFileSync(new URL(`../shots/nuclear-preview${theme === "dark" ? "-dark" : ""}${pose ? "-pose" : ""}.html`, import.meta.url), html);
console.log(`built in ${ms} ms, ${(html.length / 1024).toFixed(0)} KB, flows ${JSON.stringify(scene.flows)}`);
