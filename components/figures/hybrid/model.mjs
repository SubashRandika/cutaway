// The truth behind the figure: a power-split ("series-parallel") hybrid in the
// manner of a fourth-generation Toyota Hybrid System. A 1.8 litre Atkinson four
// turns the carrier of one planetary gear set; motor-generator 1 holds the sun,
// the ring gear drives the wheels and motor-generator 2 is geared to the same
// counter gear. Every number the card shows, and every moving part, is read
// from here. Conversion losses are left out, so engine power plus battery power
// equals the power at the wheel.

export const ENGINE = { bore: 80.5, stroke: 88.3, cylinders: 4, compression: 13, power: 73, torque: 142 };
export const DISPLACEMENT = (Math.PI / 4) * (ENGINE.bore / 10) ** 2 * (ENGINE.stroke / 10) * ENGINE.cylinders; // cc
export const ENGINE_MAX = 5200; // rpm at full power
export const ENGINE_MIN = 1000; // the slowest it runs while firing
export const SLOW = 1 / 50; // the drawing turns at a fiftieth of true speed

// Power-split planetary: carrier = engine, sun = MG1, ring = output.
export const PSD = { sun: 30, planet: 24, ring: 78, planets: 4 };
export const RHO = PSD.sun / PSD.ring;
// Ring's outer teeth to the counter driven gear, MG2's reduction pinion to the
// same gear, then the final drive to the differential.
export const COUNTER = { drive: 54, driven: 55 };
export const MG2_PINION = 17;
export const FINAL = { pinion: 23, ring: 64 };
export const RING_TO_WHEEL = (FINAL.ring / FINAL.pinion) * (COUNTER.driven / COUNTER.drive); // ring rpm per wheel rpm
export const MG2_TO_RING = (COUNTER.drive / COUNTER.driven) * (COUNTER.driven / MG2_PINION); // MG2 rpm per ring rpm
export const MG1_LIMIT = 10000;
export const MG2_LIMIT = 17000;
export const MG2_POWER = 53; // kW

export const BATTERY = { volts: 201.6, amphours: 6.5, modules: 28, cells: 168, discharge: 27, charge: 25 };
export const BATTERY_KWH = (BATTERY.volts * BATTERY.amphours) / 1000;
export const SOC = { target: 0.6, low: 0.45, floor: 0.4, ceiling: 0.8 };
export const SYSTEM_POWER = 90; // kW the system may put down

export const CAR = { mass: 1450, cda: 0.54, crr: 0.008, tyre: "195/65 R15", circumference: 1.99 };
export const DRIVE_FORCE = 4200; // N at the contact patch, pedal floored, below the power limit
export const BRAKE_FORCE = 7000; // N, pedal pressed hard
export const EV_SPEED = 70; // km/h: above this the engine runs whenever the car pulls
export const ENGINE_ON = 16; // kW of wheel demand that starts the engine
export const ENGINE_OFF = 10; // kW below which it stops again

const G = 9.81;
const AIR = 1.2;
const TAU = Math.PI * 2;
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const follow = (value, target, dt, seconds) => (dt <= 0 ? target : value + (target - value) * (1 - Math.exp(-dt / seconds)));
const rad = (rpm) => (rpm * TAU) / 60;

export const kmhOf = (wheelRpm) => (wheelRpm * CAR.circumference * 60) / 1000;
export const wheelRpmOf = (ms) => (ms * 60) / CAR.circumference;
export const roadLoad = (ms) => 0.5 * AIR * CAR.cda * ms * ms + (ms > 0.05 ? CAR.crr * CAR.mass * G : 0);

// Willis: S·ωs + R·ωr = (S + R)·ωc, so the sun's speed follows from the other two.
export const mg1RpmOf = (engineRpm, ringRpm) => ((PSD.sun + PSD.ring) * engineRpm - PSD.ring * ringRpm) / PSD.sun;

// The engine's best-efficiency line: the speed it runs at for each power.
export const engineRpmFor = (kw) => ENGINE_MIN + (ENGINE_MAX - ENGINE_MIN) * clamp(kw / ENGINE.power);

// Crank degrees: cylinder n fires at 180° steps in the order 1-3-4-2.
export const FIRING = [0, 540, 180, 360];
export const STROKES = ["intake", "compression", "power", "exhaust"];
export const strokeOf = (crank, cylinder) => STROKES[Math.floor((((crank - FIRING[cylinder] + 360) % 720) + 720) % 720 / 180)];

// ----- state -----

export function carAt() {
  return {
    pedal: 0, // -1 brake hard … 0 coast … 1 floored
    speed: 0, // m/s
    soc: SOC.target,
    engine: "off", // off · start · on · stop
    engineRpm: 0,
    engineKw: 0, // shaft power
    engineNm: 0,
    want: 0, // engine power asked for
    wheelKw: 0, // power at the contact patch (negative while braking)
    regenKw: 0, // the share of braking MG2 takes back
    frictionKw: 0,
    mg1Rpm: 0,
    mg2Rpm: 0,
    mg1Kw: 0, // electrical, + drawn from the bus, − generated
    mg2Kw: 0,
    batteryKw: 0, // + discharging, − charging
    timer: 0,
    angle: { crank: 0, sun: 0, ring: 0, mg2: 0, wheel: 0, counter: 0 },
  };
}

const dischargeLimit = (soc) => BATTERY.discharge * clamp((soc - SOC.floor) / 0.05);
const chargeLimit = (soc) => BATTERY.charge * clamp((SOC.ceiling - soc) / 0.05);

// Advance by dt seconds of true time. `calm` jumps every lag to its target.
export function stepCar(car, dt, calm = false) {
  const v = car.speed;
  const pedal = clamp(car.pedal, -1, 1);
  const pull = pedal > 0 ? pedal * Math.min(DRIVE_FORCE, (SYSTEM_POWER * 1000) / Math.max(v, 0.5)) : 0;
  const brake = pedal < 0 ? -pedal * BRAKE_FORCE : pedal === 0 && v > 1 ? 160 : 0; // pedal up: a light regenerative drag
  const demandKw = (pull * v) / 1000;
  const wheelRpm = wheelRpmOf(v);
  const ringRpm = wheelRpm * RING_TO_WHEEL;

  // ----- engine on or off -----
  const kmh = v * 3.6;
  const needs = pull > 0 && (demandKw > ENGINE_ON || kmh > EV_SPEED);
  const may = pull > 0 && (demandKw > ENGINE_OFF || kmh > EV_SPEED - 5);
  const running = car.engine === "on" || car.engine === "start";
  const wantOn = needs || car.soc < SOC.low || (running && (may || car.soc < SOC.low + 0.03));
  if (wantOn && !running) {
    car.engine = "start";
    car.timer = 0;
  } else if (!wantOn && running) {
    car.engine = "stop";
    car.timer = 0;
  }
  car.timer += dt;

  // MG1 may not pass its speed limit, which caps how fast (so how hard) the engine runs
  const rpmCap = Math.min(ENGINE_MAX, (MG1_LIMIT * PSD.sun + PSD.ring * ringRpm) / (PSD.sun + PSD.ring));
  const kwCap = ENGINE.power * clamp((rpmCap - ENGINE_MIN) / (ENGINE_MAX - ENGINE_MIN));
  const topUp = clamp((SOC.target - car.soc) * 220, 0, 9);
  const floor = Math.min(4, Math.max(0, demandKw) + chargeLimit(car.soc));
  car.want = car.engine === "on" ? clamp(Math.max(demandKw, 0) + topUp, floor, Math.max(floor, kwCap)) : 0;
  if (car.engine === "start") {
    // MG1 spins the stopped engine up through the carrier, then it fires
    car.engineRpm = calm ? ENGINE_MIN : Math.min(ENGINE_MIN, car.engineRpm + (dt * ENGINE_MIN) / 0.35);
    car.engineKw = 0;
    car.engineNm = -30; // compression and friction, carried by MG1
    if (car.engineRpm >= ENGINE_MIN) {
      car.engine = "on";
      car.timer = 0;
    }
  } else if (car.engine === "on") {
    car.engineKw = calm ? car.want : follow(car.engineKw, car.want, dt, 0.45);
    car.engineRpm = calm ? engineRpmFor(car.want) : follow(car.engineRpm, engineRpmFor(car.engineKw), dt, 0.3);
    car.engineNm = (car.engineKw * 1000) / rad(Math.max(car.engineRpm, 1));
  } else {
    // fuel cut: MG1 brings the carrier to rest
    car.engineRpm = calm ? 0 : Math.max(0, car.engineRpm - (dt * ENGINE_MIN) / 0.4);
    car.engineKw = 0;
    car.engineNm = car.engineRpm > 0 ? -18 : 0;
    if (car.engine === "stop" && car.engineRpm === 0) car.engine = "off";
  }

  // ----- the split -----
  car.mg1Rpm = mg1RpmOf(car.engineRpm, ringRpm);
  car.mg2Rpm = ringRpm * MG2_TO_RING;
  // MG1 holds the sun against the engine; the ring takes 1/(1+ρ) of the torque mechanically.
  let shaftKw = (car.engineNm * rad(car.engineRpm)) / 1000;
  car.mg1Kw = (-car.engineNm * (RHO / (1 + RHO)) * rad(car.mg1Rpm)) / 1000;
  const mechKw = ((car.engineNm / (1 + RHO)) * rad(ringRpm)) / 1000;

  let wheelKw;
  let regenKw = 0;
  let frictionKw = 0;
  if (brake > 0) {
    // MG2 takes back what the battery can hold, the friction brake the rest
    const askKw = (brake * v) / 1000;
    const room = Math.max(0, Math.min(MG2_POWER, chargeLimit(car.soc) + shaftKw));
    regenKw = Math.min(askKw, room) * clamp((v - 1.2) / 2); // fades out in the last few km/h
    frictionKw = askKw - regenKw;
    wheelKw = -regenKw;
  } else {
    wheelKw = demandKw;
    // the battery covers the gap between wheel and engine, inside its limits
    const most = dischargeLimit(car.soc);
    if (wheelKw - shaftKw > most) wheelKw = shaftKw + most;
    if (wheelKw - mechKw > MG2_POWER) wheelKw = mechKw + MG2_POWER;
  }
  if (car.engine === "on" && wheelKw - shaftKw < -chargeLimit(car.soc)) {
    // the battery can't take more: the engine eases off at once
    const scale = Math.max(0, wheelKw + chargeLimit(car.soc)) / Math.max(shaftKw, 0.001);
    car.engineKw *= scale;
    car.engineNm *= scale;
    car.mg1Kw *= scale;
    shaftKw *= scale;
  }
  car.wheelKw = brake > 0 ? -(regenKw + frictionKw) : wheelKw;
  car.regenKw = regenKw;
  car.frictionKw = frictionKw;
  car.batteryKw = wheelKw - shaftKw;
  car.mg2Kw = car.batteryKw - car.mg1Kw;

  // ----- the car -----
  const tractive = brake > 0 ? -brake : demandKw > 0.001 ? pull * Math.min(1, wheelKw / demandKw) : pull;
  const accel = (tractive - roadLoad(v)) / CAR.mass;
  if (!calm) car.speed = Math.max(0, v + accel * dt);
  if (car.speed < 0.03 && pull === 0) car.speed = 0;
  car.soc = clamp(car.soc - (car.batteryKw * dt) / (BATTERY_KWH * 3600), 0.3, 0.85);

  // the drawing's own angles, in degrees, turning at SLOW of true speed
  const turn = 6 * SLOW * dt;
  const a = car.angle;
  a.crank = (a.crank + car.engineRpm * turn) % 1440000;
  a.sun = (a.sun + car.mg1Rpm * turn) % 1440000;
  a.ring = (a.ring + ringRpm * turn) % 1440000;
  a.mg2 = (a.mg2 + car.mg2Rpm * turn) % 1440000;
  a.counter = (a.counter + ringRpm * (COUNTER.drive / COUNTER.driven) * turn) % 1440000;
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
  if (car.engine === "start") return "engine starting";
  if (car.regenKw > 0.4) return car.engine === "off" ? "regen braking" : "regen · engine stopping";
  if (car.frictionKw > 0.2 && car.speed > 0.05) return "friction braking";
  if (car.engine === "on" || car.engine === "stop") {
    if (car.engine === "stop") return "engine stopping";
    if (car.speed < 0.05) return "charging at rest";
    if (car.batteryKw > 2.5) return "engine + battery";
    if (car.batteryKw < -2.5) return "hybrid · charging";
    return "hybrid";
  }
  if (car.speed < 0.05) return "ready";
  if (car.wheelKw > 0.2) return "EV";
  return "coasting";
}

const thousands = (value) => Math.round(value).toLocaleString("en-US");
const kw = (value) => `${value > 0.05 ? "+" : value < -0.05 ? "−" : ""}${Math.abs(value).toFixed(1)}`;

export function readoutOf(car) {
  return `${modeOf(car)} · eng ${thousands(car.engineRpm)} rpm · batt ${kw(car.batteryKw)} kW · ${Math.round(car.speed * 3.6)} km/h`;
}

export function spokenOf(car) {
  const engine = car.engineRpm > 0 ? `the engine turns at ${thousands(car.engineRpm)} rpm making ${car.engineKw.toFixed(0)} kilowatts` : "the engine is stopped";
  const battery = car.batteryKw > 0.05 ? `the battery gives ${car.batteryKw.toFixed(1)} kilowatts` : car.batteryKw < -0.05 ? `the battery takes in ${(-car.batteryKw).toFixed(1)} kilowatts` : "the battery is idle";
  return `${modeOf(car)}: ${Math.round(car.speed * 3.6)} km/h, ${engine}, ${battery}, charge ${Math.round(car.soc * 100)} percent. MG1 at ${thousands(car.mg1Rpm)} rpm, MG2 at ${thousands(car.mg2Rpm)} rpm.`;
}

export const TWO_PI = TAU;
