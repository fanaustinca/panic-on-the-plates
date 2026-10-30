// Every hazard is a pure function of level time, so host, clients and the renderer agree on it
// without sending any of it over the network.
import { tileAt } from './levels.js';

const frac = (v) => v - Math.floor(v);
const TAU = Math.PI * 2;
export const WARN = 1.2; // seconds of telegraph before any timed hazard bites

/** Floe / shuttle position along its path (0..1) at time t. Shuttles (dwell > 0) wait at each end. */
function floeU(f, t) {
  const c = frac(t / f.period + f.phase);
  if (!f.dwell) return 0.5 - 0.5 * Math.cos(TAU * c);
  const d = f.dwell / 2, ease = (k) => k * k * (3 - 2 * k);
  if (c < d) return 0;
  if (c < 0.5 - d) return ease((c - d) / (0.5 - 2 * d));
  if (c < 0.5 + d) return 1;
  if (c < 1 - d) return 1 - ease((c - 0.5 - d) / (0.5 - 2 * d));
  return 0;
}
/** Ice-floe (or factory shuttle) rectangle at time t: { x, y, w, h, vx, vy } in tile units. */
export function floeAt(f, t) {
  const u = floeU(f, t), du = (floeU(f, t + 0.01) - floeU(f, t - 0.01)) / 0.02;
  if (f.axis === 'x') return { x: f.x0 + (f.x1 - f.x0) * u, y: f.y, w: f.w, h: f.h, vx: (f.x1 - f.x0) * du, vy: 0 };
  return { x: f.x, y: f.y0 + (f.y1 - f.y0) * u, w: f.w, h: f.h, vx: 0, vy: (f.y1 - f.y0) * du };
}
/** Is a shuttle about to move off (for its warning light)? */
export function floeMoving(f, t) { const u = floeU(f, t), v = floeU(f, t + 0.6); return Math.abs(v - u) > 1e-4; }

/** Cycle helper: returns { on, warn, k } for a hazard that is on for `on` seconds every `period`. */
export function cycle(t, period, on, phase = 0) {
  const c = frac(t / period + phase) * period; // seconds into this cycle
  return { on: c < on, warn: c >= period - WARN, k: c };
}

export const shiftUp = (s, t) => frac(t / s.period + s.phase) < 0.5;
export const shiftWarn = (s, t) => { const c = frac(t / s.period + s.phase) * s.period; const half = s.period / 2; return (c > half - WARN && c < half) || c > s.period - WARN; };
export const bridgeOff = (b, t) => b.shifting && frac(t / 12 + 0.25) >= 0.62;
export const bridgeWarn = (b, t) => b.shifting && !bridgeOff(b, t) && frac(t / 12 + 0.25) >= 0.62 - 1.5 / 12;

/** Global environment state at time t. */
export function envAt(L, t) {
  const hz = L.hz;
  const e = { tiltAngle: 0, push: [0, 0], lowG: false, scale: 1, ice: !!hz.ice, wind: null, swayV: 0, gravityWarn: false, dilWarn: false };
  if (hz.tilt) {
    e.tiltAngle = hz.tilt.amp * Math.sin(TAU * t / hz.tilt.period);
    e.push = [(e.tiltAngle / hz.tilt.amp) * hz.tilt.push, 0];
  }
  if (hz.gravity) {
    const c = frac(t / hz.gravity.period + hz.gravity.phase) * hz.gravity.period;
    e.lowG = c < hz.gravity.low;
    e.gravityWarn = !e.lowG && c > hz.gravity.period - 2;
  }
  if (hz.gusts) for (const g of hz.gusts) {
    if (t >= g.t - 1.6 && t < g.t + g.dur) {
      const active = t >= g.t;
      e.wind = { dx: g.dx, dy: g.dy, strength: active ? g.strength : 0, warn: !active };
      if (active) { e.push[0] += g.dx * g.strength; e.push[1] += g.dy * g.strength; }
    }
  }
  if (hz.dilation) for (const d of hz.dilation) {
    if (t >= d.t && t < d.t + d.dur) e.scale = d.scale;
    if (t >= d.t - 1.5 && t < d.t) e.dilWarn = d.scale;
  }
  if (hz.sway) e.swayV = hz.sway.amp * Math.sin(TAU * t / hz.sway.period);
  return e;
}

/** Strikes (cannon / ember / lightning) near time t: returns [{kind, x, y, dt}] where dt = t - impact. */
export function strikesNear(L, t, before = 2.2, after = 7) {
  const out = [];
  for (const kind of ['cannon', 'embers', 'lightning']) {
    const list = L.hz[kind];
    if (!list) continue;
    for (const s of list) { const dt = t - s.t; if (dt > -before && dt < after) out.push({ kind, x: s.x, y: s.y, dt, t: s.t }); }
  }
  return out;
}
export const HOLE_TIME = 7;

/** Is tile (x,y) a hole at time t (cannonball damage)? */
export function holeAt(L, x, y, t) {
  if (!L.hz.cannon) return false;
  for (const s of L.hz.cannon) if (s.x === x && s.y === y && t >= s.t && t < s.t + HOLE_TIME) return true;
  return false;
}

/** Cells that knock a cook out right now: lasers, fire walls, geysers. Returns Set of "x,y". */
export function deadlyCells(L, t) {
  const out = new Set();
  const hz = L.hz;
  for (const list of [hz.lasers, hz.firewalls]) if (list) for (const h of list) if (cycle(t, h.period, h.on, h.phase).on) for (const [x, y] of h.cells) out.add(x + ',' + y);
  if (hz.geysers) for (const g of hz.geysers) if (cycle(t, g.period, 1.7, g.phase).on) out.add(g.x + ',' + g.y);
  return out;
}

/** Cuckoo bird state: null or { row, x (tile units, may be off-grid), warn } */
export function cuckooAt(L, t) {
  if (!L.hz.cuckoo) return null;
  for (const c of L.hz.cuckoo) {
    const dt = t - c.t;
    if (dt > -2.5 && dt < 0) return { row: c.row, x: -1, warn: true, k: dt };
    if (dt >= 0 && dt < 1.6) return { row: c.row, x: -1 + (L.W + 2) * (dt / 1.6), warn: false, k: dt };
  }
  return null;
}

/** Moving counter's left edge (tile units) at time t: pause, glide across, pause, glide back. */
export function moverX(m, t) {
  const c = frac(t / m.period + m.phase);
  const ease = (k) => k * k * (3 - 2 * k);
  let k;
  if (c < 0.15) k = 0; else if (c < 0.5) k = ease((c - 0.15) / 0.35); else if (c < 0.65) k = 1; else k = 1 - ease((c - 0.65) / 0.35);
  return m.x0 + (m.x1 - m.x0) * k;
}
/** Is the mover about to set off (for the warning lights)? */
export function moverWarn(m, t) {
  const c = frac(t / m.period + m.phase);
  return (c > 0.1 && c < 0.15) || (c > 0.6 && c < 0.65) || (c >= 0.15 && c < 0.5) || (c >= 0.65);
}

/** Is a blocking (non-walkable) tile at grid (x,y) at time t? */
export function blockedAt(L, x, y, t) {
  const tl = tileAt(L, x, y);
  if (!tl) return true;
  if (tl.k === 'wall' || tl.k === 'counter') return true;
  if (tl.wallShift) { const s = L.shifters.find((q) => q.x === x && q.y === y); if (s && shiftUp(s, t)) return true; }
  return false;
}

/** Ground support under a point (tile units) at time t: returns { ok, vx, vy } (carry velocity). */
export function supportAt(L, px, py, t) {
  for (const f of L.floes) {
    const r = floeAt(f, t);
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return { ok: true, vx: r.vx, vy: r.vy, floe: true };
  }
  const x = Math.floor(px), y = Math.floor(py);
  const tl = tileAt(L, x, y);
  if (!tl) return { ok: false };
  if (tl.k === 'floor') {
    if (holeAt(L, x, y, t)) return { ok: false };
    return { ok: true, vx: tl.push ? tl.push * 1.7 : 0, vy: 0 };
  }
  if (tl.k === 'bridge') {
    const b = L.bridges.find((q) => q.tiles.some(([bx, by]) => bx === x && by === y));
    if (b && bridgeOff(b, t)) return { ok: false };
    return { ok: true, vx: 0, vy: 0, rope: tl.rope ? tl.dir || 'x' : false };
  }
  if (tl.k === 'counter' || tl.k === 'wall') return { ok: true, vx: 0, vy: 0 };
  return { ok: false };
}
