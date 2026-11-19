// The city's other inhabitants: traffic cars that drive the street grid and slow for the car
// ahead, and pedestrians who stroll the sidewalks and run when a fast car bears down on them.
// Neither knows the player exists except as an obstacle to brake for or flee from.

import {
  PALETTE, PEDESTRIANS, ROADS_H, ROADS_V, TRAFFIC_CARS,
} from './config.js';
import { nearestRoadX, nearestRoadY, onRoad, randomRoadPoint } from './city.js';
import { pick, range } from './random.js';

const LANE = 28;
const PED_COLORS = ['#f2e6c9', '#e8a87c', '#7fb3a3', '#c9a0c4', '#8fa8c8', '#f2c14e', '#e07856', '#d8d8d8'];

export function createTraffic(rng, city) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_CARS; i += 1) {
    cars.push(spawnTrafficCar(rng, city, null));
  }
  const peds = [];
  for (let i = 0; i < PEDESTRIANS; i += 1) {
    peds.push(spawnPed(rng, city, null));
  }
  return { cars, peds };
}

function spawnTrafficCar(rng, city, avoid) {
  const vertical = rng() < 0.5;
  const road = pick(rng, vertical ? ROADS_V : ROADS_H);
  const along = range(rng, 120, (vertical ? 1920 : 2160) - 120);
  const dir = rng() < 0.5 ? 1 : -1;
  const car = {
    x: vertical ? road + (dir > 0 ? -LANE : LANE) : along,
    y: vertical ? along : road + (dir > 0 ? LANE : -LANE),
    angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
    speed: 0,
    axis: vertical ? 'v' : 'h',
    dir,
    targetSpeed: range(rng, 130, 210),
    color: pick(rng, PALETTE.carColors),
    turnCooldown: range(rng, 0, 2),
    brake: 0,
  };
  if (avoid && Math.hypot(car.x - avoid.x, car.y - avoid.y) < 260) return spawnTrafficCar(rng, city, avoid);
  return car;
}

function spawnPed(rng, city, avoid) {
  const spot = randomRoadPoint(rng, 1280, 960, 0, 99999);
  const ped = {
    x: spot.x + range(rng, -40, 40),
    y: spot.y + range(rng, -40, 40),
    angle: range(rng, 0, Math.PI * 2),
    speed: range(rng, 38, 62),
    tx: spot.x,
    ty: spot.y,
    color: pick(rng, PED_COLORS),
    state: 'walk',
    downTimer: 0,
    fleeTimer: 0,
    bob: range(rng, 0, Math.PI * 2),
  };
  if (avoid && Math.hypot(ped.x - avoid.x, ped.y - avoid.y) < 200) return spawnPed(rng, city, avoid);
  return ped;
}

/** One step for every traffic car: drive its street, turn at intersections, brake for traffic. */
export function stepTrafficCars(traffic, dt, rng, obstacles) {
  for (const car of traffic.cars) {
    car.turnCooldown -= dt;
    // At an intersection, sometimes turn onto the crossing street.
    const crossX = nearestRoadX(car.x);
    const crossY = nearestRoadY(car.y);
    const atCross = Math.abs(car.x - crossX) < 16 && Math.abs(car.y - crossY) < 16;
    if (atCross && car.turnCooldown <= 0 && rng() < 0.35) {
      car.turnCooldown = 2.5;
      if (car.axis === 'v') {
        car.axis = 'h';
        car.dir = rng() < 0.5 ? 1 : -1;
        car.y = crossY + (car.dir > 0 ? LANE : -LANE);
        car.angle = car.dir > 0 ? 0 : Math.PI;
      } else {
        car.axis = 'v';
        car.dir = rng() < 0.5 ? 1 : -1;
        car.x = crossX + (car.dir > 0 ? -LANE : LANE);
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
    // Brake for the nearest thing ahead on the same street, player included.
    let want = car.targetSpeed;
    for (const o of obstacles) {
      const dx = o.x - car.x;
      const dy = o.y - car.y;
      const ahead = car.axis === 'v' ? dy * car.dir : dx * car.dir;
      const side = car.axis === 'v' ? Math.abs(dx) : Math.abs(dy);
      if (ahead > 0 && ahead < 130 && side < 30) {
        want = Math.min(want, Math.max(0, (ahead - 34) * 2.2));
      }
    }
    car.speed += (want - car.speed) * Math.min(1, 2.4 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Wrap around the far edge so the streets never run dry.
    if (car.x < -60) car.x = 2220;
    if (car.x > 2280) car.x = -40;
    if (car.y < -60) car.y = 1900;
    if (car.y > 1960) car.y = -40;
  }
}

/** One step for every pedestrian: stroll to a sidewalk point, or run from a speeding car. */
export function stepPedestrians(traffic, dt, rng, city, threats) {
  for (const ped of traffic.peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        const fresh = spawnPed(rng, city, null);
        ped.x = fresh.x;
        ped.y = fresh.y;
        ped.tx = fresh.tx;
        ped.ty = fresh.ty;
        ped.state = 'walk';
      }
      continue;
    }
    // A fast car nearby sends the pedestrian running away from it.
    if (ped.fleeTimer <= 0) {
      for (const t of threats) {
        const d = Math.hypot(t.x - ped.x, t.y - ped.y);
        if (d < 70 && t.speed > 170) {
          ped.fleeTimer = 1.1;
          ped.angle = Math.atan2(ped.y - t.y, ped.x - t.x);
          break;
        }
      }
    }
    if (ped.fleeTimer > 0) {
      ped.fleeTimer -= dt;
      ped.x += Math.cos(ped.angle) * 250 * dt;
      ped.y += Math.sin(ped.angle) * 250 * dt;
      ped.bob += dt * 14;
      continue;
    }
    const dx = ped.tx - ped.x;
    const dy = ped.ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 14) {
      const spot = randomRoadPoint(rng, ped.x, ped.y, 60, 420);
      ped.tx = spot.x + range(rng, -46, 46);
      ped.ty = spot.y + range(rng, -46, 46);
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * ped.speed * dt;
    ped.y += (dy / d) * ped.speed * dt;
    ped.bob += dt * 7;
    // Keep pedestrians out of buildings and the sea; the street grid is their world.
    if (!onRoad(ped.x, ped.y)) {
      ped.x -= (dx / d) * ped.speed * dt * 2;
      ped.y -= (dy / d) * ped.speed * dt * 2;
      const spot = randomRoadPoint(rng, ped.x, ped.y, 60, 300);
      ped.tx = spot.x;
      ped.ty = spot.y;
    }
  }
}

/** A pedestrian the player just hit: down they go, and the street will replace them shortly. */
export function knockPedDown(ped) {
  ped.state = 'down';
  ped.downTimer = 2.6;
}

/** How many souls the traffic system is currently tracking. */
export function trafficCount(traffic) {
  return traffic.cars.length + traffic.peds.length;
}
