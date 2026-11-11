// The truth behind the figure: a pressurised water reactor plant in the manner
// of a Westinghouse four-loop unit of about 3,400 MW thermal, one loop drawn.
//
// The grid sets the load. The turbine's governor valve opens toward it, more
// steam leaves the steam generator, the primary water comes back cooler, and
// cooler water slows neutrons better, so the core's power rises to meet the
// demand. The control rods then step to bring the average coolant temperature
// back to its programme. Everything the card shows, and every moving part, is
// read from here.
//
// Kinetics are one delayed-neutron group with the prompt-jump approximation:
// the neutron population follows reactivity at once, the delayed precursors
// carry it along at their own pace. Feedback is fuel (Doppler) and moderator
// temperature. After a trip, decay heat is three exponential groups summing to
// about 6.5% of the power the core ran at.

export const SLOW = 1 / 50; // turning parts are drawn at a fiftieth of true speed
export const FAST = 30; // the plant's own clock runs thirty times faster than true

export const PLANT = { thermal: 3411, electric: 1160, loops: 4 }; // MWt, MWe gross
export const PRIMARY = { bar: 155, noLoadT: 291.7, fullT: 307.2, coreRise: 33.4, pumpRpm: 1189, flow: 17600 }; // flow in kg/s, four loops
export const STEAM = { noLoadBar: 75.3, fullBar: 69, flow: 1890 }; // kg/s at full load, four generators
export const TURBINE = { rpm: 1500, hz: 50, poles: 4, kv: 24, gridKv: 400 };
export const CONDENSER = { kpa: 5.1, celsius: 33 };
export const CORE = { assemblies: 193, rods: 264, rccas: 53, rodlets: 24, heightM: 3.66 };
export const RODS = { steps: 228, perMin: 72, dropS: 2.0 }; // a bank's travel, its drive speed, its fall
export const PRZ = { noLoad: 0.25, full: 0.61 }; // pressuriser level programme
export const TRIP = { highFlux: 1.09 };

// one delayed group, in dollars of reactivity
const LAMBDA = 0.08; // 1/s
const BANK_WORTH = 2.2; // $ over the full travel of control bank D
const SHUTDOWN_WORTH = 6; // $ of the shutdown banks
const Z_HZP = 0.3; // bank D height that holds the hot core just critical at zero power
const DOPPLER = 1.0; // $ at full power
const MTC = 0.04; // $ per °C (negative feedback)
const TAU_FUEL = 5; // s
const HEAT_CAP = 1.6; // °C per second per unit of heat mismatch (primary water and steel)
const DECAY = [
  [0.03, 6],
  [0.02, 90],
  [0.015, 1200],
]; // share of the power, time constant in s
const DECAY_SHARE = DECAY.reduce((sum, [a]) => sum + a, 0);
const SOURCE = 2e-6; // the neutron source's floor, as a fraction of full power
const RAMP = 5 / 100 / 60; // the turbine's load ramp: 5% a minute
const ROLL_UP = 60; // s from turning gear to synchronous speed
const COAST = 900; // s, the turbine-generator's coast-down time constant
const DUMP = 0.4; // steam dump capacity, as a share of full steam flow
const SYNC_POWER = 0.08; // the core's power off the grid, ready to take the turbine

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const toward = (value, target, step) => (Math.abs(target - value) <= step ? target : value + Math.sign(target - value) * step);

// the integral rod worth of a bank, the usual S-curve over its travel
const shapeOf = (z) => z - Math.sin(2 * Math.PI * z) / (2 * Math.PI);
export const rodWorth = (z) => BANK_WORTH * (shapeOf(z) - shapeOf(Z_HZP));
export const tavgOf = (share) => PRIMARY.noLoadT + (PRIMARY.fullT - PRIMARY.noLoadT) * share;

// The bank height that holds a power level steady at the programmed temperature.
export function heightFor(power) {
  const need = DOPPLER * power + MTC * (tavgOf(power) - PRIMARY.noLoadT);
  let low = 0;
  let high = 1;
  for (let i = 0; i < 40; i++) {
    const z = (low + high) / 2;
    if (rodWorth(z) < need) low = z;
    else high = z;
  }
  return (low + high) / 2;
}

// ----- state -----

export function plantAt(load = 1) {
  const p = load;
  return {
    demand: load, // what the grid asks, 0 … 1
    scram: false, // the reactor-trip breakers are open
    why: "", // what tripped it
    bank: heightFor(p), // control bank D, 0 in … 1 out
    shutdown: 1, // shutdown banks, 0 in … 1 out
    power: p, // fission power, share of full
    precursors: p,
    fuel: p, // the fuel temperature's lag of power, share of its full-power rise
    decay: DECAY.map(([a]) => a * p),
    heat: p, // heat into the primary water, share of 3411 MW
    tavg: tavgOf(p),
    valve: load, // governor valve, share of full steam flow
    dump: 0, // steam dump to the condenser
    steam: load, // steam leaving the generator
    rpm: TURBINE.rpm,
    online: load > 0.04, // generator breaker closed
    latched: load > 0.04, // turbine reset, ready to roll
    angle: { turbine: 0, pump: 0, feed: 0, cw: 0 },
  };
}

// The rods' own motion: the drive steps toward what automatic control asks, a trip drops them.
function rodsStep(plant, dtTrue, dtReal) {
  if (plant.scram) {
    // they fall under gravity into the dashpots, in real seconds
    const fall = dtReal / RODS.dropS;
    plant.bank = Math.max(0, plant.bank - fall);
    plant.shutdown = Math.max(0, plant.shutdown - fall);
    return;
  }
  const stepSize = (RODS.perMin / 60 / RODS.steps) * dtTrue;
  if (plant.shutdown < 1) {
    // after a reset the shutdown banks come out first; bank D waits
    plant.shutdown = Math.min(1, plant.shutdown + stepSize);
    return;
  }
  let speed = 0;
  if (plant.online) {
    // automatic rod control: average temperature against its reference from the turbine's
    // load, with the power mismatch to lead it
    const error = plant.tavg - tavgOf(plant.valve) + 3 * (plant.heat - plant.steam);
    speed = Math.abs(error) < 0.8 ? 0 : clamp((Math.abs(error) - 0.8) / 5) * Math.sign(error);
  } else {
    // off the grid the operator brings the core to a few percent on the steam dumps, ready
    // to roll the turbine, withdrawing only while the startup rate stays gentle
    const goal = plant.demand >= 0.05 ? SYNC_POWER : 0;
    const rho = rodWorth(plant.bank) - DOPPLER * plant.fuel - MTC * (plant.tavg - PRIMARY.noLoadT);
    if (goal && plant.power < goal * 0.8 && rho < 0.3) speed = -1;
    else if (plant.power > Math.max(goal * 1.25, 0.002)) speed = 0.6;
  }
  plant.bank = clamp(plant.bank - speed * stepSize);
}

// Advance by dtReal seconds of figure time. `calm` lands at the steady state instead.
export function stepPlant(plant, dtReal, calm = false) {
  if (calm) return settle(plant);
  const subs = Math.max(1, Math.ceil((dtReal * FAST) / 0.1));
  const h = (dtReal * FAST) / subs;
  for (let i = 0; i < subs; i++) {
    // ----- the turbine and the steam it takes -----
    const want = plant.demand;
    // the turbine is reset and rolled only once the core is making steam for it
    if (!plant.scram && !plant.latched && want >= 0.05 && plant.heat >= SYNC_POWER * 0.7) plant.latched = true;
    if (plant.latched) {
      const up = want >= 0.05 || plant.online;
      if (up && plant.rpm < TURBINE.rpm) plant.rpm = Math.min(TURBINE.rpm, plant.rpm + (TURBINE.rpm / ROLL_UP) * h);
      if (!plant.online && plant.rpm >= TURBINE.rpm && want >= 0.05) plant.online = true;
      if (plant.online) {
        plant.valve = toward(plant.valve, Math.max(0.05, want), RAMP * h);
        // a floor of 5% load; asked for less, the unit comes off the grid and the turbine is tripped
        if (want < 0.05 && plant.valve <= 0.05) {
          plant.online = false;
          plant.latched = false;
        }
      } else plant.valve = toward(plant.valve, 0, h / 4);
    } else {
      plant.valve = toward(plant.valve, 0, h / 4);
      plant.online = false;
    }
    if (!plant.latched) plant.rpm = Math.max(0, plant.rpm - (plant.rpm / COAST) * h);
    const turbineSteam = plant.online ? plant.valve : 0;
    // steam dumps to the condenser: off the grid they hold the no-load temperature; on it they
    // open only when a sudden loss of load leaves the water more than 3 °C over its reference
    plant.dump = plant.online
      ? clamp(0.1 * (plant.tavg - tavgOf(turbineSteam) - 3), 0, DUMP)
      : clamp(plant.heat - turbineSteam + 0.12 * (plant.tavg - PRIMARY.noLoadT), 0, DUMP);
    plant.steam = turbineSteam + plant.dump;

    // ----- the core -----
    rodsStep(plant, h, h / FAST);
    const rho =
      rodWorth(plant.bank) - SHUTDOWN_WORTH * (1 - plant.shutdown) - DOPPLER * plant.fuel - MTC * (plant.tavg - PRIMARY.noLoadT);
    const dollars = Math.min(rho, 0.9);
    plant.power = Math.max(SOURCE, plant.precursors / (1 - dollars));
    plant.precursors += LAMBDA * (plant.power - plant.precursors) * h + SOURCE * LAMBDA * h;
    plant.fuel += ((plant.power - plant.fuel) * h) / TAU_FUEL;
    plant.decay = plant.decay.map((d, j) => d + ((DECAY[j][0] * plant.power - d) * h) / DECAY[j][1]);
    plant.heat = (1 - DECAY_SHARE) * plant.power + plant.decay.reduce((a, b) => a + b, 0);
    plant.tavg += (plant.heat - plant.steam) * HEAT_CAP * h;

    // ----- protection: high neutron flux trips the reactor, the reactor trips the turbine -----
    if (!plant.scram && plant.power > TRIP.highFlux) trip(plant, "high flux");
  }
  turnStep(plant, dtReal);
  return plant;
}

export function trip(plant, why = "manual") {
  if (plant.scram) return;
  plant.scram = true;
  plant.why = why;
  plant.latched = false;
  plant.online = false;
}

// Reset after a trip: the breakers close, the shutdown banks come out, and the
// turbine rolls back up once there is load to take.
export function reset(plant) {
  if (!plant.scram || plant.bank > 0 || plant.shutdown > 0) return false;
  plant.scram = false;
  plant.why = "";
  return true;
}

function turnStep(plant, dtReal) {
  const turn = 6 * SLOW * dtReal; // degrees per rpm
  const a = plant.angle;
  a.turbine = (a.turbine + plant.rpm * turn) % 1440000;
  a.pump = (a.pump + PRIMARY.pumpRpm * turn) % 1440000;
  a.feed = (a.feed + 5200 * plant.steam * turn) % 1440000;
  a.cw = (a.cw + 330 * turn) % 1440000;
}

// Reduced motion: the steady state of what is asked for.
function settle(plant) {
  if (plant.scram) {
    plant.bank = 0;
    plant.shutdown = 0;
    plant.power = SOURCE;
    plant.precursors = SOURCE;
    plant.fuel = 0;
    plant.heat = 0.012;
    plant.decay = DECAY.map(([a]) => (a * 0.012) / DECAY_SHARE);
    plant.tavg = PRIMARY.noLoadT;
    plant.valve = 0;
    plant.dump = 0.012;
    plant.steam = 0.012;
    plant.rpm = 0;
    plant.online = false;
    plant.latched = false;
    return plant;
  }
  const p = plant.demand >= 0.05 ? plant.demand : 0;
  const keep = plant.angle;
  Object.assign(plant, plantAt(p), { demand: plant.demand, angle: keep });
  if (p === 0) {
    plant.power = 0.001;
    plant.heat = 0.001;
    plant.rpm = 0;
    plant.valve = 0;
    plant.online = false;
    plant.latched = false;
  }
  return plant;
}

// ----- what the plant reads -----

export const thot = (plant) => plant.tavg + (PRIMARY.coreRise / 2) * plant.heat;
export const tcold = (plant) => plant.tavg - (PRIMARY.coreRise / 2) * plant.heat;
export const steamBar = (plant) => STEAM.noLoadBar - (STEAM.noLoadBar - STEAM.fullBar) * clamp(plant.steam);
export const przLevel = (plant) => PRZ.noLoad + ((PRZ.full - PRZ.noLoad) * (plant.tavg - PRIMARY.noLoadT)) / (PRIMARY.fullT - PRIMARY.noLoadT);
export const mwe = (plant) => (plant.online ? Math.max(0, (PLANT.electric * (plant.valve - 0.03)) / 0.97) : 0);
export const mwt = (plant) => PLANT.thermal * plant.heat;
export const stepsOf = (z) => Math.round(z * RODS.steps);

export function modeOf(plant) {
  if (plant.scram) return plant.bank > 0 || plant.shutdown > 0 ? "reactor trip · rods falling" : `tripped · ${plant.why} · decay heat`;
  if (plant.shutdown < 1) return "reset · shutdown banks out";
  if (!plant.online && plant.rpm > 1 && plant.rpm < TURBINE.rpm && plant.latched) return "turbine rolling up";
  if (!plant.online) return plant.power > 0.02 ? "hot standby · steam dump" : "hot standby";
  if (Math.abs(plant.valve - Math.max(0.05, plant.demand)) > 0.004) return plant.valve < plant.demand ? "raising load" : "lowering load";
  return "on the grid";
}

const whole = (value) => Math.round(value).toLocaleString("en-US");
const pct = (share) => `${share < 0.095 && share > 0.0005 ? (share * 100).toFixed(1) : Math.round(share * 100)}%`;

export function readoutOf(plant) {
  if (plant.scram) return `${modeOf(plant)} · ${whole(mwt(plant))} MWt · turbine ${whole(plant.rpm)} rpm`;
  return `${modeOf(plant)} · ${whole(mwt(plant))} MWt · ${whole(mwe(plant))} MWe · rods ${stepsOf(plant.bank)}/${RODS.steps}`;
}

export function spokenOf(plant) {
  if (plant.scram)
    return `Reactor tripped (${plant.why}). The control rods have dropped into the core and fission has stopped; decay heat of ${whole(mwt(plant))} megawatts goes to the condenser through the steam dumps. The turbine is coasting down at ${whole(plant.rpm)} rpm. Press R to reset.`;
  return `${modeOf(plant)}: the core makes ${whole(mwt(plant))} megawatts of heat at ${pct(plant.power)} power, the generator sends ${whole(mwe(plant))} megawatts to the grid, control bank D stands at ${stepsOf(plant.bank)} of ${RODS.steps} steps, average coolant ${plant.tavg.toFixed(1)} degrees.`;
}
