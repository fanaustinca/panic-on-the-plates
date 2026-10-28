// Per-world backdrop: what you see in the gaps and around the kitchen (sea, lava, space, sky...).
import * as THREE from 'three';
import { mat, part, sph, cyl, box, cone, tor, capsule, ico, dode } from './items.js';
import { glowTex, barkTex } from './textures.js';
import { branch, leafClump } from './treehouse.js';
import { buildShip, WATERLINE } from './ship.js';
import { makeOcean } from './ocean.js';
import { makeLava } from './lava.js';
import { buildFactory } from './factory.js';

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
import { rng } from '../rng.js';

/** Where the great jungle tree stands (the treehouse pods hang from it). */
export function trunkSpot(W, H) { return { x: 0, z: -H / 2 - 3.6, r: 2.4 }; }

function mistTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 40; i++) {
    const x = r0() * 256, y = r0() * 256, rr = 30 + r0() * 60;
    for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
      const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr);
      grd.addColorStop(0, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(x + ox - rr, y + oy - rr, rr * 2, rr * 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export const STYLE = {
  pirate: { floor: 'planks', wall: 'hull', top: 'wood', side: 0x7a4a26, trim: 0x3a2a1a, light: 0xfff2dc, hemi: [0xbfe3ff, 0x6a4a2a], sun: 2.6, amb: 1.0, exposure: 1.05 },
  glacier: { floor: 'ice', wall: 'snowbrick', top: 'ice', side: 0x8fc0da, trim: 0x5a98bc, light: 0xf2f8ff, hemi: [0xe6f6ff, 0x7aa8c8], sun: 2.4, amb: 1.1, exposure: 1.0 },
  volcano: { floor: 'basalt', wall: 'obsidian', top: 'stone', side: 0x2e2628, trim: 0xff6a20, light: 0xffc890, hemi: [0xff8a50, 0x2a0a06], sun: 2.2, amb: 0.8, exposure: 1.15 },
  space: { floor: 'metalgrid', wall: 'hullpanel', top: 'panel', side: 0xaab4c2, trim: 0x2ad0ff, light: 0xe8f0ff, hemi: [0x8aa8ff, 0x1a1a2a], sun: 2.6, amb: 0.85, exposure: 1.1 },
  clouds: { floor: 'cloudtile', wall: 'marble', top: 'marble', side: 0xe6dccb, trim: 0xd8b050, light: 0xfff6e6, hemi: [0xdfe9ff, 0xb8a8d8], sun: 2.5, amb: 1.1, exposure: 1.0 },
  jungle: { floor: 'treeplanks', wall: 'logs', top: 'wood', side: 0x7a5a2a, trim: 0x3a7a2a, light: 0xfff0c8, hemi: [0xcfffb0, 0x3a5a2a], sun: 2.4, amb: 1.0, exposure: 1.05 },
  factory: { floor: 'steelplate', wall: 'brickfactory', top: 'steel', side: 0x56606c, trim: 0xffc020, light: 0xfff0dc, hemi: [0xcfd8e6, 0x3a3a3a], sun: 2.4, amb: 0.95, exposure: 1.05 },
  library: { floor: 'parquet', wall: 'bookshelf', top: 'darkwood', side: 0x4a2a1a, trim: 0xd8a84a, light: 0xffe0b0, hemi: [0xb89aff, 0x3a2a1a], sun: 2.2, amb: 0.9, exposure: 1.15 },
};

/** Build backdrop group for a world; returns { group, update(t) }. */
export function buildBackdrop(worldId, W, H, sky, L = null) {
  const g = new THREE.Group();
  const world = new THREE.Group(); // stays put while the kitchen root rolls
  let ocean = null, rivalInfo = null, fxInfo = null;
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
      // the galleon rides on the kitchen root (rolls with the deck); the ocean stays level in the world
      const ship = buildShip(W, H);
      g.add(ship.group);
      updaters.push(ship.update);
      ocean = makeOcean({ preset: 'sea', y: WATERLINE, hull: ship.hull, deep: 0x06304e, shallow: 0x1a8a9c, sky: 0x8ec8f0, horizon: 0xd8eeff, fog: 0xbfe3ff, fogNear: 34, fogFar: 95 });
      world.add(ocean.mesh);
      // a rival galleon off the stern quarter, broadside on, lobbing the cannonballs
      const rv = buildShip(7, 4, { rival: true });
      const rival = rv.group;
      rival.scale.setScalar(0.85);
      rival.position.set(-W * 0.32, 0, -H / 2 - 10.5);
      rival.rotation.y = 0.18; // broadside towards our galleon
      world.add(rival);
      rivalInfo = { group: rival, muzzles: rv.muzzles };
      updaters.push(rv.update);
      updaters.push((t) => {
        rival.position.y = WATERLINE * (1 - 0.85) + ocean.heightAt(rival.position.x, rival.position.z, t) * 0.8;
        rival.rotation.z = Math.sin(t * 0.55) * 0.035;
        rival.rotation.x = Math.sin(t * 0.4 + 1) * 0.02;
      });
      break;
    }
    case 'glacier': {
      ocean = makeOcean({ preset: 'calm', y: -1.6, deep: 0x0b3c58, shallow: 0x3aa6c8, sky: 0xd8f0ff, horizon: 0xf0fbff, foam: 0xffffff, fog: 0xdff3ff, fogNear: 34, fogFar: 95, ampScale: 0.8 });
      world.add(ocean.mesh);
      scatter(30, 1.05, 2.4, (x, z) => { const s = 0.3 + r() * 0.6; g.add(part(box(), mat(0xeaf8ff, { rough: 0.4 }), [x, -1.55, z], [s * 2, 0.15, s * 1.6], [0, r() * 3, 0])); });
      scatter(14, 1.3, 2.8, (x, z) => {
        const s = 0.8 + r() * 2.2;
        g.add(part(ico(), mat(0xeaf8ff, { rough: 0.4, flat: true }), [x, -1.4 + s * 0.3, z], [s, s * (0.6 + r()), s], [r(), r(), r()]));
      });
      for (let i = 0; i < 3; i++) g.add(part(cone(6), mat(0xf4fbff, { flat: true }), [-W / 2 + i * W / 2, 1.5, -H / 2 - 5], [4 + i, 7 + i * 2, 4], [0, i, 0]));
      break;
    }
    case 'volcano': {
      const lava = makeLava({ y: -1.8, fog: 0x3a0e06, fogNear: 30, fogFar: 85 });
      world.add(lava.mesh);
      updaters.push((t) => lava.update(t));
      const rock = mat(0x241c1c, { flat: true, rough: 0.95 }), rock2 = mat(0x352a28, { flat: true, rough: 0.9 });
      const hot = mat(0x1e1412, { flat: true, rough: 0.85, emissive: 0xff3a00, ei: 0.1 });
      // the kitchen stands on a basalt island: core block + a ragged skirt of boulders at the lava line
      g.add(part(box(), mat(0x1a1416, { rough: 0.95 }), [0, -1.0, 0], [W + 0.2, 1.6, H + 0.2]));
      const per = 2 * (W + H);
      for (let d = 0; d < per; d += 0.8 + r() * 0.6) {
        let x, z;
        if (d < W) { x = -W / 2 + d; z = -H / 2 - 0.3; } else if (d < W + H) { x = W / 2 + 0.3; z = -H / 2 + d - W; } else if (d < 2 * W + H) { x = W / 2 - (d - W - H); z = H / 2 + 0.3; } else { x = -W / 2 - 0.3; z = H / 2 - (d - 2 * W - H); }
        const s = 0.45 + r() * 0.55;
        g.add(part(dode(), r() < 0.25 ? hot : r() < 0.5 ? rock2 : rock, [x + (r() - 0.5) * 0.4, -1.65 + r() * 0.3, z + (r() - 0.5) * 0.4], [s * 1.3, s * 0.8, s * 1.2], [r() * 3, r() * 3, r() * 3]));
      }
      // cliff with two lavafalls pouring down behind the kitchen
      const cliffZ = -H / 2 - 3.2;
      for (let i = 0; i < 9; i++) {
        const s = 1.6 + r() * 1.6;
        g.add(part(dode(), r() < 0.3 ? rock2 : rock, [-W / 2 - 3 + i * (W + 6) / 8, -1 + r() * 4, cliffZ - 1 - r() * 1.5], [s * 1.2, s * 2.2, s], [r(), r() * 3, r()]));
      }
      const falls = [];
      for (const fx of [-W * 0.3, W * 0.28]) {
        const lf = makeLava({ fall: true, w: 1.4, h: 9 });
        lf.mesh.position.set(fx, 2.6, cliffZ + 0.15);
        g.add(lf.mesh);
        updaters.push((t) => lf.update(t));
        g.add(part(dode(), rock, [fx, 7.2, cliffZ - 0.4], [2.2, 1.2, 1.6], [0.3, 0.5, 0.1]));
        falls.push([fx, -1.8, cliffZ + 0.4]);
      }
      // floating rocks either side
      scatter(10, 1.35, 2.6, (x, z) => { const s = 0.6 + r() * 1.6; g.add(part(dode(), r() < 0.3 ? hot : rock, [x, -1.6 + s * 0.4, z], s, [r(), r(), r()])); });
      // volcanoes on the horizon with glowing craters
      const vents = [];
      for (const [vx, vz, vh, vr] of [[-W * 0.75, -H - 16, 13, 9], [W * 0.9, -H - 22, 17, 12], [W * 0.15, -H - 30, 11, 8]]) {
        const prof = [];
        for (let k = 0; k <= 10; k++) { const u = k / 10; prof.push(new THREE.Vector2(vr * (1 - u * 0.82) * (1 + (r() - 0.5) * 0.08), -2 + u * vh)); }
        const cone = new THREE.Mesh(new THREE.LatheGeometry(prof, 14), rock);
        cone.position.set(vx, 0, vz);
        g.add(cone);
        const crater = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff5a10, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
        crater.scale.setScalar(vr * 0.9);
        crater.position.set(vx, vh - 1.8, vz);
        g.add(crater);
        updaters.push((t) => { crater.material.opacity = 0.75 + Math.sin(t * 1.7 + vx) * 0.2; });
        // a lava river down one flank
        const rv = makeLava({ fall: true, w: 1.2, h: vh * 1.05 });
        rv.mesh.position.set(vx + vr * 0.12, vh * 0.42 - 2, vz + vr * 0.45);
        rv.mesh.rotation.x = -0.62;
        g.add(rv.mesh);
        updaters.push((t) => rv.update(t * 0.5));
        vents.push([vx, vh - 1.6, vz, vr]);
      }
      fxInfo = { falls, vents };
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
      // the great tree: the treehouse pods hang off its branches (built with the pods, so they sway)
      const tr = trunkSpot(W, H);
      const bm = new THREE.MeshStandardMaterial({ map: barkTex(), color: 0xb08a68, roughness: 0.95 });
      bm.map = bm.map.clone(); bm.map.needsUpdate = true; bm.map.repeat.set(5, 9);
      const tg = new THREE.CylinderGeometry(tr.r * 0.8, tr.r * 1.25, 46, 32, 40, true);
      const tp = tg.attributes.position;
      for (let i = 0; i < tp.count; i++) {
        const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i), a = Math.atan2(z, x);
        const k = 1 + 0.09 * Math.sin(a * 5 + y * 0.25) + 0.05 * Math.sin(a * 11 - y * 0.6) + (y < -18 ? (-18 - y) * 0.06 * (0.6 + 0.4 * Math.sin(a * 4)) : 0);
        tp.setXYZ(i, x * k, y, z * k);
      }
      tg.computeVertexNormals();
      const trunk = new THREE.Mesh(tg, bm);
      trunk.position.set(tr.x, -9, tr.z);
      trunk.castShadow = true; trunk.receiveShadow = true;
      g.add(trunk);
      // limbs up into the canopy
      for (const [dx, h, out] of [[-1, 6, 7], [1, 8, 8], [-0.3, 11, 4], [0.6, 4, 5]]) {
        g.add(branch([new THREE.Vector3(tr.x + dx * tr.r * 0.5, h - 3, tr.z), new THREE.Vector3(tr.x + dx * out * 0.5, h, tr.z - 0.5), new THREE.Vector3(tr.x + dx * out, h + 2.5, tr.z - 1.5)], 0.9, 0.3, bm));
        leafClump(g, tr.x + dx * out, h + 3, tr.z - 1.5, 26, 2.6, r, dx > 0 ? '#3f8f32' : '#4a9a38');
      }
      for (let i = 0; i < 9; i++) leafClump(g, tr.x + (r() - 0.5) * W * 1.2, 10 + r() * 4, tr.z - 2 - r() * 4, 30, 3, r, ['#3f8f32', '#357a2a', '#4a9a38'][i % 3]);
      // neighbouring trees in the haze, and two framing the kitchen at the sides
      for (let i = 0; i < 12; i++) {
        const side = i % 2 ? 1 : -1;
        const x = side * (W / 2 + 4 + r() * 10), z = -H / 2 - 6 + r() * (H + 8), rr = 0.6 + r() * 1.1;
        const t2 = part(cyl(14), bm, [x, -8, z], [rr, 40, rr]);
        g.add(t2);
        leafClump(g, x, 6 + r() * 6, z, 18, 2.4, r, ['#357a2a', '#2f6a26'][i % 2]);
      }
      // hanging lianas
      const vineM = mat(0x3a6a28, { rough: 0.8 });
      for (let i = 0; i < 16; i++) {
        const x = (r() - 0.5) * (W + 10), z = -H / 2 - 1.5 - r() * 3, len = 6 + r() * 8;
        const v = part(cyl(5), vineM, [x, 12 - len / 2, z], [0.04, len, 0.04]);
        g.add(v);
        updaters.push((t) => { v.rotation.z = Math.sin(t * 0.5 + i) * 0.03; });
      }
      // mist layers drifting in the depths below the pods, and the forest floor far down
      const mistT = mistTex();
      for (const [y, op, sp] of [[-5, 0.16, 0.004], [-10, 0.28, -0.003], [-16, 0.42, 0.002]]) {
        const t = mistT.clone(); t.needsUpdate = true; t.repeat.set(3, 3);
        const m = plane(0, y, { material: new THREE.MeshBasicMaterial({ map: t, color: 0xe8ffe0, transparent: true, opacity: op, depthWrite: false, fog: true }) });
        m.renderOrder = -1;
        updaters.push((tt) => { t.offset.x = tt * sp; t.offset.y = tt * sp * 0.6; });
      }
      plane(0x1a3416, -22, {});
      // the forest canopy far below the pods
      for (let i = 0; i < 26; i++) leafClump(g, (r() - 0.5) * (W + 14), -8 - r() * 7, (r() - 0.5) * (H + 10), 22, 2.8, r, ['#2f6a26', '#357a2a', '#3f8f32'][i % 3]);
      // sun shafts slanting through the canopy
      for (let i = 0; i < 3; i++) {
        const sh = part(new THREE.PlaneGeometry(2.2, 30), new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), [(i - 1) * W * 0.45 - 2, 0, -H / 2 - 3], 1, [0, 0.3, 0.45]);
        g.add(sh);
      }
      break;
    }
    case 'factory':
      fxInfo = buildFactory(g, L, W, H, r, updaters);
      break;
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
  if (ocean) updaters.push((t) => ocean.update(t));
  return { group: g, world, ocean, rival: rivalInfo, fx: fxInfo, update: (t) => updaters.forEach((f) => f(t)) };
}
