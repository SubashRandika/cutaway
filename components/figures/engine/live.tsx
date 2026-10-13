"use client";

import * as React from "react";
import { asksForStillness, useReadout } from "../../iso/react/live";
import { frameOf } from "./frame.mjs";
import { driveAt, gearName, readoutOf, requestGear, spokenOf, stepDrive } from "./model.mjs";
import { HEIGHT, WIDTH } from "./view.mjs";
import { mountGas } from "./gas.mjs";
import { CalloutKey, Callouts, type Callout } from "../callouts";

type Drive = ReturnType<typeof driveAt>;
type Frame = Record<string, unknown>;

const TOUR_FIRST = 1.4;
const TOUR_BACK = 3600;
const MOST_DT = 1 / 30;
const TOUR: Array<[number, number, number]> = [
  // [at seconds, throttle, gear]
  [0, 0, 0],
  [4.5, 0, 1],
  [7.5, 0.22, 1],
  [11, 0.22, 2],
  [14, 0.36, 2],
  [16.5, 0.36, 3],
  [20.5, 0.5, 3],
  [23, 0.5, 4],
  [27, 0, 4],
  [29.5, 0, 0],
];
const TOUR_LOOP = 34;

function tourAt(t: number) {
  const at = t % TOUR_LOOP;
  let step = TOUR[0];
  for (const entry of TOUR) if (entry[0] <= at) step = entry;
  return { throttle: step[1], gear: step[2] };
}

const tenth = (n: number) => Math.round(n * 10) / 10;
const dotsHtml = (points: Array<number[]>, size: number) =>
  points.map(([x, y, a]) => `<circle cx="${tenth(x)}" cy="${tenth(y)}" r="${size}"${a !== undefined && a < 1 ? ` fill-opacity="${a.toFixed(2)}"` : ""}/>`).join("");

function apply(nodes: Map<string, Element[]>, last: Map<string, string>, frame: Frame) {
  for (const key in frame) {
    const value = frame[key];
    const at = key.indexOf("@");
    const base = at < 0 ? key : key.slice(0, at);
    const list = nodes.get(base);
    if (!list) continue;
    if (Array.isArray(value)) {
      const size = Number((list[0] as SVGElement).firstElementChild?.getAttribute("r") ?? 0.5);
      const html = dotsHtml(value as number[][], size);
      if (last.get(key) === html) continue;
      last.set(key, html);
      for (const node of list) node.innerHTML = html;
      continue;
    }
    const text = typeof value === "boolean" ? (value ? "1" : "") : String(value);
    if (last.get(key) === text) continue;
    last.set(key, text);
    const kind = at < 0 ? "d" : key.slice(at + 1);
    for (const node of list) {
      if (kind === "d") node.setAttribute("d", text);
      else if (kind === "t") node.setAttribute("transform", text);
      else if (kind === "o") (node as SVGElement).style.opacity = text;
      else if (kind === "on") node.toggleAttribute("data-on", Boolean(text));
    }
  }
}

interface Props {
  label: string;
  defs: string;
  back: string;
  front: string;
  restCrank: number;
  labels: Callout[];
}

export function EngineLive({ label, defs, back, front, restCrank, labels }: Props) {
  const { anchor, say } = useReadout<HTMLDivElement>();
  const root = React.useRef<HTMLDivElement | null>(null);
  const canvas = React.useRef<HTMLCanvasElement | null>(null);
  const drive = React.useRef<Drive>(null as unknown as Drive);
  if (!drive.current) {
    drive.current = driveAt();
    drive.current.angle.crank = restCrank;
    drive.current.angle.input = restCrank;
  }
  const want = React.useRef({ throttle: 0 });
  const nodes = React.useRef(new Map<string, Element[]>());
  const last = React.useRef(new Map<string, string>());
  const frame = React.useRef(0);
  const clock = React.useRef(0);
  const touring = React.useRef(false);
  const gas = React.useRef<ReturnType<typeof mountGas> | null>(null);
  const [visible, setVisible] = React.useState(false);
  const [engaged, setEngaged] = React.useState(false);
  const [idle, setIdle] = React.useState(true);
  const [poke, setPoke] = React.useState(0);
  const [gear, setGear] = React.useState(0);
  const [spoken, setSpoken] = React.useState("");
  const [named, setNamed] = React.useState(true);

  const draw = React.useCallback(() => {
    const d = drive.current;
    const f = frameOf({ ...d.angle, throttle: d.throttle, rpm: d.rpm, clutch: d.clutch, gear: d.gear, want: d.want, from: d.from, phase: d.phase, selector: d.selector, calm: asksForStillness() });
    apply(nodes.current, last.current, f as unknown as Frame);
    gas.current?.draw(d, asksForStillness());
    say(readoutOf(d));
  }, [say]);

  const drawRef = React.useRef(draw);
  drawRef.current = draw;

  const run = React.useCallback(() => {
    if (frame.current) return;
    let then = 0;
    const tick = (now: number) => {
      const dt = then ? Math.min((now - then) / 1000, MOST_DT) : 1 / 60;
      then = now;
      const calm = asksForStillness();
      const d = drive.current;
      if (touring.current && !calm) {
        clock.current += dt;
        const step = tourAt(clock.current);
        want.current.throttle = step.throttle;
        if (step.gear !== d.want) requestGear(d, step.gear);
      }
      d.throttle += (want.current.throttle - d.throttle) * (calm ? 1 : 1 - Math.exp(-dt / 0.18));
      stepDrive(d, calm ? 0 : dt, calm);
      draw();
      if (d.gear !== gearRef.current && d.phase !== "select") {
        gearRef.current = d.gear;
        setGear(d.gear);
      }
      frame.current = calm ? 0 : requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [draw]);
  const gearRef = React.useRef(0);

  const stop = React.useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
  }, []);

  React.useEffect(() => {
    const node = root.current;
    if (!node) return;
    const map = new Map<string, Element[]>();
    node.querySelectorAll("[data-k]").forEach((el) => {
      const key = el.getAttribute("data-k")!;
      const list = map.get(key);
      if (list) list.push(el);
      else map.set(key, [el]);
    });
    nodes.current = map;
    if (canvas.current) gas.current = mountGas(canvas.current);
    const observer = new IntersectionObserver((entries) => setVisible(Boolean(entries.at(-1)?.isIntersecting)), { rootMargin: "120px 0px" });
    observer.observe(node);
    // a theme switch must repaint even when the loop is idle (reduced motion)
    const themeRoot = node.closest(".iso");
    const themeWatch = new MutationObserver(() => drawRef.current());
    if (themeRoot) themeWatch.observe(themeRoot, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      themeWatch.disconnect();
      observer.disconnect();
      gas.current?.destroy();
      stop();
    };
  }, [stop]);

  React.useEffect(() => {
    if (engaged) {
      setIdle(false);
      return;
    }
    const timer = window.setTimeout(() => setIdle(true), TOUR_BACK);
    return () => window.clearTimeout(timer);
  }, [engaged, poke]);

  React.useEffect(() => {
    if (!visible) {
      stop();
      return;
    }
    if (asksForStillness()) {
      touring.current = false;
      draw();
      return;
    }
    run();
    if (idle && !engaged) {
      const timer = window.setTimeout(() => {
        clock.current = 0;
        touring.current = true;
      }, TOUR_FIRST * 1000);
      return () => window.clearTimeout(timer);
    }
    touring.current = false;
  }, [visible, idle, engaged, run, stop, draw]);

  const wake = () => {
    touring.current = false;
    setIdle(false);
    setPoke((n) => n + 1);
  };

  const shift = (next: number) => {
    wake();
    const d = drive.current;
    requestGear(d, next);
    setSpoken(`${next ? `${gearName(next)} gear` : "neutral"}`);
    if (asksForStillness()) {
      stepDrive(d, 0, true);
      stepDrive(d, 0, true);
      stepDrive(d, 0, true);
      setGear(d.gear);
      draw();
    } else run();
  };

  const throttleTo = (value: number) => {
    want.current.throttle = Math.min(1, Math.max(0, value));
    if (asksForStillness()) {
      drive.current.throttle = want.current.throttle;
      stepDrive(drive.current, 0, true);
      draw();
    }
  };

  const across = (clientX: number) => {
    const box = root.current?.querySelector("svg")?.getBoundingClientRect();
    if (!box || !box.width) return 0;
    return Math.min(1, Math.max(0, ((clientX - box.left) / box.width - 0.12) / 0.76));
  };

  const dragging = React.useRef(false);

  return (
    <div
      ref={(node) => {
        root.current = node;
        anchor.current = node;
      }}
      className="eng"
      role="group"
      tabIndex={0}
      aria-label="Engine rig. Up and down arrows open and close the throttle, left and right arrows shift down and up, keys 1 to 5 pick a gear and N or 0 neutral."
      aria-roledescription="interactive figure"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setEngaged(true);
      }}
      onPointerMove={(event) => {
        if (event.pointerType === "mouse" || dragging.current) {
          wake();
          throttleTo(across(event.clientX));
        }
      }}
      onPointerDown={(event) => {
        if ((event.target as Element).closest("button")) return;
        if (event.pointerType !== "mouse") {
          dragging.current = true;
          setEngaged(true);
          event.currentTarget.setPointerCapture(event.pointerId);
          wake();
          throttleTo(across(event.clientX));
          return;
        }
        const d = drive.current;
        shift(d.want >= 5 ? 0 : d.want + 1);
      }}
      onPointerUp={(event) => {
        if (!dragging.current) return;
        dragging.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        throttleTo(0);
        setEngaged(false);
      }}
      onPointerCancel={() => {
        dragging.current = false;
        throttleTo(0);
        setEngaged(false);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        throttleTo(0);
        setEngaged(false);
      }}
      onFocus={() => {
        setEngaged(true);
        setSpoken(spokenOf(drive.current));
      }}
      onBlur={() => setEngaged(false)}
      onKeyDown={(event) => {
        const d = drive.current;
        const key = event.key;
        let handled = true;
        if (key === "ArrowUp") throttleTo(want.current.throttle + (event.shiftKey ? 0.3 : 0.1));
        else if (key === "ArrowDown") throttleTo(want.current.throttle - (event.shiftKey ? 0.3 : 0.1));
        else if (key === "ArrowRight") shift(Math.min(5, d.want + 1));
        else if (key === "ArrowLeft") shift(Math.max(0, d.want - 1));
        else if (/^[1-5]$/.test(key)) shift(Number(key));
        else if (key === "0" || key === "n" || key === "N") shift(0);
        else if (key === "Home" || key === "Escape") throttleTo(0);
        else if (key === "End") throttleTo(1);
        else handled = false;
        if (handled) {
          event.preventDefault();
          wake();
          run();
        }
      }}
    >
      <div className="eng-stack iso-stage">
        <svg className="iso-svg eng-back" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} focusable="false">
          <defs dangerouslySetInnerHTML={{ __html: defs }} />
          <g dangerouslySetInnerHTML={{ __html: back }} />
        </svg>
        <canvas ref={canvas} aria-hidden="true" />
        <svg className="iso-svg eng-front" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" focusable="false">
          <g dangerouslySetInnerHTML={{ __html: front }} />
        </svg>
        <Callouts items={labels} width={WIDTH} height={HEIGHT} show={named} />
      </div>
      <div className="eng-gears" role="group" aria-label="Gear">
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className="eng-gear" aria-pressed={gear === n} onClick={() => shift(n)}>
            {n === 0 ? "N" : n}
          </button>
        ))}
        <button type="button" className="eng-gear callout-toggle" aria-pressed={named} onClick={() => setNamed((on) => !on)}>
          Labels
        </button>
      </div>
      <CalloutKey items={labels} show={named} />
      <span className="eng-live" aria-live="polite">
        {spoken}
      </span>
    </div>
  );
}
