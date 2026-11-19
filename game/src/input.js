// Keyboard and touch input. Held keys give a steering state; one-shot presses (start,
// pause, enter a car, mute) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. Touch buttons carry data-key
// attributes and drive the same state, so a phone plays the same game as a keyboard.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_MUTE = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE', 'KeyF']);
const MUTE = new Set(['KeyM']);

export function createInput() {
  const held = { up: false, down: false, left: false, right: false };
  let actions = 0;

  function press(code) {
    if (UP.has(code)) held.up = true;
    else if (DOWN.has(code)) held.down = true;
    else if (LEFT.has(code)) held.left = true;
    else if (RIGHT.has(code)) held.right = true;
    else if (CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (ENTER.has(code)) actions |= ACTION_ENTER;
    else if (MUTE.has(code)) actions |= ACTION_MUTE;
    else return false;
    return true;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) {
      if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
        event.preventDefault();
      }
      return;
    }
    if (press(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
  });

  // Touch buttons: any element with data-key="up|down|left|right|enter" drives the same state.
  document.querySelectorAll('[data-key]').forEach((el) => {
    const key = el.getAttribute('data-key');
    const down = (event) => {
      event.preventDefault();
      if (key === 'enter') actions |= ACTION_ENTER;
      else if (key in held) held[key] = true;
    };
    const up = (event) => {
      event.preventDefault();
      if (key in held) held[key] = false;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('pointercancel', up);
  });

  return {
    get up() { return held.up; },
    get down() { return held.down; },
    get left() { return held.left; },
    get right() { return held.right; },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** For the autopilot in screenshots: drive straight from a plain object. */
    setHeld(next) {
      held.up = !!next.up;
      held.down = !!next.down;
      held.left = !!next.left;
      held.right = !!next.right;
    },
  };
}
