// Wanted stars and the police who answer them: cruisers spawn, chase, ram,
// and bust the player when they catch him.

import { makeCar } from './player.js';
import { nearestRoad, resolveCircle } from './city.js';

export function createPolice() {
  return {
    lastCrime: -999,
    decayAt: 0,
    bustFlash: 0,
  };
}

export function crime(S, n) {
  S.wanted = Math.min(5, S.wanted + n);
  S.police.lastCrime = S.time;
  S.police.decayAt = S.time + 12;
}

function spawnCruiser(S) {
  const city = S.city;
  const p = S.player;
  // Spawn on a road just out of view, near the player.
  const vertical = Math.random() < 0.5;
  const road = vertical
    ? nearestRoad(city, 'x', p.x + (Math.random() < 0.5 ? -700 : 700))
    : nearestRoad(city, 'y', p.y + (Math.random() < 0.5 ? -700 : 700));
  const car = makeCar(
    vertical ? road : Math.max(80, Math.min(city.W - 80, p.x + (Math.random() - 0.5) * 900)),
    vertical ? Math.max(80, Math.min(city.H - 320, p.y + (Math.random() - 0.5) * 900)) : road,
    0, 'police', '#181818',
  );
  car.maxSpeed = 560;
  car.speed = 200;
  S.cars.push(car);
  S.audio.setSiren(true);
}

function policeCount(S) {
  let n = 0;
  for (const c of S.cars) if (c.kind === 'police') n++;
  return n;
}

export function busted(S) {
  S.state = 'busted';
  S.cash = Math.floor(S.cash / 2);
  S.save();
  S.audio.setSiren(false);
  S.audio.setEngine(0, false);
  S.hud.showBusted();
}

export function wasted(S) {
  const p = S.player;
  const car = p.car;
  S.fx.push({ x: car.x, y: car.y, vx: 0, vy: 0, life: 0.8, color: '#ff7a2a', size: 60 });
  S.fx.push({ x: car.x, y: car.y, vx: 0, vy: 0, life: 0.6, color: '#ffd94a', size: 40 });
  S.cars.splice(S.cars.indexOf(car), 1);
  p.car = null;
  p.onFoot = true;
  p.x = car.x + 40;
  p.y = car.y + 40;
  p.angle = 0;
  S.missions.resetCurrent(S);
  S.audio.thud();
  S.hud.toast('WASTED — your ride is scrap. Mission progress lost.');
}

export function updatePolice(S, dt) {
  const p = S.player;
  // Spawn up to 1 + stars cruisers.
  if (S.wanted >= 1 && policeCount(S) < 1 + S.wanted) {
    if (Math.random() < dt * 1.2) spawnCruiser(S);
  }
  // Wanted decays after 12 quiet seconds with no cruiser in view.
  if (S.wanted > 0 && S.time > S.police.decayAt) {
    let near = false;
    for (const c of S.cars) {
      if (c.kind === 'police' && Math.hypot(c.x - p.x, c.y - p.y) < 420) {
        near = true;
        break;
      }
    }
    if (!near) {
      S.wanted -= 1;
      S.police.decayAt = S.time + 4;
      if (S.wanted === 0) S.hud.toast('You lost them. Wanted clear.');
    }
  }
  if (policeCount(S) === 0) S.audio.setSiren(false);

  let touching = false;
  let boxing = false;
  for (const car of S.cars) {
    if (car.kind !== 'police') continue;
    // Chase: steer toward the player, faster than his top speed.
    const tx = p.x - car.x;
    const ty = p.y - car.y;
    const dist = Math.max(1, Math.hypot(tx, ty));
    const want = Math.atan2(ty, tx);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
    car.speed = Math.min(car.maxSpeed, car.speed + 380 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (resolveCircle(S.city, car, 20)) car.speed *= 0.5;
    // Ram the player's car.
    if (!p.onFoot && p.car) {
      const d = Math.hypot(car.x - p.car.x, car.y - p.car.y);
      if (d < 38) {
        const push = (38 - d) / 2;
        const nx = (p.car.x - car.x) / Math.max(1, d);
        const ny = (p.car.y - car.y) / Math.max(1, d);
        p.car.x += nx * push;
        p.car.y += ny * push;
        p.car.speed *= 0.92;
        if (Math.abs(car.speed) > 260 && Math.random() < dt * 2.5) {
          p.car.health -= 1;
          S.audio.thud();
          S.fx.push({ x: p.car.x, y: p.car.y, vx: 0, vy: 0, life: 0.3, color: '#ffd94a', size: 12 });
        }
        if (Math.abs(p.car.speed) < 40) boxing = true;
      }
    } else if (dist < 34) {
      touching = true;
    }
  }
  // Busted: a cruiser holds the player on foot, or boxes his car in.
  if (S.state !== 'playing') return;
  if (p.onFoot && touching) {
    p.bustTimer += dt;
    S.police.bustFlash = S.time;
    if (p.bustTimer >= 1.2) {
      S.hud.toast('BUSTED!');
      busted(S);
      return;
    }
  } else {
    p.bustTimer = Math.max(0, p.bustTimer - dt * 2);
  }
  if (!p.onFoot && boxing) {
    p.boxedTimer += dt;
    if (p.boxedTimer >= 3) {
      S.hud.toast('BUSTED — boxed in!');
      busted(S);
      return;
    }
  } else {
    p.boxedTimer = Math.max(0, p.boxedTimer - dt * 2);
  }
}
