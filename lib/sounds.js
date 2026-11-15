// Efectos sintetizados con Web Audio API (sin archivos de audio).
let ctx = null;

export function unlockAudio() {
  if (typeof window === 'undefined') return;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch (_) {
    /* sin audio */
  }
}

function tone({ freq = 440, endFreq, duration = 0.15, type = 'sine', volume = 0.25, delay = 0 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export function vibrate(pattern) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
  } catch (_) {
    /* iOS no soporta vibrate */
  }
}

export const sfx = {
  correct() {
    tone({ freq: 660, duration: 0.09, type: 'triangle', volume: 0.3 });
    tone({ freq: 990, duration: 0.16, type: 'triangle', volume: 0.3, delay: 0.08 });
    vibrate(40);
  },
  pass() {
    tone({ freq: 320, endFreq: 180, duration: 0.18, type: 'sawtooth', volume: 0.12 });
    vibrate(20);
  },
  undo() {
    tone({ freq: 500, endFreq: 350, duration: 0.12, type: 'sine', volume: 0.2 });
  },
  tick(last = false) {
    tone({ freq: last ? 1200 : 900, duration: 0.05, type: 'square', volume: 0.12 });
    vibrate(15);
  },
  horn() {
    [220, 277, 330].forEach((f) =>
      tone({ freq: f, duration: 1.1, type: 'sawtooth', volume: 0.14 })
    );
    tone({ freq: 110, duration: 1.1, type: 'square', volume: 0.1 });
    vibrate([300, 100, 300, 100, 500]);
  },
  start() {
    tone({ freq: 523, duration: 0.1, type: 'triangle', volume: 0.25 });
    tone({ freq: 784, duration: 0.18, type: 'triangle', volume: 0.25, delay: 0.1 });
  },
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone({ freq: f, duration: 0.25, type: 'triangle', volume: 0.25, delay: i * 0.14 })
    );
    vibrate([80, 60, 80, 60, 200]);
  },
};
