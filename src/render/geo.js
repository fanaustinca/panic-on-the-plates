// Modelling toolkit for the food and kitchen props: parametric surfaces with analytic normals (no seams),
// lathes, variable-radius tubes, thin sheets (leaves, fins), value noise, per-vertex colour and small
// canvas textures. Everything is cached by key, so a model is built once and cloned.
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- noise
const PERM = new Uint8Array(512);
{ let s = 1337; const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; }
const h3 = (x, y, z) => PERM[(PERM[(PERM[x & 255] + y) & 255] + z) & 255] / 255;
/** smooth 3D value noise in 0..1 */
export function noise(x, y, z = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c = (a, b, d) => h3(xi + a, yi + b, zi + d);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), u), x10 = lerp(c(0, 1, 0), c(1, 1, 0), u);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), u), x11 = lerp(c(0, 1, 1), c(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}
export function fbm(x, y, z = 0, oct = 4) {
  let a = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { a += amp * noise(x * f, y * f, z * f); n += amp; amp *= 0.5; f *= 2.03; }
  return a / n;
}
/** deterministic random from a seed */
export function rng(seed = 1) { let s = (Math.floor(seed * 9973) % 2147483646) + 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

// ---------------------------------------------------------------- colour helpers
const tmpC = new THREE.Color();
export const col = (hex) => new THREE.Color(hex);
/** mix two hex / Color values -> Color (in the linear working space) */
export function mixc(a, b, t) { const A = a.isColor ? a.clone() : new THREE.Color(a); return A.lerp(b.isColor ? b : tmpC.set(b), clamp(t)); }
export function shadeC(c, k) { const C = c.isColor ? c.clone() : new THREE.Color(c); return k < 0 ? C.multiplyScalar(1 + k) : C.lerp(tmpC.set(0xffffff), k); }
export const css = (c, k = 0) => '#' + (k ? shadeC(c, k) : new THREE.Color(c)).getHexString();

// ---------------------------------------------------------------- art direction
// Realistic shapes, cartoon finish: colours a touch more saturated and brighter, surface relief and
// lacquer toned down, and a soft rim of light on every edge (the same finish the cooks have).
export const LOOK = { sat: 1.3, lift: 0.22, bump: 0.45, clear: 0.55, rim: 0.26 };
const hsl = {};
/** push a colour towards the cartoon palette (in place) */
export function toon(C) {
  C.getHSL(hsl);
  // more colour, and the deepest shadows lifted a little (cartoons have few true blacks)
  C.setHSL(hsl.h, clamp(hsl.s * LOOK.sat), hsl.l < 0.4 ? hsl.l + (0.4 - hsl.l) * LOOK.lift : hsl.l);
  return C;
}
/** soft fresnel rim (lighter version of the surface colour) patched into a standard/physical material */
export function rimLight(m, k = LOOK.rim) {
  if (m.userData.rim) return m;
  m.userData.rim = k;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      { float rimF = pow(1.0 - saturate(dot(geometryNormal, geometryViewDir)), 3.0);
        reflectedLight.indirectDiffuse += mix(diffuseColor.rgb, vec3(1.0), 0.2) * rimF * ${k.toFixed(3)}; }`);
  };
  const key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => key() + '|rim' + k;
  m.needsUpdate = true;
  return m;
}

// ---------------------------------------------------------------- caches
const cache = new Map();
export const once = (k, make) => { if (!cache.has(k)) cache.set(k, make()); return cache.get(k); };

// ---------------------------------------------------------------- parametric surface
/**
 * fn(u, v) -> [x, y, z] over u, v in 0..1. Normals come from finite differences of fn itself, so a
 * closed surface (u wraps) has no lighting seam and poles stay smooth. colorFn(u, v, p) -> Color.
 */
export function surf(fn, { nu = 40, nv = 28, color = null, uv = [1, 1] } = {}) {
  const N = (nu + 1) * (nv + 1);
  const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), uvs = new Float32Array(N * 2), cols = color ? new Float32Array(N * 3) : null;
  const e = 1e-3, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3(), n = new THREE.Vector3();
  const P = (u, v, out) => out.fromArray(fn(u, clamp(v, 0, 1)));
  let k = 0;
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++, k++) {
      const u = i / nu, v = j / nv, p = fn(u, v);
      pos.set(p, k * 3);
      const vv = clamp(v, 2e-3, 1 - 2e-3);
      P(u + e, vv, a); P(u - e, vv, b); P(u, vv + e, c); P(u, vv - e, d);
      a.sub(b); c.sub(d);
      const la = a.length(), lc = c.length();
      if (la > 0) a.divideScalar(la);
      if (lc > 0) c.divideScalar(lc);
      n.crossVectors(a, c);
      if (n.lengthSq() < 1e-12) n.set(0, 1, 0);
      n.normalize();
      nor.set([n.x, n.y, n.z], k * 3);
      uvs.set([u * uv[0], v * uv[1]], k * 2);
      if (cols) { const C = toon(color(u, v, p)); cols.set([C.r, C.g, C.b], k * 3); }
    }
  }
  // orient normals outward: away from the centre of each ring of constant v (robust for curled tubes)
  let dot = 0;
  for (let j = 0; j <= nv; j++) {
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < nu; i++) { const q = (j * (nu + 1) + i) * 3; cx += pos[q]; cy += pos[q + 1]; cz += pos[q + 2]; }
    cx /= nu; cy /= nu; cz /= nu;
    for (let i = 0; i < nu; i++) { const q = (j * (nu + 1) + i) * 3; dot += (pos[q] - cx) * nor[q] + (pos[q + 1] - cy) * nor[q + 1] + (pos[q + 2] - cz) * nor[q + 2]; }
  }
  if (dot < 0) for (let q = 0; q < nor.length; q++) nor[q] = -nor[q];
  // wind the triangles to agree with the normals (majority vote over the non-degenerate ones)
  const idx = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const p0 = j * (nu + 1) + i, p1 = p0 + 1, p2 = p0 + nu + 1, p3 = p2 + 1;
    idx.push(p0, p2, p1, p1, p2, p3);
  }
  let vote = 0;
  for (let q = 0; q < idx.length; q += 3) {
    a.fromArray(pos, idx[q] * 3); b.fromArray(pos, idx[q + 1] * 3).sub(a); c.fromArray(pos, idx[q + 2] * 3).sub(a);
    n.crossVectors(b, c);
    if (n.lengthSq() < 1e-22) continue;
    d.fromArray(nor, idx[q] * 3).add(a.fromArray(nor, idx[q + 1] * 3)).add(a.fromArray(nor, idx[q + 2] * 3));
    vote += n.dot(d) > 0 ? 1 : -1;
  }
  if (vote < 0) for (let q = 0; q < idx.length; q += 3) [idx[q + 1], idx[q + 2]] = [idx[q + 2], idx[q + 1]];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (cols) g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** smooth 1D interpolation through [[t, value], ...] (sorted by t), cubic Hermite with Catmull-Rom tangents */
export function ip(pts) {
  const n = pts.length;
  const m = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; return (b[1] - a[1]) / ((b[0] - a[0]) || 1); });
  return (t) => {
    if (t <= pts[0][0]) return pts[0][1];
    if (t >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0; while (t > pts[i + 1][0]) i++;
    const [t0, v0] = pts[i], [t1, v1] = pts[i + 1], h = t1 - t0, s = (t - t0) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * v1 + (s3 - s2) * h * m[i + 1];
  };
}
/** profile along an axis: radius(h) from [[h, r], ...] sampled over h0..h1 -> v => [r, h] for revolve() */
export const along = (pts) => { const f = ip(pts), h0 = pts[0][0], h1 = pts[pts.length - 1][0]; return (v) => { const h = lerp(h0, h1, v); return [Math.max(0, f(h)), h]; }; };

/** a smooth profile through control points [[r, h], ...] -> v => [r, h] */
export function profile(pts) {
  const c = new THREE.SplineCurve(pts.map(([r, h]) => new THREE.Vector2(r, h)));
  const v2 = new THREE.Vector2();
  return (v) => { c.getPoint(clamp(v), v2); return [Math.max(0, v2.x), v2.y]; };
}

/**
 * Surface of revolution. prof(v) -> [r, h]; mod(u, v, theta) scales r (lobes, lumps); squash scales the
 * two radial axes. axis 'y' stands it up, 'x' lays it along x (h becomes x).
 */
export function revolve(prof, { axis = 'y', mod = null, squash = [1, 1], off = null, ...o } = {}) {
  return surf((u, v) => {
    const [r0, h] = prof(v), t = u * TAU;
    const r = r0 * (mod ? mod(u, v, t) : 1);
    let a = Math.cos(t) * r * squash[0], b = Math.sin(t) * r * squash[1];
    const O = off ? off(v, h) : [0, 0];
    if (axis === 'x') return [h, a + O[0], b + O[1]];
    return [a + O[0], h, b + O[1]];
  }, o);
}

/**
 * A tube of varying radius along a curve. curve: THREE.Curve (3D); radius(v) -> r; squash: [w, h] of the
 * cross-section; up: reference vector for the frame. mod(u, v) scales the radius.
 */
export function tube(curve, radius, { squash = [1, 1], up = new THREE.Vector3(0, 1, 0), mod = null, lift = null, ...o } = {}) {
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), p = new THREE.Vector3();
  return surf((u, v) => {
    const t = clamp(v, 0, 1);
    curve.getPointAt(t, p); curve.getTangentAt(t, T);
    N.crossVectors(up, T); if (N.lengthSq() < 1e-8) N.set(0, 0, 1); N.normalize();
    B.crossVectors(T, N).normalize();
    const r = radius(t) * (mod ? mod(u, t) : 1), a = u * TAU;
    const cx = Math.cos(a) * r * squash[0], cy = Math.sin(a) * r * squash[1];
    return [p.x + N.x * cx + B.x * cy, p.y + N.y * cx + B.y * cy + (lift ? lift(t) : 0), p.z + N.z * cx + B.z * cy];
  }, o);
}
/** rounded radius for a tube that closes at both ends: r(v) * capping */
export const capped = (r, e0 = 0.06, e1 = 0.06) => (v) => r(v) * Math.sqrt(clamp(v / e0)) * Math.sqrt(clamp((1 - v) / e1));

/** A double-sided sheet: fn(u, v) -> [x, y, z] with u, v in 0..1 */
export function sheet(fn, { nu = 12, nv = 24, color = null } = {}) {
  const g = surf(fn, { nu, nv, color });
  return g;
}

// ---------------------------------------------------------------- materials
const mats = new Map();
/**
 * Food material: vertex colours, physical shading. opts: rough, clear (clearcoat), sheen, metal, map, bump,
 * bumpScale, side ('double'), emissive, emap, opacity, trans, flat, iri
 */
export function fmat(key, o = {}) {
  const k = key + JSON.stringify(o, (n, v) => (v && v.isTexture ? v.uuid : v));
  if (!mats.has(k)) {
    const m = new THREE.MeshPhysicalMaterial({
      color: o.color != null ? toon(new THREE.Color(o.color)) : 0xffffff, vertexColors: o.vc !== false, roughness: 0.25 + (o.rough ?? 0.55) * 0.75, metalness: o.metal ?? 0,
      clearcoat: (o.clear ?? 0) * LOOK.clear, clearcoatRoughness: Math.max(0.2, o.clearRough ?? 0.25), sheen: o.sheen ?? 0, sheenRoughness: 0.6, sheenColor: o.sheenColor ?? 0xffffff,
      map: o.map ?? null, bumpMap: o.bump ?? null, bumpScale: (o.bumpScale ?? 1) * LOOK.bump, side: o.side === 'double' ? THREE.DoubleSide : THREE.FrontSide,
      emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, emissiveMap: o.emap ?? null, transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1,
      flatShading: !!o.flat, iridescence: (o.iri ?? 0) * 0.5, iridescenceIOR: 1.6, roughnessMap: o.rmap ?? null,
    });
    if (o.opacity < 1) m.depthWrite = o.depthWrite ?? true;
    if (!o.metal) rimLight(m);
    mats.set(k, m);
  }
  return mats.get(k);
}

// ---------------------------------------------------------------- canvas textures
/** draw(ctx, size) on a square canvas -> CanvasTexture (cached by key) */
export function ctex(key, size, draw, { srgb = true, repeat = null } = {}) {
  return once('tex:' + key, () => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    draw(g, size);
    const t = new THREE.CanvasTexture(cv);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
    return t;
  });
}
/** grey speckle / pore bump texture */
export function bumpTex(kind, repeat = [1, 1]) {
  return ctex(`bump:${kind}:${repeat}`, 256, (g, S) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
    const r = rng(kind.length * 31 + 7);
    if (kind === 'dimple') {
      for (let i = 0; i < 2600; i++) { const x = r() * S, y = r() * S, rr = 1 + r() * 2.2; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, '#5a5a5a'); gr.addColorStop(1, 'rgba(128,128,128,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    } else if (kind === 'skin') {
      for (let i = 0; i < 1800; i++) { const x = r() * S, y = r() * S, rr = 0.6 + r() * 1.6; g.fillStyle = `rgba(${r() < 0.5 ? '170,170,170' : '90,90,90'},0.6)`; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); }
    } else if (kind === 'goose') {
      for (let i = 0; i < 900; i++) { const x = r() * S, y = r() * S, rr = 1.5 + r() * 1.5; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, '#c8c8c8'); gr.addColorStop(1, 'rgba(128,128,128,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    } else if (kind === 'scales') {
      const n = 16, w = S / n;
      for (let j = 0; j < n * 2 + 1; j++) for (let i = -1; i <= n; i++) {
        const x = (i + (j % 2) * 0.5) * w, y = j * w * 0.5;
        const gr = g.createRadialGradient(x, y - w * 0.2, 0, x, y, w * 0.62); gr.addColorStop(0, '#a8a8a8'); gr.addColorStop(0.85, '#7a7a7a'); gr.addColorStop(1, '#505050');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, w * 0.6, 0, Math.PI); g.fill();
      }
    } else if (kind === 'weave') {
      const n = 32, w = S / n;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const over = (i + j) % 2;
        const gr = over ? g.createLinearGradient(i * w, 0, i * w + w, 0) : g.createLinearGradient(0, j * w, 0, j * w + w);
        gr.addColorStop(0, '#606060'); gr.addColorStop(0.5, '#b0b0b0'); gr.addColorStop(1, '#606060');
        g.fillStyle = gr; g.fillRect(i * w, j * w, w, w);
      }
    } else if (kind === 'grain') {
      for (let y = 0; y < S; y++) { const v = 128 + Math.sin(y * 0.9 + Math.sin(y * 0.05) * 6) * 30 + (r() - 0.5) * 20; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, S, 1); }
    } else if (kind === 'crumb') {
      for (let i = 0; i < 1500; i++) { const x = r() * S, y = r() * S, rr = 0.8 + r() * r() * 5; g.fillStyle = 'rgba(40,40,40,0.55)'; g.beginPath(); g.ellipse(x, y, rr, rr * (0.5 + r() * 0.5), r() * 3, 0, TAU); g.fill(); }
    } else if (kind === 'brushed') {
      for (let y = 0; y < S; y++) { const v = 128 + (r() - 0.5) * 50; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, S, 1); }
    }
  }, { srgb: false, repeat });
}
