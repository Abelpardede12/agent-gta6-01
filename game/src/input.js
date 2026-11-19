// Keyboard + touch input for Sunset Keys.
// Tracks held keys, edge-triggered presses, and a virtual joystick for touch devices.

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.joy = { active: false, x: 0, y: 0 };
    this.brakeHeld = false;
    this.touchMode = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  // True once for the frame the key went down; call after handling.
  consume(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  endFrame() {
    this.pressed.clear();
  }

  get up() { return this.keys.has('KeyW') || this.keys.has('ArrowUp') || this.joy.y < -0.3; }
  get down() { return this.keys.has('KeyS') || this.keys.has('ArrowDown') || this.joy.y > 0.3; }
  get left() { return this.keys.has('KeyA') || this.keys.has('ArrowLeft') || this.joy.x < -0.3; }
  get right() { return this.keys.has('KeyD') || this.keys.has('ArrowRight') || this.joy.x > 0.3; }
  get handbrake() { return this.keys.has('Space') || this.brakeHeld; }

  // Normalised 2D move vector from keys or joystick.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (this.joy.active) {
      x += this.joy.x;
      y += this.joy.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  // Wire the touch DOM (joystick + buttons). Called once by the HUD setup.
  attachTouch() {
    const base = document.getElementById('joy-base');
    const knob = document.getElementById('joy-knob');
    if (!base || !knob) return;
    let joyId = null;
    const setJoy = (e) => {
      const r = base.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = (e.clientX - cx) / (r.width / 2);
      let dy = (e.clientY - cy) / (r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      this.joy.x = dx;
      this.joy.y = dy;
      this.joy.active = true;
      knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
    };
    const endJoy = () => {
      joyId = null;
      this.joy.x = 0;
      this.joy.y = 0;
      this.joy.active = false;
      knob.style.transform = 'translate(0px, 0px)';
    };
    base.addEventListener('pointerdown', (e) => {
      joyId = e.pointerId;
      base.setPointerCapture(e.pointerId);
      setJoy(e);
    });
    base.addEventListener('pointermove', (e) => {
      if (e.pointerId === joyId) setJoy(e);
    });
    base.addEventListener('pointerup', endJoy);
    base.addEventListener('pointercancel', endJoy);

    const bindHold = (id, on, off) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        on();
      });
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    };
    bindHold('btn-enter', () => this.pressed.add('KeyE'), () => {});
    bindHold('btn-brake', () => { this.brakeHeld = true; }, () => { this.brakeHeld = false; });
    bindHold('btn-pause', () => this.pressed.add('KeyP'), () => {});
  }
}
