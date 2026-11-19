// Sunset Keys — city generation + drawing. Original fictional coastal city.
// World: 3200x2400 px. Streets on a 220px grid, beach + pier along the south edge.
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const BLOCK = 220;
export const ROAD_W = 64;
export const COLS = 14; // road lines x = 0,220,...,2860 (+edge 3080)
export const ROWS = 10; // road lines y = 0,220,...,1980 (+beach below)

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = ['#b5654a', '#c97b4a', '#8f5a6e', '#a86a4e', '#7a4a5e', '#c98a5a', '#94604a', '#6e4a6e', '#bb6a52'];
const ROOF = ['#5a3a4a', '#4a3a3a', '#6b4a3a', '#3f3345'];

export function createCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const parks = [];
  const palms = [];
  const beachY = 2080;
  // blocks: col 0..13, row 0..8 are buildable (row 9 is beach approach)
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < 9; r++) {
      const bx = c * BLOCK, by = r * BLOCK;
      const roll = rng();
      if (roll < 0.12) {
        parks.push({ x: bx + 40, y: by + 40, w: BLOCK - 80, h: BLOCK - 80 });
        const n = 3 + Math.floor(rng() * 4);
        for (let i = 0; i < n; i++) palms.push({ x: bx + 50 + rng() * (BLOCK - 100), y: by + 50 + rng() * (BLOCK - 100) });
        continue;
      }
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const w = 50 + rng() * 70, h = 50 + rng() * 70;
        const x = bx + 44 + rng() * Math.max(1, BLOCK - 88 - w);
        const y = by + 44 + rng() * Math.max(1, BLOCK - 88 - h);
        buildings.push({
          x, y, w, h,
          color: PALETTE[Math.floor(rng() * PALETTE.length)],
          roof: ROOF[Math.floor(rng() * ROOF.length)],
          tall: rng() < 0.25,
        });
      }
    }
  }
  // palm rows along the beach
  for (let x = 60; x < WORLD_W; x += 130 + rng() * 60) {
    palms.push({ x, y: beachY + 40 + rng() * 90 });
  }
  // a few palms in parks already added; scatter a few on sidewalks
  for (let i = 0; i < 24; i++) {
    const c = Math.floor(rng() * COLS), r = Math.floor(rng() * 9);
    palms.push({ x: c * BLOCK + (rng() < 0.5 ? 36 : -36) + (rng() - 0.5) * 8, y: r * BLOCK + 40 + rng() * (BLOCK - 80) });
  }
  return { seed, buildings, parks, palms, beachY, pierX: 1600 };
}

export function isRoad(x, y) {
  const mx = x % BLOCK, my = y % BLOCK;
  const dx = Math.min(mx, BLOCK - mx), dy = Math.min(my, BLOCK - my);
  return dx < ROAD_W / 2 + 6 || dy < ROAD_W / 2 + 6;
}

// Snap a point to the nearest road centre line (used for traffic lanes).
export function snapToRoad(x, y) {
  const rx = Math.round(x / BLOCK) * BLOCK;
  const ry = Math.round(y / BLOCK) * BLOCK;
  return Math.abs(x - rx) < Math.abs(y - ry) ? { x: rx, y } : { x, y: ry };
}

export function randomRoadPoint(rng, minX = 40, maxX = WORLD_W - 40, minY = 40, maxY = 2000) {
  const vertical = rng() < 0.5;
  if (vertical) {
    const x = Math.floor(rng() * COLS) * BLOCK;
    return { x, y: minY + rng() * (maxY - minY) };
  }
  const y = Math.floor(rng() * 9) * BLOCK;
  return { x: minX + rng() * (maxX - minX), y };
}

export function roadPointNear(rng, x, y, minD, maxD) {
  for (let i = 0; i < 40; i++) {
    const p = randomRoadPoint(rng);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d >= minD && d <= maxD) return p;
  }
  return randomRoadPoint(rng);
}

// Push a circle (o.x,o.y radius r) out of buildings. Returns true if it hit.
export function collideBuildings(city, o, r) {
  let hit = false;
  for (const b of city.buildings) {
    if (o.x + r < b.x || o.x - r > b.x + b.w || o.y + r < b.y || o.y - r > b.y + b.h) continue;
    const dxl = o.x + r - b.x, dxr = b.x + b.w - (o.x - r);
    const dyt = o.y + r - b.y, dyb = b.y + b.h - (o.y - r);
    const m = Math.min(dxl, dxr, dyt, dyb);
    if (m === dxl) o.x = b.x - r;
    else if (m === dxr) o.x = b.x + b.w + r;
    else if (m === dyt) o.y = b.y - r;
    else o.y = b.y + b.h + r;
    hit = true;
  }
  return hit;
}

function drawPalm(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#5a3a22';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(2, -14); ctx.stroke();
  ctx.strokeStyle = '#2f8f4e';
  ctx.lineWidth = 2.5;
  const sway = Math.sin(t * 0.001 + x * 0.01) * 2;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.55;
    ctx.beginPath(); ctx.moveTo(2, -14);
    ctx.quadraticCurveTo(2 + Math.cos(a) * 10, -14 + Math.sin(a) * 10, 2 + Math.cos(a) * 16 + sway, -14 + Math.sin(a) * 16 + 6);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawCity(ctx, city, cam, vw, vh, t) {
  const x0 = cam.x - 40, y0 = cam.y - 40, x1 = cam.x + vw + 40, y1 = cam.y + vh + 40;
  // ground
  ctx.fillStyle = '#332b38';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // beach + water (south edge)
  if (y1 > city.beachY) {
    ctx.fillStyle = '#d9a05b';
    ctx.fillRect(x0, Math.max(y0, city.beachY), x1 - x0, Math.min(y1, 2260) - Math.max(y0, city.beachY));
    if (y1 > 2260) {
      ctx.fillStyle = '#2a6f8f';
      ctx.fillRect(x0, Math.max(y0, 2260), x1 - x0, y1 - Math.max(y0, 2260));
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      for (let wy = 2290; wy < y1; wy += 46) {
        ctx.beginPath();
        for (let wx = x0; wx < x1; wx += 40) ctx.lineTo(wx, wy + Math.sin(wx * 0.02 + t * 0.001) * 3);
        ctx.stroke();
      }
    }
  }
  // parks
  for (const p of city.parks) {
    if (p.x > x1 || p.x + p.w < x0 || p.y > y1 || p.y + p.h < y0) continue;
    ctx.fillStyle = '#3f7a4a';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#356b3f';
    ctx.fillRect(p.x + 8, p.y + 8, p.w - 16, p.h - 16);
  }
  // roads
  ctx.fillStyle = '#453e4d';
  for (let i = 0; i <= COLS; i++) {
    const x = i * BLOCK;
    if (x + ROAD_W / 2 < x0 || x - ROAD_W / 2 > x1) continue;
    ctx.fillRect(x - ROAD_W / 2, Math.max(y0, 0), ROAD_W, Math.min(y1, city.beachY + 20) - Math.max(y0, 0));
  }
  for (let j = 0; j < 9; j++) {
    const y = j * BLOCK;
    if (y + ROAD_W / 2 < y0 || y - ROAD_W / 2 > y1) continue;
    ctx.fillRect(Math.max(x0, 0), y - ROAD_W / 2, Math.min(x1, WORLD_W) - Math.max(x0, 0), ROAD_W);
  }
  // centre dashes
  ctx.strokeStyle = 'rgba(255,214,120,0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  for (let i = 0; i <= COLS; i++) {
    const x = i * BLOCK;
    if (x < x0 || x > x1) continue;
    ctx.beginPath(); ctx.moveTo(x, Math.max(y0, 0)); ctx.lineTo(x, Math.min(y1, city.beachY)); ctx.stroke();
  }
  for (let j = 0; j < 9; j++) {
    const y = j * BLOCK;
    if (y < y0 || y > y1) continue;
    ctx.beginPath(); ctx.moveTo(Math.max(x0, 0), y); ctx.lineTo(Math.min(x1, WORLD_W), y); ctx.stroke();
  }
  ctx.setLineDash([]);
  // pier
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(city.pierX - 34, 2240, 68, WORLD_H - 2240);
  ctx.fillStyle = '#8f6238';
  for (let y = 2250; y < WORLD_H; y += 26) ctx.fillRect(city.pierX - 34, y, 68, 4);
  // buildings
  for (const b of city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    // long sunset shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = 'rgba(255,220,150,0.5)';
    const cols = Math.max(1, Math.floor(b.w / 26)), rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if ((i * 7 + j * 13 + b.x) % 5 === 0) ctx.fillRect(b.x + 10 + i * 26, b.y + 10 + j * 26, 8, 10);
    }
    if (b.tall) {
      ctx.fillStyle = '#4a3542';
      ctx.fillRect(b.x + b.w / 2 - 6, b.y + b.h / 2 - 6, 12, 12);
    }
  }
  // palms
  for (const p of city.palms) {
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
    drawPalm(ctx, p.x, p.y, t);
  }
}
