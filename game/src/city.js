// The city itself: a grid of streets, blocks with pastel buildings and parks, a beach and the
// sea on the east edge, and parked cars along the kerbs. Everything is generated once from the
// seed, then painted onto one static layer by the renderer. This file also answers the
// questions the drivers ask: where is the nearest road, is this spot solid, and which way
// along the streets leads from here to there.

import {
  BEACH_X, PALETTE, PARKED_CARS, ROADS_H, ROADS_V, ROAD_W, SEA_X, WORLD,
} from './config.js';
import { int, pick, range } from './random.js';

/** Half the road width, plus the sidewalk band cars must stay out of. */
const HALF_ROAD = ROAD_W / 2;

export function createCity(rng) {
  const buildings = [];
  const palms = [];
  const parks = [];
  const parkedCars = [];

  // One block sits between each pair of neighbouring streets.
  for (let i = 0; i < ROADS_V.length - 1; i += 1) {
    for (let j = 0; j < ROADS_H.length - 1; j += 1) {
      const x0 = ROADS_V[i] + HALF_ROAD + 16;
      const x1 = ROADS_V[i + 1] - HALF_ROAD - 16;
      const y0 = ROADS_H[j] + HALF_ROAD + 16;
      const y1 = ROADS_H[j + 1] - HALF_ROAD - 16;
      // East of the last street is the beach, not blocks.
      if (x0 > BEACH_X - 60) continue;
      const bw = x1 - x0;
      const bh = y1 - y0;
      if (bw < 60 || bh < 60) continue;
      // Every fifth block is a little park with palms instead of buildings.
      if ((i * 3 + j * 2) % 5 === 4) {
        parks.push({ x: x0, y: y0, w: bw, h: bh });
        const trees = int(rng, 3, 6);
        for (let t = 0; t < trees; t += 1) {
          palms.push({ x: range(rng, x0 + 18, x1 - 18), y: range(rng, y0 + 18, y1 - 18) });
        }
        continue;
      }
      // One or two buildings per block, with a gap between them and the street.
      const split = bw > 240 && rng() < 0.55;
      if (split) {
        const cut = x0 + bw * range(rng, 0.42, 0.58);
        buildings.push(makeBuilding(rng, x0 + 6, y0 + 6, cut - x0 - 16, bh - 12));
        buildings.push(makeBuilding(rng, cut + 10, y0 + 6, x1 - cut - 16, bh - 12));
      } else {
        buildings.push(makeBuilding(rng, x0 + 6, y0 + 6, bw - 12, bh - 12));
      }
    }
  }

  // Palms in a row along the sand, facing the sunset over the sea.
  for (let y = 80; y < WORLD.height - 60; y += 130) {
    palms.push({ x: BEACH_X + range(rng, 26, 70), y: y + range(rng, -20, 20) });
  }

  // Parked cars nose in along the kerbs of the streets, never on an intersection.
  let placed = 0;
  let guard = 0;
  while (placed < PARKED_CARS && guard < 400) {
    guard += 1;
    const vertical = rng() < 0.5;
    const road = pick(rng, vertical ? ROADS_V : ROADS_H);
    const along = range(rng, 120, (vertical ? WORLD.height : WORLD.width) - 120);
    const side = rng() < 0.5 ? -1 : 1;
    const x = vertical ? road + side * (HALF_ROAD - 22) : along;
    const y = vertical ? along : road + side * (HALF_ROAD - 22);
    if (x > BEACH_X - 40) continue;
    // Keep intersections clear so traffic never spawns inside a parked car.
    if (ROADS_V.some((rx) => Math.abs(x - rx) < 110) && ROADS_H.some((ry) => Math.abs(y - ry) < 110)) continue;
    if (parkedCars.some((c) => Math.hypot(c.x - x, c.y - y) < 90)) continue;
    parkedCars.push({
      x, y,
      angle: vertical ? (side < 0 ? Math.PI / 2 : -Math.PI / 2) : (side < 0 ? 0 : Math.PI),
      color: pick(rng, PALETTE.carColors),
    });
    placed += 1;
  }

  // One car is always waiting right by the player's spawn, so the first steal is instant.
  parkedCars.push({ x: 884, y: 838, angle: 0, color: PALETTE.playerCar });

  return { buildings, palms, parks, parkedCars };
}

function makeBuilding(rng, x, y, w, h) {
  return {
    x, y, w, h,
    color: pick(rng, PALETTE.roof),
    detail: rng(),
  };
}

/** The nearest vertical street centreline to x. */
export function nearestRoadX(x) {
  return ROADS_V.reduce((best, road) => (Math.abs(road - x) < Math.abs(best - x) ? road : best), ROADS_V[0]);
}

/** The nearest horizontal street centreline to y. */
export function nearestRoadY(y) {
  return ROADS_H.reduce((best, road) => (Math.abs(road - y) < Math.abs(best - y) ? road : best), ROADS_H[0]);
}

/** True when the point is on a street (or on the beach sand, which cars can cross slowly). */
export function onRoad(x, y) {
  if (x < 0 || y < 0 || x > WORLD.width || y > WORLD.height) return false;
  if (x >= BEACH_X) return true;
  return ROADS_V.some((rx) => Math.abs(x - rx) <= HALF_ROAD)
    || ROADS_H.some((ry) => Math.abs(y - ry) <= HALF_ROAD);
}

/** A random point on a street, at least `minDist` from (px, py) when one can be found. */
export function randomRoadPoint(rng, px, py, minDist, maxDist) {
  for (let tries = 0; tries < 40; tries += 1) {
    const vertical = rng() < 0.5;
    const road = pick(rng, vertical ? ROADS_V : ROADS_H);
    const along = range(rng, 100, (vertical ? WORLD.height : WORLD.width) - 100);
    const x = vertical ? road : along;
    const y = vertical ? along : road;
    if (x > BEACH_X - 40) continue;
    const d = Math.hypot(x - px, y - py);
    if (d >= minDist && d <= maxDist) return { x, y };
  }
  return { x: nearestRoadX(px), y: nearestRoadY(py) };
}

/**
 * Waypoints along the streets from (fx, fy) to (tx, ty). When the two points share a street,
 * the route is straight along it; otherwise it goes out to the nearest vertical street, along
 * it to the target's street, then along that street to the target. Drivers follow these with
 * pure pursuit, which keeps police and autopilot cars on the roads instead of through
 * buildings.
 */
export function routeTo(fx, fy, tx, ty) {
  const points = [];
  const push = (x, y) => {
    const last = points[points.length - 1] ?? { x: fx, y: fy };
    if (Math.hypot(x - last.x, y - last.y) > 40) points.push({ x, y });
  };
  const onV = Math.abs(fx - nearestRoadX(fx)) < 30;
  const onH = Math.abs(fy - nearestRoadY(fy)) < 30;
  if (onH && nearestRoadY(fy) === nearestRoadY(ty)) {
    push(tx, fy);
    push(tx, ty);
    return points;
  }
  if (onV && nearestRoadX(fx) === nearestRoadX(tx)) {
    push(fx, ty);
    push(tx, ty);
    return points;
  }
  const vx = nearestRoadX(fx);
  const hy = nearestRoadY(ty);
  push(vx, fy);
  push(vx, hy);
  push(tx, hy);
  // The driver is already on top of the target: the route is the target itself.
  if (points.length === 0) points.push({ x: tx, y: ty });
  return points;
}

/** True when a circle at (x, y) with radius r touches a building, the sea or the world edge. */
export function hitsSolid(city, x, y, r) {
  if (x < r + 8 || y < r + 8 || x > WORLD.width - r - 8 || y > WORLD.height - r - 8) return true;
  if (x > SEA_X - 14) return true;
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

/**
 * Push a circle out of whatever solid it overlaps. Returns the corrected position and whether
 * anything was hit, so a car can lose speed and spark on the wall it just kissed.
 */
export function resolveCircle(city, x, y, r) {
  let hit = false;
  let cx = Math.max(r + 8, Math.min(WORLD.width - r - 8, x));
  let cy = Math.max(r + 8, Math.min(WORLD.height - r - 8, y));
  if (cx !== x || cy !== y) hit = true;
  if (cx > SEA_X - 14 - r) {
    cx = SEA_X - 14 - r;
    hit = true;
  }
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    if (cx + r > b.x && cx - r < b.x + b.w && cy + r > b.y && cy - r < b.y + b.h) {
      const pushLeft = cx + r - b.x;
      const pushRight = b.x + b.w - (cx - r);
      const pushUp = cy + r - b.y;
      const pushDown = b.y + b.h - (cy - r);
      const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
      if (min === pushLeft) cx = b.x - r;
      else if (min === pushRight) cx = b.x + b.w + r;
      else if (min === pushUp) cy = b.y - r;
      else cy = b.y + b.h + r;
      hit = true;
    }
  }
  return { x: cx, y: cy, hit };
}
