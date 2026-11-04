// One match: owns the Three.js scene for a level, the Sim (host) or its mirror (client), the
// cooks, input, network traffic and the in-game HUD feed.
import * as THREE from 'three';
import { CPU2D } from './render/geo.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { WORLDS, COLORS, SLOT_COLORS, NET_HZ, INGREDIENTS, METHOD_LABEL, T, upgMul } from './config.js';
import { buildLevel } from './levels.js';
import { Sim, movePlayer, findTarget, starsFor, describe, COUNTDOWN } from './sim.js';
import { envAt, cuckooAt, strikesNear } from './hazards.js';
import { Kitchen } from './render/kitchen.js';
import { STYLE } from './render/env.js';
import { Chef } from './render/chef.js';
import { makeItem, itemKey } from './render/items.js';
import { sfx, playMusic, setIntensity } from './audio.js';
import { tileAt } from './levels.js';
import { keyNames, touchUI } from './input.js';

const SNAP_HZ = 20;
// what falling off the kitchen sounds like in each world: [popup, sound]
const FALL = {
  pirate: ['Splash!', 'splash'], glacier: ['Brrr-plunge!', 'splash'], volcano: ['Sizzle!', 'sizzle'], space: ['Lost in space!', 'drift'],
  clouds: ['Whoooosh!', 'whoosh'], jungle: ['Aaah-ah-aaah!', 'fall'], factory: ['Clang!', 'fall'], library: ['Tick... tock... drop!', 'fall'],
};

function skyTexture(top, bottom) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d', CPU2D);
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#' + top.toString(16).padStart(6, '0'));
  grd.addColorStop(1, '#' + bottom.toString(16).padStart(6, '0'));
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** convex hull of 2D points (monotone chain), counter-clockwise in screen space */
function convexHull(P) {
  const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
/** does convex polygon `hull`, moved by (sx, sy), overlap box [x0, y0, x1, y1]? (separating axes) */
function polyHitsBox(hull, sx, sy, [x0, y0, x1, y1]) {
  let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
  for (const p of hull) { a = Math.min(a, p[0] + sx); b = Math.max(b, p[0] + sx); c = Math.min(c, p[1] + sy); d = Math.max(d, p[1] + sy); }
  if (b <= x0 || a >= x1 || d <= y0 || c >= y1) return false;
  const n = hull.length;
  for (let i = 0; i < n; i++) {
    const p = hull[i], q = hull[(i + 1) % n];
    const ax = q[1] - p[1], ay = p[0] - q[0];
    const pr = (x, y) => ax * x + ay * y;
    let pmin = Infinity, pmax = -Infinity;
    for (const r of hull) { const v = pr(r[0] + sx, r[1] + sy); pmin = Math.min(pmin, v); pmax = Math.max(pmax, v); }
    const bs = [pr(x0, y0), pr(x1, y0), pr(x0, y1), pr(x1, y1)];
    if (Math.max(...bs) <= pmin || Math.min(...bs) >= pmax) return false;
  }
  return true;
}

export class Game {
  /**
   * opts: { renderer, room (or null), selfId, isHost, roster: [{id,name,outfit,color,skin}], level: 'w-l', seed, hud, input, quality, onEnd }
   */
  constructor(opts) {
    Object.assign(this, opts);
    const [wi, li] = opts.level.split('-').map(Number);
    this.L = buildLevel(wi, li);
    this.world = WORLDS[wi];
    this.sim = new Sim(this.L, this.roster, this.seed);
    this.me = this.sim.player(this.selfId);
    // cooks driven from this machine: you, plus any couch co-op cooks (keyboard halves, gamepads)
    this.locals = (opts.locals || [{ id: this.selfId, ctrl: 'any' }]).filter((l) => this.sim.player(l.id));
    const localIds = new Set(this.locals.map((l) => l.id));
    this.sim.players.forEach((p) => { p.local = this.isHost && localIds.has(p.id); });
    this.clock = 0;
    this.sendAcc = 0;
    this.snapT = null;
    this.over = false;
    this.ended = false;
    this.paused = false;
    this.shake = 0;
    this.sfxAcc = 0;
    this.lastCount = null;
    this.buildScene();
    this.hud.startMatch(this);
    this.fit(); // again, now that the HUD is on screen to be framed around
    playMusic(this.world.id, 0, opts.level);
  }

  buildScene() {
    const S = STYLE[this.world.id];
    const scene = this.scene = new THREE.Scene();
    scene.background = skyTexture(this.world.sky, this.world.fog);
    scene.fog = new THREE.Fog(this.world.fog, 30, 70);
    const hemi = new THREE.HemisphereLight(S.hemi[0], S.hemi[1], S.amb * 1.4);
    scene.add(hemi);
    const sun = this.sun = new THREE.DirectionalLight(S.light, S.sun);
    sun.position.set(-6, 14, 8);
    sun.castShadow = this.quality !== 'low';
    const ext = Math.max(this.L.W, this.L.H) * 0.75 + 2;
    Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 50 });
    sun.shadow.mapSize.set(this.quality === 'high' ? 2048 : 1024, this.quality === 'high' ? 2048 : 1024);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    this.kitchen = new Kitchen(this.L);
    scene.add(this.kitchen.root, this.kitchen.worldGroup);
    this.kitchen.onCannon = () => sfx.cannonFire();
    // soft studio reflections so steel, brass and glazes read as real materials
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    scene.environment = this.envTex;
    scene.environmentIntensity = 0.28;
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 260);
    this.chefs = new Map();
    for (const p of this.sim.players) this.addChef(p);
    this.fit();
  }

  addChef(p) {
    const c = new Chef({ outfit: p.outfit, color: COLORS[p.color % COLORS.length], skin: p.skin || 0, name: p.name });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 32), new THREE.MeshBasicMaterial({ color: SLOT_COLORS[p.slot % 4], transparent: true, opacity: 0.85, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.015;
    c.ring = ring;
    c.root.add(ring);
    c.root.add(c.blob);
    c.root.scale.setScalar(1.4);
    this.kitchen.dyn.add(c.root);
    c.disp = { x: p.x, y: p.y, z: 0 };
    this.chefs.set(p.id, c);
  }

  removePlayer(id) {
    const c = this.chefs.get(id);
    if (c) this.kitchen.dyn.remove(c.root);
    this.chefs.delete(id);
    const i = this.sim.players.findIndex((p) => p.id === id);
    if (i >= 0) { const p = this.sim.players[i]; if (p.held && this.isHost) this.sim.lose(p.held); this.sim.players.splice(i, 1); }
  }

  /**
   * Frame the kitchen in the part of the screen the HUD leaves free. The camera keeps its angle; we search the
   * closest distance (biggest kitchen) at which the kitchen's outline, slid by a lens shift, touches no HUD panel
   * (tickets, score, controls), and the world's dressing around it still fits on screen.
   */
  fit() {
    const w = this.renderer.domElement.clientWidth || innerWidth, h = this.renderer.domElement.clientHeight || innerHeight;
    const cam = this.camera;
    cam.aspect = w / h;
    cam.clearViewOffset();
    cam.updateProjectionMatrix();
    if (this.hud.hud && this.hud.game === this) this.hud.layoutHud(this);
    const rects = this.hud.hud && this.hud.game === this ? this.hud.hudRects() : [];
    const elev = THREE.MathUtils.degToRad(52);
    const look = this.camLook = new THREE.Vector3(0, 0, 0.45);
    const dir = new THREE.Vector3(0, Math.sin(elev), Math.cos(elev));
    // what must stay visible: every tile, plus the head of a cook on the back row (sway and roll margin)
    const X = this.L.W / 2 + 0.3, Z = this.L.H / 2 + 0.3;
    const tight = [];
    for (const x of [-X, X]) for (const z of [-Z, Z]) for (const y of [0, 1.7]) tight.push(new THREE.Vector3(x, y, z));
    // the world's dressing (the galleon's bow and stern, the jungle canopy) frames the kitchen on roomy screens
    const pad = this.world.id === 'pirate' ? [2.6, 1.6] : this.world.id === 'jungle' ? [1.6, 1.4] : this.world.id === 'factory' ? [2, 1.2] : [1.2, 0.9];
    const roomy = h >= 520;
    const dress = [];
    for (const x of [-1, 1]) for (const z of [-1, 1]) dress.push(new THREE.Vector3(x * (X + pad[0] / 2), 0, z * (Z + pad[1] / 2)));
    const toPx = (v) => { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * w, (-p.y * 0.5 + 0.5) * h]; };
    const place = (d) => { cam.position.copy(look).addScaledVector(dir, d); cam.position.z += 0.3; cam.lookAt(look); cam.updateMatrixWorld(); };
    const m = Math.max(6, Math.min(w, h) * 0.012);
    const boxes = rects.map((r) => [r.left - m, r.top - m, r.right + m, r.bottom + m]);
    // can the kitchen be framed from distance d? returns the lens shift [sx, sy] in px, or null
    const tryD = (d) => {
      place(d);
      const hull = convexHull(tight.map(toPx));
      const xs = hull.map((p) => p[0]), ys = hull.map((p) => p[1]);
      let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      let lo = [m - x0, m - y0], hi = [w - m - x1, h - m - y1];
      if (roomy) {
        const D = dress.map(toPx);
        const dx0 = Math.min(...D.map((p) => p[0])), dx1 = Math.max(...D.map((p) => p[0])), dy1 = Math.max(...D.map((p) => p[1]));
        lo[0] = Math.max(lo[0], -dx0); hi[0] = Math.min(hi[0], w - dx1); hi[1] = Math.min(hi[1], h - dy1);
      }
      if (lo[0] > hi[0] || lo[1] > hi[1]) return null;
      // prefer the kitchen centred on screen, then search outwards over the allowed shifts
      const want = [(w - x0 - x1) / 2, (h - y0 - y1) / 2];
      const N = 36, cand = [];
      for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) cand.push([lo[0] + (hi[0] - lo[0]) * i / N, lo[1] + (hi[1] - lo[1]) * j / N]);
      cand.push([Math.min(hi[0], Math.max(lo[0], want[0])), Math.min(hi[1], Math.max(lo[1], want[1]))]);
      let best = null, bd = Infinity;
      for (const c of cand) {
        const e = (c[0] - want[0]) ** 2 + (c[1] - want[1]) ** 2;
        if (e >= bd) continue;
        if (boxes.some((b) => polyHitsBox(hull, c[0], c[1], b))) continue;
        best = c; bd = e;
      }
      return best;
    };
    let dLo = 3, dHi = 220, shift = tryD(dHi);
    if (shift) {
      for (let i = 0; i < 26; i++) { const mid = (dLo + dHi) / 2; const s = tryD(mid); if (s) { dHi = mid; shift = s; } else dLo = mid; }
    } else shift = [0, 0];
    // a hair of breathing room, then settle on the shift found for it
    const d = dHi * 1.015;
    shift = tryD(d) || shift;
    place(d);
    this.camBase = cam.position.clone();
    if (shift[0] || shift[1]) cam.setViewOffset(w, h, -shift[0], -shift[1], w, h);
    cam.updateProjectionMatrix();
    // keep fog out of the kitchen itself: it only softens the far backdrop
    this.scene.fog.near = d * 1.35; this.scene.fog.far = d * 3.2;
    const db = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.kitchen.parts.setScale(db.y / 2 * cam.projectionMatrix.elements[5]);
    this.fitInfo = { d, shift, w, h };
  }

  /** the kitchen's outline on screen right now (CSS px), for layout checks */
  kitchenHull() {
    const X = this.L.W / 2 + 0.3, Z = this.L.H / 2 + 0.3, w = innerWidth, h = innerHeight, out = [];
    this.camera.updateMatrixWorld();
    for (const x of [-X, X]) for (const z of [-Z, Z]) for (const y of [0, 1.7]) { const p = new THREE.Vector3(x, y, z).project(this.camera); out.push([(p.x * 0.5 + 0.5) * w, (-p.y * 0.5 + 0.5) * h]); }
    return convexHull(out);
  }
  /** HUD panels the kitchen overlaps right now ([] when the view is clear), checked against the real elements */
  hudOverlaps() {
    const hull = this.kitchenHull(), hits = [];
    const els = [...document.querySelectorAll('.hud .score-card, .hud .ticket, .hud .keys, .hud .tb, .hud .stick')];
    for (const e of els) {
      const r = e.getBoundingClientRect();
      if (!r.width || getComputedStyle(e).display === 'none' || e.closest('.probe')) continue;
      if (polyHitsBox(hull, 0, 0, [r.left, r.top, r.right, r.bottom])) hits.push(e.className);
    }
    const xs = hull.map((p) => p[0]), ys = hull.map((p) => p[1]);
    if (Math.min(...xs) < 0 || Math.max(...xs) > innerWidth || Math.min(...ys) < 0 || Math.max(...ys) > innerHeight) hits.push('offscreen');
    return hits;
  }

  // ------------------------------------------------------------- network

  onMessage(from, m) {
    if (this.isHost) {
      const p = this.sim.player(from);
      if (!p) return;
      if (m.k === 'pos') {
        if (m.lf !== p.life || p.ko > 0) return;
        Object.assign(p, { x: m.x, y: m.y, z: m.z, fx: m.fx, fy: m.fy, vx: m.vx, vy: m.vy, falling: !!m.fa });
        p.netAt = performance.now();
      } else if (m.k === 'press' || m.k === 'work' || m.k === 'throw') {
        // actions carry the guest's own position, so a press right after arriving isn't judged on a stale one
        if (m.at && m.at.lf === p.life && p.ko <= 0) Object.assign(p, { x: m.at.x, y: m.at.y, fx: m.at.fx, fy: m.at.fy });
        if (m.k === 'press') this.sim.press(from, m.tg); else if (m.k === 'throw') this.sim.throwItem(from); else this.sim.setWork(from, m.on, m.tg);
      }
    } else {
      if (m.k === 'snap') { this.sim.applySnapshot(m.s, this.selfId); this.snapT = { t: m.s.t, at: performance.now() }; }
      else if (m.k === 'ev') m.list.forEach((e) => this.handleEvent(e));
    }
  }

  /** Estimated host time on a client. */
  clientT() {
    if (!this.snapT) return -COUNTDOWN;
    return this.snapT.t + Math.min(0.35, (performance.now() - this.snapT.at) / 1000);
  }

  // ------------------------------------------------------------- frame

  update(dt, rt, hidden = false) {
    const sim = this.sim, me = this.me;
    const inp = this.input;
    const t = this.isHost ? sim.t : this.clientT();
    const playing = sim.phase === 'play';

    // local input: every cook on this machine reads its own controller
    const canAct0 = playing && !this.paused;
    for (const lc of this.locals) {
      const p = sim.player(lc.id);
      if (!p) continue;
      const c = inp.read(lc.ctrl);
      const canAct = canAct0 && p.ko <= 0;
      p.target = p.ko > 0 ? null : findTarget(this.L, p, Math.max(0, t));
      lc.inp = canAct ? { mx: c.mx, my: c.my, jump: c.jump, dash: c.dash } : { mx: 0, my: 0, jump: false, dash: false };
      if (!canAct) { if (c.release && this.isHost) sim.setWork(p.id, false); continue; }
      if (c.jump && p.z <= 0.001 && !p.falling) sfx.jump();
      const at = () => ({ x: +p.x.toFixed(3), y: +p.y.toFixed(3), fx: +p.fx.toFixed(3), fy: +p.fy.toFixed(3), lf: p.life });
      if (c.press) {
        if (this.isHost) { sim.press(p.id, p.target); sim.setWork(p.id, true, p.target); }
        else { const a = at(); this.room.toHost({ k: 'press', tg: p.target, at: a }); this.room.toHost({ k: 'work', on: true, tg: p.target, at: a }); }
      }
      if (c.release) {
        if (this.isHost) sim.setWork(p.id, false); else this.room.toHost({ k: 'work', on: false });
      }
      if (c.throw && p.held && p.held.kind === 'ing') {
        if (this.isHost) sim.throwItem(p.id); else this.room.toHost({ k: 'throw', at: at() });
      }
    }
    const mv = (this.locals.find((l) => l.id === this.selfId) || {}).inp || { mx: 0, my: 0, jump: false, dash: false };
    const jump = mv.jump;

    if (this.isHost) {
      for (const lc of this.locals) { const p = sim.player(lc.id); if (p && lc.inp) p.inp = lc.inp; }
      if (!this.paused || this.room) sim.step(dt);
      this.sendAcc += dt;
      if (this.room && this.sendAcc >= 1 / SNAP_HZ) { this.sendAcc = 0; this.room.broadcast({ k: 'snap', s: sim.snapshot() }); }
      if (sim.events.length) {
        const list = sim.events.splice(0);
        if (this.room) this.room.broadcast({ k: 'ev', list });
        list.forEach((e) => this.handleEvent(e));
      }
    } else if (me) {
      if (me.ko <= 0 && sim.phase === 'play') {
        movePlayer(this.L, me, { mx: mv.mx, my: mv.my, jump, dash: mv.dash }, dt, t);
        this.sendAcc += dt;
        if (this.sendAcc >= 1 / NET_HZ) {
          this.sendAcc = 0;
          this.room.toHost({ k: 'pos', x: +me.x.toFixed(3), y: +me.y.toFixed(3), z: +me.z.toFixed(3), fx: +me.fx.toFixed(3), fy: +me.fy.toFixed(3), vx: +me.vx.toFixed(2), vy: +me.vy.toFixed(2), fa: me.falling ? 1 : 0, lf: me.life });
        }
      }
    }

    if (!hidden) {
      this.render(dt, rt, t);
      this.hud.updateMatch(this, t, dt);
    }
    // music tension follows the clock, the order rail and the fire alarm
    const left = this.L.duration - Math.max(0, t);
    const panic = sim.orders.some((o) => 1 - (Math.max(0, t) - o.t0) / o.lim < 0.22);
    const fire = sim.ts.some((s) => s.fire > 0);
    const k = sim.phase !== 'play' ? 0 : Math.min(1, 0.25 + (1 - left / this.L.duration) * 0.55 + sim.orders.length * 0.05 + (panic ? 0.15 : 0) + (fire ? 0.2 : 0));
    setIntensity(k, { panic, fire, final: sim.phase === 'play' && left <= 30 });

    if (sim.phase === 'over' && !this.over) {
      this.over = true;
      sfx.over();
      this.hud.timesUp();
      setTimeout(() => this.finish(), 2600);
    }
  }

  finish() {
    if (this.ended) return;
    this.ended = true;
    const sim = this.sim;
    const res = {
      level: this.level, score: sim.score, delivered: sim.delivered, failed: sim.failed, tips: sim.tips, golds: sim.golds || 0,
      stars: starsFor(this.L, sim.score, sim.players.length), thresholds: sim.stars,
      players: sim.players.map((p) => ({ id: p.id, name: p.name, slot: p.slot, outfit: p.outfit, color: p.color, skin: p.skin, stats: p.stats })),
    };
    this.onEnd(res);
  }

  render(dt, rt, t) {
    const sim = this.sim;
    this.frames = (this.frames || 0) + 1;
    this.kitchen.update(sim, t, dt, this.camera, rt);
    const now = performance.now();
    for (const p of sim.players) {
      const c = this.chefs.get(p.id);
      if (!c) continue;
      // display position: own cook is exact; remote cooks smoothed + extrapolated
      let tx = p.x, ty = p.y, tz = p.z, fx = p.fx, fy = p.fy, vx = p.vx, vy = p.vy;
      const isSelf = p.id === this.selfId;
      if (!isSelf && !this.isHost && p.net) {
        const n = p.net;
        if (n !== c.lastNet) { c.lastNet = n; c.netAt = now; }
        const ex = Math.min(0.12, (now - c.netAt) / 1000);
        tx = n.x + n.vx * ex; ty = n.y + n.vy * ex; tz = n.z; fx = n.fx; fy = n.fy; vx = n.vx; vy = n.vy;
      } else if (!isSelf && this.isHost && p.netAt) {
        const ex = Math.min(0.12, (now - p.netAt) / 1000);
        tx = p.x + p.vx * ex; ty = p.y + p.vy * ex;
      }
      const k = isSelf ? 1 : 1 - Math.exp(-dt * 14);
      const jumpBack = Math.hypot(tx - c.disp.x, ty - c.disp.y) > 2.5;
      if (jumpBack) { c.disp.x = tx; c.disp.y = ty; }
      c.disp.x += (tx - c.disp.x) * k; c.disp.y += (ty - c.disp.y) * k; c.disp.z += (tz - c.disp.z) * (isSelf ? 1 : 0.5);
      const ko = p.ko > 0;
      c.root.visible = !ko || (p.ko > T.respawn * upgMul(p, 'recover') - 0.6 && p.falling);
      c.root.position.set(this.kitchen.wx(c.disp.x), Math.max(-3, c.disp.z), this.kitchen.wz(c.disp.y));
      this.kitchen.swayPoint(c.root.position); // ride the swaying treehouse pods
      const ang = Math.atan2(fx, fy);
      let da = ang - c.root.rotation.y;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      c.root.rotation.y += da * Math.min(1, dt * 18);
      if ((p.dn || 0) !== (c.dn ?? p.dn)) { this.kitchen.dashPuff(c.root.position, fx, fy); if (this.locals.some((lc) => lc.id === p.id)) sfx.dash(); }
      c.dn = p.dn || 0;
      c.animate({ speed: Math.hypot(vx, vy), z: c.disp.z, act: p.act, holding: !!p.held, shock: p.falling || p.ko > 0, dt, t: rt });
      c.blob.visible = c.disp.z > 0.05 && !p.falling;
      c.blob.position.y = -c.disp.z + 0.015;
      c.ring.position.y = -c.disp.z + 0.015;
      c.ring.visible = !p.falling;
      if (p.falling) c.root.rotation.x = Math.min(1.2, (c.root.rotation.x || 0) + dt * 2); else c.root.rotation.x = 0;
      // held item
      const key = itemKey(p.held);
      if (c.heldKey !== key) {
        c.holdAnchor.clear();
        if (p.held) c.holdAnchor.add(makeItem(p.held));
        c.heldKey = key;
      }
    }
    // own target highlight
    this.kitchen.setHighlights(sim.phase !== 'play' ? [] : this.locals.map((lc) => { const p = sim.player(lc.id); return p && p.ko <= 0 ? { target: p.target, color: this.locals.length > 1 ? SLOT_COLORS[p.slot % 4] : 0xffffff } : null; }).filter(Boolean));
    // camera shake
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.camera.position.copy(this.camBase);
    if (this.shake > 0) this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * this.shake * 0.4, (Math.random() - 0.5) * this.shake * 0.3, 0));
    this.camera.lookAt(this.camLook);
    // ambient sounds from cook actions
    this.sfxAcc += dt;
    if (this.sfxAcc > 0.22) {
      this.sfxAcc = 0;
      if (sim.players.some((p) => p.act === 'chop')) sfx.chop();
      if (sim.players.some((p) => p.act === 'wash')) sfx.wash();
      if (sim.players.some((p) => p.act === 'spray')) sfx.spray();
    }
    // countdown beeps
    if (sim.phase === 'countdown' || (t >= 0 && t < 0.3)) {
      const n = t < -2.4 ? 3 : t < -1.2 ? 2 : t < 0 ? 1 : 0;
      if (n !== this.lastCount) { this.lastCount = n; sfx.count(n === 0 ? 0 : n); }
    }
    this.renderer.render(this.scene, this.camera);
  }

  handleEvent(e) {
    const hud = this.hud, K = this.kitchen;
    const at = (x, y, h) => K.tilePos(x, y, h);
    K.fxEvent(e);
    switch (e.type) {
      case 'grab': sfx.grab(); break;
      case 'drop': sfx.drop(); break;
      case 'trash': sfx.drop(); hud.popup(at(e.x, e.y), 'Binned', 'muted'); break;
      case 'plate': sfx.plate(); break;
      case 'chopped': sfx.chopped(); break;
      case 'cookstart': sfx.sizzle(); break;
      case 'cooked': sfx.cooked(); break;
      case 'burnt': sfx.burnt(); hud.popup(at(e.x, e.y), 'Burnt!', 'bad'); break;
      case 'fire': sfx.fire(); hud.popup(at(e.x, e.y), 'FIRE!', 'bad'); hud.alert('Kitchen fire! Grab the extinguisher', 'fire'); break;
      case 'extinguished': sfx.extinguished(); break;
      case 'deliver':
        sfx.deliver();
        if (e.gold) sfx.gold();
        hud.popup(at(e.x, e.y, 1.6), `${e.gold ? '<b class="goldtxt">GOLDEN!</b> ' : ''}+${e.points}${e.tip ? ` <small>+${e.tip} tip${e.combo > 1 ? ` x${e.combo}` : ''}${e.rush ? ' rush x2' : ''}</small>` : ''}`, e.gold ? 'gold' : 'good');
        hud.orderDone(e.oid);
        break;
      case 'wrong': sfx.wrong(); hud.popup(at(e.x, e.y), e.msg, 'bad'); break;
      case 'blocked': if (this.locals.some((lc) => { const p = this.sim.player(lc.id); return p && p.target && p.target[0] === e.x && p.target[1] === e.y; })) { sfx.wrong(); hud.popup(at(e.x, e.y), e.msg, 'warn'); } break;
      case 'throw': sfx.throw(); break;
      case 'catch': sfx.catch(); hud.popup(at(e.x, e.y, 1.7), 'Nice catch!', 'good'); break;
      case 'landed': sfx.drop(); break;
      case 'splat': sfx.splat(); if (!e.lost) hud.popup(at(e.x, e.y, 1.1), 'Splat!', 'muted'); break;
      case 'rush': if (e.on) { sfx.rush(); hud.alert('RUSH HOUR! Orders pour in, tips are doubled', 'rush'); } break;
      case 'order': sfx.order(); if (e.gold) { sfx.gold(); hud.alert('A food critic! Golden order: double points', 'gold'); } break;
      case 'expire': sfx.expire(); hud.orderFailed(e.oid); break;
      case 'washed': sfx.washed(); break;
      case 'dirty': break;
      case 'ko': {
        const pos = K.root.localToWorld(new THREE.Vector3(K.wx(e.x), 1.2, K.wz(e.y)));
        const fall = FALL[this.world.id] || FALL.pirate;
        if (e.why === 'fell') sfx[fall[1]](); else sfx.ko();
        hud.popup(pos, { fell: fall[0], cannon: 'Ka-BOOM!', embers: 'Scorched!', lightning: 'Zapped!', hazard: 'Ouch!', cuckoo: 'Cuckoo!' }[e.why] || 'Ouch!', 'bad');
        if (e.pid === this.selfId) this.shake = 1;
        break;
      }
      case 'respawn': break;
      case 'strike': sfx[e.kind === 'lightning' ? 'thunder' : 'strike'](); this.shake = Math.max(this.shake, 0.6); break;
      case 'lever': sfx.lever(); hud.popup(at(e.x, e.y), e.dir > 0 ? 'Belt →' : '← Belt', 'muted'); break;
      case 'monkey': sfx.monkey(); hud.alert('A monkey is loose in the kitchen!', 'monkey'); break;
      case 'stolen': sfx.monkey(); hud.popup(at(e.x, e.y), 'Stolen!', 'bad'); break;
      case 'monkeyscared': sfx.monkey(); break;
      case 'go': break;
      case 'over': break;
    }
  }

  /** HUD hint for what Enter would do right now. */
  hint() {
    const h = this.hint0();
    // the touch Grab button names the action itself, so the line drops the key and keeps the words
    return touchUI.on ? h.replace(/Hold <kbd>[^<]*<\/kbd> to/, 'Hold to').replace(/<kbd>[^<]*<\/kbd>\s*/g, '') : h;
  }

  hint0() {
    this.actWord = 'Grab';
    const p = this.me, sim = this.sim;
    const KA = keyNames((this.locals[0] || {}).ctrl).act, KT = keyNames((this.locals[0] || {}).ctrl).throw;
    if (!p || p.ko > 0) return p && p.ko > 0 ? `Respawning in ${Math.ceil(p.ko)}…` : '';
    const H = p.held;
    if (H && H.kind === 'ext') { this.actWord = 'Spray'; return `Hold <kbd>${KA}</kbd> to spray`; }
    if (!p.target) return H ? `Carrying ${describe(H)}${H.kind === 'ing' ? ` · <kbd>${KT}</kbd> throw` : ''}` : '';
    const word = (v) => { const w0 = v.split(' ')[0].replace(/!$/, ''); this.actWord = w0 === 'Put' ? 'Drop' : w0 === 'Take' || w0 === 'Pick' || w0 === 'Collect' ? 'Grab' : w0 === 'Drop' ? 'Drop' : w0; };
    const verb0 = (v) => { word(v); return `<kbd>${KA}</kbd> ${v}`; };
    if (p.target[2] != null) { const I = sim.mv[p.target[2]] && sim.mv[p.target[2]].item; return H ? verb0(I ? 'Combine' : 'Put down') : I ? verb0('Pick up') : ''; }
    const tl = tileAt(this.L, p.target[0], p.target[1]), s = sim.st(p.target[0], p.target[1]);
    if (s.fire) return 'On fire! Use the extinguisher';
    const I = s.item;
    const verb = verb0;
    switch (tl.st) {
      case 'bin': return H ? '' : verb(`Grab ${INGREDIENTS[tl.ing].name}`);
      case 'board': if (!H && I && I.kind === 'ing' && I.s === 'raw') { this.actWord = 'Chop'; return `Hold <kbd>${KA}</kbd> to chop`; } break;
      case 'sink': if (!H && s.dirty) { this.actWord = 'Wash'; return `Hold <kbd>${KA}</kbd> to wash`; } if (!H && s.clean) return verb('Take clean plate'); if (H && H.kind === 'plate' && H.dirty) return verb('Drop plates in sink'); break;
      case 'return': if (!H && s.dirty) return verb('Collect dirty plates'); break;
      case 'trash': if (H) return verb('Bin it'); break;
      case 'window': if (H && H.kind === 'plate' && H.c.length) return verb('Serve!'); break;
      case 'lever': return verb('Flip conveyor');
      case 'pan': case 'pot': case 'oven':
        if (H && H.kind === 'ing' && H.s === 'chopped' && INGREDIENTS[H.ing].method === tl.st) return verb(`${{ pan: 'Fry', pot: 'Boil', oven: 'Bake' }[tl.st]} it`);
        if (!H && I) return verb('Take it out');
        if (H && H.kind === 'plate' && I && I.s === 'cooked') return verb('Plate it');
        break;
    }
    if (H) return I ? verb('Combine') : verb('Put down');
    if (I) return verb('Pick up');
    return '';
  }

  dispose() {
    this.hud.endMatch();
    if (this.envTex) this.envTex.dispose();
  }
}
