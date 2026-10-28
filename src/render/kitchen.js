// Kitchen renderer: static tiles/stations from the level, plus per-frame dynamic state (items,
// fires, progress bars, moving floes/walls/bridges, hazards, monkeys).
import * as THREE from 'three';
import { T, INGREDIENTS, WORLDS } from '../config.js';
import { tileAt } from '../levels.js';
import { floeAt, cycle, shiftUp, shiftWarn, bridgeOff, bridgeWarn, strikesNear, holeAt, HOLE_TIME, cuckooAt, envAt, WARN } from '../hazards.js';
import { floorTex, wallTex, topTex, stripeTex, beltTex, glowTex, textTex, shade } from './textures.js';
import { mat, part, sph, cyl, box, cone, tor, capsule, ico, dode, makeItem, itemKey, makeIngredient } from './items.js';
import { STYLE, buildBackdrop } from './env.js';

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
    this.build();
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
    const floorM = new THREE.MeshStandardMaterial({ map: floorTex(S.floor), roughness: S.floor === 'ice' ? 0.15 : 0.7, metalness: S.floor === 'ice' ? 0.1 : 0.05 });
    const wallM = new THREE.MeshStandardMaterial({ map: wallTex(S.wall), roughness: 0.8 });
    const topM = new THREE.MeshStandardMaterial({ map: topTex(S.top), roughness: S.top === 'ice' || S.top === 'marble' ? 0.25 : 0.55, metalness: S.top === 'steel' ? 0.6 : 0 });
    const sideM = mat(S.side, { rough: 0.6 });
    const trimM = mat(S.trim, { rough: 0.4, metal: 0.3, emissive: this.world.id === 'volcano' || this.world.id === 'space' ? S.trim : 0, ei: 0.5 });
    const floors = L.tiles.filter((t) => t.k === 'floor');
    const counters = L.tiles.filter((t) => t.k === 'counter' && !['trash', 'oven'].includes(t.st));
    const walls = L.tiles.filter((t) => t.k === 'wall');
    const inst = (geom, material, list, fn) => {
      const m = new THREE.InstancedMesh(geom, material, Math.max(1, list.length));
      const o = new THREE.Object3D();
      list.forEach((t, i) => { fn(o, t); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
      m.count = list.length;
      m.castShadow = true; m.receiveShadow = true;
      this.root.add(m);
      return m;
    };
    const B = new THREE.BoxGeometry(1, 1, 1);
    // floor slabs (counters sit on slabs too, so islands read as solid platforms)
    const slabs = L.tiles.filter((t) => t.k === 'floor' || (t.k === 'counter' && !t.overVoid) || t.k === 'wall');
    inst(B, floorM, slabs, (o, t) => { o.position.set(this.cx(t.x), -0.15, this.cz(t.y)); o.scale.set(1, 0.3, 1); });
    inst(B, mat(shade(S.side, -0.35), { rough: 0.8 }), slabs, (o, t) => { o.position.set(this.cx(t.x), -0.55, this.cz(t.y)); o.scale.set(0.98, 0.5, 0.98); });
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
    this.buildHazardProps();
    this.backdrop = buildBackdrop(this.world.id, L.W, L.H, this.world.sky);
    this.root.add(this.backdrop.group);
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
    this.root.add(m);
    this.fx.push({ belt: tex, dir: 1 });
  }

  buildStation(t, sideM, topM) {
    const g = new THREE.Group();
    g.position.set(this.cx(t.x), CH, this.cz(t.y));
    const [dx, dy] = this.faceDir(t);
    g.rotation.y = Math.atan2(dx, dy);
    this.root.add(g);
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
        add(box(), dark, [0, 0.01, 0], [0.8, 0.02, 0.8]);
        add(box(), mat(0x3a7ad8), [0, 0.5, -0.42], [0.9, 0.8, 0.06]);
        const s = add(new THREE.PlaneGeometry(0.8, 0.22), new THREE.MeshBasicMaterial({ map: textTex('DISHES', { fg: '#fff', font: '800 38px Fredoka, sans-serif' }), transparent: true }), [0, 0.78, -0.385]);
        s.castShadow = false;
        add(box(), mat(0x111418), [0, 0.35, -0.385], [0.6, 0.36, 0.01]);
        break;
      }
      case 'window': {
        const frame = mat(0xe8553a, { rough: 0.4 });
        add(box(), mat(0xe8e2d4, { rough: 0.4 }), [0, 0.01, 0], [0.96, 0.02, 0.96]);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(box(), frame, [sx * 0.44, 0.62, sz * 0.44], [0.07, 1.24, 0.07]);
        add(box(), frame, [0, 1.24, -0.44], [0.96, 0.08, 0.07]);
        // striped awning sloping towards the cooks
        const aw = add(new THREE.PlaneGeometry(1.1, 0.62), new THREE.MeshStandardMaterial({ map: stripeTex('#ff5a3c', '#fff6e6'), side: THREE.DoubleSide, roughness: 0.7 }), [0, 1.36, 0.06], 1, [-1.05, 0, 0]);
        aw.castShadow = true;
        const sign = add(new THREE.PlaneGeometry(0.9, 0.24), new THREE.MeshBasicMaterial({ map: textTex('ORDER UP!', { bg: '#1b1b2a', fg: '#ffd23a', font: '800 36px Fredoka, sans-serif' }) }), [0, 1.08, -0.4]);
        sign.castShadow = false;
        P.bell = add(sph(14), mat(0xf2c23a, { metal: 0.9, rough: 0.2 }), [0.3, 0.07, 0.28], [0.08, 0.06, 0.08]);
        P.lamp = add(cyl(16), mat(0xffd080, { emissive: 0xffa040, ei: 0.8 }), [0, 1.18, 0], [0.12, 0.05, 0.12]);
        add(box(), mat(0xb8c0c8, { metal: 0.7, rough: 0.3 }), [0, 0.04, 0], [0.86, 0.04, 0.22]);
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
      this.root.add(g, wg);
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
    this.root.rotation.z = env.tiltAngle;
    this.backdrop.update(rt);
    const play = Math.max(0, t);

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
          if (e) this.dyn.remove(e.mesh);
          const mesh = makeItem(it);
          e = { key, mesh };
          this.itemMeshes.set(i, e);
          this.dyn.add(mesh);
        }
        const base = tl.st === 'oven' ? 1.15 : tl.st === 'trash' ? 0.9 : CH + (ITEM_Y[tl.st] || 0);
        const bt = tl.belt != null ? Math.min(1, s.bt || 0) : 0;
        e.mesh.position.set(this.cx(tl.x), base, this.cz(tl.y));
        if (tl.st === 'pan' || tl.st === 'pot') e.mesh.position.y += Math.sin(rt * 9 + i) * 0.006;
        e.mesh.rotation.y = tl.st === 'board' ? 0.3 : 0;
      }
      // progress bars
      let prog = null, warn = false, done = false;
      if (it && it.kind === 'ing') {
        if (tl.st === 'board' && it.s === 'raw' && it.p > 0) prog = it.p;
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
      }
    });
    for (const [i, e] of this.itemMeshes) if (!seen.has(i)) { this.dyn.remove(e.mesh); this.itemMeshes.delete(i); }

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
      if (b.rope) {
        g.position.z = env.swayV * 0.06;
        g.rotation.x = env.swayV * 0.03;
      }
      g.visible = g.position.y > -2.8;
    }
    for (const { s, g, warn } of this.shiftMeshes) {
      const up = shiftUp(s, play), w = shiftWarn(s, play);
      const ty = up ? 0 : -1.25;
      g.position.y += (ty - g.position.y) * Math.min(1, dt * 7);
      warn.visible = w && !up;
      warn.children[0].material.opacity = 0.5 + Math.sin(rt * 14) * 0.4;
    }
    this.updateHazards(sim, play, dt, rt, env);
  }

  setStack(key, n, dirty, tl, y, off) {
    let e = this.itemMeshes.get(key);
    const k = n ? `${n}${dirty}` : '';
    if (!e || e.key !== k) {
      if (e) this.dyn.remove(e.mesh);
      this.itemMeshes.delete(key);
      if (!n) return false;
      const mesh = makeItem({ kind: 'plate', n, dirty, c: [] });
      e = { key: k, mesh };
      this.itemMeshes.set(key, e);
      this.dyn.add(mesh);
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
      const g = new THREE.Group();
      const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.13), new THREE.MeshBasicMaterial({ color: 0x14141c, transparent: true, opacity: 0.85, depthTest: false }));
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.08), new THREE.MeshBasicMaterial({ color: 0x5ad15a, depthTest: false }));
      fill.position.z = 0.001;
      fill.geometry.translate(0.28, 0, 0);
      fill.position.x = -0.28;
      const icon = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), new THREE.MeshBasicMaterial({ map: textTex('✔', { w: 64, h: 64, bg: '#2fbf5a', font: '900 44px sans-serif' }), depthTest: false }));
      const warnI = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), new THREE.MeshBasicMaterial({ map: textTex('!', { w: 64, h: 64, bg: '#ff3a3a', font: '900 48px Fredoka, sans-serif' }), depthTest: false }));
      g.add(bg, fill, icon, warnI);
      g.renderOrder = 10;
      [bg, fill, icon, warnI].forEach((m) => { m.renderOrder = 10; });
      this.root.add(g);
      b = { g, bg, fill, icon, warnI };
      this.bars.set(i, b);
    }
    b.g.visible = true;
    b.g.position.set(this.cx(tl.x), (tl.st === 'oven' ? 1.75 : 1.6), this.cz(tl.y));
    b.g.quaternion.copy(camera.quaternion);
    const showBar = prog != null;
    b.bg.visible = b.fill.visible = showBar;
    if (showBar) { b.fill.scale.x = Math.max(0.001, Math.min(1, prog)); b.fill.material.color.setHex(tl.st === 'sink' ? 0x4ab8ff : tl.st === 'board' ? 0xffcf3a : 0x5ad15a); }
    b.icon.visible = done && !warn;
    b.warnI.visible = warn;
    if (warn) b.warnI.scale.setScalar(1 + Math.abs(Math.sin(rt * 10)) * 0.3);
  }

  setFire(i, tl, fire, rt) {
    let f = this.fires.get(i);
    if (!fire) { if (f) { this.root.remove(f.g); this.fires.delete(i); } return; }
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
      this.root.add(g);
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
            if (c.on) it.fl.children.forEach((m, j) => { m.scale.y = 1.1 * (0.8 + 0.3 * Math.sin(rt * 15 + j)); });
            it.crack.material.emissiveIntensity = c.warn ? 1 + Math.sin(rt * 20) : c.on ? 2 : 0.4;
          } else {
            it.beams.visible = c.on || (c.warn && Math.sin(rt * 30) > 0);
            it.beams.userData.on = c.on;
          }
        }
      } else if (h.kind === 'geyser') {
        const c = cycle(t, h.h.period, 1.7, h.h.phase);
        h.col.visible = c.on;
        if (c.on) { h.col.scale.y = 2.4 * Math.min(1, c.k * 5); h.col.position.y = h.col.scale.y / 2; }
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
      const fall = Math.min(5, Math.max(0, -s.dt) * 3);
      e.ball.position.set(-fall * 0.5, 0.2 + fall, 0);
      e.ember.position.set(0, 0.2 + fall, 0);
      e.ember.rotation.set(rt * 4, rt * 3, 0);
      e.bolt.rotation.z = Math.sin(rt * 60) * 0.08;
    }
    for (; si < this.strikePool.length; si++) this.strikePool[si].g.visible = false;
    // cannonball holes
    let hi = 0;
    if (L.hz.cannon) for (const s of L.hz.cannon) {
      if (!(t >= s.t && t < s.t + HOLE_TIME)) continue;
      let e = this.holePool[hi++];
      if (!e) {
        const g = new THREE.Group();
        g.add(part(new THREE.CircleGeometry(0.46, 24), mat(0x0a2a3a, { rough: 1 }), [0, 0.012, 0], 1, [-Math.PI / 2, 0, 0]));
        for (let k = 0; k < 7; k++) g.add(part(box(), mat(0x6a4422), [Math.cos(k) * 0.45, 0.03, Math.sin(k) * 0.45], [0.18, 0.05, 0.06], [0, k * 1.3, 0.3]));
        this.root.add(g);
        e = { g };
        this.holePool.push(e);
      }
      e.g.visible = true;
      e.g.position.set(this.cx(s.x), 0, this.cz(s.y));
      const left = s.t + HOLE_TIME - t;
      e.g.scale.setScalar(left < 1 ? left : 1);
    }
    for (; hi < this.holePool.length; hi++) this.holePool[hi].g.visible = false;
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
    const tl = tileAt(this.L, target[0], target[1]);
    this.highlight.visible = true;
    this.highlight.position.set(this.cx(target[0]), (tl.st === 'oven' ? 1.15 : tl.st === 'trash' ? 0.9 : CH) + 0.02, this.cz(target[1]));
  }

  /** World position of a tile (for popups). */
  tilePos(x, y, h = 1.2) { const v = new THREE.Vector3(this.cx(x), h, this.cz(y)); return this.root.localToWorld(v); }
}
