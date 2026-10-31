// Per-world backdrop: what you see in the gaps and around the kitchen (sea, lava, space, sky...).
import * as THREE from 'three';
import { mat, part, sph, cyl, box, cone, tor, capsule, ico, dode } from './items.js';
import { glowTex, barkTex } from './textures.js';
import { branch, leafClump, jungleTree, vine, swayVines } from './treehouse.js';
import { buildShip, WATERLINE } from './ship.js';
import { makeOcean } from './ocean.js';
import { makeLava } from './lava.js';
import { buildFactory } from './factory.js';
import { basaltIslands, glacierIslands, cloudIslands, stationModules, clockIslands, makeGear } from './islands.js';

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

/** Cloudy blue-green planet for the space station's view. */
function earthTex(r) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#1a4a8a'; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 26; i++) {
    const x = r() * 1024, y = 90 + r() * 330, rr = 30 + r() * 90;
    g.fillStyle = ['#3a7a3a', '#5a8a3a', '#a89a6a'][i % 3];
    g.beginPath();
    for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2, d = rr * (0.6 + r() * 0.5); g.lineTo(x + Math.cos(a) * d * 1.4, y + Math.sin(a) * d); }
    g.fill();
  }
  g.fillStyle = '#f2f6fa'; g.fillRect(0, 0, 1024, 34); g.fillRect(0, 478, 1024, 34);
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.4})`; g.beginPath(); g.ellipse(r() * 1024, r() * 512, 20 + r() * 70, 5 + r() * 12, (r() - 0.5) * 0.4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The clock tower's great dial: frosted glass lit from behind, Roman numerals, minute ticks. */
function dialTex() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d'), m = 512;
  const grd = g.createRadialGradient(m, m, 40, m, m, m);
  grd.addColorStop(0, '#fff2d0'); grd.addColorStop(0.8, '#f2c880'); grd.addColorStop(1, '#c08a40');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 1024);
  g.strokeStyle = 'rgba(90,60,20,0.35)'; g.lineWidth = 6;
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.beginPath(); g.moveTo(m + Math.cos(a) * 120, m + Math.sin(a) * 120); g.lineTo(m + Math.cos(a) * 500, m + Math.sin(a) * 500); g.stroke(); }
  for (const rr of [120, 300, 380]) { g.beginPath(); g.arc(m, m, rr, 0, 7); g.stroke(); }
  g.fillStyle = '#2a1a0a';
  for (let k = 0; k < 60; k++) { const a = (k / 60) * Math.PI * 2; const l = k % 5 ? 14 : 34; g.save(); g.translate(m + Math.cos(a) * 470, m + Math.sin(a) * 470); g.rotate(a); g.fillRect(-l, -3, l, 6); g.restore(); }
  g.font = '700 82px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((n, k) => { const a = (k / 12) * Math.PI * 2 - Math.PI / 2; g.fillText(n, m + Math.cos(a) * 385, m + Math.sin(a) * 385); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const STYLE = {
  pirate: { floor: 'planks', wall: 'hull', top: 'wood', side: 0x7a4a26, trim: 0x3a2a1a, light: 0xfff2dc, hemi: [0xbfe3ff, 0x6a4a2a], sun: 2.6, amb: 1.0, exposure: 1.05 },
  glacier: { floor: 'ice', wall: 'snowbrick', top: 'ice', side: 0x8fc0da, trim: 0x5a98bc, light: 0xf2f8ff, hemi: [0xe6f6ff, 0x7aa8c8], sun: 2.4, amb: 1.1, exposure: 1.0 },
  volcano: { floor: 'basalt', wall: 'obsidian', top: 'stone', side: 0x2e2628, trim: 0xff6a20, light: 0xffc890, hemi: [0xff8a50, 0x2a0a06], sun: 2.2, amb: 0.8, exposure: 1.15 },
  space: { floor: 'metalgrid', wall: 'hullpanel', top: 'panel', side: 0xaab4c2, trim: 0x2ad0ff, light: 0xe8f0ff, hemi: [0x8aa8ff, 0x1a1a2a], sun: 2.6, amb: 0.85, exposure: 1.1 },
  clouds: { floor: 'cloudtile', wall: 'marble', top: 'marble', side: 0xb8c8f0, trim: 0xd8b050, light: 0xfff6e6, hemi: [0xdfe9ff, 0xb8a8d8], sun: 2.5, amb: 1.1, exposure: 1.0 },
  jungle: { floor: 'treeplanks', wall: 'logs', top: 'wood', side: 0x7a5a2a, trim: 0x3a7a2a, light: 0xfff0c8, hemi: [0xcfffb0, 0x3a5a2a], sun: 2.4, amb: 1.0, exposure: 1.05 },
  factory: { floor: 'steelplate', wall: 'brickfactory', top: 'steel', side: 0x56606c, trim: 0xffc020, light: 0xfff0dc, hemi: [0xcfd8e6, 0x3a3a3a], sun: 2.4, amb: 0.95, exposure: 1.05 },
  library: { floor: 'clockfloor', wall: 'clockwall', top: 'brass', side: 0x5a3420, trim: 0xd8a84a, light: 0xffe0b0, hemi: [0xffd8a8, 0x3a2414], sun: 2.3, amb: 0.95, exposure: 1.12 },
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
      if (L) glacierIslands(g, L, r);
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
      // every zone is its own basalt island standing in the lava
      if (L) basaltIslands(g, L, r);
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
      // the Earth far below the station, with a soft atmosphere halo
      const planet = new THREE.Mesh(new THREE.SphereGeometry(40, 64, 40), new THREE.MeshStandardMaterial({ map: earthTex(r), roughness: 0.9, emissive: 0x0a2050, emissiveIntensity: 0.25 }));
      planet.position.set(W * 0.4, -52, -30);
      g.add(planet);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x5ab0ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(104); halo.position.copy(planet.position);
      g.add(halo);
      updaters.push((t) => { planet.rotation.y = t * 0.01; });
      if (L) stationModules(g, L, r, updaters);
      break;
    }
    case 'clouds': {
      plane(0, -12, { material: new THREE.MeshStandardMaterial({ color: 0x7a9ce0, roughness: 1 }) });
      const puff = mat(0xffffff, { rough: 1 });
      scatter(26, 0.9, 2.8, (x, z, i) => {
        const cg = new THREE.Group();
        for (let k = 0; k < 4; k++) cg.add(part(sph(14), puff, [(k - 1.5) * 0.9, r() * 0.3, r() * 0.6], 0.7 + r() * 0.6));
        cg.position.set(x, -5 - r() * 3, z);
        g.add(cg);
        updaters.push((t) => { cg.position.x = x + Math.sin(t * 0.2 + i) * 0.6; });
      });
      // every zone sits on its own cloud
      if (L) cloudIslands(g, L, r, updaters);
      const balloon = new THREE.Group();
      balloon.add(part(sph(20), mat(0xe8553a), [0, 0, 0], [1, 1.2, 1]));
      balloon.add(part(box(), mat(0x8a5a2a), [0, -1.8, 0], 0.5));
      balloon.position.set(-W / 2 - 3, 3, -H / 2 - 2);
      g.add(balloon);
      updaters.push((t) => { balloon.position.y = 3 + Math.sin(t * 0.6) * 0.4; });
      break;
    }
    case 'jungle': {
      // the great tree itself rises through the middle of the kitchen (render/treehouse.js)
      // neighbouring trees in the haze: slender trunks, tiers of small leafy branches, swinging lianas
      const vines = [];
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? 1 : -1;
        const x = side * (W / 2 + 4 + r() * 9), z = -H / 2 - 4 - r() * 12;
        jungleTree(g, x, z, -16, 22 + r() * 6, r, vines);
      }
      // lianas hanging from the canopy above, behind the kitchen
      for (let i = 0; i < 14; i++) vines.push(vine(g, (r() - 0.5) * (W + 10), 9, -H / 2 - 1.5 - r() * 3, 4 + r() * 6, r));
      updaters.push((t) => swayVines(vines, t));
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
      // inside a clock tower: platforms on the works, a huge backlit dial, gears and a pendulum
      plane(0x140c08, -16, {});
      const gears = L ? clockIslands(g, L, r) : [];
      // far below the platforms: the face of the great clock itself, lying flat, its hands sweeping
      // round underneath the kitchen (the minute hand goes round once a minute)
      {
        const R = Math.max(W, H) * 0.85 + 4;
        const face = new THREE.Group();
        face.position.set(0, -8.5, 0);
        face.add(part(new THREE.CircleGeometry(R, 72), new THREE.MeshStandardMaterial({ map: dialTex(), color: 0x7a5a3a, roughness: 0.7 }), [0, 0, 0], 1, [-Math.PI / 2, 0, Math.PI]));
        face.add(part(new THREE.TorusGeometry(R + 0.3, 0.5, 10, 96), mat(0xc8964a, { metal: 0.85, rough: 0.32 }), [0, 0, 0], 1, [Math.PI / 2, 0, 0]));
        const handM = mat(0x1a120c, { metal: 0.6, rough: 0.4 });
        const mk = (len, wid) => { const hg = new THREE.Group(); hg.add(part(box(), handM, [0, 0.15, -len / 2], [wid, 0.12, len])); hg.add(part(box(), handM, [0, 0.15, -len], [wid * 2.2, 0.12, wid * 2.2], [0, Math.PI / 4, 0])); face.add(hg); return hg; };
        const minH = mk(R * 0.82, 0.7), hourH = mk(R * 0.55, 1.1), secH = mk(R * 0.9, 0.18);
        face.add(part(cyl(24), mat(0xc8964a, { metal: 0.85, rough: 0.32 }), [0, 0.25, 0], [1.2, 0.3, 1.2]));
        g.add(face);
        updaters.push((t) => { secH.rotation.y = -Math.floor(t) * Math.PI / 30; minH.rotation.y = -t * Math.PI / 300 - 0.6; hourH.rotation.y = -t * Math.PI / 3600 - 2; });
        // a faint warm glow pooled on the face
        const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffa040, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
        fl.scale.setScalar(R * 1.6); fl.position.set(0, -8, 0);
        g.add(fl);
      }
      updaters.push((t) => gears.forEach((gr, i) => { gr.rotation.y = t * (i % 2 ? -0.12 : 0.15); }));
      const brass = mat(0xc8964a, { metal: 0.85, rough: 0.32 }), brassD = mat(0x8a6430, { metal: 0.8, rough: 0.4 }), iron = mat(0x3a3a3e, { metal: 0.8, rough: 0.4 });
      const zb = -H / 2;
      // the dial: glass lit from the street outside, Roman numerals, hands that really go round
      const dial = new THREE.Group();
      dial.position.set(0, 3.2, zb - 7.5);
      dial.add(part(new THREE.CircleGeometry(7.2, 64), new THREE.MeshBasicMaterial({ map: dialTex(), toneMapped: false })));
      dial.add(part(new THREE.TorusGeometry(7.3, 0.35, 10, 72), brass));
      dial.add(part(new THREE.TorusGeometry(7.9, 0.2, 8, 72), brassD));
      const hourH = new THREE.Group(), minH = new THREE.Group();
      hourH.add(part(box(), iron, [0, 2, 0.15], [0.32, 4.2, 0.08]));
      minH.add(part(box(), iron, [0, 2.9, 0.25], [0.2, 6, 0.08]));
      dial.add(hourH, minH, part(cyl(20), brass, [0, 0, 0.3], [0.45, 0.2, 0.45], [Math.PI / 2, 0, 0]));
      g.add(dial);
      const shaft = part(new THREE.PlaneGeometry(9, 26), new THREE.MeshBasicMaterial({ color: 0xffd090, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), [0, -2, zb - 3], 1, [-1.1, 0, 0]);
      g.add(shaft);
      updaters.push((t) => { minH.rotation.z = -t * Math.PI * 2 / 60; hourH.rotation.z = -t * Math.PI * 2 / 720 - 1.2; });
      // giant gears turning in the walls and the depths
      const big = [];
      for (const [x, y, z, R, axis, sp] of [[-W / 2 - 5, 1, zb - 3, 4.2, 'z', 0.1], [-W / 2 - 1.5, -3.5, zb - 4.5, 2.6, 'z', -0.16], [W / 2 + 5, 2.5, zb - 2.5, 3.6, 'z', -0.12], [W / 2 + 2.2, -2.4, zb - 4.6, 2.2, 'z', 0.2]]) {
        const gr = makeGear(R, Math.round(R * 8), 0.4, r() < 0.5 ? brass : brassD, 6);
        gr.position.set(x, y, z);
        if (axis === 'z') gr.rotation.x = Math.PI / 2;
        g.add(gr);
        big.push({ gr, axis, sp });
      }
      updaters.push((t) => big.forEach((b) => { if (b.axis === 'z') b.gr.rotation.y = t * b.sp; else b.gr.rotation.y = t * b.sp; }));
      // the pendulum swinging far below the kitchen
      const pend = new THREE.Group();
      pend.position.set(0, 2, zb - 2);
      pend.add(part(box(), brassD, [0, -4.5, 0], [0.16, 9, 0.16]));
      pend.add(part(cyl(40), brass, [0, -9.2, 0], [1.6, 0.4, 1.6], [Math.PI / 2, 0, 0]));
      g.add(pend);
      updaters.push((t) => { pend.rotation.z = Math.sin(t * Math.PI * 2 / 4) * 0.32; });
      // hanging weights on chains, and the tower walls in the gloom
      for (const [x, z, l] of [[-W / 2 - 2.5, zb + 2, 9], [W / 2 + 2.8, zb + 4, 7], [-W / 2 - 3.5, H / 2 - 1, 11]]) {
        g.add(part(cyl(6), iron, [x, 8 - l / 2, z], [0.06, l + 8, 0.06]));
        g.add(part(cyl(14), brassD, [x, 4 - l / 2 - 1, z], [0.45, 1.6, 0.45]));
      }
      for (const s2 of [-1, 1]) g.add(part(box(), mat(0x2a1a10, { rough: 0.9 }), [s2 * (W / 2 + 11), 0, -4], [2, 40, 50]));
      g.add(part(box(), mat(0x2a1a10, { rough: 0.9 }), [0, 0, zb - 9], [W + 30, 40, 1]));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffc070, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(22); glow.position.set(0, 3.2, zb - 7.3);
      g.add(glow);
      break;
    }
  }
  if (ocean) updaters.push((t) => ocean.update(t));
  return { group: g, world, ocean, rival: rivalInfo, fx: fxInfo, update: (t) => updaters.forEach((f) => f(t)) };
}
