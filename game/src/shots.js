// Sunset Keys — screenshot staging: ?shot=drive|foot|chase|mission (+&seed=7).
// Auto-positions the player / cars / police / beacon and fast-forwards the sim
// deterministically so screenshots show the right scene. Sets window.__shotsReady.
import { startMission } from './missions.js';
import { drawCar } from './player.js';

function putPlayerInCar(G, x, y, angle, speed) {
  // reuse the nearest parked car, teleported onto the road
  let car = null;
  for (const c of G.cars) if (c.type === 'parked') { car = c; break; }
  if (!car) {
    car = { x, y, angle, speed: 0, color: '#e74c3c', type: 'parked', health: 100, driver: false };
    G.cars.push(car);
  }
  car.x = x; car.y = y; car.angle = angle; car.speed = speed; car.type = 'player'; car.health = 100;
  const p = G.player;
  p.car = car; p.onFoot = false; p.x = x; p.y = y; p.angle = angle; p.speed = speed;
  return car;
}

function spawnPoliceNear(G, x, y, n, gap) {
  for (let i = 0; i < n; i++) {
    const car = {
      x: x - gap * (i + 1), y: y + (i % 2 === 0 ? 26 : -26),
      angle: 0, speed: 300, color: 'police', type: 'police', health: 100, driver: true,
    };
    G.cars.push(car);
    G.police.push(car);
  }
}

function sim(G, steps, throttle) {
  G.input.up = throttle;
  G.input.keys.add('KeyW');
  for (let i = 0; i < steps; i++) G.step(1 / 60);
  G.input.keys.delete('KeyW');
  G.input.up = false;
}

export function stageShot(G, shot) {
  const p = G.player;
  G.state = 'playing';
  G.hud.hideOverlays();
  if (shot === 'drive') {
    putPlayerInCar(G, 660, 440, 0, 320);
    G.wanted = 2; G.lastCrime = G.time;
    spawnPoliceNear(G, 660, 440, 2, 130);
    startMission(G, 0);
    G.mission.x = 1500; G.mission.y = 440; G.mission.timer = 42; G.mission.total = 42;
    G.hud.toast('Mission 1/5: reach the beacon in 42s — $150');
    sim(G, 50, true);
  } else if (shot === 'foot') {
    p.x = 660; p.y = 440; p.onFoot = true; p.car = null; p.angle = -Math.PI / 2;
    // gather pedestrians + traffic around the intersection
    let pi = 0;
    for (const ped of G.peds) {
      if (pi >= 8) break;
      ped.x = 620 + (pi % 4) * 40; ped.y = 400 + Math.floor(pi / 4) * 70; ped.down = 0;
      pi++;
    }
    let ti = 0;
    for (const c of G.cars) {
      if (c.type !== 'traffic' || ti >= 3) continue;
      c.x = 440 + ti * 130; c.y = 440 + (ti % 2 === 0 ? 14 : -14);
      c.angle = 0; c.dir = 0; c.speed = 140; c.pause = 0;
      ti++;
    }
    sim(G, 40, false);
  } else if (shot === 'chase') {
    putPlayerInCar(G, 880, 660, 0, 470);
    G.wanted = 3; G.lastCrime = G.time;
    spawnPoliceNear(G, 880, 660, 3, 110);
    sim(G, 45, true);
  } else if (shot === 'mission') {
    putPlayerInCar(G, 660, 880, 0, 300);
    G.wanted = 0;
    startMission(G, 1);
    G.mission.x = 1320; G.mission.y = 880; G.mission.timer = 38; G.mission.total = 38;
    G.hud.toast('Mission 2/5: reach the beacon in 38s — $200');
    sim(G, 40, true);
  }
  // one settle render happens in main.js right after this returns
  window.__shotsReady = true;
}

export { drawCar };
