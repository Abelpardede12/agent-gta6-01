// Sunset Keys — boot, game loop, state machine, save/load.
// Original top-down open-city mini-game. No network requests, no external assets.
import { createCity, mulberry32, drawCity, WORLD_W, WORLD_H } from './city.js';
import { createInput, pollInput, wasPressed, endFrameInput } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, spawnParkedCars, updatePlayer, tryEnterExit, drawCar, drawPlayer } from './player.js';
import { createTraffic, updateTraffic, drawTraffic } from './traffic.js';
import { updatePolice } from './police.js';
import { updateMissions, drawBeacon } from './missions.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const SAVE_KEY = 'sunset-keys-save-v1';
const VW = 1280, VH = 720;

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7) || 7;
const shot = params.get('shot');

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const G = {
  seed,
  rng: mulberry32(seed),
  city: null,
  time: 0,
  state: 'menu',
  cash: 0, best: 0, missionsDone: 0,
  wanted: 0, lastCrime: -999, bustedHold: 0, boxedT: 0, decayT: 0, disguiseCd: 0,
  player: null,
  cars: [], peds: [], police: [],
  mission: null, nextMissionT: 1.5,
  cam: { x: 0, y: 0 },
  spawn: { x: 110, y: 110 },
  saveData: null,
  over: null,
};
G.city = createCity(seed);
G.player = createPlayer(G.spawn);
G.input = createInput();
G.audio = createAudio();
G.hud = createHud(G);
G.saveGame = saveGame;
createTraffic(G, G.rng);
spawnParkedCars(G, G.rng, 12);

function saveGame(g) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: g.cash, best: g.best, missionsDone: g.missionsDone,
    }));
  } catch { /* storage unavailable */ }
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
G.saveData = loadSave();

function resetRun(fromSave) {
  G.cash = fromSave ? (G.saveData?.cash || 0) : 0;
  G.best = fromSave ? (G.saveData?.best || 0) : Math.max(G.best, 0);
  G.missionsDone = fromSave ? (G.saveData?.missionsDone || 0) : 0;
  G.wanted = 0; G.lastCrime = -999;
  G.bustedHold = 0; G.boxedT = 0; G.decayT = 0; G.disguiseCd = 0;
  G.mission = null; G.nextMissionT = 1.5;
  G.police.length = 0;
  G.cars = G.cars.filter((c) => c.type !== 'police');
  const p = G.player;
  p.x = G.spawn.x; p.y = G.spawn.y; p.onFoot = true; p.car = null; p.speed = 0; p.angle = -Math.PI / 2;
  G.over = null;
  G.state = 'playing';
  G.hud.hideOverlays();
  G.audio.ensure();
}

function step(dt) {
  G.time += dt;
  pollInput(G.input);
  if (G.state !== 'playing') return;
  if (wasPressed(G.input, 'KeyE')) tryEnterExit(G);
  updatePlayer(G, dt);
  if (G.state !== 'playing') return; // busted/wasted during update
  updateTraffic(G, dt);
  updatePolice(G, dt);
  if (G.state !== 'playing') return;
  updateMissions(G, dt);
  // camera follows player
  const p = G.player;
  G.cam.x = Math.max(0, Math.min(WORLD_W - VW, p.x - VW / 2));
  G.cam.y = Math.max(0, Math.min(WORLD_H - VH, p.y - VH / 2));
  // audio
  const driving = !p.onFoot && p.car;
  G.audio.setEngine(driving ? Math.abs(p.speed) / 520 : 0, driving);
  G.audio.setSiren(G.wanted >= 1, G.time);
  endFrameInput(G.input);
}
G.step = step;

function render() {
  const t = performance.now();
  ctx.clearRect(0, 0, VW, VH);
  ctx.save();
  ctx.translate(-Math.round(G.cam.x), -Math.round(G.cam.y));
  drawCity(ctx, G.city, G.cam, VW, VH, t);
  drawBeacon(ctx, G, t);
  for (const c of G.cars) {
    if (c.type === 'player') continue;
    drawCar(ctx, c, t);
  }
  drawTraffic(ctx, G);
  if (G.player.car) drawCar(ctx, G.player.car, t);
  drawPlayer(ctx, G, t);
  ctx.restore();
  // vignette
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.45, VW / 2, VH / 2, VH * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(20,8,20,0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VW, VH);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.state === 'menu') {
    // slow attract pan over the city
    G.cam.x = (Math.sin(now * 0.00005) * 0.5 + 0.5) * (WORLD_W - VW);
    G.cam.y = (Math.cos(now * 0.00004) * 0.5 + 0.5) * (WORLD_H - VH);
    updateTraffic(G, dt);
    endFrameInput(G.input);
  } else if (G.state === 'playing') {
    if (wasPressed(G.input, 'KeyP') || wasPressed(G.input, 'Escape')) {
      G.state = 'paused';
      G.hud.pause.classList.remove('hidden');
      endFrameInput(G.input);
    } else if (wasPressed(G.input, 'KeyM')) {
      const muted = G.audio.toggleMute();
      document.getElementById('btn-mute').textContent = muted ? '🔇 Muted' : '🔊 Sound';
    } else {
      step(dt);
    }
  } else if (G.state === 'paused') {
    if (wasPressed(G.input, 'KeyP') || wasPressed(G.input, 'Escape')) {
      G.state = 'playing';
      G.hud.pause.classList.add('hidden');
    }
    endFrameInput(G.input);
  }
  render();
  G.hud.update(dt);
  requestAnimationFrame(loop);
}

// ---- buttons ----
document.getElementById('btn-start').addEventListener('click', () => resetRun(false));
document.getElementById('btn-continue').addEventListener('click', () => resetRun(true));
document.getElementById('btn-resume').addEventListener('click', () => {
  G.state = 'playing';
  G.hud.pause.classList.add('hidden');
});
document.getElementById('btn-restart').addEventListener('click', () => {
  const p = G.player;
  p.x = G.spawn.x; p.y = G.spawn.y; p.onFoot = true; p.car = null; p.speed = 0;
  G.wanted = 0; G.mission = null; G.nextMissionT = 1.5;
  G.state = 'playing';
  G.hud.hideOverlays();
});
document.getElementById('btn-mute').addEventListener('click', (e) => {
  G.audio.ensure();
  const muted = G.audio.toggleMute();
  e.target.textContent = muted ? '🔇 Muted' : '🔊 Sound';
});
document.getElementById('btn-menu-quit').addEventListener('click', () => {
  saveGame(G);
  G.state = 'menu';
  G.hud.showMenu();
});
window.addEventListener('beforeunload', () => saveGame(G));

// ---- boot ----
G.hud.showMenu();
if (shot) {
  // screenshot staging: skip the menu, stage the scene synchronously
  resetRun(false);
  stageShot(G, shot);
  step(1 / 60);
  render();
  G.hud.update(0);
} else {
  requestAnimationFrame(loop);
}
if (shot) requestAnimationFrame(loop);
