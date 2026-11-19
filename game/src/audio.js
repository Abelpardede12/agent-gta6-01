// Sound, synthesized live with WebAudio — no audio files, nothing to download. An engine
// hum that rises with speed, a two-tone siren while the heat is on, and short blips for cash,
// crashes and pickups. Everything waits for the player's first gesture, as browsers require,
// and M mutes it all.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter).connect(engineGain).connect(ctx.destination);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 740;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(ctx.destination);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type, volume, slideTo) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type ?? 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(volume ?? 0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch {
      // A blip is garnish; a failed one never stops the game.
    }
  }

  function noiseBurst(dur, volume) {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      const gain = ctx.createGain();
      gain.gain.value = volume ?? 0.25;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
    } catch {
      // As with a blip, a failed burst is not worth stopping for.
    }
  }

  return {
    /** Call from the player's first gesture; safe to call more than once. */
    start() {
      if (started) return;
      started = true;
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    /** Engine hum follows speed (0 to 1) while driving; silent on foot or paused. */
    setEngine(speed01, driving) {
      if (!ctx || muted) return;
      const target = driving ? 0.045 + speed01 * 0.075 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, ctx.currentTime, 0.08);
      engineFilter.frequency.setTargetAtTime(380 + speed01 * 900, ctx.currentTime, 0.1);
    },
    /** The siren wails while wanted; its two tones alternate with the phase. */
    setSiren(on, phase) {
      if (!ctx || muted) return;
      sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.15);
      if (on) sirenOsc.frequency.setTargetAtTime(Math.sin(phase) > 0 ? 740 : 980, ctx.currentTime, 0.05);
    },
    cash() {
      blip(880, 0.09, 'sine', 0.14);
      setTimeout(() => blip(1318, 0.16, 'sine', 0.14), 70);
    },
    pickup() {
      blip(660, 0.1, 'triangle', 0.12, 990);
    },
    crash(hard) {
      noiseBurst(hard ? 0.3 : 0.15, hard ? 0.3 : 0.16);
      blip(90, 0.18, 'sine', 0.2, 45);
    },
    busted() {
      blip(392, 0.16, 'square', 0.08);
      setTimeout(() => blip(311, 0.22, 'square', 0.08), 150);
      setTimeout(() => blip(233, 0.34, 'square', 0.08), 320);
    },
    toggleMute() {
      muted = !muted;
      if (ctx) {
        engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      }
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
