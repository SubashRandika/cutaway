"use client";

import * as React from "react";
import { asksForStillness, useReadout } from "../../iso/react/live";
import { frameOf } from "./frame.mjs";
import { carAt, readoutOf, spokenOf, steadySpeed, stepCar } from "./model.mjs";
import { HEIGHT, WIDTH } from "./view.mjs";
import { CalloutKey, Callouts, type Callout } from "../callouts";

type Car = ReturnType<typeof carAt>;
type Frame = Record<string, unknown>;
type Charge = "" | "ac" | "dc";

const TOUR_FIRST = 1.4;
const TOUR_BACK = 3600;
const MOST_DT = 1 / 30;
// [at seconds, pedal, plug]: fast charging, unplug, pull away, floor it, cruise,
// brake hard (the motor takes back what it can), roll to a stop, plug in at home on AC
const TOUR: Array<[number, number, Charge]> = [
  [0, 0, "dc"],
  [5, 0, ""],
  [6.5, 0.45, ""],
  [13, 1, ""],
  [17, 0.12, ""],
  [22, -0.6, ""],
  [31, 0, ""],
  [32, 0, "ac"],
];
const TOUR_LOOP = 40;
const STILL_SPEED = 80 / 3.6;

export const PEDALS: Array<[string, number]> = [
  ["Brake", -0.5],
  ["Coast", 0],
  ["Ease", 0.12],
  ["Pull", 0.45],
  ["Floor", 1],
];

function tourAt(t: number) {
  const at = t % TOUR_LOOP;
  let step = TOUR[0];
  for (const entry of TOUR) if (entry[0] <= at) step = entry;
  return step;
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
      else if (kind === "h") node.innerHTML = text;
    }
  }
}

// which power each cable carries; every route runs from the source end
const acKw = (car: Car) => (car.kind === "ac" ? car.chargeKw : 0);
function powerOf(name: string, car: Car) {
  if (name.startsWith("evse")) return car.chargeKw;
  if (name.startsWith("dcp")) return car.kind === "dc" ? car.chargeKw : 0;
  if (name.startsWith("acp") || name.startsWith("obc")) return acKw(car);
  if (name.startsWith("bus")) return car.motorKw - acKw(car);
  return car.motorKw;
}

interface Props {
  label: string;
  defs: string;
  body: string;
  flows: Record<string, number>;
  labels: Callout[];
}

export function EvLive({ label, defs, body, flows, labels }: Props) {
  const { anchor, say } = useReadout<HTMLDivElement>();
  const root = React.useRef<HTMLDivElement | null>(null);
  const stage = React.useRef<HTMLDivElement | null>(null);
  const car = React.useRef<Car>(null as unknown as Car);
  if (!car.current) {
    car.current = carAt();
    car.current.charge = "dc";
    car.current.kind = "dc";
    car.current.plug = 1;
    car.current.dcContact = 1;
  }
  // what the reader (or the tour) asks for; the plug waits for the car to stop
  const want = React.useRef<{ pedal: number; held: boolean; charge: Charge }>({ pedal: 0, held: false, charge: "dc" });
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
  const [charge, setCharge] = React.useState<Charge>("dc");
  const [spoken, setSpoken] = React.useState("");
  const [named, setNamed] = React.useState(true);

  const draw = React.useCallback(
    (dt = 0) => {
      const c = car.current;
      const calm = asksForStillness();
      const flow: Record<string, { count: number; phase: number; power: number }> = {};
      for (const name in flows) {
        const power = powerOf(name, c);
        // pulses run at a pace that grows with the power, in the direction it flows
        const rate = Math.abs(power) > 0.6 ? Math.sign(power) * (2.4 + Math.abs(power) / 10) : 0;
        phases.current[name] = calm ? 0.75 : (phases.current[name] ?? 0) + rate * dt;
        flow[name] = { count: flows[name], phase: phases.current[name], power };
      }
      const f = frameOf({
        ...c.angle,
        calm,
        soc: c.soc,
        batteryKw: c.batteryKw,
        motorKw: c.motorKw,
        chargeKw: c.chargeKw,
        kind: c.kind,
        plug: c.plug,
        dcContact: c.dcContact,
        flow,
      });
      apply(nodes.current, last.current, f as unknown as Frame);
      say(readoutOf(c));
    },
    [say, flows],
  );

  const drawRef = React.useRef(draw);
  drawRef.current = draw;
  const shownRef = React.useRef<{ pedal: number; charge: Charge }>({ pedal: 0, charge: "dc" });
  const touched = React.useRef(false);

  // the car follows the wishes: the plug goes in once the car has stopped
  const steer = (c: Car, calm: boolean) => {
    const w = want.current;
    if (w.charge && c.speed > 0.05 && !calm) w.pedal = Math.min(w.pedal, -0.5);
    c.charge = w.charge && (calm || c.speed < 0.05) && w.pedal <= 0 ? w.charge : "";
  };

  const settleStill = React.useCallback(() => {
    // reduced motion: one still frame of the chosen controls, at 80 km/h when driving
    const c = car.current;
    const w = want.current;
    c.pedal = w.charge ? 0 : w.pedal;
    c.speed = w.charge ? 0 : touched.current ? (w.pedal > 0 ? STILL_SPEED : 0) : steadySpeed(c.pedal);
    steer(c, true);
    stepCar(c, 0, true);
    stepCar(c, 0, true);
    drawRef.current(0);
  }, []);

  const show = React.useCallback(() => {
    const w = want.current;
    const pedalShown = PEDALS.reduce((best, [, value]) => (Math.abs(value - w.pedal) < Math.abs(best - w.pedal) ? value : best), PEDALS[0][1]);
    const s = shownRef.current;
    if (pedalShown !== s.pedal) setPedal((s.pedal = pedalShown));
    if (w.charge !== s.charge) setCharge((s.charge = w.charge));
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
      const c = car.current;
      const w = want.current;
      if (touring.current) {
        clock.current += dt;
        const [, p, plug] = tourAt(clock.current);
        w.pedal = p;
        w.charge = plug;
      }
      steer(c, false);
      c.pedal += (w.pedal - c.pedal) * (1 - Math.exp(-dt / 0.15));
      if (Math.abs(c.pedal - w.pedal) < 0.002) c.pedal = w.pedal;
      // once the car has stopped for the plug, the brake comes off
      if (w.charge && c.speed < 0.05 && w.pedal < 0) w.pedal = 0;
      stepCar(c, dt);
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

  const after = () => {
    touched.current = true;
    if (asksForStillness()) settleStill();
    else run();
    show();
  };

  const pedalTo = (value: number, held = false) => {
    const w = want.current;
    w.pedal = Math.min(1, Math.max(-1, value));
    w.held = held;
    // pressing on drives off: the plug comes out first
    if (w.pedal > 0) w.charge = "";
    after();
  };

  const choose = (value: number) => {
    wake();
    pedalTo(value, true);
    const name = PEDALS.find(([, v]) => v === value)?.[0] ?? "";
    setSpoken(`${name}. ${spokenOf(car.current)}`);
  };

  const plugIn = (kind: "ac" | "dc") => {
    wake();
    const w = want.current;
    w.charge = w.charge === kind ? "" : kind;
    if (w.charge) w.pedal = car.current.speed > 0.05 ? -0.5 : 0;
    after();
    if (w.charge === "ac") setSpoken("AC: the car stops, the plug goes in, and the on-board charger turns the mains into direct current for the pack.");
    else if (w.charge === "dc") setSpoken("DC fast: the car stops, the plug goes in, and once the pack's DC contactors close the charger's current goes straight to the cells.");
    else setSpoken("Unplugged.");
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
      className="elv"
      role="group"
      tabIndex={0}
      aria-label="Electric car rig. Up and down arrows press and lift the pedal, Home coasts, End floors it, B brakes, keys 1 to 5 pick a pedal position, A plugs in on AC, D on DC fast charging."
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
        else if (key === "a" || key === "A") plugIn("ac");
        else if (key === "d" || key === "D") plugIn("dc");
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
        className="elv-stage iso-stage"
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
        <Callouts items={labels} width={WIDTH} height={HEIGHT} show={named} />
      </div>
      <div className="elv-pedals" role="group" aria-label="Controls">
        {PEDALS.map(([name, value]) => (
          <button key={name} type="button" className="elv-pedal" aria-pressed={!charge && pedal === value} onClick={() => choose(value)}>
            {name}
          </button>
        ))}
        <span className="elv-gap" aria-hidden="true" />
        <button type="button" className="elv-pedal" aria-pressed={charge === "ac"} onClick={() => plugIn("ac")}>
          AC 7 kW
        </button>
        <button type="button" className="elv-pedal" aria-pressed={charge === "dc"} onClick={() => plugIn("dc")}>
          DC fast
        </button>
        <button type="button" className="elv-pedal callout-toggle" aria-pressed={named} onClick={() => setNamed((on) => !on)}>
          Labels
        </button>
      </div>
      <CalloutKey items={labels} show={named} />
      <span className="elv-live" aria-live="polite">
        {spoken}
      </span>
    </div>
  );
}
