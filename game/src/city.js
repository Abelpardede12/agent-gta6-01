// Sunset Keys city: a sun-soaked coastal grid city, generated deterministically
// from a seed so every load (and every screenshot) shows the same streets.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BUILDING_COLORS = ['#c96f4a', '#b8573f', '#8a5a7d', '#5a6b8a', '#d9a05b', '#7d8a5a', '#a34d5e', '#6b4a8a', '#4a7d8a', '#c98a4a'];

export function createCity() {
  const rng = mulberry32(20261119);
  const W = 3360;
  const H = 2800;
  const roadsX = [];
  const roadsY = [];
  for (let i = 0; i <= 11; i++) roadsX.push(140 + i * 280);
  for (let j = 0; j <= 8; j++) roadsY.push(140 + j * 280);
  const beachY = 2520;
  const waterY = 2720;
  const buildings = [];
  const parks = [];
  for (let i = 0; i < 11; i++) {
    for (let j = 0; j < 8; j++) {
      const x0 = roadsX[i] + 36;
      const x1 = roadsX[i + 1] - 36;
      const y0 = roadsY[j] + 36;
      const y1 = roadsY[j + 1] - 36;
      if (rng() < 0.14) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees: 4 + Math.floor(rng() * 4) });
        continue;
      }
      const splitV = rng() < 0.5;
      const n = 1 + (rng() < 0.55 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        let b;
        if (n === 1) {
          b = { x: x0 + 8, y: y0 + 8, w: x1 - x0 - 16, h: y1 - y0 - 16 };
        } else if (splitV) {
          const mid = (x0 + x1) / 2;
          b = k === 0
            ? { x: x0 + 8, y: y0 + 8, w: mid - x0 - 16, h: y1 - y0 - 16 }
            : { x: mid + 8, y: y0 + 8, w: x1 - mid - 16, h: y1 - y0 - 16 };
        } else {
          const mid = (y0 + y1) / 2;
          b = k === 0
            ? { x: x0 + 8, y: y0 + 8, w: x1 - x0 - 16, h: mid - y0 - 16 }
            : { x: x0 + 8, y: mid + 8, w: x1 - x0 - 16, h: y1 - mid - 16 };
        }
        b.color = BUILDING_COLORS[Math.floor(rng() * BUILDING_COLORS.length)];
        b.roof = rng() < 0.6 ? 'ac' : 'garden';
        buildings.push(b);
      }
    }
  }
  const palms = [];
  for (let x = 120; x < W - 80; x += 130 + rng() * 90) {
    palms.push({ x: x + rng() * 40, y: beachY + 30 + rng() * 120 });
  }
  for (let i = 0; i < 40; i++) {
    const rx = roadsX[Math.floor(rng() * roadsX.length)];
    const ry = roadsY[Math.floor(rng() * roadsY.length)];
    palms.push({ x: rx + (rng() < 0.5 ? -46 : 46), y: ry + (rng() - 0.5) * 160 });
  }
  return { W, H, roadsX, roadsY, beachY, waterY, buildings, parks, palms, pierX: 1680 };
}

// Nearest road centre on the given axis.
export function nearestRoad(city, axis, v) {
  const arr = axis === 'x' ? city.roadsX : city.roadsY;
  let best = arr[0];
  let bd = Infinity;
  for (const r of arr) {
    const d = Math.abs(r - v);
    if (d < bd) {
      bd = d;
      best = r;
    }
  }
  return best;
}

// True when a circle of radius r at (x, y) overlaps any building.
export function circleHitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

// Push a circle out of buildings (and the world edge). Mutates p {x, y}.
// Returns true when a collision happened.
export function resolveCircle(city, p, r) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
    let dx = p.x - cx;
    let dy = p.y - cy;
    let d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 < 0.0001) {
      // Centre inside the rect: push out along the smallest penetration axis.
      const pl = p.x - b.x;
      const pr = b.x + b.w - p.x;
      const pt = p.y - b.y;
      const pb = b.y + b.h - p.y;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) p.x = b.x - r;
      else if (m === pr) p.x = b.x + b.w + r;
      else if (m === pt) p.y = b.y - r;
      else p.y = b.y + b.h + r;
    } else {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * r;
      p.y = cy + (dy / d) * r;
    }
  }
  if (p.x < r) { p.x = r; hit = true; }
  if (p.y < r) { p.y = r; hit = true; }
  if (p.x > city.W - r) { p.x = city.W - r; hit = true; }
  if (p.y > city.H - r) { p.y = city.H - r; hit = true; }
  return hit;
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

export function drawCity(ctx, city, cam, vw, vh) {
  const x0 = cam.x - vw / 2;
  const y0 = cam.y - vh / 2;
  const x1 = x0 + vw;
  const y1 = y0 + vh;
  // Warm dusk ground.
  ctx.fillStyle = '#3d2c33';
  ctx.fillRect(x0, y0, vw, vh);
  // Beach + water along the south edge.
  ctx.fillStyle = '#d9a066';
  ctx.fillRect(Math.max(x0, 0), Math.max(y0, city.beachY), Math.min(x1, city.W) - Math.max(x0, 0), city.waterY - Math.max(y0, city.beachY));
  const wg = ctx.createLinearGradient(0, city.waterY, 0, city.H);
  wg.addColorStop(0, '#2a6a8a');
  wg.addColorStop(1, '#17455f');
  ctx.fillStyle = wg;
  ctx.fillRect(Math.max(x0, 0), Math.max(y0, city.waterY), Math.min(x1, city.W) - Math.max(x0, 0), city.H - Math.max(y0, city.waterY));
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let wy = city.waterY + 24; wy < city.H; wy += 36) {
    ctx.beginPath();
    for (let wx = Math.max(x0, 0); wx < Math.min(x1, city.W); wx += 60) {
      ctx.moveTo(wx, wy + Math.sin(wx * 0.02 + wy) * 3);
      ctx.lineTo(wx + 30, wy + Math.sin((wx + 30) * 0.02 + wy) * 3);
    }
    ctx.stroke();
  }
  // Streets (asphalt bands) + sidewalks.
  for (const rx of city.roadsX) {
    if (rx + 44 < x0 || rx - 44 > x1) continue;
    ctx.fillStyle = '#4a3f45';
    ctx.fillRect(rx - 44, Math.max(y0, 0), 88, Math.min(y1, city.H) - Math.max(y0, 0));
    ctx.fillStyle = '#2e2b33';
    ctx.fillRect(rx - 32, Math.max(y0, 0), 64, Math.min(y1, city.H) - Math.max(y0, 0));
    ctx.strokeStyle = 'rgba(240,200,90,0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 22]);
    ctx.beginPath();
    ctx.moveTo(rx, Math.max(y0, 0));
    ctx.lineTo(rx, Math.min(y1, city.H));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const ry of city.roadsY) {
    if (ry + 44 < y0 || ry - 44 > y1) continue;
    ctx.fillStyle = '#4a3f45';
    ctx.fillRect(Math.max(x0, 0), ry - 44, Math.min(x1, city.W) - Math.max(x0, 0), 88);
    ctx.fillStyle = '#2e2b33';
    ctx.fillRect(Math.max(x0, 0), ry - 32, Math.min(x1, city.W) - Math.max(x0, 0), 64);
    ctx.strokeStyle = 'rgba(240,200,90,0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 22]);
    ctx.beginPath();
    ctx.moveTo(Math.max(x0, 0), ry);
    ctx.lineTo(Math.min(x1, city.W), ry);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Parks.
  for (const p of city.parks) {
    if (p.x + p.w < x0 || p.x > x1 || p.y + p.h < y0 || p.y > y1) continue;
    ctx.fillStyle = '#4a7a4a';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#3a6a3e';
    const rng = mulberry32(Math.floor(p.x) * 31 + Math.floor(p.y));
    for (let i = 0; i < p.trees; i++) {
      const tx = p.x + 16 + rng() * (p.w - 32);
      const ty = p.y + 16 + rng() * (p.h - 32);
      ctx.beginPath();
      ctx.arc(tx, ty, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Buildings with long sunset shadows and rooftop details.
  for (const b of city.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + 10, b.y + 14, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = shade(b.color, 1.18);
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = shade(b.color, 0.75);
    if (b.roof === 'ac') {
      ctx.fillRect(b.x + b.w / 2 - 10, b.y + b.h / 2 - 8, 20, 16);
    } else {
      ctx.fillStyle = '#4a7a4a';
      ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
    }
  }
  // Pier.
  ctx.fillStyle = '#8a6a4a';
  ctx.fillRect(city.pierX - 30, city.beachY, 60, city.H - city.beachY - 20);
  ctx.fillStyle = '#6a4a34';
  for (let py = city.beachY + 10; py < city.H - 30; py += 26) {
    ctx.fillRect(city.pierX - 30, py, 60, 3);
  }
  // Palm trees.
  for (const p of city.palms) {
    if (p.x < x0 - 20 || p.x > x1 + 20 || p.y < y0 - 20 || p.y > y1 + 20) continue;
    ctx.strokeStyle = '#7a5a3a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 3, p.y - 16);
    ctx.stroke();
    ctx.fillStyle = '#3f8a4a';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(p.x + 3 + Math.cos(a) * 9, p.y - 18 + Math.sin(a) * 9, 10, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
