// Sunset Keys — traffic cars + pedestrians.
import { randomRoadPoint, BLOCK, WORLD_W, WORLD_H } from './city.js';

const TRAFFIC_COLORS = ['#e17055', '#0984e3', '#fdcb6e', '#00b894', '#6c5ce7', '#d63031', '#e84393', '#00cec9', '#dfe6e9', '#f0932b'];
const PED_COLORS = ['#ffd32a', '#ff7f50', '#70a1ff', '#7bed9f', '#eccc68', '#ff6b81', '#a29bfe', '#f8c291'];

export function createTraffic(G, rng) {
  G.cars = G.cars.filter((c) => c.type !== 'traffic');
  for (let i = 0; i < 14; i++) {
    const p = randomRoadPoint(rng);
    const vertical = rng() < 0.5;
    const dir = Math.floor(rng() * 4); // 0=E 1=S 2=W 3=N
    const angle = [0, Math.PI / 2, Math.PI, -Math.PI / 2][dir];
    // snap onto a road line
    const x = vertical ? Math.round(p.x / BLOCK) * BLOCK + (rng() < 0.5 ? 14 : -14) : p.x;
    const y = vertical ? p.y : Math.round(p.y / BLOCK) * BLOCK + (rng() < 0.5 ? 14 : -14);
    G.cars.push({
      x, y, angle, speed: 0,
      targetSpeed: 110 + rng() * 90,
      color: TRAFFIC_COLORS[Math.floor(rng() * TRAFFIC_COLORS.length)],
      type: 'traffic', health: 100, driver: true,
      dir, pause: 0, turnCd: 0, stoppedAt: 0,
    });
  }
  G.peds = [];
  for (let i = 0; i < 24; i++) {
    const p = randomRoadPoint(rng);
    const vertical = rng() < 0.5;
    const off = (rng() < 0.5 ? -1 : 1) * 38;
    G.peds.push({
      x: vertical ? Math.round(p.x / BLOCK) * BLOCK + off : p.x,
      y: vertical ? p.y : Math.round(p.y / BLOCK) * BLOCK + off,
      angle: Math.floor(rng() * 4) * (Math.PI / 2),
      speed: 28 + rng() * 22,
      flee: 0, down: 0,
      color: PED_COLORS[Math.floor(rng() * PED_COLORS.length)],
    });
  }
}

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

function nearIntersection(c) {
  const ix = Math.round(c.x / BLOCK) * BLOCK;
  const iy = Math.round(c.y / BLOCK) * BLOCK;
  return Math.hypot(c.x - ix, c.y - iy) < 10 ? { ix, iy } : null;
}

function updateTrafficCar(G, c, dt, rng) {
  if (c.pause > 0) {
    c.pause -= dt;
    c.speed = Math.max(0, c.speed - 300 * dt);
    return;
  }
  c.speed += (c.targetSpeed - c.speed) * Math.min(1, dt * 1.2);
  const inter = nearIntersection(c);
  if (inter && c.turnCd <= 0) {
    c.turnCd = 1.2;
    const r = rng();
    if (r < 0.16) {
      c.pause = 0.6 + rng() * 1.6; // stop briefly at the intersection
    } else if (r < 0.42) {
      // turn left or right
      const turn = rng() < 0.5 ? 1 : 3;
      c.dir = (c.dir + turn) % 4;
      c.angle = [0, Math.PI / 2, Math.PI, -Math.PI / 2][c.dir];
      c.x = inter.ix; c.y = inter.iy;
    }
    // else go straight
  }
  c.turnCd -= dt;
  const d = DIRS[c.dir];
  c.x += d[0] * c.speed * dt;
  c.y += d[1] * c.speed * dt;
  // stay in the drivable area (roads end at the beach)
  if (c.y > 2050) { c.dir = 0; c.angle = 0; c.y = 2050; }
  if (c.x < 20) { c.dir = 1; c.angle = Math.PI / 2; c.x = 20; }
  if (c.x > WORLD_W - 20) { c.dir = 3; c.angle = -Math.PI / 2; c.x = WORLD_W - 20; }
  if (c.y < 20) { c.dir = 2; c.angle = Math.PI; c.y = 20; }
  // keep on the road line: nudge lateral drift back
  if (c.dir === 0 || c.dir === 2) {
    const line = Math.round(c.y / BLOCK) * BLOCK + (c.dir === 0 ? 14 : -14);
    c.y += (line - c.y) * Math.min(1, dt * 4);
  } else {
    const line = Math.round(c.x / BLOCK) * BLOCK + (c.dir === 1 ? -14 : 14);
    c.x += (line - c.x) * Math.min(1, dt * 4);
  }
}

function updatePed(G, ped, dt, rng) {
  if (ped.down > 0) { ped.down -= dt; return; }
  const p = G.player;
  const pd = Math.hypot(ped.x - p.x, ped.y - p.y);
  const carNear = !p.onFoot && p.car && Math.hypot(ped.x - p.car.x, ped.y - p.car.y) < 110 && Math.abs(p.car.speed) > 60;
  if (pd < 90 || carNear) ped.flee = 1.2;
  let speed = ped.speed;
  if (ped.flee > 0) {
    ped.flee -= dt;
    speed = 210;
    // run away from the player
    const away = Math.atan2(ped.y - p.y, ped.x - p.x);
    ped.angle = away;
  } else if (rng() < dt * 0.08) {
    // wander: sometimes turn at an intersection
    const inter = nearIntersection(ped);
    if (inter) ped.angle = Math.floor(rng() * 4) * (Math.PI / 2);
  }
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;
  ped.x = Math.max(16, Math.min(WORLD_W - 16, ped.x));
  ped.y = Math.max(16, Math.min(WORLD_H - 16, ped.y));
  if (ped.x <= 16 || ped.x >= WORLD_W - 16) ped.angle = Math.PI - ped.angle;
  if (ped.y <= 16 || ped.y >= WORLD_H - 16) ped.angle = -ped.angle;
}

export function updateTraffic(G, dt) {
  const rng = G.rng;
  for (const c of G.cars) if (c.type === 'traffic') updateTrafficCar(G, c, dt, rng);
  for (const ped of G.peds) updatePed(G, ped, dt, rng);
  // simple car-car collision: player car vs traffic, traffic vs traffic
  const cars = G.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (a.type === 'police' || b.type === 'police') continue; // police ram handled in police.js
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 34 && d > 0.01) {
        const push = (34 - d) / 2;
        const nx = dx / d, ny = dy / d;
        const aMove = a.type === 'parked' ? 0 : 1;
        const bMove = b.type === 'parked' ? 0 : 1;
        a.x -= nx * push * aMove; a.y -= ny * push * aMove;
        b.x += nx * push * bMove; b.y += ny * push * bMove;
        const rel = Math.abs(a.speed - b.speed);
        if ((a.type === 'player' || b.type === 'player') && rel > 140) {
          const pc = a.type === 'player' ? a : b;
          pc.health -= 5;
          G.audio.thud();
        }
        a.speed *= 0.7; b.speed *= 0.7;
      }
    }
  }
}

export function drawTraffic(ctx, G) {
  for (const ped of G.peds) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.down > 0) {
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.fillStyle = ped.color;
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(1, 3, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2f3542';
      ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}
