// The truth behind the figure: a plug-in series-parallel hybrid in the manner of
// BYD's DM-i and Honda's e:HEV. A 1.5 litre Atkinson four turns a generator on
// its own shaft; a traction motor drives the wheels through a counter gear. A
// lock-up clutch can join the engine straight to the same counter gear through
// one fixed overdrive pair, and a lithium iron phosphate pack, charged from the
// mains through an on-board charger, lets the car run on electricity alone. Every
// number the card shows, and every moving part, is read from here. Conversion
// losses are left out, so engine power plus battery power equals wheel power.

export const ENGINE = { bore: 73, stroke: 89.4, cylinders: 4, compression: 15.5, power: 81, torque: 135 };
export const DISPLACEMENT = (Math.PI / 4) * (ENGINE.bore / 10) ** 2 * (ENGINE.stroke / 10) * ENGINE.cylinders; // cc
export const ENGINE_MAX = 5500; // rpm at full power on the series line
export const ENGINE_MIN = 1200; // the slowest it runs while firing
export const SLOW = 1 / 50; // the drawing turns at a fiftieth of true speed

// Gears. The clutch's output gear and the motor's pinion both mesh the counter
// shaft's one driven gear; the counter's pinion turns the differential.
export const DIRECT = { drive: 43, driven: 42 };
export const MOTOR_PINION = 17;
export const FINAL = { pinion: 23, ring: 64 };
export const COUNTER_TO_WHEEL = FINAL.ring / FINAL.pinion; // counter rpm per wheel rpm
export const ENGINE_TO_WHEEL = COUNTER_TO_WHEEL * (DIRECT.driven / DIRECT.drive); // engine rpm per wheel rpm, clutch locked
export const MOTOR_TO_WHEEL = COUNTER_TO_WHEEL * (DIRECT.driven / MOTOR_PINION); // motor rpm per wheel rpm

export const MOTOR_POWER = 132; // kW
export const MOTOR_TORQUE = 316; // N·m
export const GEN_POWER = 75; // kW

export const BATTERY = { volts: 345.6, amphours: 52, cells: 108, modules: 36, discharge: 120, charge: 60 };
export const BATTERY_KWH = (BATTERY.volts * BATTERY.amphours) / 1000;
export const SOC = { start: 0.82, sustain: 0.2, floor: 0.1, top: 1 };
export const CHARGER = { kw: 6.6, volts: 230 }; // single-phase AC through the on-board charger
export const SYSTEM_POWER = 145; // kW the car may put down

export const CAR = { mass: 1700, cda: 0.62, crr: 0.009, tyre: "215/55 R17", circumference: 2.1 };
export const DRIVE_FORCE = 5200; // N at the contact patch, pedal floored, below the power limit
export const BRAKE_FORCE = 8000; // N, pedal pressed hard
// Auto mode spends the battery first: the engine joins only for hard pulls, high
// speed or a near-empty pack. Save mode holds the charge it had when pressed.
export const EV_ON = 60; // kW of wheel demand that starts the engine in Auto
export const EV_OFF = 40;
export const EV_TOP = 125; // km/h
export const SAVE_ON = 14; // kW in Save
export const SAVE_OFF = 7;
// The clutch may lock once the engine's speed through the fixed gear is useful.
export const LOCK_KMH = 65;
export const UNLOCK_KMH = 58;

const G = 9.81;
const AIR = 1.2;
const TAU = Math.PI * 2;
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const follow = (value, target, dt, seconds) => (dt <= 0 ? target : value + (target - value) * (1 - Math.exp(-dt / seconds)));
const toward = (value, target, step) => (Math.abs(target - value) <= step ? target : value + Math.sign(target - value) * step);
const rad = (rpm) => (rpm * TAU) / 60;

export const kmhOf = (wheelRpm) => (wheelRpm * CAR.circumference * 60) / 1000;
export const wheelRpmOf = (ms) => (ms * 60) / CAR.circumference;
export const roadLoad = (ms) => 0.5 * AIR * CAR.cda * ms * ms + (ms > 0.05 ? CAR.crr * CAR.mass * G : 0);

// The engine's best-efficiency line in series mode: the speed it runs at for each power.
export const engineRpmFor = (kw) => ENGINE_MIN + (ENGINE_MAX - ENGINE_MIN) * clamp(kw / ENGINE.power);
// What the engine can make at a speed it doesn't choose (clutch locked).
export const engineMostAt = (rpm) => Math.min(ENGINE.power, (ENGINE.torque * rad(rpm)) / 1000);

// Crank degrees: cylinder n fires at 180° steps in the order 1-3-4-2.
export const FIRING = [0, 540, 180, 360];

// ----- state -----

export function carAt() {
  return {
    pedal: 0, // -1 brake hard … 0 coast … 1 floored
    speed: 0, // m/s
    soc: SOC.start,
    save: false, // hold the charge
    hold: SOC.start,
    plugged: false, // asked for
    plug: 0, // 0 lying out … 1 seated in the inlet
    engine: "off", // off · start · on · stop
    lock: false, // the clutch is asked to close
    clutch: 0, // 0 open … 1 locked
    engineRpm: 0,
    engineKw: 0, // shaft power
    want: 0,
    wheelKw: 0, // power at the contact patch (negative while braking)
    regenKw: 0,
    frictionKw: 0,
    motorRpm: 0,
    genKw: 0, // electrical, + drawn from the bus, − generated
    motorKw: 0,
    busKw: 0, // pack to inverter, + discharging
    chargeKw: 0, // wall to pack
    batteryKw: 0, // + discharging, − charging
    timer: 0,
    angle: { crank: 0, drive: 0, counter: 0, motor: 0, wheel: 0 },
  };
}

const dischargeLimit = (soc) => BATTERY.discharge * clamp((soc - SOC.floor) / 0.04);
const chargeLimit = (soc) => BATTERY.charge * clamp((SOC.top - soc) / 0.03);
// AC charging tapers over the last few percent
export const chargeRate = (soc) => (soc >= SOC.top ? 0 : CHARGER.kw * clamp((SOC.top - soc) / 0.05, 0.15, 1));

// Advance by dt seconds of true time. `calm` jumps every lag to its target.
export function stepCar(car, dt, calm = false) {
  const v = car.speed;
  const pedal = clamp(car.pedal, -1, 1);

  // ----- the plug: only while parked; pressing the pedal draws it out first -----
  if (pedal > 0.02 || v > 0.05) car.plugged = false;
  car.plug = calm ? (car.plugged ? 1 : 0) : toward(car.plug, car.plugged ? 1 : 0, dt / 0.9);
  const seated = car.plug >= 1;
  const tethered = car.plug > 0;

  const pull = !tethered && pedal > 0 ? pedal * Math.min(DRIVE_FORCE, (SYSTEM_POWER * 1000) / Math.max(v, 0.5)) : 0;
  const brake = pedal < 0 ? -pedal * BRAKE_FORCE : pedal === 0 && v > 1 ? 180 : 0; // pedal up: a light regenerative drag
  const demandKw = (pull * v) / 1000;
  const wheelRpm = wheelRpmOf(v);
  const lockRpm = wheelRpm * ENGINE_TO_WHEEL;
  const kmh = v * 3.6;

  // ----- engine on or off -----
  const low = car.save ? car.hold - 0.02 : SOC.sustain;
  const needs = car.save
    ? pull > 0 && (demandKw > SAVE_ON || kmh > LOCK_KMH)
    : pull > 0 && (demandKw > EV_ON || kmh > EV_TOP);
  const may = car.save
    ? pull > 0 && (demandKw > SAVE_OFF || kmh > UNLOCK_KMH)
    : pull > 0 && (demandKw > EV_OFF || kmh > EV_TOP - 8);
  const running = car.engine === "on" || car.engine === "start";
  const wantOn = !tethered && (needs || car.soc < low || (running && (may || car.soc < low + 0.02)));
  if (wantOn && !running) {
    car.engine = "start";
    car.timer = 0;
  } else if (!wantOn && running) {
    car.engine = "stop";
    car.timer = 0;
  }
  car.timer += dt;

  // ----- the lock-up clutch -----
  const lockable = car.engine === "on" && pull > 0 && lockRpm >= ENGINE_MIN && pedal < 0.85;
  const fits = demandKw <= engineMostAt(lockRpm) * 0.95;
  car.lock = lockable && (car.lock ? kmh >= UNLOCK_KMH : kmh >= LOCK_KMH && fits && pedal < 0.75);
  const synced = Math.abs(car.engineRpm - lockRpm) < 80;
  const clutchGoal = car.lock && (synced || car.clutch > 0) ? 1 : 0;
  car.clutch = calm ? clutchGoal : toward(car.clutch, clutchGoal, dt / 0.35);
  const locked = car.clutch > 0.5;

  // ----- engine power -----
  const target = car.save ? car.hold : SOC.sustain + 0.03;
  const topUp = clamp((target - car.soc) * 400, 0, 15);
  if (car.engine === "start") {
    // the generator spins the stopped engine up to firing speed
    car.engineRpm = calm ? ENGINE_MIN : Math.min(ENGINE_MIN, car.engineRpm + (dt * ENGINE_MIN) / 0.35);
    car.engineKw = 0;
    car.want = 0;
    if (car.engineRpm >= ENGINE_MIN) {
      car.engine = "on";
      car.timer = 0;
    }
  } else if (car.engine === "on") {
    if (car.lock) {
      // run up (or down) to the speed the fixed gear will hold, then make what the road needs
      // and, with room in the pack, load-point shifting: run nearer full torque, where
      // the engine is most efficient, and bank the surplus through the generator
      const most = engineMostAt(lockRpm);
      const shifted = car.soc < 0.95 ? Math.min(most * 0.8, Math.max(demandKw, 0) + 12) : 0;
      car.want = clamp(Math.max(Math.max(demandKw, 0) + topUp, shifted), 4, most);
      car.engineRpm = calm || locked ? lockRpm : follow(car.engineRpm, lockRpm, dt, 0.18);
    } else {
      // series: the engine sits on its efficient line, sized to the demand
      const most = Math.min(GEN_POWER, ENGINE.power);
      car.want = clamp(Math.max(demandKw, 0) + topUp, 6, most);
      car.engineRpm = calm ? engineRpmFor(car.want) : follow(car.engineRpm, engineRpmFor(car.engineKw), dt, 0.3);
    }
    car.engineKw = calm ? car.want : follow(car.engineKw, car.want, dt, 0.45);
  } else {
    // fuel cut: the generator brings the shaft to rest
    car.engineRpm = calm ? 0 : Math.max(0, car.engineRpm - (dt * ENGINE_MIN) / 0.4);
    car.engineKw = 0;
    car.want = 0;
    if (car.engine === "stop" && car.engineRpm === 0) car.engine = "off";
  }
  if (!locked && car.engine !== "on" && car.engine !== "start") car.lock = false;

  // ----- where the power goes -----
  let shaftKw = car.engineKw;
  const crankKw = car.engine === "start" ? 4 : 0; // the generator motoring the engine up
  let wheelKw;
  let regenKw = 0;
  let frictionKw = 0;
  if (brake > 0) {
    // the motor takes back what the pack can hold, the friction brake the rest
    const askKw = (brake * v) / 1000;
    const room = Math.max(0, Math.min(MOTOR_POWER, chargeLimit(car.soc) + shaftKw));
    regenKw = Math.min(askKw, room) * clamp((v - 1.2) / 2);
    frictionKw = askKw - regenKw;
    wheelKw = -regenKw;
  } else {
    wheelKw = demandKw;
    const most = dischargeLimit(car.soc);
    if (wheelKw - shaftKw > most) wheelKw = shaftKw + most;
    const motorMost = locked ? shaftKw + MOTOR_POWER : MOTOR_POWER;
    if (wheelKw > motorMost) wheelKw = motorMost;
  }
  if (car.engine === "on" && wheelKw - shaftKw < -chargeLimit(car.soc)) {
    // the pack can't take more: the engine eases off at once
    const scale = Math.max(0, wheelKw + chargeLimit(car.soc)) / Math.max(shaftKw, 0.001);
    car.engineKw *= scale;
    shaftKw *= scale;
  }
  if (locked) {
    // through the clutch: the generator soaks up any surplus, the motor adds any shortfall
    car.genKw = -Math.max(0, shaftKw - Math.max(wheelKw, 0)) + crankKw;
    car.motorKw = wheelKw - shaftKw - car.genKw + crankKw;
  } else {
    // series: every engine kilowatt becomes current; the motor alone turns the wheels
    car.genKw = -shaftKw + crankKw;
    car.motorKw = wheelKw;
  }
  car.busKw = car.motorKw + car.genKw;
  car.chargeKw = seated && v < 0.05 ? chargeRate(car.soc) : 0;
  car.batteryKw = car.busKw - car.chargeKw;
  car.wheelKw = brake > 0 ? -(regenKw + frictionKw) : wheelKw;
  car.regenKw = regenKw;
  car.frictionKw = frictionKw;
  car.motorRpm = wheelRpm * MOTOR_TO_WHEEL;

  // ----- the car -----
  const tractive = brake > 0 ? -brake : demandKw > 0.001 ? pull * Math.min(1, wheelKw / demandKw) : pull;
  const accel = (tractive - roadLoad(v)) / CAR.mass;
  if (!calm) car.speed = Math.max(0, v + accel * dt);
  if (car.speed < 0.03 && pull === 0) car.speed = 0;
  car.soc = clamp(car.soc - (car.batteryKw * dt) / (BATTERY_KWH * 3600), 0.05, 1);

  // the drawing's own angles, in degrees, turning at SLOW of true speed
  const turn = 6 * SLOW * dt;
  const a = car.angle;
  const counterRpm = wheelRpm * COUNTER_TO_WHEEL;
  a.crank = (a.crank + car.engineRpm * turn) % 1440000;
  a.counter = (a.counter + counterRpm * turn) % 1440000;
  a.drive = (a.drive + counterRpm * (DIRECT.driven / DIRECT.drive) * turn) % 1440000;
  a.motor = (a.motor + car.motorRpm * turn) % 1440000;
  a.wheel = (a.wheel + wheelRpm * turn) % 1440000;
  return car;
}

export const settledCar = (car) => car.speed === 0 && car.engine === "off" && car.pedal === 0;

// The speed a held pedal settles at, for reduced motion: pull equals road load.
export function steadySpeed(pedal) {
  if (pedal <= 0) return 0;
  let low = 0;
  let high = 70;
  for (let i = 0; i < 40; i++) {
    const v = (low + high) / 2;
    const pull = pedal * Math.min(DRIVE_FORCE, (SYSTEM_POWER * 1000) / Math.max(v, 0.5));
    if (pull > roadLoad(v)) low = v;
    else high = v;
  }
  return Math.min(low, 180 / 3.6);
}

export function modeOf(car) {
  if (car.plug > 0 && car.plug < 1) return car.plugged ? "plugging in" : "unplugging";
  if (car.plug >= 1) return car.chargeKw > 0.05 ? "charging" : "plugged in · full";
  if (car.engine === "start") return "engine starting";
  if (car.regenKw > 0.4) return "regen braking";
  if (car.frictionKw > 0.2 && car.speed > 0.05) return "friction braking";
  if (car.engine === "stop") return "engine stopping";
  if (car.engine === "on") {
    if (car.clutch > 0.5) {
      if (car.batteryKw > 2.5) return "engine drive + motor";
      if (car.batteryKw < -2.5) return "engine drive · charging";
      return "engine drive";
    }
    if (car.speed < 0.05) return "charging at rest";
    if (car.batteryKw > 2.5) return "series + battery";
    if (car.batteryKw < -2.5) return "series · charging";
    return "series hybrid";
  }
  if (car.speed < 0.05) return "ready";
  if (car.wheelKw > 0.2) return "EV";
  return "coasting";
}

const thousands = (value) => Math.round(value).toLocaleString("en-US");
const kw = (value) => `${value > 0.05 ? "+" : value < -0.05 ? "−" : ""}${Math.abs(value).toFixed(1)}`;
const percent = (soc) => `${Math.round(soc * 100)}%`;

export function fullIn(car) {
  // hours to full at the tapering AC rate, integrated in 0.5% steps
  let hours = 0;
  const steps = 200;
  const span = Math.max(0, SOC.top - car.soc);
  for (let i = 0; i < steps; i++) hours += ((span / steps) * BATTERY_KWH) / chargeRate(car.soc + (span * (i + 0.5)) / steps);
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

export function readoutOf(car) {
  if (car.plug >= 1) return car.chargeKw > 0.05 ? `charging ${car.chargeKw.toFixed(1)} kW AC · ${percent(car.soc)} · full in ${fullIn(car)}` : `plugged in · ${percent(car.soc)}`;
  return `${modeOf(car)} · eng ${thousands(car.engineRpm)} rpm · batt ${kw(car.batteryKw)} kW · ${percent(car.soc)} · ${Math.round(car.speed * 3.6)} km/h`;
}

export function spokenOf(car) {
  if (car.plug >= 1) return `${modeOf(car)}: the wall charger feeds ${car.chargeKw.toFixed(1)} kilowatts into the pack, now at ${percent(car.soc)}${car.chargeKw > 0.05 ? `, full in ${fullIn(car)}` : ""}.`;
  const engine = car.engineRpm > 0 ? `the engine turns at ${thousands(car.engineRpm)} rpm making ${car.engineKw.toFixed(0)} kilowatts, clutch ${car.clutch > 0.5 ? "locked" : "open"}` : "the engine is stopped";
  const battery = car.batteryKw > 0.05 ? `the battery gives ${car.batteryKw.toFixed(1)} kilowatts` : car.batteryKw < -0.05 ? `the battery takes in ${(-car.batteryKw).toFixed(1)} kilowatts` : "the battery is idle";
  return `${modeOf(car)}${car.save ? ", save mode" : ""}: ${Math.round(car.speed * 3.6)} km/h, ${engine}, ${battery}, charge ${percent(car.soc)}. Motor at ${thousands(car.motorRpm)} rpm.`;
}

export const TWO_PI = TAU;
