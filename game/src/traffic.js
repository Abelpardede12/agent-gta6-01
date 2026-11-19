// Traffic cars looping the street grid, and pedestrians on the sidewalks.

import { makeCar } from './player.js';
import { nearestRoad, resolveCircle } from './city.js';

const PED_COLORS = ['#e8d27d', '#7dd9a0', '#d97da0', '#a0c8e8', '#e8a07d', '#c9a0e8'];

export function createTraffic(city, count = 14) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = Math.random() < 0.5;
    const road = vertical
      ? city.roadsX[Math.floor(Math.random() * city.roadsX.length)]
      : city.roadsY[Math.floor(Math.random() * city.roadsY.length)];
    const dir = Math.random() < 0.5 ? 1 : -1;
    const along = 100 + Math.random() * (vertical ? city.H - 400 : city.W - 400);
    const lane = 14;
    const car = makeCar(
      vertical ? road + (dir > 0 ? lane : -lane) : along,
      vertical ? along : road + (dir > 0 ? lane : -lane),
      vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      'traffic',
    );
    car.axis = vertical ? 'v' : 'h';
    car.road = road;
    car.dir = dir;
    car.maxSpeed = 110 + Math.random() * 90;
    car.speed = car.maxSpeed;
    car.pause = 0;
    car.turnAt = 0;
    cars.push(car);
  }
  return cars;
}

export function createParked(city, count = 10) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = Math.random() < 0.5;
    const road = vertical
      ? city.roadsX[Math.floor(Math.random() * city.roadsX.length)]
      : city.roadsY[Math.floor(Math.random() * city.roadsY.length)];
    const along = 200 + Math.random() * (vertical ? city.H - 700 : city.W - 700);
    const side = Math.random() < 0.5 ? -48 : 48;
    const car = makeCar(
      vertical ? road + side : along,
      vertical ? along : road + side,
      vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI),
      'parked',
    );
    car.driver = false;
    cars.push(car);
  }
  return cars;
}

export function createPeds(city, count = 24) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const road = city.roadsX[Math.floor(Math.random() * city.roadsX.length)];
    const y = 120 + Math.random() * (city.H - 500);
    peds.push({
      x: road + (Math.random() < 0.5 ? -46 : 46), y,
      tx: road, ty: y, speed: 45 + Math.random() * 35,
      state: 'walk', timer: 0,
      color: PED_COLORS[Math.floor(Math.random() * PED_COLORS.length)], down: 0,
    });
  }
  return peds;
}

function pickPedTarget(city, ped) {
  const vertical = Math.random() < 0.5;
  if (vertical) {
    const road = city.roadsX[Math.floor(Math.random() * city.roadsX.length)];
    ped.tx = road + (Math.random() < 0.5 ? -46 : 46);
    ped.ty = Math.max(100, Math.min(city.H - 320, ped.y + (Math.random() - 0.5) * 700));
  } else {
    const road = city.roadsY[Math.floor(Math.random() * city.roadsY.length)];
    ped.tx = Math.max(100, Math.min(city.W - 100, ped.x + (Math.random() - 0.5) * 700));
    ped.ty = road + (Math.random() < 0.5 ? -46 : 46);
  }
}

export function updateTraffic(S, dt) {
  const city = S.city;
  for (const car of S.cars) {
    if (car.kind !== 'traffic') continue;
    if (car.pause > 0) {
      car.pause -= dt;
      car.speed = 0;
      continue;
    }
    car.speed = car.maxSpeed;
    if (car.axis === 'v') {
      car.y += car.dir * car.speed * dt;
      car.x = car.road + (car.dir > 0 ? 14 : -14);
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (car.y < 60) { car.y = 60; car.dir = 1; }
      if (car.y > city.H - 300) { car.y = city.H - 300; car.dir = -1; }
      const cross = nearestRoad(city, 'y', car.y);
      if (Math.abs(car.y - cross) < 7 && S.time - car.turnAt > 2 && Math.random() < 0.35) {
        car.axis = 'h';
        car.road = cross;
        car.y = cross + (Math.random() < 0.5 ? 14 : -14);
        car.dir = Math.random() < 0.5 ? 1 : -1;
        car.turnAt = S.time;
      }
    } else {
      car.x += car.dir * car.speed * dt;
      car.y = car.road + (car.dir > 0 ? 14 : -14);
      car.angle = car.dir > 0 ? 0 : Math.PI;
      if (car.x < 60) { car.x = 60; car.dir = 1; }
      if (car.x > city.W - 60) { car.x = city.W - 60; car.dir = -1; }
      const cross = nearestRoad(city, 'x', car.x);
      if (Math.abs(car.x - cross) < 7 && S.time - car.turnAt > 2 && Math.random() < 0.35) {
        car.axis = 'v';
        car.road = cross;
        car.x = cross + (Math.random() < 0.5 ? 14 : -14);
        car.dir = Math.random() < 0.5 ? 1 : -1;
        car.turnAt = S.time;
      }
    }
    // Brief random stops at intersections.
    if (Math.random() < dt * 0.02) car.pause = 0.8 + Math.random() * 1.6;
    // Don't plough through the player's car: slow down when close ahead.
    const p = S.player;
    if (!p.onFoot && p.car) {
      const d = Math.hypot(car.x - p.car.x, car.y - p.car.y);
      if (d < 70) car.speed = Math.min(car.speed, 40);
    }
  }
}

export function updatePeds(S, dt) {
  const p = S.player;
  const px = p.x;
  const py = p.y;
  const carSpeed = p.onFoot ? 0 : Math.abs(p.car.speed);
  for (const ped of S.peds) {
    if (ped.state === 'down') {
      ped.timer -= dt;
      if (ped.timer <= 0) {
        ped.state = 'walk';
        ped.x = Math.max(80, Math.min(S.city.W - 80, ped.x + 400));
        ped.y = Math.max(80, Math.min(S.city.H - 360, ped.y + 300));
        pickPedTarget(S.city, ped);
      }
      continue;
    }
    const dCar = Math.hypot(ped.x - px, ped.y - py);
    if (ped.state === 'flee') {
      ped.timer -= dt;
      const d = Math.max(1, dCar);
      ped.x += ((ped.x - px) / d) * 150 * dt;
      ped.y += ((ped.y - py) / d) * 150 * dt;
      if (ped.timer <= 0) {
        ped.state = 'walk';
        pickPedTarget(S.city, ped);
      }
    } else {
      // Flee a fast car bearing down, or a crime nearby.
      if (carSpeed > 120 && dCar < 150) {
        ped.state = 'flee';
        ped.timer = 1.6;
        continue;
      }
      const dx = ped.tx - ped.x;
      const dy = ped.ty - ped.y;
      const d = Math.hypot(dx, dy);
      if (d < 12) {
        pickPedTarget(S.city, ped);
      } else {
        ped.x += (dx / d) * ped.speed * dt;
        ped.y += (dy / d) * ped.speed * dt;
      }
    }
    resolveCircle(S.city, ped, 8);
  }
}

export function drawPeds(ctx, S) {
  for (const ped of S.peds) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      ctx.rotate(1.2);
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(1, 3, 8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a2a2a';
      ctx.beginPath();
      ctx.arc(0, -3, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
