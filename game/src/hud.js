// The HUD: money, wanted stars, the current job, speed and car health as DOM text, the
// minimap as a small canvas, toasts for the fixer and the street, and the title / pause /
// busted overlays. The game canvas stays a canvas; the HUD stays readable text on top of it.

import { BEACH_X, MISSION, SEA_X, WORLD } from './config.js';

const $ = (id) => document.getElementById(id);

export function createHud() {
  const moneyEl = $('money');
  const starsEl = $('stars');
  const missionEl = $('mission');
  const speedEl = $('speed');
  const hpWrap = $('hp-wrap');
  const hpFill = $('hp-fill');
  const toastEl = $('toast');
  const minimap = $('minimap');
  const overlay = $('overlay');
  const overlayTitle = $('overlay-title');
  const overlayBody = $('overlay-body');
  const overlayHint = $('overlay-hint');
  const mapCtx = minimap.getContext('2d');
  let toastTimer = 0;

  function fmtMoney(n) {
    return `$${Math.floor(n).toLocaleString('en-US')}`;
  }

  function toast(text, ms) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), ms ?? 2600);
  }

  function showScreen(name, data) {
    if (name === 'none') {
      overlay.classList.add('hidden');
      return;
    }
    overlay.classList.remove('hidden');
    if (name === 'title') {
      overlayTitle.textContent = 'SUNSET KEYS';
      overlayBody.innerHTML = `A sun-soaked open city. Steal a ride, outrun the heat, run jobs for Vex.<br><br>`
        + `<b>WASD / arrows</b> — drive &amp; walk &nbsp;·&nbsp; <b>E</b> — steal / leave a car<br>`
        + `<b>P</b> — pause &nbsp;·&nbsp; <b>M</b> — mute &nbsp;·&nbsp; touch buttons work too<br><br>`
        + `Best cash: <b>${fmtMoney(data?.best ?? 0)}</b> &nbsp;·&nbsp; Jobs done: <b>${data?.missions ?? 0}</b>`;
      overlayHint.textContent = 'Click or press Space to start';
    } else if (name === 'paused') {
      overlayTitle.textContent = 'PAUSED';
      overlayBody.innerHTML = `Cash ${fmtMoney(data?.cash ?? 0)} &nbsp;·&nbsp; Jobs done ${data?.missions ?? 0} &nbsp;·&nbsp; Best streak ${data?.streak ?? 0}`;
      overlayHint.textContent = 'Press P or Space to keep playing';
    } else if (name === 'busted') {
      overlayTitle.textContent = 'BUSTED!';
      overlayBody.innerHTML = `The cops caught you on foot and took <b>${fmtMoney(data?.lost ?? 0)}</b>.`
        + `<br>Cash left: <b>${fmtMoney(data?.cash ?? 0)}</b> — the city is still yours.`;
      overlayHint.textContent = 'Press Space to get back out there';
    }
  }

  function drawMinimap(world, time) {
    const w = minimap.width;
    const h = minimap.height;
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;
    mapCtx.fillStyle = '#10131c';
    mapCtx.fillRect(0, 0, w, h);
    // Sea and sand on the east edge.
    mapCtx.fillStyle = '#1d6074';
    mapCtx.fillRect(SEA_X * sx, 0, w - SEA_X * sx, h);
    mapCtx.fillStyle = '#c9a55e';
    mapCtx.fillRect(BEACH_X * sx, 0, (SEA_X - BEACH_X) * sx, h);
    // Streets.
    mapCtx.fillStyle = '#6b6578';
    for (const rx of [160, 560, 960, 1360, 1760, 2160]) mapCtx.fillRect(rx * sx - 3, 0, 6, h);
    for (const ry of [160, 480, 800, 1120, 1440, 1760]) mapCtx.fillRect(0, ry * sy - 3, w, 6);
    // Buildings.
    mapCtx.fillStyle = '#a49db0';
    for (const b of world.city.buildings) {
      mapCtx.fillRect(b.x * sx, b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
    }
    // The job beacon pulses yellow.
    const job = world.missions.active;
    if (job) {
      const r = 4 + Math.sin(time * 5) * 1.6;
      mapCtx.fillStyle = '#ffd23f';
      mapCtx.beginPath();
      mapCtx.arc(job.x * sx, job.y * sy, r, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // Traffic as faint dots, police flashing red and blue.
    mapCtx.fillStyle = '#b9b3c4';
    for (const c of world.traffic.cars) mapCtx.fillRect(c.x * sx - 1, c.y * sy - 1, 2, 2);
    for (const c of world.police.cars) {
      mapCtx.fillStyle = Math.sin(time * 9 + c.lightPhase) > 0 ? '#ff4d4d' : '#4d7dff';
      mapCtx.beginPath();
      mapCtx.arc(c.x * sx, c.y * sy, 3, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // The player is the white dot that matters.
    const px = world.player.x * sx;
    const py = world.player.y * sy;
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.arc(px, py, 3.4, 0, Math.PI * 2);
    mapCtx.fill();
    mapCtx.strokeStyle = 'rgba(255,255,255,0.65)';
    mapCtx.beginPath();
    mapCtx.arc(px, py, 5.4, 0, Math.PI * 2);
    mapCtx.stroke();
  }

  return {
    toast,
    showScreen,
    /** Refresh every HUD readout from the live world; cheap enough to run every frame. */
    update(world, time) {
      const p = world.player;
      moneyEl.textContent = fmtMoney(world.cash);
      const wanted = world.police.wanted;
      starsEl.textContent = '★'.repeat(wanted) + '☆'.repeat(5 - wanted);
      starsEl.classList.toggle('hot', wanted > 0);
      const job = world.missions.active;
      if (job) {
        const dist = Math.hypot(job.x - p.x, job.y - p.y);
        const secs = Math.max(0, Math.ceil(job.timeLeft));
        missionEl.innerHTML = `<b>${job.name}</b> · ${Math.round(dist)}m · `
          + `<span class="${secs <= 10 ? 'urgent' : ''}">${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</span>`
          + ` · $${job.reward}`;
        missionEl.classList.remove('hidden');
      } else {
        missionEl.innerHTML = world.missions.streak > 0
          ? `Streak <b>${world.missions.streak}</b> — Vex is lining up the next job…`
          : 'Vex is lining up a job…';
        missionEl.classList.remove('hidden');
      }
      if (p.onFoot) {
        speedEl.textContent = 'ON FOOT';
        hpWrap.classList.add('hidden');
      } else {
        speedEl.textContent = `${Math.round(Math.abs(p.car.speed) * 0.24)} mph`;
        hpWrap.classList.remove('hidden');
        hpFill.style.width = `${Math.max(0, p.car.hp)}%`;
        hpFill.classList.toggle('low', p.car.hp < 35);
      }
      drawMinimap(world, time);
    },
    /** The reach radius the renderer uses for the beacon ring. */
    reachRadius: MISSION.reachRadius,
  };
}
