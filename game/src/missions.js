// Missions from Vex, the fixer: five chained checkpoint runs with a timer,
// a cash reward, and a story line on every completion.

export const VEX_LINES = [
  'Vex: Clean run. The Keys are yours tonight, kid.',
  'Vex: You drive like you mean it. Next pickup is hotter.',
  'Vex: Cops are sniffing around this one. Don\'t dawdle.',
  'Vex: That was the big score\'s warm-up. One more after this.',
  'Vex: Five for five. You\'re a legend on these streets now.',
];

const MISSION_DEFS = [
  { dist: 650, time: 60, reward: 150, wanted: 0, brief: 'Reach the drop-off before the clock runs out.' },
  { dist: 950, time: 55, reward: 220, wanted: 0, brief: 'A package is waiting across town. Move.' },
  { dist: 1250, time: 60, reward: 300, wanted: 1, brief: 'This one is watched. Expect heat on pickup.' },
  { dist: 1550, time: 65, reward: 350, wanted: 1, brief: 'Long haul, tight clock. The cops know the route.' },
  { dist: 1850, time: 70, reward: 400, wanted: 1, brief: 'The big one. Get there and you\'re made.' },
];

export function createMissions() {
  return { index: 0, active: false, beacon: null, timer: 0, reward: 0, cooldown: 0, done: 0 };
}

function pickBeacon(S, dist) {
  const city = S.city;
  const p = S.player;
  for (let tries = 0; tries < 60; tries++) {
    const bx = city.roadsX[Math.floor(Math.random() * city.roadsX.length)];
    const by = city.roadsY[Math.floor(Math.random() * city.roadsY.length)];
    const d = Math.hypot(bx - p.x, by - p.y);
    if (d > dist * 0.75 && d < dist * 1.5) return { x: bx, y: by };
  }
  return { x: city.roadsX[5], y: city.roadsY[4] };
}

export function startMission(S, index) {
  const m = S.missions;
  const def = MISSION_DEFS[index % MISSION_DEFS.length];
  m.index = index;
  m.beacon = pickBeacon(S, def.dist);
  m.timer = def.time;
  m.reward = def.reward;
  m.active = true;
  m.cooldown = 0;
  if (def.wanted > 0) S.police.crime(S, def.wanted);
  S.hud.toast(`Mission ${index + 1}/5 — ${def.brief}`);
}

export function resetCurrent(S) {
  const m = S.missions;
  if (!m.active) return;
  m.active = false;
  m.beacon = null;
  m.cooldown = 2;
}

export function updateMissions(S, dt) {
  const m = S.missions;
  if (!m.active) {
    if (m.cooldown > 0) {
      m.cooldown -= dt;
      if (m.cooldown <= 0) startMission(S, m.index);
    }
    return;
  }
  m.timer -= dt;
  const b = m.beacon;
  const d = Math.hypot(b.x - S.player.x, b.y - S.player.y);
  if (d < 55) {
    m.active = false;
    m.done += 1;
    S.cash += m.reward;
    S.missionsDone = m.done;
    S.best = Math.max(S.best, S.cash);
    S.save();
    S.audio.jingle();
    S.fx.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.7, color: '#ffd94a', size: 46 });
    S.hud.toast(`Mission complete! +$${m.reward}. ${VEX_LINES[m.index % VEX_LINES.length]}`);
    if (m.done >= 5 && m.index >= 4) {
      S.hud.toast('Story complete — Vex runs the Keys through you now. The chain starts over, hotter.');
      m.index = -1;
    }
    m.cooldown = 2.5;
    m.index += 1;
    return;
  }
  if (m.timer <= 0) {
    S.hud.toast('Too slow — Vex gives you another shot at it.');
    m.active = false;
    m.cooldown = 2;
  }
}

export function drawBeacon(ctx, S) {
  const m = S.missions;
  if (!m.active || !m.beacon) return;
  const b = m.beacon;
  const pulse = 0.6 + 0.4 * Math.sin(S.time * 5);
  // Light column.
  const g = ctx.createLinearGradient(b.x, b.y - 260, b.x, b.y);
  g.addColorStop(0, 'rgba(255,217,74,0)');
  g.addColorStop(1, `rgba(255,217,74,${0.35 * pulse})`);
  ctx.fillStyle = g;
  ctx.fillRect(b.x - 16, b.y - 260, 32, 260);
  // Ground ring.
  ctx.strokeStyle = `rgba(255,217,74,${pulse})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(b.x, b.y, 42 + Math.sin(S.time * 5) * 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = `rgba(255,217,74,${0.25 * pulse})`;
  ctx.beginPath();
  ctx.arc(b.x, b.y, 42, 0, Math.PI * 2);
  ctx.fill();
  // Beacon marker.
  ctx.fillStyle = '#ffd94a';
  ctx.beginPath();
  ctx.moveTo(b.x, b.y - 52);
  ctx.lineTo(b.x + 10, b.y - 30);
  ctx.lineTo(b.x - 10, b.y - 30);
  ctx.closePath();
  ctx.fill();
}
