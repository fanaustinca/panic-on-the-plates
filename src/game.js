// One match: owns the Three.js scene for a level, the Sim (host) or its mirror (client), the
// cooks, input, network traffic and the in-game HUD feed.
import * as THREE from 'three';
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

const SNAP_HZ = 20;

function skyTexture(top, bottom) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#' + top.toString(16).padStart(6, '0'));
  grd.addColorStop(1, '#' + bottom.toString(16).padStart(6, '0'));
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
    this.sim.players.forEach((p) => { p.local = this.isHost && p.id === this.selfId; });
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
    playMusic(this.world.id, 124 + wi * 3);
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

  fit() {
    const w = this.renderer.domElement.clientWidth || innerWidth, h = this.renderer.domElement.clientHeight || innerHeight;
    const aspect = w / h;
    this.camera.aspect = aspect;
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    // the galleon gets extra room so its bow, stern and rigging frame the kitchen
    const pad = this.world.id === 'pirate' ? [4.2, 3.2] : this.world.id === 'jungle' ? [2.6, 3.0] : this.world.id === 'factory' ? [3.4, 2.8] : [2.2, 1.8];
    const W = this.L.W + pad[0], H = this.L.H + pad[1];
    const elev = THREE.MathUtils.degToRad(52);
    // distance so the kitchen fits horizontally and (foreshortened) vertically, leaving room for the HUD
    const dW = (W / 2) / Math.tan(hfov / 2) / 0.9;
    const dH = (H * Math.sin(elev) / 2 + 0.9) / Math.tan(vfov / 2) / 0.84;
    const d = Math.max(dW, dH);
    this.camBase = new THREE.Vector3(0, Math.sin(elev) * d, Math.cos(elev) * d + 0.3);
    this.camera.position.copy(this.camBase);
    this.camLook = new THREE.Vector3(0, 0, 0.45);
    this.camera.lookAt(this.camLook);
    this.camera.updateProjectionMatrix();
    // keep fog out of the kitchen itself: it only softens the far backdrop
    this.scene.fog.near = d * 1.35; this.scene.fog.far = d * 3.2;
    const db = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.kitchen.parts.setScale(db.y / 2 * this.camera.projectionMatrix.elements[5]);
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
      } else if (m.k === 'press' || m.k === 'work') {
        // actions carry the guest's own position, so a press right after arriving isn't judged on a stale one
        if (m.at && m.at.lf === p.life && p.ko <= 0) Object.assign(p, { x: m.at.x, y: m.at.y, fx: m.at.fx, fy: m.at.fy });
        if (m.k === 'press') this.sim.press(from, m.tg); else this.sim.setWork(from, m.on, m.tg);
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
    const canAct = playing && me && me.ko <= 0 && !this.paused;

    // local input
    const mv = canAct ? inp.move() : { mx: 0, my: 0 };
    const jump = canAct && inp.consumeJump();
    if (canAct && jump && me.z <= 0.001 && !me.falling) sfx.jump();
    if (me) {
      me.target = me.ko > 0 ? null : findTarget(this.L, me, Math.max(0, t));
      if (canAct) {
        if (inp.consumePress()) {
          if (this.isHost) { this.sim.press(this.selfId, me.target); this.sim.setWork(this.selfId, true, me.target); }
          else { const at = { x: +me.x.toFixed(3), y: +me.y.toFixed(3), fx: +me.fx.toFixed(3), fy: +me.fy.toFixed(3), lf: me.life }; this.room.toHost({ k: 'press', tg: me.target, at }); this.room.toHost({ k: 'work', on: true, tg: me.target, at }); }
        }
        if (inp.consumeRelease()) {
          if (this.isHost) this.sim.setWork(this.selfId, false);
          else this.room.toHost({ k: 'work', on: false });
        }
      } else { inp.consumePress(); inp.consumeRelease(); }
    }

    if (this.isHost) {
      if (me) me.inp = { mx: mv.mx, my: mv.my, jump };
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
        movePlayer(this.L, me, { mx: mv.mx, my: mv.my, jump }, dt, t);
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
      level: this.level, score: sim.score, delivered: sim.delivered, failed: sim.failed, tips: sim.tips,
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
      c.animate({ speed: Math.hypot(vx, vy), z: c.disp.z, act: p.act, holding: !!p.held, dt, t: rt });
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
    this.kitchen.setHighlight(this.me && this.me.ko <= 0 && sim.phase === 'play' ? this.me.target : null);
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
        hud.popup(at(e.x, e.y, 1.6), `+${e.points}${e.tip ? ` <small>+${e.tip} tip${e.combo > 1 ? ` x${e.combo}` : ''}</small>` : ''}`, 'good');
        hud.orderDone(e.oid);
        break;
      case 'wrong': sfx.wrong(); hud.popup(at(e.x, e.y), e.msg, 'bad'); break;
      case 'blocked': if (this.me && this.me.target && this.me.target[0] === e.x && this.me.target[1] === e.y) { sfx.wrong(); hud.popup(at(e.x, e.y), e.msg, 'warn'); } break;
      case 'order': sfx.order(); break;
      case 'expire': sfx.expire(); hud.orderFailed(e.oid); break;
      case 'washed': sfx.washed(); break;
      case 'dirty': break;
      case 'ko': {
        const pos = K.root.localToWorld(new THREE.Vector3(K.wx(e.x), 1.2, K.wz(e.y)));
        if (e.why === 'fell') sfx.splash(); else sfx.ko();
        hud.popup(pos, { fell: 'Splash!', cannon: 'Ka-BOOM!', embers: 'Scorched!', lightning: 'Zapped!', hazard: 'Ouch!', cuckoo: 'Cuckoo!' }[e.why] || 'Ouch!', 'bad');
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
    const p = this.me, sim = this.sim;
    if (!p || p.ko > 0) return p && p.ko > 0 ? `Respawning in ${Math.ceil(p.ko)}…` : '';
    const H = p.held;
    if (H && H.kind === 'ext') return 'Hold <kbd>Enter</kbd> to spray';
    if (!p.target) return H ? `Carrying ${describe(H)}` : '';
    const verb0 = (v) => `<kbd>Enter</kbd> ${v}`;
    if (p.target[2] != null) { const I = sim.mv[p.target[2]] && sim.mv[p.target[2]].item; return H ? verb0(I ? 'Combine' : 'Put down') : I ? verb0('Pick up') : ''; }
    const tl = tileAt(this.L, p.target[0], p.target[1]), s = sim.st(p.target[0], p.target[1]);
    if (s.fire) return 'On fire! Use the extinguisher';
    const I = s.item;
    const verb = (v) => `<kbd>Enter</kbd> ${v}`;
    switch (tl.st) {
      case 'bin': return H ? '' : verb(`Grab ${INGREDIENTS[tl.ing].name}`);
      case 'board': if (!H && I && I.kind === 'ing' && I.s === 'raw') return 'Hold <kbd>Enter</kbd> to chop'; break;
      case 'sink': if (!H && s.dirty) return 'Hold <kbd>Enter</kbd> to wash'; if (!H && s.clean) return verb('Take clean plate'); if (H && H.kind === 'plate' && H.dirty) return verb('Drop plates in sink'); break;
      case 'return': if (!H && s.dirty) return verb('Collect dirty plates'); break;
      case 'trash': if (H) return verb('Bin it'); break;
      case 'window': if (H && H.kind === 'plate' && H.c.length) return verb('Serve!'); break;
      case 'lever': return verb('Flip conveyor');
      case 'pan': case 'pot': case 'oven':
        if (H && H.kind === 'ing' && H.s === 'chopped' && INGREDIENTS[H.ing].method === tl.st) return verb(`${METHOD_LABEL[tl.st].replace(/ed$/, '')} it`);
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
