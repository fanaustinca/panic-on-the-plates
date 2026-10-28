// Per-world backdrop: what you see in the gaps and around the kitchen (sea, lava, space, sky...).
import * as THREE from 'three';
import { mat, part, sph, cyl, box, cone, tor, capsule, ico, dode } from './items.js';
import { glowTex } from './textures.js';

function patternTex(draw, rep) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  draw(g, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const r0 = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
export const seaTex = (deep = '#1a6a9a', light = '#2f8fc4') => patternTex((g, n) => {
  g.fillStyle = deep; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 26; i++) {
    const x = r0() * n, y = r0() * n, w = 20 + r0() * 50;
    g.strokeStyle = i % 3 ? light : 'rgba(255,255,255,0.75)'; g.lineWidth = 2 + r0() * 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 7, x + w, y); g.stroke();
    // wrap copies so the pattern tiles
    g.beginPath(); g.moveTo(x - n, y); g.quadraticCurveTo(x - n + w / 2, y - 7, x - n + w, y); g.stroke();
  }
}, 10);
const lavaTex = (emissive) => patternTex((g, n) => {
  g.fillStyle = emissive ? '#ff7a1a' : '#2a1410'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 40; i++) {
    const cx = r0() * n, cy = r0() * n, rr = 14 + r0() * 26;
    g.fillStyle = emissive ? '#000' : `rgb(${50 + r0() * 30},${24 + r0() * 14},${18})`;
    g.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; g.lineTo(cx + Math.cos(a) * rr * (0.7 + r0() * 0.4), cy + Math.sin(a) * rr * (0.7 + r0() * 0.4)); } g.closePath(); g.fill();
  }
}, 6);
import { rng } from '../rng.js';

export const STYLE = {
  pirate: { floor: 'planks', wall: 'hull', top: 'wood', side: 0x7a4a26, trim: 0x3a2a1a, light: 0xfff2dc, hemi: [0xbfe3ff, 0x6a4a2a], sun: 2.6, amb: 1.0, exposure: 1.05 },
  glacier: { floor: 'ice', wall: 'snowbrick', top: 'ice', side: 0x8fc0da, trim: 0x5a98bc, light: 0xf2f8ff, hemi: [0xe6f6ff, 0x7aa8c8], sun: 2.4, amb: 1.1, exposure: 1.0 },
  volcano: { floor: 'basalt', wall: 'obsidian', top: 'stone', side: 0x2e2628, trim: 0xff6a20, light: 0xffc890, hemi: [0xff8a50, 0x2a0a06], sun: 2.2, amb: 0.8, exposure: 1.15 },
  space: { floor: 'metalgrid', wall: 'hullpanel', top: 'panel', side: 0xaab4c2, trim: 0x2ad0ff, light: 0xe8f0ff, hemi: [0x8aa8ff, 0x1a1a2a], sun: 2.6, amb: 0.85, exposure: 1.1 },
  clouds: { floor: 'cloudtile', wall: 'marble', top: 'marble', side: 0xe6dccb, trim: 0xd8b050, light: 0xfff6e6, hemi: [0xdfe9ff, 0xb8a8d8], sun: 2.5, amb: 1.1, exposure: 1.0 },
  jungle: { floor: 'bamboo', wall: 'trunk', top: 'bamboo', side: 0x7a5a2a, trim: 0x3a7a2a, light: 0xfff0c8, hemi: [0xcfffb0, 0x3a5a2a], sun: 2.4, amb: 1.0, exposure: 1.05 },
  factory: { floor: 'steelplate', wall: 'brickfactory', top: 'steel', side: 0x56606c, trim: 0xffc020, light: 0xfff0dc, hemi: [0xcfd8e6, 0x3a3a3a], sun: 2.4, amb: 0.95, exposure: 1.05 },
  library: { floor: 'parquet', wall: 'bookshelf', top: 'darkwood', side: 0x4a2a1a, trim: 0xd8a84a, light: 0xffe0b0, hemi: [0xb89aff, 0x3a2a1a], sun: 2.2, amb: 0.9, exposure: 1.15 },
};

/** Build backdrop group for a world; returns { group, update(t) }. */
export function buildBackdrop(worldId, W, H, sky) {
  const g = new THREE.Group();
  const r = rng(worldId.length * 97 + W);
  const updaters = [];
  const span = Math.max(W, H) * 4;
  const plane = (color, y, opts = {}) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(span, span, opts.seg || 1, opts.seg || 1), opts.material || mat(color, opts));
    m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = !!opts.shadow;
    g.add(m);
    return m;
  };
  const scatter = (n, inner, outer, fn) => {
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = inner + r() * (outer - inner);
      const x = Math.cos(a) * d * (W / 2 + 2), z = Math.sin(a) * d * (H / 2 + 2);
      fn(x, z, i);
    }
  };
  switch (worldId) {
    case 'pirate': {
      const seaM = new THREE.MeshStandardMaterial({ map: seaTex(), roughness: 0.3, metalness: 0.05, flatShading: true });
      updaters.push((t) => { seaM.map.offset.set(t * 0.012, t * 0.02); });
      const sea = plane(0, -2.2, { material: seaM, seg: 48 });
      const pos = sea.geometry.attributes.position;
      const base = Float32Array.from(pos.array);
      updaters.push((t) => {
        for (let i = 0; i < pos.count; i++) { const x = base[i * 3], y = base[i * 3 + 1]; pos.array[i * 3 + 2] = Math.sin(x * 0.5 + t * 1.2) * 0.18 + Math.cos(y * 0.6 + t * 0.9) * 0.15; }
        pos.needsUpdate = true; sea.geometry.computeVertexNormals();
      });
      // hull beneath the deck
      const hull = part(box(), mat(0x5a3418, { rough: 0.8 }), [0, -1.1, 0], [W + 0.6, 1.8, H + 0.4]);
      g.add(hull);
      g.add(part(box(), mat(0xe8d8b0), [0, -0.35, H / 2 + 0.22], [W + 0.6, 0.12, 0.05]));
      // masts and sails behind the kitchen
      for (const mx of [-W / 3, W / 3]) {
        g.add(part(cyl(12), mat(0x6a4422), [mx, 2.5, -H / 2 - 1.2], [0.18, 7, 0.18]));
        const sail = part(box(), mat(0xf4ecd8, { rough: 0.9 }), [mx, 3.6, -H / 2 - 1.0], [3.4, 2.6, 0.06]);
        g.add(sail);
        updaters.push((t) => { sail.scale.z = 0.06 + Math.sin(t * 1.3 + mx) * 0.03; sail.rotation.x = Math.sin(t * 0.8 + mx) * 0.05; });
        g.add(part(box(), mat(0x6a4422), [mx, 5, -H / 2 - 1.15], [3.8, 0.12, 0.12]));
      }
      const flag = part(box(), mat(0x111111), [W / 3 + 0.6, 6.2, -H / 2 - 1.2], [1.0, 0.6, 0.02]);
      g.add(flag);
      g.add(part(sph(10), mat(0xffffff), [W / 3 + 0.6, 6.25, -H / 2 - 1.18], 0.13));
      updaters.push((t) => { flag.rotation.y = Math.sin(t * 3) * 0.25; });
      scatter(6, 1.6, 2.6, (x, z) => { g.add(part(cyl(12), mat(0x8a5a2a), [x, -1.8, z], [0.4, 0.8, 0.4])); });
      break;
    }
    case 'glacier': {
      const wM = new THREE.MeshStandardMaterial({ map: seaTex('#1f6f96', '#5ab0d8'), roughness: 0.15, metalness: 0.2 });
      plane(0, -1.6, { material: wM });
      updaters.push((t) => { wM.map.offset.set(t * 0.006, t * 0.01); });
      scatter(30, 1.05, 2.4, (x, z) => { const s = 0.3 + r() * 0.6; g.add(part(box(), mat(0xeaf8ff, { rough: 0.4 }), [x, -1.55, z], [s * 2, 0.15, s * 1.6], [0, r() * 3, 0])); });
      scatter(14, 1.3, 2.8, (x, z) => {
        const s = 0.8 + r() * 2.2;
        g.add(part(ico(), mat(0xeaf8ff, { rough: 0.4, flat: true }), [x, -1.4 + s * 0.3, z], [s, s * (0.6 + r()), s], [r(), r(), r()]));
      });
      for (let i = 0; i < 3; i++) g.add(part(cone(6), mat(0xf4fbff, { flat: true }), [-W / 2 + i * W / 2, 1.5, -H / 2 - 5], [4 + i, 7 + i * 2, 4], [0, i, 0]));
      break;
    }
    case 'volcano': {
      const lava = plane(0, -1.8, { material: new THREE.MeshStandardMaterial({ map: lavaTex(false), emissiveMap: lavaTex(true), emissive: 0xffffff, emissiveIntensity: 1.2, roughness: 0.8 }) });
      updaters.push((t) => { lava.material.emissiveIntensity = 1.0 + Math.sin(t * 2) * 0.25; lava.material.map.offset.x = lava.material.emissiveMap.offset.x = t * 0.004; });
      g.add(part(box(), mat(0x1a1416, { rough: 0.95 }), [0, -1.0, 0], [W + 0.2, 1.6, H + 0.2]));
      scatter(12, 1.3, 2.6, (x, z) => { const s = 0.6 + r() * 1.6; g.add(part(dode(), mat(0x2a2224, { flat: true, rough: 0.9 }), [x, -1.6 + s * 0.4, z], s, [r(), r(), r()])); });
      for (let i = 0; i < 2; i++) {
        const fall = part(box(), mat(0xff6a10, { emissive: 0xff4400, ei: 1.6 }), [(i ? 1 : -1) * W * 0.35, 1.5, -H / 2 - 1.4], [0.8, 7, 0.2]);
        g.add(fall);
      }
      break;
    }
    case 'space': {
      const starGeo = new THREE.BufferGeometry();
      const pts = [];
      for (let i = 0; i < 1500; i++) { const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(60 + r() * 20); pts.push(v.x, v.y * 0.8 - 10, v.z); }
      starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      g.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.25, sizeAttenuation: true })));
      const planet = part(sph(48), mat(0x5a4ad8, { rough: 0.8, emissive: 0x1a0a5a, ei: 0.6 }), [W * 0.9, -12, -H * 1.6], 9);
      g.add(planet);
      g.add(part(tor(), mat(0xb8a8ff, { opacity: 0.6 }), [W * 0.9, -12, -H * 1.6], [13, 13, 0.4], [1.2, 0.3, 0]));
      updaters.push((t) => { planet.rotation.y = t * 0.05; });
      g.add(part(box(), mat(0x8a96a8, { metal: 0.6, rough: 0.4 }), [0, -0.9, 0], [W + 0.3, 1.4, H + 0.3]));
      for (const s of [-1, 1]) g.add(part(box(), mat(0x1a3a8a, { metal: 0.5, rough: 0.3, emissive: 0x0a1a4a, ei: 0.5 }), [s * (W / 2 + 4), -0.6, 0], [6, 0.08, 2.4]));
      break;
    }
    case 'clouds': {
      plane(0, -4, { material: new THREE.MeshStandardMaterial({ color: 0xc9d8ff, roughness: 1 }) });
      const puff = mat(0xffffff, { rough: 1 });
      scatter(26, 0.9, 2.8, (x, z, i) => {
        const cg = new THREE.Group();
        for (let k = 0; k < 4; k++) cg.add(part(sph(14), puff, [(k - 1.5) * 0.9, r() * 0.3, r() * 0.6], 0.7 + r() * 0.6));
        cg.position.set(x, -2.4 + r() * 1.5, z);
        g.add(cg);
        updaters.push((t) => { cg.position.x = x + Math.sin(t * 0.2 + i) * 0.6; });
      });
      // floating marble base under the kitchen
      g.add(part(cyl(8), mat(0xf2ece0, { rough: 0.5 }), [0, -0.7, 0], [W * 0.6, 1.2, H * 0.62]));
      const balloon = new THREE.Group();
      balloon.add(part(sph(20), mat(0xe8553a), [0, 0, 0], [1, 1.2, 1]));
      balloon.add(part(box(), mat(0x8a5a2a), [0, -1.8, 0], 0.5));
      balloon.position.set(-W / 2 - 3, 3, -H / 2 - 2);
      g.add(balloon);
      updaters.push((t) => { balloon.position.y = 3 + Math.sin(t * 0.6) * 0.4; });
      break;
    }
    case 'jungle': {
      plane(0x1f4a1f, -6, {});
      const leaf = mat(0x2f8a3a, { rough: 0.8, flat: true }), leaf2 = mat(0x4ab04a, { rough: 0.8, flat: true }), trunk = mat(0x5a3a1e, { rough: 0.9 });
      scatter(16, 1.2, 2.6, (x, z) => {
        const h = 6 + r() * 4;
        g.add(part(cyl(10), trunk, [x, -6 + h / 2, z], [0.4, h, 0.4]));
        for (let k = 0; k < 3; k++) g.add(part(ico(), k % 2 ? leaf : leaf2, [x + (r() - 0.5) * 1.6, -6 + h + r() * 0.8, z + (r() - 0.5) * 1.6], 1.2 + r() * 0.8, [r(), r(), r()]));
      });
      // supporting trunks under each platform
      for (let i = 0; i < 4; i++) g.add(part(cyl(12), trunk, [(i - 1.5) * W / 4, -3.4, 0], [0.5, 6, 0.5]));
      for (let i = 0; i < 10; i++) {
        const vine = part(cyl(6), mat(0x3a7a2a), [(r() - 0.5) * W, 3, -H / 2 - 0.4 + r() * 0.2], [0.04, 4 + r() * 2, 0.04]);
        g.add(vine);
      }
      break;
    }
    case 'factory': {
      plane(0x1a1c20, -5, {});
      const pipe = mat(0x8a929c, { metal: 0.7, rough: 0.35 }), pipe2 = mat(0xc0442a, { metal: 0.4, rough: 0.5 });
      for (let i = 0; i < 6; i++) g.add(part(cyl(12), i % 2 ? pipe : pipe2, [-W / 2 - 2 + i * (W + 4) / 5, -2.5, 0], [0.25, 6, 0.25]));
      g.add(part(cyl(12), pipe, [0, 3.2, -H / 2 - 0.8], [0.3, W + 6, 0.3], [0, 0, Math.PI / 2]));
      for (let i = 0; i < 3; i++) {
        const gear = new THREE.Group();
        gear.add(part(cyl(24), mat(0x6a727c, { metal: 0.8, rough: 0.3 }), [0, 0, 0], [1.2, 0.2, 1.2], [Math.PI / 2, 0, 0]));
        for (let k = 0; k < 10; k++) gear.add(part(box(), mat(0x6a727c, { metal: 0.8, rough: 0.3 }), [Math.cos(k / 10 * Math.PI * 2) * 1.3, Math.sin(k / 10 * Math.PI * 2) * 1.3, 0], [0.3, 0.3, 0.18], [0, 0, k / 10 * Math.PI * 2]));
        gear.position.set((i - 1) * W * 0.4, 3.2, -H / 2 - 1.4);
        g.add(gear);
        updaters.push((t) => { gear.rotation.z = t * (i % 2 ? 0.6 : -0.6); });
      }
      g.add(part(box(), mat(0x3a3e44, { metal: 0.6, rough: 0.5 }), [0, -0.9, 0], [W + 0.2, 1.4, H + 0.2]));
      break;
    }
    case 'library': {
      plane(0x0a0812, -6, {});
      const covers = [0x8a2a2a, 0x2a4a8a, 0x2a6a3a, 0x8a6a2a, 0x5a2a6a];
      scatter(18, 1.1, 2.6, (x, z, i) => {
        const b = new THREE.Group();
        b.add(part(box(), mat(covers[i % 5], { rough: 0.7 }), [0, 0, 0], [0.9, 0.18, 1.2]));
        b.add(part(box(), mat(0xf4ead0), [0.05, 0, 0], [0.82, 0.14, 1.14]));
        const y = -1 + r() * 4;
        b.position.set(x, y, z);
        b.rotation.set(r(), r() * 6, r() * 0.5);
        g.add(b);
        updaters.push((t) => { b.position.y = y + Math.sin(t * 0.7 + i) * 0.3; b.rotation.y += 0.002; });
      });
      g.add(part(box(), mat(0x2a1a10, { rough: 0.8 }), [0, -0.9, 0], [W + 0.2, 1.4, H + 0.2]));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x9a6aff, transparent: true, opacity: 0.5, depthWrite: false }));
      glow.scale.setScalar(30); glow.position.set(0, -8, -6);
      g.add(glow);
      break;
    }
  }
  return { group: g, update: (t) => updaters.forEach((f) => f(t)) };
}
