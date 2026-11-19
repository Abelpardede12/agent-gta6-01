// The world: one state object holding the city, the player, the traffic, the police, the
// jobs and the particles, and one step that advances all of them. Collisions live here —
// car on car, car on pedestrian, cop on player — because only here does every actor meet.
// The step reports what happened as events; the main loop turns those into toasts and sounds.

import { PLAYER, STEP } from './config.js';
import { createCity } from './city.js';
import { createRandom } from './random.js';
import { createCar, createPlayer, stepCar, stepFoot } from './player.js';
import { createTraffic, knockPedDown, stepPedestrians, stepTrafficCars } from './traffic.js';
import { addWanted, createPolice, stepPolice } from './police.js';
import { createMissions, stepMissions } from './missions.js';
import { ACTION_ENTER } from './input.js';

const SPAWN = { x: 960, y: 836 };

function burst(world, x, y, n, color, speed, size, life) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.6);
    world.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: life * (0.6 + Math.random() * 0.4),
      maxLife: life,
      color,
      size: size * (0.7 + Math.random() * 0.6),
    });
  }
}

function init(world) {
  world.rng = createRandom(world.seed);
  world.city = createCity(world.rng);
  world.player = createPlayer(SPAWN.x, SPAWN.y);
  world.traffic = createTraffic(world.rng, world.city);
  world.police = createPolice();
  world.missions = createMissions(world.rng, world.city);
  world.particles = [];
  world.events = [];
  world.cash = 0;
  world.time = 0;
  world.shake = 0;
  world.stats = { missions: 0, stolen: 0, nearMiss: 0 };
}

export function createWorld(seed) {
  const world = { seed, shake: 0 };
  world.reset = () => init(world);
  // One step for the screenshot autopilot: the same rules, driven by a synthetic input.
  world.stepForShot = (input, actions) => stepWorld(world, input, actions);
  init(world);
  return world;
}

/** The save the title screen shows: best cash, jobs done, best streak. */
export function readSave() {
  try {
    const raw = window.localStorage.getItem('sunset-keys.save.v1');
    if (!raw) return { best: 0, missions: 0, bestStreak: 0 };
    const parsed = JSON.parse(raw);
    return {
      best: Number(parsed.best) || 0,
      missions: Number(parsed.missions) || 0,
      bestStreak: Number(parsed.bestStreak) || 0,
    };
  } catch {
    return { best: 0, missions: 0, bestStreak: 0 };
  }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem('sunset-keys.save.v1', JSON.stringify(save));
  } catch {
    // Storage can be off: the save then lasts this visit only.
  }
}

function nearestParked(world, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const c of world.city.parkedCars) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return bestD <= PLAYER.enterRange ? { car: best, dist: bestD } : null;
}

function nearestSlowTraffic(world, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const c of world.traffic.cars) {
    if (Math.abs(c.speed) > 40) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return bestD <= PLAYER.enterRange ? { car: best, dist: bestD } : null;
}

function wreckCar(world, car) {
  burst(world, car.x, car.y, 26, '#ff8c42', 260, 7, 0.9);
  burst(world, car.x, car.y, 18, '#3a3a3a', 140, 9, 1.4);
  burst(world, car.x, car.y, 10, '#ffd23f', 320, 5, 0.6);
  world.shake = Math.max(world.shake, 16);
  world.events.push({ type: 'wrecked' });
  world.player.onFoot = true;
  world.player.x = car.x + 30;
  world.player.y = car.y + 30;
  world.player.car = null;
}

export function stepWorld(world, input, actions) {
  const { player } = world;
  // Fresh events each step: the actionable ones are spent inside this call, and the main
  // loop drains the rest right after it returns — so nothing is ever paid or applied twice.
  world.events.length = 0;
  world.time += STEP;
  world.shake = Math.max(0, world.shake - STEP * 26);

  // Getting in and out of cars.
  if (actions & ACTION_ENTER) {
    if (player.onFoot) {
      const parked = nearestParked(world, player.x, player.y);
      const slow = nearestSlowTraffic(world, player.x, player.y);
      const pick = parked && (!slow || parked.dist <= slow.dist) ? parked : slow;
      if (pick) {
        if (parked && pick === parked) {
          world.city.parkedCars.splice(world.city.parkedCars.indexOf(pick.car), 1);
        } else {
          world.traffic.cars.splice(world.traffic.cars.indexOf(pick.car), 1);
          // The driver legs it.
          world.traffic.peds.push({
            x: pick.car.x, y: pick.car.y, angle: Math.random() * Math.PI * 2,
            speed: 90, tx: pick.car.x + 200, ty: pick.car.y + 200,
            color: '#f2e6c9', state: 'walk', downTimer: 0, fleeTimer: 1.4, bob: 0,
          });
        }
        player.car = createCar(pick.car.color, pick.car.x, pick.car.y, pick.car.angle);
        player.car.hp = 100;
        player.onFoot = false;
        player.x = pick.car.x;
        player.y = pick.car.y;
        world.stats.stolen += 1;
        addWanted(world.police, 1, 'stolen car', world.events);
        world.events.push({ type: 'stolen' });
      }
    } else if (Math.abs(player.car.speed) < 60) {
      const car = player.car;
      world.city.parkedCars.push({ x: car.x, y: car.y, angle: car.angle, color: car.color });
      player.onFoot = true;
      player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
      player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
      player.car = null;
      world.events.push({ type: 'exited' });
    } else {
      world.events.push({ type: 'too-fast' });
    }
  }

  // Move the player.
  if (player.onFoot) {
    stepFoot(player, input, STEP, world.city);
  } else {
    const report = stepCar(player.car, input, STEP, world.city);
    player.x = player.car.x;
    player.y = player.car.y;
    if (report.crash > 300) {
      player.car.hp -= 8;
      burst(world, player.car.x, player.car.y, 10, '#ffd23f', 200, 4, 0.5);
      world.shake = Math.max(world.shake, 8);
      world.events.push({ type: 'crash', hard: true });
    } else if (report.crash > 150) {
      world.shake = Math.max(world.shake, 3);
      world.events.push({ type: 'crash', hard: false });
    }
    if (player.car.hp <= 0) wreckCar(world, player.car);
    if (player.car && player.car.smoking) {
      world.particles.push({
        x: player.car.x + (Math.random() - 0.5) * 10,
        y: player.car.y + (Math.random() - 0.5) * 10,
        vx: 0, vy: -30, life: 0.9, maxLife: 0.9, color: '#555', size: 7,
      });
    }
  }

  // Traffic and pedestrians, with the player's car and the cruisers as obstacles.
  const obstacles = [];
  if (!player.onFoot) obstacles.push({ x: player.car.x, y: player.car.y, speed: Math.abs(player.car.speed) });
  for (const c of world.police.cars) obstacles.push({ x: c.x, y: c.y, speed: Math.abs(c.speed) });
  for (const c of world.traffic.cars) obstacles.push({ x: c.x, y: c.y, speed: Math.abs(c.speed) });
  stepTrafficCars(world.traffic, STEP, world.rng, obstacles);
  const threats = [];
  if (!player.onFoot) threats.push({ x: player.car.x, y: player.car.y, speed: Math.abs(player.car.speed) });
  for (const c of world.police.cars) threats.push({ x: c.x, y: c.y, speed: Math.abs(c.speed) });
  stepPedestrians(world.traffic, STEP, world.rng, world.city, threats);

  // Car on car: the player's car and the traffic trade paint.
  if (!player.onFoot) {
    const pc = player.car;
    for (const c of world.traffic.cars) {
      const dx = pc.x - c.x;
      const dy = pc.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d < 36 && d > 0.01) {
        const rel = Math.abs(pc.speed - c.speed);
        const push = (36 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        pc.x += nx * push;
        pc.y += ny * push;
        c.x -= nx * push;
        c.y -= ny * push;
        if (rel > 200) {
          pc.hp -= Math.min(8, rel * 0.015);
          c.speed *= 0.4;
          burst(world, pc.x, pc.y, 8, '#ffd23f', 180, 4, 0.4);
          world.shake = Math.max(world.shake, 6);
          world.events.push({ type: 'crash', hard: true });
          if (pc.hp <= 0) {
            wreckCar(world, pc);
            break;
          }
        }
      }
      // A near miss at speed pays a little: threading traffic is a skill.
      if (!player.onFoot && d > 36 && d < 72 && Math.abs(pc.speed) > 300) {
        c.nearMissTimer = (c.nearMissTimer ?? 0) - STEP;
        if (c.nearMissTimer <= 0) {
          c.nearMissTimer = 4;
          world.cash += 10;
          world.stats.nearMiss += 1;
          world.events.push({ type: 'near-miss' });
        }
      }
    }
    // Car on pedestrian: a fast hit knocks them down and raises the heat.
    for (const ped of world.traffic.peds) {
      if (player.onFoot) break;
      if (ped.state !== 'walk') continue;
      const d = Math.hypot(pc.x - ped.x, pc.y - ped.y);
      if (d < 26 && Math.abs(pc.speed) > 120) {
        knockPedDown(ped);
        burst(world, ped.x, ped.y, 6, '#ffffff', 120, 4, 0.4);
        addWanted(world.police, 1, 'hit a pedestrian', world.events);
        world.events.push({ type: 'ped-hit' });
      }
    }
  } else {
    // On foot, a fast traffic car clips the player: knocked down, some cash lost.
    for (const c of world.traffic.cars) {
      const d = Math.hypot(player.x - c.x, player.y - c.y);
      if (d < 26 && Math.abs(c.speed) > 100 && player.downTimer <= 0) {
        player.downTimer = 1.2;
        const lost = Math.min(world.cash, 25);
        world.cash -= lost;
        c.speed *= 0.2;
        world.events.push({ type: 'clipped', lost });
      }
    }
  }

  // The police answer the heat, and the jobs keep coming.
  stepPolice(world.police, STEP, world.rng, player, world.city, world.events);
  stepMissions(world.missions, STEP, player, world.events);

  // Spend the events that need the world to act, not just the main loop to announce.
  let bustedDone = false;
  for (const e of world.events) {
    if (e.type === 'rammed' && !player.onFoot && player.car) {
      player.car.hp -= e.damage;
      world.shake = Math.max(world.shake, 7);
      burst(world, player.car.x, player.car.y, 8, '#ffd23f', 180, 4, 0.4);
      if (player.car.hp <= 0) wreckCar(world, player.car);
    } else if (e.type === 'mission-done') {
      world.cash += e.job.reward;
      world.stats.missions += 1;
      burst(world, e.job.x, e.job.y, 20, '#ffd23f', 200, 5, 0.8);
    } else if (e.type === 'busted' && !bustedDone) {
      bustedDone = true;
      const lost = Math.floor(world.cash * 0.25);
      world.cash -= lost;
      e.lost = lost;
      world.police.wanted = 0;
      world.police.cars.length = 0;
      player.onFoot = true;
      player.car = null;
      player.x = 960;
      player.y = 836;
      player.downTimer = 0;
      world.shake = 0;
    }
  }

  // Particles age out.
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const p = world.particles[i];
    p.life -= STEP;
    p.x += p.vx * STEP;
    p.y += p.vy * STEP;
    if (p.life <= 0) world.particles.splice(i, 1);
  }
}
