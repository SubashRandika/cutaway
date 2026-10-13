"use client";

import * as React from "react";
import { asksForStillness, useReadout } from "../../iso/react/live";
import { frameOf } from "./frame.mjs";
import { carAt, readoutOf, spokenOf, steadySpeed, stepCar } from "./model.mjs";
import { HEIGHT, WIDTH } from "./view.mjs";

type Car = ReturnType<typeof carAt>;
type Frame = Record<string, unknown>;

const TOUR_FIRST = 1.4;
const TOUR_BACK = 3600;
const MOST_DT = 1 / 30;
// [at seconds, pedal]: pull away on the battery, the engine joins, cruise, overtake, brake to a stop
const TOUR: Array<[number, number]> = [
  [0, 0],
  [1.5, 0.45],
  [16, 0.1],
  [21, 1],
  [25, -0.45],
  [39, 0],
];
const TOUR_LOOP = 43;
const STILL_SPEED = 60 / 3.6;

export const PEDALS: Array<[string, number]> = [
  ["Brake", -0.5],
  ["Coast", 0],
  ["Ease", 0.15],
  ["Pull", 0.45],
  ["Floor", 1],
];

function tourAt(t: number) {
  const at = t % TOUR_LOOP;
  let step = TOUR[0];
  for (const entry of TOUR) if (entry[0] <= at) step = entry;
  return step[1];
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

// which power each cable carries; every route runs from the source end
const powerOf = (name: string, car: Car) => (name.startsWith("dc") ? car.batteryKw : name.startsWith("mg1") ? car.mg1Kw : car.mg2Kw);

interface Props {
  label: string;
  defs: string;
  body: string;
  flows: Record<string, number>;
  restCrank: number;
}

export function HybridLive({ label, defs, body, flows, restCrank }: Props) {
  const { anchor, say } = useReadout<HTMLDivElement>();
  const root = React.useRef<HTMLDivElement | null>(null);
  const stage = React.useRef<HTMLDivElement | null>(null);
  const car = React.useRef<Car>(null as unknown as Car);
  if (!car.current) {
    car.current = carAt();
    car.current.angle.crank = restCrank;
  }
  const want = React.useRef({ pedal: 0, held: false });
  const phases = React.useRef<Record<string, number>>({});
  const nodes = React.useRef(new Map<string, Element[]>());
  const last = React.useRef(new Map<string, string>());
  const frame = React.useRef(0);
  const clock = React.useRef(0);
  const touring = React.useRef(false);
  const [visible, setVisible] = React.useState(false);
  const [engaged, setEngaged] = React.useState(false);
  const [idle, setIdle] = React.useState(true);
  const [poke, setPoke] = React.useState(0);
  const [pedal, setPedal] = React.useState(0);
  const [spoken, setSpoken] = React.useState("");

  const draw = React.useCallback(
    (dt = 0) => {
      const c = car.current;
      const calm = asksForStillness();
      const flow: Record<string, { count: number; phase: number; power: number }> = {};
      for (const name in flows) {
        const power = powerOf(name, c);
        // pulses run at a pace that grows with the power, in the direction it flows
        const rate = Math.abs(power) > 0.6 ? Math.sign(power) * (2.4 + Math.abs(power) / 5) : 0;
        phases.current[name] = calm ? 0.75 : (phases.current[name] ?? 0) + rate * dt;
        flow[name] = { count: flows[name], phase: phases.current[name], power };
      }
      const f = frameOf({ ...c.angle, firing: c.engine === "on", calm, soc: c.soc, batteryKw: c.batteryKw, mg1Kw: c.mg1Kw, mg2Kw: c.mg2Kw, engineRpm: c.engineRpm, mg1Rpm: c.mg1Rpm, mg2Rpm: c.mg2Rpm, flow });
      apply(nodes.current, last.current, f as unknown as Frame);
      say(readoutOf(c));
    },
    [say, flows],
  );

  const drawRef = React.useRef(draw);
  drawRef.current = draw;
  const pedalRef = React.useRef(0);
  const touched = React.useRef(false);

  const settleStill = React.useCallback(() => {
    // reduced motion: one still frame of the chosen pedal at 60 km/h, so every pedal shows its mode
    const c = car.current;
    c.pedal = want.current.pedal;
    c.speed = touched.current ? STILL_SPEED : steadySpeed(c.pedal);
    stepCar(c, 0, true);
    stepCar(c, 0, true);
    drawRef.current(0);
  }, []);

  const run = React.useCallback(() => {
    if (frame.current) return;
    let then = 0;
    const tick = (now: number) => {
      const dt = then ? Math.min((now - then) / 1000, MOST_DT) : 1 / 60;
      then = now;
      const calm = asksForStillness();
      if (calm) {
        frame.current = 0;
        settleStill();
        return;
      }
      const c = car.current;
      if (touring.current) {
        clock.current += dt;
        want.current.pedal = tourAt(clock.current);
      }
      c.pedal += (want.current.pedal - c.pedal) * (1 - Math.exp(-dt / 0.15));
      if (Math.abs(c.pedal - want.current.pedal) < 0.002) c.pedal = want.current.pedal;
      stepCar(c, dt);
      draw(dt);
      const shown = PEDALS.reduce((best, [, value]) => (Math.abs(value - want.current.pedal) < Math.abs(best - want.current.pedal) ? value : best), PEDALS[0][1]);
      if (shown !== pedalRef.current) {
        pedalRef.current = shown;
        setPedal(shown);
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [draw, settleStill]);

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
    const observer = new IntersectionObserver((entries) => setVisible(Boolean(entries.at(-1)?.isIntersecting)), { rootMargin: "120px 0px" });
    observer.observe(node);
    return () => {
      observer.disconnect();
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
      settleStill();
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
  }, [visible, idle, engaged, run, stop, settleStill]);

  const wake = () => {
    touring.current = false;
    setIdle(false);
    setPoke((n) => n + 1);
  };

  const pedalTo = (value: number, held = false) => {
    touched.current = true;
    want.current.pedal = Math.min(1, Math.max(-1, value));
    want.current.held = held;
    if (asksForStillness()) settleStill();
    else run();
  };

  const choose = (value: number) => {
    wake();
    pedalTo(value, true);
    setPedal(value);
    pedalRef.current = value;
    const name = PEDALS.find(([, v]) => v === value)?.[0] ?? "";
    setSpoken(`${name}. ${spokenOf(car.current)}`);
  };

  // across the drawing: the left fifth brakes (harder further left), a short dead band coasts, the rest pulls
  const across = (clientX: number) => {
    const box = stage.current?.getBoundingClientRect();
    if (!box || !box.width) return 0;
    const f = Math.min(1, Math.max(0, ((clientX - box.left) / box.width - 0.12) / 0.76));
    if (f < 0.2) return -(0.2 - f) / 0.2;
    if (f < 0.28) return 0;
    return ((f - 0.28) / 0.72) ** 1.6;
  };

  const dragging = React.useRef(false);

  return (
    <div
      ref={(node) => {
        root.current = node;
        anchor.current = node;
      }}
      className="hyb"
      role="group"
      tabIndex={0}
      aria-label="Hybrid rig. Up and down arrows press and lift the pedal, Home coasts, End floors it, B brakes, keys 1 to 5 pick a pedal position."
      aria-roledescription="interactive figure"
      onFocus={() => {
        setEngaged(true);
        setSpoken(spokenOf(car.current));
      }}
      onBlur={() => setEngaged(false)}
      onKeyDown={(event) => {
        const key = event.key;
        let handled = true;
        const now = want.current.pedal;
        if (key === "ArrowUp") pedalTo(now + (event.shiftKey ? 0.3 : 0.1), true);
        else if (key === "ArrowDown") pedalTo(now - (event.shiftKey ? 0.3 : 0.1), true);
        else if (key === "Home" || key === "Escape") pedalTo(0, true);
        else if (key === "End") pedalTo(1, true);
        else if (key === "b" || key === "B") pedalTo(-0.5, true);
        else if (/^[1-5]$/.test(key)) choose(PEDALS[Number(key) - 1][1]);
        else handled = false;
        if (handled) {
          event.preventDefault();
          wake();
        }
      }}
    >
      <div
        ref={stage}
        className="hyb-stage iso-stage"
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setEngaged(true);
        }}
        onPointerMove={(event) => {
          if (event.pointerType === "mouse" || dragging.current) {
            wake();
            pedalTo(across(event.clientX));
          }
        }}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse") return;
          dragging.current = true;
          setEngaged(true);
          event.currentTarget.setPointerCapture(event.pointerId);
          wake();
          pedalTo(across(event.clientX));
        }}
        onPointerUp={(event) => {
          if (!dragging.current) return;
          dragging.current = false;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          pedalTo(0);
          setEngaged(false);
        }}
        onPointerCancel={() => {
          dragging.current = false;
          pedalTo(0);
          setEngaged(false);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "mouse") return;
          if (!want.current.held) pedalTo(0);
          setEngaged(false);
        }}
      >
        <svg className="iso-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} focusable="false">
          <defs dangerouslySetInnerHTML={{ __html: defs }} />
          <g dangerouslySetInnerHTML={{ __html: body }} />
        </svg>
      </div>
      <div className="hyb-pedals" role="group" aria-label="Pedal">
        {PEDALS.map(([name, value]) => (
          <button key={name} type="button" className="hyb-pedal" aria-pressed={pedal === value} onClick={() => choose(value)}>
            {name}
          </button>
        ))}
      </div>
      <span className="hyb-live" aria-live="polite">
        {spoken}
      </span>
    </div>
  );
}
