// Jungle treehouse: each zone of the level is its own pod, hung off the great tree on a branch,
// swinging gently about the point where its branch meets the trunk. Rope bridges between pods
// sag and are rebuilt every frame from the two pods' current transforms, and cooks, monkeys and
// particles are carried along through swayPoint(). Installed onto Kitchen.prototype.
import * as THREE from 'three';
import { mat, part, sph, cyl, box } from './items.js';
import { barkTex, thatchTex, leafTex, glowTex } from './textures.js';
import { trunkSpot } from './env.js';

const CH = 0.9;
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const eul = new THREE.Euler();

let barkM = null;
const bark = () => barkM || (barkM = new THREE.MeshStandardMaterial({ map: barkTex(), color: 0xb08a68, roughness: 0.95 }));

/** A log (cylinder) between two points. */
function log(parent, a, b, r, m = bark()) {
  const d = tmpC.subVectors(b, a);
  const len = d.length();
  const mesh = new THREE.Mesh(cylGeo(), m);
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, d.normalize());
  mesh.scale.set(r, len, r);
  mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
let cg = null;
const cylGeo = () => cg || (cg = new THREE.CylinderGeometry(1, 1, 1, 10, 1));
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Tapered tube along a curve (branches, roots). */
export function branch(points, r0, r1, m = bark(), seg = 24) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, seg, 1, 10, false);
  const pos = geo.attributes.position, n = 11;
  for (let i = 0; i <= seg; i++) {
    const c = curve.getPointAt(i / seg), r = r0 + (r1 - r0) * (i / seg);
    for (let j = 0; j < n; j++) {
      const k = i * n + j;
      tmpA.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, tmpA.x, tmpA.y, tmpA.z);
    }
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, m);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

/** A clump of leaf cards. */
export function leafClump(parent, x, y, z, n, size, rnd, tint) {
  const m = new THREE.MeshStandardMaterial({ map: leafTex(tint), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 });
  const geo = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  for (let i = 0; i < n; i++) {
    const l = new THREE.Mesh(geo, m);
    const s = size * (0.6 + rnd() * 0.6);
    l.scale.set(s, s, s);
    l.position.set((rnd() - 0.5) * size, (rnd() - 0.5) * size * 0.5, (rnd() - 0.5) * size);
    l.rotation.set(-Math.PI / 2 + (rnd() - 0.5) * 1.6, rnd() * 6.28, (rnd() - 0.5) * 1.2);
    l.castShadow = true;
    g.add(l);
  }
  parent.add(g);
  return g;
}

export const treehouse = {
  makePods() {
    const L = this.L, n = L.zones.length;
    const heights = n === 3 ? [0.1, 0.45, -0.15] : n === 2 ? [0, 0.35] : [0];
    // banyan-style: a trunk rises through every gap between pods, and each pod hangs on a branch
    // from its nearest trunk (single-pod kitchens hang off the great tree behind)
    this.trunks = L.gaps.map((g) => V(this.wx(g.x0) + (g.x1 - g.x0 + 1) / 2, -1.6, this.wz(0) + 0.85));
    const tr = trunkSpot(L.W, L.H);
    this.pods = L.zones.map((z, i) => {
      const g = new THREE.Group();
      g.matrixAutoUpdate = false;
      this.root.add(g);
      const cx = this.wx(z.x0) + (z.x1 - z.x0 + 1) / 2;
      const t = this.trunks[i - 1] || this.trunks[i];
      const pivot = t ? V(t.x + Math.sign(cx - t.x) * 0.5, -1.6 + heights[i] * 0.5, t.z) : V(tr.x, -4, tr.z + tr.r * 0.6);
      return { z, i, g, cx, dy: heights[i], pivot, q: new THREE.Quaternion() };
    });
    this.bridgeSag = 0.16;
    this.bridgeSide = 0;
    this.updatePods({ swayV: 0 }, 0, 0);
  },

  podOf(tx) { return this.pods ? this.pods.find((p) => tx >= p.z.x0 && tx <= p.z.x1) || null : null; },
  /** Scene parent for things standing on tile column tx (its pod, or the kitchen root). */
  home(tx) { const p = this.podOf(tx); return p ? p.g : this.root; },

  updatePods(env, rt) {
    const A = 1 + (this.L.hz.sway ? this.L.hz.sway.amp * 0.3 : 0);
    for (const p of this.pods) {
      const ph = p.i * 1.9;
      eul.set(0.008 * A * Math.sin(rt * 0.55 + ph * 0.7), 0.012 * A * Math.sin(rt * 0.9 + ph), 0.018 * A * Math.sin(rt * 0.72 + ph * 1.3));
      p.q.setFromEuler(eul);
      p.g.quaternion.copy(p.q);
      p.g.position.copy(p.pivot).sub(tmpA.copy(p.pivot).applyQuaternion(p.q));
      p.g.position.y += p.dy + Math.sin(rt * 1.1 + ph) * 0.03;
      p.g.updateMatrix();
    }
    // the bridges swing sideways with the gameplay sway that shoves cooks off them
    this.bridgeSide = (env.swayV || 0) * 0.07;
  },

  /** Map a point in kitchen-root space (flat level layout) to where it is on the swaying pods/bridges. */
  swayPoint(v) {
    if (!this.pods) return v;
    const P = this.pods, tx = v.x + this.L.W / 2;
    let i = 0;
    while (i < P.length - 1 && tx >= P[i].z.x1 + 1) i++;
    if (i === 0 || tx >= P[i].z.x0) return v.applyMatrix4(P[i].g.matrix);
    const a = P[i - 1], b = P[i], g0 = a.z.x1 + 1, g1 = b.z.x0;
    const u = Math.min(1, Math.max(0, (tx - g0) / (g1 - g0)));
    tmpA.copy(v).applyMatrix4(a.g.matrix);
    tmpB.copy(v).applyMatrix4(b.g.matrix);
    v.copy(tmpA).lerp(tmpB, u);
    const k = Math.sin(Math.PI * u);
    v.y -= this.bridgeSag * k;
    v.z += this.bridgeSide * k;
    return v;
  },

  // ------------------------------------------------------------------ rope bridges

  buildRopeBridge(b) {
    const g = new THREE.Group();
    this.root.add(g);
    const gx0 = this.wx(b.tiles[0][0]), gx1 = this.wx(b.tiles[b.tiles.length - 1][0] + 1), zc = this.cz(b.row);
    const n = Math.round((gx1 - gx0) * 5);
    const plankM = [mat(0x9a6a3a, { rough: 0.9 }), mat(0x8a5a30, { rough: 0.9 }), mat(0xa87a48, { rough: 0.9 })];
    const ropeM = mat(0xd8c08a, { rough: 0.9 });
    const planks = [];
    for (let k = 0; k < n; k++) {
      const x = gx0 + (k + 0.5) * (gx1 - gx0) / n;
      const m = part(box(), plankM[k % 3], [x, -0.03, zc], [0.15, 0.05, 0.84 + (Math.random() - 0.5) * 0.08]);
      m.userData.base = V(x, -0.03, zc + (Math.random() - 0.5) * 0.04);
      m.userData.yaw = (Math.random() - 0.5) * 0.12;
      g.add(m);
      planks.push(m);
    }
    // two hand ropes and two foot ropes, each a chain of short segments
    const ropes = [];
    const pts = n + 2;
    for (const [y, dz, sag, r] of [[0.74, 0.47, 0.14, 0.028], [0.74, -0.47, 0.14, 0.028], [-0.06, 0.4, 0, 0.022], [-0.06, -0.4, 0, 0.022]]) {
      const segs = [];
      for (let k = 0; k < pts - 1; k++) { const m = new THREE.Mesh(cylGeo(), ropeM); m.castShadow = true; g.add(m); segs.push(m); }
      ropes.push({ y, z: zc + dz, sag, r, segs, x0: gx0 - 0.15, x1: gx1 + 0.15 });
    }
    // vertical hangers from hand rope to plank ends
    const hangers = [];
    for (let k = 1; k < n; k += 2) for (const dz of [0.46, -0.46]) { const m = new THREE.Mesh(cylGeo(), ropeM); g.add(m); hangers.push({ m, x: gx0 + (k + 0.5) * (gx1 - gx0) / n, z: zc + dz }); }
    // posts on each pod's edge, carrying the ropes
    for (const [x, tx] of [[gx0 - 0.1, b.tiles[0][0] - 1], [gx1 + 0.1, b.tiles[b.tiles.length - 1][0] + 1]]) {
      const home = this.home(tx);
      for (const dz of [0.48, -0.48]) {
        log(home, V(x, -0.5, zc + dz), V(x, 0.95, zc + dz), 0.07);
        home.add(part(sph(10), mat(0x6a4a2a, { rough: 0.9 }), [x, 0.97, zc + dz], 0.085));
        home.add(part(cyl(10), ropeM, [x, 0.72, zc + dz], [0.085, 0.1, 0.085]));
      }
    }
    g.userData = { planks, ropes, hangers };
    this.updateRopeBridge(g);
    return g;
  },

  updateRopeBridge(g) {
    const { planks, ropes, hangers } = g.userData;
    for (const m of planks) {
      const p = tmpA.copy(m.userData.base);
      const x0 = p.x;
      this.swayPoint(p);
      m.position.copy(p);
      // follow the local slope of the bridge
      const q = this.swayPoint(tmpB.set(x0 + 0.08, -0.03, m.userData.base.z));
      m.rotation.set(0, m.userData.yaw, Math.atan2(q.y - p.y, q.x - p.x));
    }
    for (const r of ropes) {
      const n = r.segs.length;
      let prev = null;
      for (let k = 0; k <= n; k++) {
        const u = k / n, x = r.x0 + (r.x1 - r.x0) * u;
        const p = this.swayPoint(tmpA.set(x, r.y - r.sag * Math.sin(Math.PI * u), r.z)).clone();
        if (prev) {
          const s = r.segs[k - 1];
          const d = tmpB.subVectors(p, prev);
          const len = d.length();
          s.position.copy(prev).addScaledVector(d, 0.5);
          s.quaternion.setFromUnitVectors(UP, d.normalize());
          s.scale.set(r.r, len + 0.01, r.r);
        }
        prev = p;
      }
    }
    const span = ropes[0].x1 - ropes[0].x0;
    for (const h of hangers) {
      const u = (h.x - ropes[0].x0) / span;
      const top = this.swayPoint(tmpA.set(h.x, 0.74 - 0.14 * Math.sin(Math.PI * u), h.z)).clone();
      const bot = this.swayPoint(tmpB.set(h.x, -0.03, h.z));
      const d = tmpC.subVectors(top, bot);
      const len = d.length();
      h.m.position.copy(bot).addScaledVector(d, 0.5);
      h.m.quaternion.setFromUnitVectors(UP, d.normalize());
      h.m.scale.set(0.014, len, 0.014);
    }
  },

  // ------------------------------------------------------------------ the pods themselves

  buildTreehouse() {
    const L = this.L;
    let s = 91;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const tr = trunkSpot(L.W, L.H);
    const thatch = thatchTex().clone(); thatch.needsUpdate = true;
    const roofM = new THREE.MeshStandardMaterial({ map: thatch, color: 0xe0c890, roughness: 0.95 });
    const vineM = mat(0x3f7a2a, { rough: 0.8 });
    const lanternM = new THREE.MeshStandardMaterial({ color: 0xffd080, emissive: 0xffa040, emissiveIntensity: 2.2 });
    this.lanterns = [];
    const zb = this.wz(0), zf = this.wz(L.H), zw = this.wz(1);
    const bm = new THREE.MeshStandardMaterial({ map: barkTex().clone(), color: 0xb08a68, roughness: 0.95 });
    bm.map.needsUpdate = true; bm.map.repeat.set(2, 10);
    for (const t of this.trunks) {
      const geo = new THREE.CylinderGeometry(0.62, 0.95, 40, 18, 30, true);
      const tp = geo.attributes.position;
      for (let i = 0; i < tp.count; i++) {
        const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i), a = Math.atan2(z, x);
        const k = 1 + 0.1 * Math.sin(a * 4 + y * 0.4) + 0.06 * Math.sin(a * 9 - y * 0.9);
        tp.setXYZ(i, x * k, y, z * k);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, bm);
      m.position.set(t.x, -13, t.z);
      m.castShadow = true; m.receiveShadow = true;
      this.root.add(m);
      // twisting aerial roots wrapped round it, and its crown up in the canopy
      for (let k = 0; k < 3; k++) {
        const a0 = k * 2.1 + rnd(), pts = [];
        for (let j = 0; j <= 8; j++) { const a = a0 + j * 0.5, y = -12 + j * 2.4; pts.push(V(t.x + Math.cos(a) * 0.82, y, t.z + Math.sin(a) * 0.82)); }
        this.root.add(branch(pts, 0.14, 0.09, bm, 40));
      }
      for (let k = 0; k < 4; k++) leafClump(this.root, t.x + (rnd() - 0.5) * 2.5, 5.6 + rnd() * 1.6, t.z - 0.8 - rnd() * 1.6, 16, 1.6, rnd, ['#3f8f32', '#4a9a38'][k % 2]);
      leafClump(this.root, t.x, 3.4, t.z - 0.1, 8, 0.8, rnd, '#4a9a38');
    }
    for (const p of this.pods) {
      const g = p.g, x0 = this.wx(p.z.x0), x1 = this.wx(p.z.x1 + 1), w = x1 - x0, cx = (x0 + x1) / 2;
      // ---- platform: rim logs, joists and two big bearers underneath
      log(g, V(x0 - 0.2, -0.42, zf + 0.12), V(x1 + 0.2, -0.42, zf + 0.12), 0.17);
      log(g, V(x0 - 0.2, -0.42, zb - 0.12), V(x1 + 0.2, -0.42, zb - 0.12), 0.17);
      log(g, V(x0 - 0.12, -0.6, zb - 0.3), V(x0 - 0.12, -0.6, zf + 0.3), 0.16);
      log(g, V(x1 + 0.12, -0.6, zb - 0.3), V(x1 + 0.12, -0.6, zf + 0.3), 0.16);
      for (let x = x0 + 0.5; x < x1; x += 1.1) log(g, V(x, -0.88, zb), V(x, -0.88, zf), 0.11);
      for (const z of [zb + 1.2, zf - 1.4]) log(g, V(x0 - 0.4, -1.08, z), V(x1 + 0.4, -1.08, z), 0.2);
      // ---- the branch it hangs from, from the trunk to under the platform
      const end = V(cx, -1.3, zf - 1.0);
      for (const t of [this.trunks[p.i - 1], this.trunks[p.i]]) {
        if (!t) continue;
        const sx = t.x + Math.sign(cx - t.x) * 0.55;
        g.add(branch([V(t.x, -2.6, t.z + 0.1), V(sx, -1.9, t.z + 0.6), V((sx + cx) / 2, -1.45, (zb + zf) / 2 - 0.3), end], 0.55, 0.2));
      }
      if (!this.trunks.length) g.add(branch([p.pivot.clone(), V((p.pivot.x + cx) / 2, -2.9, (p.pivot.z + zb) / 2 + 0.5), V(cx, -1.55, (zb + zf) / 2 - 0.5), end], 0.62, 0.22));
      // struts from the platform corners down onto the branch
      for (const [sx, sz] of [[x0 + 0.4, zf - 0.3], [x1 - 0.4, zf - 0.3], [x0 + 0.4, zb + 0.6], [x1 - 0.4, zb + 0.6]]) log(g, V(sx, -0.95, sz), V(cx + (sx - cx) * 0.15, -1.7, sz * 0.6 + (zb + zf) * 0.2), 0.085);
      leafClump(g, end.x + 0.3, end.y + 0.1, end.z + 0.4, 9, 0.9, rnd, '#3f8f32');
      // ---- roof: thatched lean-to over the back wall, on log posts
      const front = V(0, 2.78, zw + 0.12), back = V(0, 3.5, zb - 0.8);
      const len = front.distanceTo(back);
      thatch.repeat.set(Math.max(2, w), 1);
      const roof = part(box(), roofM, [cx, (front.y + back.y) / 2, (front.z + back.z) / 2], [w + 0.7, 0.14, len + 0.1], [Math.atan2(back.y - front.y, front.z - back.z), 0, 0]);
      g.add(roof);
      log(g, V(x0 - 0.4, back.y + 0.05, back.z), V(x1 + 0.4, back.y + 0.05, back.z), 0.13);
      log(g, V(x0 - 0.4, front.y - 0.02, front.z), V(x1 + 0.4, front.y - 0.02, front.z), 0.09);
      for (const x of [x0 + 0.12, x1 - 0.12]) log(g, V(x, -0.2, zw - 0.12), V(x, front.y, zw - 0.12), 0.11);
      for (let x = x0 + 0.2; x < x1; x += 0.45 + rnd() * 0.5) {
        // fringe of straw + the odd vine trailing off the eaves
        const l = 0.12 + rnd() * 0.12;
        g.add(part(box(), mat(0xb89448, { rough: 1 }), [x, front.y - 0.05 - l / 2, front.z + 0.06], [0.22, l, 0.03], [0.1, 0, (rnd() - 0.5) * 0.3]));
        if (rnd() < 0.35) { const vl = 0.4 + rnd() * 0.7; g.add(part(cyl(5), vineM, [x, front.y - vl / 2, front.z + 0.1], [0.018, vl, 0.018])); g.add(part(sph(6), mat(0x4aa83a, { rough: 0.8 }), [x, front.y - vl, front.z + 0.1], [0.07, 0.04, 0.09])); }
      }
      leafClump(g, x0 - 0.2, back.y + 0.15, back.z + 0.2, 7, 0.8, rnd, '#4a9a38');
      leafClump(g, x1 + 0.2, back.y + 0.1, back.z + 0.3, 7, 0.8, rnd, '#357a2a');
      // window with shutters in the back wall
      const win = new THREE.Group();
      win.position.set(cx + (rnd() - 0.5) * (w - 2.4), 1.55, zw + 0.012);
      win.add(part(new THREE.PlaneGeometry(0.62, 0.52), new THREE.MeshStandardMaterial({ color: 0x1a120a, emissive: 0xffb050, emissiveIntensity: 0.25 }), [0, 0, 0]));
      win.add(part(box(), mat(0x5a3a1e), [0, 0, 0.02], [0.05, 0.56, 0.04]), part(box(), mat(0x5a3a1e), [0, 0, 0.02], [0.66, 0.05, 0.04]));
      for (const sx of [-1, 1]) win.add(part(box(), mat(0x6a8a3a, { rough: 0.8 }), [sx * 0.47, 0, 0.03], [0.3, 0.6, 0.03], [0, sx * 0.5, 0]));
      win.add(part(box(), mat(0x5a3a1e), [0, -0.31, 0.06], [0.74, 0.06, 0.12]));
      g.add(win);
      // ---- lanterns on posts at the two front corners
      for (const x of [x0 - 0.04, x1 + 0.04]) {
        log(g, V(x, -0.3, zf + 0.04), V(x, 1.75, zf + 0.04), 0.06);
        const lg = new THREE.Group();
        lg.position.set(x, 1.62, zf + 0.04);
        lg.add(part(box(), mat(0x3a2a1a), [0, 0.2, 0], [0.2, 0.03, 0.2]));
        lg.add(part(sph(10), lanternM, [0, 0.06, 0], [0.09, 0.12, 0.09]));
        for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) lg.add(part(box(), mat(0x3a2a1a), [a * 0.08, 0.06, b * 0.08], [0.02, 0.26, 0.02]));
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffb040, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.scale.setScalar(0.9); glow.position.y = 0.06;
        lg.add(glow);
        g.add(lg);
        this.lanterns.push({ lg, glow, ph: rnd() * 6 });
      }
      // ---- vines dangling from under the platform into the depths
      for (let k = 0; k < 5; k++) {
        const vx = x0 + rnd() * w, vz = rnd() < 0.5 ? zf + 0.1 : zb + rnd() * (zf - zb);
        const vl = 1.5 + rnd() * 3;
        g.add(part(cyl(5), vineM, [vx, -0.7 - vl / 2, vz], [0.025, vl, 0.025]));
        for (let j = 0; j < 3; j++) g.add(part(sph(6), mat(0x4aa83a, { rough: 0.8 }), [vx + (rnd() - 0.5) * 0.1, -0.8 - rnd() * vl, vz], [0.09, 0.05, 0.12], [0, rnd() * 3, 0]));
      }
      leafClump(g, x0 - 0.3, -0.5, zf + 0.1, 8, 0.75, rnd, '#4a9a38');
      leafClump(g, x1 + 0.3, -0.6, zb + 0.4, 8, 0.75, rnd, '#3f8f32');
    }
  },

  updateTreehouse(rt) {
    for (const l of this.lanterns || []) {
      l.lg.rotation.z = Math.sin(rt * 1.6 + l.ph) * 0.06;
      l.glow.material.opacity = 0.5 + Math.sin(rt * 7 + l.ph) * 0.05;
    }
  },
};
