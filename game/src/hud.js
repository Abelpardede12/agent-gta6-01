// HUD: cash, wanted stars, speed, car health, mission objective + timer,
// minimap, toasts, and the menu / pause / busted overlays.

export function initHud(S) {
  const $ = (id) => document.getElementById(id);
  S.hudEls = {
    cash: $('hud-cash'),
    stars: $('hud-stars'),
    speed: $('hud-speed'),
    health: $('hud-health'),
    healthWrap: $('hud-health-wrap'),
    mission: $('hud-mission'),
    timer: $('hud-timer'),
    toasts: $('toasts'),
    menu: $('menu'),
    pause: $('pause'),
    busted: $('busted'),
    bustedCash: $('busted-cash'),
    minimap: $('minimap'),
    touch: $('touch-ui'),
    continueBtn: $('btn-continue'),
    saveLine: $('save-line'),
  };
  const mm = S.hudEls.minimap;
  if (mm) S.minimapCtx = mm.getContext('2d');
  if (S.input.touchMode && S.hudEls.touch) S.hudEls.touch.style.display = 'block';
  S.input.attachTouch();

  const start = () => {
    S.audio.ensure();
    S.audio.click();
    S.hudEls.menu.style.display = 'none';
    S.state = 'playing';
    if (!S.missions.active && S.missions.cooldown <= 0) S.missions.start(S, 0);
  };
  $('btn-start').addEventListener('click', () => {
    S.cash = 0;
    S.missionsDone = 0;
    S.missions.index = 0;
    S.missions.cooldown = 0;
    S.missions.active = false;
    S.save();
    start();
  });
  if (S.hudEls.continueBtn) {
    S.hudEls.continueBtn.addEventListener('click', start);
  }
  $('btn-resume').addEventListener('click', () => {
    S.audio.click();
    S.hudEls.pause.style.display = 'none';
    S.state = 'playing';
  });
  $('btn-restart').addEventListener('click', () => {
    S.audio.click();
    S.hudEls.busted.style.display = 'none';
    respawn(S);
    S.state = 'playing';
  });
  $('btn-mute').addEventListener('click', () => {
    S.audio.ensure();
    S.audio.setMuted(!S.audio.muted);
    $('btn-mute').textContent = S.audio.muted ? '🔇 Muted' : '🔊 Sound on';
  });
  $('btn-pause-hud').addEventListener('click', () => {
    if (S.state === 'playing') {
      S.state = 'paused';
      S.hudEls.pause.style.display = 'flex';
    }
  });
  // Show Continue only when a save exists.
  if (S.saveData && S.saveData.cash > 0) {
    S.hudEls.continueBtn.style.display = 'inline-block';
    S.hudEls.saveLine.textContent = `Save found: $${S.saveData.cash} cash, ${S.saveData.missionsDone || 0} missions done.`;
  }
}

export function respawn(S) {
  const p = S.player;
  p.x = S.city.roadsX[1];
  p.y = S.city.roadsY[1];
  p.angle = -Math.PI / 2;
  p.onFoot = true;
  p.car = null;
  p.bustTimer = 0;
  p.boxedTimer = 0;
  S.wanted = 0;
  for (const c of S.cars) if (c.kind === 'police') c.kind = 'parked';
  S.cars = S.cars.filter((c) => c.kind !== 'police');
  S.missions.resetCurrent(S);
  S.audio.setSiren(false);
}

function drawMinimap(S) {
  const ctx = S.minimapCtx;
  if (!ctx) return;
  const city = S.city;
  const W = 180;
  const H = 150;
  const sx = W / city.W;
  const sy = H / city.H;
  ctx.fillStyle = 'rgba(20,16,24,0.85)';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#6a5a6a';
  ctx.lineWidth = 2;
  for (const rx of city.roadsX) {
    ctx.beginPath();
    ctx.moveTo(rx * sx, 0);
    ctx.lineTo(rx * sx, H);
    ctx.stroke();
  }
  for (const ry of city.roadsY) {
    ctx.beginPath();
    ctx.moveTo(0, ry * sy);
    ctx.lineTo(W, ry * sy);
    ctx.stroke();
  }
  ctx.fillStyle = '#2a6a8a';
  ctx.fillRect(0, city.beachY * sy, W, H - city.beachY * sy);
  const m = S.missions;
  if (m.active && m.beacon) {
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(m.beacon.x * sx, m.beacon.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const c of S.cars) {
    if (c.kind === 'police') {
      ctx.fillStyle = '#ff2a2a';
      ctx.beginPath();
      ctx.arc(c.x * sx, c.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const p = S.player;
  ctx.save();
  ctx.translate(p.x * sx, p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function updateHud(S) {
  const el = S.hudEls;
  if (!el) return;
  el.cash.textContent = `$${S.cash}`;
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < S.wanted ? '★' : '☆';
  el.stars.textContent = stars;
  el.stars.style.color = S.wanted > 0 ? '#ffd94a' : '#ffffff';
  const p = S.player;
  if (p.onFoot) {
    el.speed.textContent = 'On foot';
    el.healthWrap.style.display = 'none';
  } else {
    const mph = Math.round(Math.abs(p.car.speed) * 0.12);
    el.speed.textContent = `${mph} mph`;
    el.healthWrap.style.display = 'block';
    el.health.style.width = `${Math.max(0, p.car.health)}%`;
    el.health.style.background = p.car.health > 50 ? '#7dd94a' : p.car.health > 25 ? '#e8c33a' : '#d94a4a';
  }
  const m = S.missions;
  if (m.active) {
    el.mission.textContent = `Mission ${m.index + 1}/5 — reach the gold beacon (+$${m.reward})`;
    el.timer.textContent = `${Math.max(0, Math.ceil(m.timer))}s`;
    el.timer.style.color = m.timer < 10 ? '#ff5a3c' : '#ffffff';
  } else {
    el.mission.textContent = m.cooldown > 0 ? 'Vex is lining up the next job…' : 'No active mission';
    el.timer.textContent = '';
  }
  drawMinimap(S);
}

export function toast(S, msg) {
  const box = S.hudEls ? S.hudEls.toasts : document.getElementById('toasts');
  if (!box) return;
  const div = document.createElement('div');
  div.className = 'toast';
  div.textContent = msg;
  box.appendChild(div);
  while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(() => {
    if (div.parentNode) div.parentNode.removeChild(div);
  }, 6000);
}

export function showBusted(S) {
  const el = S.hudEls;
  if (!el) return;
  el.bustedCash.textContent = `The cops took half your cash. You kept $${S.cash}.`;
  el.busted.style.display = 'flex';
}
