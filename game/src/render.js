// The renderer: the whole city is painted once onto an offscreen layer (ground, beach, sea,
// streets, markings, parks, buildings, palms, the sunset glow), and each frame only draws
// the visible slice of it plus the moving things — cars, people, the job beacon, particles —
// and an arrow at the screen edge when the job is off-screen.

import {
  BEACH_X, PALETTE, ROADS_H, ROADS_V, ROAD_W, SEA_X, WORLD,
} from './config.js';

const HALF_ROAD = ROAD_W / 2;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paintStaticLayer(city) {
  const layer = document.createElement('canvas');
  layer.width = WORLD.width;
  layer.height = WORLD.height;
  const c = layer.getContext('2d');

  // Ground: warm block tone everywhere, then the beach and the sea on the east edge.
  c.fillStyle = PALETTE.block;
  c.fillRect(0, 0, WORLD.width, WORLD.height);
  c.fillStyle = PALETTE.sand;
  c.fillRect(BEACH_X, 0, WORLD.width - BEACH_X, WORLD.height);
  const sea = c.createLinearGradient(SEA_X, 0, WORLD.width, 0);
  sea.addColorStop(0, PALETTE.sea);
  sea.addColorStop(1, PALETTE.seaDeep);
  c.fillStyle = sea;
  c.fillRect(SEA_X, 0, WORLD.width - SEA_X, WORLD.height);
  // Wave lines lapping the sand.
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = 3;
  for (let y = 40; y < WORLD.height; y += 90) {
    c.beginPath();
    c.moveTo(SEA_X + 6, y);
    c.quadraticCurveTo(SEA_X + 34, y + 14, SEA_X + 62, y);
    c.stroke();
  }

  // Sidewalks: one lighter slab per block, then parks as green slabs.
  c.fillStyle = PALETTE.sidewalk;
  for (let i = 0; i < ROADS_V.length - 1; i += 1) {
    for (let j = 0; j < ROADS_H.length - 1; j += 1) {
      const x0 = ROADS_V[i] + HALF_ROAD + 6;
      const x1 = ROADS_V[i + 1] - HALF_ROAD - 6;
      const y0 = ROADS_H[j] + HALF_ROAD + 6;
      const y1 = ROADS_H[j + 1] - HALF_ROAD - 6;
      if (x0 > BEACH_X - 60 || x1 - x0 < 40 || y1 - y0 < 40) continue;
      c.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  c.fillStyle = PALETTE.grass;
  for (const p of city.parks) c.fillRect(p.x, p.y, p.w, p.h);

  // Streets: asphalt, centre dashes, and zebra crossings at every intersection.
  c.fillStyle = PALETTE.asphalt;
  for (const rx of ROADS_V) c.fillRect(rx - HALF_ROAD, 0, ROAD_W, WORLD.height);
  for (const ry of ROADS_H) c.fillRect(0, ry - HALF_ROAD, WORLD.width, ROAD_W);
  c.strokeStyle = PALETTE.asphaltLine;
  c.lineWidth = 4;
  c.setLineDash([26, 22]);
  for (const rx of ROADS_V) {
    c.beginPath();
    c.moveTo(rx, 0);
    c.lineTo(rx, WORLD.height);
    c.stroke();
  }
  for (const ry of ROADS_H) {
    c.beginPath();
    c.moveTo(0, ry);
    c.lineTo(WORLD.width, ry);
    c.stroke();
  }
  c.setLineDash([]);
  c.fillStyle = 'rgba(255,255,255,0.75)';
  for (const rx of ROADS_V) {
    for (const ry of ROADS_H) {
      for (let k = -2; k <= 2; k += 1) {
        c.fillRect(rx + k * 18 - 6, ry - HALF_ROAD + 8, 12, 18);
        c.fillRect(rx + k * 18 - 6, ry + HALF_ROAD - 26, 12, 18);
        c.fillRect(rx - HALF_ROAD + 8, ry + k * 18 - 6, 18, 12);
        c.fillRect(rx + HALF_ROAD - 26, ry + k * 18 - 6, 18, 12);
      }
    }
  }

  // Buildings: a dropped shadow, a pastel roof, a darker rim and a rooftop detail or two.
  for (const b of city.buildings) {
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    c.fillStyle = b.color;
    c.fillRect(b.x, b.y, b.w, b.h);
    c.strokeStyle = 'rgba(0,0,0,0.22)';
    c.lineWidth = 3;
    c.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.fillRect(b.x + 8, b.y + 8, b.w - 16, 10);
    if (b.detail > 0.45) {
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.4, 18, 14);
      c.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.55, 14, 14);
    }
    if (b.detail > 0.75) {
      c.fillStyle = 'rgba(120,200,230,0.55)';
      c.fillRect(b.x + b.w * 0.35, b.y + b.h * 0.3, b.w * 0.3, b.h * 0.3);
    }
  }

  // Palms: a leaning trunk and a crown of fronds.
  for (const palm of city.palms) {
    c.strokeStyle = PALETTE.palmTrunk;
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(palm.x, palm.y + 12);
    c.quadraticCurveTo(palm.x + 4, palm.y, palm.x + 8, palm.y - 14);
    c.stroke();
    c.strokeStyle = PALETTE.palm;
    c.lineWidth = 4;
    for (let f = 0; f < 6; f += 1) {
      const a = (f / 6) * Math.PI * 2;
      c.beginPath();
      c.moveTo(palm.x + 8, palm.y - 14);
      c.quadraticCurveTo(
        palm.x + 8 + Math.cos(a) * 12, palm.y - 14 + Math.sin(a) * 12,
        palm.x + 8 + Math.cos(a) * 22, palm.y - 14 + Math.sin(a) * 22 + 6,
      );
      c.stroke();
    }
  }

  // The sunset itself: a low glow over the sea, and a warm wash over the whole city.
  const glow = c.createRadialGradient(2420, 260, 40, 2420, 260, 620);
  glow.addColorStop(0, 'rgba(255,158,79,0.5)');
  glow.addColorStop(1, 'rgba(255,158,79,0)');
  c.fillStyle = glow;
  c.fillRect(1800, 0, WORLD.width - 1800, 900);
  c.fillStyle = 'rgba(255,170,90,0.05)';
  c.fillRect(0, 0, WORLD.width, WORLD.height);
  return layer;
}

function drawCar(ctx, x, y, angle, color, opts) {
  const o = opts ?? {};
  ctx.save();
  ctx.translate(x, y);
  // Soft shadow under the car.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(3, 5, 21, 12, angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(angle);
  // Body.
  ctx.fillStyle = color;
  roundRect(ctx, -21, -11, 42, 22, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Roof and windshield.
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(-6, -8, 12, 16);
  ctx.fillStyle = 'rgba(20,24,34,0.75)';
  ctx.fillRect(9, -8, 6, 16);
  ctx.fillRect(-17, -8, 4, 16);
  // Headlights and taillights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(19, -8, 3, 5);
  ctx.fillRect(19, 3, 3, 5);
  ctx.fillStyle = '#ff4d4d';
  ctx.fillRect(-21, -8, 3, 5);
  ctx.fillRect(-21, 3, 3, 5);
  if (o.police) {
    // White doors and the flashing light bar.
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(-6, -11, 12, 22);
    const phase = Math.sin(o.lightPhase ?? 0) > 0;
    ctx.fillStyle = phase ? '#ff3b3b' : '#3b6bff';
    ctx.beginPath();
    ctx.arc(-2, -8, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = phase ? '#3b6bff' : '#ff3b3b';
    ctx.beginPath();
    ctx.arc(-2, 8, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (o.player) {
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14, -9);
    ctx.lineTo(14, -9);
    ctx.moveTo(-14, 9);
    ctx.lineTo(14, 9);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, bob, down) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  if (down) {
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2e26';
    ctx.beginPath();
    ctx.arc(12, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const wobble = Math.sin(bob) * 1.6;
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, wobble * 0.4, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2e2620';
  ctx.beginPath();
  ctx.arc(3, wobble * 0.4, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(9, wobble * 0.4, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function createRenderer(canvas, city) {
  const ctx = canvas.getContext('2d');
  const layer = paintStaticLayer(city);
  let viewW = 1280;
  let viewH = 720;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const zoom = Math.max(1, Math.min(w / 1280, h / 720, 1.75));
    viewW = w / zoom;
    viewH = h / zoom;
  }
  resize();
  window.addEventListener('resize', resize);

  function cameraFor(player) {
    const shake = player.shake ?? 0;
    const sx = shake > 0.2 ? (Math.random() - 0.5) * shake : 0;
    const sy = shake > 0.2 ? (Math.random() - 0.5) * shake : 0;
    const x = Math.max(0, Math.min(WORLD.width - viewW, player.x - viewW / 2 + sx));
    const y = Math.max(0, Math.min(WORLD.height - viewH, player.y - viewH / 2 + sy));
    return { x, y };
  }

  return {
    resize,
    draw(world, time) {
      const player = world.player;
      const cam = cameraFor(player);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const zoom = (canvas.width / dpr) / viewW;
      ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, -cam.x * dpr * zoom, -cam.y * dpr * zoom);
      // The visible slice of the baked city.
      ctx.drawImage(layer, cam.x, cam.y, viewW, viewH, cam.x, cam.y, viewW, viewH);

      // The job beacon: a column of light and a pulsing ring on the street.
      const job = world.missions.active;
      if (job) {
        const pulse = 0.6 + Math.sin(time * 5) * 0.25;
        const grad = ctx.createLinearGradient(job.x, job.y - 260, job.x, job.y);
        grad.addColorStop(0, 'rgba(255,210,63,0)');
        grad.addColorStop(1, `rgba(255,210,63,${0.4 * pulse})`);
        ctx.fillStyle = grad;
        ctx.fillRect(job.x - 14, job.y - 260, 28, 260);
        ctx.strokeStyle = `rgba(255,210,63,${0.85 * pulse})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(job.x, job.y, 30 + Math.sin(time * 5) * 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,210,63,${0.9 * pulse})`;
        ctx.beginPath();
        ctx.arc(job.x, job.y, 7, 0, Math.PI * 2);
        ctx.fill();
      }

      // Parked cars, then people, then traffic, then police, then the player.
      for (const c of city.parkedCars) drawCar(ctx, c.x, c.y, c.angle, c.color, {});
      for (const ped of world.traffic.peds) {
        drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, ped.bob, ped.state === 'down');
      }
      for (const c of world.traffic.cars) drawCar(ctx, c.x, c.y, c.angle, c.color, {});
      for (const c of world.police.cars) drawCar(ctx, c.x, c.y, c.angle, c.color, { police: true, lightPhase: c.lightPhase });
      if (player.onFoot) {
        drawPerson(ctx, player.x, player.y, player.angle, '#ffcf3f', player.stride * 0.09, player.downTimer > 0);
      } else {
        drawCar(ctx, player.car.x, player.car.y, player.car.angle, player.car.color, { player: true });
      }

      // Particles: smoke, sparks, cash glints.
      for (const p of world.particles) {
        const a = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + (1 - a) * 1.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // An arrow at the screen edge points at an off-screen job. The canvas is still in
      // world coordinates here, so the arrow's screen spot is offset by the camera.
      if (job) {
        const sx = job.x - cam.x;
        const sy = job.y - cam.y;
        if (sx < 20 || sx > viewW - 20 || sy < 20 || sy > viewH - 20) {
          const cx = viewW / 2;
          const cy = viewH / 2;
          const ang = Math.atan2(sy - cy, sx - cx);
          const ax = cam.x + cx + Math.cos(ang) * (viewW / 2 - 46);
          const ay = cam.y + cy + Math.sin(ang) * (viewH / 2 - 46);
          ctx.save();
          ctx.translate(ax, ay);
          ctx.rotate(ang);
          ctx.fillStyle = '#ffd23f';
          ctx.beginPath();
          ctx.moveTo(16, 0);
          ctx.lineTo(-10, -11);
          ctx.lineTo(-10, 11);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = '#ffd23f';
          ctx.font = 'bold 15px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${Math.round(Math.hypot(job.x - player.x, job.y - player.y))}m`, ax, ay + 30);
        }
      }
    },
  };
}
