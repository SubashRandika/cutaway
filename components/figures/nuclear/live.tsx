"use client";

import * as React from "react";
import { asksForStillness, useReadout } from "../../iso/react/live";
import { frameOf } from "./frame.mjs";
import { mwe, plantAt, przLevel, readoutOf, reset, spokenOf, stepPlant, trip } from "./model.mjs";
import { HEIGHT, WIDTH } from "./view.mjs";
import { CalloutKey, Callouts, type Callout } from "../callouts";

type Plant = ReturnType<typeof plantAt>;
type Frame = Record<string, unknown>;

const TOUR_FIRST = 1.4;
const TOUR_BACK = 3600;
const MOST_DT = 1 / 30;
// [at seconds, what]: full power, the grid asks for half, then full again, a trip,
// decay heat on the steam dumps, a reset and the climb back to full power
const TOUR: Array<[number, number | "trip" | "reset"]> = [
  [0, 1],
  [7, 0.5],
  [30, 1],
  [52, "trip"],
  [64, "reset"],
  [64.5, 1],
];
const TOUR_LOOP = 128;

export const LOADS: Array<[string, number]> = [
  ["Standby", 0],
  ["30%", 0.3],
  ["60%", 0.6],
  ["Full", 1],
];

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
      else if (kind === "h") node.innerHTML = text;
    }
  }
}

// what each pipe or conductor carries, and how fast its pulses run; every route runs from its source end
function flowOf(name: string, p: Plant): [boolean, number] {
  const turbine = p.online ? p.valve : 0;
  if (name === "hot" || name === "cold" || name === "cross") return [p.heat > 0.004, 2.6 + 3 * p.heat];
  if (name === "steam" || name === "feed" || name === "suction") return [p.steam > 0.004, 1.2 + 4 * p.steam];
  if (name === "hpin" || name === "xo1" || name === "xo2") return [turbine > 0.004, 1.2 + 4 * turbine];
  if (name === "dump") return [p.dump > 0.004, 1.6 + 6 * p.dump];
  if (name === "cwin" || name === "cwout") return [true, 2];
  if (name.startsWith("bus") || name.startsWith("hv")) return [mwe(p) > 5, 2 + mwe(p) / 300];
  return [false, 0];
}

interface Props {
  label: string;
  defs: string;
  body: string;
  flows: Record<string, number>;
  labels: Callout[];
}

export function NuclearLive({ label, defs, body, flows, labels }: Props) {
  const { anchor, say } = useReadout<HTMLDivElement>();
  const root = React.useRef<HTMLDivElement | null>(null);
  const stage = React.useRef<HTMLDivElement | null>(null);
  const plant = React.useRef<Plant>(null as unknown as Plant);
  if (!plant.current) plant.current = plantAt(1);
  const phases = React.useRef<Record<string, number>>({});
  const nodes = React.useRef(new Map<string, Element[]>());
  const last = React.useRef(new Map<string, string>());
  const frame = React.useRef(0);
  const clock = React.useRef(0);
  const step = React.useRef(0);
  const touring = React.useRef(false);
  const [visible, setVisible] = React.useState(false);
  const [engaged, setEngaged] = React.useState(false);
  const [idle, setIdle] = React.useState(true);
  const [poke, setPoke] = React.useState(0);
  const [load, setLoad] = React.useState(1);
  const [tripped, setTripped] = React.useState(false);
  const [spoken, setSpoken] = React.useState("");
  const [named, setNamed] = React.useState(true);

  const draw = React.useCallback(
    (dt = 0) => {
      const p = plant.current;
      const calm = asksForStillness();
      const flow: Record<string, { count: number; phase: number; on: boolean }> = {};
      for (const name in flows) {
        const base = name.replace(/\d+$/, "");
        const [on, rate] = flowOf(base === "bus" || base === "busx" || base === "hv" ? `${base}` : name, p);
        phases.current[name] = calm ? 0.75 : (phases.current[name] ?? 0) + (on ? rate : 0) * dt;
        flow[name] = { count: flows[name], phase: phases.current[name], on };
      }
      const f = frameOf({
        ...p.angle,
        bank: p.bank,
        shutdown: p.shutdown,
        heat: p.heat,
        tavg: p.tavg,
        level: przLevel(p),
        valve: p.online ? p.valve : 0,
        dump: p.dump,
        mwe: mwe(p),
        online: p.online,
        scram: p.scram,
        flow,
      });
      apply(nodes.current, last.current, f as unknown as Frame);
      say(readoutOf(p));
    },
    [say, flows],
  );

  const drawRef = React.useRef(draw);
  drawRef.current = draw;
  const shownRef = React.useRef({ load: 1, tripped: false });
  const touched = React.useRef(false);

  const settleStill = React.useCallback(() => {
    stepPlant(plant.current, 0, true);
    drawRef.current(0);
  }, []);

  const show = React.useCallback(() => {
    const p = plant.current;
    const shown = LOADS.reduce((best, [, value]) => (Math.abs(value - p.demand) < Math.abs(best - p.demand) ? value : best), LOADS[0][1]);
    const s = shownRef.current;
    if (shown !== s.load) setLoad((s.load = shown));
    if (p.scram !== s.tripped) setTripped((s.tripped = p.scram));
  }, []);

  const run = React.useCallback(() => {
    if (frame.current) return;
    let then = 0;
    const tick = (now: number) => {
      const dt = then ? Math.min((now - then) / 1000, MOST_DT) : 1 / 60;
      then = now;
      if (asksForStillness()) {
        frame.current = 0;
        settleStill();
        return;
      }
      const p = plant.current;
      if (touring.current) {
        clock.current += dt;
        const at = clock.current % TOUR_LOOP;
        if (at < dt) step.current = 0;
        while (step.current < TOUR.length && TOUR[step.current][0] <= at) {
          const what = TOUR[step.current][1];
          if (what === "trip") trip(p, "manual");
          else if (what === "reset") reset(p);
          else p.demand = what;
          step.current += 1;
        }
      }
      stepPlant(p, dt);
      draw(dt);
      show();
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [draw, settleStill, show]);

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
        // the tour picks up from wherever the plant stands: a tripped plant is reset first
        const p = plant.current;
        clock.current = 0;
        step.current = 0;
        if (p.scram) {
          clock.current = 64;
          step.current = 4;
        }
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

  const after = () => {
    touched.current = true;
    if (asksForStillness()) settleStill();
    else run();
    show();
  };

  const loadTo = (value: number) => {
    plant.current.demand = Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
    after();
  };

  const choose = (value: number) => {
    wake();
    loadTo(value);
    const name = LOADS.find(([, v]) => v === value)?.[0] ?? "";
    const p = plant.current;
    setSpoken(
      p.scram
        ? `${name} asked for, but the reactor is tripped: press R to reset it first.`
        : value === 0
          ? "Standby: the turbine runs down to its minimum load and comes off the grid; the rods go in and the core holds at a few percent on the steam dumps."
          : `${name} load: the governor valve moves at five percent a minute of true time, the rods follow the average temperature. ${spokenOf(p)}`,
    );
  };

  const scram = () => {
    wake();
    trip(plant.current, "manual");
    after();
    setSpoken("Trip: the rods fall into the core in two seconds and fission stops. The turbine trips, the breaker opens, and the steam dumps carry the decay heat to the condenser.");
  };

  const relatch = () => {
    wake();
    const p = plant.current;
    if (!p.scram) {
      setSpoken("The reactor is not tripped.");
      return;
    }
    if (!reset(p)) {
      setSpoken("Wait for the rods to finish falling, then reset.");
      return;
    }
    if (p.demand < 0.05) p.demand = 1;
    after();
    setSpoken("Reset: the shutdown banks come out, then bank D brings the core critical and up to a few percent; the turbine rolls up, syncs and loads to the demand.");
  };

  // across the drawing sets the load the grid asks for, from standby at the left to full at the right
  const across = (clientX: number) => {
    const box = stage.current?.getBoundingClientRect();
    if (!box || !box.width) return 0;
    const f = Math.min(1, Math.max(0, ((clientX - box.left) / box.width - 0.14) / 0.72));
    return f < 0.06 ? 0 : Math.round(f * 20) / 20;
  };

  const dragging = React.useRef(false);

  return (
    <div
      ref={(node) => {
        root.current = node;
        anchor.current = node;
      }}
      className="npp"
      role="group"
      tabIndex={0}
      aria-label="Nuclear power plant. Up and down arrows raise and lower the load by ten percent, Home asks for standby, End for full load, keys 1 to 4 pick a load, S trips the reactor, R resets it."
      aria-roledescription="interactive figure"
      onFocus={() => {
        setEngaged(true);
        setSpoken(spokenOf(plant.current));
      }}
      onBlur={() => setEngaged(false)}
      onKeyDown={(event) => {
        const key = event.key;
        let handled = true;
        const now = plant.current.demand;
        if (key === "ArrowUp") loadTo(now + (event.shiftKey ? 0.3 : 0.1));
        else if (key === "ArrowDown") loadTo(now - (event.shiftKey ? 0.3 : 0.1));
        else if (key === "Home") loadTo(0);
        else if (key === "End") loadTo(1);
        else if (key === "s" || key === "S") scram();
        else if (key === "r" || key === "R") relatch();
        else if (/^[1-4]$/.test(key)) choose(LOADS[Number(key) - 1][1]);
        else handled = false;
        if (handled) {
          event.preventDefault();
          wake();
        }
      }}
    >
      <div
        ref={stage}
        className="npp-stage iso-stage"
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setEngaged(true);
        }}
        onPointerMove={(event) => {
          if (event.pointerType === "mouse" || dragging.current) {
            wake();
            loadTo(across(event.clientX));
          }
        }}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse") return;
          dragging.current = true;
          setEngaged(true);
          event.currentTarget.setPointerCapture(event.pointerId);
          wake();
          loadTo(across(event.clientX));
        }}
        onPointerUp={(event) => {
          if (!dragging.current) return;
          dragging.current = false;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          setEngaged(false);
        }}
        onPointerCancel={() => {
          dragging.current = false;
          setEngaged(false);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setEngaged(false);
        }}
      >
        <svg className="iso-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} focusable="false">
          <defs dangerouslySetInnerHTML={{ __html: defs }} />
          <g dangerouslySetInnerHTML={{ __html: body }} />
        </svg>
        <Callouts items={labels} width={WIDTH} height={HEIGHT} show={named} />
      </div>
      <div className="npp-pedals" role="group" aria-label="Controls">
        {LOADS.map(([name, value]) => (
          <button key={name} type="button" className="npp-pedal" aria-pressed={!tripped && load === value} onClick={() => choose(value)}>
            {name}
          </button>
        ))}
        <span className="npp-gap" aria-hidden="true" />
        <button type="button" className="npp-pedal npp-trip" aria-pressed={tripped} onClick={scram}>
          Trip
        </button>
        <button type="button" className="npp-pedal" onClick={relatch} disabled={!tripped}>
          Reset
        </button>
        <button type="button" className="npp-pedal callout-toggle" aria-pressed={named} onClick={() => setNamed((on) => !on)}>
          Labels
        </button>
      </div>
      <CalloutKey items={labels} show={named} />
      <span className="npp-live" aria-live="polite">
        {spoken}
      </span>
    </div>
  );
}
