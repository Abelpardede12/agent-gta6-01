// The player, on foot and behind the wheel. On foot the player is a fast walker who slides
// along walls; in a car the player is an arcade driver: the car has a speed along its heading,
// the velocity eases toward that heading (grip), and the steering bites harder the faster the
// car goes, until it slides. Crashes are resolved circle by circle, front and back.

import { PLAYER } from './config.js';
import { hitsSolid, resolveCircle } from './city.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    onFoot: true,
    car: null,
    // On-foot knockdown timer after a traffic car clips the player.
    downTimer: 0,
    // How far the player walked this step, for the footstep bob.
    stride: 0,
  };
}

export function createCar(color, x, y, angle) {
  return {
    x, y, angle,
    vx: 0, vy: 0,
    speed: 0,
    color,
    hp: 100,
    // Smoke puffs once the car is badly hurt.
    smokeTimer: 0,
  };
}

/** Move the player on foot; walls stop each axis separately so the player slides along them. */
export function stepFoot(player, input, dt, city) {
  if (player.downTimer > 0) {
    player.downTimer -= dt;
    player.stride = 0;
    return;
  }
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (dx === 0 && dy === 0) {
    player.stride = 0;
    return;
  }
  const len = Math.hypot(dx, dy);
  dx /= len;
  dy /= len;
  const speed = PLAYER.walkSpeed * dt;
  const r = 12;
  const nx = player.x + dx * speed;
  if (!hitsSolid(city, nx, player.y, r)) player.x = nx;
  const ny = player.y + dy * speed;
  if (!hitsSolid(city, player.x, ny, r)) player.y = ny;
  player.angle = Math.atan2(dy, dx);
  player.stride += speed;
}

/**
 * Drive a car one step. Returns a crash report: how hard the car hit something this step,
 * so the world can spark, shake and make a sound out of it.
 */
export function stepCar(car, input, dt, city) {
  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  // Speed along the heading: positive forward, negative reversing.
  let along = car.vx * forwardX + car.vy * forwardY;
  const speedBefore = along;

  if (input.up) along += PLAYER.carAccel * dt;
  else if (input.down) along -= (along > 0 ? PLAYER.carBrake : PLAYER.carReverse) * dt;
  else along *= Math.pow(0.35, dt); // coast down gently
  along = Math.max(-PLAYER.carReverse, Math.min(PLAYER.carMaxSpeed, along));

  // Steering bites with speed, and flips when reversing.
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const steerAuthority = Math.min(1, Math.abs(along) / 130);
  car.angle += steer * 2.7 * steerAuthority * Math.sign(along || 1) * dt;

  // The velocity eases toward the heading: that easing is the grip, and the slide is the fun.
  const nx = Math.cos(car.angle);
  const ny = Math.sin(car.angle);
  const grip = 1 - Math.exp(-PLAYER.carGrip * dt);
  car.vx += (nx * along - car.vx) * grip;
  car.vy += (ny * along - car.vy) * grip;
  car.speed = along;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // Two circles, nose and tail, pushed out of walls; a hard hit costs speed.
  let crash = 0;
  for (const offset of [16, -16]) {
    const cx = car.x + Math.cos(car.angle) * offset;
    const cy = car.y + Math.sin(car.angle) * offset;
    const fixed = resolveCircle(city, cx, cy, PLAYER.carRadius);
    if (fixed.hit) {
      car.x += fixed.x - cx;
      car.y += fixed.y - cy;
      crash = Math.max(crash, Math.abs(speedBefore));
      car.vx *= 0.45;
      car.vy *= 0.45;
      car.speed *= 0.45;
    }
  }
  if (car.hp < 45) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.12;
      car.smoking = true;
    } else {
      car.smoking = false;
    }
  } else {
    car.smoking = false;
  }
  return { crash };
}
