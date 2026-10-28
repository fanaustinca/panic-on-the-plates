// Synthesised sound effects + a light per-world music loop (Web Audio, no sample files).
let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
const settings = { sfx: 0.8, music: 0.45 };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = settings.sfx; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = settings.music * 0.5; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function setVolumes(sfx, music) {
  settings.sfx = sfx; settings.music = music;
  if (sfxBus) sfxBus.gain.value = sfx;
  if (musicBus) musicBus.gain.value = music * 0.5;
}

function tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, slide = 0, attack = 0.005, bus = sfxBus } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, { vol = 0.3, at = 0, freq = 1200, q = 1, type = 'bandpass', bus = sfxBus, sweep = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

export const sfx = {
  grab() { tone(520, 0.08, { type: 'triangle', vol: 0.18, slide: 1.4 }); },
  drop() { tone(380, 0.08, { type: 'triangle', vol: 0.16, slide: 0.7 }); },
  chop() { noise(0.05, { vol: 0.35, freq: 2400, q: 2 }); tone(180, 0.05, { type: 'square', vol: 0.06 }); },
  chopped() { tone(660, 0.07, { type: 'triangle', vol: 0.15 }); tone(990, 0.1, { type: 'triangle', vol: 0.12, at: 0.06 }); },
  sizzle() { noise(0.6, { vol: 0.12, freq: 5000, q: 0.6, type: 'highpass' }); },
  cooked() { tone(880, 0.12, { vol: 0.15 }); tone(1320, 0.18, { vol: 0.12, at: 0.08 }); },
  warn() { tone(1200, 0.08, { type: 'square', vol: 0.08 }); },
  burnt() { noise(0.5, { vol: 0.25, freq: 400, sweep: 0.5 }); },
  fire() { noise(0.9, { vol: 0.35, freq: 600, q: 0.7, sweep: 2 }); tone(200, 0.4, { type: 'sawtooth', vol: 0.06, slide: 0.6 }); },
  spray() { noise(0.12, { vol: 0.12, freq: 3000, q: 0.5, type: 'highpass' }); },
  extinguished() { noise(0.4, { vol: 0.2, freq: 1500, sweep: 0.3 }); },
  plate() { tone(1400, 0.06, { vol: 0.12 }); tone(2100, 0.08, { vol: 0.08, at: 0.03 }); },
  deliver() { [0, 4, 7, 12].forEach((s, i) => tone(523 * 2 ** (s / 12), 0.25, { type: 'triangle', vol: 0.2, at: i * 0.07 })); tone(2093, 0.6, { vol: 0.1, at: 0.3 }); },
  wrong() { tone(220, 0.18, { type: 'square', vol: 0.12 }); tone(160, 0.25, { type: 'square', vol: 0.12, at: 0.15 }); },
  order() { tone(988, 0.08, { vol: 0.14 }); tone(1319, 0.14, { vol: 0.14, at: 0.08 }); },
  expire() { tone(392, 0.2, { type: 'sawtooth', vol: 0.1, slide: 0.7 }); tone(294, 0.35, { type: 'sawtooth', vol: 0.1, at: 0.18, slide: 0.7 }); },
  washed() { noise(0.25, { vol: 0.15, freq: 900, sweep: 1.8 }); tone(1500, 0.08, { vol: 0.08, at: 0.2 }); },
  wash() { noise(0.15, { vol: 0.08, freq: 700, q: 0.8 }); },
  jump() { tone(300, 0.15, { type: 'triangle', vol: 0.12, slide: 2 }); },
  ko() { tone(600, 0.5, { type: 'triangle', vol: 0.18, slide: 0.25 }); noise(0.3, { vol: 0.15, freq: 300 }); },
  splash() { noise(0.6, { vol: 0.3, freq: 800, sweep: 0.3 }); },
  strike() { noise(0.5, { vol: 0.45, freq: 200, q: 0.5, type: 'lowpass' }); tone(80, 0.4, { vol: 0.3, slide: 0.5 }); },
  thunder() { noise(1.4, { vol: 0.5, freq: 300, q: 0.3, type: 'lowpass', sweep: 0.3 }); },
  whoosh() { noise(1.2, { vol: 0.2, freq: 400, q: 0.6, sweep: 4 }); },
  lever() { tone(200, 0.06, { type: 'square', vol: 0.1 }); noise(0.1, { vol: 0.15, freq: 1800, at: 0.04 }); },
  monkey() { [0, 0.12, 0.24].forEach((a) => tone(900 + Math.random() * 300, 0.1, { type: 'square', vol: 0.06, at: a, slide: 1.6 })); },
  cuckoo() { tone(784, 0.2, { vol: 0.25, type: 'triangle' }); tone(622, 0.35, { vol: 0.25, type: 'triangle', at: 0.25 }); },
  tick() { tone(1800, 0.03, { type: 'square', vol: 0.05 }); },
  count(n) { tone(n ? 660 : 1320, n ? 0.18 : 0.5, { type: 'triangle', vol: 0.25 }); if (!n) tone(990, 0.5, { type: 'triangle', vol: 0.15 }); },
  ui() { tone(700, 0.05, { type: 'triangle', vol: 0.1 }); },
  star(i) { tone(784 * 2 ** (i * 4 / 12), 0.3, { type: 'triangle', vol: 0.2 }); tone(1568 * 2 ** (i * 4 / 12), 0.4, { vol: 0.08, at: 0.05 }); },
  over() { tone(523, 0.2, { type: 'square', vol: 0.1 }); tone(392, 0.2, { type: 'square', vol: 0.1, at: 0.2 }); tone(262, 0.5, { type: 'square', vol: 0.1, at: 0.4 }); },
};

// ---------------------------------------------------------------- music
// A small step sequencer. In the kitchen it is deliberately tense: minor-key driving bass,
// a 16th-note ostinato, backbeat and hats. setIntensity() adds layers and speeds it up as the
// clock runs down, orders go critical or a fire breaks out.
const SCALES = {
  pirate: [0, 2, 3, 5, 7, 8, 10], glacier: [0, 2, 3, 7, 8], volcano: [0, 1, 4, 5, 7, 8, 10], space: [0, 2, 3, 6, 7, 9, 10],
  clouds: [0, 2, 3, 5, 7, 9, 10], jungle: [0, 3, 5, 6, 7, 10], factory: [0, 1, 3, 5, 6, 8, 10], library: [0, 2, 3, 5, 7, 8, 11], lobby: [0, 2, 4, 7, 9],
};
const ROOT = { pirate: 50, glacier: 52, volcano: 45, space: 47, clouds: 53, jungle: 48, factory: 45, library: 50, lobby: 55 };
const LEAD = { pirate: 'square', glacier: 'triangle', volcano: 'sawtooth', space: 'square', clouds: 'triangle', jungle: 'square', factory: 'sawtooth', library: 'triangle', lobby: 'triangle' };
let music = null;
const mix = { level: 0, panic: 0, fire: 0, final: false };
/** k: 0..1 overall tension, panic: an order is about to expire, fire: kitchen fire, final: last 30 s */
export function setIntensity(k, { panic = false, fire = false, final = false } = {}) {
  mix.level = k; mix.panic = panic ? 1 : 0; mix.fire = fire ? 1 : 0; mix.final = final;
}
export function playMusic(world, bpm = 132) {
  stopMusic();
  if (!ctx) return;
  const calm = world === 'lobby';
  mix.level = 0; mix.panic = 0; mix.fire = 0; mix.final = false;
  const scale = SCALES[world] || SCALES.lobby, root = ROOT[world] || 55;
  const hz = (n) => 440 * 2 ** ((n - 69) / 12);
  let s = world.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483647;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const deg = (d) => scale[((d % scale.length) + scale.length) % scale.length] + 12 * Math.floor(d / scale.length);
  // 4-bar progression in scale degrees (i - VI - VII - v style motion)
  const prog = calm ? [0, 3, 4, 2] : [0, 5, 6, 4].map((d) => d % scale.length);
  const ost = Array.from({ length: 16 }, (_, i) => [0, 2, 4, 2, 0, 4, 2, 4][i % 8] + (r() < 0.25 ? 1 : 0));
  const mel = Array.from({ length: 64 }, () => (r() < 0.55 ? Math.floor(r() * 7) : null));
  let i = 0, next = ctx.currentTime + 0.1;
  const id = setInterval(() => {
    const tempo = bpm * (calm ? 1 : 1 + mix.level * 0.14 + (mix.final ? 0.12 : 0));
    const step = 60 / tempo / 4; // 16th notes
    while (next < ctx.currentTime + 0.2) {
      const at = next - ctx.currentTime;
      const b16 = i % 16, bar = Math.floor(i / 16) % 4, chord = prog[bar];
      const bus = musicBus;
      if (calm) {
        if (b16 % 8 === 0) tone(hz(root - 12 + deg(chord)), step * 7, { type: 'triangle', vol: 0.2, at, bus });
        if (b16 % 4 === 2) noise(0.03, { vol: 0.03, freq: 9000, type: 'highpass', at, bus });
        if (b16 % 2 === 0 && mel[i % 64] != null) tone(hz(root + 12 + deg(chord + mel[i % 64])), step * 1.8, { type: 'triangle', vol: 0.06, at, bus });
        if (b16 === 0 || b16 === 10) tone(55, 0.14, { vol: 0.18, slide: 0.5, at, bus });
      } else {
        // kick: four on the floor, doubled in the final stretch
        if (b16 % 4 === 0 || (mix.final && b16 % 4 === 2 && b16 > 8)) tone(62, 0.16, { vol: 0.34, slide: 0.4, at, bus });
        // driving 8th-note bass, octave jumps
        if (b16 % 2 === 0) tone(hz(root - 24 + deg(chord) + (b16 % 4 === 2 ? 12 : 0)), step * 1.6, { type: 'sawtooth', vol: 0.11, at, bus });
        // snare backbeat
        if (b16 === 4 || b16 === 12) noise(0.13, { vol: 0.13, freq: 1900, q: 0.8, at, bus });
        if (mix.level > 0.5 && b16 === 15) noise(0.06, { vol: 0.08, freq: 2400, at, bus });
        // hats: 8ths, 16ths once things heat up
        if (b16 % 2 === 1 || mix.level > 0.35) noise(0.03, { vol: b16 % 2 ? 0.05 : 0.03, freq: 9000, type: 'highpass', at, bus });
        // tense 16th ostinato
        tone(hz(root + deg(chord + ost[b16])), step * 0.8, { type: LEAD[world], vol: 0.035 + mix.level * 0.02, at, bus });
        // stabs / lead line on top as it gets hot
        if (mix.level > 0.3 && b16 % 2 === 0 && mel[i % 64] != null) tone(hz(root + 12 + deg(chord + mel[i % 64])), step * 1.5, { type: 'square', vol: 0.03 + mix.level * 0.025, at, bus });
        // order about to expire: urgent semitone pulse
        if (mix.panic && b16 % 4 === 0) tone(hz(root + 24 + 1), step * 0.7, { type: 'square', vol: 0.03, at, bus });
        // fire: alarm whoop every bar
        if (mix.fire && b16 === 0) tone(700, step * 6, { type: 'triangle', vol: 0.05, slide: 1.5, at, bus });
        // final 30 s: clock tick on every beat + rising riser each 4 bars
        if (mix.final && b16 % 4 === 0) tone(2400, 0.02, { type: 'square', vol: 0.05, at, bus });
        if (mix.final && bar === 3 && b16 === 0) noise(step * 16, { vol: 0.05, freq: 500, q: 2, sweep: 8, at, bus });
      }
      next += step; i++;
    }
  }, 40);
  music = { id };
}
export function stopMusic() { if (music) { clearInterval(music.id); music = null; } }
