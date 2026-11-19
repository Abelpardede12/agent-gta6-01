// Sunset Keys — keyboard + touch input.
export function createInput() {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    joy: { x: 0, y: 0, active: false },
    btnE: false, btnBrake: false,
    touch: false,
    up: false, down: false, left: false, right: false,
    handbrake: false,
  };
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => { input.keys.clear(); input.joy.active = false; });

  // touch controls: virtual joystick (left) + action buttons (right)
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  input.touch = isTouch;
  if (isTouch) {
    const zone = document.createElement('div');
    zone.id = 'touch-ui';
    zone.innerHTML = `
      <div id="joy"><div id="joy-knob"></div></div>
      <div id="touch-btns">
        <button id="btn-e" type="button">E</button>
        <button id="btn-brake" type="button">BRK</button>
        <button id="btn-pause" type="button">II</button>
      </div>`;
    document.body.appendChild(zone);
    const joy = zone.querySelector('#joy');
    const knob = zone.querySelector('#joy-knob');
    const setJoy = (cx, cy) => {
      const r = joy.getBoundingClientRect();
      let dx = (cx - (r.left + r.width / 2)) / (r.width / 2);
      let dy = (cy - (r.top + r.height / 2)) / (r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      input.joy.x = dx; input.joy.y = dy; input.joy.active = true;
      knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
    };
    const clearJoy = () => { input.joy.x = 0; input.joy.y = 0; input.joy.active = false; knob.style.transform = 'translate(0,0)'; };
    joy.addEventListener('pointerdown', (e) => { joy.setPointerCapture(e.pointerId); setJoy(e.clientX, e.clientY); });
    joy.addEventListener('pointermove', (e) => { if (input.joy.active) setJoy(e.clientX, e.clientY); });
    joy.addEventListener('pointerup', clearJoy);
    joy.addEventListener('pointercancel', clearJoy);
    const hold = (id, on, off) => {
      const el = zone.querySelector(id);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); });
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    };
    hold('#btn-e', () => { input.btnE = true; input.pressed.add('KeyE'); }, () => { input.btnE = false; });
    hold('#btn-brake', () => { input.btnBrake = true; }, () => { input.btnBrake = false; });
    zone.querySelector('#btn-pause').addEventListener('click', () => input.pressed.add('KeyP'));
  }
  return input;
}

// Recompute directional state from keys / joystick. Call once per frame.
export function pollInput(input) {
  const k = input.keys;
  const jx = input.joy.active ? input.joy.x : 0;
  const jy = input.joy.active ? input.joy.y : 0;
  input.up = k.has('KeyW') || k.has('ArrowUp') || jy < -0.35;
  input.down = k.has('KeyS') || k.has('ArrowDown') || jy > 0.35;
  input.left = k.has('KeyA') || k.has('ArrowLeft') || jx < -0.35;
  input.right = k.has('KeyD') || k.has('ArrowRight') || jx > 0.35;
  input.handbrake = k.has('Space') || input.btnBrake;
  // expose analog steer for driving
  input.steer = (input.right ? 1 : 0) - (input.left ? 1 : 0) + (input.joy.active ? jx : 0);
  input.throttle = (input.up ? 1 : 0) - (input.down ? 1 : 0) + (input.joy.active ? -jy : 0);
  input.steer = Math.max(-1, Math.min(1, input.steer));
  input.throttle = Math.max(-1, Math.min(1, input.throttle));
}

// Edge-triggered key: true once per physical press.
export function wasPressed(input, code) {
  if (input.pressed.has(code)) { input.pressed.delete(code); return true; }
  return false;
}

export function endFrameInput(input) { input.pressed.clear(); }
