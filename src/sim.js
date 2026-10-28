// Kitchen rules + cook movement. The host runs Sim.step; clients run movePlayer for their own cook
// and mirror everything else from host snapshots. No Three.js here (node tests import it).
import { T, WORLDS, INGREDIENTS, finalState } from './config.js';
import { tileAt } from './levels.js';
import { rng } from './rng.js';
import { envAt, supportAt, blockedAt, deadlyCells, strikesNear, cuckooAt, floeAt, cycle } from './hazards.js';

export const COUNTDOWN = 3.6; // "Ready" "Set" "Cook!"
const COOKERS = { pan: 'pan', pot: 'pot', oven: 'oven' };
const FIRE_IMMUNE = new Set(['window', 'sink', 'trash', 'return', 'bin']);

// ---------------------------------------------------------------- movement (shared)

/** Advance one cook. inp = { mx, my, jump }. Mutates p. Returns 'fell' when the cook dropped out of the level. */
export function movePlayer(L, p, inp, dt, t) {
  if (p.ko > 0) return null;
  const env = envAt(L, t);
  if (p.falling) {
    p.vz -= T.gravity * dt; p.z += p.vz * dt;
    p.x += p.vx * dt * 0.6; p.y += p.vy * dt * 0.6;
    return p.z < -1.6 ? 'fell' : null;
  }
  let mx = inp.mx || 0, my = inp.my || 0;
  const m = Math.hypot(mx, my);
  if (m > 1) { mx /= m; my /= m; }
  const speed = T.speed * env.scale;
  let accel = T.accel * Math.max(0.6, env.scale);
  if (env.ice) accel = L.hz.ice.accel;
  if (env.lowG) accel = Math.min(accel, 7);
  if (p.z > 0.02) accel *= 0.55;
  const step = accel * dt;
  const toward = (v, target) => (Math.abs(target - v) <= step ? target : v + Math.sign(target - v) * step);
  p.vx = toward(p.vx, mx * speed);
  p.vy = toward(p.vy, my * speed);
  if (m > 0.15) {
    const k = Math.min(1, dt * 16);
    let fx = p.fx + (mx / Math.max(m, 1e-6) - p.fx) * k, fy = p.fy + (my / Math.max(m, 1e-6) - p.fy) * k;
    const fl = Math.hypot(fx, fy) || 1;
    p.fx = fx / fl; p.fy = fy / fl;
  }
  const grounded = p.z <= 0.001;
  const sup = supportAt(L, p.x, p.y, t);
  let ex = env.push[0], ey = env.push[1];
  if (grounded && sup.ok) { ex += sup.vx || 0; ey += sup.vy || 0; if (sup.rope) ey += env.swayV; }
  p.ex = ex; p.ey = ey;
  collideMove(L, p, (p.vx + ex) * dt, (p.vy + ey) * dt, t);

  if (inp.jump && grounded) { p.vz = T.jumpV * (env.lowG ? 1.08 : 1); p.jumped = (p.jumped || 0) + 1; }
  const g = T.gravity * (env.lowG ? 0.3 : 1);
  if (p.z > 0 || p.vz > 0) { p.vz -= g * dt; p.z += p.vz * dt; }
  if (p.z <= 0) {
    const s2 = supportAt(L, p.x, p.y, t);
    if (s2.ok) { p.z = 0; p.vz = 0; }
    else { p.falling = true; p.vz = Math.min(p.vz, -0.5); }
  }
  return null;
}

const R = T.radius;
function collideMove(L, p, dx, dy, t) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.2));
  for (let i = 0; i < n; i++) {
    p.x += dx / n; resolve(L, p, t);
    p.y += dy / n; resolve(L, p, t);
  }
}
function resolve(L, p, t) {
  const cx = Math.floor(p.x), cy = Math.floor(p.y);
  for (let yy = cy - 1; yy <= cy + 1; yy++) for (let xx = cx - 1; xx <= cx + 1; xx++) {
    if (!blockedAt(L, xx, yy, t)) continue;
    const nx = Math.max(xx, Math.min(p.x, xx + 1)), ny = Math.max(yy, Math.min(p.y, yy + 1));
    const ddx = p.x - nx, ddy = p.y - ny, d = Math.hypot(ddx, ddy);
    if (d < R) {
      if (d > 1e-6) { p.x = nx + (ddx / d) * R; p.y = ny + (ddy / d) * R; }
      else {
        // centre inside the block (a wall rose under us): pop out to the nearest open side
        const opts = [[xx - R, p.y, -1, 0], [xx + 1 + R, p.y, 1, 0], [p.x, yy - R, 0, -1], [p.x, yy + 1 + R, 0, 1]]
          .filter(([, , ox, oy]) => !blockedAt(L, xx + ox, yy + oy, t))
          .sort((a, b) => Math.hypot(a[0] - p.x, a[1] - p.y) - Math.hypot(b[0] - p.x, b[1] - p.y));
        if (opts[0]) { p.x = opts[0][0]; p.y = opts[0][1]; }
      }
    }
  }
}

/** The counter a cook is facing (or null): best of the 3x3 neighbourhood by facing alignment. */
export function findTarget(L, p) {
  const cx = Math.floor(p.x), cy = Math.floor(p.y);
  let best = null, bestS = -1e9;
  for (let yy = cy - 1; yy <= cy + 1; yy++) for (let xx = cx - 1; xx <= cx + 1; xx++) {
    const tl = tileAt(L, xx, yy);
    if (!tl || tl.k !== 'counter') continue;
    const tx = xx + 0.5 - p.x, ty = yy + 0.5 - p.y, d = Math.hypot(tx, ty);
    if (d > 1.35) continue;
    const dot = (tx * p.fx + ty * p.fy) / (d || 1);
    if (dot < 0.35) continue;
    const s = dot * 1.4 - d;
    if (s > bestS) { bestS = s; best = [xx, yy]; }
  }
  return best;
}

export function newPlayer(L, info, slot) {
  const [sx, sy] = L.spawns[slot % L.spawns.length];
  return {
    id: info.id, slot, name: info.name, outfit: info.outfit, color: info.color, skin: info.skin || 0,
    x: sx + 0.5, y: sy + 0.5, z: 0, vx: 0, vy: 0, vz: 0, fx: 0, fy: 1, ex: 0, ey: 0,
    held: null, ko: 0, life: 0, falling: false, work: false, act: null, target: null, inp: { mx: 0, my: 0, jump: false },
    stats: { delivered: 0, chopped: 0, washed: 0, fires: 0, kos: 0 },
  };
}

// ---------------------------------------------------------------- items

export const ingItem = (ing) => ({ kind: 'ing', ing, s: 'raw', p: 0 });
export const plateItem = (n = 1) => ({ kind: 'plate', n, c: [], dirty: false });
const isFinal = (it) => it.kind === 'ing' && it.s === finalState(it.ing);
const canPlate = (plate, it) => plate.kind === 'plate' && !plate.dirty && plate.n === 1 && isFinal(it) && !plate.c.some((c) => c.ing === it.ing) && plate.c.length < 4;
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/** Human readable description of an item (HUD hints, tests). */
export function describe(it) {
  if (!it) return 'nothing';
  if (it.kind === 'ext') return 'Fire Extinguisher';
  if (it.kind === 'plate') return it.dirty ? `${it.n} dirty plate${it.n > 1 ? 's' : ''}` : it.c.length ? 'Plate: ' + it.c.map((c) => INGREDIENTS[c.ing].name).join(' + ') : 'Clean plate';
  return `${{ raw: 'Raw', chopped: 'Chopped', cooked: 'Cooked', burnt: 'Burnt' }[it.s]} ${INGREDIENTS[it.ing].name}`;
}

// ---------------------------------------------------------------- the host simulation

export class Sim {
  constructor(L, roster, seed = 1) {
    this.L = L;
    this.world = WORLDS[L.world];
    this.t = -COUNTDOWN;
    this.phase = 'countdown';
    this.rand = rng(seed ^ 0x51ab);
    this.ts = L.tiles.map(() => ({}));
    this.players = roster.map((r, i) => newPlayer(L, r, i));
    this.orders = [];
    this.nextOrderId = 1;
    this.nextOrderAt = 0;
    this.score = 0; this.delivered = 0; this.failed = 0; this.tips = 0; this.combo = 1;
    this.pending = []; // { at, kind: 'dirty'|'plate'|'ext' }
    this.events = [];
    this.monkeys = [];
    this.nextMonkey = L.hz.monkeys ? L.hz.monkeys.start : Infinity;
    this.beltDir = L.belts.map((b) => b.dir);
    this.struck = new Set();
    for (const tl of L.tiles) {
      const s = this.st(tl.x, tl.y);
      if (tl.st === 'plates') s.item = plateItem(L.index >= 5 ? 4 : 3);
      if (tl.st === 'ext') s.item = { kind: 'ext' };
      if (tl.st === 'sink') { s.dirty = 0; s.clean = 0; }
      if (tl.st === 'return') s.dirty = 0;
    }
  }

  st(x, y) { return this.ts[y * this.L.W + x]; }
  tile(x, y) { return tileAt(this.L, x, y); }
  player(id) { return this.players.find((p) => p.id === id); }
  emit(type, data = {}) { this.events.push({ type, ...data }); }

  // ---------------- player actions (host authoritative)

  press(pid, target) {
    const p = this.player(pid);
    if (!p || p.ko > 0 || p.falling || this.phase !== 'play') return;
    if (target) p.target = target;
    // extinguisher: spraying is a hold; a press only puts it down on an empty counter
    const tgt = p.target && this.near(p, p.target) ? p.target : null;
    if (!tgt) return;
    const [x, y] = tgt;
    const tl = this.tile(x, y), s = this.st(x, y);
    if (!tl || tl.k !== 'counter') return;
    if (s.fire) { this.emit('blocked', { x, y, msg: 'On fire!' }); return; }
    const H = p.held;
    if (H && H.kind === 'ext' && this.L.tiles.some((q) => this.st(q.x, q.y).fire && Math.hypot(q.x + 0.5 - p.x, q.y + 0.5 - p.y) < 3)) return; // spraying, not putting down
    switch (tl.st) {
      case 'bin':
        if (!H) { p.held = ingItem(tl.ing); this.emit('grab', { pid, x, y }); }
        else if (H.kind === 'ing' && H.ing === tl.ing && H.s === 'raw') { p.held = null; this.emit('drop', { pid, x, y }); }
        else if (!s.item && H) { s.item = H; p.held = null; this.emit('drop', { pid, x, y }); }
        else this.tryCombine(p, s, x, y);
        return;
      case 'trash':
        if (!H) return;
        if (H.kind === 'ing') { p.held = null; this.emit('trash', { pid, x, y }); }
        else if (H.kind === 'plate' && !H.dirty && H.c.length) { H.c = []; this.emit('trash', { pid, x, y }); }
        return;
      case 'window':
        if (H && H.kind === 'plate' && !H.dirty && H.c.length) this.deliver(p, x, y);
        else if (H) this.emit('blocked', { x, y, msg: H.kind === 'plate' ? 'Empty plate!' : 'Plate it first!' });
        return;
      case 'sink':
        if (!H) {
          if (s.dirty > 0) { p.work = true; return; }
          if (s.clean > 0) { s.clean--; p.held = plateItem(1); this.emit('grab', { pid, x, y }); }
        } else if (H.kind === 'plate' && H.dirty) { s.dirty += H.n; p.held = null; this.emit('drop', { pid, x, y }); }
        return;
      case 'return':
        if (!H && s.dirty > 0) { p.held = { kind: 'plate', n: s.dirty, c: [], dirty: true }; s.dirty = 0; this.emit('grab', { pid, x, y }); }
        return;
      case 'lever': {
        const bi = tl.belt;
        this.beltDir[bi] *= -1;
        this.emit('lever', { x, y, dir: this.beltDir[bi] });
        return;
      }
      case 'pan': case 'pot': case 'oven': {
        if (!H) {
          if (s.item) { p.held = s.item; s.item = null; this.emit('grab', { pid, x, y }); }
          return;
        }
        if (H.kind === 'ing' && !s.item) {
          const m = INGREDIENTS[H.ing].method;
          if (H.s === 'raw') { this.emit('blocked', { x, y, msg: 'Chop it first!' }); return; }
          if (H.s === 'chopped' && m === COOKERS[tl.st]) { s.item = H; p.held = null; this.emit('cookstart', { pid, x, y, st: tl.st }); return; }
          this.emit('blocked', { x, y, msg: m === 'chop' ? 'Serve this one raw-chopped!' : `This goes in the ${m === 'oven' ? 'oven' : m}!` });
          return;
        }
        if (H.kind === 'plate' && s.item && canPlate(H, s.item)) { H.c.push({ ing: s.item.ing, s: s.item.s }); s.item = null; this.emit('plate', { pid, x, y }); return; }
        if (H.kind === 'plate' && s.item) this.emit('blocked', { x, y, msg: s.item.s === 'burnt' ? 'Burnt! Bin it.' : 'Not ready yet!' });
        return;
      }
      case 'board':
        if (!H) {
          if (s.item && s.item.kind === 'ing' && s.item.s === 'raw') { p.work = true; return; }
          if (s.item) { p.held = s.item; s.item = null; this.emit('grab', { pid, x, y }); }
          return;
        }
        if (!s.item && H.kind === 'ing') { s.item = H; p.held = null; this.emit('drop', { pid, x, y }); return; }
        if (s.item) this.tryCombine(p, s, x, y);
        return;
      default: // counter, plates, ext, belt
        if (!H) {
          if (!s.item) return;
          if (s.item.kind === 'plate' && s.item.n > 1 && !s.item.dirty) { s.item.n--; p.held = plateItem(1); }
          else { p.held = s.item; s.item = null; }
          this.emit('grab', { pid, x, y });
          return;
        }
        if (!s.item) { s.item = H; p.held = null; s.bt = 0; this.emit('drop', { pid, x, y }); return; }
        this.tryCombine(p, s, x, y);
    }
  }

  tryCombine(p, s, x, y) {
    const H = p.held, I = s.item;
    if (H.kind === 'plate' && I.kind === 'ing' && canPlate(H, I)) { H.c.push({ ing: I.ing, s: I.s }); s.item = null; this.emit('plate', { pid: p.id, x, y }); return; }
    if (H.kind === 'ing' && I.kind === 'plate' && canPlate(I, H)) { I.c.push({ ing: H.ing, s: H.s }); p.held = null; this.emit('plate', { pid: p.id, x, y }); return; }
    if (H.kind === 'plate' && I.kind === 'plate' && !H.dirty && !I.dirty && H.n === 1 && I.n === 1 && !H.c.length && !I.c.length) { I.n = 2; p.held = null; this.emit('drop', { pid: p.id, x, y }); return; }
    if (H.kind === 'ing' && !isFinal(H) && H.s !== 'burnt') { this.emit('blocked', { x, y, msg: H.s === 'raw' ? 'Chop it first!' : 'Needs cooking!' }); return; }
    this.emit('blocked', { x, y, msg: 'No room!' });
  }

  setWork(pid, on, target) {
    const p = this.player(pid);
    if (!p) return;
    if (target) p.target = target;
    p.work = !!on;
  }

  near(p, [x, y]) { return Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) < 1.7; }

  deliver(p, x, y) {
    const H = p.held;
    const ings = H.c.map((c) => c.ing);
    const matches = this.orders.filter((o) => sameSet(this.L.recipes[o.r].ings, ings));
    if (!matches.length) { this.emit('wrong', { x, y, msg: 'Nobody ordered that!' }); return; }
    const o = matches.sort((a, b) => a.t0 - b.t0)[0];
    const oldest = this.orders.slice().sort((a, b) => a.t0 - b.t0)[0];
    if (o === oldest) this.combo = Math.min(4, this.combo + (this.delivered ? 1 : 0)); else this.combo = 1;
    const left = Math.max(0, 1 - (this.t - o.t0) / o.lim);
    const base = 10 + 10 * ings.length;
    const tip = Math.ceil(left * 8) * this.combo;
    this.score += base + tip; this.tips += tip; this.delivered++;
    p.stats.delivered++;
    this.orders.splice(this.orders.indexOf(o), 1);
    p.held = null;
    this.pending.push({ at: this.t + T.dirtyDelay, kind: 'dirty' });
    this.emit('deliver', { x, y, pid: p.id, points: base, tip, combo: this.combo, oid: o.id, name: this.L.recipes[o.r].name });
    if (!this.orders.length) this.nextOrderAt = Math.min(this.nextOrderAt, this.t + 1.5);
  }

  ko(p, why) {
    if (p.ko > 0) return;
    p.ko = T.respawn; p.life++; p.stats.kos++;
    p.falling = false; p.work = false;
    if (p.held) this.lose(p.held);
    p.held = null;
    this.emit('ko', { pid: p.id, why, x: p.x, y: p.y });
  }

  lose(item) {
    if (item.kind === 'plate') for (let i = 0; i < item.n; i++) this.pending.push({ at: this.t + T.plateRespawn, kind: 'plate' });
    if (item.kind === 'ext') this.pending.push({ at: this.t + 6, kind: 'ext' });
  }

  ignite(x, y) {
    const tl = this.tile(x, y), s = this.st(x, y);
    if (!tl || tl.k !== 'counter' || s.fire || FIRE_IMMUNE.has(tl.st)) return false;
    s.fire = 1; s.fireT = 0;
    if (s.item && s.item.kind === 'ing') { s.item.s = 'burnt'; s.item.dead = 1; }
    this.emit('fire', { x, y });
    return true;
  }

  // ---------------- main tick

  /** Advance the kitchen. Players with p.local = true are moved here from p.inp. */
  step(dt) {
    const L = this.L;
    if (this.phase === 'over') return;
    this.t += dt;
    if (this.phase === 'countdown') {
      if (this.t < 0) return;
      this.phase = 'play';
      this.emit('go');
      this.spawnOrder(); this.spawnOrder();
      this.nextOrderAt = this.t + L.orderGap;
    }
    const t = this.t;
    const env = envAt(L, t);
    const scale = env.scale;

    // cooks
    const deadly = deadlyCells(L, t);
    for (const p of this.players) {
      if (p.ko > 0) {
        p.ko -= dt;
        if (p.ko <= 0) {
          const [sx, sy] = L.spawns[p.slot % L.spawns.length];
          Object.assign(p, { ko: 0, x: sx + 0.5, y: sy + 0.5, z: 0, vx: 0, vy: 0, vz: 0, falling: false });
          this.emit('respawn', { pid: p.id });
        }
        continue;
      }
      if (p.local) {
        const r = movePlayer(L, p, p.inp, dt, t);
        p.inp.jump = false;
        if (r === 'fell') this.ko(p, 'fell');
      } else if (p.falling && p.z < -1.4) this.ko(p, 'fell');
      if (p.ko > 0) continue;
      if (p.z < 0.45 && deadly.has(Math.floor(p.x) + ',' + Math.floor(p.y))) this.ko(p, 'hazard');
    }
    // soft cook-vs-cook separation (host-moved cooks only; remote cooks own their position)
    for (let i = 0; i < this.players.length; i++) for (let j = i + 1; j < this.players.length; j++) {
      const a = this.players[i], b = this.players[j];
      if (a.ko > 0 || b.ko > 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > 0 && d < 0.56) {
        const push = (0.56 - d) / 2;
        if (a.local) { a.x -= (dx / d) * push; a.y -= (dy / d) * push; }
        if (b.local) { b.x += (dx / d) * push; b.y += (dy / d) * push; }
      }
    }

    // strikes (cannon, embers, lightning)
    for (const s of strikesNear(L, t, 0, 0.2)) {
      const key = s.kind + s.t + ',' + s.x + ',' + s.y;
      if (this.struck.has(key)) continue;
      this.struck.add(key);
      this.emit('strike', { kind: s.kind, x: s.x, y: s.y });
      for (const p of this.players) if (p.ko <= 0 && p.z < 0.6 && Math.hypot(p.x - (s.x + 0.5), p.y - (s.y + 0.5)) < 0.75) this.ko(p, s.kind);
      const tl = this.tile(s.x, s.y);
      if (tl && tl.k === 'counter' && (s.kind === 'lightning' || (s.kind === 'embers' && ((s.x * 7 + s.y * 13 + Math.floor(s.t)) % 3 === 0)))) this.ignite(s.x, s.y);
    }
    const ck = cuckooAt(L, t);
    if (ck && !ck.warn) for (const p of this.players) if (p.ko <= 0 && p.z < 0.7 && Math.abs(p.y - (ck.row + 0.5)) < 0.6 && Math.abs(p.x - ck.x) < 0.7) this.ko(p, 'cuckoo');

    // work (chop / wash / spray)
    for (const p of this.players) {
      p.act = null;
      if (!p.work || p.ko > 0) continue;
      if (p.held && p.held.kind === 'ext') { this.spray(p, dt); p.act = 'spray'; continue; }
      if (p.held || !p.target || !this.near(p, p.target)) { p.work = false; continue; }
      const [x, y] = p.target;
      const tl = this.tile(x, y), s = this.st(x, y);
      if (s.fire) { p.work = false; continue; }
      if (tl.st === 'board' && s.item && s.item.kind === 'ing' && s.item.s === 'raw') {
        s.item.p += (dt * scale) / T.chopTime;
        p.act = 'chop';
        if (s.item.p >= 1) { s.item.s = 'chopped'; s.item.p = 0; p.stats.chopped++; p.work = false; this.emit('chopped', { x, y, pid: p.id }); }
      } else if (tl.st === 'sink' && s.dirty > 0) {
        s.wp = (s.wp || 0) + (dt * scale) / T.washTime;
        p.act = 'wash';
        if (s.wp >= 1) { s.wp = 0; s.dirty--; s.clean++; p.stats.washed++; this.emit('washed', { x, y }); if (!s.dirty) p.work = false; }
      } else p.work = false;
    }

    // cookers + fire
    for (const tl of L.stations) {
      const s = this.st(tl.x, tl.y);
      if (!COOKERS[tl.st] || !s.item || s.item.kind !== 'ing' || s.fire || s.item.dead) continue;
      const it = s.item, m = INGREDIENTS[it.ing].method, cook = T.cook[m];
      const before = it.s;
      it.p += dt * scale;
      if (it.p >= cook && it.s === 'chopped') it.s = 'cooked';
      if (it.p >= cook * T.burnAt[m] && it.s === 'cooked') it.s = 'burnt';
      if (it.s !== before) this.emit(it.s === 'cooked' ? 'cooked' : 'burnt', { x: tl.x, y: tl.y });
      if (it.p >= cook * T.fireAt[m]) this.ignite(tl.x, tl.y);
    }
    for (const tl of L.tiles) {
      const s = this.ts[tl.y * L.W + tl.x];
      if (!s.fire) continue;
      s.fire = Math.min(1.6, s.fire + T.fireGrow * dt * 0.2);
      s.fireT += dt;
      if (s.fireT >= T.fireSpread) {
        s.fireT = 0;
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [tl.x + dx, tl.y + dy]).filter(([x, y]) => { const q = this.tile(x, y); return q && q.k === 'counter' && !this.st(x, y).fire && !FIRE_IMMUNE.has(q.st); });
        if (nb.length) { const [x, y] = nb[Math.floor(this.rand() * nb.length)]; this.ignite(x, y); }
      }
    }

    // conveyor belts
    L.belts.forEach((b, bi) => {
      const dir = this.beltDir[bi];
      const order = dir > 0 ? b.tiles.slice().reverse() : b.tiles.slice(); // move the leading item first
      for (const [x, y] of order) {
        const s = this.st(x, y);
        if (!s.item || s.fire) continue;
        const i = this.tile(x, y).beltI + dir;
        if (i < 0 || i >= b.tiles.length) { s.bt = 0; continue; }
        s.bt = (s.bt || 0) + dt * b.speed * scale;
        if (s.bt >= 1) {
          const [nx, ny] = b.tiles[i];
          const ns = this.st(nx, ny);
          if (!ns.item && !ns.fire) { ns.item = s.item; ns.bt = 0; s.item = null; s.bt = 0; } else s.bt = 1;
        }
      }
    });

    // monkeys
    if (L.hz.monkeys) this.stepMonkeys(dt);

    // pending plates / extinguisher respawns
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const q = this.pending[i];
      if (t < q.at) continue;
      if (q.kind === 'dirty') {
        const ret = L.stations.find((s) => s.st === 'return');
        this.st(ret.x, ret.y).dirty++;
        this.pending.splice(i, 1);
        this.emit('dirty', { x: ret.x, y: ret.y });
      } else if (q.kind === 'plate') {
        const pl = L.stations.find((s) => s.st === 'plates');
        const s = this.st(pl.x, pl.y);
        if (!s.item) { s.item = plateItem(1); this.pending.splice(i, 1); }
        else if (s.item.kind === 'plate' && !s.item.dirty && !s.item.c.length) { s.item.n++; this.pending.splice(i, 1); }
      } else if (q.kind === 'ext') {
        const ex = L.stations.find((s) => s.st === 'ext');
        const s = ex && this.st(ex.x, ex.y);
        if (s && !s.item) { s.item = { kind: 'ext' }; this.pending.splice(i, 1); }
      }
    }

    // orders
    for (const o of this.orders.slice()) {
      if (t - o.t0 > o.lim) {
        this.orders.splice(this.orders.indexOf(o), 1);
        this.failed++; this.combo = 1;
        this.score = Math.max(0, this.score - 10);
        this.emit('expire', { oid: o.id, name: L.recipes[o.r].name });
      }
    }
    if ((t >= this.nextOrderAt || this.orders.length === 0) && this.orders.length < L.maxOrders && t < L.duration - 8) {
      this.spawnOrder();
      this.nextOrderAt = t + L.orderGap * (0.8 + this.rand() * 0.4);
    }

    if (t >= L.duration) {
      this.phase = 'over';
      this.emit('over', { score: this.score });
    }
  }

  spawnOrder() {
    const L = this.L;
    // later in the round, lean towards the bigger dishes
    const n = L.recipes.length;
    let r = Math.floor(this.rand() * n);
    if (this.t > L.duration * 0.4 && this.rand() < 0.35) r = n - 1 - Math.floor(this.rand() * Math.min(2, n));
    const ings = L.recipes[r].ings.length;
    const o = { id: this.nextOrderId++, r, t0: this.t, lim: 42 + 17 * ings };
    this.orders.push(o);
    this.emit('order', { oid: o.id, name: L.recipes[r].name });
    return o;
  }

  spray(p, dt) {
    const L = this.L;
    for (const tl of L.tiles) {
      const s = this.ts[tl.y * L.W + tl.x];
      if (!s.fire) continue;
      const dx = tl.x + 0.5 - p.x, dy = tl.y + 0.5 - p.y, d = Math.hypot(dx, dy);
      if (d > 2.8) continue;
      if (d > 0.7 && (dx * p.fx + dy * p.fy) / d < 0.55) continue;
      s.fire -= T.sprayRate * dt * (d < 1.6 ? 1 : 0.6);
      if (s.fire <= 0) { s.fire = 0; s.fireT = 0; p.stats.fires++; this.emit('extinguished', { x: tl.x, y: tl.y }); }
    }
  }

  // ---------------- monkeys (jungle)

  stepMonkeys(dt) {
    const L = this.L, cfg = L.hz.monkeys, t = this.t;
    if (t >= this.nextMonkey && this.monkeys.length < cfg.count) {
      this.nextMonkey = t + cfg.every * (0.7 + this.rand() * 0.6);
      const floors = L.tiles.filter((q) => q.k === 'floor' && !q.wallShift && q.y >= 2);
      const s = floors[Math.floor(this.rand() * floors.length)];
      this.monkeys.push({ id: this.nextOrderId++, x: s.x + 0.5, y: s.y + 0.5, z: 3.2, st: 'drop', item: null, path: null, t0: t, from: null, fx: 0, fy: 1 });
      this.emit('monkey', { x: s.x, y: s.y });
    }
    for (const m of this.monkeys.slice()) {
      if (m.st === 'drop') { m.z -= dt * 3.2; if (m.z <= 0) { m.z = 0; m.st = 'seek'; } continue; }
      if (m.st === 'leave') {
        m.z += dt * 3.4;
        if (m.z > 3.5) { if (m.item) this.lose(m.item); this.monkeys.splice(this.monkeys.indexOf(m), 1); }
        continue;
      }
      // scared off by a cook
      const scarer = this.players.find((p) => p.ko <= 0 && Math.hypot(p.x - m.x, p.y - m.y) < 0.8);
      if (scarer && m.item) {
        const spot = this.freeCounterNear(m.from || [Math.floor(m.x), Math.floor(m.y)]);
        if (spot) this.st(spot[0], spot[1]).item = m.item; else this.lose(m.item);
        m.item = null; m.st = 'leave';
        this.emit('monkeyscared', { x: m.x, y: m.y });
        continue;
      }
      if (m.st === 'seek') {
        if (!m.path || m.repath < t) {
          const goal = this.monkeyTarget(m);
          m.path = goal ? goal.path : null; m.goal = goal ? goal.tile : null; m.repath = t + 2;
          if (!goal && t - m.t0 > 10) { m.st = 'leave'; continue; }
        }
        if (m.path && m.path.length) this.walk(m, m.path, dt);
        else if (m.goal) {
          const s = this.st(m.goal[0], m.goal[1]);
          if (s.item && !s.fire && this.stealable(s.item)) { m.item = s.item; s.item = null; m.from = m.goal; m.st = 'flee'; m.t1 = t; m.path = null; this.emit('stolen', { x: m.goal[0], y: m.goal[1] }); }
          else m.path = null;
        }
      } else if (m.st === 'flee') {
        if (!m.path) {
          const floors = L.tiles.filter((q) => q.k === 'floor' && Math.hypot(q.x - m.x, q.y - m.y) > 4);
          const dest = floors[Math.floor(this.rand() * floors.length)];
          m.path = dest ? this.path([Math.floor(m.x), Math.floor(m.y)], (x, y) => x === dest.x && y === dest.y) || [] : [];
        }
        if (m.path.length) this.walk(m, m.path, dt, 2.9);
        if (!m.path.length || t - m.t1 > 6) m.st = 'leave';
      }
    }
  }

  stealable(it) { return it.kind === 'ing' || (it.kind === 'plate' && it.c.length > 0); }

  monkeyTarget(m) {
    const L = this.L;
    const want = (x, y) => {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const tl = this.tile(x + dx, y + dy);
        if (!tl || tl.k !== 'counter' || COOKERS[tl.st] || tl.st === 'bin') continue;
        const s = this.st(x + dx, y + dy);
        if (s.item && !s.fire && this.stealable(s.item)) return [x + dx, y + dy];
      }
      return null;
    };
    let found = null;
    const path = this.path([Math.floor(m.x), Math.floor(m.y)], (x, y) => { const g = want(x, y); if (g) { found = g; return true; } return false; });
    return path ? { path, tile: found } : null;
  }

  /** BFS over walkable tiles; returns list of [x,y] tile centres to walk (excluding start) or null. */
  path(from, goal) {
    const L = this.L, t = this.t;
    const key = (x, y) => y * L.W + x;
    const prev = new Map([[key(...from), null]]);
    const q = [from];
    while (q.length) {
      const [x, y] = q.shift();
      if (goal(x, y)) {
        const out = [];
        let k = key(x, y);
        while (k !== null && k !== key(...from)) { out.unshift([k % L.W, Math.floor(k / L.W)]); k = prev.get(k); }
        return out;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (prev.has(key(nx, ny))) continue;
        const tl = this.tile(nx, ny);
        if (!tl || (tl.k !== 'floor' && tl.k !== 'bridge') || blockedAt(L, nx, ny, t)) continue;
        prev.set(key(nx, ny), key(x, y));
        q.push([nx, ny]);
      }
    }
    return null;
  }

  walk(m, path, dt, speed = 2.3) {
    const [tx, ty] = path[0];
    const dx = tx + 0.5 - m.x, dy = ty + 0.5 - m.y, d = Math.hypot(dx, dy);
    const s = speed * dt;
    if (d <= s) { m.x = tx + 0.5; m.y = ty + 0.5; path.shift(); }
    else { m.x += (dx / d) * s; m.y += (dy / d) * s; m.fx = dx / d; m.fy = dy / d; }
  }

  freeCounterNear([x0, y0]) {
    let best = null, bd = 1e9;
    for (const tl of this.L.tiles) {
      if (tl.k !== 'counter' || !['counter', 'plates', 'board'].includes(tl.st)) continue;
      const s = this.st(tl.x, tl.y);
      if (s.item || s.fire) continue;
      const d = Math.hypot(tl.x - x0, tl.y - y0);
      if (d < bd) { bd = d; best = [tl.x, tl.y]; }
    }
    return best;
  }

  // ---------------- network snapshot

  snapshot() {
    const ts = [];
    this.ts.forEach((s, i) => { if (s.item || s.fire || s.dirty || s.clean || s.wp) ts.push([i, s.item || 0, +(s.fire || 0).toFixed(2), s.dirty || 0, s.clean || 0, +(s.wp || 0).toFixed(2)]); });
    return {
      t: +this.t.toFixed(3), ph: this.phase, sc: this.score, dl: this.delivered, fl: this.failed, tp: this.tips, cb: this.combo,
      o: this.orders.map((o) => [o.id, o.r, +o.t0.toFixed(2), o.lim]),
      ts,
      p: this.players.map((p) => ({ id: p.id, x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3), fx: +p.fx.toFixed(3), fy: +p.fy.toFixed(3), h: p.held || 0, ko: +p.ko.toFixed(2), lf: p.life, fa: p.falling ? 1 : 0, a: p.act, vx: +p.vx.toFixed(2), vy: +p.vy.toFixed(2) })),
      m: this.monkeys.map((m) => [m.id, +m.x.toFixed(2), +m.y.toFixed(2), +m.z.toFixed(2), m.item || 0, m.st, +(m.fx || 0).toFixed(2), +(m.fy || 1).toFixed(2)]),
      bd: this.beltDir,
    };
  }

  /** Client side: adopt a host snapshot. Own cook keeps its locally predicted position. */
  applySnapshot(S, selfId) {
    this.t = S.t; this.phase = S.ph; this.score = S.sc; this.delivered = S.dl; this.failed = S.fl; this.tips = S.tp; this.combo = S.cb;
    this.orders = S.o.map(([id, r, t0, lim]) => ({ id, r, t0, lim }));
    for (const s of this.ts) { s.item = null; s.fire = 0; s.dirty = 0; s.clean = 0; s.wp = 0; }
    for (const [i, item, fire, dirty, clean, wp] of S.ts) Object.assign(this.ts[i], { item: item || null, fire, dirty, clean, wp });
    for (const sp of S.p) {
      const p = this.player(sp.id);
      if (!p) continue;
      p.held = sp.h || null; p.ko = sp.ko; p.act = sp.a;
      if (sp.id === selfId) {
        if (sp.lf !== p.life) { p.life = sp.lf; Object.assign(p, { x: sp.x, y: sp.y, z: 0, vx: 0, vy: 0, vz: 0, falling: false }); }
        if (sp.ko > 0) { p.x = sp.x; p.y = sp.y; }
        continue;
      }
      p.net = sp; // remote cook: renderer interpolates
      p.life = sp.lf; p.falling = !!sp.fa;
    }
    this.monkeys = S.m.map(([id, x, y, z, item, st, fx, fy]) => ({ id, x, y, z, item: item || null, st, fx, fy }));
    this.beltDir = S.bd;
  }
}

/** Star count for a final score. */
export const starsFor = (L, score) => L.stars.filter((s) => score >= s).length;
export { floeAt, cycle };
