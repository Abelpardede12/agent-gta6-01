// Sunset Keys — player on foot + driving, enter/exit cars, collisions.
import { collideBuildings, WORLD_W, WORLD_H } from './city.js';

export const WALK_SPEED = 170;
export const CAR_TOP_SPEED = 520;
export const CAR_ACCEL = 520;
export const CAR_REVERSE_MAX = 190;

export function createPlayer(spawn) {
  return {
    x: spawn.x, y: spawn.y, angle: -Math.PI / 2, speed: 0,
    onFoot: true, car: null, lastCar: null, walkAngle: -Math.PI / 2,
  };
}

const CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#ecf0f1', '#fd79a8', '#00cec9'];

export function spawnParkedCars(G, rng, n) {
  for (let i = 0; i < n; i++) {
    const vertical = rng() < 0.5;
    const line = Math.floor(rng() * 14) * 220;
    const along = 60 + rng() * 1900;
    const off = (rng() < 0.5 ? -1 : 1) * 20;
    G.cars.push({
      x: vertical ? line + off : along,
      y: vertical ? along : line + off,
      angle: vertical ? (off > 0 ? Math.PI / 2 : -Math.PI / 2) : (off > 0 ? 0 : Math.PI),
      speed: 0, color: CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)],
      type: 'parked', health: 100, driver: false,
    });
  }
}

export function nearestCar(G, x, y, maxD) {
  let best = null, bd = maxD;
  for (const c of G.cars) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function tryEnterExit(G) {
  const p = G.player;
  if (p.onFoot) {
    const car = nearestCar(G, p.x, p.y, 70);
    if (!car) return false;
    if (car.type === 'traffic' && car.driver) {
      // carjack: eject the driver, they flee on foot
      G.peds.push({ x: car.x + 24, y: car.y, angle: 0, speed: 0, flee: 2.5, color: '#ffd32a', down: 0 });
      car.driver = false;
      addWanted(G, 1);
      G.hud.toast('You jacked a car! Wanted +1');
    } else if (car.type === 'police') {
      addWanted(G, 2);
      G.hud.toast('You stole a cop car! Wanted +2');
    }
    car.type = 'player';
    p.car = car;
    p.onFoot = false;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    // disguise: entering a different car drops a star (20s cooldown)
    if (G.lastCar && G.lastCar !== car && G.wanted > 0 && G.disguiseCd <= 0) {
      G.wanted = Math.max(0, G.wanted - 1);
      G.disguiseCd = 20;
      G.hud.toast('New wheels, less heat. Wanted -1');
    }
    return true;
  }
  // exit
  const car = p.car;
  car.type = 'parked';
  car.speed = 0;
  G.lastCar = car;
  const px = car.x + Math.cos(car.angle + Math.PI / 2) * 26;
  const py = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
  p.x = px; p.y = py; p.car = null; p.onFoot = true; p.speed = 0;
  return true;
}

export function addWanted(G, n) {
  G.wanted = Math.min(5, G.wanted + n);
  G.lastCrime = G.time;
}

function updateOnFoot(G, dt) {
  const p = G.player, inp = G.input;
  let mx = 0, my = 0;
  if (inp.up) my -= 1;
  if (inp.down) my += 1;
  if (inp.left) mx -= 1;
  if (inp.right) mx += 1;
  if (inp.joy.active) { mx = inp.joy.x; my = inp.joy.y; }
  const len = Math.hypot(mx, my);
  if (len > 0.01) {
    mx /= Math.max(1, len); my /= Math.max(1, len);
    p.x += mx * WALK_SPEED * dt;
    p.y += my * WALK_SPEED * dt;
    p.walkAngle = Math.atan2(my, mx);
    p.angle = p.walkAngle;
  }
  p.x = Math.max(14, Math.min(WORLD_W - 14, p.x));
  p.y = Math.max(14, Math.min(WORLD_H - 14, p.y));
  collideBuildings(G.city, p, 13);
}

function updateDriving(G, dt) {
  const p = G.player, car = p.car, inp = G.input;
  const fwd = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  const speed = car.speed;
  // throttle
  if (inp.throttle > 0) car.speed += CAR_ACCEL * inp.throttle * dt;
  else if (inp.throttle < 0) {
    if (speed > 20) car.speed -= CAR_ACCEL * 0.9 * dt; // brake
    else car.speed += CAR_ACCEL * 0.45 * inp.throttle * dt; // reverse
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt); // drag
  }
  if (inp.handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 700 * dt);
  car.speed = Math.max(-CAR_REVERSE_MAX, Math.min(CAR_TOP_SPEED, car.speed));
  // steering, speed-sensitive
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 140) * (car.speed < 0 ? -1 : 1);
  car.angle += inp.steer * 2.6 * steerAuthority * dt * (inp.handbrake ? 1.5 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(20, Math.min(WORLD_W - 20, car.x));
  car.y = Math.max(20, Math.min(WORLD_H - 20, car.y));
  if (collideBuildings(G.city, car, 16)) {
    if (Math.abs(car.speed) > 200) {
      car.health -= 6;
      G.audio.thud();
      G.hud.toast('Crash! Car damaged');
    }
    car.speed *= 0.4;
  }
  p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
  // hit pedestrians?
  if (Math.abs(car.speed) > 110) {
    for (const ped of G.peds) {
      if (ped.down > 0) continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 22) {
        ped.down = 2.2; ped.flee = 3;
        addWanted(G, 1);
        G.audio.thud();
        G.hud.toast('You hit a pedestrian! Wanted +1');
      }
    }
  }
  // wasted?
  if (car.health <= 0) {
    G.cars.splice(G.cars.indexOf(car), 1);
    p.car = null; p.onFoot = true; p.speed = 0;
    p.x = car.x; p.y = car.y;
    G.mission = null;
    G.audio.thud();
    gameOver(G, 'wasted');
  }
}

export function updatePlayer(G, dt) {
  if (G.player.onFoot) updateOnFoot(G, dt);
  else updateDriving(G, dt);
}

export function gameOver(G, kind) {
  G.state = kind; // 'busted' | 'wasted'
  G.over = { kind, at: G.time };
  if (kind === 'busted') {
    G.cash = Math.floor(G.cash / 2);
    G.wanted = 0;
    G.police.length = 0;
    G.cars = G.cars.filter((c) => c.type !== 'police');
    const p = G.player;
    if (p.car) { p.car.type = 'parked'; p.car.speed = 0; }
    p.x = G.spawn.x; p.y = G.spawn.y; p.onFoot = true; p.car = null; p.speed = 0;
    G.bustedHold = 0; G.boxedT = 0;
  }
  if (G.saveGame) G.saveGame(G);
  G.hud.showOver(kind);
}

// ---- drawing ----

export function drawCar(ctx, car, t) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = 44, h = 22;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  ctx.fillStyle = car.type === 'police' ? '#f5f6fa' : car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 7);
  ctx.fill();
  if (car.type === 'police') {
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(-4, -h / 2, 8, h);
    // light bar
    const blink = Math.floor(t * 0.008) % 2 === 0;
    ctx.fillStyle = blink ? '#e84118' : '#0097e6';
    ctx.fillRect(-6, -h / 2 - 3, 5, 4);
    ctx.fillStyle = blink ? '#0097e6' : '#e84118';
    ctx.fillRect(1, -h / 2 - 3, 5, 4);
  }
  ctx.fillStyle = '#2d3436';
  ctx.fillRect(-2, -h / 2 + 3, 12, h - 6); // windshield
  ctx.fillStyle = '#dfe6e9';
  ctx.fillRect(w / 2 - 6, -h / 2 + 2, 3, 5);
  ctx.fillRect(w / 2 - 6, h / 2 - 7, 3, 5);
  // headlights
  ctx.fillStyle = 'rgba(255,240,180,0.9)';
  ctx.fillRect(w / 2 - 2, -h / 2 + 3, 3, 4);
  ctx.fillRect(w / 2 - 2, h / 2 - 7, 3, 4);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawPlayer(ctx, G, t) {
  const p = G.player;
  if (!p.onFoot) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 4, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
  // body
  ctx.fillStyle = '#ff6b81';
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2f3542';
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  // direction tick
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(p.angle) * 15, Math.sin(p.angle) * 15); ctx.stroke();
  ctx.restore();
}
