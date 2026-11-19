// Sunset Keys — wanted stars, police spawn/chase, busted logic.
import { roadPointNear, collideBuildings } from './city.js';
import { gameOver } from './player.js';

export function updatePolice(G, dt) {
  const p = G.player;
  // decay: no crime for 12s and no police nearby -> lose a star every 6s
  if (G.wanted > 0 && G.time - G.lastCrime > 12) {
    let near = false;
    for (const c of G.police) {
      if (Math.hypot(c.x - p.x, c.y - p.y) < 500) { near = true; break; }
    }
    if (!near) {
      G.decayT = (G.decayT || 0) + dt;
      if (G.decayT >= 6) { G.decayT = 0; G.wanted = Math.max(0, G.wanted - 1); }
    } else G.decayT = 0;
  } else G.decayT = 0;
  if (G.disguiseCd > 0) G.disguiseCd -= dt;

  // spawn up to 1 + stars cruisers
  const want = G.wanted > 0 ? Math.min(1 + G.wanted, 4) : 0;
  while (G.police.length < want) {
    const spot = roadPointNear(G.rng, p.x, p.y, 520, 900);
    const car = {
      x: spot.x, y: spot.y, angle: 0, speed: 0,
      color: 'police', type: 'police', health: 100, driver: true,
    };
    G.cars.push(car);
    G.police.push(car);
  }
  // despawn when clean
  if (G.wanted === 0 && G.police.length > 0) {
    for (const c of G.police) G.cars.splice(G.cars.indexOf(c), 1);
    G.police.length = 0;
  }

  // chase
  let touchingFoot = false;
  let boxing = 0;
  for (const c of G.police) {
    const dx = p.x - c.x, dy = p.y - c.y;
    const d = Math.hypot(dx, dy) || 1;
    const target = Math.atan2(dy, dx);
    let diff = target - c.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    c.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
    const wantSpeed = d > 260 ? 545 : 470;
    c.speed += (wantSpeed - c.speed) * Math.min(1, dt * 1.5);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    collideBuildings(G.city, c, 16);
    // ram the player's car
    if (!p.onFoot && p.car) {
      const cd = Math.hypot(c.x - p.car.x, c.y - p.car.y);
      if (cd < 36) {
        p.car.health -= 9 * dt;
        p.car.speed *= (1 - 0.6 * dt);
        c.speed *= 0.92;
        if (Math.abs(c.speed) > 200) G.audio.thud();
        if (p.car.health <= 0) {
          G.cars.splice(G.cars.indexOf(p.car), 1);
          p.car = null; p.onFoot = true; p.speed = 0;
          G.mission = null;
          gameOver(G, 'wasted');
          return;
        }
      }
      if (cd < 70 && Math.abs(p.car.speed) < 30) boxing++;
    } else if (p.onFoot) {
      if (d < 30) touchingFoot = true;
    }
  }
  // busted: cop touches player on foot ~1.2s cumulative
  if (touchingFoot) {
    G.bustedHold = (G.bustedHold || 0) + dt;
    if (G.bustedHold >= 1.2) { gameOver(G, 'busted'); return; }
  } else G.bustedHold = Math.max(0, (G.bustedHold || 0) - dt * 2);
  // busted: boxed in at low speed for 3s
  if (!p.onFoot && boxing >= 2) {
    G.boxedT = (G.boxedT || 0) + dt;
    if (G.boxedT >= 3) { gameOver(G, 'busted'); return; }
  } else G.boxedT = 0;
}

export function drawPolice(ctx, G, t) {
  // light glow above police cars is drawn with the car itself in player.js
  void ctx; void G; void t;
}
