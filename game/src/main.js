// Sunset Keys — boot, game loop, state machine, save/load.
// A top-down open-city crime mini-game: drive, steal, run missions for Vex,
// and stay ahead of the Sunset Keys PD.

import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { createCity, drawCity } from './city.js';
import { createPlayer, updatePlayer, tryEnterExit, drawCar, drawPlayer } from './player.js';
import { createTraffic, createParked, createPeds, updateTraffic, updatePeds, drawPeds } from './traffic.js';
import { createPolice, crime, busted, wasted, updatePolice } from './police.js';
import { createMissions, startMission, resetCurrent, updateMissions, drawBeacon } from './missions.js';
import { initHud, updateHud, toast, showBusted, respawn } from './hud.js';
import { stageShot } from './shots.js';

const SAVE_KEY = 'sunset-keys-save-v1';
const VIEW_W = 1280;
const VIEW_H = 720;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const city = createCity();

const S = {
  time: 0,
  state: 'menu',
  city,
  cash: 0,
  best: 0,
  missionsDone: 0,
  wanted: 0,
  camera: { x: city.roadsX[1], y: city.roadsY[1] },
  fx: [],
  input: new Input(),
  audio: new AudioSys(),
  saveData: null,
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: S.cash, best: S.best, missionsDone: S.missionsDone,
      }));
    } catch { /* storage unavailable: the run still plays */ }
  },
};
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    S.saveData = JSON.parse(raw);
    S.cash = S.saveData.cash || 0;
    S.best = S.saveData.best || 0;
    S.missionsDone = S.saveData.missionsDone || 0;
  }
} catch { /* no save: fresh run */ }

S.player = createPlayer(city);
S.cars = [...createParked(city, 10), ...createTraffic(city, 14)];
S.peds = createPeds(city, 24);
S.police = Object.assign(createPolice(), { crime, busted, wasted });
S.missions = Object.assign(createMissions(), { start: startMission, resetCurrent });
S.hud = { toast: (m) => toast(S, m), showBusted: () => showBusted(S) };

initHud(S);

function update(S, dt) {
  S.time += dt;
  // Edge-triggered keys.
  if (S.input.consume('KeyE')) {
    if (S.state === 'playing') tryEnterExit(S);
  }
  if (S.input.consume('KeyP') || S.input.consume('Escape')) {
    if (S.state === 'playing') {
      S.state = 'paused';
      document.getElementById('pause').style.display = 'flex';
    } else if (S.state === 'paused') {
      S.state = 'playing';
      document.getElementById('pause').style.display = 'none';
    }
  }
  if (S.input.consume('KeyM')) {
    S.audio.ensure();
    S.audio.setMuted(!S.audio.muted);
    const b = document.getElementById('btn-mute');
    if (b) b.textContent = S.audio.muted ? '🔇 Muted' : '🔊 Sound on';
  }
  if (S.state !== 'playing') {
    S.input.endFrame();
    return;
  }
  updatePlayer(S, dt);
  updateTraffic(S, dt);
  updatePeds(S, dt);
  updatePolice(S, dt);
  updateMissions(S, dt);
  // Particles.
  for (let i = S.fx.length - 1; i >= 0; i--) {
    const f = S.fx[i];
    f.life -= dt;
    if (f.life <= 0) S.fx.splice(i, 1);
  }
  // Camera follows the player, clamped to the city.
  const p = S.player;
  const tx = Math.max(VIEW_W / 2, Math.min(city.W - VIEW_W / 2, p.x));
  const ty = Math.max(VIEW_H / 2, Math.min(city.H - VIEW_H / 2, p.y));
  S.camera.x += (tx - S.camera.x) * Math.min(1, dt * 5);
  S.camera.y += (ty - S.camera.y) * Math.min(1, dt * 5);
  // Audio follows the drive.
  const speed01 = p.onFoot ? 0 : Math.abs(p.car.speed) / p.car.maxSpeed;
  S.audio.setEngine(speed01, !p.onFoot);
  S.audio.setSiren(S.wanted >= 1);
  updateHud(S);
  S.input.endFrame();
}

function draw(S) {
  const cam = S.camera;
  ctx.save();
  ctx.translate(VIEW_W / 2 - cam.x, VIEW_H / 2 - cam.y);
  drawCity(ctx, city, cam, VIEW_W, VIEW_H);
  drawBeacon(ctx, S);
  // Cars, sorted so lower ones overlap upper ones.
  const cars = [...S.cars].sort((a, b) => a.y - b.y);
  for (const car of cars) drawCar(ctx, car, S.time);
  drawPeds(ctx, S);
  drawPlayer(ctx, S);
  for (const f of S.fx) {
    ctx.globalAlpha = Math.max(0, f.life * 1.5);
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.size * (1 + (0.7 - f.life)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // Sunset vignette.
  const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
  vg.addColorStop(0, 'rgba(255,120,60,0)');
  vg.addColorStop(1, 'rgba(255,90,40,0.14)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(S, dt);
  draw(S);
  requestAnimationFrame(frame);
}

// Screenshot staging (?shot=...) runs before the first painted frame.
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot && ['drive', 'foot', 'chase', 'mission'].includes(shot)) {
  window.addEventListener('error', (e) => {
    document.title = `SHOT-ERROR: ${e.message}`;
  });
  stageShot(S, shot, update);
}
requestAnimationFrame(frame);
