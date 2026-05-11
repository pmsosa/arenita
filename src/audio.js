// Web Audio API sound effects — no external files needed

let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function playTone(freq, type, duration, gainVal = 0.15, time = 0) {
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainVal, ac.currentTime + time);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + time + duration);
    osc.start(ac.currentTime + time);
    osc.stop(ac.currentTime + time + duration + 0.01);
  } catch {}
}

function playNoise(duration, gainVal = 0.1) {
  try {
    const ac = getCtx();
    const bufSize = ac.sampleRate * duration;
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(gainVal, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    src.connect(gain);
    gain.connect(ac.destination);
    src.start();
  } catch {}
}

export const audio = {
  move()    { playTone(220, 'sine', 0.02, 0.08); },
  rotate()  { playTone(440, 'sine', 0.02, 0.08); },
  lock()    { playNoise(0.08, 0.12); },
  clear()   {
    playTone(523, 'sine', 0.05, 0.12, 0.00);
    playTone(659, 'sine', 0.05, 0.12, 0.05);
    playTone(784, 'sine', 0.10, 0.12, 0.10);
  },
  garbage() { playTone(180, 'sawtooth', 0.1, 0.1); },
  gameover() {
    for (let i = 0; i < 5; i++) {
      playTone(440 - i * 60, 'sine', 0.15, 0.1, i * 0.12);
    }
  },
};
