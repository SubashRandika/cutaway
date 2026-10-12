// The truth behind the figure: one 499 cc four-stroke single driving a
// five-speed constant-mesh transaxle and a 205/55 R16 wheel on a rolling road.
// Every number the card shows, and every moving part, is read from here.

export const ENGINE = { bore: 86, stroke: 86, rod: 143, compression: 10.5 };
export const DISPLACEMENT = (Math.PI / 4) * (ENGINE.bore / 10) ** 2 * (ENGINE.stroke / 10); // cc
export const IDLE = 900;
export const REDLINE = 6200;
export const SLOW = 1 / 40; // the drawing runs at a fortieth of true speed

// Tooth counts, module 1, so every pair shares one 20-unit centre distance.
export const PAIRS = [
  { input: 9, output: 31 },
  { input: 14, output: 26 },
  { input: 18, output: 22 },
  { input: 20, output: 20 },
  { input: 22, output: 18 },
];
export const RATIOS = [0, ...PAIRS.map(({ input, output }) => output / input)];
export const FINAL = { pinion: 7, ring: 29 };
export const FINAL_RATIO = FINAL.ring / FINAL.pinion;
export const TYRE = { size: "205/55 R16", circumference: 1.985 };

// Crank degrees through one 720° cycle, 0 = top dead centre at the start of intake.
export const VALVES = {
  intake: { open: -12, close: 224 },
  exhaust: { open: 496, close: 732 },
};
export const LIFT_MM = 9.5;

const TAU = Math.PI * 2;
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const wrap = (deg) => ((deg % 720) + 720) % 720;

export function liftOf(crank, { open, close }) {
  let at = wrap(crank);
  if (open < 0 && at > 720 + open) at -= 720;
  if (close > 720 && at < close - 720) at += 720;
  if (at <= open || at >= close) return 0;
  const share = (at - open) / (close - open);
  return Math.sin(Math.PI * share) ** 2;
}

// Ignition advance in crank degrees before top dead centre.
export const advanceOf = (rpm) => 10 + 22 * clamp((rpm - IDLE) / 3100);

export const STROKES = ["intake", "compression", "power", "exhaust"];
export const strokeOf = (crank) => STROKES[Math.floor(wrap(crank) / 180)];

// Wrist pin height above the crank axis, as a share of the stroke-based throw.
export function pinRise(crank, throwR, rodL) {
  const t = (crank * Math.PI) / 180;
  const s = Math.sin(t);
  return throwR * Math.cos(t) + Math.sqrt(rodL * rodL - throwR * throwR * s * s);
}

// How far through the burn the charge is, 0 before the spark, 1 when burnt.
export function burnOf(crank, rpm) {
  const at = wrap(crank);
  const spark = 360 - advanceOf(rpm);
  if (at < spark - 1 || at > 560) return -1;
  return clamp((at - spark) / 55);
}

export const kmhOf = (wheelRpm) => (wheelRpm * TYRE.circumference * 60) / 1000;

// ----- the drivetrain state machine -----

export const SHIFT = { declutch: 0.28, select: 0.34, engage: 0.5 };

export function driveAt() {
  return {
    throttle: 0,
    rpm: IDLE,
    input: IDLE, // gearbox input shaft rpm
    wheel: 0, // wheel rpm
    gear: 0, // engaged gear, 0 = neutral
    want: 0, // requested gear
    clutch: 1, // 1 engaged, 0 pedal down
    selector: 0, // 0..1 travel of the collar toward `want` (from `from`)
    from: 0,
    phase: "run",
    timer: 0,
    angle: { crank: 0, input: 0, output: 0, wheel: 0 },
  };
}

const follow = (value, target, dt, seconds) => value + (target - value) * (1 - Math.exp(-dt / seconds));

export function requestGear(drive, gear) {
  const next = Math.max(0, Math.min(5, gear));
  if (next === drive.want && drive.phase === "run") return;
  drive.want = next;
  if (drive.phase === "run" || drive.phase === "engage") {
    drive.phase = "declutch";
    drive.timer = 0;
  }
}

// Advance the drivetrain by dt seconds of the slowed clock's true time.
export function stepDrive(drive, dt, calm = false) {
  const target = IDLE + drive.throttle * (REDLINE - IDLE);
  drive.timer += dt;
  if (drive.phase === "declutch") {
    drive.clutch = calm ? 0 : Math.max(0, drive.clutch - dt / SHIFT.declutch);
    if (drive.clutch === 0) {
      drive.phase = "select";
      drive.timer = 0;
      drive.from = drive.gear;
      drive.gear = 0;
      drive.selector = 0;
    }
  } else if (drive.phase === "select") {
    drive.selector = calm ? 1 : Math.min(1, drive.selector + dt / SHIFT.select);
    if (drive.selector === 1) {
      drive.gear = drive.want;
      drive.from = drive.want;
      drive.phase = "engage";
      drive.timer = 0;
    }
  } else if (drive.phase === "engage") {
    drive.clutch = calm ? 1 : Math.min(1, drive.clutch + dt / SHIFT.engage);
    if (drive.clutch === 1) drive.phase = drive.want === drive.gear ? "run" : "declutch";
  }

  const ratio = RATIOS[drive.gear] * FINAL_RATIO;
  const locked = drive.gear > 0 && drive.clutch === 1;
  if (calm) {
    if (locked) {
      drive.wheel = target / ratio;
      drive.rpm = target;
    } else drive.rpm = target;
  } else if (locked) {
    drive.rpm = follow(drive.rpm, target, dt, 0.75);
    drive.wheel = drive.rpm / ratio;
  } else {
    drive.rpm = follow(drive.rpm, target, dt, 0.32);
    if (drive.gear > 0 && drive.clutch > 0) {
      // the plate slips: engine and wheel pull toward each other in proportion to clamp
      const grip = drive.clutch * drive.clutch;
      // a downshift at speed drags the wheel down rather than spinning the engine past redline
      const match = Math.min(drive.wheel * ratio, REDLINE);
      drive.rpm = follow(drive.rpm, match, dt, 0.06 / grip);
      drive.wheel = follow(drive.wheel, drive.rpm / ratio, dt, 0.18 / grip);
    } else drive.wheel = follow(drive.wheel, 0, dt, 6);
  }
  drive.rpm = Math.min(Math.max(drive.rpm, IDLE * 0.92), REDLINE);
  if (locked) drive.wheel = drive.rpm / ratio;

  if (drive.gear > 0) drive.input = drive.wheel * ratio;
  else if (drive.clutch > 0.5) drive.input = drive.rpm;
  else drive.input = follow(drive.input, 0, dt, 2.5);
  if (drive.gear > 0 && drive.clutch === 1) drive.input = drive.rpm;

  // the drawing's own angles, in degrees, turning at SLOW of true speed
  const turn = 6 * SLOW * dt;
  const a = drive.angle;
  a.crank = (a.crank + drive.rpm * turn) % 1440000;
  a.input = (a.input + drive.input * turn) % 1440000;
  a.output = (a.output - drive.wheel * FINAL_RATIO * turn) % 1440000;
  a.wheel = (a.wheel + drive.wheel * turn) % 1440000;
  return drive;
}

export const settledDrive = (drive) => drive.phase === "run" && drive.throttle === 0 && Math.abs(drive.rpm - IDLE) < 1;

const ORD = ["neutral", "1st", "2nd", "3rd", "4th", "5th"];
export const gearName = (gear) => ORD[gear];
const thousands = (value) => Math.round(value).toLocaleString("en-US");

export function readoutOf(drive) {
  const stroke = strokeOf(drive.angle.crank);
  if (drive.phase === "declutch" || drive.phase === "select") return `clutch in · ${drive.want ? `selecting ${ORD[drive.want]}` : "to neutral"} · ${thousands(drive.rpm)} rpm`;
  const gear = drive.gear ? `${ORD[drive.gear]} ${RATIOS[drive.gear].toFixed(2)}` : "neutral";
  return `${stroke} · ${thousands(drive.rpm)} rpm · ${gear} · ${Math.round(kmhOf(drive.wheel))} km/h`;
}

export function spokenOf(drive) {
  const gear = drive.gear ? `${ORD[drive.gear]} gear, ${RATIOS[drive.gear].toFixed(2)} to 1, then ${FINAL_RATIO.toFixed(2)} to 1 at the final drive` : "neutral, so the wheel coasts";
  return `Engine at ${thousands(drive.rpm)} rpm in ${gear}. The wheel turns at ${Math.round(drive.wheel)} rpm, ${Math.round(kmhOf(drive.wheel))} km/h.`;
}

export const TWO_PI = TAU;
