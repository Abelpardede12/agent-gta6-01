// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The
// game moves between four screens: title, play, paused and busted. On the title the autopilot
// cruises the city behind the start screen, so the menu is alive.
//
// ?seed=N fixes the city. ?shot=drive|foot|chase|mission|start (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.

import { STEP } from './config.js';
import { createWorld, readSave, stepWorld, writeSave } from './world.js';
import {
  ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput,
} from './input.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createAutopilot, stageShot } from './shots.js';
import { createCar } from './player.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

// Any page error is written into the title, so a headless run can see it in a DOM dump.
window.addEventListener('error', (event) => {
  document.title = `ERR: ${String(event.message).slice(0, 120)}`;
});

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const overlay = document.getElementById('overlay');
const world = createWorld(seed);
const renderer = createRenderer(canvas, world.city);
const hud = createHud();
const audio = createAudio();
let save = readSave();

function runShot(name) {
  const scene = stageShot(name, world);
  hud.showScreen(scene.screen === 'title' ? 'title' : 'none', {
    best: save.best, missions: save.missions,
  });
  hud.update(world, world.time);
  let painted = 0;
  function paint() {
    renderer.draw(world, world.time);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput();
  const pilot = createAutopilot(world);
  let screen = 'title';
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function persist() {
    save = {
      best: Math.max(save.best, world.cash),
      missions: save.missions + world.stats.missions,
      bestStreak: Math.max(save.bestStreak, world.missions.bestStreak),
    };
    world.stats.missions = 0;
    writeSave(save);
  }

  /** Every event the world raised this step becomes a toast, a sound, or a screen. */
  function drainEvents() {
    for (const e of world.events) {
      if (e.type === 'wanted') {
        if (e.reason === 'cooling off') {
          if (e.wanted === 0) hud.toast('Heat\'s off. You\'re clean.');
        } else {
          hud.toast(`Heat +1 — ${e.reason}. ${'★'.repeat(e.wanted)}`);
          audio.crash(false);
        }
      } else if (e.type === 'stolen') {
        hud.toast('Car stolen! The heat is on you.');
        audio.pickup();
      } else if (e.type === 'exited') {
        hud.toast('Out of the car. Stay sharp.');
      } else if (e.type === 'too-fast') {
        hud.toast('Slow down to get out of the car.');
      } else if (e.type === 'crash') {
        audio.crash(e.hard);
      } else if (e.type === 'wrecked') {
        hud.toast('Your ride is wrecked! Find another one.');
        audio.crash(true);
      } else if (e.type === 'rammed') {
        audio.crash(true);
      } else if (e.type === 'ped-hit') {
        hud.toast('You hit a pedestrian! Heat +1.');
        audio.crash(false);
      } else if (e.type === 'clipped') {
        hud.toast(`A cab clipped you! -$${e.lost}.`);
        audio.crash(false);
      } else if (e.type === 'near-miss') {
        audio.pickup();
      } else if (e.type === 'mission-start') {
        hud.toast(`${e.job.name} — $${e.job.reward} if you make it in time.`);
        if (e.line) hud.toast(e.line, 3400);
      } else if (e.type === 'mission-done') {
        hud.toast(`Job done! +$${e.job.reward} — streak ${e.streak}.`);
        audio.cash();
        persist();
      } else if (e.type === 'mission-failed') {
        hud.toast('Job failed — the client walked. Streak gone.');
      } else if (e.type === 'busted') {
        audio.busted();
        screen = 'busted';
        hud.showScreen('busted', { lost: e.lost, cash: world.cash });
        announce(`Busted. The cops took $${e.lost}. Cash ${world.cash}.`);
        persist();
      }
    }
    world.events.length = 0;
  }

  function startAttract() {
    // The title screen's living backdrop: the player cruises in a gold car, chasing jobs.
    // If the cruise ends in a wreck, hand the driver a fresh ride and keep cruising.
    if (!world.player.car) {
      const car = createCar('#ffcf3f', 960, 800, 0);
      world.player.car = car;
      world.player.onFoot = false;
      world.player.x = 960;
      world.player.y = 800;
    }
  }

  function startGame() {
    audio.start();
    world.reset();
    accumulator = 0;
    screen = 'play';
    hud.showScreen('none');
    announce('Playing. Steal a car with E, run jobs for Vex, watch the stars.');
    hud.toast('Find a car — press E next to one to take it.');
  }

  // The step, split out so the frame can hand it the actions it already took.
  function stepWith(actions) {
    if (screen === 'title') {
      startAttract();
      if (world.missions.active) pilot.setTarget(world.missions.active.x, world.missions.active.y);
      pilot.update();
      stepWorld(world, pilot.input, 0);
      world.events.length = 0;
      return;
    }
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      hud.toast(muted ? 'Sound off.' : 'Sound on.');
    }
    stepWorld(world, input, actions);
    drainEvents();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (screen === 'title' || screen === 'busted') startGame();
      else if (screen === 'paused') {
        screen = 'play';
        hud.showScreen('none');
        announce('Playing.');
      }
    } else if (actions & ACTION_PAUSE) {
      if (screen === 'play') {
        screen = 'paused';
        hud.showScreen('paused', { cash: world.cash, missions: save.missions, streak: world.missions.streak });
        announce('Paused.');
      } else if (screen === 'paused') {
        screen = 'play';
        hud.showScreen('none');
        announce('Playing.');
      }
    }
    // The confirm above already took this frame's actions; hand them to the first step only,
    // so a single E press can never enter and then leave a car in the same frame.
    if (screen === 'title' || screen === 'play') {
      let first = true;
      while (accumulator >= STEP && (screen === 'title' || screen === 'play')) {
        stepWith(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }

    const driving = !world.player.onFoot && screen === 'play';
    audio.setEngine(driving ? Math.abs(world.player.car.speed) / 545 : 0, driving);
    audio.setSiren(world.police.wanted > 0 && screen === 'play', world.police.sirenPhase);
    hud.update(world, world.time);
    renderer.draw(world, world.time);
  }

  overlay.addEventListener('click', () => {
    if (screen === 'title' || screen === 'busted') startGame();
    else if (screen === 'paused') {
      screen = 'play';
      hud.showScreen('none');
    }
  });

  // Leaving the tab pauses a running game rather than letting the heat build unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      hud.showScreen('paused', { cash: world.cash, missions: save.missions, streak: world.missions.streak });
      announce('Paused.');
    }
  });

  hud.showScreen('title', { best: save.best, missions: save.missions });
  announce('Sunset Keys. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
