// The player: on foot (walk) and behind the wheel (arcade driving).
// Cars are plain objects in S.cars; the one the player drives has kind 'player'.

import { resolveCircle } from './city.js';

const CAR_COLORS = ['#d94a4a', '#4a7dd9', '#e8c33a', '#7dd94a', '#e8e8e8', '#d97dd9', '#3ad9c9', '#e87d2a'];

export function makeCar(x, y, angle, kind, color) {
  return {
    x, y, angle, speed: 0, kind,
    color: color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    driver: kind === 'traffic',
    health: 100, maxSpeed: 520,
  };
}

export function createPlayer(city) {
  return {
    x: city.roadsX[1], y: city.roadsY[1], angle: -Math.PI / 2,
    onFoot: true, car: null, walkSpeed: 170,
    bustTimer: 0, boxedTimer: 0, disguiseAt: -999,
  };
}

function nearestCar(S, maxDist) {
  let best = null;
  let bd = maxDist;
  for (const c of S.cars) {
    if (c === S.player.car) continue;
    const d = Math.hypot(c.x - S.player.x, c.y - S.player.y);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

export function tryEnterExit(S) {
  const p = S.player;
  if (p.onFoot) {
    const car = nearestCar(S, 70);
    if (!car) {
      S.hud.toast('No car nearby — walk to a parked car or traffic.');
      return;
    }
    if (car.kind === 'traffic' && car.driver) {
      // Carjack: the driver bails and runs, the law notices.
      car.driver = false;
      S.peds.push({
        x: car.x + 26, y: car.y + 10, tx: car.x + 300, ty: car.y + 200,
        speed: 150, state: 'flee', timer: 2.5, color: '#e8d27d', down: 0,
      });
      S.police.crime(S, 1);
      S.hud.toast('Carjacked! The driver ran — the cops noticed.');
      S.audio.chime();
    } else if (car.kind === 'parked') {
      S.police.crime(S, 1);
      S.hud.toast('Hot-wired the car. Wanted +1.');
    }
    car.kind = 'player';
    p.car = car;
    p.onFoot = false;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    car.health = Math.max(car.health, 40);
    S.audio.click();
  } else {
    const car = p.car;
    car.kind = 'parked';
    car.speed = 0;
    p.onFoot = true;
    p.car = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    p.angle = car.angle;
    // A fresh ride is a disguise: drop a star, once per 20s.
    if (S.time - p.disguiseAt > 20 && S.wanted > 0) {
      S.wanted -= 1;
      p.disguiseAt = S.time;
      S.hud.toast('New ride, new look — wanted down a star.');
    }
  }
}

function collideCars(S, car, dt) {
  for (const o of S.cars) {
    if (o === car) continue;
    const dx = car.x - o.x;
    const dy = car.y - o.y;
    const d = Math.hypot(dx, dy);
    const min = 36;
    if (d >= min || d < 0.001) continue;
    const push = (min - d) / 2;
    const nx = dx / d;
    const ny = dy / d;
    car.x += nx * push;
    car.y += ny * push;
    if (o.kind === 'traffic' || o.kind === 'parked') {
      o.x -= nx * push;
      o.y -= ny * push;
    }
    const impact = Math.abs(car.speed) + Math.abs(o.speed || 0);
    if (impact > 140) {
      car.speed *= 0.55;
      if (o.kind === 'traffic') o.speed *= 0.4;
      if (car.health > 0 && impact > 260) {
        car.health -= Math.round((impact - 260) / 12);
        S.audio.thud();
        S.fx.push({ x: car.x, y: car.y, vx: 0, vy: 0, life: 0.4, color: '#ffd94a', size: 14 });
      }
      if (o.kind === 'police' && S.time - (S.lastRamCrime || -999) > 3) {
        S.lastRamCrime = S.time;
        S.police.crime(S, 1);
        S.hud.toast('You rammed a cop car! Wanted +1.');
      }
    }
  }
}

export function updatePlayer(S, dt) {
  const p = S.player;
  const input = S.input;
  if (p.onFoot) {
    const mv = input.moveVector();
    p.x += mv.x * p.walkSpeed * dt;
    p.y += mv.y * p.walkSpeed * dt;
    if (mv.x !== 0 || mv.y !== 0) p.angle = Math.atan2(mv.y, mv.x);
    resolveCircle(S.city, p, 14);
    return;
  }
  const car = p.car;
  const spd = car.speed;
  const dir = spd >= 0 ? 1 : -1;
  // Steering is speed-sensitive: twitchy at low speed, steady at high speed.
  const steerInput = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const steerRate = 2.6 - Math.min(1.5, Math.abs(spd) / 520 * 1.5);
  car.angle += steerInput * steerRate * dir * dt * (input.handbrake ? 1.5 : 1);
  if (input.up) car.speed += 430 * dt;
  if (input.down) car.speed -= spd > 20 ? 620 * dt : 260 * dt;
  if (!input.up && !input.down) car.speed -= car.speed * 0.7 * dt;
  if (input.handbrake) car.speed -= car.speed * 3.2 * dt;
  car.speed = Math.max(-170, Math.min(car.maxSpeed, car.speed));
  if (Math.abs(car.speed) < 4 && !input.up && !input.down) car.speed = 0;
  const ox = car.x;
  const oy = car.y;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (resolveCircle(S.city, car, 20)) {
    // Scraped a building: lose speed, take damage on hard hits.
    if (Math.abs(car.speed) > 240) {
      car.health -= Math.round((Math.abs(car.speed) - 240) / 18);
      S.audio.thud();
      S.fx.push({ x: car.x, y: car.y, vx: 0, vy: 0, life: 0.4, color: '#ffd94a', size: 12 });
    }
    car.speed *= 0.45;
    car.x = ox + (car.x - ox) * 0.3;
    car.y = oy + (car.y - oy) * 0.3;
    resolveCircle(S.city, car, 20);
  }
  collideCars(S, car, dt);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  // Run over a pedestrian: a crime, and the ped goes down.
  for (const ped of S.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 26 && Math.abs(car.speed) > 60) {
      ped.state = 'down';
      ped.timer = 4;
      S.police.crime(S, 1);
      S.audio.thud();
      S.hud.toast('You hit a pedestrian! Wanted +1.');
      car.speed *= 0.7;
    }
  }
  if (car.health <= 0) S.police.wasted(S);
}

export function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-22, -10 + 5, 44, 22);
  // Body.
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-22, -11, 44, 22, 7);
  ctx.fill();
  // Windshield + rear window.
  ctx.fillStyle = 'rgba(20,30,45,0.9)';
  ctx.fillRect(6, -8, 8, 16);
  ctx.fillRect(-16, -8, 6, 16);
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(20, -9, 3, 4);
  ctx.fillRect(20, 5, 3, 4);
  if (car.kind === 'police') {
    // Black-and-white cruiser with a flashing light bar.
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-6, -11, 14, 22);
    ctx.fillStyle = '#181818';
    ctx.fillRect(6, -11, 16, 22);
    const flash = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2a2a' : '#2a6aff';
    ctx.fillRect(-2, -13, 5, 4);
    ctx.fillStyle = flash ? '#2a6aff' : '#ff2a2a';
    ctx.fillRect(-2, 9, 5, 4);
  }
  ctx.restore();
}

export function drawPlayer(ctx, S) {
  const p = S.player;
  if (!p.onFoot) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 12, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff5a3c';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd94a';
  ctx.beginPath();
  ctx.arc(7, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
