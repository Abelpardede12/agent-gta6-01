// Sunset Keys — mission chain from fixer "Vex": drive to the beacon before the timer ends.
import { roadPointNear } from './city.js';
import { addWanted } from './player.js';

export const MISSIONS = [
  { reward: 150, timePerPx: 1 / 260, minD: 500, maxD: 900, vex: 'Vex: Easy money. Get to the pier drop before the clock runs out.' },
  { reward: 200, timePerPx: 1 / 270, minD: 700, maxD: 1200, vex: 'Vex: The crew liked that. Next one is further — don\'t dawdle.' },
  { reward: 260, timePerPx: 1 / 280, minD: 900, maxD: 1500, vex: 'Vex: Heat\'s on this one. Cops will notice you. Go fast, stay cool.' },
  { reward: 330, timePerPx: 1 / 290, minD: 1100, maxD: 1700, vex: 'Vex: Big score, big risk. They\'re watching the drop. Make it count.' },
  { reward: 400, timePerPx: 1 / 300, minD: 1300, maxD: 2000, vex: 'Vex: Last one, legend. Pull this off and the Keys are yours.' },
];

export function startMission(G, idx) {
  const def = MISSIONS[idx % MISSIONS.length];
  const p = G.player;
  const spot = roadPointNear(G.rng, p.x, p.y, def.minD, def.maxD);
  const dist = Math.hypot(spot.x - p.x, spot.y - p.y);
  const total = Math.max(20, Math.round(dist * def.timePerPx) + 18);
  G.mission = {
    idx, x: spot.x, y: spot.y, timer: total, total,
    reward: def.reward, vex: def.vex, dist,
  };
  if (idx >= 2) addWanted(G, 1);
  G.hud.toast(`Mission ${idx + 1}/5: reach the beacon in ${total}s — $${def.reward}`);
}

export function updateMissions(G, dt) {
  if (G.state !== 'playing') return;
  if (!G.mission) {
    G.nextMissionT = (G.nextMissionT || 0) - dt;
    if (G.nextMissionT <= 0) startMission(G, G.missionsDone % MISSIONS.length);
    return;
  }
  const m = G.mission;
  m.timer -= dt;
  const d = Math.hypot(G.player.x - m.x, G.player.y - m.y);
  if (d < 55) {
    G.cash += m.reward;
    G.missionsDone++;
    G.best = Math.max(G.best, G.cash);
    G.audio.jingle();
    G.hud.toast(`+$${m.reward}! ${m.vex}`);
    G.mission = null;
    G.nextMissionT = 2.5;
    if (G.saveGame) G.saveGame(G);
    return;
  }
  if (m.timer <= 0) {
    G.hud.toast('Too slow — Vex gives you another shot at the same drop.');
    m.timer = m.total;
  }
}

export function drawBeacon(ctx, G, t) {
  const m = G.mission;
  if (!m) return;
  const pulse = 1 + Math.sin(t * 0.006) * 0.15;
  // light column
  const grad = ctx.createLinearGradient(0, m.y - 260, 0, m.y);
  grad.addColorStop(0, 'rgba(255,215,0,0)');
  grad.addColorStop(1, 'rgba(255,215,0,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(m.x - 26, m.y - 260, 52, 260);
  // glowing beacon ring
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,215,0,0.25)';
  ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd700';
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // direction arrow from player to beacon
  const p = G.player;
  const dx = m.x - p.x, dy = m.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d > 180) {
    const a = Math.atan2(dy, dx);
    const ax = p.x + Math.cos(a) * 70, ay = p.y + Math.sin(a) * 70;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.fillStyle = 'rgba(255,215,0,0.9)';
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
