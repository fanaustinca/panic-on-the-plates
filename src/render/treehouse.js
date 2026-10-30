// Jungle treehouse: each zone of the level is a small pod built around the great tree that rises
// through the middle of the kitchen. Every pod hangs on its own branch and swings gently about the
// point where that branch leaves the trunk. Rope bridges between pods (side to side and front to
// back) sag and are rebuilt every frame from the two pods' current transforms, and cooks, monkeys
// and particles are carried along through swayPoint(). Installed onto Kitchen.prototype.
import * as THREE from 'three';
import { mat, part, sph, cyl, box } from './items.js';
import { barkTex, thatchTex, leafTex, glowTex } from './textures.js';

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

/** Bark that fades out above the kitchen floor, so the trunk rising through the middle of the
 *  treehouse never hides the pods behind it. */
export function fadingBark(map, y0 = 1.0, y1 = 4.6) {
  const m = new THREE.MeshStandardMaterial({ map, color: 0xc49e78, roughness: 0.95, transparent: true });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWY;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWY;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
float fadeK = 1.0 - smoothstep(${y0.toFixed(2)}, ${y1.toFixed(2)}, vWY);
if (fadeK < 0.02) discard;`)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= fadeK;');
  };
  m.customProgramCacheKey = () => `fadebark${y0}${y1}`;
  return m;
}

export const treehouse = {
  makePods() {
    const L = this.L;
    // the great tree stands where the gaps between the pods cross
    const gx = L.gaps.find((g) => g.dir === 'x'), gy = L.gaps.find((g) => g.dir === 'y');
    this.trunkAt = V(gx ? this.wx(gx.x0) + (gx.x1 - gx.x0 + 1) / 2 : 0, 0, gy ? this.wz(gy.y0) + (gy.y1 - gy.y0 + 1) / 2 : this.wz(0) - 1.5);
    const heights = [0.12, 0.42, -0.14, 0.28];
    this.pods = L.zones.map((z, i) => {
      const g = new THREE.Group();
      g.matrixAutoUpdate = false;
      this.root.add(g);
      const cx = this.wx(z.x0) + (z.x1 - z.x0 + 1) / 2, cz = this.wz(z.y0) + (z.y1 - z.y0 + 1) / 2;
      const d = tmpA.set(cx - this.trunkAt.x, 0, cz - this.trunkAt.z).normalize();
      const pivot = V(this.trunkAt.x + d.x * 1.3, -1.6, this.trunkAt.z + d.z * 1.3);
      return { z, i, g, cx, cz, dy: heights[i % 4], pivot, q: new THREE.Quaternion() };
    });
    this.podGaps = L.gaps.map((g) => ({ a: this.pods[g.a], b: this.pods[g.b], dir: g.dir }));
    this.bridgeSag = 0.16;
    this.bridgeSide = 0;
    this.updatePods({ swayV: 0 }, 0, 0);
  },

  podOf(tx, ty) {
    if (!this.pods) return null;
    return this.pods.find((p) => tx >= p.z.x0 && tx <= p.z.x1 && (ty == null || (ty >= p.z.y0 && ty <= p.z.y1))) || null;
  },
  /** Scene parent for things standing on tile (tx, ty): its pod, or the kitchen root. */
  home(tx, ty) { const p = this.podOf(tx, ty); return p ? p.g : this.root; },

  updatePods(env, rt) {
    const A = 1 + (this.L.hz.sway ? this.L.hz.sway.amp * 0.3 : 0);
    for (const p of this.pods) {
      const ph = p.i * 1.9;
      eul.set(0.01 * A * Math.sin(rt * 0.55 + ph * 0.7), 0.012 * A * Math.sin(rt * 0.9 + ph), 0.02 * A * Math.sin(rt * 0.72 + ph * 1.3));
      p.q.setFromEuler(eul);
      p.g.quaternion.copy(p.q);
      p.g.position.copy(p.pivot).sub(tmpA.copy(p.pivot).applyQuaternion(p.q));
      p.g.position.y += p.dy + Math.sin(rt * 1.1 + ph) * 0.035;
      p.g.updateMatrix();
    }
    // the bridges swing sideways with the gameplay sway that shoves cooks off them
    this.bridgeSide = (env.swayV || 0) * 0.07;
  },

  /** Map a point in kitchen-root space (flat level layout) to where it is on the swaying pods/bridges. */
  swayPoint(v) {
    if (!this.pods) return v;
    const tx = v.x + this.L.W / 2, ty = v.z + this.L.H / 2;
    for (const p of this.pods) if (tx >= p.z.x0 && tx < p.z.x1 + 1 && ty >= p.z.y0 && ty < p.z.y1 + 1) return v.applyMatrix4(p.g.matrix);
    for (const { a, b, dir } of this.podGaps) {
      const [along, cross, g0, g1, c0, c1] = dir === 'x'
        ? [tx, ty, a.z.x1 + 1, b.z.x0, Math.max(a.z.y0, b.z.y0), Math.min(a.z.y1, b.z.y1) + 1]
        : [ty, tx, a.z.y1 + 1, b.z.y0, Math.max(a.z.x0, b.z.x0), Math.min(a.z.x1, b.z.x1) + 1];
      if (along < g0 - 0.01 || along > g1 + 0.01 || cross < c0 - 0.6 || cross > c1 + 0.6) continue;
      const u = Math.min(1, Math.max(0, (along - g0) / (g1 - g0)));
      tmpA.copy(v).applyMatrix4(a.g.matrix);
      tmpB.copy(v).applyMatrix4(b.g.matrix);
      v.copy(tmpA).lerp(tmpB, u);
      const k = Math.sin(Math.PI * u);
      v.y -= this.bridgeSag * k;
      if (dir === 'x') v.z += this.bridgeSide * k; else v.x += this.bridgeSide * k;
      return v;
    }
    // anywhere else (in the air): ride the nearest pod
    let best = this.pods[0], bd = 1e9;
    for (const p of this.pods) {
      const dx = Math.max(p.z.x0 - tx, 0, tx - p.z.x1 - 1), dy = Math.max(p.z.y0 - ty, 0, ty - p.z.y1 - 1), d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = p; }
    }
    return v.applyMatrix4(best.g.matrix);
  },

  // ------------------------------------------------------------------ rope bridges

  buildRopeBridge(b) {
    const g = new THREE.Group();
    this.root.add(g);
    const ax = b.dir !== 'y';
    const first = b.tiles[0], last = b.tiles[b.tiles.length - 1];
    // along/cross coordinates: along the span, and across it (tile centre line)
    const a0 = ax ? this.wx(first[0]) : this.wz(first[1]), a1 = ax ? this.wx(last[0] + 1) : this.wz(last[1] + 1);
    const c = ax ? this.cz(b.row) : this.cx(b.col);
    const P = (a, y, s) => (ax ? V(a, y, c + s) : V(c + s, y, a));
    const n = Math.round((a1 - a0) * 5);
    const plankM = [mat(0x9a6a3a, { rough: 0.9 }), mat(0x8a5a30, { rough: 0.9 }), mat(0xa87a48, { rough: 0.9 })];
    const ropeM = mat(0xd8c08a, { rough: 0.9 });
    const planks = [];
    for (let k = 0; k < n; k++) {
      const a = a0 + (k + 0.5) * (a1 - a0) / n;
      const len = 0.84 + (Math.random() - 0.5) * 0.08;
      const m = part(box(), plankM[k % 3], [0, 0, 0], ax ? [0.15, 0.05, len] : [len, 0.05, 0.15]);
      m.userData = { a, s: (Math.random() - 0.5) * 0.04, yaw: (Math.random() - 0.5) * 0.12 };
      g.add(m);
      planks.push(m);
    }
    // two hand ropes and two foot ropes, each a chain of short segments
    const ropes = [];
    for (const [y, s, sag, r] of [[0.74, 0.47, 0.14, 0.028], [0.74, -0.47, 0.14, 0.028], [-0.06, 0.4, 0, 0.022], [-0.06, -0.4, 0, 0.022]]) {
      const segs = [];
      for (let k = 0; k < n + 1; k++) { const m = new THREE.Mesh(cylGeo(), ropeM); m.castShadow = true; g.add(m); segs.push(m); }
      ropes.push({ y, s, sag, r, segs, a0: a0 - 0.15, a1: a1 + 0.15 });
    }
    // vertical hangers from hand rope to plank ends
    const hangers = [];
    for (let k = 1; k < n; k += 2) for (const s of [0.46, -0.46]) { const m = new THREE.Mesh(cylGeo(), ropeM); g.add(m); hangers.push({ m, a: a0 + (k + 0.5) * (a1 - a0) / n, s }); }
    // posts on each pod's edge, carrying the ropes
    const ends = ax ? [[a0 - 0.1, [first[0] - 1, first[1]]], [a1 + 0.1, [last[0] + 1, last[1]]]] : [[a0 - 0.1, [first[0], first[1] - 1]], [a1 + 0.1, [last[0], last[1] + 1]]];
    for (const [a, [tx, ty]] of ends) {
      const home = this.home(tx, ty);
      for (const s of [0.48, -0.48]) {
        const p = P(a, 0, s);
        log(home, V(p.x, -0.5, p.z), V(p.x, 0.95, p.z), 0.07);
        home.add(part(sph(10), mat(0x6a4a2a, { rough: 0.9 }), [p.x, 0.97, p.z], 0.085));
        home.add(part(cyl(10), ropeM, [p.x, 0.72, p.z], [0.085, 0.1, 0.085]));
      }
    }
    g.userData = { planks, ropes, hangers, P, ax };
    this.updateRopeBridge(g);
    return g;
  },

  updateRopeBridge(g) {
    const { planks, ropes, hangers, P, ax } = g.userData;
    for (const m of planks) {
      const { a, s, yaw } = m.userData;
      const p = this.swayPoint(P(a, -0.03, s));
      const q = this.swayPoint(P(a + 0.08, -0.03, s));
      m.position.copy(p);
      // follow the local slope of the bridge
      if (ax) m.rotation.set(0, yaw, Math.atan2(q.y - p.y, q.x - p.x));
      else m.rotation.set(-Math.atan2(q.y - p.y, q.z - p.z), yaw, 0);
    }
    for (const r of ropes) {
      const n = r.segs.length;
      let prev = null;
      for (let k = 0; k <= n; k++) {
        const u = k / n, a = r.a0 + (r.a1 - r.a0) * u;
        const p = this.swayPoint(P(a, r.y - r.sag * Math.sin(Math.PI * u), r.s));
        if (prev) {
          const sg = r.segs[k - 1];
          const d = tmpB.subVectors(p, prev);
          const len = d.length();
          sg.position.copy(prev).addScaledVector(d, 0.5);
          sg.quaternion.setFromUnitVectors(UP, d.normalize());
          sg.scale.set(r.r, len + 0.01, r.r);
        }
        prev = p;
      }
    }
    const r0 = ropes[0], span = r0.a1 - r0.a0;
    for (const h of hangers) {
      const u = (h.a - r0.a0) / span;
      const top = this.swayPoint(P(h.a, 0.74 - 0.14 * Math.sin(Math.PI * u), h.s));
      const bot = this.swayPoint(P(h.a, -0.03, h.s));
      const d = tmpC.subVectors(top, bot);
      const len = d.length();
      h.m.position.copy(bot).addScaledVector(d, 0.5);
      h.m.quaternion.setFromUnitVectors(UP, d.normalize());
      h.m.scale.set(0.014, len, 0.014);
    }
  },

  // ------------------------------------------------------------------ the tree and the pods

  buildTree(rnd) {
    const tr = this.trunkAt;
    const map = barkTex().clone(); map.needsUpdate = true; map.repeat.set(4, 12);
    const bm = fadingBark(map);
    this.treeBark = bm;
    // the trunk: gnarled, flaring out into buttress roots far below, and fading out above the floor
    const geo = new THREE.CylinderGeometry(1, 1, 44, 40, 60, true);
    const tp = geo.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i), a = Math.atan2(z, x);
      const wy = y - 6; // height of this ring (the trunk is centred at y = -6)
      let rr = 1.3 - Math.max(0, wy) * 0.03;
      rr += 0.08 * Math.sin(a * 5 + wy * 0.3) + 0.05 * Math.sin(a * 11 - wy * 0.7);
      // buttress roots: ridges that swell towards the forest floor
      if (wy < -4) rr += (-4 - wy) * 0.07 * Math.pow(0.5 + 0.5 * Math.sin(a * 5 + 0.6), 3);
      tp.setXYZ(i, Math.cos(a) * rr, y, Math.sin(a) * rr);
    }
    geo.computeVertexNormals();
    const trunk = new THREE.Mesh(geo, bm);
    trunk.position.set(tr.x, -6, tr.z); // spans -28 .. 16
    trunk.receiveShadow = true;
    this.root.add(trunk);
    // moss and a few bracket fungi on the trunk where it is still solid
    const moss = mat(0x4f8a34, { rough: 0.9 }), fungus = mat(0xd8b878, { rough: 0.7 });
    for (let k = 0; k < 7; k++) {
      const a = rnd() * 6.28, y = -0.4 - rnd() * 5;
      this.root.add(part(sph(10), moss, [tr.x + Math.cos(a) * 1.28, y, tr.z + Math.sin(a) * 1.28], [0.35, 0.5, 0.35], [0, -a, 0]));
      if (k % 2) this.root.add(part(cyl(14, 0.5), fungus, [tr.x + Math.cos(a + 1) * 1.36, y - 0.6, tr.z + Math.sin(a + 1) * 1.36], [0.26, 0.05, 0.26]));
    }
    // limbs leaving the trunk above the kitchen, up to the canopy (they fade with the trunk)
    for (const [ang, h] of [[2.3, 2.2], [0.7, 3.2], [-1.9, 2.8], [-0.4, 4.2]]) {
      const d = V(Math.cos(ang), 0, Math.sin(ang) * 0.6 - 0.8).normalize();
      this.root.add(branch([V(tr.x, h - 1, tr.z), V(tr.x + d.x * 1.6, h + 0.4, tr.z + d.z * 1.6), V(tr.x + d.x * 3.6, h + 2.4, tr.z + d.z * 3.6 - 1)], 0.55, 0.25, bm));
    }
    // the crown: dense leaves high at the back and sides of the view
    const zb = this.wz(0);
    for (let i = 0; i < 12; i++) {
      const sx = (i / 11 - 0.5) * (this.L.W + 6);
      leafClump(this.root, sx + (rnd() - 0.5) * 2, 4.8 + rnd() * 2.5, zb - 2.5 - rnd() * 3, 22, 2.4, rnd, ['#3f8f32', '#4a9a38', '#357a2a'][i % 3]);
    }
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) leafClump(this.root, sx * (this.L.W / 2 + 2.2 + rnd()), 2.5 + rnd() * 3, zb + k * this.L.H / 3, 18, 2, rnd, '#3f8f32');
  },

  buildTreehouse() {
    const L = this.L;
    let s = 91;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    this.buildTree(rnd);
    const tr = this.trunkAt;
    const thatch = thatchTex().clone(); thatch.needsUpdate = true;
    const roofM = new THREE.MeshStandardMaterial({ map: thatch, color: 0xe0c890, roughness: 0.95 });
    const vineM = mat(0x3f7a2a, { rough: 0.8 });
    const lanternM = new THREE.MeshStandardMaterial({ color: 0xffd080, emissive: 0xffa040, emissiveIntensity: 2.2 });
    const branchM = new THREE.MeshStandardMaterial({ map: this.treeBark.map, color: 0xb89470, roughness: 0.95 });
    this.lanterns = [];
    for (const p of this.pods) {
      const g = p.g, z = p.z;
      const x0 = this.wx(z.x0), x1 = this.wx(z.x1 + 1), w = x1 - x0, cx = (x0 + x1) / 2;
      const zb = this.wz(z.y0), zf = this.wz(z.y1 + 1), zw = this.wz(z.y0 + 1), cz = (zb + zf) / 2;
      // ---- platform: rim logs, joists and two big bearers underneath
      log(g, V(x0 - 0.2, -0.42, zf + 0.12), V(x1 + 0.2, -0.42, zf + 0.12), 0.17);
      log(g, V(x0 - 0.2, -0.42, zb - 0.12), V(x1 + 0.2, -0.42, zb - 0.12), 0.17);
      log(g, V(x0 - 0.12, -0.6, zb - 0.3), V(x0 - 0.12, -0.6, zf + 0.3), 0.16);
      log(g, V(x1 + 0.12, -0.6, zb - 0.3), V(x1 + 0.12, -0.6, zf + 0.3), 0.16);
      for (let x = x0 + 0.5; x < x1; x += 1.1) log(g, V(x, -0.88, zb), V(x, -0.88, zf), 0.11);
      for (const zz of [zb + 0.9, zf - 0.9]) log(g, V(x0 - 0.4, -1.08, zz), V(x1 + 0.4, -1.08, zz), 0.2);
      // ---- the branch it sits on: out of the trunk, under the platform, its tip curling up past it
      const dx = cx - tr.x, dz = cz - tr.z, dl = Math.hypot(dx, dz) || 1, ux = dx / dl, uz = dz / dl;
      const far = Math.min(w, zf - zb) * 0.5 + 0.8;
      g.add(branch([V(tr.x + ux * 0.8, -2.6, tr.z + uz * 0.8), V(tr.x + ux * 1.9, -1.8, tr.z + uz * 1.9), V(cx, -1.35, cz), V(cx + ux * far, -1.15, cz + uz * far), V(cx + ux * (far + 1.2), -0.4, cz + uz * (far + 1.2))], 0.62, 0.12, branchM, 32));
      leafClump(g, cx + ux * (far + 1.3), -0.2, cz + uz * (far + 1.3), 12, 1.0, rnd, '#4a9a38');
      // struts from the platform corners down onto the branch
      for (const [sx, sz] of [[x0 + 0.4, zf - 0.3], [x1 - 0.4, zf - 0.3], [x0 + 0.4, zb + 0.4], [x1 - 0.4, zb + 0.4]]) log(g, V(sx, -0.95, sz), V(cx + (sx - cx) * 0.2, -1.55, cz + (sz - cz) * 0.2), 0.085);
      if (z.wall) {
        // ---- a hut at the back: thatched lean-to roof on log posts, shuttered window
        const front = V(0, 2.78, zw + 0.12), back = V(0, 3.5, zb - 0.8);
        const len = front.distanceTo(back);
        thatch.repeat.set(Math.max(2, w), 1);
        g.add(part(box(), roofM, [cx, (front.y + back.y) / 2, (front.z + back.z) / 2], [w + 0.7, 0.14, len + 0.1], [Math.atan2(back.y - front.y, front.z - back.z), 0, 0]));
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
        const win = new THREE.Group();
        win.position.set(cx + (rnd() - 0.5) * Math.max(0, w - 2.4), 1.55, zw + 0.012);
        win.add(part(new THREE.PlaneGeometry(0.62, 0.52), new THREE.MeshStandardMaterial({ color: 0x1a120a, emissive: 0xffb050, emissiveIntensity: 0.25 }), [0, 0, 0]));
        win.add(part(box(), mat(0x5a3a1e), [0, 0, 0.02], [0.05, 0.56, 0.04]), part(box(), mat(0x5a3a1e), [0, 0, 0.02], [0.66, 0.05, 0.04]));
        for (const sx of [-1, 1]) win.add(part(box(), mat(0x6a8a3a, { rough: 0.8 }), [sx * 0.47, 0, 0.03], [0.3, 0.6, 0.03], [0, sx * 0.5, 0]));
        win.add(part(box(), mat(0x5a3a1e), [0, -0.31, 0.06], [0.74, 0.06, 0.12]));
        g.add(win);
      } else {
        // ---- an open deck: a low log railing along the front edge
        log(g, V(x0 + 0.05, 1.12, zf + 0.06), V(x1 - 0.05, 1.12, zf + 0.06), 0.05);
      }
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
      for (let k = 0; k < 4; k++) {
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
