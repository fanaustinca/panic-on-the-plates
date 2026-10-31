// Synthesised sound effects + a light per-world music loop (Web Audio, no sample files).
let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
const settings = { sfx: 0.8, music: 0.45 };
const MUSIC_GAIN = 1.6; // music bus level (was 0.5, then 1.25: too quiet under the sound effects)

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
// Hand-written songs, two per world, each a verse (A) and a chorus (B) of 8 bars, in that world's style:
// a 6/8 sea shanty on the ship, music-box bells on the glacier, a calypso in the jungle, a harpsichord
// toccata in the clock tower... A round plays one of the two songs (the "shift" arrangement) and the last
// 30 seconds cut to a heavier battle arrangement of one of them, chorus first. That's the four tracks of a
// level; each level also sits in its own key. The tempo never changes mid-song. The lobby has its own tune.
let music = null;
const mix = { level: 0, panic: 0, fire: 0, final: false };
const hz = (n) => 440 * 2 ** ((n - 69) / 12);
const seeded = (str) => { let s = str.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 2147483647, 7) || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pc = (l, acc) => PC[l] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0);
/** 'Dm' / 'A7' / 'Bb' -> chord tones as MIDI notes, root in octave 3 */
function chordOf(name) {
  const [, l, acc, q, sev] = name.match(/^([A-G])([#b]?)(m|dim)?(7)?$/);
  const r = 48 + pc(l, acc);
  const t = [r, r + (q ? 3 : 4), r + (q === 'dim' ? 6 : 7)];
  if (sev) t.push(r + (q === 'm' ? 10 : 10));
  return t;
}
/** chords: 8 names; mel: 8 bars of 8th notes ('D5' note, '-' hold, '.' rest) -> {ch, mel: [{n, len}|null per 8th]} */
function section(chords, mel, meter) {
  const toks = mel.trim().split(/\s*\|\s*/).flatMap((b) => {
    const t = b.split(/\s+/);
    if (t.length !== meter) throw new Error(`bar "${b}" has ${t.length} 8ths, not ${meter}`);
    return t;
  });
  const out = toks.map((t, i) => {
    const m = t.match(/^([A-G])([#b]?)(\d)$/);
    if (!m) return null;
    let len = 1;
    while (toks[i + len] === '-') len++;
    return { n: 12 * (+m[3] + 1) + pc(m[1], m[2]), len };
  });
  return { ch: chords.trim().split(/\s+/).map(chordOf), mel: out };
}
const song = (name, bpm, meter, beat, A, B) => ({ name, bpm, meter, beat, A: section(A[0], A[1], meter), B: section(B[0], B[1], meter) });

const SONGS = {
  // swashbuckling 6/8 shanties
  pirate: [
    song('Plank & Pan', 72, 6, 3,
      ['Dm Dm Bb C Dm Gm A Dm', 'D5 - A4 D5 - F5 | E5 - D5 C5 - A4 | Bb4 - D5 F5 - D5 | E5 - - C5 . . | D5 - A4 D5 - F5 | G5 - F5 E5 - D5 | C#5 - E5 A5 - G5 | F5 - E5 D5 . .'],
      ['F C Dm Bb Gm Dm A Dm', 'A5 - - F5 - A5 | G5 - - E5 - C5 | F5 - E5 D5 - A4 | Bb4 - C5 D5 - - | G5 - - Bb5 - G5 | F5 - - A5 - F5 | E5 - D5 C#5 - E5 | D5 - - - . .']),
    song('Cannon Jig', 76, 6, 3,
      ['Am G Am E Am F E Am', 'E5 A5 G5 E5 D5 C5 | D5 G5 F5 D5 C5 B4 | C5 E5 A5 E5 C5 A4 | B4 - G#4 E4 - - | E5 A5 G5 E5 D5 C5 | F5 A5 G5 F5 E5 D5 | E5 G#5 B5 A5 G#5 E5 | A5 - E5 A4 . .'],
      ['F G Am E F G E Am', 'C6 - A5 F5 - A5 | B5 - G5 D5 - G5 | C6 - B5 A5 - E5 | G#5 - - E5 - - | A5 - F5 C5 - F5 | G5 - D5 B4 - D5 | E5 F5 E5 D5 C5 B4 | A4 - - - . .']),
  ],
  // music-box bells and a frosty polka
  glacier: [
    song('Snowglobe', 112, 8, 2,
      ['Em C Am B Em C D Em', 'B4 E5 G5 B5 A5 G5 F#5 G5 | E5 - - . C5 E5 G5 E5 | A5 G5 E5 C5 D5 E5 - . | F#5 - D#5 - B4 - . . | B4 E5 G5 B5 A5 G5 F#5 G5 | E6 - D6 C6 B5 - G5 - | A5 F#5 D5 F#5 A5 - C6 B5 | G5 - E5 - . . . .'],
      ['G D Em C G D B Em', 'D6 - B5 G5 D6 - B5 G5 | F#5 - A5 - D5 - . . | E5 G5 B5 E6 D6 B5 G5 B5 | C6 - B5 - A5 - G5 - | D6 - B5 G5 D6 - B5 G5 | A5 - F#5 - D6 - C6 - | D#5 F#5 B5 A5 G5 F#5 E5 D#5 | E5 - - - . . . .']),
    song('Frostbite Polka', 128, 8, 2,
      ['G D G D G C D G', 'D5 . B4 . D5 G5 - . | F#5 . D5 . A4 D5 - . | B4 D5 G5 B5 A5 G5 F#5 E5 | D5 - A4 - D5 . . . | D5 . B4 . D5 G5 - . | E5 . C5 . E5 A5 - . | F#5 A5 D6 C6 B5 A5 G5 F#5 | G5 - D5 - G4 . . .'],
      ['C G D G C G D G', 'E5 E5 G5 - E5 E5 C6 - | B5 - G5 - D5 - . . | F#5 F#5 A5 - F#5 F#5 D6 - | B5 - - - G5 . . . | E5 E5 G5 - E5 E5 C6 - | D6 - B5 - G5 - B5 - | A5 - F#5 - E5 - F#5 - | G5 - - - . . . .']),
  ],
  // stomping riffs in the Phrygian-dominant mode
  volcano: [
    song('Magma Stomp', 120, 8, 2,
      ['A A Dm A A A Bb A', 'A4 . A4 Bb4 C#5 - A4 . | E5 . D5 C#5 Bb4 - A4 . | D5 . D5 E5 F5 - D5 . | C#5 - Bb4 - A4 - . . | A4 . A4 Bb4 C#5 - A4 . | E5 . F5 E5 D5 - C#5 . | D5 - Bb4 - F5 - E5 D5 | C#5 - - - A4 . . .'],
      ['Dm A Bb A Dm Gm Bb A', 'A5 - - F5 D5 - F5 A5 | G5 - F5 E5 C#5 - E5 - | F5 - - D5 Bb4 - D5 F5 | E5 - - - . . . . | A5 - - F5 D5 - F5 A5 | Bb5 - A5 G5 F5 - E5 F5 | D5 - E5 F5 G5 - F5 E5 | A5 - - - . . . .']),
    song('Fire Dance', 120, 8, 2,
      ['Em Em Am B Em C B Em', 'E5 E5 . G5 F#5 E5 D#5 E5 | B4 - . B4 C5 B4 A4 B4 | C5 C5 . E5 D5 C5 B4 C5 | D#5 - F#5 - B5 - . . | E5 E5 . G5 F#5 E5 D#5 E5 | G5 - F#5 E5 C5 - E5 G5 | F#5 G5 F#5 E5 D#5 - B4 . | E5 - - - . . . .'],
      ['Em C Am B Em C B Em', 'B5 . B5 . A5 G5 F#5 G5 | E5 - - - C5 - E5 - | A5 . A5 . G5 F#5 E5 F#5 | D#5 - - - B4 - . . | B5 . B5 . A5 G5 F#5 G5 | E6 - D6 C6 B5 - A5 - | B5 C6 B5 A5 G5 - F#5 - | E5 - - - . . . .']),
  ],
  // retro synthwave
  space: [
    song('Orbit Omelette', 116, 8, 2,
      ['Bm G D A Bm G D A', 'F#5 - B4 - D5 - F#5 E5 | D5 - B4 - . G4 B4 D5 | F#5 - A5 - F#5 - E5 D5 | E5 - - - C#5 - . . | F#5 - B4 - D5 - F#5 E5 | D5 - G5 - F#5 - E5 D5 | A5 - F#5 - D5 - E5 F#5 | E5 - - - . . . .'],
      ['Bm G D A Bm G Em F#', 'B5 - A5 - F#5 - D5 E5 | G5 - F#5 - D5 - B4 . | A5 - F#5 - D5 - F#5 A5 | C#6 - - - A5 - . . | B5 - A5 - F#5 - D5 E5 | G5 - B5 - D6 - B5 - | A5 G5 F#5 E5 D5 - E5 - | F#5 - - - . . . .']),
    song('Zero-G Groove', 108, 8, 2,
      ['Em A Em A Em A C B', 'E5 . G5 E5 . A5 . G5 | . E5 - D5 E5 . . . | E5 . G5 E5 . B5 . A5 | G5 - E5 - D5 - . . | E5 . G5 E5 . A5 . G5 | . E5 - D5 E5 . G5 A5 | B5 - A5 G5 . E5 . G5 | F#5 - - - D#5 - . .'],
      ['C D Em Em C D Am B', 'G5 - - E5 G5 - A5 - | F#5 - - D5 F#5 - A5 - | B5 - A5 G5 E5 - G5 - | E5 - - - . . . . | G5 - - E5 G5 - C6 - | B5 - - A5 F#5 - D5 - | E5 - G5 - A5 - C6 - | B5 - - - . . . .']),
  ],
  // breezy ukulele pop and a feather-light waltz
  clouds: [
    song('Sky High Souffle', 100, 8, 2,
      ['F C Dm Bb F C C F', 'C5 F5 A5 - G5 F5 - . | E5 G5 C6 - Bb5 A5 G5 - | A5 - F5 - D5 - F5 A5 | G5 - - F5 D5 - . . | C5 F5 A5 - G5 F5 - . | E5 G5 C6 - D6 C6 Bb5 - | Bb5 A5 G5 - E5 G5 C5 - | F5 - - - . . . .'],
      ['Bb F Gm C Bb F C F', 'D6 - C6 Bb5 - F5 - . | C6 - A5 F5 - C5 - . | Bb5 - A5 G5 - D5 - G5 | A5 - - - G5 - . . | D6 - C6 Bb5 - F5 - Bb5 | C6 - A5 F5 - A5 C6 - | E6 - D6 C6 - Bb5 - G5 | F5 - - - . . . .']),
    song('Feather Waltz', 150, 6, 2,
      ['F C Dm C Bb F C7 F', 'A5 - - - C6 - | G5 - - - E5 - | F5 - A5 - D6 - | C6 - - - . . | D6 - - - Bb5 - | A5 - - - F5 - | G5 - A5 - Bb5 - | A5 - - - . .'],
      ['Dm Am Bb F Gm F C7 F', 'D6 - E6 - F6 - | E6 - - - C6 - | D6 - C6 - Bb5 - | A5 - - - F5 - | G5 - A5 - Bb5 - | A5 - - - F5 - | E5 - F5 - G5 - | F5 - - - . .']),
  ],
  // calypso marimbas and a tribal vine swing
  jungle: [
    song('Banana Bounce', 112, 8, 2,
      ['C F G C C F G C', 'G5 - E5 G5 - E5 C5 . | A5 - F5 A5 - F5 C5 . | B5 - G5 B5 - D6 C6 B5 | C6 - - G5 - - . . | G5 - E5 G5 - E5 C5 . | A5 - F5 A5 - C6 A5 F5 | D5 - E5 F5 - G5 B4 D5 | C5 - - - . . . .'],
      ['F C G C F C G C', 'A5 A5 - A5 - G5 F5 - | G5 G5 - G5 - E5 C5 - | D5 D5 - E5 - F5 G5 - | E5 - - - C5 - . . | A5 A5 - A5 - G5 F5 - | G5 G5 - G5 - C6 - - | B5 - A5 G5 - F5 D5 - | C5 - - - . . . .']),
    song('Vine Swing', 108, 8, 2,
      ['Am Am G Am Am F G Am', 'A4 C5 D5 E5 - G5 E5 D5 | C5 - A4 - . . . . | G4 B4 D5 G5 - A5 G5 E5 | E5 - D5 - C5 - . . | A4 C5 D5 E5 - G5 E5 D5 | C5 - F5 - A5 - G5 F5 | G5 - E5 D5 - B4 D5 - | A4 - - - . . . .'],
      ['Am G F E Am G E Am', 'E6 - D6 C6 A5 - C6 D6 | D6 - - B5 G5 - . . | C6 - A5 G5 F5 - A5 C6 | B5 - - - G#5 - . . | E6 - D6 C6 A5 - C6 D6 | D6 - - B5 G5 - E6 D6 | C6 B5 A5 G#5 B5 - E5 - | A5 - - - . . . .']),
  ],
  // clanky funk and a chiptune
  factory: [
    song('Assembly Line', 120, 8, 2,
      ['Am Am F E Am Am F E', 'A4 A4 . C5 . D5 . E5 | . G5 . E5 D5 C5 . . | A4 A4 . C5 . D5 . F5 | . E5 . D5 B4 G#4 . . | A4 A4 . C5 . D5 . E5 | . G5 . A5 . C6 . A5 | G5 . E5 . D5 . C5 D5 | E5 - - - . . . .'],
      ['Dm Am Dm E F G E Am', 'F5 . F5 . A5 . D6 . | C6 . B5 . A5 - . . | F5 . F5 . A5 . D6 . | B5 . G#5 . E5 - . . | A5 . A5 . C6 . A5 . | B5 . B5 . D6 . B5 . | G#5 - B5 - E6 - D6 - | C6 - - - A5 . . .']),
    song('Rivets & Gears', 126, 8, 2,
      ['Em C D B Em C D Em', 'E5 G5 B5 G5 E5 G5 B5 G5 | E5 G5 C6 G5 E5 G5 C6 G5 | D5 F#5 A5 F#5 D5 F#5 A5 F#5 | D#5 F#5 B5 F#5 D#5 - . . | B5 - . B5 A5 G5 A5 B5 | C6 - . G5 E5 G5 C6 - | D6 - C6 B5 A5 - F#5 - | E5 - - - . . . .'],
      ['C D Em B C D B Em', 'G5 - E5 - G5 A5 - . | F#5 - D5 - F#5 A5 - . | G5 - E5 - G5 B5 - . | A5 - G5 F#5 D#5 - . . | G5 - E5 - G5 C6 - . | A5 - F#5 - A5 D6 - . | B5 A5 G5 F#5 E5 F#5 G5 A5 | B5 - - - E5 . . .']),
  ],
  // baroque harpsichord over a ticking clock, and a cuckoo-clock waltz
  library: [
    song('Tick-Tock Toccata', 120, 8, 2,
      ['Dm A Dm A Gm Dm A Dm', 'D5 F5 A5 D6 C#6 D6 A5 F5 | E5 A5 C#6 E6 D6 C#6 A5 E5 | F5 A5 D6 F6 E6 D6 C#6 D6 | E6 - A5 - C#6 - . . | D5 G5 Bb5 D6 C6 Bb5 A5 G5 | F5 A5 D6 F6 E6 D6 A5 F5 | G5 F5 E5 F5 G5 E5 C#5 E5 | D5 - - - . . . .'],
      ['F C Dm A Bb Gm A Dm', 'C6 - A5 - F5 - A5 C6 | Bb5 - G5 - E5 - G5 Bb5 | A5 - F5 - D5 - F5 A5 | G5 - - F5 E5 - . . | F5 - D6 - Bb5 - F5 D5 | G5 - Bb5 - D6 - C6 Bb5 | A5 Bb5 A5 G5 F5 E5 D5 C#5 | D5 - - - . . . .']),
    song('Cuckoo Waltz', 160, 6, 2,
      ['Gm D Gm Cm Cm Gm D Gm', 'D5 - G5 - Bb5 - | A5 - - - F#5 - | G5 - Bb5 - D6 - | C6 - - - . . | Eb6 - D6 - C6 - | Bb5 - A5 - G5 - | F#5 - G5 - A5 - | G5 - - - . .'],
      ['Eb Bb Cm D Eb Bb D Gm', 'G5 - - Bb5 - G5 | F5 - - D5 - Bb4 | Eb5 - G5 - C6 - | A5 - - - D5 - | G5 - - Bb5 - Eb6 | D6 - - Bb5 - F5 | A5 - C6 - F#5 - | G5 - - - . .']),
  ],
  // the lobby: a jaunty cooking-show theme
  lobby: [
    song('Order Up!', 118, 8, 2,
      ['C Am F G C Am G C', 'E5 G5 C6 - B5 C6 G5 - | A5 - E5 - . C5 E5 A5 | A5 G5 F5 - E5 F5 A5 - | G5 - - - D5 . . . | E5 G5 C6 - B5 C6 G5 - | A5 - E5 - . C6 B5 A5 | D6 - B5 G5 - A5 B5 - | C6 - - - . . . .'],
      ['F C Dm G F C G C', 'A5 - A5 G5 F5 - A5 - | G5 - G5 E5 C5 - E5 - | F5 - F5 E5 D5 - F5 A5 | G5 - - - B5 - D6 - | A5 - A5 G5 F5 - A5 C6 | E6 - D6 C6 G5 - E5 - | F5 E5 D5 - G5 - B5 - | C6 - - - . . . .']),
  ],
};

// ---- instruments
const M = () => musicBus;
const kick = (at, v = 0.34) => tone(60, 0.16, { vol: v, slide: 0.4, at, bus: M() });
const snare = (at, v = 0.13) => noise(0.13, { vol: v, freq: 1900, q: 0.8, at, bus: M() });
const clap = (at, v = 0.1) => { noise(0.08, { vol: v, freq: 1400, q: 1.2, at, bus: M() }); noise(0.07, { vol: v * 0.7, freq: 2200, q: 1, at: at + 0.012, bus: M() }); };
const hat = (at, v = 0.035) => noise(0.03, { vol: v, freq: 9000, type: 'highpass', at, bus: M() });
const shaker = (at, v = 0.03) => noise(0.05, { vol: v, freq: 6500, q: 1.5, at, bus: M() });
const tom = (at, f, v = 0.2) => tone(f, 0.2, { vol: v, slide: 0.55, at, bus: M() });
const bongo = (at, f, v = 0.12) => tone(f, 0.1, { vol: v, slide: 0.85, at, bus: M() });
const block = (at, f, v = 0.06) => tone(f, 0.05, { type: 'triangle', vol: v, at, bus: M() });
const clank = (at, v = 0.12) => { noise(0.1, { vol: v, freq: 3200, q: 14, at, bus: M() }); tone(1250, 0.14, { type: 'square', vol: v * 0.12, slide: 0.97, at, bus: M() }); };
const tick = (at, hi) => tone(hi ? 2400 : 1600, 0.025, { type: 'square', vol: 0.045, at, bus: M() });
const boom = (at) => { tone(42, 0.9, { vol: 0.32, slide: 0.5, at, bus: M() }); noise(0.7, { vol: 0.14, freq: 180, q: 0.4, type: 'lowpass', at, bus: M() }); };
const riser = (at, dur) => noise(dur, { vol: 0.06, freq: 500, q: 2, sweep: 8, at, bus: M() });
const chord = (notes, at, dur, type, v) => notes.forEach((n, j) => tone(hz(n), dur, { type, vol: v, at: at + j * 0.012, bus: M() }));

/** a melody / bass voice; n is a MIDI note */
function voice(kind, n, dur, at, v = 1) {
  const f = hz(n), bus = M(), T = (fr, d, o) => tone(fr, d, { ...o, vol: o.vol * v, at: at + (o.at || 0), bus });
  switch (kind) {
    case 'accordion': T(f, dur, { type: 'square', vol: 0.03, attack: 0.02 }); T(f * 1.005, dur, { type: 'square', vol: 0.025, attack: 0.02 }); T(f / 2, dur, { type: 'triangle', vol: 0.03, attack: 0.02 }); break;
    case 'bell': T(f, Math.max(dur, 0.6), { vol: 0.09, attack: 0.002 }); T(f * 2, 0.35, { vol: 0.03, attack: 0.002 }); T(f * 3.01, 0.15, { vol: 0.015, attack: 0.002 }); break;
    case 'brass': T(f, dur, { type: 'sawtooth', vol: 0.04, attack: 0.03 }); T(f * 0.996, dur, { type: 'sawtooth', vol: 0.03, attack: 0.04 }); break;
    case 'synth': T(f, dur, { type: 'sawtooth', vol: 0.035 }); T(f * 1.007, dur, { type: 'square', vol: 0.02 }); T(f, dur, { type: 'sawtooth', vol: 0.012, at: 0.18 }); T(f, dur, { type: 'sawtooth', vol: 0.006, at: 0.36 }); break;
    case 'flute': T(f, dur, { type: 'triangle', vol: 0.085, attack: 0.04 }); T(f * 2, dur, { vol: 0.015, attack: 0.05 }); break;
    case 'marimba': T(f, Math.min(dur, 0.4), { type: 'triangle', vol: 0.1, attack: 0.002 }); T(f * 4, 0.05, { vol: 0.025, attack: 0.002 }); break;
    case 'chip': T(f, dur * 0.75, { type: 'square', vol: 0.04 }); T(f / 2, dur * 0.75, { type: 'triangle', vol: 0.03 }); break;
    case 'harpsi': T(f, Math.min(dur, 0.6), { type: 'sawtooth', vol: 0.055, attack: 0.002 }); T(f * 2, 0.15, { type: 'square', vol: 0.016, attack: 0.002 }); break;
    case 'piano': T(f, dur, { type: 'triangle', vol: 0.08 }); T(f * 2, dur * 0.6, { vol: 0.02 }); break;
    default: T(f, dur, { type: kind, vol: 0.05 });
  }
}

// ---- per-world band: drums, bass and comping for one 16th step. k = { s: step in bar, S: steps per bar,
// BS: steps per beat, bar: 0..7 in the section, ch: chord tones, at, step, fin: battle arrangement, lvl }
const BANDS = {
  pirate: { lead: 'accordion', fin: 'brass', play(k) {
    const { s, S, BS, bar, ch, at, step, fin, lvl } = k, r = ch[0] - 12;
    if (s === 0) kick(at, 0.32); if (s === BS) kick(at, fin ? 0.3 : 0.2);
    if (s % 2 === 0 && s % BS) noise(0.05, { vol: 0.04, freq: 7000, q: 1, at, bus: M() }); // tambourine
    if (!fin) {
      if (s === 0) voice('sawtooth', r, step * 4, at, 0.8); if (s === BS) voice('sawtooth', r + 7, step * 4, at, 0.7);
      if (s === 2 || s === 4 || s === BS + 2 || s === BS + 4) chord(ch, at, step * 1.4, 'square', 0.009 + lvl * 0.004);
    } else {
      if (s % 2 === 0) voice('sawtooth', r + (s % BS === 4 ? 12 : 0), step * 1.6, at, 0.9);
      if (s % 2 === 0 && s % BS) tom(at, s > BS ? 90 : 110, 0.16);
      if (s === 0 || s === BS) chord(ch.map((n) => n + 12), at, step * 3, 'sawtooth', 0.012);
      if (bar === 0 && s === 0) boom(at);
      if (bar === 7 && s >= BS) snare(at, 0.05 + (s - BS) * 0.015);
    }
  } },
  glacier: { lead: 'bell', fin: 'bell', play(k) {
    const { s, S, ch, at, step, fin, lvl, bar } = k, r = ch[0] - 12;
    const arp = [0, 1, 2, 1][(s / 2) % 4 | 0];
    if (!fin) {
      if (s === 0 || s === 8) kick(at, 0.22); if (s === 4 || s === 12) block(at, 1800, 0.05);
      if (s % 2 === 1) hat(at, 0.02 + lvl * 0.02);
      if (s === 0) voice('sine', r, step * 15, at, 2.6);
      if (s % 2 === 0) tone(hz(ch[arp] + 24), step * 3, { vol: 0.02, at, bus: M() });
    } else {
      if (s % 4 === 0) kick(at, 0.32); if (s === 4 || s === 12) snare(at, 0.12); hat(at, s % 2 ? 0.04 : 0.02);
      if (s % 2 === 0) voice('sawtooth', r + (s % 4 === 2 ? 12 : 0), step * 1.6, at, 0.9);
      tone(hz(ch[[0, 1, 2, 1][s % 4]] + 24), step * 1.5, { vol: 0.02, at, bus: M() });
      if (s === 0) chord(ch.map((n) => n + 12), at, step * S, 'triangle', 0.02);
      if (bar === 7 && s === 0) riser(at, step * S);
    }
  } },
  volcano: { lead: 'brass', fin: 'brass', play(k) {
    const { s, ch, at, step, fin, bar } = k, r = ch[0] - 12;
    if (!fin) {
      if ([0, 3, 8, 10].includes(s)) kick(at, 0.34); if (s === 4 || s === 12) snare(at, 0.14);
      if (s === 14) tom(at, 120); if (s === 15) tom(at, 95);
      if (s % 2 === 0) { voice('sawtooth', r, step * 0.9, at, 1); voice('sawtooth', r + 7, step * 0.9, at, 0.6); }
      if (s % 2 === 1) hat(at, 0.03);
    } else {
      if (s % 2 === 0) kick(at, 0.3); if (s === 4 || s === 12) snare(at, 0.15);
      if (bar === 7 && s >= 8) tom(at, 140 - s * 4, 0.18);
      voice('sawtooth', r + (s % 4 === 2 ? 12 : 0), step * 0.8, at, 1); hat(at, 0.035);
      if (s === 0) { chord([ch[0], ch[0] + 7], at, step * 16, 'sawtooth', 0.025); boom(at); }
    }
  } },
  space: { lead: 'synth', fin: 'synth', play(k) {
    const { s, ch, at, step, fin, bar } = k, r = ch[0] - 12;
    if (s === 0 || s === 8 || (fin && s % 4 === 0) || (!fin && s === 10 && bar % 2)) kick(at, 0.32);
    if (s === 4 || s === 12) noise(0.25, { vol: 0.12, freq: 1700, q: 0.6, at, bus: M() });
    if (s % 4 === 2 || (fin && s % 2)) hat(at, 0.04);
    if (fin || s % 2 === 0) voice('sawtooth', r + ((fin ? s : s / 2) % 2 ? 12 : 0), step * (fin ? 0.8 : 1.6), at, fin ? 0.8 : 1);
    tone(hz(ch[[0, 1, 2, 1][s % 4]] + (fin ? 24 : 12) + (s % 8 >= 4 ? 12 : 0)), step * 0.8, { type: 'triangle', vol: 0.02, at, bus: M() });
    if (fin && bar === 7 && s === 0) riser(at, step * 16);
  } },
  clouds: { lead: 'flute', fin: 'flute', play(k) {
    const { s, S, BS, ch, at, step, fin, lvl } = k, r = ch[0] - 12, waltz = S === 12;
    if (waltz) {
      if (s === 0 || (fin && s % BS === 0)) kick(at, 0.22); if (s === 0) voice('triangle', r, step * 3.5, at, 3);
      if (s === BS || s === 2 * BS) chord(ch.map((n) => n + 12), at, step * 2, 'triangle', 0.025);
      if (fin && s % 2 === 0) shaker(at, 0.03); if (fin && s === BS * 2) clap(at, 0.06);
      return;
    }
    if (s === 0 || s === 10 || (fin && s % 4 === 0)) kick(at, 0.24); if (s === 4 || s === 12) clap(at, fin ? 0.1 : 0.06);
    shaker(at, s % 2 ? 0.03 : 0.015);
    if (s === 0) voice('triangle', r, step * 7, at, 3); if (s === 8) voice('triangle', r + 7, step * 7, at, 2.6);
    if (fin && s % 4 === 2) voice('triangle', r + 12, step * 1.5, at, 2);
    if (s % 4 === 2 || (fin && s % 2 === 0)) chord(ch.map((n) => n + 12), at, step * 1.2, 'triangle', 0.018 + lvl * 0.006);
  } },
  jungle: { lead: 'marimba', fin: 'marimba', play(k) {
    const { s, ch, at, step, fin, bar } = k, r = ch[0] - 12;
    if (s === 0 || s === 6 || s === 12) { kick(at, 0.3); voice('triangle', r + (s === 6 ? 7 : s === 12 ? 12 : 0), step * 3, at, 3); }
    if (s === 2 || s === 10 || s === 14) bongo(at, 430); if (s === 7 || s === 11) bongo(at, 310);
    shaker(at, s % 2 ? 0.03 : 0.015);
    if (s === 4 || s === 12) chord(ch.map((n) => n + 12), at, step, 'triangle', 0.03);
    if (fin) {
      if (s % 2 === 1) tom(at, [180, 150, 200, 165][(s >> 1) % 4], 0.1);
      if (s === 4 || s === 12) snare(at, 0.1);
      if (bar % 4 === 3 && s === 8) sfx.monkey();
    }
  } },
  factory: { lead: 'chip', fin: 'chip', play(k) {
    const { s, ch, at, step, fin, bar } = k, r = ch[0] - 12;
    if (s === 0 || s === 8 || (fin && s % 4 === 0) || s === 10) kick(at, 0.3);
    if (s === 4 || s === 12) clank(at, 0.14); if (fin && s % 4 === 2) clank(at, 0.06);
    hat(at, s % 2 ? 0.04 : 0.02);
    const b = ['R', 0, 'R', 'O', 0, 'R', 0, '5', 'R', 0, 'R', 'O', 0, '5', 0, 'R'][s];
    if (b) voice('square', r + (b === 'O' ? 12 : b === '5' ? 7 : 0), step * 0.7, at, 0.8);
    if (bar % 4 === 3 && s === 14) noise(0.4, { vol: 0.06, freq: 4000, type: 'highpass', at, bus: M() }); // steam
    if (fin && bar === 0 && s === 0) { clank(at, 0.3); boom(at); }
  } },
  library: { lead: 'harpsi', fin: 'harpsi', play(k) {
    const { s, S, BS, ch, at, step, fin, bar } = k, r = ch[0] - 12;
    if (s % BS === 0) tick(at, (s / BS) % 2 === 0);
    if (fin && s % BS === BS / 2) tick(at, false);
    if (s === 0 || s === S / 2 || (fin && s % BS === 0)) kick(at, fin ? 0.3 : 0.24);
    if (s % 2 === 0) voice('harpsi', r + [0, 7, 16, 7][(s / 2) % 4], step * 1.8, at, 1); // Alberti bass
    if (fin && s === 0 && bar % 2 === 0) { tone(hz(ch[0] + 24), 1.6, { vol: 0.06, at, bus: M() }); tone(hz(ch[0] + 24) * 2.76, 0.6, { vol: 0.02, at, bus: M() }); }
    if (fin && bar === 7 && s >= S / 2) snare(at, 0.04 + (s - S / 2) * 0.012);
  } },
  lobby: { lead: 'piano', fin: 'piano', play(k) {
    const { s, ch, at, step } = k, r = ch[0] - 12;
    if (s === 0 || s === 10) kick(at, 0.24); if (s === 4 || s === 12) snare(at, 0.07);
    if (s % 4 === 2) hat(at, 0.035);
    if (s === 0) voice('triangle', r, step * 5, at, 3); if (s === 6) voice('triangle', r + 7, step * 2, at, 2.6);
    if (s === 8) voice('triangle', r + 12, step * 3, at, 2.6); if (s === 14) voice('triangle', r + 7, step * 2, at, 2.2);
    if (s === 2 || s === 6 || s === 10 || s === 14) chord(ch.map((n) => n + 12), at, step * 1.3, 'sine', 0.03);
  } },
};

/** k: 0..1 overall tension, panic: an order is about to expire, fire: kitchen fire, final: last 30 s */
export function setIntensity(k, { panic = false, fire = false, final = false } = {}) {
  mix.level = k; mix.panic = panic ? 1 : 0; mix.fire = fire ? 1 : 0; mix.final = final;
}
/** world: world id or 'lobby'; key: the level (e.g. '3-4'), which sets the key the songs play in. */
export function playMusic(world, bpm = 0, key = '', force = null) {
  stopMusic();
  if (!ctx) return;
  mix.level = 0; mix.panic = 0; mix.fire = 0; mix.final = false;
  const songs = SONGS[world] || SONGS.lobby, band = BANDS[world] || BANDS.lobby;
  const r = seeded(`${world}-${key}`);
  const tr = world === 'lobby' ? 0 : [0, 0, 2, -2, 1, -1, 3][Math.floor(r() * 7)];
  let shift = songs[Math.floor(Math.random() * songs.length)];
  let battle = songs[Math.floor(Math.random() * songs.length)];
  if (force) { shift = battle = songs[force.song % songs.length]; mix.final = !!force.final; }
  let fin = mix.final, cur = fin ? battle : shift, i = 0, next = ctx.currentTime + 0.1;
  const id = setInterval(() => {
    while (next < ctx.currentTime + 0.2) {
      const S = cur.meter * 2, step = 60 / cur.bpm / cur.beat / 2;
      if (i % S === 0 && mix.final !== fin && world !== 'lobby') {
        fin = mix.final; cur = fin ? battle : shift; i = 0; // switch on a bar line, chorus first
        if (fin) { noise(1.6, { vol: 0.16, freq: 5000, q: 0.4, at: next - ctx.currentTime, bus: musicBus }); tone(40, 1.2, { vol: 0.35, slide: 0.5, at: next - ctx.currentTime, bus: musicBus }); }
        continue;
      }
      const at = next - ctx.currentTime, s = i % S, barN = Math.floor(i / S), loop = Math.floor(barN / 16);
      const sec = (Math.floor(barN / 8) % 2 === 0) !== fin ? cur.A : cur.B, bar = barN % 8;
      const ch = sec.ch[bar].map((n) => n + tr);
      band.play({ s, S, BS: cur.beat * 2, bar, ch, at, step, fin, lvl: mix.level });
      if (s % 2 === 0) {
        const ev = sec.mel[bar * cur.meter + s / 2];
        if (ev) {
          const n = ev.n + tr, dur = ev.len * step * 2 * 0.92;
          voice(fin ? band.fin : band.lead, n, dur, at, fin ? 1.25 : 1);
          if (fin) voice('sawtooth', n - 12, dur, at, 0.35);
          else if (loop % 2 || mix.level > 0.5) voice('sine', n + 12, dur, at, 0.35);
        }
      }
      if (mix.panic && s % 4 === 0) tone(hz(ch[0] + 25), step * 0.7, { type: 'square', vol: 0.03, at, bus: musicBus });
      if (mix.fire && s === 0) tone(700, step * 6, { type: 'triangle', vol: 0.05, slide: 1.5, at, bus: musicBus });
      next += step; i++;
    }
  }, 40);
  music = { id };
}
export function stopMusic() { if (music) { clearInterval(music.id); music = null; } }
/** song titles per world, for the dev console */
export const songList = () => Object.entries(SONGS).map(([w, l]) => `${w}: ${l.map((x, j) => `${j + 1} ${x.name}`).join(', ')}`).join('\n');
