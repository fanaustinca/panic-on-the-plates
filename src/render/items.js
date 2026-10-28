// 3D models for every ingredient (raw / chopped / cooked / burnt), plates and the extinguisher,
// built from primitives with shared geometries and materials.
import * as THREE from 'three';
import { INGREDIENTS } from '../config.js';
import { shade } from './textures.js';

const mats = new Map();
export function mat(color, { rough = 0.55, metal = 0, emissive = 0, ei = 0, opacity = 1, flat = false } = {}) {
  const k = [color, rough, metal, emissive, ei, opacity, flat].join();
  if (!mats.has(k)) {
    mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity: ei, transparent: opacity < 1, opacity, flatShading: flat }));
  }
  return mats.get(k);
}
const geos = new Map();
const geo = (k, make) => { if (!geos.has(k)) geos.set(k, make()); return geos.get(k); };
const sph = (seg = 16) => geo('sph' + seg, () => new THREE.SphereGeometry(1, seg, Math.max(8, seg * 0.75)));
const cyl = (seg = 16, top = 1) => geo('cyl' + seg + top, () => new THREE.CylinderGeometry(top, 1, 1, seg));
const box = () => geo('box', () => new THREE.BoxGeometry(1, 1, 1));
const cone = (seg = 16) => geo('cone' + seg, () => new THREE.ConeGeometry(1, 1, seg));
const tor = () => geo('torus', () => new THREE.TorusGeometry(1, 0.28, 10, 24));
const capsule = () => geo('caps', () => new THREE.CapsuleGeometry(0.5, 1, 6, 12));
const ico = () => geo('ico', () => new THREE.IcosahedronGeometry(1, 0));
const dode = () => geo('dode', () => new THREE.DodecahedronGeometry(1, 0));

export function part(g, m, pos = [0, 0, 0], scl = [1, 1, 1], rot = [0, 0, 0]) {
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(...pos);
  mesh.scale.set(...(Array.isArray(scl) ? scl : [scl, scl, scl]));
  mesh.rotation.set(...rot);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Whole raw ingredient, ~0.36 units across, resting on y=0. */
function rawShape(I) {
  const g = new THREE.Group();
  const A = mat(I.c1), B = mat(I.c2), C = mat(I.c3);
  const add = (...a) => { const m = part(...a); g.add(m); return m; };
  switch (I.shape) {
    case 'fish':
      add(sph(), A, [0, 0.11, 0], [0.2, 0.1, 0.07]);
      add(sph(), B, [0, 0.08, 0], [0.17, 0.06, 0.072]);
      add(cone(4), C, [-0.24, 0.11, 0], [0.09, 0.1, 0.02], [0, 0, Math.PI / 2]);
      add(sph(8), mat(0x111111), [0.13, 0.13, 0.055], 0.018); add(sph(8), mat(0x111111), [0.13, 0.13, -0.055], 0.018);
      break;
    case 'tentacle':
      for (let i = 0; i < 6; i++) { const r = 0.07 - i * 0.008; add(sph(), A, [-0.15 + i * 0.06, 0.06 + Math.sin(i * 0.9) * 0.05, Math.cos(i) * 0.03], r); add(sph(8), B, [-0.15 + i * 0.06, 0.03 + Math.sin(i * 0.9) * 0.05, Math.cos(i) * 0.03 + r * 0.7], r * 0.35); }
      break;
    case 'potato':
      add(dode(), A, [0, 0.11, 0], [0.17, 0.11, 0.13]);
      for (let i = 0; i < 5; i++) add(cone(6), C, [Math.cos(i * 1.3) * 0.12, 0.16 + (i % 2) * 0.03, Math.sin(i * 1.3) * 0.09], [0.025, 0.04, 0.025]);
      break;
    case 'kelp':
      for (let i = 0; i < 4; i++) add(box(), i % 2 ? A : C, [(i - 1.5) * 0.06, 0.15, 0], [0.04, 0.3, 0.012], [0, 0, (i - 1.5) * 0.25]);
      add(sph(8), B, [0, 0.03, 0], [0.12, 0.03, 0.05]);
      break;
    case 'shrimp':
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 1.2; add(sph(), i % 2 ? A : B, [Math.cos(a) * 0.12, 0.08, Math.sin(a) * 0.12 - 0.05], 0.065 - i * 0.006); }
      add(cone(8), C, [-0.13, 0.08, 0.06], [0.04, 0.08, 0.04], [0, 0, 1.2]);
      break;
    case 'mushroom':
      add(cyl(), B, [0, 0.08, 0], [0.06, 0.16, 0.06]);
      add(sph(), A, [0, 0.17, 0], [0.17, 0.09, 0.17]);
      for (let i = 0; i < 4; i++) add(sph(8), C, [Math.cos(i * 1.6) * 0.09, 0.23, Math.sin(i * 1.6) * 0.09], 0.025);
      break;
    case 'corn':
      add(capsule(), A, [0, 0.08, 0], [0.13, 0.22, 0.13], [0, 0, Math.PI / 2]);
      add(cone(6), C, [-0.12, 0.09, 0.04], [0.06, 0.24, 0.02], [0.3, 0, Math.PI / 2 + 0.3]);
      add(cone(6), C, [-0.12, 0.09, -0.04], [0.06, 0.24, 0.02], [-0.3, 0, Math.PI / 2 + 0.3]);
      break;
    case 'drumbone':
      add(sph(), A, [0.04, 0.1, 0], [0.15, 0.1, 0.11]);
      add(cyl(), C, [-0.15, 0.08, 0], [0.025, 0.14, 0.025], [0, 0, Math.PI / 2]);
      add(sph(8), C, [-0.23, 0.09, 0.02], 0.035); add(sph(8), C, [-0.23, 0.07, -0.02], 0.035);
      break;
    case 'pepper':
      add(sph(), A, [0, 0.12, 0], [0.11, 0.13, 0.11]);
      add(cone(), A, [0, 0.0, 0], [0.09, 0.14, 0.09], [Math.PI, 0, 0]);
      add(cyl(), C, [0, 0.27, 0], [0.02, 0.07, 0.02], [0, 0, 0.3]);
      break;
    case 'steak':
      add(cyl(24), A, [0, 0.04, 0], [0.18, 0.07, 0.13]);
      add(tor(), B, [0, 0.06, 0], [0.16, 0.12, 0.13], [Math.PI / 2, 0, 0]);
      add(sph(8), C, [0.05, 0.08, 0.02], [0.05, 0.01, 0.04]);
      break;
    case 'root':
      add(cone(), A, [0, 0.07, 0], [0.08, 0.32, 0.08], [0, 0, Math.PI / 2]);
      add(cone(6), mat(0x4a8a3a), [0.2, 0.09, 0], [0.04, 0.12, 0.04], [0, 0, -Math.PI / 2]);
      break;
    case 'spore':
      add(ico(), A, [0, 0.12, 0], 0.13);
      for (let i = 0; i < 6; i++) { const v = new THREE.Vector3(Math.cos(i * 2.4), Math.sin(i * 1.7), Math.sin(i * 2.4)).normalize(); add(sph(8), B, [v.x * 0.13, 0.12 + v.y * 0.13, v.z * 0.13], 0.035); }
      break;
    case 'bean':
      for (let i = 0; i < 3; i++) add(capsule(), i === 1 ? C : A, [(i - 1) * 0.08, 0.05, (i % 2) * 0.05], [0.07, 0.08, 0.07], [Math.PI / 2, 0, i * 0.6]);
      break;
    case 'cheese': {
      const m = part(cyl(3), A, [0, 0.08, 0], [0.18, 0.16, 0.18]);
      g.add(m);
      for (let i = 0; i < 4; i++) add(sph(8), C, [Math.cos(i * 1.7) * 0.07, 0.17, Math.sin(i * 1.7) * 0.06], [0.03, 0.01, 0.03]);
      break;
    }
    case 'bread':
      add(capsule(), A, [0, 0.09, 0], [0.18, 0.16, 0.14], [0, 0, Math.PI / 2]);
      add(box(), C, [0, 0.09, 0], [0.12, 0.2, 0.19]);
      break;
    case 'tomato': case 'lemon': case 'mango': case 'melon': case 'starmelon': case 'nut': {
      const s = { tomato: [0.14, 0.12, 0.14], lemon: [0.14, 0.11, 0.11], mango: [0.15, 0.12, 0.11], melon: [0.17, 0.15, 0.17], starmelon: [0.17, 0.15, 0.17], nut: [0.11, 0.13, 0.11] }[I.shape];
      add(sph(20), A, [0, s[1], 0], s);
      if (I.shape === 'tomato' || I.shape === 'mango') add(cone(5), C, [0, s[1] * 2, 0], [0.06, 0.03, 0.06]);
      if (I.shape === 'lemon') { add(sph(8), C, [s[0], s[1], 0], 0.03); add(sph(8), C, [-s[0], s[1], 0], 0.03); }
      if (I.shape === 'melon' || I.shape === 'starmelon') for (let i = 0; i < 6; i++) add(tor(), C, [0, s[1], 0], [s[0] * 1.0, s[1] * 1.0, 0.08], [0, i * Math.PI / 6, 0]);
      if (I.shape === 'starmelon') for (let i = 0; i < 5; i++) add(sph(6), mat(0xffe14a, { emissive: 0xffe14a, ei: 0.8 }), [Math.cos(i * 1.3) * 0.15, 0.15 + Math.sin(i * 2.1) * 0.08, Math.sin(i * 1.3) * 0.15], 0.02);
      if (I.shape === 'nut') add(sph(12), C, [0, 0.24, 0], [0.12, 0.05, 0.12]);
      break;
    }
    case 'poultry':
      add(sph(), A, [0, 0.12, 0], [0.18, 0.12, 0.14]);
      add(cyl(), B, [0.17, 0.12, 0.07], [0.03, 0.14, 0.03], [0, 0, -1]);
      add(cyl(), B, [0.17, 0.12, -0.07], [0.03, 0.14, 0.03], [0, 0, -1]);
      add(sph(8), C, [0.23, 0.16, 0.07], 0.035); add(sph(8), C, [0.23, 0.16, -0.07], 0.035);
      break;
    case 'leek':
      add(cyl(), B, [0, 0.05, 0], [0.05, 0.3, 0.05], [0, 0, Math.PI / 2]);
      add(cyl(), A, [0.2, 0.06, 0], [0.055, 0.16, 0.055], [0, 0, Math.PI / 2]);
      add(cone(4), A, [0.33, 0.07, 0.03], [0.06, 0.16, 0.015], [0, 0.4, -Math.PI / 2]);
      break;
    case 'frogleg':
      add(capsule(), A, [0.02, 0.06, 0], [0.08, 0.16, 0.08], [0, 0, 1.2]);
      add(capsule(), A, [-0.1, 0.06, 0], [0.06, 0.14, 0.06], [0, 0, -0.9]);
      for (let i = -1; i <= 1; i++) add(sph(8), C, [-0.19, 0.02, i * 0.04], [0.035, 0.012, 0.02]);
      break;
    case 'bolt':
      add(cyl(6), A, [0, 0.05, 0], [0.11, 0.08, 0.11]);
      add(cyl(12), B, [0, 0.17, 0], [0.05, 0.18, 0.05]);
      for (let i = 0; i < 4; i++) add(tor(), C, [0, 0.11 + i * 0.035, 0], [0.055, 0.055, 0.04], [Math.PI / 2, 0, 0]);
      break;
    case 'crystal':
      for (let i = 0; i < 4; i++) add(cone(5), i % 2 ? A : B, [Math.cos(i * 1.6) * 0.06, 0.12, Math.sin(i * 1.6) * 0.06], [0.06, 0.26 - i * 0.03, 0.06], [Math.cos(i * 1.6) * 0.3, 0, Math.sin(i * 1.6) * 0.3]);
      break;
    case 'sack':
      add(sph(), A, [0, 0.12, 0], [0.15, 0.13, 0.13]);
      add(cyl(), C, [0, 0.25, 0], [0.06, 0.05, 0.06]);
      add(cone(), A, [0, 0.3, 0], [0.08, 0.06, 0.08], [Math.PI, 0, 0]);
      add(sph(8), B, [0, 0.31, 0], [0.06, 0.02, 0.06]);
      break;
    case 'cream':
      add(cyl(20), mat(0xf0e6d8, { rough: 0.2 }), [0, 0.07, 0], [0.11, 0.14, 0.11]);
      add(sph(), B, [0, 0.16, 0], [0.12, 0.06, 0.12]);
      add(cone(), B, [0, 0.21, 0], [0.06, 0.09, 0.06]);
      add(sph(8), C, [0, 0.27, 0], 0.025);
      break;
    default:
      add(sph(), A, [0, 0.12, 0], 0.13);
  }
  return g;
}

/** Chopped pieces: three wedges showing the inside colour. */
function chunks(I, tint) {
  const g = new THREE.Group();
  const A = mat(tint ? shade(I.c1, tint) : I.c1, { flat: true }), B = mat(tint ? shade(I.c2, tint) : I.c2, { flat: true });
  const pos = [[-0.09, 0.05, -0.04, 0.2], [0.08, 0.05, -0.05, 1.3], [0, 0.05, 0.08, 2.4]];
  for (const [x, y, z, r] of pos) {
    g.add(part(dode(), B, [x, y, z], [0.08, 0.055, 0.07], [0, r, 0]));
    g.add(part(box(), A, [x, y + 0.045, z], [0.11, 0.025, 0.09], [0, r, 0]));
  }
  return g;
}

function cookedShape(I) {
  const g = new THREE.Group();
  if (I.method === 'pan') {
    const c = chunks(I, -0.35);
    g.add(c);
    for (let i = 0; i < 3; i++) g.add(part(box(), mat(0x3a1e0e), [-0.08 + i * 0.08, 0.108, 0], [0.012, 0.004, 0.18], [0, 0.4, 0]));
  } else if (I.method === 'pot') {
    g.add(part(cyl(20), mat(0xf4efe6, { rough: 0.3 }), [0, 0.06, 0], [0.17, 0.12, 0.17]));
    g.add(part(cyl(20), mat(shade(I.c1, 0.15), { rough: 0.2 }), [0, 0.115, 0], [0.15, 0.01, 0.15]));
    for (let i = 0; i < 4; i++) g.add(part(dode(), mat(I.c2, { flat: true }), [Math.cos(i * 1.6) * 0.07, 0.125, Math.sin(i * 1.6) * 0.07], 0.035));
  } else {
    g.add(part(cyl(4), mat(0xd9d2c8, { rough: 0.4 }), [0, 0.05, 0], [0.2, 0.1, 0.2], [0, Math.PI / 4, 0]));
    g.add(part(box(), mat(shade(I.c1, -0.1)), [0, 0.105, 0], [0.24, 0.02, 0.24]));
    g.add(part(box(), mat(0xe8b05a), [0, 0.118, 0], [0.22, 0.012, 0.22]));
    for (let i = 0; i < 4; i++) g.add(part(sph(8), mat(0xb8702a), [Math.cos(i * 1.6) * 0.06, 0.125, Math.sin(i * 1.6) * 0.06], [0.03, 0.01, 0.03]));
  }
  return g;
}

function burntShape() {
  const g = new THREE.Group();
  const M = mat(0x1d1a18, { rough: 0.95, flat: true });
  for (const [x, z, r] of [[-0.08, -0.03, 0.2], [0.07, -0.04, 1.4], [0, 0.07, 2.4]]) g.add(part(dode(), M, [x, 0.05, z], [0.09, 0.06, 0.08], [r, r, 0]));
  return g;
}

export function makeIngredient(ingId, state = 'raw') {
  const I = INGREDIENTS[ingId];
  const g = state === 'raw' ? rawShape(I) : state === 'chopped' ? chunks(I) : state === 'cooked' ? cookedShape(I) : burntShape();
  g.userData.kind = 'ing';
  return g;
}

export function makePlate({ c = [], dirty = false, n = 1 } = {}) {
  const g = new THREE.Group();
  const plateM = dirty ? mat(0xc9bfa8, { rough: 0.8 }) : mat(0xffffff, { rough: 0.25 });
  for (let i = 0; i < Math.min(n, 6); i++) {
    g.add(part(cyl(28), plateM, [0, 0.015 + i * 0.035, 0], [0.24, 0.03, 0.24]));
    g.add(part(tor(), dirty ? mat(0xa8977a) : mat(0xe8eef5, { rough: 0.25 }), [0, 0.03 + i * 0.035, 0], [0.22, 0.22, 0.06], [Math.PI / 2, 0, 0]));
    if (dirty) g.add(part(sph(8), mat(0x7a5a3a, { rough: 1 }), [0.06, 0.035 + i * 0.035, 0.04], [0.06, 0.006, 0.04]));
  }
  const top = 0.035 + (Math.min(n, 6) - 1) * 0.035;
  const k = c.length;
  c.forEach((it, i) => {
    const m = makeIngredient(it.ing, it.s);
    const a = (i / Math.max(1, k)) * Math.PI * 2 + 0.6;
    const r = k > 1 ? 0.1 : 0;
    m.position.set(Math.cos(a) * r, top, Math.sin(a) * r);
    m.scale.setScalar(k > 2 ? 0.6 : k > 1 ? 0.72 : 0.9);
    g.add(m);
  });
  g.userData.kind = 'plate';
  return g;
}

export function makeExtinguisher() {
  const g = new THREE.Group();
  const red = mat(0xd8262a, { rough: 0.35, metal: 0.2 });
  g.add(part(capsule(), red, [0, 0.22, 0], [0.16, 0.26, 0.16]));
  g.add(part(cyl(), mat(0x222222), [0, 0.42, 0], [0.04, 0.06, 0.04]));
  g.add(part(box(), mat(0x222222, { metal: 0.6, rough: 0.3 }), [0.05, 0.46, 0], [0.12, 0.025, 0.04]));
  g.add(part(cyl(8), mat(0x222222), [-0.07, 0.38, 0], [0.018, 0.16, 0.018], [0, 0, 0.9]));
  g.add(part(cyl(12), mat(0xffffff), [0, 0.3, 0.08], [0.05, 0.01, 0.05], [Math.PI / 2, 0, 0]));
  g.add(part(box(), mat(0xffffff), [0, 0.18, 0.082], [0.1, 0.08, 0.004]));
  g.userData.kind = 'ext';
  return g;
}

/** Build a mesh for any sim item value. */
export function makeItem(it) {
  if (!it) return null;
  if (it.kind === 'ing') return makeIngredient(it.ing, it.s);
  if (it.kind === 'plate') return makePlate(it);
  if (it.kind === 'ext') return makeExtinguisher();
  return null;
}
export const itemKey = (it) => (it ? (it.kind === 'ing' ? `i:${it.ing}:${it.s}` : it.kind === 'plate' ? `p:${it.n}:${it.dirty ? 1 : 0}:${it.c.map((c) => c.ing + c.s).join(',')}` : it.kind) : '');
export { sph, cyl, box, cone, tor, capsule, ico, dode };
