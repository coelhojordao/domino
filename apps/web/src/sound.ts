// Sons sintetizados (sem arquivos de áudio): batida da peça, passe, compra, vitória.
let ctx: AudioContext | null = null;
let muted = localStorage.getItem('muted') === '1';

function ac() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noiseHit(freq: number, dur: number, gain: number) {
  if (muted) return;
  const c = ac();
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 2.5;
  const g = c.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start();
}

function tone(freqs: number[], step = 0.09) {
  if (muted) return;
  const c = ac();
  freqs.forEach((fr, i) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = 'triangle'; o.frequency.value = fr;
    const t0 = c.currentTime + i * step;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.12, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
    o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + 0.32);
  });
}

export const sfx = {
  clack: () => { noiseHit(2600, 0.05, 0.9); setTimeout(() => noiseHit(1400, 0.04, 0.4), 18); },
  pass: () => tone([330, 247], 0.08),
  draw: () => noiseHit(900, 0.08, 0.5),
  win: () => tone([523, 659, 784, 1047]),
  lose: () => tone([392, 330, 262]),
  isMuted: () => muted,
  toggle: () => { muted = !muted; localStorage.setItem('muted', muted ? '1' : '0'); return muted; },
};
