// Whole (raw) ingredient models. Every food is modelled from its real-world counterpart: parametric
// surfaces with hand-placed profiles, organic lumps from noise, per-vertex colour (blush, speckles,
// stripes, marbling) and fine surface relief from bump maps. Models lie along x (the knife cuts across
// x), rest on y = 0 and are roughly 0.36 units long. Parts flagged noslice (fins, leaves, antennae) don't
// count towards the cross-section the slices are built from.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TAU, clamp, lerp, smooth, noise, fbm, rng, col, mixc, shadeC, surf, revolve, along, profile, tube, capped, ip, fmat, bumpTex, ctex, css } from './geo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const curve = (pts, closed = false) => new THREE.CatmullRomCurve3(pts.map((p) => V(...p)), closed, 'centripetal');
function add(g, geo, m, o = {}) {
  const mesh = new THREE.Mesh(geo, m);
  if (o.p) mesh.position.set(...o.p);
  if (o.r) mesh.rotation.set(...o.r);
  if (o.s != null) mesh.scale.set(...(Array.isArray(o.s) ? o.s : [o.s, o.s, o.s]));
  mesh.castShadow = o.shadow !== false; mesh.receiveShadow = true;
  if (o.ns) mesh.userData.noslice = true;
  g.add(mesh);
  return mesh;
}
/** small noise jitter on a colour */
const jit = (C, p, f = 40, k = 0.18) => shadeC(C, (fbm(p[0] * f * 0.6 + 3.1, p[1] * f * 0.6, p[2] * f * 0.6) - 0.5) * k);
/** place geometry copies (transforms) and merge them into one */
function scatter(base, mats) { return mergeGeometries(mats.map((m) => base.clone().applyMatrix4(m))); }
const basis = (pos, normal, spin = 0, scl = 1) => {
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), normal.clone().normalize());
  q.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), spin));
  return new THREE.Matrix4().compose(pos, q, Array.isArray(scl) ? V(...scl) : V(scl, scl, scl));
};
/** solid colour attribute for a geometry */
function paint(geo, fn) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const C = fn([p.getX(i), p.getY(i), p.getZ(i)], i); c.set([C.r, C.g, C.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
/** ellipsoid blob around the origin: radii, noise lumps, colour */
function blob(rx, ry, rz, { lump = 0, lf = 3, seed = 0, color, nu = 36, nv = 24, mod = null } = {}) {
  return surf((u, v) => {
    const t = u * TAU, f = v * Math.PI;
    const d = [Math.sin(f) * Math.cos(t), -Math.cos(f), Math.sin(f) * Math.sin(t)];
    let k = 1 + (lump ? (fbm(d[0] * lf + seed, d[1] * lf, d[2] * lf + seed) - 0.5) * 2 * lump : 0);
    if (mod) k *= mod(d, u, v);
    return [d[0] * rx * k, d[1] * ry * k, d[2] * rz * k];
  }, { nu, nv, color });
}
/** a thin leaf: length along +x from the origin, width w, slight cup and droop. tilt etc. via transform */
function leaf(len, w, C, { cup = 0.25, droop = 0.2, nu = 6, nv = 16, vein = 0.25, tip = 1.4 } = {}) {
  return surf((u, v) => {
    const s = u * 2 - 1, half = w * Math.pow(Math.sin(Math.PI * clamp(v * 0.92 + 0.04)), 0.8) * (1 - v * 0.15);
    return [v * len, -droop * len * v * v + Math.abs(s) * half * cup, s * half];
  }, { nu, nv, color: (u, v, p) => { const s = Math.abs(u * 2 - 1); return shadeC(jit(C, p, 60, 0.1), s < 0.08 ? vein : -0.12 * s + (Math.abs(Math.sin(v * 30 + s * 6)) < 0.08 ? 0.08 : 0)); } });
}

// ---------------------------------------------------------------- the foods
export const RAW = {
  fish(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2), D = col(I.c3);
    const x0 = -0.165, x1 = 0.175, th = 0.42;
    const R = ip([[x0, 0.012], [-0.14, 0.022], [-0.08, 0.046], [0.0, 0.069], [0.06, 0.07], [0.12, 0.054], [0.155, 0.033], [x1, 0.0]]);
    const at = (x) => Math.max(0, R(x));
    const body = surf((u, v) => {
      const x = lerp(x0, x1, v), r = at(x), t = u * TAU;
      const belly = Math.cos(t) < 0 ? 0.95 : 1;
      return [x, 0.004 + r * th + Math.sin(t) * r * th, Math.cos(t) * r * belly];
    }, { nu: 40, nv: 44, uv: [8, 12], color: (u, v, p) => {
      const d = Math.cos(u * TAU), x = p[0];
      let C = d > 0 ? mixc(A, D, smooth(0.0, 0.8, d)) : mixc(A, B, smooth(-0.05, -0.55, d));
      if (d > 0.25 && noise(x * 70, p[2] * 70, 2.5) > 0.7) C = shadeC(C, -0.45);
      if (Math.abs(d - 0.06) < 0.03 && Math.sin(x * 260) > -0.2) C = shadeC(C, -0.22);
      const gx = 0.098 - 0.014 * d * d;
      if (x > gx) C = mixc(C, 0xb89a6a, 0.12);
      if (Math.abs(x - gx) < 0.0035) C = shadeC(C, -0.5);
      if (x > 0.16 && Math.abs(d + 0.05) < 0.1) C = shadeC(C, -0.6);
      return jit(C, p, 30, 0.1);
    } });
    add(g, body, fmat('fish', { rough: 0.28, clear: 0.9, clearRough: 0.15, bump: bumpTex('scales', [8, 12]), bumpScale: 0.7, iri: 0.25 }));
    const top = (x) => 0.004 + at(x) * th * 2;
    // eye
    const ex = 0.133, ey = top(ex) - 0.004, ez = 0.012;
    add(g, blob(0.017, 0.008, 0.017, { color: () => col(0xf0e8d0) }), fmat('eyewhite', { rough: 0.15, clear: 1 }), { p: [ex, ey, ez], ns: true });
    add(g, blob(0.0115, 0.006, 0.0115, { color: () => col(0xc89a3a) }), fmat('iris', { rough: 0.1, clear: 1 }), { p: [ex, ey + 0.004, ez], ns: true });
    add(g, blob(0.0075, 0.0045, 0.0075, { color: () => col(0x050505) }), fmat('pupil', { rough: 0.05, clear: 1 }), { p: [ex, ey + 0.007, ez], ns: true });
    const finM = fmat('fin', { rough: 0.35, clear: 0.6, side: 'double', opacity: 0.92 });
    const finC = (u, v, p) => { let C = mixc(D, B, v * 0.5); if (Math.abs(Math.sin(u * 46)) < 0.25) C = shadeC(C, -0.3); return C; };
    // tail: forked fan
    add(g, surf((u, v) => { const s = u * 2 - 1; const fork = 1 - 0.38 * (1 - s * s) * v; return [x0 + 0.01 - v * 0.08 * fork, top(x0) * 0.5 + 0.003 * Math.sin(s * 9) * v, s * (0.012 + v * 0.07)]; }, { nu: 16, nv: 8, color: finC }), finM, { ns: true });
    // dorsal fin along the upper edge, anal fin below
    add(g, surf((u, v) => { const x = lerp(-0.075, 0.05, u); const h = 0.034 * Math.pow(Math.sin(Math.PI * u), 0.7) * (1 - 0.35 * u) * v; return [x - v * 0.012, top(x) * 0.5, at(x) - 0.003 + h + 0.003 * Math.sin(u * 60) * v * v]; }, { nu: 20, nv: 5, color: finC }), finM, { ns: true });
    add(g, surf((u, v) => { const x = lerp(-0.1, -0.03, u); const h = 0.022 * Math.sin(Math.PI * u) * v; return [x - v * 0.01, top(x) * 0.5, -(at(x) * 0.95 - 0.003 + h)]; }, { nu: 12, nv: 4, color: finC }), finM, { ns: true });
    // pectoral fin lying against the flank
    add(g, surf((u, v) => { const s = u * 2 - 1; return [0.088 - v * 0.05, top(0.07) + 0.002 + v * 0.004, -0.012 + s * 0.012 * v - v * 0.008]; }, { nu: 8, nv: 6, color: finC }), finM, { ns: true });
    return g;
  },

  tentacle(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2), C3 = col(I.c3);
    const cv = curve([[-0.17, 0, 0.03], [-0.09, 0, -0.03], [0.0, 0, -0.025], [0.07, 0, 0.03], [0.13, 0, 0.055], [0.168, 0, 0.02], [0.152, 0, -0.018], [0.124, 0, -0.006], [0.13, 0, 0.012]]);
    const rad = capped((v) => lerp(0.05, 0.006, Math.pow(v, 0.8)), 0.02, 0.03), sq = 0.72;
    const body = tube(cv, rad, { squash: [1, sq], lift: (v) => rad(v) * sq + 0.002, nu: 28, nv: 90, color: (u, v, p) => {
      const up = Math.sin(u * TAU);
      let C = up > -0.25 ? A : mixc(A, C3, smooth(-0.25, -0.6, up));
      if (up > -0.2 && noise(p[0] * 55, p[2] * 55, 7) > 0.66) C = shadeC(C, -0.3);
      if (up > 0.5) C = shadeC(C, 0.06);
      return jit(C, p, 50, 0.1);
    } });
    add(g, body, fmat('tentacle', { rough: 0.22, clear: 1, clearRough: 0.1, bump: bumpTex('skin', [10, 30]), bumpScale: 0.4 }));
    // suckers along the outer side, in two staggered rows, sized to the arm
    const cup = revolve(profile([[0.0, 0.25], [0.45, 0.3], [0.85, 0.55], [1.0, 0.3], [0.95, 0.0]]), { nu: 14, nv: 6, color: (u, v) => (v < 0.35 ? shadeC(B, -0.2) : B) });
    const ms = [], T = V(), N = V(), Bv = V(), P = V();
    for (let i = 0; i < 26; i++) {
      const v = 0.06 + i * 0.033;
      if (v > 0.92) break;
      cv.getPointAt(v, P); cv.getTangentAt(v, T);
      N.crossVectors(V(0, 1, 0), T).normalize(); Bv.crossVectors(T, N).normalize();
      const r = rad(v), a = -0.35 + (i % 2 ? 0.45 : -0.1);
      const nrm = N.clone().multiplyScalar(Math.cos(a)).addScaledVector(Bv, Math.sin(a) * sq);
      const pos = P.clone().addScaledVector(N, Math.cos(a) * r * 0.96).addScaledVector(Bv, Math.sin(a) * r * sq * 0.96);
      pos.y += rad(v) * sq + 0.002;
      ms.push(basis(pos, nrm, 0, [r * 0.38, r * 0.22, r * 0.38]));
    }
    add(g, scatter(cup, ms), fmat('sucker', { rough: 0.3, clear: 0.8 }), { ns: true });
    return g;
  },

  potato(I) {
    const g = new THREE.Group(), A = col(I.c1), C3 = col(I.c3);
    const r = rng(4);
    const eyes = Array.from({ length: 7 }, () => V(r() * 2 - 1, r() * 1.4 - 0.4, r() * 2 - 1).normalize());
    const eyeAt = (d) => eyes.reduce((m, e) => Math.max(m, Math.exp(-(1 - (d[0] * e.x + d[1] * e.y + d[2] * e.z)) / 0.004)), 0);
    const geo = blob(0.155, 0.092, 0.112, { lump: 0.07, lf: 2.2, seed: 2, nu: 48, nv: 32, mod: (d) => 1 - eyeAt(d) * 0.07 + Math.max(0, -d[1] - 0.8) * -0.25,
      color: (u, v, p) => {
        const d = V(...p).normalize().toArray();
        let C = jit(A, p, 25, 0.14);
        if (noise(p[0] * 90, p[1] * 90, p[2] * 90) > 0.72) C = shadeC(C, -0.35);
        if (fbm(p[0] * 9, p[1] * 9, p[2] * 9 + 5) > 0.62) C = mixc(C, 0x5a4028, 0.35);
        const e = eyeAt(d);
        if (e > 0.25) C = mixc(C, 0x6a3a2a, e * 0.8);
        return C;
      } });
    add(g, geo, fmat('potato', { rough: 0.85, bump: bumpTex('skin', [6, 4]), bumpScale: 1.2 }), { p: [0, 0.088, 0] });
    // barnacles: little volcano shells with plates and a dark slit
    const shell = revolve(profile([[1.0, 0.0], [0.92, 0.4], [0.62, 0.9], [0.42, 1.0], [0.28, 0.75], [0.1, 0.6]]), { nu: 18, nv: 10, mod: (u, v, t) => 1 + 0.08 * Math.cos(6 * t), color: (u, v, p) => (v > 0.8 ? shadeC(C3, -0.6) : jit(mixc(C3, 0xffffff, 0.2 - v * 0.2), p, 200, 0.2)) });
    const ms = [];
    [[0.3, 0.85, 0.2, 0.024], [0.55, 0.7, 0.3, 0.018], [-0.35, 0.8, 0.45, 0.02], [0.15, 0.6, -0.75, 0.016], [-0.6, 0.55, -0.35, 0.013]].forEach(([x, y, z, s]) => {
      const d = V(x, y, z).normalize();
      const pos = V(d.x * 0.15, d.y * 0.088 + 0.088, d.z * 0.11).multiplyScalar(0.985);
      ms.push(basis(pos, V(d.x / 0.15, d.y / 0.09, d.z / 0.11), x * 9, [s, s * 0.8, s]));
    });
    add(g, scatter(shell, ms), fmat('barnacle', { rough: 0.7 }), { ns: true });
    return g;
  },

  kelp(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2), C3 = col(I.c3);
    const m = fmat('kelp', { rough: 0.3, clear: 0.8, clearRough: 0.2, side: 'double' });
    [[0.0, 0.0, 1, 0.006], [0.03, 0.5, -1, 0.012], [-0.03, 1.1, 1, 0.018]].forEach(([z0, ph, dir, y0]) => {
      add(g, surf((u, v) => {
        const s = u * 2 - 1, x = -0.17 + 0.37 * v;
        const w = 0.042 * Math.pow(Math.sin(Math.PI * clamp(v * 1.05)), 0.45) * (1 - 0.25 * v);
        const ruffle = s * s * 0.011 * Math.sin(v * 70 + ph * 5 + s * 2);
        return [x, y0 + ruffle + 0.004 * (1 - s * s), z0 + dir * Math.sin(v * 2.2 + ph) * 0.018 + s * w];
      }, { nu: 10, nv: 60, color: (u, v, p) => {
        const s = Math.abs(u * 2 - 1);
        let C = s < 0.12 ? mixc(A, B, 0.45) : mixc(A, C3, s * 0.7);
        if (Math.abs(Math.sin(v * 140 + s * 4)) < 0.1) C = shadeC(C, -0.12);
        return jit(mixc(C, 0x7a6a2a, smooth(0.8, 1, v) * 0.4), p, 70, 0.1);
      } }), m);
    });
    // the stipe and its float bladder
    add(g, tube(curve([[-0.24, 0.02, 0.004], [-0.2, 0.014, 0.0], [-0.16, 0.012, 0.0]]), capped(() => 0.008, 0.1, 0.02), { nu: 10, nv: 12, color: () => shadeC(A, -0.2) }), m);
    add(g, blob(0.024, 0.021, 0.022, { lump: 0.04, color: (u, v, p) => jit(mixc(A, 0x6a5a1a, 0.3), p, 40, 0.15) }), fmat('kelpfloat', { rough: 0.2, clear: 1 }), { p: [-0.25, 0.022, 0.006] });
    // a twine tie round the bundle
    const tie = tube(curve(Array.from({ length: 13 }, (_, i) => { const a = i / 12 * TAU; return [0, Math.sin(a) * 0.016 + 0.016, Math.cos(a) * 0.062]; }), true), () => 0.0035, { nu: 8, nv: 40, color: (u, v) => mixc(0xc8a870, 0x8a6a40, Math.abs(Math.sin(v * 120 + u * TAU))) });
    add(g, tie, fmat('twine', { rough: 0.9 }), { p: [-0.11, 0, 0], ns: true });
    return g;
  },

  shrimp(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2), C3 = col(I.c3);
    const cv = curve([[0.135, 0, -0.035], [0.1, 0, 0.05], [0.02, 0, 0.085], [-0.06, 0, 0.065], [-0.105, 0, 0.0], [-0.09, 0, -0.06], [-0.055, 0, -0.085]]);
    const rad = capped(ip([[0, 0.05], [0.25, 0.046], [0.55, 0.036], [0.85, 0.022], [1, 0.016]]), 0.08, 0.02), sq = 0.75;
    const seg = (v) => { const f = (v * 7.5 + 0.3) % 1; return v > 0.28 && v < 0.94 ? Math.exp(-(f * f) / 0.006) : 0; };
    const body = tube(cv, rad, { squash: [1, sq], lift: (v) => rad(v) * sq + 0.002, mod: (u, v) => 1 - 0.07 * seg(v) + (v > 0.28 ? 0 : 0.03 * Math.sin(u * TAU * 2)), nu: 30, nv: 110, color: (u, v, p) => {
      const out = Math.cos(u * TAU);
      let C = mixc(B, A, 0.35 + 0.4 * Math.max(0, out));
      if (seg(v) > 0.3) C = mixc(C, C3, 0.6);
      if (out > 0.92 && v > 0.25) C = shadeC(C3, -0.25);
      if (noise(p[0] * 120, p[2] * 120, 1) > 0.75) C = mixc(C, C3, 0.5);
      return C;
    } });
    const shellM = fmat('shrimp', { rough: 0.16, clear: 1, clearRough: 0.05, iri: 0.6, emissive: I.c3, ei: 0.12 });
    add(g, body, shellM);
    // tail fan
    const fan = fmat('shrimpfan', { rough: 0.2, clear: 1, side: 'double', emissive: I.c3, ei: 0.15, opacity: 0.9 });
    const tp = V(), tt = V(); cv.getPointAt(1, tp); cv.getTangentAt(1, tt);
    for (let i = -2; i <= 2; i++) {
      const a = Math.atan2(tt.z, tt.x) + i * 0.32;
      add(g, leaf(0.055 - Math.abs(i) * 0.004, 0.016, mixc(B, C3, 0.4), { cup: 0.05, droop: 0.02, vein: 0.2 }), fan, { p: [tp.x - tt.x * 0.006, 0.012, tp.z - tt.z * 0.006], r: [0, -a, 0], ns: true });
    }
    // rostrum, eyes, antennae and legs
    const hp = V(0.135, 0.03, -0.035);
    add(g, tube(curve([[0.12, 0.05, -0.01], [0.15, 0.058, -0.05], [0.17, 0.062, -0.085]]), capped(() => 0.006, 0.05, 0.6), { nu: 6, nv: 10, color: () => mixc(A, C3, 0.5) }), shellM, { ns: true });
    for (const s of [-1, 1]) {
      add(g, blob(0.009, 0.009, 0.009, { color: () => col(0x0a0a10) }), fmat('pupil', { rough: 0.05, clear: 1 }), { p: [0.142, 0.05 + s * 0.012, -0.03], ns: true });
      add(g, tube(curve([[0.14, 0.035 + s * 0.01, -0.04], [0.19, 0.03 + s * 0.02, -0.06], [0.2, 0.01, 0.04], [0.12, 0.004, 0.13 + s * 0.02], [0.0, 0.003, 0.15 + s * 0.02]]), () => 0.0022, { nu: 5, nv: 50, color: () => mixc(C3, B, 0.3) }), shellM, { ns: true });
    }
    for (let i = 0; i < 5; i++) {
      const v = 0.12 + i * 0.07, P = V(), T = V(); cv.getPointAt(v, P); cv.getTangentAt(v, T);
      const N = V(-T.z, 0, T.x).normalize().multiplyScalar(-1);
      const r = rad(v);
      const a = P.clone().addScaledVector(N, r * 0.85), b = a.clone().addScaledVector(N, 0.03).add(V(0, -0.012, 0)), c = b.clone().addScaledVector(T, -0.015);
      a.y = r * sq * 0.6; b.y = 0.006; c.y = 0.004;
      add(g, tube(new THREE.CatmullRomCurve3([a, b, c]), () => 0.0028, { nu: 5, nv: 10, color: () => mixc(B, C3, 0.3) }), shellM, { ns: true });
    }
    return g;
  },

  mushroom(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2), C3 = col(I.c3);
    const metal = I.id === 'alloyshroom';
    const capP = profile([[0.0, 0.245], [0.06, 0.24], [0.12, 0.215], [0.158, 0.178], [0.172, 0.15], [0.164, 0.136], [0.135, 0.14], [0.08, 0.152], [0.035, 0.158], [0.0, 0.16]]);
    const cap = revolve(capP, { nu: 56, nv: 40, mod: (u, v, t) => 1 + 0.025 * Math.sin(5 * t + 1) * smooth(0.35, 0.55, v) + (fbm(Math.cos(t) * 2, Math.sin(t) * 2, v * 3) - 0.5) * 0.06, color: (u, v, p) => {
      const t = u * TAU;
      if (v > 0.58) { let C = mixc(B, A, 0.15); if (Math.abs(Math.sin(t * 22)) < 0.35) C = shadeC(C, -0.28); return jit(C, p, 50, 0.08); }
      let C = mixc(shadeC(A, -0.25), A, smooth(0.0, 0.45, v));
      C = mixc(C, B, smooth(0.42, 0.56, v) * 0.6);
      if (fbm(p[0] * 30, p[1] * 30, p[2] * 30) > 0.64) C = mixc(C, C3, 0.85);
      return jit(C, p, 35, 0.12);
    } });
    const capM = metal ? fmat('alloycap', { rough: 0.3, metal: 0.85, clear: 0.4 }) : fmat('shroomcap', { rough: 0.45, clear: 0.4, sheen: 0.4, sheenColor: I.c3 });
    add(g, cap, capM);
    const stem = revolve(along([[0.0, 0.048], [0.02, 0.052], [0.06, 0.043], [0.12, 0.038], [0.16, 0.036]]), { nu: 28, nv: 16, mod: (u, v, t) => 1 + (noise(Math.cos(t) * 3, Math.sin(t) * 3, v * 4) - 0.5) * 0.12, color: (u, v, p) => {
      let C = mixc(shadeC(B, -0.2), B, smooth(0, 0.3, v));
      if (Math.abs(Math.sin(u * TAU * 30 + noise(u * 9, v * 9) * 5)) < 0.15) C = shadeC(C, -0.1);
      return C;
    } });
    add(g, stem, metal ? fmat('alloystem', { rough: 0.35, metal: 0.7 }) : fmat('shroomstem', { rough: 0.6, sheen: 0.3 }));
    // a torn veil ring on the stem
    add(g, revolve(profile([[0.036, 0.122], [0.05, 0.115], [0.058, 0.104], [0.052, 0.1]]), { nu: 28, nv: 4, mod: (u, v, t) => 1 + 0.08 * Math.sin(t * 7) * v, color: () => shadeC(B, -0.08) }), fmat('veil', { rough: 0.6, side: 'double' }));
    return g;
  },

  corn(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2), C3 = col(I.c3);
    const metal = I.id === 'gearcorn';
    const x0 = -0.15, x1 = 0.16;
    const cobR = ip([[x0, 0.05], [-0.05, 0.052], [0.06, 0.046], [0.13, 0.034], [x1, 0.012]]);
    const cy = 0.062;
    add(g, revolve(along([[x0 - 0.005, 0.0], [x0, 0.04], [0, 0.044], [0.13, 0.03], [x1 + 0.01, 0.0]]), { axis: 'x', off: () => [cy, 0], nu: 20, nv: 16, color: () => col(0xd8c890) }), fmat('cob', { rough: 0.8 }));
    // kernels: plump rounded cells packed in rows round the cob
    const k = surf((u, v) => { const t = u * TAU, f = v * Math.PI, sx = Math.sin(f) * Math.cos(t), sz = Math.sin(f) * Math.sin(t), sy = -Math.cos(f); const sg = (a, e) => Math.sign(a) * Math.pow(Math.abs(a), e); return [sg(sx, 0.55), sy > 0 ? sg(sy, 0.6) : sy * 0.6, sg(sz, 0.55)]; }, { nu: 8, nv: 6 });
    const rows = 14, cols = 23, parts = [];
    const r = rng(9);
    for (let i = 0; i < cols; i++) {
      const x = lerp(x0 + 0.008, x1 - 0.012, i / (cols - 1));
      const R0 = cobR(x);
      const sz = (x1 - x0) / cols * 0.55;
      for (let j = 0; j < rows; j++) {
        const a = (j + (i % 2) * 0.5) / rows * TAU;
        const nrm = V(0, Math.cos(a), Math.sin(a));
        const pos = V(x, cy + Math.cos(a) * R0, Math.sin(a) * R0);
        const kg = k.clone().applyMatrix4(basis(pos, nrm, 0, [sz, Math.max(0.004, R0 * 0.16), R0 * Math.PI / rows * 0.95]));
        const shade = (r() - 0.5) * 0.18 + (i > cols - 4 ? -0.12 : 0);
        const C = mixc(A, B, r() * 0.35), K = shadeC(C, shade);
        paint(kg, (p) => mixc(K, B, Math.max(0, (p[1] - cy) * Math.cos(a) + (p[2]) * Math.sin(a) - R0) * 40));
        parts.push(kg);
      }
    }
    add(g, mergeGeometries(parts), metal ? fmat('gearkernel', { rough: 0.25, metal: 0.75, clear: 0.6 }) : fmat('kernel', { rough: 0.25, clear: 0.7, clearRough: 0.15 }));
    // husk leaves peeled back from the base and lying on the board
    const huskM = metal ? fmat('huskmetal', { rough: 0.45, metal: 0.6, side: 'double' }) : fmat('husk', { rough: 0.65, side: 'double', sheen: 0.3 });
    [[-0.9, 0.0], [0.6, 0.15], [2.2, -0.1], [3.6, 0.1]].forEach(([a, tw], i) => {
      add(g, surf((u, v) => {
        const s = u * 2 - 1, ang = a + s * 0.45 * (1 - v * 0.6);
        const R0 = 0.052 + v * 0.06, x = x0 + 0.03 - v * 0.15;
        const y = cy + Math.cos(ang) * R0, z = Math.sin(ang) * R0;
        return [x, Math.max(0.003 + Math.abs(s) * 0.002, lerp(y, 0.004, smooth(0.25, 0.9, v))), z + tw * v * 0.1];
      }, { nu: 8, nv: 18, color: (u, v, p) => { let C = mixc(C3, 0xd8c890, v * 0.6 + (i % 2) * 0.1); if (Math.abs(Math.sin(u * 40)) < 0.2) C = shadeC(C, -0.12); return jit(C, p, 60, 0.08); } }), huskM, { ns: true });
    });
    add(g, tube(curve([[x0 - 0.01, cy, 0], [x0 - 0.05, cy - 0.008, 0.004]]), () => 0.016, { nu: 12, nv: 4, color: () => mixc(C3, 0x8a7a50, 0.5) }), huskM, { ns: true });
    // silk at the tip
    const silk = [];
    for (let i = 0; i < 14; i++) { const a = r() * TAU, l = 0.04 + r() * 0.04; silk.push(tube(curve([[x1, cy + Math.cos(a) * 0.006, Math.sin(a) * 0.006], [x1 + l * 0.5, cy + Math.cos(a) * 0.02 - 0.01, Math.sin(a) * 0.025], [x1 + l, 0.004, Math.sin(a) * 0.045]]), () => 0.0012, { nu: 3, nv: 8, color: () => mixc(0xc89a5a, 0x8a5a2a, r()) })); }
    add(g, mergeGeometries(silk), fmat('silk', { rough: 0.5, clear: 0.3 }), { ns: true });
    return g;
  },

  drumbone(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2), C3 = col(I.c3);
    const cy = 0.088;
    add(g, revolve(along([[-0.1, 0.0], [-0.097, 0.026], [-0.07, 0.032], [-0.03, 0.055], [0.03, 0.092], [0.08, 0.104], [0.125, 0.092], [0.158, 0.06], [0.175, 0.0]]), { axis: 'x', squash: [0.88, 1], off: () => [cy, 0], nu: 48, nv: 40, mod: (u, v, t) => 1 + (fbm(Math.cos(t) * 2.5, Math.sin(t) * 2.5, v * 5) - 0.5) * 0.16, color: (u, v, p) => {
      const n = fbm(p[0] * 22 + 7, p[1] * 22, p[2] * 22, 5);
      let C = jit(A, p, 18, 0.16);
      if (Math.abs(n - 0.5) < 0.02) C = mixc(C, B, 0.8);
      if (v < 0.18) C = mixc(C, B, smooth(0.18, 0.05, v) * 0.7);
      if (fbm(p[0] * 6, p[1] * 6 + 3, p[2] * 6) > 0.63) C = mixc(C, B, 0.55);
      return C;
    } }), fmat('meat', { rough: 0.38, clear: 0.55, clearRough: 0.3, sheen: 0.3, sheenColor: I.c2 }));
    const boneC = (u, v, p) => jit(mixc(C3, 0xd8c8a0, noise(p[0] * 60, p[1] * 60, p[2] * 60) * 0.4), p, 80, 0.06);
    const boneM = fmat('bone', { rough: 0.55, clear: 0.2 });
    add(g, revolve(along([[-0.215, 0.02], [-0.17, 0.018], [-0.12, 0.021], [-0.09, 0.024]]), { axis: 'x', off: () => [cy, 0], nu: 20, nv: 10, color: boneC }), boneM);
    for (const s of [-1, 1]) add(g, blob(0.03, 0.03, 0.026, { lump: 0.05, color: boneC }), boneM, { p: [-0.225, cy + s * 0.012, s * 0.016] });
    return g;
  },

  pepper(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2), C3 = col(I.c3);
    const cy = 0.096;
    add(g, revolve(along([[-0.13, 0.0], [-0.127, 0.04], [-0.105, 0.078], [-0.05, 0.098], [0.02, 0.1], [0.07, 0.094], [0.1, 0.07], [0.112, 0.03], [0.11, 0.0]]), { axis: 'x', off: () => [cy, 0], nu: 64, nv: 40, mod: (u, v, t) => 1 + 0.085 * Math.cos(4 * t + 0.3) * (0.6 + 0.4 * smooth(0.3, 0, v)) - 0.05 * smooth(0.1, 0, v) * Math.max(0, -Math.cos(4 * t + 0.3)) + (fbm(Math.cos(t) * 2, Math.sin(t) * 2, v * 3) - 0.5) * 0.05, color: (u, v, p) => {
      const lobe = Math.cos(4 * u * TAU + 0.3);
      let C = mixc(A, B, smooth(0.45, 0.0, v) * 0.55 + Math.max(0, -lobe) * 0.12);
      if (lobe < -0.6) C = shadeC(C, -0.12);
      if (v > 0.9) C = shadeC(C, -0.1);
      return jit(C, p, 40, 0.06);
    } }), fmat('pepper', { rough: 0.16, clear: 1, clearRough: 0.06 }));
    const stemC = (u, v) => (v > 0.92 ? mixc(C3, 0xd8e8a0, 0.6) : jit(C3, [u, v, 0], 30, 0.15));
    add(g, revolve(profile([[0.01, 0.0], [0.03, -0.002], [0.044, -0.008], [0.05, -0.016]]), { axis: 'x', nu: 30, nv: 5, mod: (u, v, t) => 1 + 0.22 * Math.cos(5 * t), color: () => shadeC(C3, -0.1) }), fmat('calyx', { rough: 0.5, side: 'double' }), { p: [0.11, cy, 0], r: [0, 0, 0], s: [-1, 1, 1], ns: true });
    add(g, tube(curve([[0.1, cy, 0], [0.135, cy + 0.01, 0.004], [0.16, cy + 0.035, 0.012]]), capped(() => 0.012, 0.0001, 0.06), { nu: 12, nv: 12, color: stemC }), fmat('stem', { rough: 0.55 }), { ns: true });
    return g;
  },

  steak(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2);
    const steel = I.id === 'steelbeef';
    const pts = [[-0.17, 0.0], [-0.15, 0.075], [-0.07, 0.112], [0.05, 0.118], [0.145, 0.088], [0.178, 0.005], [0.15, -0.07], [0.06, -0.105], [-0.06, -0.1], [-0.145, -0.07]].map(([x, z]) => new THREE.Vector2(x, z));
    const outline = new THREE.SplineCurve([...pts, pts[0]]).getPoints(80);
    const depth = 0.045, bev = 0.012;
    const ext = (shape) => { const e = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 4, curveSegments: 60 }); e.rotateX(-Math.PI / 2); e.translate(0, bev, 0); return e; };
    const marble = ctex(`marble:${I.id}`, 512, (c, S) => {
      c.fillStyle = css(A); c.fillRect(0, 0, S, S);
      const r = rng(3);
      for (let i = 0; i < 9000; i++) { const x = r() * S, y = r() * S; c.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '40,0,0'},${0.05 * r()})`; c.fillRect(x, y, 3, 3); }
      c.strokeStyle = css(B); c.lineCap = 'round';
      for (let i = 0; i < 60; i++) {
        let x = r() * S, y = r() * S, a = r() * TAU;
        c.lineWidth = 0.6 + r() * r() * 5; c.globalAlpha = 0.5 + r() * 0.5; c.beginPath(); c.moveTo(x, y);
        for (let k = 0; k < 14; k++) { a += (r() - 0.5) * 1.2; x += Math.cos(a) * 9; y += Math.sin(a) * 9; c.lineTo(x, y); }
        c.stroke();
      }
      c.globalAlpha = 1;
    });
    marble.wrapS = marble.wrapT = THREE.RepeatWrapping; marble.repeat.set(2.4, 2.4); marble.offset.set(0.5, 0.5);
    const top = new THREE.MeshPhysicalMaterial({ map: marble, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3, metalness: steel ? 0.35 : 0, sheen: 0.3, sheenColor: I.c2 });
    const side = new THREE.MeshPhysicalMaterial({ color: shadeC(A, -0.15), roughness: 0.5, clearcoat: 0.4, metalness: steel ? 0.35 : 0 });
    add(g, ext(new THREE.Shape(outline)), [top, side]);
    // fat cap along the back edge
    const n = outline.length - 1, from = Math.floor(n * 0.02), to = Math.floor(n * 0.36);
    const band = [], inner = [];
    for (let i = from; i <= to; i++) {
      const p = outline[i], q = outline[(i + 1) % n], o = outline[(i - 1 + n) % n];
      const t = new THREE.Vector2().subVectors(q, o).normalize(), nrm = new THREE.Vector2(t.y, -t.x);
      const w = 0.02 * Math.sin(Math.PI * (i - from) / (to - from)) + 0.002;
      band.push(p.clone().addScaledVector(nrm, -w)); inner.push(p.clone().addScaledVector(nrm, 0.004));
    }
    const fat = new THREE.Shape([...band, ...inner.reverse()]);
    const fatM = new THREE.MeshPhysicalMaterial({ color: shadeC(B, -0.04), roughness: 0.35, clearcoat: 0.6, sheen: 0.5, sheenColor: 0xffffff });
    const fg = ext(fat);
    add(g, fg, fatM);
    return g;
  },

  root(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2), C3 = col(I.c3);
    const R = along([[-0.2, 0.0], [-0.195, 0.006], [-0.15, 0.018], [-0.08, 0.034], [0.0, 0.048], [0.07, 0.058], [0.11, 0.06], [0.135, 0.048], [0.145, 0.0]]);
    add(g, revolve(R, { axis: 'x', nu: 32, nv: 70, off: (v, h) => [R(v)[0] * 0.95 + 0.002 + Math.sin(h * 12) * 0.004, Math.sin(h * 9) * 0.01], mod: (u, v, t) => 1 - 0.07 * Math.pow(Math.max(0, Math.sin(v * 95 + noise(Math.cos(t) * 2, v * 6) * 4)), 10) + (fbm(Math.cos(t) * 2, Math.sin(t) * 2, v * 6) - 0.5) * 0.1, color: (u, v, p) => {
      let C = mixc(A, B, smooth(0.8, 1, v) * 0.6);
      if (Math.pow(Math.max(0, Math.sin(v * 95 + noise(Math.cos(u * TAU) * 2, v * 6) * 4)), 10) > 0.4) C = shadeC(C, -0.35);
      if (fbm(p[0] * 40, p[1] * 40, p[2] * 40) > 0.66) C = mixc(C, C3, 0.6);
      return jit(C, p, 30, 0.12);
    } }), fmat('root', { rough: 0.75, bump: bumpTex('skin', [4, 12]), bumpScale: 0.8 }));
    // feathery tops
    const leafM = fmat('roottop', { rough: 0.6, side: 'double' });
    const green = col(0x6a8a5a), stalks = [], leaves = [];
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.35, len = 0.1 + (i % 2) * 0.03, y0 = 0.058;
      const c = curve([[0.13, y0, 0], [0.13 + len * 0.5, y0 + 0.03, Math.sin(a) * len * 0.4], [0.13 + len, 0.01 + i * 0.006, Math.sin(a) * len]]);
      stalks.push(tube(c, () => 0.0035, { nu: 5, nv: 10, color: () => shadeC(green, 0.1) }));
      for (let j = 1; j <= 4; j++) {
        const P = V(), T = V(); c.getPointAt(j / 4.5, P); c.getTangentAt(j / 4.5, T);
        for (const s of [-1, 1]) { const l = leaf(0.035, 0.009, green, { droop: 0.1, cup: 0.3 }); l.applyMatrix4(new THREE.Matrix4().makeRotationY(-Math.atan2(T.z, T.x) + s * 0.9)); l.translate(P.x, P.y, P.z); leaves.push(l); }
      }
    }
    add(g, mergeGeometries(stalks), leafM, { ns: true });
    add(g, mergeGeometries(leaves), leafM, { ns: true });
    // root hairs
    const r = rng(5), hairs = [];
    for (let i = 0; i < 7; i++) { const x = -0.17 + r() * 0.2, rr = R((x + 0.2) / 0.345)[0], s = r() < 0.5 ? -1 : 1; hairs.push(tube(curve([[x, rr * 0.9, s * rr * 0.6], [x - 0.01, rr * 0.5, s * (rr + 0.02)], [x - 0.02 - r() * 0.02, 0.002, s * (rr + 0.035)]]), () => 0.0012, { nu: 3, nv: 6, color: () => shadeC(A, -0.2) })); }
    add(g, mergeGeometries(hairs), leafM, { ns: true });
    return g;
  },

  spore(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2), C3 = col(I.c3);
    const wart = (d) => Math.pow(noise(d[0] * 9 + 3, d[1] * 9, d[2] * 9), 4);
    add(g, blob(0.125, 0.115, 0.125, { nu: 64, nv: 48, mod: (d) => 1 + wart(d) * 0.18 + (d[1] < -0.5 ? (d[1] + 0.5) * 0.4 : 0) + (fbm(d[0] * 2, d[1] * 2, d[2] * 2) - 0.5) * 0.1, color: (u, v, p) => {
      const d = V(...p).normalize().toArray(), w = wart(d);
      let C = mixc(A, C3, smooth(0.25, 0.7, w));
      if (d[1] < -0.3) C = mixc(C, B, 0.5);
      if (noise(d[0] * 40, d[1] * 40, d[2] * 40) > 0.78) C = shadeC(C3, -0.4);
      return jit(C, p, 50, 0.08);
    } }), fmat('spore', { rough: 0.65, sheen: 0.6, sheenColor: I.c2 }), { p: [0, 0.112, 0] });
    add(g, revolve(along([[0.0, 0.035], [0.02, 0.03], [0.04, 0.0]]), { nu: 16, nv: 6, mod: (u, v, t) => 1 + 0.2 * noise(Math.cos(t) * 3, Math.sin(t) * 3), color: () => shadeC(B, -0.15) }), fmat('sporebase', { rough: 0.9 }), { ns: true });
    // drifting spores
    const r = rng(11), dots = [];
    for (let i = 0; i < 9; i++) dots.push(blob(0.004, 0.004, 0.004, { nu: 6, nv: 4 }).translate((r() - 0.5) * 0.3, 0.12 + r() * 0.15, (r() - 0.5) * 0.3));
    add(g, mergeGeometries(dots), fmat('sporedust', { vc: false, color: I.c2, emissive: I.c1, ei: 1.2, rough: 0.5 }), { ns: true, shadow: false });
    return g;
  },

  bean(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2), C3 = col(I.c3);
    const pod = surf((u, v) => {
      const x = lerp(-0.17, 0.17, v), t = u * TAU;
      const env = Math.pow(Math.sin(Math.PI * clamp(v)), 0.5);
      const bump = 1 + 0.16 * Math.max(0, Math.sin((v - 0.08) * Math.PI * 5.6)) * smooth(0.04, 0.12, v) * smooth(0.96, 0.88, v);
      const seam = 1 + 0.07 * Math.exp(-Math.pow(Math.atan2(Math.sin(t - Math.PI / 2), Math.cos(t - Math.PI / 2)), 2) / 0.03);
      const rz = 0.036 * env * bump, ry = 0.026 * env * bump * seam;
      return [x, 0.026 + Math.sin(t) * ry, Math.cos(t) * rz + Math.sin(v * Math.PI) * 0.035 + (v > 0.9 ? (v - 0.9) * 0.3 : 0)];
    }, { nu: 32, nv: 70, color: (u, v, p) => {
      const t = u * TAU, top = Math.cos(t - Math.PI / 2);
      let C = mixc(A, shadeC(A, -0.2), Math.max(0, -Math.sin(t)));
      if (top > 0.985) C = mixc(C, B, 0.6);
      if (noise(p[0] * 160, p[1] * 160, p[2] * 160) > 0.82) C = mixc(C, B, 0.7);
      return jit(C, p, 30, 0.08);
    } });
    add(g, pod, fmat('pod', { rough: 0.35, clear: 0.6, emissive: I.c1, ei: 0.08 }));
    add(g, tube(curve([[-0.165, 0.026, 0], [-0.19, 0.03, -0.006], [-0.205, 0.024, -0.016]]), capped(() => 0.005, 0.0001, 0.2), { nu: 8, nv: 8, color: () => shadeC(C3, -0.1) }), fmat('stem', { rough: 0.55 }), { ns: true });
    // two loose kidney beans
    const kidney = surf((u, v) => { const t = u * TAU, f = v * Math.PI, sx = Math.cos(f), sy = Math.sin(f) * Math.sin(t), sz = Math.sin(f) * Math.cos(t); return [sx * 0.028, sy * 0.016, sz * 0.019 + (1 - sx * sx) * 0.007]; }, { nu: 20, nv: 16, color: (u, v, p) => (Math.abs(v - 0.5) < 0.06 && Math.cos(u * TAU) > 0.85 ? shadeC(C3, -0.3) : jit(mixc(B, A, 0.35), p, 90, 0.08)) });
    add(g, kidney, fmat('bean', { rough: 0.25, clear: 0.8 }), { p: [0.07, 0.016, -0.075], r: [0, 0.6, 0] });
    add(g, kidney, fmat('bean', { rough: 0.25, clear: 0.8 }), { p: [0.12, 0.016, -0.05], r: [0, -0.4, 0] });
    return g;
  },

  cheese(I) {
    const g = new THREE.Group(), A = col(I.c1), C3 = col(I.c3);
    const half = 0.36, R = 0.34, cx = -0.17, H = 0.14;
    const sh = new THREE.Shape();
    sh.moveTo(cx, 0); sh.absarc(cx, 0, R, -half, half, false); sh.lineTo(cx, 0);
    const holesDraw = (c, S, bump) => {
      c.fillStyle = bump ? '#808080' : css(A); c.fillRect(0, 0, S, S);
      const r = rng(21);
      if (!bump) for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '255,250,220' : '160,110,20'},${0.08 * r()})`; c.fillRect(r() * S, r() * S, 2, 2); }
      for (let i = 0; i < 38; i++) {
        const x = r() * S, y = r() * S, rr = 4 + r() * r() * 22;
        const gr = c.createRadialGradient(x - rr * 0.25, y - rr * 0.3, rr * 0.1, x, y, rr);
        if (bump) { gr.addColorStop(0, '#202020'); gr.addColorStop(0.8, '#606060'); gr.addColorStop(1, '#909090'); }
        else { gr.addColorStop(0, css(A, -0.45)); gr.addColorStop(0.7, css(A, -0.25)); gr.addColorStop(1, css(A, 0.15)); }
        c.fillStyle = gr; c.beginPath(); c.ellipse(x, y, rr, rr * (0.75 + r() * 0.25), r() * 3, 0, TAU); c.fill();
      }
    };
    const map = ctex(`cheese:${I.id}`, 512, (c, S) => holesDraw(c, S, false)), bmap = ctex(`cheeseb:${I.id}`, 512, (c, S) => holesDraw(c, S, true), { srgb: false });
    for (const t of [map, bmap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2.6, 2.6); t.offset.set(0.5, 0.5); }
    const e = new THREE.ExtrudeGeometry(sh, { depth: H, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 40 });
    e.rotateX(-Math.PI / 2); e.translate(0, 0.004, 0);
    const body = new THREE.MeshPhysicalMaterial({ map, bumpMap: bmap, bumpScale: 3, roughness: 0.5, clearcoat: 0.15, sheen: 0.2 });
    add(g, e, [body, body]);
    // meteor rind on the curved back: cratered, dark, slightly charred
    const rind = surf((u, v) => { const a = lerp(-half, half, u), rr = R + 0.006 + (noise(u * 30, v * 6) - 0.5) * 0.005; return [cx + Math.cos(a) * rr, 0.002 + v * (H + 0.004), -Math.sin(a) * rr]; }, { nu: 40, nv: 10, color: (u, v, p) => { let C = jit(C3, p, 60, 0.3); if (noise(u * 40, v * 8, 2) > 0.7) C = shadeC(C, -0.5); return mixc(C, A, smooth(0.04, 0, Math.min(v, 1 - v)) * 0.6); } });
    add(g, rind, fmat('rind', { rough: 0.85, side: 'double', bump: bumpTex('dimple', [6, 2]), bumpScale: 2 }));
    return g;
  },

  bread(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2);
    const sg = (a, e) => Math.sign(a) * Math.pow(Math.abs(a), e);
    const slashes = [-0.09, 0.0, 0.09];
    const slash = (x, z) => slashes.reduce((m, c) => Math.max(m, Math.exp(-Math.pow(z * 0.55 - (x - c), 2) / 0.00006) * smooth(0.075, 0.03, Math.abs(z))), 0);
    const loaf = surf((u, v) => {
      const t = u * TAU, x = lerp(-0.175, 0.175, v);
      const e = Math.pow(clamp(1 - Math.pow(Math.abs(2 * v - 1), 3.2)), 0.45);
      const c = Math.cos(t), s = Math.sin(t);
      const z = sg(c, 0.6) * 0.105 * e;
      let y = s > 0 ? 0.03 + sg(s, 0.75) * 0.085 * e : 0.03 + sg(s, 0.4) * 0.03 * Math.max(0.3, e);
      y = Math.max(0.0, y);
      if (s > 0) y -= slash(x, z) * 0.01;
      return [x, y, z + (fbm(x * 9, y * 9, 3) - 0.5) * 0.008];
    }, { nu: 48, nv: 56, color: (u, v, p) => {
      const s = Math.sin(u * TAU), sl = slash(p[0], p[2]);
      let C = mixc(shadeC(A, 0.1), shadeC(A, -0.5), smooth(-0.3, 0.7, s));
      if (s > 0.2) C = mixc(C, shadeC(A, -0.5), smooth(0.65, 0.8, fbm(p[0] * 25, p[2] * 25, 1)) * 0.6);
      if (sl > 0.3) C = mixc(C, shadeC(B, -0.1), sl * 0.65);
      if (s > 0.3 && fbm(p[0] * 40 + 5, p[2] * 40, 2) > 0.72) C = mixc(C, 0xf4efe6, 0.22);
      return jit(C, p, 40, 0.06);
    } });
    add(g, loaf, fmat('bread', { rough: 0.78, bump: bumpTex('skin', [10, 8]), bumpScale: 1.4 }));
    return g;
  },

  tomato(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2), C3 = col(I.c3);
    add(g, revolve(profile([[0, 0.004], [0.06, 0.0], [0.11, 0.03], [0.135, 0.09], [0.126, 0.148], [0.085, 0.183], [0.035, 0.18], [0.008, 0.172], [0, 0.171]]), { nu: 64, nv: 40, mod: (u, v, t) => 1 + 0.04 * Math.cos(5 * t) * smooth(0.3, 0.8, v) + (fbm(Math.cos(t) * 2, Math.sin(t) * 2, v * 3) - 0.5) * 0.04, color: (u, v, p) => {
      let C = mixc(A, B, 0.3 + 0.25 * Math.sin(u * TAU * 2 + v * 3) + (fbm(p[0] * 10, p[1] * 10, p[2] * 10) - 0.5) * 0.5);
      C = mixc(C, shadeC(A, -0.35), smooth(0.4, 0, v) * 0.5);
      if (v > 0.85) C = mixc(C, C3, smooth(0.85, 0.97, v) * 0.35);
      if (noise(p[0] * 150, p[1] * 150, p[2] * 150) > 0.9) C = shadeC(C, 0.15);
      return C;
    } }), fmat('tomato', { rough: 0.15, clear: 1, clearRough: 0.05 }));
    const leafM = fmat('sepal', { rough: 0.55, side: 'double' });
    const seps = [];
    for (let i = 0; i < 5; i++) { const l = leaf(0.06, 0.011, C3, { droop: -0.25, cup: 0.4, vein: 0.15 }); l.applyMatrix4(new THREE.Matrix4().makeRotationY(i / 5 * TAU + 0.3)); l.translate(0, 0.176, 0); seps.push(l); }
    add(g, mergeGeometries(seps), leafM, { ns: true });
    add(g, tube(curve([[0, 0.172, 0], [0.004, 0.2, 0.002], [0.012, 0.215, 0.006]]), capped(() => 0.007, 0.0001, 0.12), { nu: 10, nv: 8, color: (u, v) => (v > 0.88 ? mixc(C3, 0xd8e0a0, 0.6) : C3) }), fmat('stem', { rough: 0.55 }), { ns: true });
    return g;
  },

  lemon(I) {
    const g = new THREE.Group(), A = col(I.c1), C3 = col(I.c3);
    const R = along([[-0.15, 0.0], [-0.145, 0.011], [-0.132, 0.02], [-0.105, 0.05], [-0.06, 0.077], [0.0, 0.086], [0.06, 0.077], [0.105, 0.05], [0.132, 0.02], [0.145, 0.011], [0.15, 0.0]]);
    add(g, revolve(R, { axis: 'x', squash: [0.95, 1], off: () => [0.083, 0], nu: 56, nv: 56, uv: [10, 5], mod: (u, v, t) => 1 + (fbm(Math.cos(t) * 2, Math.sin(t) * 2, v * 4) - 0.5) * 0.05, color: (u, v, p) => {
      let C = mixc(A, C3, (fbm(p[0] * 12, p[1] * 12, p[2] * 12) - 0.35) * 0.6);
      const end = Math.abs(v - 0.5) * 2;
      C = mixc(C, 0x9ab03a, smooth(0.85, 1, end) * 0.45);
      return jit(C, p, 70, 0.05);
    } }), fmat('lemon', { rough: 0.36, clear: 0.45, clearRough: 0.25, bump: bumpTex('dimple', [10, 5]), bumpScale: 1.6 }));
    add(g, revolve(profile([[0.0, 0.0], [0.008, 0.0], [0.006, 0.003]]), { axis: 'x', nu: 10, nv: 3, mod: (u, v, t) => 1 + 0.4 * Math.cos(5 * t), color: () => col(0x5a6a2a) }), fmat('stem', { rough: 0.55 }), { p: [-0.151, 0.083, 0], s: [-1, 1, 1], ns: true });
    return g;
  },

  poultry(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2), C3 = col(I.c3);
    const skin = (u, v, p) => { let C = mixc(A, B, (fbm(p[0] * 10, p[1] * 10, p[2] * 10) - 0.4)); if (fbm(p[0] * 5 + 3, p[1] * 5, p[2] * 5) > 0.6) C = mixc(C, 0xf0d890, 0.3); return jit(C, p, 60, 0.06); };
    const skinM = fmat('poultry', { rough: 0.45, clear: 0.45, sheen: 0.4, sheenColor: 0xfff0e0, bump: bumpTex('goose', [6, 6]), bumpScale: 1.2 });
    add(g, blob(0.15, 0.085, 0.112, { nu: 56, nv: 40, mod: (d) => 1 + 0.12 * Math.max(0, d[1]) * Math.exp(-d[2] * d[2] / 0.25) - 0.05 * Math.exp(-d[2] * d[2] / 0.004) * Math.max(0, d[1]) - (d[0] < -0.8 ? (-d[0] - 0.8) * 0.5 : 0) + (fbm(d[0] * 2, d[1] * 2, d[2] * 2) - 0.5) * 0.06, color: skin }), skinM, { p: [-0.02, 0.085, 0] });
    for (const s of [-1, 1]) {
      const c = curve([[0.03, 0.08, s * 0.07], [0.1, 0.11, s * 0.075], [0.165, 0.14, s * 0.05], [0.2, 0.15, s * 0.035]]);
      add(g, tube(c, capped(ip([[0, 0.04], [0.35, 0.042], [0.7, 0.024], [0.82, 0.014], [1, 0.012]]), 0.15, 0.05), { nu: 24, nv: 30, color: skin }), skinM);
      add(g, blob(0.016, 0.014, 0.014, { color: () => mixc(C3, 0xe8dcc0, 0.4) }), fmat('bone', { rough: 0.5, clear: 0.2 }), { p: [0.205, 0.152, s * 0.033] });
      add(g, tube(curve([[-0.1, 0.12, s * 0.09], [-0.03, 0.1, s * 0.122], [0.03, 0.06, s * 0.12], [-0.02, 0.035, s * 0.115]]), capped(ip([[0, 0.022], [0.5, 0.02], [1, 0.012]]), 0.2, 0.2), { squash: [0.65, 1], nu: 16, nv: 24, color: skin }), skinM);
    }
    add(g, tube(curve([[-0.15, 0.1, 0], [-0.18, 0.1, 0], [-0.19, 0.095, 0]]), capped(() => 0.025, 0.0001, 0.3), { nu: 16, nv: 6, color: skin }), skinM);
    return g;
  },

  melon(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2), C3 = col(I.c3);
    const kind = I.shape === 'starmelon' ? 'star' : I.id === 'fluffmelon' ? 'fluff' : 'water';
    const len = kind === 'water' ? 0.19 : 0.15, rad = kind === 'water' ? 0.12 : 0.145;
    const R = along([[-len, 0.0], [-len * 0.96, rad * 0.3], [-len * 0.75, rad * 0.75], [-len * 0.35, rad * 0.97], [0, rad], [len * 0.35, rad * 0.97], [len * 0.75, rad * 0.75], [len * 0.96, rad * 0.3], [len, 0.0]]);
    const ribs = kind === 'fluff' ? 10 : 0;
    const geo = revolve(R, { axis: 'x', off: () => [rad * 0.97, 0], nu: 64, nv: 48, uv: [6, 4], mod: (u, v, t) => (1 + (ribs ? 0.035 * Math.pow(Math.abs(Math.cos(ribs / 2 * t)), 0.5) : 0) + (fbm(Math.cos(t) * 2, Math.sin(t) * 2, v * 3) - 0.5) * 0.05) * (Math.sin(t) < -0.85 ? 0.985 : 1), color: (u, v, p) => {
      const t = u * TAU;
      if (kind === 'water') {
        const s = ((t / TAU) * 9 + (fbm(p[0] * 14, Math.cos(t), Math.sin(t)) - 0.5) * 0.9) % 1;
        let C = s < 0.42 ? jit(C3, p, 50, 0.15) : jit(mixc(A, 0xb8d88a, 0.25), p, 50, 0.12);
        if (Math.cos(t) < -0.75) C = mixc(C, 0xe8d890, smooth(-0.75, -0.98, Math.cos(t)) * 0.75);
        return C;
      }
      if (kind === 'fluff') {
        const n = Math.abs(noise(p[0] * 45, p[1] * 45, p[2] * 45) - 0.5), n2 = Math.abs(noise(p[0] * 90 + 4, p[1] * 90, p[2] * 90) - 0.5);
        let C = mixc(shadeC(A, -0.12), B, fbm(p[0] * 8, p[1] * 8, p[2] * 8) * 0.9 - 0.15);
        if (n < 0.06 || n2 < 0.04) C = mixc(C, 0xffffff, 0.75);
        if (Math.abs(Math.cos(5 * t)) > 0.985) C = shadeC(C, -0.2);
        return C;
      }
      let C = mixc(A, shadeC(A, -0.4), Math.abs(Math.sin(t * 6)) * 0.5);
      return jit(C, p, 30, 0.12);
    } });
    let m;
    if (kind === 'star') {
      const stars = ctex('stars', 256, (c, S) => { c.fillStyle = '#000'; c.fillRect(0, 0, S, S); const r = rng(8); for (let i = 0; i < 120; i++) { const x = r() * S, y = r() * S, s = 0.5 + r() * r() * 2.5; c.fillStyle = '#fff'; c.globalAlpha = 0.4 + r() * 0.6; c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill(); } c.globalAlpha = 1; }, { repeat: [3, 2] });
      m = fmat('starmelon', { rough: 0.3, clear: 0.8, emissive: I.c3, emap: stars, ei: 1.4 });
    } else m = fmat(`melon${kind}`, kind === 'fluff' ? { rough: 0.7, sheen: 0.8, sheenColor: I.c2, bump: bumpTex('dimple', [6, 4]), bumpScale: 0.8 } : { rough: 0.32, clear: 0.6 });
    add(g, geo, m);
    add(g, tube(curve([[len - 0.005, rad * 0.97, 0], [len + 0.02, rad * 0.97 + 0.012, 0.004], [len + 0.035, rad + 0.03, 0.02]]), capped(() => 0.008, 0.0001, 0.1), { nu: 10, nv: 10, color: () => col(0x6a7a3a) }), fmat('stem', { rough: 0.55 }), { ns: true });
    if (kind === 'water') add(g, tube(curve(Array.from({ length: 16 }, (_, i) => { const a = i * 0.7; return [len + 0.035 + i * 0.003, rad + 0.03 + Math.sin(a) * 0.012 * (1 - i / 16), 0.02 + Math.cos(a) * 0.012 * (1 - i / 16)]; })), () => 0.0016, { nu: 4, nv: 60, color: () => col(0x7a9a4a) }), fmat('stem', { rough: 0.55 }), { ns: true });
    return g;
  },

  leek(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2);
    const R = along([[-0.2, 0.0], [-0.198, 0.02], [-0.19, 0.032], [-0.16, 0.035], [0.0, 0.033], [0.08, 0.034], [0.1, 0.036]]);
    add(g, revolve(R, { axis: 'x', off: () => [0.036, 0], nu: 32, nv: 50, mod: (u, v, t) => 1 + 0.01 * Math.sin(t * 9 + v * 4), color: (u, v, p) => {
      let C = mixc(B, A, smooth(0.45, 0.95, v));
      C = mixc(C, 0xd8e8b0, smooth(0.3, 0.55, v) * smooth(0.95, 0.6, v) * 0.5);
      if (Math.abs(Math.sin(u * TAU * 18 + v)) < 0.12) C = shadeC(C, -0.06);
      if (v < 0.06) C = mixc(C, 0xb8a888, 0.6);
      return C;
    } }), fmat('leek', { rough: 0.35, clear: 0.6 }));
    // leaves: folded blades fanning out of the shaft
    const leafM = fmat('leekleaf', { rough: 0.4, clear: 0.4, side: 'double' });
    const blades = [];
    [[-0.5, 0.25, 0.17], [0.4, 0.4, 0.19], [-0.1, 0.9, 0.16], [0.2, -0.3, 0.15]].forEach(([yaw, roll, l]) => {
      const b = surf((u, v) => { const s = u * 2 - 1, w = lerp(0.03, 0.012, v) * (v > 0.85 ? (1 - v) / 0.15 : 1); return [v * l, Math.abs(s) * w * 0.7 + 0.035 * Math.sin(v * 2.5) - v * v * 0.045, s * w]; }, { nu: 8, nv: 20, color: (u, v, p) => { let C = mixc(A, shadeC(A, -0.35), v * 0.7); if (Math.abs(u * 2 - 1) < 0.08) C = shadeC(C, 0.12); if (v > 0.9) C = mixc(C, 0xb8a860, 0.4); return jit(C, p, 50, 0.05); } });
      b.applyMatrix4(new THREE.Matrix4().makeRotationX(roll)); b.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw));
      b.translate(0.085, 0.036, 0); blades.push(b);
    });
    add(g, mergeGeometries(blades), leafM, { ns: true });
    const r = rng(14), roots = [];
    for (let i = 0; i < 16; i++) { const a = r() * TAU, l = 0.02 + r() * 0.04; roots.push(tube(curve([[-0.198, 0.036 + Math.cos(a) * 0.015, Math.sin(a) * 0.015], [-0.21 - l * 0.4, 0.036 + Math.cos(a) * 0.03 * r(), Math.sin(a) * 0.03], [-0.2 - l, 0.003, Math.sin(a) * (0.03 + l * 0.6)]]), () => 0.0014, { nu: 3, nv: 8, color: () => col(0xd8c8a0) })); }
    add(g, mergeGeometries(roots), fmat('roots', { rough: 0.8 }), { ns: true });
    return g;
  },

  frogleg(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2), C3 = col(I.c3);
    const skin = (u, v, p) => { const up = Math.sin(u * TAU); let C = up > -0.2 ? A : mixc(A, B, smooth(-0.2, -0.7, up)); if (up > -0.1 && noise(p[0] * 50, p[2] * 50, 3) > 0.68) C = shadeC(C, -0.45); return jit(C, p, 40, 0.1); };
    const M = fmat('frog', { rough: 0.25, clear: 0.9, clearRough: 0.1 });
    add(g, blob(0.045, 0.028, 0.05, { color: (u, v, p) => mixc(B, A, 0.3), lump: 0.05 }), M, { p: [0.08, 0.028, 0] });
    for (const s of [-1, 1]) {
      const c = curve([[0.075, 0.03, s * 0.02], [0.02, 0.034, s * 0.06], [-0.035, 0.03, s * 0.095], [-0.075, 0.022, s * 0.07], [-0.13, 0.016, s * 0.05]]);
      const rad = capped(ip([[0, 0.034], [0.2, 0.033], [0.45, 0.02], [0.55, 0.017], [0.7, 0.016], [0.95, 0.011], [1, 0.01]]), 0.05, 0.03);
      add(g, tube(c, rad, { squash: [1, 0.85], lift: () => 0, nu: 22, nv: 50, color: skin }), M);
      // webbed foot with four toes and sticky pads
      const toes = [], pads = [];
      for (let k = 0; k < 4; k++) {
        const a = Math.PI + s * (-0.5 + k * 0.33);
        const tip = V(-0.13 + Math.cos(a) * 0.065, 0.006, s * 0.05 + Math.sin(a) * 0.065 * 0.8);
        toes.push(tube(curve([[-0.13, 0.012, s * 0.05], [lerp(-0.13, tip.x, 0.5), 0.01, lerp(s * 0.05, tip.z, 0.5)], [tip.x, tip.y, tip.z]]), () => 0.004, { nu: 6, nv: 8, color: skin }));
        pads.push(blob(0.007, 0.004, 0.007, { nu: 10, nv: 8 }).translate(tip.x, tip.y, tip.z));
      }
      add(g, mergeGeometries(toes), M, { ns: true });
      add(g, mergeGeometries(pads), fmat('pad', { vc: false, color: I.c3, rough: 0.3, clear: 0.8 }), { ns: true });
      add(g, surf((u, v) => { const a = Math.PI + s * (-0.5 + u * 0.99); const rr = 0.058 * v * (0.85 + 0.15 * Math.cos(u * 3 * TAU)); return [-0.13 + Math.cos(a) * rr, 0.005, s * 0.05 + Math.sin(a) * rr * 0.8]; }, { nu: 24, nv: 6, color: () => mixc(A, B, 0.5) }), fmat('web', { rough: 0.3, clear: 0.6, side: 'double', opacity: 0.85 }), { ns: true });
    }
    return g;
  },

  nut(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2), C3 = col(I.c3);
    const cy = 0.074;
    add(g, revolve(along([[-0.15, 0.0], [-0.147, 0.006], [-0.13, 0.025], [-0.09, 0.058], [-0.04, 0.073], [0.02, 0.075], [0.05, 0.07]]), { axis: 'x', off: () => [cy, 0], nu: 44, nv: 36, mod: (u, v, t) => 1 + (fbm(Math.cos(t) * 2, Math.sin(t) * 2, v * 3) - 0.5) * 0.03, color: (u, v, p) => {
      let C = mixc(A, B, smooth(0.8, 1, v) * 0.6);
      if (Math.abs(Math.sin(u * TAU * 11 + noise(v * 6, u * 6) * 3)) < 0.18) C = shadeC(C, -0.15);
      if (v < 0.05) C = shadeC(C3, -0.2);
      return jit(C, p, 40, 0.08);
    } }), fmat('acorn', { rough: 0.25, clear: 0.9, clearRough: 0.12 }));
    add(g, revolve(profile([[0.064, 0.032], [0.083, 0.045], [0.088, 0.07], [0.075, 0.095], [0.045, 0.108], [0.012, 0.112], [0, 0.112]]), { axis: 'x', off: () => [cy, 0], nu: 44, nv: 24, mod: (u, v, t) => 1 + 0.04 * Math.pow(Math.abs(Math.sin(t * 9 + v * 14)) * Math.abs(Math.sin(v * 24 - t * 4)), 0.5), color: (u, v, p) => { let C = mixc(C3, B, 0.15); if (Math.abs(Math.sin(u * TAU * 9 + v * 14)) * Math.abs(Math.sin(v * 24 - u * TAU * 4)) < 0.1) C = shadeC(C, -0.4); return jit(C, p, 60, 0.12); } }), fmat('cupule', { rough: 0.85, bump: bumpTex('weave', [12, 6]), bumpScale: 1 }));
    add(g, tube(curve([[0.11, cy, 0], [0.13, cy + 0.006, 0.003], [0.145, cy + 0.01, 0.01]]), capped(() => 0.006, 0.0001, 0.12), { nu: 8, nv: 8, color: () => shadeC(C3, -0.2) }), fmat('stem', { rough: 0.55 }), { ns: true });
    return g;
  },

  mango(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2), C3 = col(I.c3);
    add(g, blob(0.155, 0.092, 0.105, { nu: 56, nv: 40, mod: (d) => 1 + 0.06 * d[0] * d[2] + (d[0] < -0.6 && d[2] < 0 ? -0.06 * (-d[0] - 0.6) : 0) + (fbm(d[0] * 2, d[1] * 2, d[2] * 2) - 0.5) * 0.05, color: (u, v, p) => {
      let C = mixc(A, C3, smooth(0.06, 0.15, p[0]) * 0.75);
      C = mixc(C, 0xe0502a, smooth(0.0, 0.08, p[1]) * smooth(0.05, -0.1, p[0]) * fbm(p[0] * 12, p[1] * 12, p[2] * 12) * 1.2);
      C = mixc(C, B, smooth(-0.06, -0.15, p[0]) * 0.3);
      if (noise(p[0] * 160, p[1] * 160, p[2] * 160) > 0.8) C = shadeC(C, 0.35);
      return C;
    } }), fmat('mango', { rough: 0.35, clear: 0.6, clearRough: 0.2 }), { p: [0, 0.09, 0] });
    add(g, tube(curve([[0.15, 0.1, 0.0], [0.17, 0.11, 0.003], [0.185, 0.12, 0.006]]), capped(() => 0.006, 0.0001, 0.12), { nu: 8, nv: 8, color: () => col(0x5a4a2a) }), fmat('stem', { rough: 0.55 }), { ns: true });
    add(g, leaf(0.13, 0.026, col(0x3a7a2a), { droop: 0.3, cup: 0.3, vein: 0.2 }), fmat('leaf', { rough: 0.45, clear: 0.5, side: 'double' }), { p: [0.18, 0.118, 0.006], r: [0, -0.9, -0.3], ns: true });
    return g;
  },

  bolt(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2), C3 = col(I.c3);
    const cy = 0.064;
    const steel = fmat('steel', { rough: 0.32, metal: 0.9, clear: 0.2, bump: bumpTex('brushed', [1, 4]), bumpScale: 0.3 });
    const grime = (k) => (u, v, p) => jit(mixc(B, A, k + (fbm(p[0] * 20, p[1] * 20, p[2] * 20) - 0.5) * 0.6), p, 80, 0.1);
    const hex = (r0, len, hole) => { const pts = [[r0 * 0.9, 0], [r0, len * 0.12], [r0, len * 0.88], [r0 * 0.9, len]]; if (hole) pts.push([hole, len], [hole, 0], [r0 * 0.9, 0]); else pts.push([r0 * 0.3, len * 1.02], [0, len * 1.02]); const lg = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 6); lg.rotateY(Math.PI / 6); lg.rotateZ(-Math.PI / 2); return lg; };
    const headM = fmat('hexhead', { color: I.c2, vc: false, rough: 0.3, metal: 0.9, flat: true });
    add(g, hex(0.07, 0.055, 0), headM, { p: [0.105, cy, 0], s: [1, 1, 1], r: [Math.PI / 2, 0, 0] });
    add(g, revolve(profile([[0.024, 0], [0.05, 0.0], [0.05, 0.006], [0.024, 0.006]]), { axis: 'x', off: () => [cy, 0], nu: 30, nv: 6, color: grime(0.2) }), steel, { p: [0.1, 0, 0] });
    const thr = (u, v, t) => { const x = v * 0.29; const f = (x * 110 - t / TAU) % 1; return 1 + 0.16 * Math.abs(((f + 1) % 1) * 2 - 1); };
    add(g, revolve(along([[-0.19, 0.0], [-0.188, 0.018], [-0.183, 0.028], [-0.17, 0.03], [0.1, 0.03]]), { axis: 'x', off: () => [cy, 0], nu: 40, nv: 160, mod: (u, v, t) => (v > 0.05 && v < 0.9 ? thr(u, v, t) : 1), color: (u, v, p) => { const C = grime(0.35)(u, v, p); return thr(u, v, u * TAU) < 1.04 ? shadeC(C, -0.35) : C; } }), steel);
    add(g, hex(0.062, 0.042, 0.03), fmat('nut', { color: shadeC(B, -0.1), vc: false, rough: 0.35, metal: 0.9, flat: true }), { p: [-0.08, cy, 0], r: [Math.PI / 2, 0, 0] });
    return g;
  },

  crystal(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2), C3 = col(I.c3);
    add(g, blob(0.1, 0.045, 0.075, { lump: 0.25, lf: 4, seed: 5, color: (u, v, p) => jit(mixc(C3, B, noise(p[0] * 80, p[1] * 80, p[2] * 80) * 0.6), p, 100, 0.2) }), fmat('sugarrock', { rough: 0.8, flat: true, sheen: 0.5 }), { p: [0, 0.03, 0] });
    const prism = (r, h) => { const lg = new THREE.LatheGeometry([[0, 0], [r * 0.85, 0], [r, h * 0.08], [r, h], [0, h + r * 1.4]].map(([x, y]) => new THREE.Vector2(x, y)), 6); return lg; };
    const cm = fmat('crystal', { vc: false, color: I.c1, rough: 0.06, clear: 1, clearRough: 0.02, iri: 0.9, opacity: 0.86, emissive: I.c1, ei: 0.12, flat: true });
    const cm2 = fmat('crystal2', { vc: false, color: I.c2, rough: 0.06, clear: 1, iri: 0.9, opacity: 0.86, emissive: I.c2, ei: 0.1, flat: true });
    [[0.0, 0.03, 0.0, 0.038, 0.22, [0, 0, -1.25]], [-0.05, 0.035, 0.03, 0.03, 0.17, [0.4, 0, 1.3]], [0.03, 0.04, -0.04, 0.028, 0.14, [-0.7, 0.4, -0.7]], [-0.02, 0.05, -0.02, 0.022, 0.12, [-0.3, 0, 0.3]], [0.05, 0.03, 0.04, 0.02, 0.1, [0.9, 0, -0.5]], [-0.07, 0.02, -0.03, 0.022, 0.11, [-0.9, 0, 1.0]]].forEach(([x, y, z, r, h, rot], i) => add(g, prism(r, h), i % 2 ? cm2 : cm, { p: [x, y, z], r: rot }));
    return g;
  },

  sack(I) {
    const g = new THREE.Group(), A = col(I.c1), B = col(I.c2), C3 = col(I.c3);
    const P = profile([[0.0, 0.0], [0.1, 0.004], [0.135, 0.035], [0.142, 0.1], [0.13, 0.165], [0.085, 0.21], [0.045, 0.232], [0.05, 0.25], [0.075, 0.28], [0.082, 0.3]]);
    const sackF = (u, v) => { const [r0, h] = P(v), t = u * TAU; const wr = 1 + 0.07 * Math.sin(14 * t + v * 3) * smooth(0.55, 0.75, v) * smooth(0.98, 0.82, v) + (fbm(Math.cos(t) * 2, Math.sin(t) * 2, h * 12) - 0.5) * 0.1; const r = r0 * wr; return [Math.cos(t) * r, h, Math.sin(t) * r * 0.82]; };
    add(g, surf(sackF, { nu: 64, nv: 48, uv: [10, 6], color: (u, v, p) => { let C = jit(A, p, 25, 0.15); if (fbm(p[0] * 12, p[1] * 12, p[2] * 12) > 0.62) C = mixc(C, 0x8a7a5a, 0.3); if (p[1] > 0.12 && fbm(p[0] * 9 + 2, p[1] * 9, p[2] * 9) > 0.58) C = mixc(C, B, 0.5); return C; } }), fmat('burlap', { rough: 0.95, side: 'double', bump: bumpTex('weave', [14, 8]), bumpScale: 1.5, sheen: 0.4, sheenColor: 0xd8c8a8 }));
    // flour peeking out of the open top
    add(g, revolve(along([[0.0, 0.068], [0.012, 0.055], [0.024, 0.03], [0.03, 0.0]]), { nu: 24, nv: 8, mod: (u, v, t) => 1 + noise(Math.cos(t) * 3, Math.sin(t) * 3) * 0.2, color: () => col(I.c2) }), fmat('flour', { rough: 1, sheen: 0.5 }), { p: [0, 0.262, 0], s: [1, 1, 0.8], ns: true });
    // rope tie round the neck, twisted, with two loose ends
    const rope = tube(curve(Array.from({ length: 17 }, (_, i) => { const a = i / 16 * TAU; return [Math.cos(a) * 0.05, 0.233 + Math.sin(a * 3) * 0.002, Math.sin(a) * 0.043]; }), true), () => 0.006, { nu: 10, nv: 80, mod: (u, v) => 1 + 0.2 * Math.abs(Math.sin(u * TAU * 1.5 + v * 140)), color: (u, v) => mixc(0xc8a870, 0x8a6a40, Math.abs(Math.sin(u * TAU * 1.5 + v * 140))) });
    add(g, rope, fmat('twine', { rough: 0.9 }), { ns: true });
    for (const s of [-1, 1]) add(g, tube(curve([[0.04 * s, 0.23, 0.045], [0.06 * s, 0.2, 0.07], [0.05 * s, 0.16, 0.085]]), capped(() => 0.005, 0.0001, 0.1), { nu: 8, nv: 12, color: () => col(0xb8986a) }), fmat('twine', { rough: 0.9 }), { ns: true });
    // stencilled label on the front
    const lbl = ctex(`sack:${I.id}`, 256, (c, S) => {
      c.clearRect(0, 0, S, S); c.globalAlpha = 0.82; c.strokeStyle = c.fillStyle = css(C3);
      c.lineWidth = 7; c.beginPath(); c.arc(S / 2, S * 0.36, S * 0.2, 0, TAU); c.stroke();
      c.lineWidth = 6; c.beginPath(); c.moveTo(S / 2, S * 0.36); c.lineTo(S / 2, S * 0.22); c.moveTo(S / 2, S * 0.36); c.lineTo(S * 0.6, S * 0.42); c.stroke();
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.fillRect(S / 2 + Math.cos(a) * S * 0.16 - 2, S * 0.36 + Math.sin(a) * S * 0.16 - 2, 4, 4); }
      c.font = `900 ${S * 0.17}px Georgia, serif`; c.textAlign = 'center'; c.fillText('FLOUR', S / 2, S * 0.8);
      c.globalCompositeOperation = 'destination-out'; const r = rng(6); for (let i = 0; i < 500; i++) { c.globalAlpha = r() * 0.6; c.fillRect(r() * S, r() * S, 2 + r() * 3, 2 + r() * 3); }
    });
    add(g, surf((u, v) => { const t = lerp(Math.PI / 2 - 0.55, Math.PI / 2 + 0.55, 1 - u); const vv = lerp(0.2, 0.55, v); const p = sackF(t / TAU, vv); const k = 1.012; return [p[0] * k, p[1], p[2] * k]; }, { nu: 16, nv: 12 }), fmat('label', { vc: false, map: lbl, rough: 0.95, opacity: 0.999, depthWrite: false }), { ns: true });
    return g;
  },

  cream(I) {
    const g = new THREE.Group(), C3 = col(I.c3);
    const H = 0.2, R = 0.08;
    // glass jar (outer + inner wall), the cream inside, gold lid
    add(g, revolve(profile([[0.0, 0.0], [R - 0.01, 0.0], [R, 0.012], [R, H - 0.02], [R - 0.012, H - 0.008], [R - 0.012, H]]), { nu: 48, nv: 16, color: () => col(0xeef6f8) }), fmat('glass', { rough: 0.04, clear: 1, opacity: 0.32, depthWrite: false }));
    add(g, revolve(profile([[0.0, 0.006], [R - 0.008, 0.006], [R - 0.006, 0.015], [R - 0.006, H - 0.045], [R * 0.5, H - 0.038], [0, H - 0.036]]), { nu: 40, nv: 12, color: (u, v, p) => mixc(col(I.c1), 0xffffff, 0.3 + noise(p[0] * 50, p[1] * 50, p[2] * 50) * 0.2) }), fmat('creamfill', { rough: 0.35, clear: 0.3, sheen: 0.3 }));
    add(g, revolve(profile([[R - 0.008, -0.002], [R + 0.004, 0.0], [R + 0.006, 0.026], [R - 0.004, 0.032], [0, 0.034]]), { nu: 60, nv: 8, mod: (u, v, t) => (v < 0.6 ? 1 + 0.02 * Math.max(0, Math.sin(t * 40)) : 1), color: () => C3 }), fmat('lid', { rough: 0.25, metal: 0.9, clear: 0.4 }), { p: [0, H - 0.016, 0], ns: true });
    const lbl = ctex(`cream:${I.id}`, 256, (c, S) => {
      c.fillStyle = '#f6eedc'; c.fillRect(0, 0, S, S); c.strokeStyle = css(C3); c.lineWidth = 6; c.strokeRect(10, 10, S - 20, S - 20);
      c.fillStyle = css(0x5a3a2a); c.font = `italic 700 ${S * 0.2}px Georgia, serif`; c.textAlign = 'center'; c.fillText('Chrono', S / 2, S * 0.48); c.font = `700 ${S * 0.14}px Georgia, serif`; c.fillText('CREAM', S / 2, S * 0.72);
    });
    add(g, surf((u, v) => { const t = lerp(Math.PI / 2 - 0.9, Math.PI / 2 + 0.9, 1 - u); return [Math.cos(t) * (R + 0.002), lerp(0.05, 0.13, v), Math.sin(t) * (R + 0.002)]; }, { nu: 20, nv: 4 }), fmat('label', { vc: false, map: lbl, rough: 0.8 }), { ns: true });
    return g;
  },
};
RAW.starmelon = RAW.melon;

/** Chopped-state specials (instead of slices): sugar shards, a heap of flour, piped cream. */
export const CHOPPED = {
  crystal(I) {
    const g = new THREE.Group(), r = rng(31);
    const cm = fmat('crystal', { vc: false, color: I.c1, rough: 0.06, clear: 1, clearRough: 0.02, iri: 0.9, opacity: 0.86, emissive: I.c1, ei: 0.12, flat: true });
    for (let i = 0; i < 9; i++) {
      const lg = new THREE.LatheGeometry([[0, 0], [1, 0.1], [1, 1], [0, 1.6]].map(([x, y]) => new THREE.Vector2(x, y)), 6);
      const s = 0.012 + r() * 0.012;
      add(g, lg, i % 3 ? cm : fmat('crystal2', { vc: false, color: I.c2, rough: 0.06, clear: 1, iri: 0.9, opacity: 0.86, emissive: I.c2, ei: 0.1, flat: true }), { p: [(r() - 0.5) * 0.22, s, (r() - 0.5) * 0.16], r: [r() * 3, r() * 3, Math.PI / 2 + (r() - 0.5)], s: [s, s * (2 + r() * 2), s] });
    }
    const grains = [];
    for (let i = 0; i < 90; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 0.13; const b = new THREE.BoxGeometry(0.006, 0.006, 0.006); b.rotateX(r() * 3); b.rotateY(r() * 3); b.translate(Math.cos(a) * d * 1.3, 0.003 + (0.13 - d) * 0.15 * r(), Math.sin(a) * d); grains.push(b); }
    add(g, mergeGeometries(grains), fmat('sugar', { vc: false, color: 0xffffff, rough: 0.1, clear: 1, emissive: I.c2, ei: 0.15 }));
    return g;
  },
  sack(I) {
    const g = new THREE.Group();
    add(g, revolve(along([[0.0, 0.085], [0.02, 0.075], [0.048, 0.04], [0.07, 0.012], [0.078, 0.0]]), { nu: 48, nv: 16, mod: (u, v, t) => 1 + (fbm(Math.cos(t) * 2, Math.sin(t) * 2, v * 3) - 0.5) * 0.25, color: (u, v, p) => jit(col(I.c2), p, 60, 0.04) }), fmat('flour', { rough: 1, sheen: 0.5 }), { s: [1.6, 1, 1.25] });
    add(g, blob(0.012, 0.01, 0.012, { color: () => col(I.c3) }), fmat('flourcharm', { rough: 0.3, metal: 0.5 }), { p: [0.03, 0.086, 0.02] });
    return g;
  },
  cream(I) {
    const g = new THREE.Group();
    [[0, 0, 1], [-0.1, 0.03, 0.75], [0.09, -0.04, 0.8]].forEach(([x, z, s]) => add(g, dollop(I), fmat('whip', { rough: 0.5, sheen: 0.4 }), { p: [x, 0, z], s }));
    return g;
  },
};
/** a piped swirl of whipped cream */
export function dollop(I, h = 0.12, r = 0.07) {
  return revolve(along([[0, r], [0.25, r * 0.9], [0.55, r * 0.6], [0.8, r * 0.3], [0.95, r * 0.1], [1, 0.0]]), { nu: 64, nv: 40, mod: (u, v, t) => 1 + 0.13 * Math.cos(8 * t + v * 9), off: (v) => [0, 0], color: (u, v, p) => mixc(col(I.c2), col(I.c1), Math.abs(Math.cos(8 * u * TAU + v * 9)) * 0.3) }).scale(1, h, 1);
}

/**
 * Cross-section of each food for the slices: pat (cap texture pattern), n (superellipse exponent, 2 =
 * ellipse), lobes / la (scalloped outline), hole (hollow ring, inner radius).
 */
export const SECTION = {
  fish: { pat: 'fish' }, tentacle: { pat: 'tentacle' }, potato: { pat: 'potato' }, kelp: { pat: 'kelp', n: 3 }, shrimp: { pat: 'shrimp' },
  mushroom: { pat: 'mushroom', mush: true }, corn: { pat: 'corn', lobes: 14, la: 0.03 }, drumbone: { pat: 'meatbone' }, pepper: { pat: 'pepper', lobes: 4, la: 0.08, hole: 0.82 },
  steak: { pat: 'steak', n: 3.5 }, root: { pat: 'carrot' }, spore: { pat: 'spore', lobes: 11, la: 0.04 }, bean: { pat: 'bean' }, cheese: { pat: 'cheese', n: 6 },
  bread: { pat: 'bread', n: 3 }, tomato: { pat: 'tomato', lobes: 5, la: 0.03 }, lemon: { pat: 'citrus' }, poultry: { pat: 'poultry' }, melon: { pat: 'melon' },
  starmelon: { pat: 'melon' }, leek: { pat: 'leek' }, frogleg: { pat: 'frog' }, nut: { pat: 'nut' }, mango: { pat: 'mango' }, bolt: { pat: 'bolt', lobes: 6, la: 0.06 },
  crystal: { pat: 'crystal', lobes: 6, la: 0.1 }, sack: { pat: 'flour', n: 2.5 }, cream: { pat: 'cream' },
};
