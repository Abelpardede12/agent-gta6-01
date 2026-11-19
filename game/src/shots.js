// The screenshot scenes behind ?shot=drive|foot|chase|mission (and start, the title). Each
// one plays the real rules forward from a fresh world for a fixed number of steps, steered by
// an autopilot that follows the street grid toward the job beacon, so the frame is what a
// short game really looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { nearestRoadX, nearestRoadY, randomRoadPoint, routeTo } from './city.js';
import { createCar } from './player.js';
import { addWanted } from './police.js';

const DRIVE_SECONDS = 4;
const FOOT_SECONDS = 3;
const CHASE_SECONDS = 3;
const MISSION_SECONDS = 2.5;
const TITLE_SECONDS = 6;

/** Put the player behind the wheel of a car at (x, y), facing `angle`, at speed. */
function putPlayerInCar(world, x, y, angle, color, speed) {
  const car = createCar(color, x, y, angle);
  car.vx = Math.cos(angle) * speed;
  car.vy = Math.sin(angle) * speed;
  car.speed = speed;
  world.player.car = car;
  world.player.onFoot = false;
  world.player.x = x;
  world.player.y = y;
  return car;
}

/** Drop a cruiser into the world, ready to chase. */
function addPoliceCar(world, x, y, angle) {
  const car = createCar('#2b4acb', x, y, angle);
  car.isPolice = true;
  car.route = [];
  car.routeTimer = 0;
  car.ramTimer = 0;
  car.lightPhase = Math.random() * Math.PI * 2;
  world.police.cars.push(car);
  return car;
}

/**
 * An autopilot that drives the player's car along the street grid toward a target: it keeps
 * a route of intersections, steers at the next one, and throttles when it is lined up.
 */
export function createAutopilot(world) {
  const input = { up: false, down: false, left: false, right: false };
  let route = [];
  let target = null;

  return {
    input,
    setTarget(x, y) {
      if (!target || Math.hypot(target.x - x, target.y - y) > 30) {
        target = { x, y };
        route = [];
      }
    },
    update() {
      const car = world.player.car;
      if (!car || !target) {
        input.up = false;
        input.down = false;
        input.left = false;
        input.right = false;
        return;
      }
      if (route.length === 0) route = routeTo(car.x, car.y, target.x, target.y);
      const wp = route[0] ?? target;
      if (Math.hypot(wp.x - car.x, wp.y - car.y) < 55) {
        route.shift();
        return;
      }
      const want = Math.atan2(wp.y - car.y, wp.x - car.x);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      input.up = Math.abs(diff) < 2.0;
      input.down = Math.abs(diff) > 2.6;
      input.left = diff < -0.12;
      input.right = diff > 0.12;
    },
  };
}

function driveFor(world, pilot, seconds, followJob) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    // A wreck mid-staging is invisible in the final frame, but a missing car would break
    // the rest of the staging: put the driver straight back in a fresh ride.
    if (!world.player.car) {
      putPlayerInCar(world, world.player.x, world.player.y, world.player.angle, '#ffcf3f', 240);
    }
    if (followJob) {
      // If the autopilot already finished the job, hang a fresh beacon ahead of the car so
      // the frame always shows a mission in progress. If the car is pinned near a map edge
      // and "ahead" is no longer ahead, pick a fresh spot across the city instead.
      if (!world.missions.active) {
        const car = world.player.car;
        const ahead = 560;
        let bx = car.x + Math.cos(car.angle) * ahead;
        let by = car.y + Math.sin(car.angle) * ahead;
        if (Math.abs(Math.cos(car.angle)) > Math.abs(Math.sin(car.angle))) {
          by = nearestRoadY(by);
        } else {
          bx = nearestRoadX(bx);
        }
        bx = Math.max(120, Math.min(2200, bx));
        by = Math.max(120, Math.min(1800, by));
        if (Math.hypot(bx - car.x, by - car.y) < 150) {
          const spot = randomRoadPoint(world.rng, car.x, car.y, 500, 1000);
          bx = spot.x;
          by = spot.y;
        }
        world.missions.active = {
          x: bx, y: by,
          timeLeft: 40, total: 40, reward: 175, name: 'Pier Run',
        };
      }
      pilot.setTarget(world.missions.active.x, world.missions.active.y);
    }
    pilot.update();
    world.stepForShot(pilot.input, 0);
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it. Any unknown name
 * stages the title, so a bad query still shows the game.
 */
export function stageShot(name, world) {
  world.reset();
  const pilot = createAutopilot(world);

  if (name === 'drive') {
    // The cover: driving east down a main street, two stars lit, two cruisers closing in,
    // and the job beacon glowing ahead.
    putPlayerInCar(world, 700, 800, 0, '#ffcf3f', 300);
    addWanted(world.police, 2, 'stolen car', world.events);
    addPoliceCar(world, 380, 772, 0);
    addPoliceCar(world, 340, 828, 0);
    world.missions.active = {
      x: 1500, y: 800, timeLeft: 32, total: 40, reward: 175, name: 'Pier Run',
    };
    driveFor(world, pilot, DRIVE_SECONDS, true);
    return { screen: 'play' };
  }

  if (name === 'foot') {
    // On foot at a busy intersection: pedestrians strolling, traffic rolling past.
    world.player.x = 980;
    world.player.y = 762;
    world.player.angle = Math.PI / 2;
    for (let i = 0; i < 6 && i < world.traffic.peds.length; i += 1) {
      const ped = world.traffic.peds[i];
      ped.x = 940 + i * 22;
      ped.y = 700 + (i % 3) * 34;
      ped.tx = ped.x + 160;
      ped.ty = ped.y;
    }
    const cruiser = world.traffic.cars[0];
    cruiser.x = 620;
    cruiser.y = 800;
    cruiser.axis = 'h';
    cruiser.dir = 1;
    cruiser.angle = 0;
    const steps = Math.round(FOOT_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) world.stepForShot({ up: false, down: false, left: false, right: false }, 0);
    return { screen: 'play' };
  }

  if (name === 'chase') {
    // Three stars, three cruisers on the player's tail, racing north to the beacon.
    putPlayerInCar(world, 1360, 1750, -Math.PI / 2, '#ffcf3f', 420);
    addWanted(world.police, 3, 'stolen car', world.events);
    addPoliceCar(world, 1360, 1900, -Math.PI / 2);
    addPoliceCar(world, 1100, 1760, 0);
    addPoliceCar(world, 1620, 1760, Math.PI);
    world.missions.active = {
      x: 1360, y: 1000, timeLeft: 26, total: 34, reward: 200, name: 'Downtown Dash',
    };
    driveFor(world, pilot, CHASE_SECONDS, true);
    return { screen: 'play' };
  }

  if (name === 'mission') {
    // One star, one cruiser, and the beacon close ahead on the same street.
    putPlayerInCar(world, 900, 1120, 0, '#ffcf3f', 320);
    addWanted(world.police, 1, 'stolen car', world.events);
    addPoliceCar(world, 620, 1120, 0);
    world.missions.active = {
      x: 1500, y: 1120, timeLeft: 24, total: 30, reward: 175, name: 'Beach Blitz',
    };
    driveFor(world, pilot, MISSION_SECONDS, true);
    return { screen: 'play' };
  }

  // Title: the autopilot cruises the city behind the start screen.
  putPlayerInCar(world, 960, 800, 0, '#ffcf3f', 240);
  world.missions.cooldown = 0.01;
  driveFor(world, pilot, TITLE_SECONDS, true);
  return { screen: 'title' };
}
