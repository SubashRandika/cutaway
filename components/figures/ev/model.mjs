// The truth behind the figure: a battery-electric car in the manner of BYD's
// e-Platform 3.0 (the Atto 3). A permanent-magnet motor drives the wheels through
// a fixed two-stage reduction and an open differential; a lithium iron phosphate
// Blade pack feeds it through the inverter, takes back braking energy, and is
// filled from the mains, either as AC through the on-board charger or as DC
// straight into the pack. Every number the card shows, and every moving part, is
// read from here. Conversion losses are left out.

export const SLOW = 1 / 50; // the drawing turns at a fiftieth of true speed

// The reduction: the motor's pinion turns a large intermediate gear, whose own
// small pinion turns the differential's ring gear.
export const STAGE1 = { pinion: 19, gear: 70 };
export const STAGE2 = { pinion: 21, ring: 63 };
export const REDUCTION = (STAGE1.gear / STAGE1.pinion) * (STAGE2.ring / STAGE2.pinion); // motor rpm per wheel rpm
export const INTER_TO_WHEEL = STAGE2.ring / STAGE2.pinion; // intermediate rpm per wheel rpm

export const MOTOR = { power: 150, torque: 310, max: 16000, poles: 8 };

// 126 Blade cells in series, in two rows, each 3.2 V and 150 Ah.
export const BATTERY = { cells: 126, rows: 2, cellVolts: 3.2, amphours: 150, discharge: 160, regen: 80 };
export const BATTERY_VOLTS = BATTERY.cells * BATTERY.cellVolts;
export const BATTERY_KWH = (BATTERY_VOLTS * BATTERY.amphours) / 1000;
export const SOC = { start: 0.42, floor: 0.02, top: 1, dcStop: 0.8 };

export const AC = { kw: 7, volts: 230, phases: 1 }; // through the on-board charger
export const DC = { kw: 88 }; // the pack's own peak, straight onto the pack

export const CAR = { mass: 1750, cda: 0.75, crr: 0.009, tyre: "215/55 R18", circumference: 2.18, top: 160 };
export const DRIVE_FORCE = 6500; // N at the contact patch, pedal floored, below the power limit
export const BRAKE_FORCE = 8000; // N, pedal pressed hard
export const COAST_REGEN = 400; // N of drag the motor makes with the pedal up

const G = 9.81;
const AIR = 1.2;
const TAU = Math.PI * 2;
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const toward = (value, target, step) => (Math.abs(target - value) <= step ? target : value + Math.sign(target - value) * step);
const lerp = (a, b, t) => a + (b - a) * t;

export const kmhOf = (wheelRpm) => (wheelRpm * CAR.circumference * 60) / 1000;
export const wheelRpmOf = (ms) => (ms * 60) / CAR.circumference;
export const roadLoad = (ms) => 0.5 * AIR * CAR.cda * ms * ms + (ms > 0.05 ? CAR.crr * CAR.mass * G : 0);

// The pack's limits fall away as it nears empty (discharge) or full (regen).
const dischargeLimit = (soc) => BATTERY.discharge * clamp((soc - SOC.floor) / 0.05);
const regenLimit = (soc) => BATTERY.regen * clamp((SOC.top - soc) / 0.06);

// AC is limited by the on-board charger and tapers in the last few percent; DC by
// the pack itself, which takes its peak to half full and less and less after.
export function chargeRate(kind, soc) {
  if (soc >= SOC.top) return 0;
  if (kind === "ac") return AC.kw * clamp((SOC.top - soc) / 0.04, 0.2, 1);
  if (soc < 0.5) return DC.kw;
  if (soc < 0.8) return lerp(DC.kw, 46, (soc - 0.5) / 0.3);
  if (soc < 0.95) return lerp(46, 18, (soc - 0.8) / 0.15);
  return lerp(18, 6, (soc - 0.95) / 0.05);
}

// ----- state -----

export function carAt() {
  return {
    pedal: 0, // -1 brake hard … 0 coast … 1 floored
    speed: 0, // m/s
    soc: SOC.start,
    charge: "", // the plug asked for: "" · "ac" · "dc"
    kind: "", // the kind of current on the plug now seated
    plug: 0, // 0 lying out … 1 seated in the inlet
    dcContact: 0, // 0 open … 1 closed: the DC charge contactors
    motorRpm: 0,
    motorKw: 0, // electrical, + drawn from the pack, − generated
    wheelKw: 0,
    regenKw: 0,
    frictionKw: 0,
    chargeKw: 0, // wall to pack
    batteryKw: 0, // + discharging, − charging
    angle: { motor: 0, inter: 0, wheel: 0 },
  };
}

// Advance by dt seconds of true time. `calm` jumps every lag to its target.
export function stepCar(car, dt, calm = false) {
  const v = car.speed;
  const pedal = clamp(car.pedal, -1, 1);

  // ----- the plug: only while parked; pressing the pedal draws it out first -----
  if (pedal > 0.02 || v > 0.05) car.charge = "";
  const wantSeated = car.charge !== "";
  // changing kind means drawing the plug out and putting it back
  if (wantSeated && car.plug === 0) car.kind = car.charge;
  const seatGoal = wantSeated && car.kind === car.charge ? 1 : 0;
  car.plug = calm ? seatGoal : toward(car.plug, seatGoal, dt / 0.9);
  if (calm && wantSeated) car.kind = car.charge;
  const seated = car.plug >= 1;
  const tethered = car.plug > 0;
  // the DC contactors close only once a DC plug is home, and open before it leaves
  const dcGoal = seated && car.kind === "dc" ? 1 : 0;
  car.dcContact = calm ? dcGoal : toward(car.dcContact, dcGoal, dt / 0.25);

  // ----- the drive -----
  const pull = !tethered && pedal > 0 ? pedal * Math.min(DRIVE_FORCE, (MOTOR.power * 1000) / Math.max(v, 0.5)) : 0;
  const brake = pedal < 0 ? -pedal * BRAKE_FORCE : pedal === 0 && v > 0.05 ? COAST_REGEN : 0; // pedal up: the motor's drag, the brake holds the last metres
  const wheelRpm = wheelRpmOf(v);
  car.motorRpm = wheelRpm * REDUCTION;

  let wheelKw = 0;
  let regenKw = 0;
  let frictionKw = 0;
  let tractive = 0;
  if (brake > 0) {
    // the motor takes back what the pack can hold, the friction brake the rest
    const askKw = (brake * v) / 1000;
    regenKw = Math.min(askKw, regenLimit(car.soc), MOTOR.power) * clamp((v - 1.2) / 2);
    frictionKw = askKw - regenKw;
    wheelKw = -regenKw;
    tractive = -brake;
  } else if (pull > 0) {
    const demandKw = (pull * v) / 1000;
    wheelKw = Math.min(demandKw, dischargeLimit(car.soc));
    tractive = demandKw > 0.001 ? pull * (wheelKw / demandKw) : pull * clamp(dischargeLimit(car.soc) / 5);
    if (kmhOf(wheelRpm) >= CAR.top) tractive = Math.min(tractive, roadLoad(v)); // the speed limiter
    wheelKw = Math.min(wheelKw, (tractive * v) / 1000);
  }
  car.motorKw = wheelKw;
  car.regenKw = regenKw;
  car.frictionKw = frictionKw;
  car.wheelKw = brake > 0 ? -(regenKw + frictionKw) : wheelKw;
  car.chargeKw = seated && v < 0.05 ? chargeRate(car.kind, car.soc) * (car.kind === "dc" ? car.dcContact : 1) : 0;
  car.batteryKw = car.motorKw - car.chargeKw;

  // ----- the car -----
  const accel = (tractive - roadLoad(v)) / CAR.mass;
  if (!calm) car.speed = Math.max(0, v + accel * dt);
  if (car.speed < 0.03 && pull === 0) car.speed = 0;
  car.soc = clamp(car.soc - (car.batteryKw * dt) / (BATTERY_KWH * 3600), 0, 1);

  // the drawing's own angles, in degrees, turning at SLOW of true speed
  const turn = 6 * SLOW * dt;
  const a = car.angle;
  a.motor = (a.motor + car.motorRpm * turn) % 1440000;
  a.inter = (a.inter + wheelRpm * INTER_TO_WHEEL * turn) % 1440000;
  a.wheel = (a.wheel + wheelRpm * turn) % 1440000;
  return car;
}

// The speed a held pedal settles at, for reduced motion: pull equals road load.
export function steadySpeed(pedal) {
  if (pedal <= 0) return 0;
  let low = 0;
  let high = CAR.top / 3.6;
  for (let i = 0; i < 40; i++) {
    const v = (low + high) / 2;
    const pull = pedal * Math.min(DRIVE_FORCE, (MOTOR.power * 1000) / Math.max(v, 0.5));
    if (pull > roadLoad(v)) low = v;
    else high = v;
  }
  return low;
}

const KIND = { ac: "AC", dc: "DC fast" };

export function modeOf(car) {
  if (car.plug > 0 && car.plug < 1) return car.charge ? "plugging in" : "unplugging";
  if (car.plug >= 1) return car.chargeKw > 0.05 ? `${KIND[car.kind]} charging` : car.kind === "dc" && car.dcContact < 1 ? "DC handshake" : "plugged in · full";
  if (car.regenKw > 0.4) return car.pedal < 0 ? "regen braking" : "coasting · regen";
  if (car.frictionKw > 0.2 && car.speed > 0.05) return car.pedal < 0 ? "friction braking" : "coasting";
  if (car.speed < 0.05) return car.pedal > 0 ? "pulling away" : "ready";
  if (car.motorKw > 0.2) return car.speed * 3.6 >= CAR.top - 0.5 ? "drive · limiter" : "drive";
  return "coasting";
}

const thousands = (value) => Math.round(value).toLocaleString("en-US");
const kw = (value) => `${value > 0.05 ? "+" : value < -0.05 ? "−" : ""}${Math.abs(value).toFixed(1)}`;
const percent = (soc) => `${Math.round(soc * 100)}%`;

// minutes to a target charge at the tapering rate, integrated in small steps
export function timeTo(car, kind, target) {
  let hours = 0;
  const steps = 200;
  const span = Math.max(0, target - car.soc);
  for (let i = 0; i < steps; i++) hours += ((span / steps) * BATTERY_KWH) / Math.max(chargeRate(kind, car.soc + (span * (i + 0.5)) / steps), 0.1);
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

const finish = (car) =>
  car.kind === "dc"
    ? car.soc < SOC.dcStop - 0.005
      ? `80% in ${timeTo(car, "dc", SOC.dcStop)}`
      : `full in ${timeTo(car, "dc", SOC.top)}`
    : `full in ${timeTo(car, "ac", SOC.top)}`;

export function readoutOf(car) {
  if (car.plug >= 1) return car.chargeKw > 0.05 ? `${modeOf(car)} ${car.chargeKw.toFixed(1)} kW · ${percent(car.soc)} · ${finish(car)}` : `${modeOf(car)} · ${percent(car.soc)}`;
  return `${modeOf(car)} · motor ${thousands(car.motorRpm)} rpm · ${kw(car.batteryKw)} kW · ${percent(car.soc)} · ${Math.round(car.speed * 3.6)} km/h`;
}

export function spokenOf(car) {
  if (car.plug >= 1) {
    const path = car.kind === "dc" ? "straight into the pack through its DC contactors" : "through the on-board charger";
    return `${modeOf(car)}: ${car.chargeKw.toFixed(1)} kilowatts ${path}, pack at ${percent(car.soc)}${car.chargeKw > 0.05 ? `, ${finish(car)}` : ""}.`;
  }
  const battery = car.batteryKw > 0.05 ? `the pack gives ${car.batteryKw.toFixed(1)} kilowatts` : car.batteryKw < -0.05 ? `the pack takes back ${(-car.batteryKw).toFixed(1)} kilowatts` : "the pack is idle";
  return `${modeOf(car)}: ${Math.round(car.speed * 3.6)} km/h, motor at ${thousands(car.motorRpm)} rpm, ${battery}, charge ${percent(car.soc)}.`;
}

export const TWO_PI = TAU;
