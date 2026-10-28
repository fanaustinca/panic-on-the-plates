// Kitchen renderer: static tiles/stations from the level, plus per-frame dynamic state (items,
// fires, progress bars, moving floes/walls/bridges, hazards, monkeys).
import * as THREE from 'three';
import { T, INGREDIENTS, WORLDS } from '../config.js';
import { tileAt } from '../levels.js';
import { floeAt, cycle, shiftUp, shiftWarn, bridgeOff, bridgeWarn, strikesNear, holeAt, HOLE_TIME, cuckooAt, envAt, WARN, moverX, moverWarn } from '../hazards.js';
import { floorTex, wallTex, topTex, stripeTex, beltTex, glowTex, textTex, shade, cabinetTex } from './textures.js';
import { Particles } from './particles.js';
import { WATERLINE } from './ship.js';
import { mat, part, sph, cyl, box, cone, tor, capsule, ico, dode, makeItem, itemKey, makeIngredient } from './items.js';
import { STYLE, buildBackdrop } from './env.js';
import { treehouse } from './treehouse.js';

const CH = 0.9; // counter height
const ITEM_Y = { pan: 0.13, pot: 0.2, board: 0.05, oven: 0.0, sink: 0.0 };

export class Kitchen {
  constructor(L) {
    this.L = L;
    this.world = WORLDS[L.world];
    this.S = STYLE[this.world.id];
    this.root = new THREE.Group();     // tilts with the deck
    this.dyn = new THREE.Group();
    this.root.add(this.dyn);
    this.itemMeshes = new Map();
    this.bars = new Map();
    this.fires = new Map();
    this.stationParts = new Map();
    this.fx = [];
    this.parts = new Particles(1600);
    this.root.add(this.parts.group);
    this.chopN = new Map();   // per-cook chop stroke counter (spawns bits on each knife hit)
    this.squash = new Map();  // per-tile squash pulse from knife hits
    this.emitAcc = 0;
    this.struckFx = new Set();
    this.holeTiles = new Set();
    this.tmpQ = new THREE.Quaternion();
    this.pods = null;
    this.build();
    if (this.pods) {
      // particles spawned at flat-layout positions are carried onto the swaying pods
      const v = new THREE.Vector3();
      this.parts.map = (o) => { v.set(o.x, o.y, o.z); this.swayPoint(v); if (o.floor != null) o.floor += v.y - o.y; o.x = v.x; o.y = v.y; o.z = v.z; };
    }
  }

  wx(x) { return x - this.L.W / 2; }      // tile edge -> world x
  wz(y) { return y - this.L.H / 2; }
  cx(x) { return x + 0.5 - this.L.W / 2; } // tile centre
  cz(y) { return y + 0.5 - this.L.H / 2; }

  /** Direction a station faces (towards walkable floor), as [dx, dy]. */
  faceDir(t) {
    const L = this.L;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const n = tileAt(L, t.x + dx, t.y + dy);
      if (n && (n.k === 'floor' || n.k === 'bridge')) return [dx, dy];
    }
    return [0, 1];
  }

  build() {
    const L = this.L, S = this.S;
    if (this.world.id === 'jungle') this.makePods();
    const floorM = new THREE.MeshStandardMaterial({ map: floorTex(S.floor), roughness: S.floor === 'ice' ? 0.15 : 0.7, metalness: S.floor === 'ice' ? 0.1 : 0.05 });
    const wallM = new THREE.MeshStandardMaterial({ map: wallTex(S.wall), roughness: 0.8 });
    const topM = new THREE.MeshStandardMaterial({ map: topTex(S.top), roughness: S.top === 'ice' || S.top === 'marble' ? 0.25 : S.top === 'stone' ? 0.35 : 0.55, metalness: S.top === 'steel' ? 0.6 : 0 });
    const sideM = new THREE.MeshStandardMaterial({ map: cabinetTex(S.top === 'steel' || S.top === 'panel' ? 'steel' : 'wood'), color: S.side, roughness: 0.55, metalness: S.top === 'steel' || S.top === 'panel' ? 0.35 : 0 });
    const trimM = mat(S.trim, { rough: 0.4, metal: 0.3, emissive: this.world.id === 'volcano' || this.world.id === 'space' ? S.trim : 0, ei: 0.5 });
    const floors = L.tiles.filter((t) => t.k === 'floor');
    const counters = L.tiles.filter((t) => t.k === 'counter' && !['trash', 'oven'].includes(t.st));
    const walls = L.tiles.filter((t) => t.k === 'wall');
    // one instanced mesh per parent (the root, or each swaying treehouse pod)
    const inst = (geom, material, list, fn) => {
      const by = new Map([[this.home(list.length ? list[0].x : -1), []]]);
      for (const t of list) { const h = this.home(t.x); if (!by.has(h)) by.set(h, []); by.get(h).push(t); }
      let first = null;
      for (const [h, sub] of by) {
        const m = new THREE.InstancedMesh(geom, material, Math.max(1, sub.length));
        const o = new THREE.Object3D();
        sub.forEach((t, i) => { fn(o, t); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
        m.count = sub.length;
        m.castShadow = true; m.receiveShadow = true;
        h.add(m);
        first = first || m;
      }
      return first;
    };
    const B = new THREE.BoxGeometry(1, 1, 1);
    // floor slabs (counters sit on slabs too, so islands read as solid platforms)
    const slabs = L.tiles.filter((t) => t.k === 'floor' || (t.k === 'counter' && !t.overVoid) || t.k === 'wall');
    this.slabTop = inst(B, floorM, slabs, (o, t) => { o.position.set(this.cx(t.x), -0.15, this.cz(t.y)); o.scale.set(1, 0.3, 1); });
    this.slabBot = inst(B, mat(shade(S.side, -0.35), { rough: 0.8 }), slabs, (o, t) => { o.position.set(this.cx(t.x), -0.55, this.cz(t.y)); o.scale.set(0.98, 0.5, 0.98); });
    this.slabIdx = new Map(slabs.map((t, i) => [t.y * L.W + t.x, i]));
    // counters
    inst(B, sideM, counters, (o, t) => { o.position.set(this.cx(t.x), CH / 2 - 0.05, this.cz(t.y)); o.scale.set(0.96, CH - 0.1, 0.96); });
    inst(B, topM, counters, (o, t) => { o.position.set(this.cx(t.x), CH - 0.04, this.cz(t.y)); o.scale.set(1.0, 0.08, 1.0); });
    inst(B, trimM, counters, (o, t) => { o.position.set(this.cx(t.x), 0.06, this.cz(t.y)); o.scale.set(0.98, 0.1, 0.98); });
    // walls
    inst(B, wallM, walls, (o, t) => { o.position.set(this.cx(t.x), 1.25, this.cz(t.y)); o.scale.set(1, 2.5, 1); });
    inst(B, trimM, walls, (o, t) => { o.position.set(this.cx(t.x), 2.55, this.cz(t.y)); o.scale.set(1.02, 0.12, 1.04); });
    for (const t of floors) if (t.push) this.addPushBelt(t);
    for (const t of L.tiles) if (t.k === 'counter') this.buildStation(t, sideM, topM);
    this.buildBridges();
    this.buildFloes();
    this.buildShifters();
    this.buildMovers(sideM, topM);
    this.buildHazardProps();
    this.backdrop = buildBackdrop(this.world.id, L.W, L.H, this.world.sky, L);
    this.root.add(this.backdrop.group);
    if (this.pods) this.buildTreehouse();
    this.worldGroup = this.backdrop.world; // added to the scene by the game; does not roll
    // target highlight
    this.highlight = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.04, 1.04), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
    this.highlight.visible = false;
    this.root.add(this.highlight);
  }

  addPushBelt(t) {
    const tex = beltTex().clone();
    tex.needsUpdate = true;
    tex.rotation = t.push > 0 ? 0 : Math.PI;
    tex.center.set(0.5, 0.5);
    const m = part(new THREE.PlaneGeometry(0.98, 0.98), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), [this.cx(t.x), 0.006, this.cz(t.y)], 1, [-Math.PI / 2, 0, 0]);
    this.home(t.x).add(m);
    this.fx.push({ belt: tex, dir: 1 });
  }

  buildStation(t, sideM, topM) {
    const g = new THREE.Group();
    g.position.set(this.cx(t.x), CH, this.cz(t.y));
    const [dx, dy] = this.faceDir(t);
    g.rotation.y = Math.atan2(dx, dy);
    this.home(t.x).add(g);
    const P = { group: g };
    const add = (...a) => { const m = part(...a); g.add(m); return m; };
    const steel = mat(0xc8d0d8, { metal: 0.8, rough: 0.3 }), dark = mat(0x26282c, { metal: 0.5, rough: 0.5 });
    if (t.belt != null) {
      const tex = beltTex().clone(); tex.needsUpdate = true;
      const bm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
      const belt = part(new THREE.PlaneGeometry(1, 0.8), bm, [0, 0.005, 0], 1, [-Math.PI / 2, 0, 0]);
      g.rotation.y = 0; g.add(belt);
      add(box(), mat(0xffc020, { metal: 0.4, rough: 0.4 }), [0, 0.04, 0.44], [1, 0.08, 0.06]);
      add(box(), mat(0xffc020, { metal: 0.4, rough: 0.4 }), [0, 0.04, -0.44], [1, 0.08, 0.06]);
      if (t.overVoid) { add(box(), mat(0x56606c, { metal: 0.5 }), [0, -0.3, 0], [1, 0.5, 0.9]); for (const s of [-1, 1]) add(box(), mat(0x3a3e44), [0, -3, s * 0.35], [0.12, 5, 0.12]); }
      this.fx.push({ belt: tex, beltIdx: t.belt });
    }
    switch (t.st) {
      case 'board':
        add(box(), mat(0xd8a868, { rough: 0.7 }), [0, 0.025, 0], [0.62, 0.05, 0.5]);
        add(box(), mat(0xb88848, { rough: 0.7 }), [0, 0.03, -0.18], [0.5, 0.012, 0.03]);
        P.knife = add(box(), mat(0xdfe6ee, { metal: 0.8, rough: 0.25 }), [0.26, 0.06, 0.1], [0.04, 0.012, 0.3], [0, 0.4, 0]);
        break;
      case 'pan': case 'pot': {
        add(box(), dark, [0, 0.02, 0], [0.86, 0.04, 0.86]);
        P.ring = add(tor(), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, emissive: 0xff4a10, emissiveIntensity: 0 }), [0, 0.045, 0], [0.24, 0.24, 0.2], [Math.PI / 2, 0, 0]);
        for (const s of [-1, 1]) add(cyl(12), mat(0x111111), [s * 0.3, 0.02, 0.38], [0.04, 0.04, 0.04], [Math.PI / 2, 0, 0]);
        if (t.st === 'pan') {
          add(cyl(28), mat(0x2a2a2e, { metal: 0.6, rough: 0.35 }), [0, 0.08, 0], [0.32, 0.07, 0.32]);
          add(cyl(28), mat(0x3a3a40, { metal: 0.5, rough: 0.4 }), [0, 0.11, 0], [0.28, 0.01, 0.28]);
          add(box(), mat(0x1a1a1a), [0.5, 0.1, 0], [0.4, 0.04, 0.06]);
        } else {
          add(cyl(28), steel, [0, 0.2, 0], [0.3, 0.32, 0.3]);
          add(cyl(28), mat(0x8a929a, { metal: 0.6 }), [0, 0.36, 0], [0.27, 0.01, 0.27]);
          for (const s of [-1, 1]) add(tor(), steel, [s * 0.32, 0.3, 0], [0.06, 0.06, 0.08], [0, Math.PI / 2, 0]);
        }
        break;
      }
      case 'oven': {
        g.position.y = 0;
        add(box(), mat(0x3a3e44, { metal: 0.5, rough: 0.4 }), [0, 0.55, 0], [0.96, 1.1, 0.96]);
        add(box(), mat(0x6a727c, { metal: 0.7, rough: 0.3 }), [0, 1.12, 0], [1.0, 0.06, 1.0]);
        P.door = add(box(), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0xff7a20, emissiveIntensity: 0.05, roughness: 0.1 }), [0, 0.5, 0.485], [0.66, 0.42, 0.02]);
        add(box(), steel, [0, 0.8, 0.5], [0.6, 0.04, 0.04]);
        for (let i = 0; i < 3; i++) add(cyl(12), mat(0x111111), [-0.25 + i * 0.25, 0.96, 0.49], [0.05, 0.03, 0.05], [Math.PI / 2, 0, 0]);
        add(cyl(10), mat(0x6a727c, { metal: 0.6 }), [0.3, 1.5, -0.3], [0.08, 0.8, 0.08]);
        break;
      }
      case 'trash': {
        g.position.y = 0;
        add(cyl(24), mat(0x5a646e, { metal: 0.6, rough: 0.35 }), [0, 0.42, 0], [0.38, 0.84, 0.38]);
        add(cyl(24, 1), mat(0x3a424a, { metal: 0.6, rough: 0.35 }), [0, 0.86, 0], [0.4, 0.05, 0.4]);
        add(cyl(24), mat(0x111111), [0, 0.89, 0], [0.3, 0.01, 0.3]);
        add(box(), mat(0x2a2a2a), [0, 0.04, 0.36], [0.2, 0.05, 0.14]);
        const sign = add(new THREE.CircleGeometry(0.13, 20), new THREE.MeshBasicMaterial({ map: textTex('🗑', { w: 64, h: 64, font: '40px sans-serif' }), transparent: true }), [0, 0.5, 0.385]);
        sign.castShadow = false;
        g.remove(sign);
        for (let i = 0; i < 6; i++) add(box(), mat(0x6a747e, { metal: 0.6 }), [Math.cos(i) * 0.385, 0.45, Math.sin(i) * 0.385], [0.02, 0.6, 0.02], [0, -i, 0]);
        break;
      }
      case 'sink':
        add(box(), steel, [0, 0.0, 0], [0.84, 0.04, 0.7]);
        add(box(), mat(0x9aa4ae, { metal: 0.6, rough: 0.3 }), [0, -0.06, 0], [0.62, 0.12, 0.48]);
        P.water = add(box(), mat(0x6ac8ff, { opacity: 0.7, rough: 0.05 }), [0, -0.04, 0], [0.6, 0.02, 0.46]);
        add(cyl(10), steel, [0, 0.2, -0.32], [0.035, 0.4, 0.035]);
        add(cyl(10), steel, [0, 0.4, -0.2], [0.03, 0.26, 0.03], [Math.PI / 2, 0, 0]);
        add(box(), mat(0xd8dde6, { metal: 0.5 }), [0.52, 0.12, 0], [0.18, 0.24, 0.5]);
        break;
      case 'return': {
        // dish-return hatch: steel housing with a strip curtain, a sloped roller chute and a beacon
        const ss = mat(0xc9d1d9, { metal: 0.85, rough: 0.28 });
        add(box(), ss, [0, 0.5, -0.31], [0.94, 1.0, 0.34]);
        add(box(), mat(0x9aa4ae, { metal: 0.8, rough: 0.3 }), [0, 1.02, -0.31], [0.98, 0.05, 0.38]);
        add(box(), mat(0x0a0c10, { rough: 1 }), [0, 0.36, -0.135], [0.66, 0.46, 0.01]);
        P.strips = [];
        for (let k = 0; k < 6; k++) {
          const st = new THREE.Group(); st.position.set(-0.275 + k * 0.11, 0.58, -0.125);
          st.add(part(box(), mat(0x9fb4c0, { opacity: 0.55, rough: 0.2 }), [0, -0.2, 0], [0.1, 0.4, 0.01]));
          st.children[0].castShadow = false;
          g.add(st); P.strips.push(st);
        }
        // chute: rails + rollers sloping down towards the cooks
        for (const sx of [-1, 1]) add(box(), ss, [sx * 0.4, 0.13, 0.13], [0.05, 0.12, 0.6], [-0.2, 0, 0]);
        for (let k = 0; k < 6; k++) add(cyl(12), mat(0x5a646e, { metal: 0.7, rough: 0.35 }), [0, 0.2 - k * 0.022, -0.12 + k * 0.1], [0.035, 0.76, 0.035], [0, 0, Math.PI / 2]);
        add(box(), ss, [0, 0.06, 0.45], [0.84, 0.1, 0.05]);
        // sign: dirty plate pictogram
        const sg = add(new THREE.PlaneGeometry(0.62, 0.2), new THREE.MeshBasicMaterial({ map: textTex('RETURNS', { w: 256, h: 80, bg: '#20303c', fg: '#bfe6ff', font: '800 46px Fredoka, sans-serif' }) }), [0, 0.79, -0.139]);
        sg.castShadow = false;
        P.beacon = add(sph(16), new THREE.MeshStandardMaterial({ color: 0xffa020, emissive: 0xff8000, emissiveIntensity: 0.1, transparent: true, opacity: 0.9, roughness: 0.2 }), [0.32, 1.08, -0.31], [0.07, 0.07, 0.07]);
        add(cyl(12), mat(0x2a2d31), [0.32, 1.05, -0.31], [0.08, 0.03, 0.08]);
        break;
      }
      case 'window': {
        // the serving pass: steel shelf under heat lamps, a lit ORDER UP header, the dining room glowing behind
        const ss = mat(0xdfe5ea, { metal: 0.85, rough: 0.2 });
        const red = mat(0xd8402a, { rough: 0.35, metal: 0.2 });
        add(box(), ss, [0, 0.025, 0], [0.98, 0.05, 0.98]);
        add(box(), red, [0, 0.0, 0.48], [0.98, 0.07, 0.05]);
        // landing pad for the plate: gold inset with a glowing edge
        P.pad = add(box(), new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0xffb000, emissiveIntensity: 0.35, metalness: 0.6, roughness: 0.3 }), [0, 0.054, 0.05], [0.56, 0.01, 0.5]);
        add(box(), ss, [0, 0.058, 0.05], [0.5, 0.01, 0.44]);
        // hatch frame (posts + header) at the back
        for (const sx of [-1, 1]) add(box(), red, [sx * 0.45, 0.72, -0.42], [0.08, 1.44, 0.12]);
        add(box(), red, [0, 1.42, -0.42], [0.98, 0.3, 0.16]);
        const sign = add(new THREE.PlaneGeometry(0.86, 0.22), new THREE.MeshBasicMaterial({ map: textTex('ORDER UP!', { bg: '#1b1b2a', fg: '#ffd23a', font: '800 40px Fredoka, sans-serif' }) }), [0, 1.42, -0.335]);
        sign.castShadow = false;
        P.sign = sign;
        // the dining room behind: warm glow panel
        const room = add(new THREE.PlaneGeometry(0.82, 1.15), new THREE.MeshBasicMaterial({ map: diningTex(), toneMapped: true }), [0, 0.68, -0.47]);
        room.castShadow = false;
        // ticket rail with clipped tickets
        add(box(), ss, [0, 1.22, -0.33], [0.84, 0.03, 0.03]);
        P.tickets = [];
        for (let k = 0; k < 3; k++) {
          const tk = add(new THREE.PlaneGeometry(0.13, 0.17), new THREE.MeshStandardMaterial({ color: 0xfffbea, roughness: 0.9, side: THREE.DoubleSide }), [-0.25 + k * 0.25, 1.12, -0.315], 1, [0, 0, (k - 1) * 0.08]);
          tk.castShadow = false;
          P.tickets.push(tk);
        }
        // two heat lamps hanging from the header
        P.lamps = [];
        for (const sx of [-0.24, 0.24]) {
          add(cyl(6), mat(0x222222), [sx, 1.25, -0.2], [0.012, 0.3, 0.012]);
          add(cone(20), mat(0xb02a1a, { metal: 0.4, rough: 0.35 }), [sx, 1.06, -0.2], [0.13, 0.14, 0.13]);
          const bulb = add(sph(12), new THREE.MeshStandardMaterial({ color: 0xffd0a0, emissive: 0xff7a30, emissiveIntensity: 1.6 }), [sx, 0.99, -0.2], 0.05);
          bulb.castShadow = false;
          P.lamps.push(bulb);
        }
        const cone2 = add(new THREE.ConeGeometry(0.42, 0.95, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xff9a40, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), [0, 0.52, -0.1]);
        cone2.castShadow = false;
        P.bell = add(sph(14), mat(0xf2c23a, { metal: 0.9, rough: 0.2 }), [0.36, 0.1, 0.32], [0.075, 0.06, 0.075]);
        add(cyl(10), mat(0x2a2a2a), [0.36, 0.065, 0.32], [0.09, 0.02, 0.09]);
        break;
      }
      case 'bin': {
        const crate = mat(0xa8784a, { rough: 0.8 });
        add(box(), mat(0x4a3420), [0, 0.02, 0], [0.86, 0.04, 0.86]);
        for (const [x, z, w, d] of [[0, 0.41, 0.86, 0.06], [0, -0.41, 0.86, 0.06], [0.41, 0, 0.06, 0.86], [-0.41, 0, 0.06, 0.86]]) add(box(), crate, [x, 0.12, z], [w, 0.22, d]);
        const I = INGREDIENTS[t.ing];
        const sign = add(box(), mat(I.c1, { rough: 0.5 }), [0, 0.18, 0.45], [0.5, 0.18, 0.02]);
        sign.castShadow = false;
        for (let i = 0; i < 3; i++) {
          const m = makeIngredient(t.ing, 'raw');
          m.position.set((i - 1) * 0.22, 0.05 + (i === 1 ? 0.06 : 0), (i % 2) * 0.12 - 0.05);
          m.rotation.y = i * 1.7;
          m.scale.setScalar(0.85);
          g.add(m);
        }
        break;
      }
      case 'lever': {
        add(box(), dark, [0, 0.04, 0], [0.4, 0.08, 0.3]);
        const arm = new THREE.Group();
        arm.position.set(0, 0.08, 0);
        arm.add(part(cyl(10), steel, [0, 0.22, 0], [0.03, 0.44, 0.03]));
        arm.add(part(sph(14), mat(0xe8302a, { rough: 0.3 }), [0, 0.45, 0], 0.07));
        g.add(arm);
        P.arm = arm;
        g.rotation.y = 0;
        break;
      }
    }
    this.stationParts.set(t.y * this.L.W + t.x, P);
  }

  buildBridges() {
    this.bridgeMeshes = [];
    const id = this.world.id;
    for (const b of this.L.bridges) {
      if (b.rope && this.pods) { this.bridgeMeshes.push({ b, g: this.buildRopeBridge(b) }); continue; }
      const g = new THREE.Group();
      for (const [x, y] of b.tiles) {
        const tg = new THREE.Group();
        tg.position.set(this.cx(x), 0, this.cz(y));
        if (b.rope) {
          for (let i = 0; i < 5; i++) tg.add(part(box(), mat(0x9a6a3a, { rough: 0.9 }), [-0.4 + i * 0.2, -0.03, 0], [0.17, 0.05, 0.9]));
          for (const s of [-1, 1]) tg.add(part(cyl(6), mat(0xd8c08a), [0, 0.45, s * 0.46], [0.02, 1, 0.02], [0, 0, Math.PI / 2]));
        } else {
          const look = { pirate: [0x8a5a30, 0x5a3a1a], volcano: [0x3a3236, 0xff6a20], space: [0x8b96a6, 0x2ad0ff], clouds: [0xf6f2ea, 0xd8b050], factory: [0x6a727c, 0xffc020], library: [0x6a3e26, 0xd8a84a], glacier: [0xcfefff, 0x5a98bc] }[id] || [0x888888, 0x444444];
          tg.add(part(box(), mat(look[0], { rough: 0.6 }), [0, -0.08, 0], [1, 0.16, 0.9]));
          for (const s of [-1, 1]) tg.add(part(box(), mat(look[1], { rough: 0.4, metal: 0.4 }), [0, 0.06, s * 0.47], [1, 0.12, 0.06]));
        }
        g.add(tg);
      }
      if (b.rope) for (const [x, y] of [b.tiles[0], b.tiles[b.tiles.length - 1]]) for (const s of [-1, 1]) g.add(part(cyl(8), mat(0x6a4a2a), [this.cx(x), 0.45, this.cz(y) + s * 0.46], [0.05, 0.9, 0.05]));
      this.root.add(g);
      this.bridgeMeshes.push({ b, g });
    }
  }

  buildFloes() {
    this.floeMeshes = this.L.floes.map((f) => {
      const g = new THREE.Group();
      const top = part(box(), new THREE.MeshStandardMaterial({ map: floorTex('ice'), roughness: 0.15 }), [f.w / 2, -0.12, f.h / 2], [f.w - 0.06, 0.24, f.h - 0.06]);
      g.add(top);
      g.add(part(dode(), mat(0xbfe6f6, { rough: 0.3, flat: true }), [f.w / 2, -0.55, f.h / 2], [f.w * 0.55, 0.45, f.h * 0.55]));
      this.root.add(g);
      return { f, g };
    });
  }

  buildMovers(sideM, topM) {
    this.moverMeshes = (this.L.movers || []).map((m) => {
      // rail track sunk into the floor along the whole run
      const len = m.x1 - m.x0 + 1;
      const tg = new THREE.Group();
      tg.position.set(this.wx(m.x0) + len / 2, 0, this.cz(m.y));
      tg.add(part(new THREE.PlaneGeometry(len - 0.04, 0.7), new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6, metalness: 0.5 }), [0, 0.004, 0], 1, [-Math.PI / 2, 0, 0]));
      for (const sz of [-0.22, 0.22]) tg.add(part(box(), mat(0xb8c0c8, { metal: 0.85, rough: 0.25 }), [0, 0.018, sz], [len - 0.08, 0.025, 0.05]));
      for (let k = 0; k < len * 3; k++) tg.add(part(box(), mat(0x4a3a2a, { rough: 0.9 }), [-len / 2 + 0.17 + k / 3, 0.008, 0], [0.08, 0.012, 0.62]));
      const ends = stripeTex();
      for (const sx of [-1, 1]) tg.add(part(new THREE.PlaneGeometry(0.16, 0.7), new THREE.MeshBasicMaterial({ map: ends }), [sx * (len / 2 - 0.08), 0.012, 0], 1, [-Math.PI / 2, 0, 0]));
      tg.children.forEach((c) => { c.castShadow = false; });
      this.home(m.x0).add(tg);
      // the counter itself on a wheeled bogie
      const g = new THREE.Group();
      g.add(part(box(), sideM, [0, CH / 2 + 0.02, 0], [0.94, CH - 0.12, 0.94]));
      g.add(part(box(), topM, [0, CH - 0.04, 0], [1.0, 0.08, 1.0]));
      g.add(part(box(), mat(0x30343a, { metal: 0.6, rough: 0.4 }), [0, 0.06, 0], [0.98, 0.1, 0.98]));
      for (const sx of [-0.33, 0.33]) for (const sz of [-0.22, 0.22]) g.add(part(cyl(14), mat(0x111111, { rough: 0.5 }), [sx, 0.07, sz], [0.07, 0.06, 0.07], [Math.PI / 2, 0, 0]));
      const lights = [];
      for (const sx of [-1, 1]) {
        g.add(part(new THREE.PlaneGeometry(0.94, 0.12), new THREE.MeshStandardMaterial({ map: stripeTex(), roughness: 0.6 }), [0, 0.2, sx * 0.476], 1, [0, sx > 0 ? 0 : Math.PI, 0]));
        const l = part(sph(10), new THREE.MeshStandardMaterial({ color: 0xffa020, emissive: 0xff8000, emissiveIntensity: 0.1 }), [sx * 0.42, CH + 0.05, 0.42], 0.05);
        g.add(l); lights.push(l);
      }
      this.home(m.x0).add(g);
      return { m, g, lights, hold: null, key: '' };
    });
  }

  buildShifters() {
    this.shiftMeshes = this.L.shifters.map((s) => {
      const g = new THREE.Group();
      g.position.set(this.cx(s.x), 0, this.cz(s.y));
      const m = part(box(), new THREE.MeshStandardMaterial({ map: wallTex(this.S.wall), roughness: 0.8 }), [0, 0.6, 0], [0.96, 1.2, 0.96]);
      g.add(m);
      g.add(part(box(), mat(this.S.trim, { metal: 0.3, rough: 0.4 }), [0, 1.22, 0], [1, 0.08, 1]));
      const warn = part(new THREE.PlaneGeometry(0.96, 0.96), new THREE.MeshBasicMaterial({ map: stripeTex(), transparent: true, opacity: 0.8, depthWrite: false }), [0, 0.012, 0], 1, [-Math.PI / 2, 0, 0]);
      warn.castShadow = false;
      const wg = new THREE.Group(); wg.add(warn); wg.position.copy(g.position);
      this.home(s.x).add(g, wg);
      return { s, g, warn: wg };
    });
  }

  buildHazardProps() {
    const L = this.L, hz = L.hz;
    this.hzMeshes = [];
    const flameM = mat(0xff7a1a, { emissive: 0xff5a00, ei: 2.2, opacity: 0.9 });
    const flameM2 = mat(0xffd23a, { emissive: 0xffb000, ei: 2.5, opacity: 0.9 });
    // fire walls: vents + flame columns
    for (const fw of hz.firewalls || []) {
      const items = fw.cells.map(([x, y]) => {
        const g = new THREE.Group();
        g.position.set(this.cx(x), 0, this.cz(y));
        g.add(part(box(), mat(0x1a1416), [0, 0.01, 0], [0.9, 0.02, 0.9]));
        const crack = part(box(), new THREE.MeshStandardMaterial({ color: 0xff4a10, emissive: 0xff3a00, emissiveIntensity: 1 }), [0, 0.022, 0], [0.7, 0.01, 0.12]);
        g.add(crack);
        const fl = new THREE.Group();
        for (let i = 0; i < 4; i++) fl.add(part(cone(8), i % 2 ? flameM : flameM2, [(i - 1.5) * 0.18, 0.5, (i % 2) * 0.1 - 0.05], [0.16, 1.1, 0.16]));
        g.add(fl);
        this.root.add(g);
        return { g, fl, crack };
      });
      this.hzMeshes.push({ kind: 'firewall', h: fw, items });
    }
    for (const gy of hz.geysers || []) {
      const g = new THREE.Group();
      g.position.set(this.cx(gy.x), 0, this.cz(gy.y));
      g.add(part(cyl(16), mat(0x2a2224, { rough: 0.9 }), [0, 0.05, 0], [0.42, 0.1, 0.42]));
      g.add(part(cyl(16), mat(0xff5a10, { emissive: 0xff3a00, ei: 1.5 }), [0, 0.1, 0], [0.28, 0.02, 0.28]));
      const col = part(cyl(16), mat(0xff6a10, { emissive: 0xff4a00, ei: 2, opacity: 0.85 }), [0, 1.2, 0], [0.3, 2.4, 0.3]);
      g.add(col);
      this.root.add(g);
      this.hzMeshes.push({ kind: 'geyser', h: gy, g, col });
    }
    const laserM = new THREE.MeshStandardMaterial({ color: 0xff2a4a, emissive: 0xff0a2a, emissiveIntensity: 3, transparent: true, opacity: 0.9 });
    for (const lz of hz.lasers || []) {
      const items = lz.cells.map(([x, y]) => {
        const g = new THREE.Group();
        g.position.set(this.cx(x), 0, this.cz(y));
        for (const s of [-1, 1]) g.add(part(box(), mat(0x3a3e48, { metal: 0.6 }), [s * 0.46, 0.5, 0], [0.06, 1, 0.12]));
        const beams = new THREE.Group();
        for (let i = 0; i < 4; i++) beams.add(part(box(), laserM, [0, 0.15 + i * 0.25, 0], [0.9, 0.025, 0.025]));
        beams.children.forEach((m) => { m.castShadow = false; });
        g.add(beams);
        this.root.add(g);
        return { g, beams };
      });
      this.hzMeshes.push({ kind: 'laser', h: lz, items });
    }
    if (hz.cuckoo) {
      const clock = new THREE.Group();
      clock.position.set(0, 2.9, this.wz(0) + 0.6);
      clock.add(part(box(), mat(0x5a3418, { rough: 0.7 }), [0, 0.6, 0], [1.6, 1.8, 0.5]));
      clock.add(part(cone(4), mat(0x3a2010), [0, 1.8, 0], [1.3, 0.7, 0.5], [0, Math.PI / 4, 0]));
      clock.add(part(cyl(32), mat(0xf4ead0), [0, 0.7, 0.26], [0.55, 0.04, 0.55], [Math.PI / 2, 0, 0]));
      this.hand1 = part(box(), mat(0x111111), [0, 0.7, 0.3], [0.04, 0.42, 0.02]);
      this.hand2 = part(box(), mat(0x111111), [0, 0.7, 0.3], [0.05, 0.3, 0.02]);
      this.hand1.geometry = this.hand1.geometry.clone().translate(0, 0.5, 0);
      clock.add(this.hand1, this.hand2);
      this.cuckooDoor = part(box(), mat(0x3a2010), [0, 1.35, 0.27], [0.32, 0.32, 0.03]);
      clock.add(this.cuckooDoor);
      const pend = part(cyl(16), mat(0xd8a84a, { metal: 0.9, rough: 0.2 }), [0, -0.6, 0.1], [0.16, 0.03, 0.16], [Math.PI / 2, 0, 0]);
      this.pendulum = new THREE.Group(); this.pendulum.position.set(0, 0.2, 0.1);
      this.pendulum.add(part(box(), mat(0xd8a84a, { metal: 0.9 }), [0, -0.4, 0], [0.03, 0.8, 0.02]), pend);
      clock.add(this.pendulum);
      this.root.add(clock);
      this.bird = this.makeBird();
      this.root.add(this.bird);
      this.lane = part(new THREE.PlaneGeometry(this.L.W, 0.9), new THREE.MeshBasicMaterial({ map: stripeTex('#ff3a6a', '#2a0a1a'), transparent: true, opacity: 0.5, depthWrite: false }), [0, 0.015, 0], 1, [-Math.PI / 2, 0, 0]);
      this.lane.material.map = this.lane.material.map.clone(); this.lane.material.map.needsUpdate = true; this.lane.material.map.repeat.set(this.L.W, 1);
      this.root.add(this.lane);
    }
    // strike pool (cannonballs / embers / lightning), hole decals
    this.strikePool = [];
    this.holePool = [];
    this.monkeyPool = [];
  }

  makeBird() {
    const g = new THREE.Group();
    g.add(part(sph(16), mat(0x8a5a2a), [0, 0.5, 0], [0.4, 0.3, 0.3]));
    g.add(part(sph(16), mat(0x8a5a2a), [0.35, 0.72, 0], 0.2));
    g.add(part(cone(8), mat(0xffb020), [0.6, 0.72, 0], [0.07, 0.2, 0.07], [0, 0, -Math.PI / 2]));
    g.add(part(sph(8), mat(0x111111), [0.45, 0.8, 0.12], 0.04));
    g.add(part(sph(8), mat(0x111111), [0.45, 0.8, -0.12], 0.04));
    const w1 = part(box(), mat(0x6a3a1a), [0, 0.6, 0.32], [0.5, 0.04, 0.4]);
    const w2 = part(box(), mat(0x6a3a1a), [0, 0.6, -0.32], [0.5, 0.04, 0.4]);
    g.add(w1, w2);
    g.userData.wings = [w1, w2];
    g.add(part(box(), mat(0x6a3a1a), [-0.45, 0.55, 0], [0.35, 0.06, 0.25], [0, 0, 0.3]));
    g.scale.setScalar(1.3);
    g.visible = false;
    return g;
  }

  makeMonkey() {
    const g = new THREE.Group();
    const fur = mat(0x6a4224, { rough: 0.9 }), face = mat(0xe8c09a, { rough: 0.7 });
    g.add(part(sph(16), fur, [0, 0.32, 0], [0.22, 0.24, 0.2]));
    g.add(part(sph(16), fur, [0, 0.62, 0.02], 0.17));
    g.add(part(sph(12), face, [0, 0.6, 0.13], [0.12, 0.1, 0.06]));
    for (const s of [-1, 1]) {
      g.add(part(sph(10), fur, [s * 0.17, 0.66, 0], [0.06, 0.07, 0.03]));
      g.add(part(sph(8), mat(0x111111), [s * 0.05, 0.65, 0.17], 0.025));
      g.add(part(capsule(), fur, [s * 0.2, 0.32, 0.08], [0.07, 0.25, 0.07], [0.6, 0, s * 0.3]));
      g.add(part(sph(10), fur, [s * 0.1, 0.06, 0], [0.08, 0.06, 0.1]));
    }
    const tail = part(tor(), fur, [0, 0.3, -0.25], [0.15, 0.15, 0.2], [0, Math.PI / 2, 0]);
    g.add(tail);
    const vine = part(cyl(6), mat(0x3a7a2a), [0, 3, 0], [0.025, 5, 0.025]);
    g.add(vine);
    g.userData.vine = vine;
    g.userData.hold = new THREE.Group();
    g.userData.hold.position.set(0, 0.85, 0.05);
    g.add(g.userData.hold);
    this.root.add(g);
    return g;
  }

  // ------------------------------------------------------------- per-frame update

  update(sim, t, dt, camera, rt) {
    const L = this.L;
    const env = envAt(L, Math.max(0, t));
    this.backdrop.update(rt);
    const play = Math.max(0, t);
    this.updateRoll(env, rt);
    if (this.pods) { this.updatePods(env, rt, dt); this.updateTreehouse(rt); }
    this.parts.update(dt);
    this.emitAcc += dt;
    const emit = this.emitAcc >= 1 / 30;
    const edt = this.emitAcc;
    if (emit) this.emitAcc = 0;
    if (emit) this.ambient(edt, rt);
    // knife hits: one stroke per chef chop cycle (the chef animation uses the same clock)
    for (const p of sim.players) {
      if (p.act !== 'chop' || !p.target) { this.chopN.delete(p.id); continue; }
      const n = Math.floor(rt * 4.5);
      if (this.chopN.get(p.id) === n) continue;
      const first = !this.chopN.has(p.id);
      this.chopN.set(p.id, n);
      if (first) continue;
      const [x, y] = p.target, s = sim.st(x, y);
      if (!s.item || s.item.kind !== 'ing') continue;
      const I = INGREDIENTS[s.item.ing];
      this.squash.set(y * L.W + x, 1);
      const cx = this.cx(x), cz = this.cz(y);
      for (let k = 0; k < 6; k++) this.parts.chunk({ x: cx + (Math.random() - 0.5) * 0.15, y: CH + 0.12, z: cz + (Math.random() - 0.5) * 0.15, vx: (Math.random() - 0.5) * 2.2, vy: 1.4 + Math.random() * 1.6, vz: (Math.random() - 0.5) * 2.2, color: [I.c1, I.c2, I.c3][k % 3], s: 0.022 + Math.random() * 0.018, life: 0.7, floor: CH + 0.06 });
      this.parts.puff({ x: cx, y: CH + 0.1, z: cz, vy: 0.4, life: 0.35, s0: 0.12, s1: 0.4, a: 0.5, color: 0xffffff });
    }

    // items on tiles
    const seen = new Set();
    sim.ts.forEach((s, i) => {
      const it = s.item;
      const tl = L.tiles[i];
      if (it) {
        seen.add(i);
        const key = itemKey(it);
        let e = this.itemMeshes.get(i);
        if (!e || e.key !== key) {
          if (e) { e.mesh.removeFromParent(); if (e.pile) e.pile.removeFromParent(); }
          const mesh = makeItem(it);
          e = { key, mesh };
          this.itemMeshes.set(i, e);
          this.home(tl.x).add(mesh);
        }
        const base = tl.st === 'oven' ? 1.15 : tl.st === 'trash' ? 0.9 : CH + (ITEM_Y[tl.st] || 0);
        const bt = tl.belt != null ? Math.min(1, s.bt || 0) : 0;
        e.mesh.position.set(this.cx(tl.x), base, this.cz(tl.y));
        if (tl.st === 'pan' || tl.st === 'pot') e.mesh.position.y += Math.sin(rt * 9 + i) * 0.006;
        e.mesh.rotation.y = tl.st === 'board' ? 0.3 : 0;
        // chopping in progress: the whole ingredient shrinks while a pile of pieces grows beside it
        const sq = this.squash.get(i) || 0;
        if (sq > 0) this.squash.set(i, Math.max(0, sq - dt * 7));
        if (tl.st === 'board' && it.kind === 'ing' && it.s === 'raw' && it.p > 0) {
          if (!e.pile) { e.pile = makeItem({ kind: 'ing', ing: it.ing, s: 'chopped' }); this.home(tl.x).add(e.pile); }
          const k = Math.min(1, it.p);
          e.mesh.scale.set(1 - k * 0.45, (1 - k * 0.5) * (1 - sq * 0.35), 1 - k * 0.45);
          e.mesh.position.x -= 0.08;
          e.pile.visible = true;
          e.pile.scale.setScalar(0.25 + k * 0.75);
          e.pile.position.set(this.cx(tl.x) + 0.13, base, this.cz(tl.y) + 0.06);
        } else {
          e.mesh.scale.set(1, 1 - sq * 0.25, 1);
          if (e.pile) { e.pile.removeFromParent(); e.pile = null; }
        }
      }
      // progress bars
      let prog = null, warn = false, done = false;
      if (it && it.kind === 'ing') {
        if (tl.st === 'board' && it.s === 'raw' && it.p > 0) prog = it.p;
        if (emit) this.cookFx(tl, it, edt, rt);
        if (['pan', 'pot', 'oven'].includes(tl.st) && !it.dead) {
          const m = INGREDIENTS[it.ing].method, c = T.cook[m];
          if (it.s === 'chopped') prog = it.p / c;
          else if (it.s === 'cooked') { done = true; if (it.p > c * 1.15) warn = true; }
        }
      }
      if (tl.st === 'sink' && s.wp > 0) prog = s.wp;
      this.setBar(i, tl, prog, warn, done, rt, camera);
      // fire
      this.setFire(i, tl, s.fire, rt);
      // station visuals
      const P = this.stationParts.get(i);
      if (P) {
        const cooking = it && it.kind === 'ing' && !it.dead && it.s !== 'raw';
        if (P.ring) P.ring.material.emissiveIntensity = cooking ? 1.4 + Math.sin(rt * 6) * 0.3 : 0;
        if (P.door) P.door.material.emissiveIntensity = cooking ? 0.9 + Math.sin(rt * 4) * 0.2 : 0.05;
        if (P.knife) P.knife.visible = !(it && it.kind === 'ing' && it.s === 'raw' && sim.players.some((p) => p.act === 'chop' && p.target && p.target[0] === tl.x && p.target[1] === tl.y));
        if (tl.st === 'sink') this.setStack(i + 0.5, s.dirty, true, tl, 0.0, 0) || this.setStack(i + 0.25, s.clean, false, tl, 0.06, 0.52);
        if (tl.st === 'return') this.setStack(i + 0.5, s.dirty, true, tl, 0.02, 0);
        if (P.arm) P.arm.rotation.z = (sim.beltDir[tl.belt] || 1) * 0.6;
        if (P.beacon) { const on = s.dirty > 0 && Math.sin(rt * 9) > 0; P.beacon.material.emissiveIntensity = on ? 3 : 0.1; }
        if (P.strips) P.strips.forEach((st, k) => { st.rotation.x = Math.sin(rt * 2 + k) * 0.04 + (P.flap || 0) * Math.sin(rt * 20 + k) * 0.5; });
        if (P.flap) P.flap = Math.max(0, P.flap - dt * 1.5);
        if (P.pad) P.pad.material.emissiveIntensity = 0.3 + Math.sin(rt * 3) * 0.15 + (P.pulse || 0) * 2;
        if (P.bell) { P.bellT = Math.max(0, (P.bellT || 0) - dt); P.bell.position.y = 0.1 + Math.abs(Math.sin(P.bellT * 30)) * P.bellT * 0.15; }
        if (P.lamps) P.lamps.forEach((b, k) => { b.material.emissiveIntensity = 1.5 + Math.sin(rt * 5 + k * 2) * 0.1; });
        if (P.tickets) P.tickets.forEach((tk, k) => { tk.rotation.z = (k - 1) * 0.08 + Math.sin(rt * 1.7 + k) * 0.04; tk.visible = k < sim.orders.length; });
        if (tl.st === 'sink' && emit && sim.players.some((p) => p.act === 'wash' && p.target && p.target[0] === tl.x && p.target[1] === tl.y)) this.washFx(tl, edt);
      }
    });
    for (const [i, e] of this.itemMeshes) if (!seen.has(i) && Number.isInteger(i)) { e.mesh.removeFromParent(); if (e.pile) e.pile.removeFromParent(); this.itemMeshes.delete(i); }

    if (emit) for (const p of sim.players) if (p.act === 'spray') this.sprayFx(p, edt);
    // belts scroll
    for (const f of this.fx) {
      if (f.beltIdx != null) f.belt.offset.x -= dt * L.belts[f.beltIdx].speed * (sim.beltDir[f.beltIdx] || 1);
      else if (f.belt) f.belt.offset.x -= dt * 1.7;
    }
    // floes, bridges, shifting walls
    for (const { f, g } of this.floeMeshes) {
      const r = floeAt(f, play);
      g.position.set(this.wx(r.x), Math.sin(rt * 1.4 + f.phase * 6) * 0.03, this.wz(r.y));
      g.rotation.z = Math.sin(rt * 0.9 + f.phase * 4) * 0.02;
    }
    for (const { b, g } of this.bridgeMeshes) {
      const off = bridgeOff(b, play), wrn = bridgeWarn(b, play);
      const target = off ? -3 : 0;
      g.position.y += (target - g.position.y) * Math.min(1, dt * (off ? 2.5 : 6));
      g.position.x = wrn ? Math.sin(rt * 40) * 0.03 : 0;
      if (b.rope && !this.pods) {
        g.position.z = env.swayV * 0.06;
        g.rotation.x = env.swayV * 0.03;
      }
      g.visible = g.position.y > -2.8;
      if (b.rope && this.pods && g.visible) this.updateRopeBridge(g);
    }
    this.updateHoles(play, dt, rt, emit, edt);
    (this.moverMeshes || []).forEach((e, i) => {
      const mx = moverX(e.m, play);
      e.g.position.set(this.wx(mx) + 0.5, 0, this.cz(e.m.y));
      const blink = moverWarn(e.m, play) && Math.sin(rt * 12) > 0;
      e.lights.forEach((l) => { l.material.emissiveIntensity = blink ? 3 : 0.1; });
      const it = sim.mv[i] && sim.mv[i].item;
      const key = itemKey(it);
      if (e.key !== key) {
        if (e.hold) e.hold.removeFromParent();
        e.hold = it ? makeItem(it) : null;
        if (e.hold) this.home(e.m.x0).add(e.hold);
        e.key = key;
      }
      if (e.hold) e.hold.position.set(e.g.position.x, CH, e.g.position.z);
    });
    for (const { s, g, warn } of this.shiftMeshes) {
      const up = shiftUp(s, play), w = shiftWarn(s, play);
      const ty = up ? 0 : -1.25;
      g.position.y += (ty - g.position.y) * Math.min(1, dt * 7);
      warn.visible = w && !up;
      warn.children[0].material.opacity = 0.5 + Math.sin(rt * 14) * 0.4;
    }
    this.updateHazards(sim, play, dt, rt, env);
    if (emit) this.hazardFx(play, edt, rt);
  }

  /** Flame/lava particles for the volcano hazards (fire walls, magma geysers, falling embers). */
  hazardFx(t, dt, rt) {
    const P = this.parts;
    const chance = (perSec) => Math.random() < perSec * dt;
    const many = (perSec) => { const c = perSec * dt, k = Math.floor(c); return k + (Math.random() < c - k ? 1 : 0); };
    for (const h of this.hzMeshes) {
      if (h.kind === 'firewall') {
        const c = cycle(t, h.h.period, h.h.on, h.h.phase);
        for (const it of h.items) {
          const { x, z } = it.g.position;
          if (c.on) {
            for (let k = 0, n = many(90); k < n; k++) P.flame(x, 0.05, z, { s: 0.62, vy: 3, life: 0.6, spread: 0.75, hot: k === 0 });
            if (chance(6)) P.puff({ x, y: 0.9, z, vx: (Math.random() - 0.5), vy: 1.6, drag: 0.5, life: 1.4, s0: 0.3, s1: 0.9, a: 0.25, color: 0x2a2020 });
          } else if (c.warn) {
            // the crack spits sparks and small licks before it erupts
            if (chance(25)) P.puff({ x: x + (Math.random() - 0.5) * 0.6, y: 0.05, z, vx: (Math.random() - 0.5), vy: 1.5 + Math.random() * 2, g: 6, life: 0.5, s0: 0.07, s1: 0.03, a: 1, color: 0xffe080, color1: 0xff3000, glow: true });
            if (chance(8)) P.flame(x, 0.03, z, { s: 0.2, vy: 0.8, life: 0.3, spread: 0.6 });
          }
        }
      } else if (h.kind === 'geyser') {
        const c = cycle(t, h.h.period, 1.7, h.h.phase);
        const { x, z } = h.g.position;
        if (c.on) {
          for (let k = 0, n = many(150); k < n; k++) P.flame(x, 0.1, z, { s: 0.5, vy: 6.5, drag: 0.6, life: 0.55, spread: 0.25, hot: k < 2 });
          for (let k = 0, n = many(60); k < n; k++) { const a = Math.random() * Math.PI * 2; P.puff({ x, y: 1.6 + Math.random() * 0.8, z, vx: Math.cos(a) * 1.4, vy: 1 + Math.random() * 2, vz: Math.sin(a) * 1.4, g: 9, life: 1, s0: 0.14, s1: 0.06, a: 1, color: 0xffe080, color1: 0xff2000, glow: true, floor: 0.02, fadePow: 4 }); }
        } else if (c.warn) {
          // the vent bubbles and spits
          if (chance(14)) { const a = Math.random() * Math.PI * 2; P.puff({ x, y: 0.12, z, vx: Math.cos(a) * 0.6, vy: 1.5 + Math.random() * 1.5, vz: Math.sin(a) * 0.6, g: 9, life: 0.6, s0: 0.12, s1: 0.06, a: 1, color: 0xffd060, color1: 0xff2a00, glow: true, floor: 0.02 }); }
          if (chance(10)) P.flame(x, 0.1, z, { s: 0.25, vy: 1.2, life: 0.35, spread: 0.2 });
        }
      }
    }
    // falling embers leave a fiery trail
    for (const e of this.strikePool) {
      if (!e.g.visible || !e.ember.visible) continue;
      const x = e.g.position.x + e.ember.position.x, y = e.g.position.y + e.ember.position.y, z = e.g.position.z + e.ember.position.z;
      for (let k = 0, n = many(60); k < n; k++) P.flame(x, y + 0.1, z, { s: 0.35, vy: 0.6, life: 0.4, spread: 0.12, hot: k === 0 });
    }
  }


  /** Where a cannonball is: fired from one of the rival's gunports, ballistic arc onto its tile. */
  cannonFlight(s, target) {
    const T = 2.2, u = Math.max(0, Math.min(1, 1 - Math.max(0, -s.dt) / T));
    const rv = this.backdrop.rival;
    const start = new THREE.Vector3(-6, 0, -this.L.H / 2 - 14);
    if (rv && rv.muzzles.length) {
      const m = rv.muzzles[(s.x * 7 + s.y * 3) % rv.muzzles.length];
      rv.group.updateWorldMatrix(true, false);
      start.copy(m).applyMatrix4(rv.group.matrixWorld);
      this.root.worldToLocal(start);
    }
    const end = target.clone().setY(target.y + 0.2);
    const pos = start.clone().lerp(end, u);
    pos.y += start.distanceTo(end) * 0.32 * 4 * u * (1 - u);
    // muzzle flash + smoke the moment it leaves the gun
    const fk = 'f' + s.x + ',' + s.y + ',' + s.t;
    if (u < 0.08 && !this.struckFx.has(fk)) {
      this.struckFx.add(fk);
      const P = this.parts;
      P.puff({ x: start.x, y: start.y, z: start.z, life: 0.25, s0: 1.2, s1: 2.2, a: 1, color: 0xffc060, glow: true });
      for (let k = 0; k < 10; k++) P.puff({ x: start.x, y: start.y, z: start.z, vx: (end.x - start.x) * 0.05 + (Math.random() - 0.5) * 0.8, vy: 0.4 + Math.random() * 0.6, vz: (end.z - start.z) * 0.05 + (Math.random() - 0.5) * 0.8, drag: 0.8, life: 2.8, s0: 0.6, s1: 2.2, a: 0.6, color: 0xb8b8b8 });
      if (this.onCannon) this.onCannon();
    }
    return { pos, u };
  }

  // ------------------------------------------------------------- motion of the whole kitchen

  /** Pirate deck: visible roll that matches the gameplay push, plus heave/pitch from the swell. */
  updateRoll(env, rt) {
    const L = this.L;
    if (this.world.id !== 'pirate') { this.root.rotation.z = 0; return; }
    const oc = this.backdrop.ocean;
    const tiltK = L.hz.tilt ? env.tiltAngle / L.hz.tilt.amp : 0;
    const len = L.W / 2 + 2;
    const hb = oc ? oc.heightAt(len, 0, rt) : 0, hs = oc ? oc.heightAt(-len, 0, rt) : 0, hc = oc ? oc.heightAt(0, 0, rt) : 0;
    // push is towards +x when tiltK > 0, so the +x side must dip (negative z rotation)
    const roll = -tiltK * (0.075 + L.diff * 0.006) + (oc ? (oc.heightAt(0, -3, rt) - oc.heightAt(0, 3, rt)) * 0.03 : 0);
    const pitch = Math.atan2(hb - hs, len * 2) * 0.35;
    const e = new THREE.Euler(0, 0, roll + pitch);
    const pivot = new THREE.Vector3(0, WATERLINE, 0);
    const v = pivot.clone().applyEuler(e);
    this.root.rotation.copy(e);
    this.root.position.set(pivot.x - v.x, pivot.y - v.y + hc * 0.45, pivot.z - v.z);
  }

  // ------------------------------------------------------------- particles

  /** Ambient per-world atmosphere. */
  ambient(dt, rt) {
    const L = this.L, P = this.parts, id = this.world.id;
    const rx = () => (Math.random() - 0.5) * (L.W + 6), rz = () => (Math.random() - 0.5) * (L.H + 5);
    const chance = (perSec) => Math.random() < perSec * dt;
    switch (id) {
      case 'pirate':
        if (chance(10)) { const side = Math.random() < 0.5 ? -1 : 1; P.puff({ x: rx(), y: WATERLINE + 0.3, z: side * (L.H / 2 + 1.2), vy: 1.2 + Math.random(), vz: side * 0.4, g: 2, life: 1.2, s0: 0.25, s1: 0.8, a: 0.35, color: 0xffffff }); }
        break;
      case 'glacier':
        for (let k = 0; k < 3; k++) if (chance(14)) P.puff({ x: rx(), y: 6, z: rz(), vx: 0.3, vy: -0.9, life: 7, s0: 0.07, s1: 0.06, a: 0.9, color: 0xffffff, fadeIn: 0.5, fadePow: 6 });
        break;
      case 'volcano': {
        // embers drifting up past the kitchen
        for (let k = 0; k < 2; k++) if (chance(12)) P.puff({ x: rx(), y: -1.2, z: rz(), vx: (Math.random() - 0.5) * 0.4, vy: 1 + Math.random() * 1.2, life: 3.5, s0: 0.07, s1: 0.02, a: 1, color: 0xffd060, color1: 0xff3000, glow: true, fadeIn: 0.3 });
        // a spot on the lava around the island (never under it)
        const lavaSpot = (reach) => {
          for (let k = 0; k < 8; k++) {
            const x = (Math.random() - 0.5) * (L.W + reach * 2), z = (Math.random() - 0.5) * (L.H + reach * 2);
            if (Math.abs(x) > L.W / 2 + 0.9 || Math.abs(z) > L.H / 2 + 0.9) return [x, z];
          }
          return [L.W / 2 + 1.5, 0];
        };
        // lava bubbles: swell, burst, throw flaming blobs
        if (chance(7)) {
          const [x, z] = lavaSpot(4);
          P.puff({ x, y: -1.7, z, life: 0.45, s0: 0.25, s1: 1.1, a: 0.9, color: 0xffc040, color1: 0xff3a00, glow: true, ring: true });
          const n = 6 + (Math.random() * 8 | 0);
          for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, v = 0.6 + Math.random() * 1.6; P.puff({ x, y: -1.65, z, vx: Math.cos(a) * v, vy: 2.5 + Math.random() * 3.5, vz: Math.sin(a) * v, g: 9, life: 0.9 + Math.random() * 0.5, s0: 0.24, s1: 0.1, a: 1, color: 0xffe080, color1: 0xff2000, glow: true, floor: -1.8, fadePow: 4 }); }
          for (let k = 0; k < 4; k++) P.flame(x, -1.7, z, { s: 0.45, vy: 1.8, life: 0.5, spread: 0.3, hot: !k });
          P.puff({ x, y: -1.4, z, vy: 0.7, drag: 0.4, life: 2.2, s0: 0.4, s1: 1.4, a: 0.3, color: 0x3a2a26 });
        }
        // now and then a big eruption fountain right beside the island
        if (chance(0.6)) {
          const [x, z] = lavaSpot(2.5);
          for (let k = 0; k < 40; k++) { const a = Math.random() * Math.PI * 2, v = Math.random() * 1.8; P.puff({ x, y: -1.6, z, vx: Math.cos(a) * v, vy: 5 + Math.random() * 4.5, vz: Math.sin(a) * v, g: 9, life: 1.6 + Math.random() * 0.6, s0: 0.2, s1: 0.08, a: 1, color: 0xfff0a0, color1: 0xff2a00, glow: true, floor: -1.8, fadePow: 4 }); }
          for (let k = 0; k < 14; k++) P.flame(x, -1.6, z, { s: 0.7, vy: 4, life: 0.8, spread: 0.6, hot: true });
          for (let k = 0; k < 6; k++) P.puff({ x, y: -1, z, vx: (Math.random() - 0.5), vy: 1.2 + Math.random(), drag: 0.4, life: 3, s0: 0.6, s1: 2.2, a: 0.3, color: 0x2a2020 });
        }
        // heat haze smoke off the lava
        if (chance(3)) { const [x, z] = lavaSpot(7); P.puff({ x, y: -1.5, z, vx: 0.15, vy: 0.6 + Math.random() * 0.4, drag: 0.2, life: 4, s0: 0.8, s1: 3, a: 0.16, color: 0x4a3430, fadeIn: 1 }); }
        const fx = this.backdrop.fx;
        if (fx) {
          for (const [x, y, z] of fx.falls) if (chance(14)) P.puff({ x: x + (Math.random() - 0.5) * 1.2, y, z, vx: (Math.random() - 0.5) * 1.5, vy: 1.5 + Math.random() * 2.5, vz: 0.5 + Math.random(), g: 9, life: 0.8, s0: 0.14, s1: 0.06, a: 1, color: 0xffd060, color1: 0xff2a00, glow: true, floor: -1.8 });
          for (const [x, y, z, vr] of fx.vents) {
            if (chance(2.5)) P.puff({ x: x + (Math.random() - 0.5) * vr * 0.3, y, z, vx: 0.4, vy: 1.4, drag: 0.1, life: 7, s0: vr * 0.3, s1: vr * 0.9, a: 0.35, color: 0x2a2224, fadeIn: 1 });
            if (chance(5)) P.puff({ x, y, z, vx: (Math.random() - 0.5) * 3, vy: 4 + Math.random() * 4, vz: (Math.random() - 0.5) * 3, g: 6, life: 1.8, s0: 0.5, s1: 0.2, a: 1, color: 0xffd060, color1: 0xff2a00, glow: true });
          }
        }
        break;
      }
      case 'space':
        if (chance(8)) P.puff({ x: rx(), y: Math.random() * 4, z: rz(), vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2, life: 4, s0: 0.05, s1: 0.05, a: 0.9, color: 0x8ae8ff, glow: true, fadeIn: 1, fadePow: 4 });
        break;
      case 'clouds':
        if (chance(3)) P.puff({ x: -L.W / 2 - 4, y: -0.6 + Math.random() * 2.5, z: rz(), vx: 1.2 + Math.random(), life: 9, s0: 1.4, s1: 2.4, a: 0.35, color: 0xffffff, fadeIn: 1.5 });
        break;
      case 'jungle':
        if (chance(6)) P.puff({ x: rx(), y: 0.4 + Math.random() * 2.5, z: rz(), vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.3, drag: 0.2, life: 3, s0: 0.06, s1: 0.06, a: 1, color: 0xd8ff6a, glow: true, fadeIn: 0.6, fadePow: 3 });
        if (chance(1.5)) P.chunk({ x: rx(), y: 6, z: rz(), vx: 0.6, vy: 0, color: 0x4ab04a, s: 0.07, sy: 0.15, life: 3.5, floor: 0 });
        break;
      case 'factory': {
        const fx = this.backdrop.fx;
        if (!fx) break;
        const w = this.tmpV || (this.tmpV = new THREE.Vector3());
        // welding sparks spraying off the robot torches
        for (const sp of fx.sparks) if (sp.on()) {
          sp.obj.getWorldPosition(w); this.root.worldToLocal(w);
          for (let k = 0; k < 4; k++) { const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 2.5; P.puff({ x: w.x, y: w.y, z: w.z, vx: Math.cos(a) * v, vy: 0.5 + Math.random() * 2.5, vz: Math.sin(a) * v, g: 9, drag: 0.3, life: 0.5 + Math.random() * 0.4, s0: 0.06, s1: 0.02, a: 1, color: 0xfff6c0, color1: 0xff8a20, glow: true }); }
          if (chance(4)) P.puff({ x: w.x, y: w.y, z: w.z, vy: 0.6, drag: 0.5, life: 1.5, s0: 0.15, s1: 0.6, a: 0.25, color: 0xc8d0d8 });
        }
        for (const st of fx.steam) {
          const [x, y, z] = [st.at.x, st.at.y, st.at.z];
          if (st.burst && st.burst()) for (let k = 0; k < 4; k++) { const a = Math.random() * Math.PI * 2; P.puff({ x, y, z, vx: Math.cos(a) * 2.5, vy: 0.6 + Math.random(), vz: Math.sin(a) * 1.5 + 1, drag: 1.5, life: 1.6, s0: 0.4, s1: 1.8, a: 0.45, color: 0xeef2f6 }); }
          if (st.jet && chance(10)) P.puff({ x, y, z, vx: (Math.random() - 0.5) * 0.3, vy: 0.4, vz: 2.2, drag: 1.2, life: 1.3, s0: 0.12, s1: 0.9, a: 0.35, color: 0xeef2f6 });
          if (st.drift && chance(2)) P.puff({ x, y, z, vx: 0.3, vy: 0.9, drag: 0.2, life: 5, s0: 0.5, s1: 2, a: 0.25, color: 0xd8dde2, fadeIn: 0.5 });
        }
        // dust motes drifting in the lamp light
        for (const [x, y, z] of fx.dust) if (chance(3)) P.puff({ x: x + (Math.random() - 0.5) * 2.5, y: y + (Math.random() - 0.5) * 4, z: z + (Math.random() - 0.5) * 2.5, vx: (Math.random() - 0.5) * 0.1, vy: -0.05, life: 4, s0: 0.035, s1: 0.035, a: 0.8, color: 0xfff2d0, glow: true, fadeIn: 1, fadePow: 3 });
        break;
      }
      case 'library':
        if (chance(10)) P.puff({ x: rx(), y: Math.random() * 3, z: rz(), vy: 0.25, vx: Math.sin(rt + Math.random()) * 0.2, life: 4, s0: 0.05, s1: 0.03, a: 1, color: Math.random() < 0.5 ? 0xffd27a : 0xc89aff, glow: true, fadeIn: 0.8 });
        break;
    }
  }

  cookFx(tl, it, dt, rt) {
    const P = this.parts, x = this.cx(tl.x), z = this.cz(tl.y);
    const chance = (n) => Math.random() < n * dt;
    if (it.dead) return;
    const burnt = it.s === 'burnt', cooking = it.s === 'chopped' || it.s === 'cooked';
    if (tl.st === 'pot' && (cooking || burnt)) {
      if (chance(burnt ? 14 : 9)) P.puff({ x: x + (Math.random() - 0.5) * 0.3, y: CH + 0.45, z: z + (Math.random() - 0.5) * 0.3, vy: 0.9, vx: 0.1, drag: 0.6, life: 1.6, s0: 0.15, s1: 0.65, a: burnt ? 0.55 : 0.32, color: burnt ? 0x2a2a2a : 0xffffff, fadeIn: 0.2 });
      if (cooking && chance(10)) P.puff({ x: x + (Math.random() - 0.5) * 0.35, y: CH + 0.37, z: z + (Math.random() - 0.5) * 0.35, vy: 0.15, life: 0.35, s0: 0.03, s1: 0.07, a: 0.9, color: 0xe8f6ff, ring: true });
    } else if (tl.st === 'pan' && (cooking || burnt)) {
      if (chance(burnt ? 12 : 5)) P.puff({ x: x + (Math.random() - 0.5) * 0.3, y: CH + 0.25, z: z + (Math.random() - 0.5) * 0.3, vy: 0.8, drag: 0.6, life: 1.3, s0: 0.12, s1: 0.5, a: burnt ? 0.55 : 0.22, color: burnt ? 0x2a2a2a : 0xf4f0ea });
      if (cooking && chance(14)) P.puff({ x: x + (Math.random() - 0.5) * 0.4, y: CH + 0.2, z: z + (Math.random() - 0.5) * 0.4, vx: (Math.random() - 0.5) * 1.2, vy: 1 + Math.random(), vz: (Math.random() - 0.5) * 1.2, g: 6, life: 0.4, s0: 0.035, s1: 0.015, a: 1, color: 0xffd060, glow: true });
    } else if (tl.st === 'oven' && (cooking || burnt)) {
      if (chance(burnt ? 10 : 3)) P.puff({ x: x + 0.3, y: 1.95, z: z - 0.3, vy: 1, drag: 0.4, life: 2, s0: 0.15, s1: 0.7, a: burnt ? 0.6 : 0.25, color: burnt ? 0x222222 : 0xdddddd });
    }
  }

  washFx(tl, dt) {
    const x = this.cx(tl.x), z = this.cz(tl.y);
    for (let k = 0; k < 2; k++) this.parts.puff({ x: x + (Math.random() - 0.5) * 0.45, y: CH + 0.02, z: z + (Math.random() - 0.5) * 0.35, vx: (Math.random() - 0.5) * 0.3, vy: 0.4 + Math.random() * 0.5, drag: 1.5, life: 1.1, s0: 0.04, s1: 0.1, a: 0.85, color: 0xeaf8ff, ring: true });
    if (Math.random() < 0.5) this.parts.puff({ x: x + (Math.random() - 0.5) * 0.3, y: CH + 0.1, z, vx: (Math.random() - 0.5) * 1.5, vy: 1.6, vz: (Math.random() - 0.5) * 1.5, g: 8, life: 0.5, s0: 0.03, s1: 0.03, a: 0.9, color: 0x9ad8ff });
  }

  sprayFx(p) {
    const x = this.wx(p.x) + p.fx * 0.45, z = this.wz(p.y) + p.fy * 0.45;
    for (let k = 0; k < 4; k++) {
      const sp = 4 + Math.random() * 2, j = (Math.random() - 0.5) * 0.5;
      this.parts.puff({ x, y: 0.62, z, vx: (p.fx + j * p.fy) * sp, vy: 0.4 + Math.random() * 0.4, vz: (p.fy - j * p.fx) * sp, drag: 2.6, g: 1.5, life: 0.9, s0: 0.1, s1: 0.55, a: 0.8, color: 0xffffff, floor: 0.08 });
    }
  }

  /** Bursts for game events (called by the game). */
  fxEvent(e) {
    const P = this.parts;
    if (e.x == null) return;
    const x = this.cx(e.x), z = this.cz(e.y);
    const tl = tileAt(this.L, e.x, e.y);
    const top = tl && tl.st === 'oven' ? 1.15 : CH;
    const parts = this.stationParts.get(e.y * this.L.W + e.x);
    switch (e.type) {
      case 'deliver':
        for (let k = 0; k < 26; k++) { const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 2; P.puff({ x, y: top + 0.3, z, vx: Math.cos(a) * v, vy: 1.5 + Math.random() * 2.5, vz: Math.sin(a) * v, g: 5, drag: 1, life: 1, s0: 0.08, s1: 0.03, a: 1, color: [0xffd23a, 0xff6a3a, 0x6ad8ff, 0x7aff8a][k % 4], glow: true }); }
        for (let k = 0; k < 14; k++) P.chunk({ x, y: top + 0.4, z, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 2.5, vz: (Math.random() - 0.5) * 3, color: [0xffd23a, 0xff5a8a, 0x5ad1ff, 0x8aff6a][k % 4], s: 0.03, sx: 1.6, sy: 0.2, life: 1.4, floor: top });
        if (parts) { parts.bellT = 0.5; parts.pulse = 1; setTimeout(() => { parts.pulse = 0; }, 400); }
        break;
      case 'chopped':
        for (let k = 0; k < 10; k++) P.puff({ x, y: top + 0.2, z, vx: (Math.random() - 0.5) * 1.5, vy: 1 + Math.random(), vz: (Math.random() - 0.5) * 1.5, g: 3, life: 0.6, s0: 0.06, s1: 0.02, a: 1, color: 0xfff2a0, glow: true });
        break;
      case 'washed':
        for (let k = 0; k < 8; k++) P.puff({ x: x + (Math.random() - 0.5) * 0.4, y: top + 0.15, z: z + (Math.random() - 0.5) * 0.4, vy: 0.6, life: 0.7, s0: 0.07, s1: 0.03, a: 1, color: 0xffffff, glow: true });
        break;
      case 'cooked':
        for (let k = 0; k < 8; k++) P.puff({ x, y: top + 0.4, z, vx: (Math.random() - 0.5), vy: 1.4, vz: (Math.random() - 0.5), g: 2, life: 0.7, s0: 0.07, s1: 0.03, a: 1, color: 0x9aff7a, glow: true });
        break;
      case 'extinguished':
        for (let k = 0; k < 12; k++) P.puff({ x: x + (Math.random() - 0.5) * 0.5, y: top + 0.2, z: z + (Math.random() - 0.5) * 0.5, vy: 1 + Math.random(), drag: 0.8, life: 1.6, s0: 0.2, s1: 0.8, a: 0.5, color: 0xdddddd });
        break;
      case 'drop': case 'grab':
        for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; P.puff({ x: x + Math.cos(a) * 0.15, y: top + 0.05, z: z + Math.sin(a) * 0.15, vx: Math.cos(a) * 0.6, vz: Math.sin(a) * 0.6, drag: 3, life: 0.35, s0: 0.06, s1: 0.16, a: 0.35, color: 0xffffff }); }
        break;
      case 'dirty':
        if (parts && parts.strips) parts.flap = 1;
        break;
      case 'fire':
        for (let k = 0; k < 16; k++) P.puff({ x, y: top + 0.2, z, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 2, vz: (Math.random() - 0.5) * 2, g: 3, life: 0.9, s0: 0.07, s1: 0.02, a: 1, color: 0xffa030, glow: true });
        break;
    }
  }

  /** Impact burst for a strike landing on tile x,y. */
  impact(kind, tx, ty) {
    const P = this.parts, x = this.cx(tx), z = this.cz(ty);
    const tl = tileAt(this.L, tx, ty);
    const y0 = tl && tl.k === 'counter' ? CH : 0;
    if (kind === 'cannon') {
      for (let k = 0; k < 22; k++) P.chunk({ x: x + (Math.random() - 0.5) * 0.4, y: y0 + 0.1, z: z + (Math.random() - 0.5) * 0.4, vx: (Math.random() - 0.5) * 5, vy: 3 + Math.random() * 4, vz: (Math.random() - 0.5) * 5, color: [0x8a5a30, 0xb48a5c, 0x5a3a1a][k % 3], s: 0.04 + Math.random() * 0.03, sx: 3, sy: 0.6, life: 1.6, floor: 0 });
      for (let k = 0; k < 12; k++) P.puff({ x: x + (Math.random() - 0.5) * 0.6, y: y0 + 0.3, z: z + (Math.random() - 0.5) * 0.6, vx: (Math.random() - 0.5) * 1.5, vy: 0.8 + Math.random(), vz: (Math.random() - 0.5) * 1.5, drag: 1.2, life: 1.6, s0: 0.3, s1: 1.1, a: 0.6, color: 0x6a6a6a });
      for (let k = 0; k < 10; k++) P.puff({ x, y: y0 + 0.3, z, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5) * 3, g: 3, life: 0.5, s0: 0.15, s1: 0.05, a: 1, color: 0xffb040, glow: true });
    } else if (kind === 'embers') {
      for (let k = 0; k < 18; k++) P.puff({ x, y: y0 + 0.15, z, vx: (Math.random() - 0.5) * 3, vy: 1.5 + Math.random() * 2.5, vz: (Math.random() - 0.5) * 3, g: 6, life: 0.8, s0: 0.08, s1: 0.02, a: 1, color: Math.random() < 0.5 ? 0xff6a10 : 0xffc040, glow: true });
      for (let k = 0; k < 5; k++) P.puff({ x, y: y0 + 0.2, z, vy: 0.8, drag: 0.5, life: 1.4, s0: 0.2, s1: 0.7, a: 0.4, color: 0x3a3030 });
    } else if (kind === 'lightning') {
      for (let k = 0; k < 24; k++) { const a = Math.random() * Math.PI * 2; P.puff({ x, y: y0 + 0.1, z, vx: Math.cos(a) * 4, vy: Math.random() * 3, vz: Math.sin(a) * 4, g: 4, drag: 2, life: 0.5, s0: 0.07, s1: 0.02, a: 1, color: 0xbfe8ff, glow: true }); }
      P.puff({ x, y: y0 + 0.3, z, life: 0.3, s0: 1.5, s1: 3, a: 0.8, color: 0xbfe8ff, glow: true });
    }
  }

  // ------------------------------------------------------------- cannonball holes + flooding

  updateHoles(t, dt, rt, emit, edt) {
    const L = this.L;
    if (!L.hz.cannon) return;
    if (!this.holes) this.holes = new Map();
    const active = new Set();
    for (const s of L.hz.cannon) {
      if (!(t >= s.t && t < s.t + HOLE_TIME)) continue;
      const i = s.y * L.W + s.x;
      active.add(i);
      let h = this.holes.get(i);
      if (!h) { h = this.makeHole(s.x, s.y); this.holes.set(i, h); this.setSlab(i, false); }
      const age = t - s.t, left = s.t + HOLE_TIME - t;
      const cx = this.cx(s.x), cz = this.cz(s.y);
      // water surges up through the hole, then sloshes just under deck level
      const surge = Math.min(1, age / 0.9);
      h.water.position.y = -1.1 + surge * 0.98 + Math.sin(rt * 5) * 0.03;
      h.water.material.opacity = 0.9;
      h.foam.position.y = h.water.position.y + 0.005;
      h.foam.rotation.z = rt * 0.6;
      // flood puddle spreads across the deck around the hole
      const spread = Math.min(1, age / 2.2) * Math.min(1, left / 1.2);
      h.puddle.scale.setScalar(0.3 + spread * 1.25);
      h.puddle.material.opacity = 0.55 * spread;
      // patching: planks slide back over the hole in the last second
      const patch = Math.max(0, 1 - left / 1.1);
      h.patch.forEach((pl, k) => { pl.visible = patch > k * 0.25; pl.scale.x = Math.min(1, (patch - k * 0.25) * 3); });
      if (emit) {
        const gush = age < 2.5 ? 1 : 0.25;
        for (let k = 0; k < Math.ceil(5 * gush); k++) this.parts.puff({ x: cx + (Math.random() - 0.5) * 0.4, y: h.water.position.y + 0.05, z: cz + (Math.random() - 0.5) * 0.4, vx: (Math.random() - 0.5) * 1.6, vy: (1.5 + Math.random() * 3) * gush, vz: (Math.random() - 0.5) * 1.6, g: 9, drag: 0.4, life: 0.8, s0: 0.12, s1: 0.22, a: 0.75, color: Math.random() < 0.5 ? 0xffffff : 0x8ad0ee, floor: 0.02 });
        if (Math.random() < 0.6) { const a = Math.random() * Math.PI * 2, r = 0.4 + Math.random() * spread * 0.9; this.parts.puff({ x: cx + Math.cos(a) * r, y: 0.03, z: cz + Math.sin(a) * r, life: 0.8, s0: 0.05, s1: 0.2, a: 0.6, color: 0xeaf8ff, ring: true }); }
      }
    }
    for (const [i, h] of this.holes) if (!active.has(i)) { this.root.remove(h.g); this.holes.delete(i); this.setSlab(i, true); }
  }

  setSlab(i, on) {
    const k = this.slabIdx.get(i);
    if (k == null) return;
    const tl = this.L.tiles[i];
    const o = new THREE.Object3D();
    o.position.set(this.cx(tl.x), -0.15, this.cz(tl.y)); o.scale.set(1, 0.3, 1);
    if (!on) o.scale.set(0.0001, 0.0001, 0.0001);
    o.updateMatrix(); this.slabTop.setMatrixAt(k, o.matrix); this.slabTop.instanceMatrix.needsUpdate = true;
    o.position.y = -0.55; o.scale.set(on ? 0.98 : 0.0001, on ? 0.5 : 0.0001, on ? 0.98 : 0.0001);
    o.updateMatrix(); this.slabBot.setMatrixAt(k, o.matrix); this.slabBot.instanceMatrix.needsUpdate = true;
  }

  makeHole(tx, ty) {
    const g = new THREE.Group();
    g.position.set(this.cx(tx), 0, this.cz(ty));
    const wood = mat(0x8a5a30, { rough: 0.8 }), dark = mat(0x3a2412, { rough: 0.9 });
    // splintered plank stubs around the rim of the hole (pointing inwards / upwards)
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + Math.random() * 0.3;
      const len = 0.12 + Math.random() * 0.14;
      const sp = part(cone(4), k % 3 ? wood : dark, [Math.cos(a) * (0.44 - len * 0.3), -0.04, Math.sin(a) * (0.44 - len * 0.3)], [0.05, len, 0.02], [0, 0, 0]);
      sp.lookAt(new THREE.Vector3(0, 0.6, 0).add(g.position).sub(g.position));
      sp.rotation.set(Math.sin(a) * (1.2 + Math.random() * 0.4), 0, -Math.cos(a) * (1.2 + Math.random() * 0.4));
      g.add(sp);
    }
    // ragged rim + side walls of the broken deck
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.48, 0.3, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x4a2c14, roughness: 0.9, side: THREE.BackSide }));
    rim.position.y = -0.15;
    g.add(rim);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.47, 24), new THREE.MeshStandardMaterial({ color: 0x1a6a8a, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.9 }));
    water.rotation.x = -Math.PI / 2;
    g.add(water);
    const foam = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.46, 24), new THREE.MeshBasicMaterial({ map: foamTex(), transparent: true, opacity: 0.85, depthWrite: false }));
    foam.rotation.x = -Math.PI / 2;
    g.add(foam);
    const pm = new THREE.MeshStandardMaterial({ color: 0x6ab8d8, map: puddleTex().clone(), transparent: true, opacity: 0, roughness: 0.04, metalness: 0.25, depthWrite: false });
    pm.map.needsUpdate = true;
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 32), pm);
    puddle.rotation.x = -Math.PI / 2; puddle.position.y = 0.008; puddle.renderOrder = 2;
    puddle.receiveShadow = true;
    g.add(puddle);
    const patch = [];
    for (let k = 0; k < 4; k++) { const pl = part(box(), mat(0xc8986a, { rough: 0.7 }), [0, 0.01, -0.36 + k * 0.24], [0.98, 0.04, 0.22]); pl.visible = false; g.add(pl); patch.push(pl); }
    this.root.add(g);
    return { g, water, foam, puddle, patch };
  }

  setStack(key, n, dirty, tl, y, off) {
    let e = this.itemMeshes.get(key);
    const k = n ? `${n}${dirty}` : '';
    if (!e || e.key !== k) {
      if (e) e.mesh.removeFromParent();
      this.itemMeshes.delete(key);
      if (!n) return false;
      const mesh = makeItem({ kind: 'plate', n, dirty, c: [] });
      e = { key: k, mesh };
      this.itemMeshes.set(key, e);
      this.home(tl.x).add(mesh);
    }
    const [dx, dy] = this.faceDir(tl);
    // sideways offset (clean rack sits to the right of the basin)
    e.mesh.position.set(this.cx(tl.x) + dy * off, CH + y, this.cz(tl.y) - dx * off);
    return false;
  }

  setBar(i, tl, prog, warn, done, rt, camera) {
    let b = this.bars.get(i);
    if (prog == null && !warn && !done) { if (b) b.g.visible = false; return; }
    if (!b) {
      // all parts opaque + depthTest off + explicit renderOrder, so the fill always draws over the frame
      const g = new THREE.Group();
      const ui = (geo, color, order, map) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, map, depthTest: false, depthWrite: false, toneMapped: false })); m.renderOrder = order; return m; };
      const frame = ui(roundRect(0.86, 0.2, 0.1), 0xffffff, 20);
      const bg = ui(roundRect(0.8, 0.14, 0.07), 0x1a1a26, 21);
      const fill = ui(new THREE.PlaneGeometry(0.76, 0.1).translate(0.38, 0, 0), 0x5ad15a, 22);
      fill.position.x = -0.38;
      const shine = ui(new THREE.PlaneGeometry(0.76, 0.03).translate(0.38, 0.025, 0), 0xffffff, 23);
      shine.material.transparent = true; shine.material.opacity = 0.35; shine.position.x = -0.38;
      const icon = ui(new THREE.CircleGeometry(0.17, 28), 0xffffff, 24, textTex('✔', { w: 64, h: 64, bg: '#2fbf5a', font: '900 44px sans-serif' }));
      const warnI = ui(new THREE.CircleGeometry(0.19, 28), 0xffffff, 24, textTex('!', { w: 64, h: 64, bg: '#ff3a3a', font: '900 48px Fredoka, sans-serif' }));
      g.add(frame, bg, fill, shine, icon, warnI);
      this.home(tl.x).add(g);
      b = { g, frame, bg, fill, shine, icon, warnI };
      this.bars.set(i, b);
    }
    b.g.visible = true;
    b.g.position.set(this.cx(tl.x), (tl.st === 'oven' ? 1.85 : 1.65), this.cz(tl.y));
    // face the camera even while the deck rolls
    b.g.quaternion.copy(b.g.parent.getWorldQuaternion(this.tmpQ).invert()).multiply(camera.quaternion);
    const showBar = prog != null;
    b.frame.visible = b.bg.visible = b.fill.visible = b.shine.visible = showBar;
    if (showBar) {
      const k = Math.max(0.001, Math.min(1, prog));
      b.fill.scale.x = k; b.shine.scale.x = k;
      b.fill.material.color.setHex(tl.st === 'sink' ? 0x4ab8ff : tl.st === 'board' ? 0xffc21a : 0x4ad15a);
      b.g.scale.setScalar(1 + (tl.st === 'board' ? Math.max(0, (this.squash.get(i) || 0)) * 0.08 : 0));
    } else b.g.scale.setScalar(1);
    b.icon.visible = done && !warn;
    b.warnI.visible = warn;
    if (warn) b.warnI.scale.setScalar(1 + Math.abs(Math.sin(rt * 10)) * 0.3);
  }

  setFire(i, tl, fire, rt) {
    let f = this.fires.get(i);
    if (!fire) { if (f) { f.g.removeFromParent(); this.fires.delete(i); } return; }
    if (!f) {
      const g = new THREE.Group();
      const flames = [];
      for (let k = 0; k < 6; k++) {
        const m = part(cone(7), mat(k % 2 ? 0xff6a10 : 0xffc020, { emissive: k % 2 ? 0xff4000 : 0xffa000, ei: 2.4, opacity: 0.92 }), [Math.cos(k * 1.1) * 0.22, 0.3, Math.sin(k * 1.1) * 0.22], [0.15, 0.6, 0.15]);
        m.castShadow = false;
        g.add(m); flames.push(m);
      }
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff7a20, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(1.8); glow.position.y = 0.4;
      g.add(glow);
      const smoke = [];
      for (let k = 0; k < 4; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x333333, transparent: true, opacity: 0.4, depthWrite: false })); g.add(s); smoke.push(s); }
      this.home(tl.x).add(g);
      f = { g, flames, smoke };
      this.fires.set(i, f);
    }
    f.g.position.set(this.cx(tl.x), tl.st === 'oven' ? 1.12 : CH, this.cz(tl.y));
    const k = Math.min(1.3, 0.5 + fire * 0.5);
    f.flames.forEach((m, j) => { const s = k * (0.8 + 0.35 * Math.sin(rt * 13 + j * 2.1)); m.scale.set(0.15 * k, 0.6 * s, 0.15 * k); m.position.y = 0.3 * s; });
    f.smoke.forEach((s, j) => { const p = (rt * 0.6 + j / 4) % 1; s.position.set(Math.sin(j * 2 + rt) * 0.2, 0.6 + p * 1.6, Math.cos(j * 2) * 0.2); s.scale.setScalar(0.4 + p * 0.9); s.material.opacity = 0.45 * (1 - p); });
  }

  updateHazards(sim, t, dt, rt, env) {
    const L = this.L;
    for (const h of this.hzMeshes) {
      if (h.kind === 'firewall' || h.kind === 'laser') {
        const c = cycle(t, h.h.period, h.h.on, h.h.phase);
        for (const it of h.items) {
          if (h.kind === 'firewall') {
            it.fl.visible = c.on;
            if (c.on) it.fl.children.forEach((m, j) => { m.scale.set(0.1, 0.55 * (0.8 + 0.3 * Math.sin(rt * 15 + j)), 0.1); m.position.y = 0.3; });
            it.crack.material.emissiveIntensity = c.warn ? 1 + Math.sin(rt * 20) : c.on ? 2 : 0.4;
          } else {
            it.beams.visible = c.on || (c.warn && Math.sin(rt * 30) > 0);
            it.beams.userData.on = c.on;
          }
        }
      } else if (h.kind === 'geyser') {
        const c = cycle(t, h.h.period, 1.7, h.h.phase);
        h.col.visible = c.on;
        if (c.on) { h.col.scale.set(0.16, 2.2 * Math.min(1, c.k * 5), 0.16); h.col.position.y = h.col.scale.y / 2; }
        { const k = c.warn ? 1 + Math.sin(rt * 20) * 0.2 : 1; h.g.children[1].scale.set(0.28 * k, 0.02, 0.28 * k); }
      }
    }
    // strikes: falling projectile + warning decal
    const strikes = strikesNear(L, t, 2.2, 0.4);
    let si = 0;
    for (const s of strikes) {
      let e = this.strikePool[si++];
      if (!e) {
        const g = new THREE.Group();
        const decal = part(new THREE.RingGeometry(0.25, 0.45, 28), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }), [0, 0.02, 0], 1, [-Math.PI / 2, 0, 0]);
        decal.castShadow = false;
        const ball = part(sph(16), mat(0x1a1a1a, { metal: 0.6, rough: 0.3 }), [0, 0, 0], 0.22);
        const ember = part(dode(), mat(0xff5a10, { emissive: 0xff3a00, ei: 2 }), [0, 0, 0], 0.18);
        const bolt = part(box(), mat(0xffffff, { emissive: 0xbfe8ff, ei: 4 }), [0, 4, 0], [0.08, 8, 0.08]);
        g.add(decal, ball, ember, bolt);
        this.root.add(g);
        e = { g, decal, ball, ember, bolt };
        this.strikePool.push(e);
      }
      e.g.visible = true;
      const tl = tileAt(L, s.x, s.y);
      const y0 = tl && tl.k === 'counter' ? CH + 0.01 : 0;
      e.g.position.set(this.cx(s.x), y0, this.cz(s.y));
      const k = Math.max(0, -s.dt) / 2.2;
      e.decal.visible = s.dt < 0;
      e.decal.scale.setScalar(0.6 + (1 - k) * 0.6);
      e.decal.material.color.setHex(s.kind === 'lightning' ? 0x6ac8ff : 0xff3a2a);
      e.ball.visible = s.kind === 'cannon' && s.dt < 0;
      e.ember.visible = s.kind === 'embers' && s.dt < 0;
      e.bolt.visible = s.kind === 'lightning' && s.dt >= 0 && s.dt < 0.25;
      const fall = Math.min(6, Math.max(0, -s.dt) * 3);
      // cannonballs arc in from the rival ship astern; embers drop; lightning strikes straight down
      if (s.kind === 'cannon') {
        const fl = this.cannonFlight(s, e.g.position);
        e.ball.position.copy(fl.pos).sub(e.g.position);
        e.ball.visible = s.dt < 0 && fl.u > 0.02;
        if (e.ball.visible && Math.random() < 0.7) this.parts.puff({ x: fl.pos.x, y: fl.pos.y, z: fl.pos.z, vy: 0.15, life: 0.9, s0: 0.12, s1: 0.5, a: 0.3, color: 0x9a9a9a });
      } else e.ball.position.set(0, 0.2 + fall, 0);
      e.ember.position.set(0, 0.2 + fall, 0);
      e.ember.rotation.set(rt * 4, rt * 3, 0);
      e.bolt.rotation.z = Math.sin(rt * 60) * 0.08;
    }
    for (; si < this.strikePool.length; si++) this.strikePool[si].g.visible = false;
    for (const s of strikes) {
      if (s.dt < 0) continue;
      const key = s.kind + s.x + ',' + s.y + ',' + Math.round((t - s.dt) * 10);
      if (this.struckFx.has(key)) continue;
      this.struckFx.add(key);
      this.impact(s.kind, s.x, s.y);
    }
    // cuckoo
    if (this.bird) {
      const ck = cuckooAt(L, t);
      this.hand1.rotation.z = -rt * 0.8; this.hand2.rotation.z = -rt * 0.07;
      this.pendulum.rotation.z = Math.sin(rt * 3) * 0.35;
      this.lane.visible = !!ck;
      this.cuckooDoor.position.z = ck && ck.warn ? 0.4 : 0.27;
      this.cuckooDoor.rotation.y = ck && ck.warn ? -1.2 : 0;
      if (ck) {
        this.lane.position.z = this.cz(ck.row);
        this.lane.material.opacity = ck.warn ? 0.35 + Math.abs(Math.sin(rt * 8)) * 0.35 : 0.6;
        this.bird.visible = !ck.warn;
        if (!ck.warn) { this.bird.position.set(this.wx(ck.x), 0.1, this.cz(ck.row)); this.bird.userData.wings.forEach((w, j) => { w.rotation.x = Math.sin(rt * 30) * 0.8 * (j ? -1 : 1); }); }
      } else this.bird.visible = false;
    }
    // monkeys
    sim.monkeys.forEach((m, i) => {
      let g = this.monkeyPool[i];
      if (!g) { g = this.makeMonkey(); this.monkeyPool[i] = g; }
      g.visible = true;
      g.position.set(this.wx(m.x), m.z, this.wz(m.y));
      this.swayPoint(g.position);
      g.rotation.y = Math.atan2(m.fx || 0, m.fy || 1);
      g.userData.vine.visible = m.z > 0.05 || m.st === 'leave' || m.st === 'drop';
      g.userData.vine.position.y = 3 + 0.0;
      const hold = g.userData.hold;
      const key = itemKey(m.item);
      if (hold.userData.key !== key) {
        hold.clear();
        if (m.item) hold.add(makeItem(m.item));
        hold.userData.key = key;
      }
      g.children[0].position.y = 0.32 + Math.abs(Math.sin(rt * 12)) * 0.05;
    });
    for (let i = sim.monkeys.length; i < this.monkeyPool.length; i++) this.monkeyPool[i].visible = false;
  }

  setHighlight(target) {
    if (!target) { this.highlight.visible = false; return; }
    this.highlight.visible = true;
    const hp = target[2] != null && this.moverMeshes[target[2]] ? this.home(this.moverMeshes[target[2]].m.x0) : this.home(target[0]);
    if (this.highlight.parent !== hp) hp.add(this.highlight);
    if (target[2] != null && this.moverMeshes[target[2]]) { const p = this.moverMeshes[target[2]].g.position; this.highlight.position.set(p.x, CH + 0.02, p.z); return; }
    const tl = tileAt(this.L, target[0], target[1]);
    this.highlight.position.set(this.cx(target[0]), (tl.st === 'oven' ? 1.15 : tl.st === 'trash' ? 0.9 : CH) + 0.02, this.cz(target[1]));
  }

  /** World position of a tile (for popups). */
  tilePos(x, y, h = 1.2) { const v = new THREE.Vector3(this.cx(x), h, this.cz(y)); return this.root.localToWorld(this.swayPoint(v)); }
}

function roundRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return new THREE.ShapeGeometry(s, 6);
}

const texCache = {};
function canvasT(key, w, h, draw) {
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (texCache[key] = t);
}
/** Warm dining room seen through the serving hatch. */
function diningTex() {
  return canvasT('dining', 128, 180, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#5a2a1a'); grd.addColorStop(0.55, '#c86a2a'); grd.addColorStop(1, '#3a1a10');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // hanging lamps
    for (const x of [30, 98]) { const r = g.createRadialGradient(x, 40, 2, x, 40, 34); r.addColorStop(0, 'rgba(255,240,180,1)'); r.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); g.fillStyle = '#2a1408'; g.fillRect(x - 1, 0, 2, 32); g.beginPath(); g.moveTo(x - 10, 40); g.lineTo(x + 10, 40); g.lineTo(x + 5, 32); g.lineTo(x - 5, 32); g.fill(); }
    // diners' silhouettes and tables
    g.fillStyle = 'rgba(40,16,8,0.85)';
    for (const [x, s] of [[24, 1], [64, 1.15], [104, 0.95]]) { g.beginPath(); g.arc(x, 110 - 12 * s, 9 * s, 0, 7); g.fill(); g.fillRect(x - 12 * s, 110, 24 * s, 30); }
    g.fillStyle = 'rgba(30,12,6,0.95)'; g.fillRect(0, 138, w, 8);
    g.fillStyle = 'rgba(255,230,190,0.6)'; g.fillRect(0, 136, w, 2);
  });
}
function foamTex() {
  return canvasT('foam', 128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.6})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 0, 7); g.fill(); }
  });
}
function puddleTex() {
  return canvasT('puddle', 256, 256, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.75, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(200,240,255,0.9)'; g.lineWidth = 2;
    for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(w / 2, h / 2, 18 + i * 8 + Math.random() * 4, Math.random() * 6, Math.random() * 6 + 2); g.stroke(); }
  });
}

Object.assign(Kitchen.prototype, treehouse);
