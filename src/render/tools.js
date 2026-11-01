// Kitchen tools: chef's knife, end-grain cutting board, skillet, stock pot and gas burner. Modelled from
// real profiles (lathes and extruded outlines) with wood-grain and brushed-steel textures.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { TAU, once, ctex, rng, bumpTex } from './geo.js';

const mesh = (geo, m, p, r, s) => { const o = new THREE.Mesh(geo, m); if (p) o.position.set(...p); if (r) o.rotation.set(...r); if (s) o.scale.set(...s); o.castShadow = o.receiveShadow = true; return o; };
const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg);
const M = {
  steel: () => once('m:steel', () => new THREE.MeshPhysicalMaterial({ color: 0xc4cad0, metalness: 0.6, roughness: 0.3, clearcoat: 0.3, bumpMap: bumpTex('brushed', [1, 6]), bumpScale: 0.25 })),
  blade: () => once('m:blade', () => new THREE.MeshPhysicalMaterial({ color: 0xd8dde2, metalness: 0.55, roughness: 0.2, clearcoat: 0.6 })),
  cast: () => once('m:cast', () => new THREE.MeshPhysicalMaterial({ color: 0x2c2d31, metalness: 0.35, roughness: 0.5, clearcoat: 0.2 })),
  nonstick: () => once('m:nonstick', () => new THREE.MeshPhysicalMaterial({ color: 0x2a2b2f, metalness: 0.2, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.4 })),
  handle: () => once('m:handle', () => new THREE.MeshPhysicalMaterial({ color: 0x3a2214, roughness: 0.45, clearcoat: 0.5, bumpMap: bumpTex('grain', [1, 1]), bumpScale: 0.6 })),
  rivet: () => once('m:rivet', () => new THREE.MeshPhysicalMaterial({ color: 0xd0d4d8, metalness: 0.6, roughness: 0.25 })),
};

function woodTex(seed, base = [196, 140, 86]) {
  return ctex(`wood:${seed}`, 512, (c, S) => {
    const r = rng(seed);
    const img = c.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const w = Math.sin((y + Math.sin(x * 0.012 + seed) * 18 + Math.sin(x * 0.05) * 3) * 0.16) * 0.5 + 0.5;
      const k = 0.82 + w * 0.22 + (Math.sin(x * 0.9 + y * 0.03) * 0.02);
      const i = (y * S + x) * 4;
      img.data[i] = base[0] * k; img.data[i + 1] = base[1] * k; img.data[i + 2] = base[2] * k; img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    // knife marks and a juice groove
    c.strokeStyle = 'rgba(90,55,25,0.18)'; c.lineWidth = 1;
    for (let i = 0; i < 90; i++) { const x = S * (0.2 + r() * 0.6), y = S * (0.2 + r() * 0.6), a = (r() - 0.5) * 0.6, l = 10 + r() * 40; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
    c.strokeStyle = 'rgba(80,45,20,0.45)'; c.lineWidth = 6;
    c.beginPath(); c.roundRect(S * 0.06, S * 0.08, S * 0.88, S * 0.84, S * 0.08); c.stroke();
    c.strokeStyle = 'rgba(255,230,190,0.25)'; c.lineWidth = 2;
    c.beginPath(); c.roundRect(S * 0.06 + 3, S * 0.08 + 3, S * 0.88, S * 0.84, S * 0.08); c.stroke();
  });
}

/** cutting board, top at y = 0.05, ~0.62 x 0.48 */
export function makeBoard() {
  return once('board', () => {
    const g = new THREE.Group();
    const w = 0.62, d = 0.48, rr = 0.05;
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2 + rr, -d / 2); sh.lineTo(w / 2 - rr, -d / 2); sh.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + rr); sh.lineTo(w / 2, d / 2 - rr); sh.quadraticCurveTo(w / 2, d / 2, w / 2 - rr, d / 2);
    sh.lineTo(-w / 2 + rr, d / 2); sh.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - rr); sh.lineTo(-w / 2, -d / 2 + rr); sh.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + rr, -d / 2);
    const hole = new THREE.Path(); hole.absellipse(-w / 2 + 0.07, 0, 0.022, 0.06, 0, TAU, true); sh.holes.push(hole);
    const e = new THREE.ExtrudeGeometry(sh, { depth: 0.034, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 16 });
    e.rotateX(-Math.PI / 2); e.translate(0, 0.008, 0);
    const tex = woodTex(3); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1 / w, 1 / d); tex.offset.set(0.5, 0.5);
    const top = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5, bumpMap: bumpTex('grain', [2, 2]), bumpScale: 0.4 });
    const side = new THREE.MeshPhysicalMaterial({ color: 0xa8743e, roughness: 0.6, bumpMap: bumpTex('grain', [6, 1]), bumpScale: 0.5 });
    g.add(mesh(e, [top, side]));
    for (const [x, z] of [[-0.25, -0.18], [0.25, -0.18], [-0.25, 0.18], [0.25, 0.18]]) g.add(mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.01, 12), once('m:feet', () => new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 })), [x, 0.003, z]));
    return g;
  }).clone();
}

/** chef's knife: blade in the y-z plane along +z, edge down (-y), handle towards -z; origin at the grip */
export function makeKnife() {
  return once('knife', () => {
    const g = new THREE.Group();
    const s = new THREE.Shape();
    s.moveTo(0.0, -0.03); s.lineTo(0.15, -0.026); s.quadraticCurveTo(0.21, -0.022, 0.24, 0.006); s.quadraticCurveTo(0.18, 0.012, 0.12, 0.018); s.lineTo(0.0, 0.02); s.lineTo(0.0, -0.03);
    const blade = new THREE.ExtrudeGeometry(s, { depth: 0.002, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0016, bevelSegments: 2, curveSegments: 16 });
    blade.translate(0, 0, -0.001); blade.rotateY(-Math.PI / 2);
    g.add(mesh(blade, M.blade(), [0, 0, 0.055]));
    g.add(mesh(new RoundedBoxGeometry(0.012, 0.052, 0.016, 2, 0.004), M.steel(), [0, -0.003, 0.05]));
    const handle = new RoundedBoxGeometry(0.02, 0.03, 0.11, 3, 0.009);
    g.add(mesh(handle, M.handle(), [0, 0.002, -0.012]));
    for (const z of [-0.045, -0.012, 0.022]) g.add(mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.022, 10), M.rivet(), [0, 0.002, z], [0, 0, Math.PI / 2]));
    return g;
  }).clone();
}

/** skillet, cooking surface at y ~ 0.115, handle along +x */
export function makePan() {
  return once('pan', () => {
    const g = new THREE.Group();
    g.add(mesh(lathe([[0, 0.05], [0.25, 0.05], [0.272, 0.056], [0.3, 0.1], [0.322, 0.135], [0.326, 0.14], [0.318, 0.141], [0.29, 0.11], [0.262, 0.067], [0.24, 0.062], [0, 0.062]], 64), M.cast()));
    g.add(mesh(new THREE.CircleGeometry(0.255, 48), M.nonstick(), [0, 0.0625, 0], [-Math.PI / 2, 0, 0]));
    const hc = new THREE.CatmullRomCurve3([[0.3, 0.12, 0], [0.38, 0.135, 0], [0.5, 0.16, 0], [0.6, 0.175, 0]].map((p) => new THREE.Vector3(...p)));
    const h = new THREE.TubeGeometry(hc, 20, 0.016, 12);
    g.add(mesh(h, M.steel(), null, null, [1, 1, 1.3]));
    g.add(mesh(new THREE.TorusGeometry(0.012, 0.004, 8, 16), M.cast(), [0.6, 0.176, 0], [Math.PI / 2, 0, 0]));
    for (const z of [-0.012, 0.012]) g.add(mesh(new THREE.SphereGeometry(0.006, 8, 6), M.rivet(), [0.303, 0.122, z]));
    return g;
  }).clone();
}

/** stock pot, rim at y ~ 0.36 */
export function makePot() {
  return once('pot', () => {
    const g = new THREE.Group();
    g.add(mesh(lathe([[0, 0.04], [0.27, 0.04], [0.29, 0.06], [0.295, 0.1], [0.295, 0.34], [0.302, 0.352], [0.3, 0.362], [0.288, 0.36], [0.283, 0.34], [0.283, 0.07], [0.265, 0.055], [0, 0.055]], 64), M.steel()));
    for (const s of [-1, 1]) {
      g.add(mesh(new THREE.TorusGeometry(0.045, 0.011, 10, 20, Math.PI), M.steel(), [s * 0.3, 0.3, 0], [0, s > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI / 2]));
      for (const z of [-0.04, 0.04]) g.add(mesh(new THREE.SphereGeometry(0.007, 8, 6), M.rivet(), [s * 0.297, 0.3, z]));
    }
    return g;
  }).clone();
}

/** gas burner: cast-iron grate over a burner head; returns { group, ring } where ring glows when lit */
export function makeBurner() {
  const g = once('burner', () => {
    const g = new THREE.Group();
    g.add(mesh(lathe([[0, 0.01], [0.14, 0.01], [0.15, 0.02], [0.12, 0.035], [0.06, 0.04], [0, 0.04]], 32), M.cast()));
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU + Math.PI / 4;
      g.add(mesh(new RoundedBoxGeometry(0.2, 0.022, 0.024, 2, 0.006), M.cast(), [Math.cos(a) * 0.2, 0.05, Math.sin(a) * 0.2], [0, -a, 0]));
      g.add(mesh(new RoundedBoxGeometry(0.03, 0.05, 0.03, 2, 0.008), M.cast(), [Math.cos(a) * 0.3, 0.025, Math.sin(a) * 0.3]));
    }
    g.add(mesh(new THREE.TorusGeometry(0.3, 0.012, 8, 48), M.cast(), [0, 0.05, 0], [Math.PI / 2, 0, 0]));
    return g;
  }).clone();
  const ring = mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 32), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, emissive: 0x3a7aff, emissiveIntensity: 0, roughness: 0.6 }), [0, 0.04, 0], [Math.PI / 2, 0, 0]);
  g.add(ring);
  return { group: g, ring };
}
