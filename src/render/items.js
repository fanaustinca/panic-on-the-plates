// 3D models for every ingredient (raw / chopped / cooked / burnt), plates and the extinguisher, plus
// the chopping rig. The foods themselves are modelled in foods.js; mat() / part() and the primitive
// geometries below are the simple shared kit the stations and props use.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { INGREDIENTS } from '../config.js';
import { RAW, CHOPPED, SECTION, dollop } from './foods.js';
import { capTexture, skinColor, outline } from './sections.js';
import { TAU, clamp, once as onceG, fmat, ctex, rng, col, mixc, css, revolve, profile, noise } from './geo.js';

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

// ---------------------------------------------------------------- ingredients
// Whole foods come from foods.js. Cutting is modelled for real: each food is divided into N slices across
// its length, each slice shaped from the food's own cross-section there (measured from the model) with
// the inside painted on its cut faces and the end pieces rounded like the skin they came from.
const once = (k, make) => onceG(k, make);
const rawTemplate = (ing) => once('raw:' + ing, () => { const I = INGREDIENTS[ing]; return (RAW[I.shape] || RAW.potato)(I); });

/** measure a food along x: its slices and the cross-section size at any x */
function anatomy(ing) {
  return once('anat:' + ing, () => {
    const I = INGREDIENTS[ing], sec = SECTION[I.shape] || {}, g = rawTemplate(ing);
    g.updateMatrixWorld(true);
    const pts = [], v = new THREE.Vector3();
    g.traverse((m) => {
      if (!m.isMesh || m.userData.noslice) return;
      const p = m.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / 5000));
      for (let i = 0; i < p.count; i += step) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); pts.push(v.x, v.y, v.z); }
    });
    let xmin = Infinity, xmax = -Infinity;
    for (let i = 0; i < pts.length; i += 3) { xmin = Math.min(xmin, pts[i]); xmax = Math.max(xmax, pts[i]); }
    const NB = 48, L = xmax - xmin, bins = Array.from({ length: NB }, () => [Infinity, -Infinity, Infinity, -Infinity]);
    for (let i = 0; i < pts.length; i += 3) {
      const b = bins[clamp(Math.floor((pts[i] - xmin) / L * NB), 0, NB - 1)];
      b[0] = Math.min(b[0], pts[i + 1]); b[1] = Math.max(b[1], pts[i + 1]); b[2] = Math.min(b[2], pts[i + 2]); b[3] = Math.max(b[3], pts[i + 2]);
    }
    for (let i = 1; i < NB; i++) if (bins[i][0] === Infinity) bins[i] = bins[i - 1].slice();
    for (let i = NB - 2; i >= 0; i--) if (bins[i][0] === Infinity) bins[i] = bins[i + 1].slice();
    const range = (x0, x1) => {
      const a = clamp(Math.floor((x0 - xmin) / L * NB), 0, NB - 1), b = clamp(Math.floor((x1 - xmin) / L * NB - 1e-6), a, NB - 1);
      const e = [Infinity, -Infinity, Infinity, -Infinity];
      for (let i = a; i <= b; i++) { e[0] = Math.min(e[0], bins[i][0]); e[1] = Math.max(e[1], bins[i][1]); e[2] = Math.min(e[2], bins[i][2]); e[3] = Math.max(e[3], bins[i][3]); }
      return { ymin: e[0], cy: (e[0] + e[1]) / 2, ry: Math.max(0.004, (e[1] - e[0]) / 2), cz: (e[2] + e[3]) / 2, rz: Math.max(0.004, (e[3] - e[2]) / 2) };
    };
    const N = clamp(Math.round(L / 0.05), 5, 8), t = L / N;
    const sl = Array.from({ length: N }, (_, j) => { const x1 = xmax - j * t, x0 = x1 - t; return { x: (x0 + x1) / 2, ...range(x0, x1) }; });
    return { I, sec, N, t, xmin, xmax, L, sl, at: (x) => range(x - t * 0.25, x + t * 0.25) };
  });
}

/**
 * One slice: unit thickness along x (-0.5..0.5), outline [[y, z]] in -1..1, optional hole, dome = 1 / -1
 * rounds the +x / -x face into skin (the end pieces). Group 0 is the cut faces, group 1 the skin.
 */
function sliceGeo(out, hole, dome) {
  const P = [[], []], N = [[], []], U = [[], []];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), w = new THREE.Vector3();
  const tri = (gi, ps, ns, us) => {
    a.fromArray(ps[0]); b.fromArray(ps[1]).sub(a); c.fromArray(ps[2]).sub(a);
    w.fromArray(ns[0]).add(a.fromArray(ns[1])).add(a.fromArray(ns[2]));
    const ord = b.cross(c).dot(w) < 0 ? [0, 2, 1] : [0, 1, 2];
    for (const k of ord) { P[gi].push(...ps[k]); N[gi].push(...ns[k]); U[gi].push(...us[k]); }
  };
  const normals2 = (o) => {
    let area = 0;
    for (let i = 0; i < o.length; i++) { const p = o[i], q = o[(i + 1) % o.length]; area += p[1] * q[0] - q[1] * p[0]; }
    const sgn = area > 0 ? 1 : -1;
    return o.map((p, i) => { const pa = o[(i - 1 + o.length) % o.length], pb = o[(i + 1) % o.length]; const dy = pb[0] - pa[0], dz = pb[1] - pa[1]; const l = Math.hypot(dy, dz) || 1; return [(-dz / l) * sgn, (dy / l) * sgn]; });
  };
  const n2 = normals2(out), n = out.length, bev = 0.16, ins = 0.955;
  const rings = [];
  const dm = (k, side) => { const f = k / 6 * Math.PI / 2; return { x: side * 0.5 * Math.sin(f), s: Math.cos(f), nx: side * Math.sin(f) }; };
  if (dome === -1) { for (let k = 6; k >= 1; k--) rings.push(dm(k, -1)); rings.push({ x: 0, s: 1, nx: 0 }); }
  else rings.push({ x: -0.5, s: ins, nx: -0.75 }, { x: -0.5 + bev, s: 1, nx: 0 });
  if (dome === 1) { rings.push({ x: 0, s: 1, nx: 0 }); for (let k = 1; k <= 6; k++) rings.push(dm(k, 1)); }
  else rings.push({ x: 0.5 - bev, s: 1, nx: 0 }, { x: 0.5, s: ins, nx: 0.75 });
  const rp = (r, i) => [r.x, out[i][0] * r.s, out[i][1] * r.s];
  const rn = (r, i) => { const k = Math.sqrt(1 - r.nx * r.nx); return [r.nx, n2[i][0] * k, n2[i][1] * k]; };
  for (let q = 0; q < rings.length - 1; q++) {
    const r0 = rings[q], r1 = rings[q + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const p = [rp(r0, i), rp(r0, j), rp(r1, j), rp(r1, i)], nn = [rn(r0, i), rn(r0, j), rn(r1, j), rn(r1, i)];
      const uu = [[i / n, r0.x + 0.5], [(i + 1) / n, r0.x + 0.5], [(i + 1) / n, r1.x + 0.5], [i / n, r1.x + 0.5]];
      tri(1, [p[0], p[1], p[2]], [nn[0], nn[1], nn[2]], [uu[0], uu[1], uu[2]]);
      tri(1, [p[0], p[2], p[3]], [nn[0], nn[2], nn[3]], [uu[0], uu[2], uu[3]]);
    }
  }
  const caps = [];
  if (dome !== 1) caps.push([0.5, 1]);
  if (dome !== -1) caps.push([-0.5, -1]);
  const contour = out.map(([y, z]) => new THREE.Vector2(z * ins, y * ins));
  const holes = hole ? [hole.map(([y, z]) => new THREE.Vector2(z, y))] : [];
  const all = [...contour, ...holes.flat()];
  const faces = THREE.ShapeUtils.triangulateShape(contour, holes);
  for (const [x, nx] of caps) {
    for (const f of faces) {
      const ps = f.map((k) => [x, all[k].y, all[k].x]);
      const us = f.map((k) => { const s = k < contour.length ? ins : 1; return [all[k].x / s * 0.5 + 0.5, all[k].y / s * 0.5 + 0.5]; });
      tri(0, ps, [[nx, 0, 0], [nx, 0, 0], [nx, 0, 0]], us);
    }
  }
  if (hole) {
    const hn = normals2(hole);
    for (let i = 0; i < hole.length; i++) {
      const j = (i + 1) % hole.length;
      const p = [[-0.5, hole[i][0], hole[i][1]], [-0.5, hole[j][0], hole[j][1]], [0.5, hole[j][0], hole[j][1]], [0.5, hole[i][0], hole[i][1]]];
      const nn = [i, j, j, i].map((k) => [0, -hn[k][0], -hn[k][1]]);
      const uu = [[0, 0], [1, 0], [1, 1], [0, 1]];
      tri(1, [p[0], p[1], p[2]], [nn[0], nn[1], nn[2]], [uu[0], uu[1], uu[2]]);
      tri(1, [p[0], p[2], p[3]], [nn[0], nn[2], nn[3]], [uu[0], uu[2], uu[3]]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([...P[0], ...P[1]], 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute([...N[0], ...N[1]], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([...U[0], ...U[1]], 2));
  geo.addGroup(0, P[0].length / 3, 0); geo.addGroup(P[0].length / 3, P[1].length / 3, 1);
  geo.computeBoundingSphere();
  return geo;
}
/** a mushroom slice is T-shaped: cap on top, stem below (if the cut passes through the stem) */
function mushOutline(s) {
  const yU = clamp((0.142 - s.cy) / s.ry, -1, 0.9), ws = Math.sqrt(Math.max(0, 0.047 * 0.047 - s.x * s.x)) / s.rz;
  const pts = [];
  const stem = ws > 0.06 && yU > -0.9;
  if (stem) pts.push([-1, ws], [yU, ws]);
  for (let k = 0; k <= 28; k++) { const f = k / 28 * Math.PI; pts.push([stem || k % 28 ? (yU + (1 - yU) * Math.pow(Math.sin(f), 0.65)) : yU, Math.cos(f) * 0.98]); }
  if (stem) pts.push([yU, -ws], [-1, -ws]);
  return pts.reverse();
}

function sliceMats(I, variant) {
  return once(`smat:${I.id}:${variant}`, () => {
    const sec = SECTION[I.shape] || {}, map = capTexture(I, sec, variant), burnt = variant === 'burnt', metal = I.shape === 'bolt';
    const cap = new THREE.MeshPhysicalMaterial({ map, roughness: burnt ? 0.95 : metal ? 0.3 : 0.4, metalness: metal ? 0.85 : 0, clearcoat: burnt || metal ? 0 : 0.6, clearcoatRoughness: 0.25, emissive: burnt ? 0xffffff : 0x000000, emissiveMap: burnt ? map : null, emissiveIntensity: 0.5 });
    const skin = new THREE.MeshPhysicalMaterial({ color: skinColor(I, variant), roughness: burnt ? 0.95 : 0.4, metalness: metal ? 0.85 : 0, clearcoat: burnt ? 0 : 0.5, clearcoatRoughness: 0.3 });
    return [cap, skin];
  });
}
function sliceMesh(an, j, variant = 'raw') {
  const s = an.sl[j], dome = j === 0 ? 1 : j === an.N - 1 ? -1 : 0, sec = an.sec;
  const geo = sec.mush ? once(`mushgeo:${an.I.id}:${j}`, () => sliceGeo(mushOutline(s), null, dome))
    : once(`slicegeo:${an.I.shape}:${dome}`, () => sliceGeo(outline(sec), sec.hole ? outline(sec, 72, sec.hole) : null, dome));
  const m = new THREE.Mesh(geo, sliceMats(an.I, variant));
  m.scale.set(an.t, s.ry, s.rz);
  m.castShadow = m.receiveShadow = true;
  return m;
}
/**
 * Where slice j sits once c slices have been cut off: cut slices lean away from the blade with a gap
 * between them, the first end piece lies on its back, and the uncut remainder shifts so the whole row
 * stays centred. c = N is the finished, fully sliced food.
 */
function pose(an, j, c, lean = 0.5, gap = 0.02) {
  const s = an.sl[j], N = an.N, t = an.t, ng = Math.min(c, N - 1);
  const right = (an.xmin + an.xmax) / 2 + (an.L + gap * ng) / 2;
  if (j < c) {
    const l = j === 0 ? 1.3 : lean;
    return { x: right - j * (t + gap) - t / 2 + (j === 0 ? s.ry * 0.45 : 0), y: s.ymin + s.ry * Math.cos(l) + (t / 2) * Math.sin(l), z: s.cz, r: -l };
  }
  return { x: s.x - (c < N ? (c * gap) / 2 : 0), y: s.cy, z: s.cz, r: 0 };
}
const rawShift = (an, c) => -(Math.min(c, an.N - 1) * 0.02) / 2;

function slicedTemplate(ing, variant = 'raw') {
  const an = anatomy(ing), g = new THREE.Group();
  for (let j = 0; j < an.N; j++) { const m = sliceMesh(an, j, variant), p = pose(an, j, an.N); m.position.set(p.x, p.y, p.z); m.rotation.z = p.r; g.add(m); }
  return g;
}
/** replace every material in a group with charcoal (burnt specials) */
function char(g) {
  const M = new THREE.MeshPhysicalMaterial({ color: 0x17120f, roughness: 0.95, emissive: 0x6a1a04, emissiveIntensity: 0.25 });
  g.traverse((m) => { if (m.isMesh) m.material = M; });
  return g;
}

// ---------------------------------------------------------------- cooked dishes
const glaze = (k, o) => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, ...o });
/** colour a lathe by radius / height / facing */
function paintLathe(geo, fn) {
  const p = geo.attributes.position, nrm = geo.attributes.normal, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const C = fn(Math.hypot(p.getX(i), p.getZ(i)), p.getY(i), nrm.getY(i), p.getX(i), p.getZ(i)); c.set([C.r, C.g, C.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg);
const meshOf = (geo, m, pos, rot, scl) => { const o = new THREE.Mesh(geo, m); if (pos) o.position.set(...pos); if (rot) o.rotation.set(...rot); if (scl) o.scale.set(...scl); o.castShadow = o.receiveShadow = true; return o; };
function herbs(n, spread, y, seed = 1) {
  const r = rng(seed), parts = [];
  for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.sqrt(r()) * spread; const b = new THREE.BoxGeometry(0.008 + r() * 0.008, 0.0015, 0.005 + r() * 0.006); b.rotateY(r() * 3); b.rotateX((r() - 0.5) * 0.4); b.translate(Math.cos(a) * d, y + r() * 0.004, Math.sin(a) * d); parts.push(b); }
  return meshOf(mergeGeometries(parts), new THREE.MeshPhysicalMaterial({ color: 0x3a7a2a, roughness: 0.5, clearcoat: 0.3 }));
}

function bowl() {
  return once('bowl', () => paintLathe(lathe([[0, 0.0], [0.082, 0.0], [0.088, 0.006], [0.084, 0.013], [0.12, 0.035], [0.16, 0.07], [0.185, 0.104], [0.19, 0.116], [0.186, 0.121], [0.178, 0.116], [0.158, 0.085], [0.12, 0.048], [0.06, 0.03], [0, 0.028]], 56),
    (r, y, ny) => (y > 0.108 && r > 0.18 ? col(0x2a4a7a) : y > 0.02 && y < 0.03 && r > 0.08 && ny < 0 ? col(0x2a4a7a) : ny > 0.2 && r < 0.18 && y > 0.026 ? col(0xf6f0e4) : col(0xe8dcc6))));
}
function soupTex(I, burnt) {
  return ctex(`soup:${I.id}:${burnt ? 1 : 0}`, 256, (c, S) => {
    const r = rng(7), base = burnt ? 0x2a1a10 : mixc(I.c1, I.c2, 0.45);
    const g = c.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S / 2); g.addColorStop(0, css(base, 0.08)); g.addColorStop(1, css(base, -0.25));
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) { const x = r() * S, y = r() * S, rr = 1 + r() * r() * 7; c.strokeStyle = burnt ? 'rgba(0,0,0,0.5)' : 'rgba(255,240,200,0.55)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.stroke(); }
    for (let i = 0; i < 260; i++) { c.fillStyle = burnt ? 'rgba(10,8,6,0.6)' : `rgba(${r() < 0.5 ? '120,60,20' : '255,255,255'},${0.15 * r()})`; c.fillRect(r() * S, r() * S, 2, 2); }
    if (burnt) for (let i = 0; i < 10; i++) { c.strokeStyle = '#ff5a10'; c.lineWidth = 1.5; c.beginPath(); let x = r() * S, y = r() * S; c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; c.lineTo(x, y); } c.stroke(); }
  });
}
/** the slices worth plating: middle cuts, largest first (no end pieces or bone-only slivers) */
function bestSlices(an) {
  const mid = an.sl.map((s, j) => [j, s.ry * s.rz]).filter(([j]) => j > 0 && j < an.N - 1).sort((a, b) => b[1] - a[1]);
  const top = mid.filter(([, a]) => a > mid[0][1] * 0.35).map(([j]) => j);
  return (i) => top[i % top.length];
}
/** pan: seared slices fanned flat in a little pool of glaze */
function panDish(ing, variant) {
  const an = anatomy(ing), I = an.I, g = new THREE.Group(), burnt = variant === 'burnt';
  const jus = ctex(`jus:${burnt ? 1 : 0}`, 128, (c, S) => { const gr = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, burnt ? 'rgba(20,12,8,0.9)' : 'rgba(120,60,20,0.8)'); gr.addColorStop(0.75, burnt ? 'rgba(20,12,8,0.7)' : 'rgba(150,80,30,0.5)'); gr.addColorStop(1, 'rgba(150,80,30,0)'); c.fillStyle = gr; c.fillRect(0, 0, S, S); });
  const pool = meshOf(new THREE.CircleGeometry(0.17, 40), new THREE.MeshPhysicalMaterial({ map: jus, transparent: true, depthWrite: false, roughness: 0.1, clearcoat: 1 }), [0, 0.003, 0], [-Math.PI / 2, 0, 0]);
  pool.castShadow = false; g.add(pool);
  const k = Math.min(1, 0.075 / Math.max(...an.sl.map((s) => Math.max(s.ry, s.rz)))) * 1.05, pick = bestSlices(an);
  for (let j = 0; j < 6; j++) {
    const m = sliceMesh(an, pick(j), burnt ? 'burnt' : 'seared'), a = j / 6 * TAU + 0.3;
    m.scale.multiplyScalar(k); m.scale.x = an.t * 0.6;
    const R = 0.07;
    m.position.set(Math.cos(a) * R, an.t * 0.3 + 0.006 + j * 0.004, Math.sin(a) * R);
    m.rotation.set(0, -a + 0.4, Math.PI / 2 - 0.16);
    g.add(m);
  }
  if (!burnt) g.add(herbs(14, 0.12, 0.03, 3));
  return g;
}
/** pot: a glazed bowl of stew with a few poached pieces floating */
function potDish(ing, variant) {
  const I = INGREDIENTS[ing], g = new THREE.Group(), burnt = variant === 'burnt';
  g.add(meshOf(bowl(), glaze('bowl')));
  g.add(meshOf(new THREE.CircleGeometry(0.168, 48), new THREE.MeshPhysicalMaterial({ map: soupTex(I, burnt), roughness: burnt ? 0.8 : 0.12, clearcoat: burnt ? 0 : 1, clearcoatRoughness: 0.05 }), [0, 0.094, 0], [-Math.PI / 2, 0, 0]));
  if (CHOPPED[I.shape]) {
    if (I.shape === 'cream' && !burnt) { const d = new THREE.Mesh(dollop(I, 0.06, 0.05), fmatW('whip')); d.position.y = 0.09; d.castShadow = true; g.add(d); }
  } else {
    const an = anatomy(ing), k = Math.min(0.6, 0.045 / Math.max(...an.sl.map((s) => Math.max(s.ry, s.rz)))), pick = bestSlices(an);
    [[0.06, 0.02, 0.3], [-0.05, 0.06, 1.7], [-0.03, -0.065, 3.1], [0.075, -0.06, 4.6]].forEach(([x, z, a], i) => {
      const m = sliceMesh(an, pick(i), burnt ? 'burnt' : 'poached');
      m.scale.multiplyScalar(k); m.scale.x = an.t * 0.6;
      m.position.set(x, 0.094, z); m.rotation.set(0, a, Math.PI / 2 - 0.2);
      g.add(m);
    });
  }
  if (!burnt) g.add(herbs(18, 0.13, 0.096, 5));
  return g;
}
/** oven: a gratin in an enamelled cast-iron dish, slices shingled in rows and browned on top */
function ovenDish(ing, variant) {
  const I = INGREDIENTS[ing], g = new THREE.Group(), burnt = variant === 'burnt';
  if (I.shape === 'sack') return cake(I, burnt);
  const dish = once('gratin', () => paintLathe(lathe([[0, 0], [0.15, 0], [0.163, 0.008], [0.172, 0.06], [0.188, 0.066], [0.19, 0.074], [0.176, 0.075], [0.161, 0.066], [0.152, 0.014], [0, 0.012]], 56), (r, y, ny) => (ny > 0.3 && r < 0.155 ? col(0xf0e4cc) : r > 0.16 && y > 0.058 && ny > -0.2 && r < 0.18 ? col(0x2a2420) : col(0x9a2a22))));
  g.add(meshOf(dish, glaze('dish', { roughness: 0.25 }), null, null, [1.25, 1, 0.92]));
  for (const s of [-1, 1]) g.add(meshOf(once('lug', () => new THREE.TorusGeometry(0.022, 0.007, 8, 16, Math.PI)), new THREE.MeshPhysicalMaterial({ color: 0x9a2a22, roughness: 0.25, clearcoat: 1 }), [s * 0.24, 0.058, 0], [Math.PI / 2, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2]));
  if (CHOPPED[I.shape]) return g;
  const an = anatomy(ing), k = Math.min(0.75, 0.05 / Math.max(...an.sl.map((s) => Math.max(s.ry, s.rz)))), pick = bestSlices(an);
  for (let row = 0; row < 2; row++) for (let j = 0; j < 6; j++) {
    const m = sliceMesh(an, pick(j + row), burnt ? 'burnt' : 'roast');
    m.scale.multiplyScalar(k); m.scale.x = an.t * 0.7;
    m.position.set(-0.13 + j * 0.052, 0.04, (row - 0.5) * 0.085); m.rotation.set(0, (row - 0.5) * 0.1, -0.95);
    g.add(m);
  }
  const r = rng(13), bits = [];
  for (let i = 0; i < 26; i++) bits.push(new THREE.SphereGeometry(0.012 + r() * 0.012, 8, 6).scale(1, 0.35, 1).translate((r() - 0.5) * 0.36, 0.055 + r() * 0.02, (r() - 0.5) * 0.18));
  g.add(meshOf(mergeGeometries(bits), new THREE.MeshPhysicalMaterial({ color: burnt ? 0x15100c : 0xd8a040, roughness: 0.35, clearcoat: 0.7 })));
  if (!burnt) g.add(herbs(16, 0.14, 0.07, 9));
  return g;
}
function cake(I, burnt) {
  const g = new THREE.Group();
  const geo = revolve(profile([[0.035, 0.0], [0.13, 0.0], [0.138, 0.05], [0.12, 0.095], [0.075, 0.108], [0.045, 0.098], [0.035, 0.06], [0.035, 0.0]]), { nu: 72, nv: 30, mod: (u, v, t) => 1 + 0.06 * Math.cos(12 * t) * Math.sin(Math.PI * clamp(v * 1.3)), color: (u, v, p) => {
    if (burnt) return col(0x17120f);
    const drip = 0.082 - 0.03 * Math.max(0, Math.sin(u * TAU * 7 + 1)) * Math.abs(Math.sin(u * TAU * 3));
    return p[1] > drip ? col(0xfaf6ee) : mixc(0xb8702a, 0xe0a050, noise(p[0] * 40, p[1] * 40, p[2] * 40));
  } });
  g.add(meshOf(geo, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, clearcoat: 0.5 })));
  if (!burnt) g.add(meshOf(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshPhysicalMaterial({ color: I.c3, roughness: 0.2, metalness: 0.6, clearcoat: 1 }), [0.1, 0.1, 0]));
  return g;
}
const fmatW = (k) => once('mat:' + k, () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, sheen: 0.4 }));

/** plated: the best slices shingled flat in a fan, the way a cook lays them out on a plate */
function platedTemplate(ing) {
  const an = anatomy(ing), g = new THREE.Group(), pick = bestSlices(an);
  const k = Math.min(1, 0.075 / Math.max(...an.sl.map((s) => Math.max(s.ry, s.rz))));
  for (let i = 0; i < 5; i++) {
    const m = sliceMesh(an, pick(i));
    const a = -0.9 + i * 0.45;
    m.scale.multiplyScalar(k); m.scale.x = an.t * 0.75;
    m.position.set(Math.sin(a) * 0.075, an.t * 0.3 + 0.008 + i * 0.006, Math.cos(a) * 0.075 - 0.04);
    m.rotation.set(0, a - Math.PI / 2, Math.PI / 2 - 0.22);
    g.add(m);
  }
  return g;
}

function template(ing, state) {
  return once(`tmpl:${ing}:${state}`, () => {
    const I = INGREDIENTS[ing];
    if (state === 'raw') return rawTemplate(ing);
    if (state === 'chopped') return CHOPPED[I.shape] ? CHOPPED[I.shape](I) : slicedTemplate(ing);
    if (state === 'plated') return CHOPPED[I.shape] ? CHOPPED[I.shape](I) : platedTemplate(ing);
    const variant = state === 'burnt' ? 'burnt' : 'cooked';
    const g = I.method === 'pot' ? potDish(ing, variant) : I.method === 'oven' ? ovenDish(ing, variant) : I.method === 'pan' && !CHOPPED[I.shape] ? panDish(ing, variant) : null;
    if (g) return g;
    return state === 'burnt' ? char(CHOPPED[I.shape] ? CHOPPED[I.shape](I) : slicedTemplate(ing, 'burnt')) : slicedTemplate(ing, 'seared');
  });
}

export function makeIngredient(ingId, state = 'raw') {
  const g = template(ingId, state).clone();
  g.userData.kind = 'ing';
  return g;
}

/**
 * Real chopping on the board: the knife takes the food apart slice by slice from its +x end. The
 * uncut part is the whole model clipped at the blade (with the inside showing on the cut face), the
 * cut slices tip over away from the blade, and when the last cut lands the layout matches the
 * finished 'chopped' model exactly.
 */
export class ChopRig {
  constructor(ing) {
    this.an = anatomy(ing);
    this.group = new THREE.Group();
    this.local = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    this.plane = new THREE.Plane();
    this.mats = [];
    this.raw = rawTemplate(ing).clone();
    this.raw.traverse((m) => {
      if (!m.isMesh) return;
      const one = (mt) => { const c = mt.clone(); c.clippingPlanes = [this.plane]; c.clipShadows = true; c.side = THREE.DoubleSide; this.mats.push(c); return c; };
      m.material = Array.isArray(m.material) ? m.material.map(one) : one(m.material);
    });
    this.group.add(this.raw);
    this.slices = Array.from({ length: this.an.N }, (_, j) => { const m = sliceMesh(this.an, j); m.visible = false; this.group.add(m); return { m, p: null }; });
    this.cap = null;
    this.c = 0;
  }
  update(k, dt = 1 / 60) {
    const an = this.an, N = an.N, c = Math.min(N - 1, Math.floor(clamp(k) * N));
    const f = 1 - Math.exp(-dt * 16);
    if (c !== this.c || !this.capSet) {
      for (let j = this.c; j < c; j++) { const s = this.slices[j], p = pose(an, j, this.c); s.p = { ...p }; s.m.visible = true; }
      this.c = c;
      if (this.cap) this.cap.removeFromParent();
      this.cap = c > 0 ? sliceMesh(an, c) : null;
      if (this.cap) { this.cap.scale.x = 0.003; this.raw.add(this.cap); }
      this.capSet = true;
    }
    // the remainder slides along with the row
    const want = rawShift(an, c);
    this.raw.position.x += (want - this.raw.position.x) * f;
    for (let j = 0; j < c; j++) {
      const s = this.slices[j], t = pose(an, j, c);
      s.p.x += (t.x - s.p.x) * f; s.p.y += (t.y - s.p.y) * f; s.p.r += (t.r - s.p.r) * f * 0.8;
      s.m.position.set(s.p.x, s.p.y, s.p.z); s.m.rotation.z = s.p.r;
    }
    const cut = an.xmax - c * an.t;
    if (this.cap) { const sc = an.sl[c]; this.cap.position.set(cut - 0.0015, sc.cy, sc.cz); }
    this.local.constant = cut;
    this.raw.updateWorldMatrix(true, false);
    this.plane.copy(this.local).applyMatrix4(this.raw.matrixWorld);
  }
  dispose() { for (const m of this.mats) m.dispose(); this.group.removeFromParent(); }
}

// ---------------------------------------------------------------- plates
function plateGeo() {
  return once('plategeo', () => paintLathe(lathe([[0, 0.0], [0.108, 0.0], [0.116, 0.005], [0.11, 0.01], [0.17, 0.017], [0.215, 0.03], [0.243, 0.04], [0.249, 0.044], [0.244, 0.047], [0.212, 0.037], [0.165, 0.021], [0.0, 0.019]], 72),
    (r, y, ny) => (ny > 0.2 && ((r > 0.226 && r < 0.231) || (r > 0.236 && r < 0.238)) ? col(0x2a4a8a) : col(ny > 0.2 ? 0xfbfaf6 : 0xeeebe4))));
}
function grime() {
  return ctex('grime', 256, (c, S) => {
    const r = rng(17);
    c.clearRect(0, 0, S, S);
    for (let i = 0; i < 5; i++) { const x = S * (0.3 + r() * 0.4), y = S * (0.3 + r() * 0.4), w = S * (0.1 + r() * 0.2); const g = c.createRadialGradient(x, y, 0, x, y, w); g.addColorStop(0, 'rgba(120,70,30,0.75)'); g.addColorStop(1, 'rgba(120,70,30,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(x, y, w, w * (0.4 + r() * 0.5), r() * 3, 0, TAU); c.fill(); }
    c.strokeStyle = 'rgba(110,60,25,0.6)'; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) { c.lineWidth = 3 + r() * 6; c.beginPath(); const a = r() * TAU; c.arc(S / 2, S / 2, S * (0.2 + r() * 0.15), a, a + 1 + r()); c.stroke(); }
    for (let i = 0; i < 80; i++) { const a = r() * TAU, d = r() * S * 0.4; c.fillStyle = `rgba(${r() < 0.5 ? '90,50,20' : '200,160,90'},0.9)`; c.fillRect(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 2 + r() * 3, 2 + r() * 3); }
  });
}
export function makePlate({ c = [], dirty = false, n = 1 } = {}) {
  const g = new THREE.Group();
  const pm = once('platemat:' + dirty, () => glaze('plate', dirty ? { color: 0xe0dccf, roughness: 0.4, clearcoat: 0.4 } : {}));
  const k = Math.min(n, 6);
  for (let i = 0; i < k; i++) {
    g.add(meshOf(plateGeo(), pm, [0, i * 0.027, 0]));
    if (dirty) { const d = meshOf(once('grimegeo', () => new THREE.CircleGeometry(0.2, 32)), once('grimemat', () => new THREE.MeshStandardMaterial({ map: grime(), transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 })), [0, 0.0195 + i * 0.027, 0], [-Math.PI / 2, 0, i]); d.castShadow = false; g.add(d); }
  }
  const top = 0.019 + (k - 1) * 0.027;
  const m = c.length;
  c.forEach((it, i) => {
    const o = makeIngredient(it.ing, it.s === 'chopped' ? 'plated' : it.s);
    const a = (i / Math.max(1, m)) * Math.PI * 2 + 0.6, r = m > 1 ? 0.1 : 0;
    o.position.set(Math.cos(a) * r, top, Math.sin(a) * r);
    o.scale.setScalar(m > 2 ? 0.55 : m > 1 ? 0.66 : 0.82);
    g.add(o);
  });
  g.userData.kind = 'plate';
  return g;
}

// ---------------------------------------------------------------- the extinguisher
export function makeExtinguisher() {
  const g = once('ext', () => {
    const g = new THREE.Group();
    const red = new THREE.MeshPhysicalMaterial({ color: 0xc81e1e, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
    const black = new THREE.MeshPhysicalMaterial({ color: 0x151515, roughness: 0.6 });
    const chrome = new THREE.MeshPhysicalMaterial({ color: 0xd8dde2, roughness: 0.15, metalness: 1 });
    g.add(meshOf(lathe([[0, 0.012], [0.1, 0.012], [0.108, 0.02], [0.11, 0.04], [0.11, 0.33], [0.103, 0.365], [0.075, 0.392], [0.04, 0.405], [0.028, 0.408], [0.028, 0.42]], 48), red));
    g.add(meshOf(lathe([[0.1, 0.0], [0.113, 0.0], [0.115, 0.03], [0.108, 0.034]], 48), black));
    g.add(meshOf(new THREE.CylinderGeometry(0.03, 0.032, 0.05, 20), chrome, [0, 0.44, 0]));
    g.add(meshOf(new RoundedBoxGeometry(0.17, 0.014, 0.032, 2, 0.006), black, [0.04, 0.47, 0], [0, 0, 0.12]));
    g.add(meshOf(new RoundedBoxGeometry(0.15, 0.014, 0.03, 2, 0.006), black, [0.045, 0.495, 0], [0, 0, 0.32]));
    g.add(meshOf(new THREE.TorusGeometry(0.012, 0.003, 6, 16), new THREE.MeshPhysicalMaterial({ color: 0xf0c020, metalness: 0.6, roughness: 0.3 }), [-0.03, 0.465, 0.018]));
    const dial = ctex('gauge', 128, (c, S) => { c.fillStyle = '#f4f4f0'; c.fillRect(0, 0, S, S); c.lineWidth = 14; c.strokeStyle = '#c82020'; c.beginPath(); c.arc(S / 2, S / 2, S * 0.36, Math.PI * 0.8, Math.PI * 1.15); c.stroke(); c.strokeStyle = '#2a9a2a'; c.beginPath(); c.arc(S / 2, S / 2, S * 0.36, Math.PI * 1.2, Math.PI * 1.8); c.stroke(); c.strokeStyle = '#111'; c.lineWidth = 4; c.beginPath(); c.moveTo(S / 2, S / 2); c.lineTo(S * 0.66, S * 0.26); c.stroke(); });
    g.add(meshOf(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 20), chrome, [0, 0.445, 0.034], [Math.PI / 2, 0, 0]));
    g.add(meshOf(new THREE.CircleGeometry(0.016, 20), new THREE.MeshPhysicalMaterial({ map: dial, roughness: 0.1, clearcoat: 1 }), [0, 0.445, 0.0405]));
    const hose = new THREE.CatmullRomCurve3([[0.025, 0.43, -0.01], [0.08, 0.42, -0.04], [0.115, 0.33, -0.05], [0.118, 0.2, -0.04], [0.118, 0.12, -0.02]].map((p) => new THREE.Vector3(...p)));
    g.add(meshOf(new THREE.TubeGeometry(hose, 40, 0.009, 10), black));
    g.add(meshOf(new THREE.CylinderGeometry(0.008, 0.014, 0.05, 12), black, [0.118, 0.1, -0.02]));
    const label = ctex('extlabel', 256, (c, S) => {
      c.fillStyle = '#f6f4ee'; c.fillRect(0, 0, S, S); c.fillStyle = '#c81e1e'; c.fillRect(0, 0, S, S * 0.14); c.fillRect(0, S * 0.86, S, S * 0.14);
      c.fillStyle = '#111'; c.font = `900 ${S * 0.2}px Arial, sans-serif`; c.textAlign = 'center'; c.fillText('FIRE', S / 2, S * 0.4);
      c.font = `700 ${S * 0.08}px Arial, sans-serif`; c.fillText('EXTINGUISHER', S / 2, S * 0.52);
      ['A', 'B', 'C'].forEach((t, i) => { c.fillStyle = ['#2a8a2a', '#c82020', '#2a5ac8'][i]; c.fillRect(S * (0.2 + i * 0.22), S * 0.6, S * 0.16, S * 0.16); c.fillStyle = '#fff'; c.font = `900 ${S * 0.12}px Arial`; c.fillText(t, S * (0.28 + i * 0.22), S * 0.73); });
    });
    const lg = new THREE.CylinderGeometry(0.1112, 0.1112, 0.15, 32, 1, true, -0.7, 1.4);
    g.add(meshOf(lg, new THREE.MeshPhysicalMaterial({ map: label, roughness: 0.4, clearcoat: 0.6 }), [0, 0.2, 0]));
    return g;
  });
  const o = g.clone();
  o.userData.kind = 'ext';
  return o;
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
