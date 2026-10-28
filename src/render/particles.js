// Pooled particles: soft sprites (steam, smoke, bubbles, foam, spray, sparkles) drawn as one
// Points cloud per blend mode, plus little solid chunks (food bits, splinters) as an InstancedMesh.
import * as THREE from 'three';

const spriteVert = /* glsl */`
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
attribute float aRing;
varying float vAlpha;
varying vec3 vColor;
varying float vRing;
uniform float uScale;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -mv.z;
  vAlpha = aAlpha; vColor = aColor; vRing = aRing;
  gl_Position = projectionMatrix * mv;
}`;
const spriteFrag = /* glsl */`
varying float vAlpha;
varying vec3 vColor;
varying float vRing;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float a = vRing > 0.5 ? smoothstep(1.0, 0.8, r) * smoothstep(0.45, 0.75, r) + 0.15 * (1.0 - r) + smoothstep(0.5, 0.0, length(p - vec2(-0.35, 0.35))) * 0.8
                       : pow(1.0 - r, 1.6);
  gl_FragColor = vec4(vColor, a * vAlpha);
  #include <colorspace_fragment>
}`;

class SpritePool {
  constructor(max, additive) {
    this.max = max;
    this.list = [];
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.color = new Float32Array(max * 3);
    this.ring = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aRing', new THREE.BufferAttribute(this.ring, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } }, vertexShader: spriteVert, fragmentShader: spriteFrag,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }
  add(p) { if (this.list.length < this.max) this.list.push(p); else this.list[(Math.random() * this.max) | 0] = p; }
  update(dt) {
    const L = this.list;
    let n = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy -= (p.g || 0) * dt;
      const drag = Math.exp(-(p.drag || 0) * dt);
      p.vx *= drag; p.vy *= drag; p.vz *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.floor != null && p.y < p.floor) { p.y = p.floor; p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; }
      L[n++] = p;
      const k = p.age / p.life;
      const j = n - 1;
      this.pos[j * 3] = p.x; this.pos[j * 3 + 1] = p.y; this.pos[j * 3 + 2] = p.z;
      this.size[j] = p.s0 + (p.s1 - p.s0) * k;
      const fadeIn = p.fadeIn ? Math.min(1, p.age / p.fadeIn) : 1;
      this.alpha[j] = p.a * fadeIn * (1 - Math.pow(k, p.fadePow || 1.5));
      if (p.e) { // colour over life (flames: yellow -> orange -> red)
        this.color[j * 3] = p.c.r + (p.e.r - p.c.r) * k; this.color[j * 3 + 1] = p.c.g + (p.e.g - p.c.g) * k; this.color[j * 3 + 2] = p.c.b + (p.e.b - p.c.b) * k;
      } else { this.color[j * 3] = p.c.r; this.color[j * 3 + 1] = p.c.g; this.color[j * 3 + 2] = p.c.b; }
      this.ring[j] = p.ring ? 1 : 0;
    }
    L.length = n;
    this.geo.setDrawRange(0, n);
    for (const a of ['position', 'aSize', 'aAlpha', 'aColor', 'aRing']) this.geo.attributes[a].needsUpdate = true;
  }
}

const tmpC = new THREE.Color();
const dummy = new THREE.Object3D();

export class Particles {
  constructor(max = 900) {
    this.group = new THREE.Group();
    this.soft = new SpritePool(max, false);
    this.glow = new SpritePool(Math.floor(max / 2), true);
    this.group.add(this.soft.points, this.glow.points);
    // solid chunks
    this.chunkMax = 260;
    this.chunks = [];
    this.chunkMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true }), this.chunkMax);
    this.chunkMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.chunkMax * 3), 3);
    this.chunkMesh.count = 0;
    this.chunkMesh.castShadow = true;
    this.chunkMesh.frustumCulled = false;
    this.group.add(this.chunkMesh);
  }
  setScale(px) { this.soft.mat.uniforms.uScale.value = px; this.glow.mat.uniforms.uScale.value = px; }

  /** Soft sprite. o: {x,y,z, vx,vy,vz, life, s0, s1, a, color, color1 (end colour), g, drag, glow, ring, floor, fadeIn} */
  puff(o) {
    if (this.map) this.map(o);
    const c = tmpC.set(o.color ?? 0xffffff);
    const p = { x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, age: 0, life: o.life || 1, s0: o.s0 ?? 0.2, s1: o.s1 ?? o.s0 ?? 0.2, a: o.a ?? 1, c: { r: c.r, g: c.g, b: c.b }, g: o.g || 0, drag: o.drag || 0, ring: o.ring, floor: o.floor, fadeIn: o.fadeIn, fadePow: o.fadePow };
    if (o.color1 != null) { const e = tmpC.set(o.color1); p.e = { r: e.r, g: e.g, b: e.b }; }
    (o.glow ? this.glow : this.soft).add(p);
  }
  /** Flame lick: rises, shrinks and cools from yellow to red. */
  flame(x, y, z, o = {}) {
    const s = o.s ?? 0.3;
    this.puff({ x: x + (Math.random() - 0.5) * (o.spread ?? 0.2), y, z: z + (Math.random() - 0.5) * (o.spread ?? 0.2), vx: (o.vx || 0) + (Math.random() - 0.5) * 0.3, vy: (o.vy ?? 1.6) * (0.7 + Math.random() * 0.6), vz: (o.vz || 0) + (Math.random() - 0.5) * 0.3, drag: o.drag ?? 1.2, life: (o.life ?? 0.55) * (0.7 + Math.random() * 0.6), s0: s, s1: s * 0.25, a: o.a ?? 0.9, color: o.hot ? 0xfff0a0 : 0xffc040, color1: 0xc01a00, glow: true, fadePow: 2 });
  }
  /** Solid chunk that tumbles and bounces. */
  chunk(o) {
    if (this.map) this.map(o);
    const c = tmpC.set(o.color ?? 0xffffff);
    const p = { x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, age: 0, life: o.life || 0.8, s: o.s || 0.03, c: [c.r, c.g, c.b], floor: o.floor ?? 0, rx: Math.random() * 6, ry: Math.random() * 6, sx: o.sx || 1, sy: o.sy || 1, sz: o.sz || 1, spin: (Math.random() - 0.5) * 20 };
    if (this.chunks.length >= this.chunkMax) this.chunks.shift();
    this.chunks.push(p);
  }
  burst(n, fn) { for (let i = 0; i < n; i++) fn(i); }

  update(dt) {
    this.soft.update(dt); this.glow.update(dt);
    let n = 0;
    const C = this.chunks;
    for (let i = 0; i < C.length; i++) {
      const p = C[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy -= 9.8 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < p.floor + p.s) { p.y = p.floor + p.s; p.vy = Math.abs(p.vy) * 0.35; p.vx *= 0.6; p.vz *= 0.6; p.spin *= 0.5; }
      p.rx += p.spin * dt; p.ry += p.spin * 0.7 * dt;
      C[n++] = p;
      const k = p.age / p.life;
      const s = p.s * (k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, 0);
      dummy.scale.set(s * p.sx, s * p.sy, s * p.sz);
      dummy.updateMatrix();
      this.chunkMesh.setMatrixAt(n - 1, dummy.matrix);
      this.chunkMesh.instanceColor.setXYZ(n - 1, p.c[0], p.c[1], p.c[2]);
    }
    C.length = n;
    this.chunkMesh.count = n;
    this.chunkMesh.instanceMatrix.needsUpdate = true;
    this.chunkMesh.instanceColor.needsUpdate = true;
  }
}
