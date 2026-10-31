// Synthesised sound effects + a light per-world music loop (Web Audio, no sample files).
let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
const settings = { sfx: 0.8, music: 0.45 };
const MUSIC_GAIN = 1.25; // music bus level (was 0.5: too quiet under the sound effects)

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = settings.sfx; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = settings.music * MUSIC_GAIN; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function setVolumes(sfx, music) {
  settings.sfx = sfx; settings.music = music;
  if (sfxBus) sfxBus.gain.value = sfx;
  if (musicBus) musicBus.gain.value = music * MUSIC_GAIN;
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
  fall() { tone(900, 0.9, { type: 'triangle', vol: 0.16, slide: 0.2 }); noise(0.5, { vol: 0.12, freq: 600, sweep: 0.4, at: 0.5 }); },
  drift() { tone(500, 1.4, { type: 'sine', vol: 0.15, slide: 0.3 }); tone(503, 1.4, { type: 'sine', vol: 0.1, slide: 0.29 }); },
  splash() { noise(0.6, { vol: 0.3, freq: 800, sweep: 0.3 }); },
  strike() { noise(0.5, { vol: 0.45, freq: 200, q: 0.5, type: 'lowpass' }); tone(80, 0.4, { vol: 0.3, slide: 0.5 }); },
  cannonFire() { noise(0.9, { vol: 0.22, freq: 160, q: 0.4, type: 'lowpass', sweep: 0.5 }); tone(55, 0.6, { vol: 0.22, slide: 0.6 }); },
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
// A small step sequencer. Every level has four procedural tracks of its own, seeded from the level:
// two for the shift (one picked at random each round) and two for the last 30 seconds (likewise),
// each with its own groove, progression, motif and lead voice. The tempo never changes mid-song:
// tension comes from the arrangement. The lobby plays one fixed, hand-written tune.
const SCALES = {
  pirate: [0, 2, 3, 5, 7, 8, 10], glacier: [0, 2, 3, 7, 8], volcano: [0, 1, 4, 5, 7, 8, 10], space: [0, 2, 3, 6, 7, 9, 10],
  clouds: [0, 2, 3, 5, 7, 9, 10], jungle: [0, 3, 5, 6, 7, 10], factory: [0, 1, 3, 5, 6, 8, 10], library: [0, 2, 3, 5, 7, 8, 11],
};
const ROOT = { pirate: 50, glacier: 52, volcano: 45, space: 47, clouds: 53, jungle: 48, factory: 45, library: 50 };
const LEAD = { pirate: 'square', glacier: 'triangle', volcano: 'sawtooth', space: 'square', clouds: 'triangle', jungle: 'square', factory: 'sawtooth', library: 'triangle' };
const PROGS = [[0, 5, 6, 4], [0, 3, 4, 0], [0, 6, 5, 6], [0, 2, 5, 4], [0, 4, 5, 3], [0, 5, 3, 6]];
const GROOVES = ['drive', 'shuffle', 'halftime', 'gallop'];
const FINALS = ['war', 'chase'];
let music = null;
const mix = { level: 0, panic: 0, fire: 0, final: false };
const hz = (n) => 440 * 2 ** ((n - 69) / 12);
const seeded = (str) => { let s = str.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 2147483647, 7) || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

/** One procedural track: groove + progression + motifs, all from a seed string. */
function makeTrack(world, seed, kinds) {
  const r = seeded(seed);
  const scale = SCALES[world] || SCALES.pirate;
  return {
    kind: kinds[Math.floor(r() * kinds.length)],
    scale, root: (ROOT[world] || 50) + [0, 0, 2, -2, 3][Math.floor(r() * 5)],
    prog: PROGS[Math.floor(r() * PROGS.length)].map((d) => d % scale.length),
    ost: Array.from({ length: 16 }, (_, i) => [0, 2, 4, 2, 0, 4, 2, 4, 0, 1, 2, 4, 2, 1, 0, 4][(i + Math.floor(r() * 3)) % 16] + (r() < 0.25 ? 1 : 0)),
    mel: Array.from({ length: 64 }, () => (r() < 0.55 ? Math.floor(r() * 7) : null)),
    lead: r() < 0.5 ? LEAD[world] || 'square' : ['square', 'triangle', 'sawtooth'][Math.floor(r() * 3)],
  };
}

/** k: 0..1 overall tension, panic: an order is about to expire, fire: kitchen fire, final: last 30 s */
export function setIntensity(k, { panic = false, fire = false, final = false } = {}) {
  mix.level = k; mix.panic = panic ? 1 : 0; mix.fire = fire ? 1 : 0; mix.final = final;
}
/** world: world id or 'lobby'; key: the level (e.g. '3-4') whose four tracks to draw from. */
export function playMusic(world, bpm = 132, key = '') {
  stopMusic();
  if (!ctx) return;
  mix.level = 0; mix.panic = 0; mix.fire = 0; mix.final = false;
  if (world === 'lobby') { lobbyMusic(); return; }
  const pick = Math.random() < 0.5 ? 0 : 1, pickF = Math.random() < 0.5 ? 0 : 1;
  // the two shift tracks of a level always differ in groove, and so do the two finales
  const base = makeTrack(world, `${world}-${key}-n0`, GROOVES);
  const alt = makeTrack(world, `${world}-${key}-n1`, GROOVES.filter((g) => g !== base.kind));
  const fin0 = makeTrack(world, `${world}-${key}-f0`, FINALS);
  const fin1 = makeTrack(world, `${world}-${key}-f1`, FINALS.filter((g) => g !== fin0.kind));
  const main = pick ? alt : base, fin = pickF ? fin1 : fin0;
  const tempo = bpm + (main.kind === 'halftime' ? 8 : main.kind === 'shuffle' ? -6 : 0);
  let i = 0, next = ctx.currentTime + 0.1, finalArr = false;
  const id = setInterval(() => {
    const step = 60 / tempo / 4; // 16th notes
    while (next < ctx.currentTime + 0.2) {
      const at = next - ctx.currentTime, b16 = i % 16, bar = Math.floor(i / 16) % 4;
      if (b16 === 0 && mix.final !== finalArr) {
        finalArr = mix.final; // the finale only switches in on a bar line
        if (finalArr) { noise(1.6, { vol: 0.16, freq: 5000, q: 0.4, at, bus: musicBus }); tone(40, 1.2, { vol: 0.35, slide: 0.5, at, bus: musicBus }); }
      }
      const T = finalArr ? fin : main;
      const deg = (d) => T.scale[((d % T.scale.length) + T.scale.length) % T.scale.length] + 12 * Math.floor(d / T.scale.length);
      PLAY[T.kind]({ T, deg, chord: T.prog[bar], b16, bar, i, at, step, bus: musicBus });
      next += step; i++;
    }
  }, 40);
  music = { id };
}
export function stopMusic() { if (music) { clearInterval(music.id); music = null; } }

// Shared layers that react to the kitchen in every groove.
function alarms({ T, deg, chord, b16, at, step, bus }) {
  if (mix.panic && b16 % 4 === 0) tone(hz(T.root + 24 + 1), step * 0.7, { type: 'square', vol: 0.03, at, bus });
  if (mix.fire && b16 === 0) tone(700, step * 6, { type: 'triangle', vol: 0.05, slide: 1.5, at, bus });
}

const PLAY = {
  // four on the floor, octave-jumping 8th bass, 16th ostinato (the original tune)
  drive(a) {
    const { T, deg, chord, b16, i, at, step, bus } = a;
    if (b16 % 4 === 0) tone(62, 0.16, { vol: 0.34, slide: 0.4, at, bus });
    if (b16 % 2 === 0) tone(hz(T.root - 24 + deg(chord) + (b16 % 4 === 2 ? 12 : 0)), step * 1.6, { type: 'sawtooth', vol: 0.11, at, bus });
    if (b16 === 4 || b16 === 12) noise(0.13, { vol: 0.13, freq: 1900, q: 0.8, at, bus });
    if (b16 % 2 === 1 || mix.level > 0.35) noise(0.03, { vol: b16 % 2 ? 0.05 : 0.03, freq: 9000, type: 'highpass', at, bus });
    tone(hz(T.root + deg(chord + T.ost[b16])), step * 0.8, { type: T.lead, vol: 0.035 + mix.level * 0.02, at, bus });
    if (mix.level > 0.3 && b16 % 2 === 0 && T.mel[i % 64] != null) tone(hz(T.root + 12 + deg(chord + T.mel[i % 64])), step * 1.5, { type: 'square', vol: 0.03 + mix.level * 0.025, at, bus });
    alarms(a);
  },
  // swung 8ths, walking bass, clap backbeat, plucked melody
  shuffle(a) {
    const { T, deg, chord, b16, i, step, bus } = a;
    if (b16 % 2) return;
    const at = a.at + (b16 % 4 === 2 ? step * 0.34 : 0);
    if (b16 === 0 || b16 === 10) tone(60, 0.18, { vol: 0.32, slide: 0.4, at, bus });
    if (b16 === 4 || b16 === 12) { noise(0.09, { vol: 0.12, freq: 1400, q: 1.2, at, bus }); noise(0.07, { vol: 0.08, freq: 2200, q: 1, at: at + 0.012, bus }); }
    noise(0.04, { vol: b16 % 4 ? 0.045 : 0.03, freq: 8000, type: 'highpass', at, bus });
    if (b16 % 4 === 0) tone(hz(T.root - 24 + deg(chord + [0, 2, 4, 5][b16 / 4])), step * 3.4, { type: 'triangle', vol: 0.16, at, bus });
    if (b16 % 8 === 0) for (const k of [0, 2, 4]) tone(hz(T.root + deg(chord + k)), step * 2.2, { type: 'triangle', vol: 0.025, at: at + step * 2, bus });
    if (T.mel[i % 64] != null) tone(hz(T.root + 12 + deg(chord + T.mel[i % 64])), step * 1.4, { type: T.lead, vol: 0.03 + mix.level * 0.02, at, bus });
    alarms(a);
  },
  // half-time: big kick on 1, snare on 3, long syncopated bass, rolling triangle arpeggio
  halftime(a) {
    const { T, deg, chord, b16, i, at, step, bus } = a;
    if (b16 === 0 || b16 === 7) tone(55, 0.24, { vol: 0.38, slide: 0.35, at, bus });
    if (b16 === 8) { noise(0.2, { vol: 0.16, freq: 1700, q: 0.7, at, bus }); tone(180, 0.1, { vol: 0.1, slide: 0.6, at, bus }); }
    if (b16 % 2 === 0) noise(0.03, { vol: 0.035, freq: 10000, type: 'highpass', at, bus });
    if (b16 === 0 || b16 === 6 || b16 === 11) tone(hz(T.root - 24 + deg(chord)), step * (b16 === 0 ? 5.5 : 3.5), { type: 'sawtooth', vol: 0.12, at, bus });
    if (b16 % 2 === 0) tone(hz(T.root + 12 + deg(chord + [0, 2, 4, 6, 4, 2, 0, 2][b16 / 2])), step * 1.8, { type: 'triangle', vol: 0.035 + mix.level * 0.015, at, bus });
    if (mix.level > 0.3 && b16 % 4 === 0 && T.mel[i % 64] != null) tone(hz(T.root + 12 + deg(chord + T.mel[i % 64])), step * 3, { type: T.lead, vol: 0.03 + mix.level * 0.02, at, bus });
    alarms(a);
  },
  // gallop: tresillo kicks, galloping bass, staccato lead
  gallop(a) {
    const { T, deg, chord, b16, i, at, step, bus } = a;
    if ([0, 3, 6, 8, 11, 14].includes(b16)) tone(64, 0.14, { vol: b16 % 8 === 0 ? 0.36 : 0.24, slide: 0.4, at, bus });
    if (b16 === 4 || b16 === 12) noise(0.12, { vol: 0.13, freq: 2100, q: 0.8, at, bus });
    if (b16 % 4 !== 1) tone(hz(T.root - 24 + deg(chord) + (b16 % 8 === 6 ? 7 : 0)), step * 0.8, { type: 'sawtooth', vol: 0.1, at, bus });
    noise(0.025, { vol: 0.03, freq: 9500, type: 'highpass', at, bus });
    if (b16 % 4 !== 3) tone(hz(T.root + 12 + deg(chord + T.ost[b16])), step * 0.45, { type: T.lead, vol: 0.03 + mix.level * 0.02, at, bus });
    if (mix.level > 0.3 && b16 % 2 === 0 && T.mel[i % 64] != null) tone(hz(T.root + 24 + deg(chord + T.mel[i % 64])), step * 1.2, { type: 'triangle', vol: 0.03 + mix.level * 0.02, at, bus });
    alarms(a);
  },
  // FINALE A: war drums, 16th pedal bass, dissonant pad, shimmering ostinato, ticking clock
  war(a) {
    const { T, deg, chord, b16, bar, i, at, step, bus } = a;
    if (b16 % 4 === 0) tone(58, 0.2, { vol: 0.38, slide: 0.35, at, bus });
    if ([3, 6, 10, 14].includes(b16)) tone(b16 === 14 ? 120 : 92, 0.18, { vol: 0.2, slide: 0.55, at, bus });
    if (b16 === 4 || b16 === 12 || (bar === 3 && b16 >= 8)) noise(0.12, { vol: bar === 3 && b16 >= 8 ? 0.06 + (b16 - 8) * 0.012 : 0.14, freq: 2000, q: 0.8, at, bus });
    noise(0.025, { vol: b16 % 2 ? 0.05 : 0.025, freq: 10000, type: 'highpass', at, bus });
    tone(hz(T.root - 24 + deg(chord) + (b16 % 4 === 2 ? 12 : 0)), step * 0.85, { type: 'sawtooth', vol: 0.1, at, bus });
    if (b16 === 0) { tone(hz(T.root + deg(chord)), step * 16, { type: 'sawtooth', vol: 0.03, at, bus }); tone(hz(T.root + deg(chord) + 1), step * 16, { type: 'sawtooth', vol: 0.022, at, bus }); tone(hz(T.root + 12 + deg(chord + 2)), step * 16, { type: 'triangle', vol: 0.03, at, bus }); }
    const on = hz(T.root + 12 + deg(chord + T.ost[b16]));
    tone(on, step * 0.7, { type: T.lead, vol: 0.04, at, bus });
    tone(on * 1.006, step * 0.7, { type: 'square', vol: 0.018, at, bus });
    if (b16 % 2 === 0 && T.mel[i % 64] != null) tone(hz(T.root + 12 + deg(chord + T.mel[i % 64])), step * 1.2, { type: 'sawtooth', vol: 0.045, at, bus });
    if (b16 % 2 === 0) tone(b16 % 4 === 0 ? 2400 : 1800, 0.02, { type: 'square', vol: 0.045, at, bus });
    if (bar === 3 && b16 === 0) noise(step * 16, { vol: 0.06, freq: 500, q: 2, sweep: 8, at, bus });
    alarms(a);
  },
  // FINALE B: the chase. Breakbeat, up-down 16th arpeggio climbing each bar, siren lead
  chase(a) {
    const { T, deg, chord, b16, bar, i, at, step, bus } = a;
    if (b16 === 0 || b16 === 10 || (b16 === 7 && bar % 2)) tone(60, 0.15, { vol: 0.36, slide: 0.4, at, bus });
    if (b16 === 4 || b16 === 12) noise(0.13, { vol: 0.15, freq: 2000, q: 0.8, at, bus });
    if ([2, 9, 14].includes(b16)) noise(0.05, { vol: 0.05, freq: 2300, q: 1, at, bus });
    noise(0.02, { vol: 0.04, freq: 11000, type: 'highpass', at, bus });
    tone(hz(T.root - 24 + deg(chord) + (b16 % 2 ? 12 : 0)), step * 0.7, { type: 'square', vol: 0.06, at, bus });
    const arp = [0, 2, 4, 7, 4, 2][b16 % 6] + bar;
    tone(hz(T.root + 12 + deg(chord + arp)), step * 0.6, { type: T.lead, vol: 0.04, at, bus });
    if (b16 === 0 || b16 === 8) tone(hz(T.root + 24 + deg(chord + 4)), step * 7, { type: 'triangle', vol: 0.035, slide: 1.06, at, bus });
    if (b16 % 4 === 2 && T.mel[i % 64] != null) tone(hz(T.root + 24 + deg(chord + T.mel[i % 64])), step * 1.4, { type: 'sawtooth', vol: 0.03, at, bus });
    if (bar === 3 && b16 === 8) noise(step * 8, { vol: 0.07, freq: 600, q: 2, sweep: 6, at, bus });
    alarms(a);
  },
};

// ---- the lobby theme: a relaxed, hand-written tune in G major (I - vi - IV - V, then a bridge)
const LOBBY = {
  bpm: 104,
  chords: [[55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57], [55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57],
    [48, 52, 55], [50, 54, 57], [47, 50, 55], [52, 55, 59], [48, 52, 55], [50, 54, 57], [55, 59, 62], [50, 54, 57]],
  // melody: one entry per 8th note (16 bars x 8), MIDI note or 0 for rest, - to hold
  mel: [
    74, 0, 71, 72, 74, '-', 79, '-', 76, '-', 74, 72, 71, '-', 0, 0, 72, 0, 69, 71, 72, '-', 76, '-', 74, '-', 72, 71, 69, '-', 0, 0,
    74, 0, 71, 72, 74, '-', 79, '-', 81, '-', 79, 76, 74, '-', 0, 0, 72, 74, 76, 74, 72, '-', 71, '-', 69, '-', 66, '-', 67, '-', 0, 0,
    76, '-', 72, '-', 67, '-', 72, 74, 74, '-', 69, '-', 66, '-', 69, 71, 71, '-', 67, '-', 62, '-', 67, 69, 71, '-', 72, '-', 74, '-', 76, '-',
    76, '-', 72, '-', 69, 72, 76, 79, 78, '-', 74, '-', 69, 0, 74, 72, 71, '-', 74, '-', 79, '-', 0, 0, 74, '-', 72, '-', 71, '-', 69, '-',
  ],
};
function lobbyMusic() {
  const L = LOBBY, step = 60 / L.bpm / 4, bus = musicBus;
  let i = 0, next = ctx.currentTime + 0.1;
  const id = setInterval(() => {
    while (next < ctx.currentTime + 0.2) {
      const at = next - ctx.currentTime, b16 = i % 16, bar = Math.floor(i / 16) % 16, ch = L.chords[bar];
      // soft brushed drums
      if (b16 === 0 || b16 === 10) tone(58, 0.16, { vol: 0.2, slide: 0.5, at, bus });
      if (b16 === 4 || b16 === 12) noise(0.12, { vol: 0.05, freq: 3000, q: 0.5, at, bus });
      if (b16 % 2 === 0) noise(0.03, { vol: b16 % 4 ? 0.025 : 0.015, freq: 9000, type: 'highpass', at, bus });
      // bass: root on 1, fifth on the and of 2, root again on 4
      if (b16 === 0 || b16 === 12) tone(hz(ch[0] - 12), step * 3.5, { type: 'triangle', vol: 0.2, at, bus });
      if (b16 === 6) tone(hz(ch[2] - 12), step * 2, { type: 'triangle', vol: 0.15, at, bus });
      // comping chords on the offbeats, like a little electric piano
      if (b16 === 2 || b16 === 8 || b16 === 14) ch.forEach((n) => tone(hz(n), step * 2.4, { type: 'sine', vol: 0.045, at, bus }));
      // melody (8th notes, held notes tied)
      if (b16 % 2 === 0) {
        const k = (i / 2) % L.mel.length, n = L.mel[k];
        if (n && n !== '-') {
          let len = 1;
          while (L.mel[(k + len) % L.mel.length] === '-') len++;
          tone(hz(n), step * 2 * len * 0.95, { type: 'triangle', vol: 0.075, at, bus });
          tone(hz(n + 12), step * 2 * len * 0.6, { type: 'sine', vol: 0.02, at, bus });
        }
      }
      next += step; i++;
    }
  }, 40);
  music = { id };
}
