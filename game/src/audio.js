// Sunset Keys — synthesized WebAudio only, no audio files.
export function createAudio() {
  const a = {
    ctx: null, master: null, engineOsc: null, engineOsc2: null, engineGain: null,
    sirenOsc: null, sirenGain: null, muted: false, sirenOn: false,
  };
  a.ensure = () => {
    if (a.ctx) { if (a.ctx.state === 'suspended') a.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      a.ctx = new AC();
      a.master = a.ctx.createGain();
      a.master.gain.value = a.muted ? 0 : 0.5;
      a.master.connect(a.ctx.destination);
      // engine hum
      a.engineOsc = a.ctx.createOscillator();
      a.engineOsc.type = 'sawtooth';
      a.engineOsc.frequency.value = 50;
      a.engineOsc2 = a.ctx.createOscillator();
      a.engineOsc2.type = 'square';
      a.engineOsc2.frequency.value = 25;
      a.engineGain = a.ctx.createGain();
      a.engineGain.gain.value = 0;
      const lp = a.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      a.engineOsc.connect(lp); a.engineOsc2.connect(lp);
      lp.connect(a.engineGain); a.engineGain.connect(a.master);
      a.engineOsc.start(); a.engineOsc2.start();
      // siren
      a.sirenOsc = a.ctx.createOscillator();
      a.sirenOsc.type = 'triangle';
      a.sirenOsc.frequency.value = 750;
      a.sirenGain = a.ctx.createGain();
      a.sirenGain.gain.value = 0;
      a.sirenOsc.connect(a.sirenGain); a.sirenGain.connect(a.master);
      a.sirenOsc.start();
    } catch { a.ctx = null; }
  };
  a.setEngine = (speed01, driving) => {
    if (!a.ctx || !a.engineOsc) return;
    const f = 45 + speed01 * 130;
    a.engineOsc.frequency.setTargetAtTime(f, a.ctx.currentTime, 0.05);
    a.engineOsc2.frequency.setTargetAtTime(f / 2, a.ctx.currentTime, 0.05);
    a.engineGain.gain.setTargetAtTime(driving ? 0.05 + speed01 * 0.05 : 0, a.ctx.currentTime, 0.1);
  };
  a.setSiren = (on, t) => {
    if (!a.ctx || !a.sirenOsc) return;
    a.sirenOn = on;
    a.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, a.ctx.currentTime, 0.1);
    if (on) a.sirenOsc.frequency.setTargetAtTime(Math.floor(t * 2.2) % 2 === 0 ? 720 : 980, a.ctx.currentTime, 0.05);
  };
  const tone = (freq, dur, type, vol, delay = 0) => {
    if (!a.ctx) return;
    try {
      const t0 = a.ctx.currentTime + delay;
      const o = a.ctx.createOscillator(), g = a.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(a.master);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch { /* ignore */ }
  };
  a.chime = () => { tone(880, 0.18, 'sine', 0.25); tone(1318, 0.25, 'sine', 0.2, 0.09); };
  a.jingle = () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.22, i * 0.11)); };
  a.thud = () => {
    if (!a.ctx) return;
    try {
      const t0 = a.ctx.currentTime;
      const len = Math.floor(a.ctx.sampleRate * 0.15);
      const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = a.ctx.createBufferSource(); src.buffer = buf;
      const lp = a.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
      const g = a.ctx.createGain(); g.gain.value = 0.5;
      src.connect(lp); lp.connect(g); g.connect(a.master);
      src.start(t0);
    } catch { /* ignore */ }
  };
  a.toggleMute = () => {
    a.muted = !a.muted;
    if (a.master && a.ctx) a.master.gain.setTargetAtTime(a.muted ? 0 : 0.5, a.ctx.currentTime, 0.05);
    return a.muted;
  };
  return a;
}
