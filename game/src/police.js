// The wanted system and the police who answer it. Crimes raise the heat; clean driving lets
// it fade, one star at a time. While any star is lit, cruisers spawn at the edge of the action
// and hunt the player along the street grid, re-routing every half second; when the heat is
// gone they peel off and drive away. A cruiser that catches the player on foot makes the bust.

import { POLICE, WANTED_DECAY_SECONDS, WANTED_MAX } from './config.js';
import { randomRoadPoint, routeTo } from './city.js';
import { createCar, stepCar } from './player.js';

export function createPolice() {
  return {
    cars: [],
    wanted: 0,
    decayTimer: 0,
    spawnTimer: 0,
    // The siren wails while any star is lit; the HUD flashes the stars with it.
    sirenPhase: 0,
  };
}

/** A crime just happened: raise the heat, reset the cool-down, and remember what it was. */
export function addWanted(police, amount, reason, events) {
  const before = police.wanted;
  police.wanted = Math.min(WANTED_MAX, police.wanted + amount);
  police.decayTimer = WANTED_DECAY_SECONDS;
  if (police.wanted > before) {
    events.push({ type: 'wanted', wanted: police.wanted, reason });
  }
}

/** How many cruisers the current heat calls for: one, then another every two stars. */
export function wantedCruisers(wanted) {
  if (wanted === 0) return 0;
  return Math.min(POLICE.maxActive, 1 + Math.floor(wanted / 2));
}

function spawnCruiser(police, rng, player) {
  const spot = randomRoadPoint(rng, player.x, player.y, POLICE.spawnDistance - 160, POLICE.spawnDistance + 260);
  const car = createCar('#2b4acb', spot.x, spot.y, 0);
  car.isPolice = true;
  car.route = [];
  car.routeTimer = 0;
  car.ramTimer = 0;
  car.lightPhase = rng() * Math.PI * 2;
  police.cars.push(car);
  return car;
}

export function stepPolice(police, dt, rng, player, city, events) {
  police.sirenPhase += dt;
  // Clean driving cools the heat off, one star per quiet stretch.
  if (police.wanted > 0) {
    police.decayTimer -= dt;
    if (police.decayTimer <= 0) {
      police.wanted -= 1;
      police.decayTimer = WANTED_DECAY_SECONDS;
      events.push({ type: 'wanted', wanted: police.wanted, reason: 'cooling off' });
    }
  }

  const wantedCount = wantedCruisers(police.wanted);
  police.spawnTimer -= dt;
  if (police.cars.length < wantedCount && police.spawnTimer <= 0) {
    spawnCruiser(police, rng, player);
    police.spawnTimer = 1.2;
  }

  const px = player.onFoot ? player.x : player.car.x;
  const py = player.onFoot ? player.y : player.car.y;

  for (let i = police.cars.length - 1; i >= 0; i -= 1) {
    const car = police.cars[i];
    car.ramTimer -= dt;
    car.lightPhase += dt * 9;
    car.routeTimer -= dt;
    const distToPlayer = Math.hypot(px - car.x, py - car.y);

    if (police.wanted === 0) {
      // Heat's gone: drive to the nearest edge of the map and leave.
      if (car.routeTimer <= 0 || car.route.length === 0) {
        const edge = { x: car.x < 1280 ? -80 : 2640, y: car.y };
        car.route = routeTo(car.x, car.y, edge.x, edge.y);
        car.routeTimer = 2;
      }
      if (distToPlayer > 980) {
        police.cars.splice(i, 1);
        continue;
      }
    } else if (car.routeTimer <= 0 || car.route.length === 0) {
      // Re-route to the player twice a second; close in, aim straight at them.
      car.route = distToPlayer < 320 ? [] : routeTo(car.x, car.y, px, py);
      car.routeTimer = 0.5;
    }

    const target = car.route.length > 0 ? car.route[0] : { x: px, y: py };
    if (car.route.length > 0 && Math.hypot(target.x - car.x, target.y - car.y) < 60) {
      car.route.shift();
    }
    const dx = target.x - car.x;
    const dy = target.y - car.y;
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.abs(diff) < 0.12 ? 0 : Math.sign(diff);
    const maxSpeed = POLICE.chaseSpeed + POLICE.chasePerStar * police.wanted;
    const input = {
      up: Math.abs(diff) < 2.3,
      down: Math.abs(diff) > 2.8,
      left: steer < 0,
      right: steer > 0,
    };
    stepCar(car, input, dt, city);
    if (Math.abs(car.speed) > maxSpeed) {
      const s = maxSpeed / Math.abs(car.speed);
      car.vx *= s;
      car.vy *= s;
      car.speed = Math.sign(car.speed) * maxSpeed;
    }

    // A ram: a cruiser touching the player's car damages it; touching the player on foot
    // ends the run with a bust.
    if (distToPlayer < 36 && car.ramTimer <= 0) {
      car.ramTimer = POLICE.ramCooldown;
      if (player.onFoot) {
        events.push({ type: 'busted' });
      } else {
        events.push({ type: 'rammed', damage: POLICE.ramDamage });
        // Shove the player's car so the hit is felt, not just counted.
        player.car.vx += ((player.car.x - car.x) / Math.max(1, distToPlayer)) * 260;
        player.car.vy += ((player.car.y - car.y) / Math.max(1, distToPlayer)) * 260;
        car.vx *= 0.4;
        car.vy *= 0.4;
      }
    }
  }
}
