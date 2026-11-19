// Screenshot staging: ?shot=drive|foot|chase|mission positions the world and
// fast-forwards the simulation deterministically, then signals readiness.
// The game itself never depends on this file.

import { makeCar } from './player.js';

function spawnPoliceBehind(S, n) {
  const p = S.player;
  const city = S.city;
  for (let i = 0; i < n; i++) {
    const car = makeCar(
      p.x - Math.cos(p.angle) * (220 + i * 90),
      p.y - Math.sin(p.angle) * (220 + i * 90) + (i % 2 ? 30 : -30),
      p.angle, 'police', '#181818',
    );
    car.maxSpeed = 560;
    car.speed = 260;
    S.cars.push(car);
  }
}

function giveCar(S, x, y, angle, speed) {
  const car = makeCar(x, y, angle, 'player');
  car.speed = speed;
  S.cars.push(car);
  const pl = S.player;
  pl.car = car;
  pl.onFoot = false;
  pl.x = x;
  pl.y = y;
  pl.angle = angle;
  return car;
}

export function stageShot(S, scene, step) {
  const city = S.city;
  const p = S.player;
  S.hudEls.menu.style.display = 'none';
  S.state = 'playing';
  S.audio.setMuted(true);
  const roadX = city.roadsX[5];
  const roadY = city.roadsY[4];
  if (scene === 'foot') {
    p.x = roadX;
    p.y = roadY;
    p.angle = 0;
    p.onFoot = true;
    p.car = null;
    S.wanted = 0;
  } else if (scene === 'drive') {
    giveCar(S, roadX - 260, roadY, 0, 320);
    S.missions.start(S, 0);
    S.wanted = 2;
    S.police.lastCrime = S.time;
    S.police.decayAt = S.time + 999;
    spawnPoliceBehind(S, 2);
    S.missions.beacon = { x: roadX + 1000, y: roadY };
    S.missions.timer = 42;
  } else if (scene === 'chase') {
    giveCar(S, roadX, roadY, 0, 420);
    S.missions.start(S, 2);
    S.wanted = 3;
    S.police.lastCrime = S.time;
    S.police.decayAt = S.time + 999;
    spawnPoliceBehind(S, 3);
    S.missions.beacon = { x: roadX + 900, y: roadY - 280 };
    S.missions.timer = 38;
  } else {
    // mission
    giveCar(S, roadX - 420, roadY, 0, 200);
    S.missions.start(S, 1);
    S.wanted = 1;
    S.police.lastCrime = S.time;
    S.police.decayAt = S.time + 999;
    spawnPoliceBehind(S, 1);
    S.missions.beacon = { x: roadX + 800, y: roadY };
    S.missions.timer = 47;
  }
  // Hold the throttle so staged cars keep rolling while the sim settles.
  S.input.keys.add('KeyW');
  for (let i = 0; i < 40; i++) step(S, 1 / 30);
  S.input.keys.delete('KeyW');
  // Let the renderer paint a couple of frames, then signal the screenshot tool.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotsReady = true;
  }));
}
