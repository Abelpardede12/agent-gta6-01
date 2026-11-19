// Sunset Keys — HUD DOM, minimap, toasts, menus.
import { WORLD_W, WORLD_H, BLOCK } from './city.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const hud = {
    cash: $('hud-cash'), stars: $('hud-stars'), speed: $('hud-speed'),
    health: $('hud-health'), healthWrap: $('hud-health-wrap'),
    mission: $('hud-mission'), timer: $('hud-timer'),
    minimap: $('minimap'), toastEl: $('toast'),
    menu: $('menu'), pause: $('pause'), over: $('over'),
    overTitle: $('over-title'), overText: $('over-text'),
    _toastT: 0, _last: {},
  };
  hud.toast = (msg) => {
    hud.toastEl.textContent = msg;
    hud.toastEl.classList.add('show');
    hud._toastT = 3.2;
  };
  hud.showMenu = () => {
    hud.menu.classList.remove('hidden');
    hud.pause.classList.add('hidden');
    hud.over.classList.add('hidden');
    const cont = $('btn-continue');
    const hasSave = !!G.saveData;
    cont.classList.toggle('hidden', !hasSave);
    $('btn-start').textContent = hasSave ? 'New Game' : 'Start';
  };
  hud.showOver = (kind) => {
    hud.over.classList.remove('hidden');
    if (kind === 'busted') {
      hud.overTitle.textContent = 'BUSTED';
      hud.overText.textContent = 'The Keys PD caught you. You lost half your cash.';
    } else {
      hud.overTitle.textContent = 'WASTED';
      hud.overText.textContent = 'Your ride is scrap. You lost the current mission.';
    }
  };
  hud.hideOverlays = () => {
    hud.menu.classList.add('hidden');
    hud.pause.classList.add('hidden');
    hud.over.classList.add('hidden');
  };
  hud.update = (dt) => {
    if (hud._toastT > 0) {
      hud._toastT -= dt;
      if (hud._toastT <= 0) hud.toastEl.classList.remove('show');
    }
    const set = (el, key, val) => {
      if (hud._last[key] !== val) { hud._last[key] = val; el.textContent = val; }
    };
    set(hud.cash, 'cash', `$${G.cash}`);
    const stars = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
    set(hud.stars, 'stars', stars);
    hud.stars.style.color = G.wanted > 0 ? '#ff4757' : '#f5f6fa';
    const kmh = G.player.onFoot ? 0 : Math.round(Math.abs(G.player.speed) * 0.12);
    set(hud.speed, 'speed', G.player.onFoot ? 'ON FOOT' : `${kmh} km/h`);
    if (G.player.onFoot || !G.player.car) {
      hud.healthWrap.classList.add('hidden');
    } else {
      hud.healthWrap.classList.remove('hidden');
      const hp = Math.max(0, Math.round(G.player.car.health));
      hud.health.style.width = `${hp}%`;
      hud.health.style.background = hp > 50 ? '#2ed573' : hp > 25 ? '#ffa502' : '#ff4757';
    }
    if (G.mission) {
      const m = G.mission;
      set(hud.mission, 'mission', `Mission ${m.idx + 1}/5 — reach the beacon ($${m.reward})`);
      set(hud.timer, 'timer', `${Math.max(0, Math.ceil(m.timer))}s`);
      hud.timer.style.color = m.timer < 10 ? '#ff4757' : '#ffd700';
    } else {
      set(hud.mission, 'mission', 'Waiting on Vex…');
      set(hud.timer, 'timer', '');
    }
    drawMinimap(hud.minimap, G);
  };
  return hud;
}

function drawMinimap(canvas, G) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const s = Math.min(W / WORLD_W, H / WORLD_H);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(20,16,28,0.85)';
  ctx.fillRect(0, 0, W, H);
  // beach + water
  ctx.fillStyle = '#d9a05b';
  ctx.fillRect(0, G.city.beachY * s, W, (2260 - G.city.beachY) * s);
  ctx.fillStyle = '#2a6f8f';
  ctx.fillRect(0, 2260 * s, W, H - 2260 * s);
  // roads
  ctx.strokeStyle = '#6b6378';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 14; i++) {
    ctx.beginPath(); ctx.moveTo(i * BLOCK * s, 0); ctx.lineTo(i * BLOCK * s, G.city.beachY * s); ctx.stroke();
  }
  for (let j = 0; j < 9; j++) {
    ctx.beginPath(); ctx.moveTo(0, j * BLOCK * s); ctx.lineTo(W, j * BLOCK * s); ctx.stroke();
  }
  // buildings
  ctx.fillStyle = 'rgba(200,150,120,0.6)';
  for (const b of G.city.buildings) ctx.fillRect(b.x * s, b.y * s, Math.max(1, b.w * s), Math.max(1, b.h * s));
  // beacon
  if (G.mission) {
    const m = G.mission;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(m.x * s, m.y * s, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,0,0.6)';
    ctx.beginPath(); ctx.arc(m.x * s, m.y * s, 7, 0, Math.PI * 2); ctx.stroke();
  }
  // police
  ctx.fillStyle = '#ff4757';
  for (const c of G.police) { ctx.beginPath(); ctx.arc(c.x * s, c.y * s, 3, 0, Math.PI * 2); ctx.fill(); }
  // player arrow
  const p = G.player;
  ctx.save();
  ctx.translate(p.x * s, p.y * s);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
}
