// The pirate galleon the World 1 kitchen is built on: a lofted hull (sheer, tumblehome, pointed
// bow, transom stern with lit windows), painted wales with gunports and cannons, three masts with
// billowing canvas, jibs to the bowsprit, rigging, a stern castle, lanterns and the Jolly Roger.
// Everything here rides on the kitchen root, so it rolls with the deck.
import * as THREE from 'three';
import { mat, part, sph, cyl, box, cone, tor } from './items.js';

const DECK_Y = -0.01;
export const WATERLINE = -1.75;

function canvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const prand = (() => { let s = 1234567; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

/** Horizontal hull planking (greyscale-ish wood; tinted per band by vertex colours). */
function plankTex() {
  const t = canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#c9a37a'; g.fillRect(0, 0, w, h);
    const rows = 16, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r * 137) % w;
      for (let x = -off; x < w; x += 170 + (r % 3) * 30) {
        const v = 0.82 + prand() * 0.28;
        g.fillStyle = `rgb(${200 * v | 0},${163 * v | 0},${122 * v | 0})`;
        g.fillRect(x + 1, r * rh + 1, 168, rh - 2);
        // grain
        g.strokeStyle = `rgba(90,55,30,${0.12 + prand() * 0.1})`; g.lineWidth = 1;
        for (let k = 0; k < 4; k++) { const y = r * rh + 3 + prand() * (rh - 6); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 50, y + prand() * 3 - 1.5, x + 110, y - prand() * 3 + 1.5, x + 168, y); g.stroke(); }
        // trenails
        g.fillStyle = 'rgba(60,35,20,0.6)';
        g.fillRect(x + 6, r * rh + rh * 0.3, 3, 3); g.fillRect(x + 6, r * rh + rh * 0.65, 3, 3);
        g.fillStyle = 'rgba(40,24,14,0.9)'; g.fillRect(x, r * rh, 2, rh);
      }
      g.fillStyle = 'rgba(35,20,12,0.9)'; g.fillRect(0, r * rh, w, 2);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function deckTex() {
  const t = canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#b48a5c'; g.fillRect(0, 0, w, h);
    const cols = 8, cw = w / cols;
    for (let c = 0; c < cols; c++) {
      const off = (c * 211) % h;
      for (let y = -off; y < h; y += 256) {
        const v = 0.85 + prand() * 0.25;
        g.fillStyle = `rgb(${186 * v | 0},${142 * v | 0},${96 * v | 0})`;
        g.fillRect(c * cw + 1, y, cw - 2, 254);
        g.strokeStyle = 'rgba(90,60,30,0.18)';
        for (let k = 0; k < 5; k++) { const x = c * cw + 4 + prand() * (cw - 8); g.beginPath(); g.moveTo(x, y); g.lineTo(x + prand() * 4 - 2, y + 254); g.stroke(); }
        g.fillStyle = 'rgba(30,18,10,0.85)'; g.fillRect(c * cw, y + 254, cw, 2);
      }
      g.fillStyle = 'rgba(25,15,8,0.9)'; g.fillRect(c * cw, 0, 2, h);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function sailTex(patch, dark = false) {
  return canvas(256, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, dark ? '#4a3a34' : '#f6eedb'); grd.addColorStop(1, dark ? '#2e2420' : '#e6d8b8');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // vertical cloths
    for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(120,95,60,0.18)'; g.fillRect(x, 0, 2, h); }
    // reef bands
    for (const y of [h * 0.22, h * 0.42]) { g.fillStyle = 'rgba(120,95,60,0.3)'; g.fillRect(0, y, w, 4); for (let x = 8; x < w; x += 16) { g.fillStyle = 'rgba(90,70,40,0.6)'; g.fillRect(x, y - 3, 2, 10); } }
    // weathering
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(110,85,50,${prand() * 0.06})`; g.fillRect(prand() * w, prand() * h, 3 + prand() * 12, 3 + prand() * 12); }
    if (patch) { g.fillStyle = 'rgba(190,160,110,0.9)'; g.fillRect(w * 0.62, h * 0.55, 46, 38); g.strokeStyle = 'rgba(90,70,40,0.7)'; g.setLineDash([4, 3]); g.strokeRect(w * 0.62, h * 0.55, 46, 38); }
    // bolt rope edge
    g.setLineDash([]); g.strokeStyle = 'rgba(120,90,55,0.8)'; g.lineWidth = 5; g.strokeRect(2, 2, w - 4, h - 4);
  });
}

function jollyRoger() {
  return canvas(256, 160, (g, w, h) => {
    g.fillStyle = '#141414'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${prand() * 0.04})`; g.fillRect(prand() * w, prand() * h, 4, 4); }
    g.translate(w / 2, h / 2 - 8);
    g.fillStyle = '#f2efe6';
    // crossbones
    for (const s of [-1, 1]) {
      g.save(); g.rotate(s * 0.6);
      g.fillRect(-62, -6, 124, 12);
      for (const e of [-1, 1]) { g.beginPath(); g.arc(e * 64, -7, 9, 0, 7); g.arc(e * 64, 7, 9, 0, 7); g.fill(); }
      g.restore();
    }
    // skull
    g.beginPath(); g.ellipse(0, -14, 34, 32, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(-20, 6, 40, 22);
    g.fillStyle = '#141414';
    g.beginPath(); g.ellipse(-13, -14, 9, 10, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(13, -14, 9, 10, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(0, -2); g.lineTo(-5, 8); g.lineTo(5, 8); g.fill();
    for (let i = -2; i <= 2; i++) g.fillRect(i * 7 - 1, 18, 2, 10);
  });
}

function windowTex() {
  return canvas(128, 64, (g, w, h) => {
    g.fillStyle = '#2a1608'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      const x = 8 + i * 30;
      const grd = g.createRadialGradient(x + 11, 34, 2, x + 11, 34, 26);
      grd.addColorStop(0, '#fff2b0'); grd.addColorStop(1, '#ff9a2a');
      g.fillStyle = grd;
      g.beginPath(); g.moveTo(x, 54); g.lineTo(x, 22); g.arc(x + 11, 22, 11, Math.PI, 0); g.lineTo(x + 22, 54); g.fill();
      g.fillStyle = '#2a1608'; g.fillRect(x + 10, 10, 2, 46); g.fillRect(x, 36, 22, 2);
    }
  });
}

/** Rope between two points. */
function rope(a, b, r = 0.022, m = mat(0x3a2a1a, { rough: 0.9 })) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const mesh = new THREE.Mesh(cyl(6), m);
  mesh.scale.set(r, len, r);
  mesh.position.copy(A).add(B).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  mesh.castShadow = false;
  return mesh;
}

/** Billowing sail: a segmented plane displaced every frame. */
function makeSail(w, h, tex, { belly = 0.5, taper = 0, tri = false } = {}) {
  const geo = new THREE.PlaneGeometry(w, h, 12, 10);
  const pos = geo.attributes.position;
  const base = Float32Array.from(pos.array);
  if (tri) {
    // triangle: squeeze the top edge to a point at the left
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1];
      const v = (y + h / 2) / h; // 0 bottom .. 1 top
      base[i * 3] = -w / 2 + (x + w / 2) * (1 - v);
    }
  } else if (taper) {
    for (let i = 0; i < pos.count; i++) { const v = (base[i * 3 + 1] + h / 2) / h; base[i * 3] *= 1 - taper * v; }
  }
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, color: 0xe2dccf, side: THREE.DoubleSide, roughness: 0.95 }));
  m.castShadow = true;
  const update = (t, phase = 0) => {
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1];
      const u = (x + w / 2) / w, v = (y + h / 2) / h;
      const shape = Math.sin(Math.PI * Math.min(1, Math.max(0, u))) * Math.sin(Math.PI * (0.15 + v * 0.85));
      const gust = 1 + Math.sin(t * 1.1 + phase) * 0.12 + Math.sin(t * 2.7 + phase * 2) * 0.05;
      const ripple = Math.sin(u * 9 - t * 4 + phase) * 0.025 * (1 - v);
      pos.array[i * 3] = base[i * 3]; pos.array[i * 3 + 1] = y;
      pos.array[i * 3 + 2] = shape * belly * gust + ripple;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };
  update(0);
  return { mesh: m, update };
}

/** Flag plane waving from its left edge. */
function makeFlag(w, h, tex) {
  const geo = new THREE.PlaneGeometry(w, h, 14, 6);
  const pos = geo.attributes.position;
  const base = Float32Array.from(pos.array);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }));
  m.castShadow = true;
  return {
    mesh: m,
    update(t) {
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        const u = (x + w / 2) / w;
        pos.array[i * 3 + 2] = Math.sin(u * 6 - t * 7) * 0.12 * u + Math.sin(u * 3 + y * 2 - t * 4) * 0.05 * u;
        pos.array[i * 3 + 1] = y - u * u * 0.06;
      }
      pos.needsUpdate = true; geo.computeVertexNormals();
    },
  };
}

/**
 * Build the galleon around a W x H kitchen centred on the origin (kitchen floor top at y=0).
 * Returns { group, update(t), hull: {cx, cz, hl, hb, bow, stern} } (hull = waterline outline for the ocean foam).
 */
export function buildShip(W, H, { rival = false } = {}) {
  const g = new THREE.Group();
  const updaters = [];
  const B = H / 2 + 0.75;                 // half beam at the deck
  const xS0 = -W / 2 - 1.4, xB0 = W / 2 + 0.9; // parallel midbody
  const bowLen = 4.2, sternLen = 1.0;
  const xMin = xS0 - sternLen, xMax = xB0 + bowLen;
  const KEEL = -3.4;
  const gunwale = (x) => {
    const fwd = Math.max(0, (x - xB0) / bowLen), aft = Math.max(0, (xS0 - x) / sternLen);
    return 0.55 + fwd * fwd * 0.9 + (x < xS0 + 1.6 ? 1.15 * Math.min(1, (xS0 + 1.6 - x) / 1.6) : 0) + aft * 0.2;
  };
  const beamAt = (x) => {
    if (x > xB0) { const k = (x - xB0) / bowLen; return B * Math.sqrt(Math.max(0, 1 - k * k)); }
    if (x < xS0) { const k = (xS0 - x) / sternLen; return B * (1 - 0.12 * k * k); }
    return B;
  };
  const keelAt = (x) => (x > xB0 ? KEEL + (KEEL * -0.62) * Math.pow((x - xB0) / bowLen, 2.2) : KEEL);
  // section shape: v=0 at the gunwale, 1 at the keel; returns fraction of beam
  const shapeF = (v) => (v < 0.18 ? 0.92 + 0.08 * Math.sin((v / 0.18) * Math.PI / 2) : Math.pow(Math.max(0, Math.cos(Math.min(1, (v - 0.18) / 0.82) * Math.PI / 2)), 0.55));
  const sectionY = (x, v) => { const top = gunwale(x), bot = keelAt(x); return top + (bot - top) * v; };
  /** hull half-width at (x, y) */
  const halfAt = (x, y) => {
    const top = gunwale(x), bot = keelAt(x);
    const v = Math.min(1, Math.max(0, (top - y) / (top - bot)));
    return beamAt(x) * shapeF(v);
  };

  // ---------- hull skin (both sides), vertex-coloured paint bands over a plank texture
  const NX = 72, NV = 22;
  const paint = (y) => {
    if (y > 0.05) return [0.16, 0.1, 0.07];                    // dark bulwark
    if (y > -0.12) return [0.95, 0.72, 0.28];                  // gilt rail
    if (y > -0.32) return [0.13, 0.08, 0.06];                  // black wale
    if (y > -1.02) return [0.72, 0.18, 0.1];                   // red gun deck band
    if (y > -1.2) return [0.13, 0.08, 0.06];                   // black wale
    if (y > WATERLINE + 0.1) return [0.55, 0.36, 0.22];        // bare oiled planks
    return [0.62, 0.32, 0.16];                                 // coppered bottom
  };
  const pos = [], uv = [], col = [], idx = [];
  for (const side of [1, -1]) {
    const start = pos.length / 3;
    for (let i = 0; i <= NX; i++) {
      const x = xMin + (xMax - xMin) * (i / NX);
      for (let j = 0; j <= NV; j++) {
        const v = j / NV;
        const y = sectionY(x, v);
        const z = side * beamAt(x) * shapeF(v);
        pos.push(x, y, z);
        uv.push(x * 0.35, y * 0.55);
        col.push(...paint(y));
      }
    }
    for (let i = 0; i < NX; i++) for (let j = 0; j < NV; j++) {
      const a = start + i * (NV + 1) + j, b = a + NV + 1;
      if (side > 0) idx.push(a, a + 1, b, b, a + 1, b + 1); else idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  hullGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  hullGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  hullGeo.setIndex(idx);
  hullGeo.computeVertexNormals();
  const plank = plankTex();
  const hullM = new THREE.MeshStandardMaterial({ map: plank, vertexColors: true, roughness: 0.62, metalness: 0.02, side: THREE.DoubleSide });
  const hull = new THREE.Mesh(hullGeo, hullM);
  hull.castShadow = true; hull.receiveShadow = true;
  g.add(hull);

  // ---------- transom (flat stern face) with gallery windows
  {
    const shape = new THREE.Shape();
    const pts = [];
    for (let j = 0; j <= NV; j++) { const v = j / NV; pts.push([beamAt(xMin) * shapeF(v), sectionY(xMin, v)]); }
    shape.moveTo(-pts[0][0], pts[0][1]);
    for (const [z, y] of pts) shape.lineTo(-z, y);
    for (let j = pts.length - 1; j >= 0; j--) shape.lineTo(pts[j][0], pts[j][1]);
    const tg = new THREE.ShapeGeometry(shape);
    tg.rotateY(-Math.PI / 2);
    const tr = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: 0x4a2a16, roughness: 0.7, side: THREE.DoubleSide }));
    tr.position.x = xMin;
    g.add(tr);
    const win = part(new THREE.PlaneGeometry(B * 1.3, 0.62), new THREE.MeshStandardMaterial({ map: windowTex(), emissive: 0xffffff, emissiveMap: windowTex(), emissiveIntensity: 1.1, roughness: 0.4 }), [xMin - 0.02, gunwale(xMin) - 0.55, 0], 1, [0, -Math.PI / 2, 0]);
    win.castShadow = false;
    g.add(win);
    g.add(part(box(), mat(0xd8a84a, { metal: 0.7, rough: 0.35 }), [xMin - 0.04, gunwale(xMin) - 0.18, 0], [0.06, 0.08, B * 1.5]));
    g.add(part(box(), mat(0xd8a84a, { metal: 0.7, rough: 0.35 }), [xMin - 0.04, gunwale(xMin) - 0.92, 0], [0.06, 0.08, B * 1.4]));
  }

  // ---------- deck (outside the kitchen rectangle) + below-deck hold under the kitchen's gaps
  {
    const shape = new THREE.Shape();
    const N = 60;
    const outline = [];
    for (let i = 0; i <= N; i++) { const x = xMin + (xMax - xMin) * (i / N); outline.push([x, halfAt(x, 0) - 0.04]); }
    shape.moveTo(outline[0][0], -outline[0][1]);
    for (const [x, z] of outline) shape.lineTo(x, -z);
    for (let i = outline.length - 1; i >= 0; i--) shape.lineTo(outline[i][0], outline[i][1]);
    const hole = new THREE.Path();
    hole.moveTo(-W / 2, -H / 2); hole.lineTo(W / 2, -H / 2); hole.lineTo(W / 2, H / 2); hole.lineTo(-W / 2, H / 2); hole.lineTo(-W / 2, -H / 2);
    if (!rival) shape.holes.push(hole);
    const dg = new THREE.ShapeGeometry(shape);
    dg.rotateX(Math.PI / 2);
    const uvA = dg.attributes.uv, pA = dg.attributes.position;
    for (let i = 0; i < uvA.count; i++) uvA.setXY(i, pA.getX(i) * 0.45, pA.getZ(i) * 0.45);
    const deck = new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ map: deckTex(), roughness: 0.75, side: THREE.DoubleSide }));
    deck.position.y = DECK_Y;
    deck.receiveShadow = true;
    g.add(deck);
    // hold: dark open box + bilge water, seen through gaps in the kitchen deck
    if (!rival) {
    const hold = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, 1.8, H - 0.02), new THREE.MeshStandardMaterial({ map: plank, color: 0x3a2412, roughness: 0.9, side: THREE.BackSide }));
    hold.position.y = -0.95;
    g.add(hold);
    const bilge = part(new THREE.PlaneGeometry(W - 0.04, H - 0.04), new THREE.MeshStandardMaterial({ color: 0x0e3a4a, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.92 }), [0, -1.25, 0], 1, [-Math.PI / 2, 0, 0]);
    bilge.castShadow = false;
    g.add(bilge);
    updaters.push((t) => { bilge.position.y = -1.25 + Math.sin(t * 1.3) * 0.04; });
    }
  }

  // ---------- gunwale cap rail + front balusters
  {
    const railM = mat(0x5a3418, { rough: 0.5 });
    for (const side of [1, -1]) {
      const pts = [];
      for (let i = 0; i <= 50; i++) { const x = xMin + 0.02 + (xMax - xMin - 0.05) * (i / 50); pts.push(new THREE.Vector3(x, gunwale(x) + 0.03, side * (halfAt(x, gunwale(x)) + 0.01))); }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.07, 6), railM);
      tube.castShadow = true;
      g.add(tube);
    }
  }

  // ---------- gunports + cannons along both sides
  const muzzles = [];
  {
    const lidM = mat(0x8a1a12, { rough: 0.6 }), portM = mat(0x0c0806, { rough: 1 }), iron = mat(0x1c1c20, { metal: 0.7, rough: 0.35 });
    for (const side of [1, -1]) {
      for (let x = xS0 + 1.2; x < xB0 + 1.4; x += 1.55) {
        const y = -0.62;
        const z = side * (halfAt(x, y) + 0.005);
        const port = new THREE.Group();
        port.position.set(x, y, z);
        port.rotation.y = side > 0 ? 0 : Math.PI;
        port.add(part(box(), portM, [0, 0, 0], [0.42, 0.38, 0.03]));
        port.add(part(box(), mat(0xd8a84a, { metal: 0.6, rough: 0.4 }), [0, 0, 0.005], [0.5, 0.46, 0.02]));
        port.children[1].position.z = -0.002;
        const lid = part(box(), lidM, [0, 0.38, 0.12], [0.44, 0.04, 0.4], [0.35, 0, 0]);
        port.add(lid);
        const barrel = new THREE.Group();
        barrel.add(part(cyl(14), iron, [0, 0, 0.22], [0.075, 0.48, 0.075], [Math.PI / 2, 0, 0]));
        barrel.add(part(cyl(14), iron, [0, 0, 0.45], [0.095, 0.06, 0.095], [Math.PI / 2, 0, 0]));
        barrel.add(part(cyl(14), mat(0x050505), [0, 0, 0.481], [0.05, 0.01, 0.05], [Math.PI / 2, 0, 0]));
        port.add(barrel);
        g.add(port);
        if (side > 0) muzzles.push(new THREE.Vector3(x, y, z + 0.5));
      }
    }
  }

  // ---------- stern castle (raised quarterdeck) with railing, wheel and lanterns
  const lanterns = [];
  const makeLantern = (x, y, z, hang = false) => {
    const L = new THREE.Group();
    L.position.set(x, y, z);
    const brass = mat(0x8a6a2a, { metal: 0.8, rough: 0.35 });
    L.add(part(cyl(6), brass, [0, 0.02, 0], [0.11, 0.04, 0.11]));
    L.add(part(cyl(6), mat(0xffd27a, { emissive: 0xffa040, ei: 2.2, opacity: 0.92 }), [0, 0.17, 0], [0.09, 0.26, 0.09]));
    L.add(part(cone(6), brass, [0, 0.36, 0], [0.12, 0.12, 0.12]));
    L.add(part(tor(), brass, [0, 0.45, 0], [0.04, 0.04, 0.04]));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0xffb050, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(1.1); glow.position.y = 0.17;
    L.add(glow);
    L.children.forEach((c) => { c.castShadow = false; });
    g.add(L);
    lanterns.push({ L, hang, glow, ph: lanterns.length * 1.7 });
    return L;
  };
  {
    const qd = xS0 + 1.4; // forward edge of the quarterdeck
    const qy = 0.95;
    const qShape = new THREE.Shape();
    const N = 16, ol = [];
    for (let i = 0; i <= N; i++) { const x = xMin + (qd - xMin) * (i / N); ol.push([x, halfAt(x, qy) - 0.05]); }
    qShape.moveTo(ol[0][0], -ol[0][1]);
    for (const [x, z] of ol) qShape.lineTo(x, -z);
    for (let i = ol.length - 1; i >= 0; i--) qShape.lineTo(ol[i][0], ol[i][1]);
    const qg = new THREE.ShapeGeometry(qShape); qg.rotateX(Math.PI / 2);
    const uvA = qg.attributes.uv, pA = qg.attributes.position;
    for (let i = 0; i < uvA.count; i++) uvA.setXY(i, pA.getX(i) * 0.45, pA.getZ(i) * 0.45);
    const qdeck = new THREE.Mesh(qg, new THREE.MeshStandardMaterial({ map: deckTex(), roughness: 0.75, side: THREE.DoubleSide }));
    qdeck.position.y = qy; qdeck.receiveShadow = true; qdeck.castShadow = true;
    g.add(qdeck);
    // front face of the quarterdeck (break of the deck) with a carved panel
    const fh = qy + 0.02;
    g.add(part(box(), mat(0x4a2a16, { rough: 0.6 }), [qd, fh / 2, 0], [0.12, fh, (halfAt(qd, 0.5) - 0.05) * 2]));
    g.add(part(box(), mat(0xd8a84a, { metal: 0.6, rough: 0.4 }), [qd + 0.065, fh - 0.08, 0], [0.02, 0.05, (halfAt(qd, 0.5) - 0.1) * 2]));
    // railing posts along the break
    for (let z = -halfAt(qd, qy) + 0.2; z < halfAt(qd, qy) - 0.1; z += 0.32) g.add(part(cyl(8), mat(0xe8d8b0, { rough: 0.5 }), [qd, qy + 0.25, z], [0.035, 0.5, 0.035]));
    g.add(part(box(), mat(0x5a3418, { rough: 0.5 }), [qd, qy + 0.52, 0], [0.09, 0.06, (halfAt(qd, qy) - 0.1) * 2]));
    // ship's wheel on a pedestal, facing forward
    const wheel = new THREE.Group();
    wheel.position.set(xMin + 0.75, qy + 0.75, 0);
    wheel.rotation.y = Math.PI / 2;
    const wood = mat(0x7a4a22, { rough: 0.5 });
    wheel.add(part(tor(), wood, [0, 0, 0], [0.38, 0.38, 0.25]));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      wheel.add(part(cyl(6), wood, [Math.cos(a) * 0.29, Math.sin(a) * 0.29, 0], [0.025, 0.66, 0.025], [0, 0, a + Math.PI / 2]));
      wheel.add(part(cyl(6), wood, [Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0], [0.03, 0.14, 0.03], [0, 0, a + Math.PI / 2]));
    }
    wheel.add(part(cyl(12), mat(0xd8a84a, { metal: 0.7 }), [0, 0, 0], [0.08, 0.12, 0.08], [Math.PI / 2, 0, 0]));
    g.add(wheel);
    g.add(part(box(), wood, [xMin + 0.82, qy + 0.35, 0], [0.14, 0.7, 0.2]));
    updaters.push((t) => { wheel.rotation.z = Math.sin(t * 0.5) * 0.6; });
    // stern lanterns
    makeLantern(xMin + 0.15, gunwale(xMin) + 0.55, 0);
    for (const s of [-1, 1]) {
      g.add(part(cyl(6), mat(0x3a2a1a), [xMin + 0.15, gunwale(xMin) + 0.25, s * (B - 0.35)], [0.035, 0.5, 0.035]));
      makeLantern(xMin + 0.15, gunwale(xMin) + 0.5, s * (B - 0.35));
    }
  }

  // ---------- masts, yards, sails, rigging
  const spar = mat(0x6a4422, { rough: 0.55 }), dark = mat(0x2a1a0e, { rough: 0.8 });
  const sails = [];
  const ropeM = mat(0x2e2014, { rough: 0.9 });
  const mast = (x, z, height, yards) => {
    const m = new THREE.Group();
    m.position.set(x, 0, z);
    m.add(part(cyl(14, 0.7), spar, [0, height / 2, 0], [0.2, height, 0.2]));
    m.add(part(cyl(14), dark, [0, 0.12, 0], [0.32, 0.24, 0.32]));
    // tops (platforms) at each mast section
    for (const ty of yards.filter((y) => y.top).map((y) => y.y + 0.4)) {
      m.add(part(cyl(16), spar, [0, ty, 0], [0.55, 0.06, 0.55]));
      m.add(part(tor(), dark, [0, ty + 0.18, 0], [0.5, 0.5, 0.3], [Math.PI / 2, 0, 0]));
    }
    for (const yd of yards) {
      const yard = new THREE.Group();
      yard.position.y = yd.y;
      yard.rotation.y = yd.brace ?? 0.0;
      yard.add(part(cyl(10, 0.6), spar, [0, 0, 0], [0.07, yd.w, 0.07], [Math.PI / 2, 0, 0]));
      if (yd.sail) {
        const s = makeSail(yd.w * 0.92, yd.h, yd.tex, { belly: 0.35 + yd.h * 0.08, taper: -0.08 });
        s.mesh.rotation.y = Math.PI / 2;
        s.mesh.position.set(0.12, -yd.h / 2 - 0.05, 0);
        yard.add(s.mesh);
        sails.push({ s, ph: sails.length * 0.9 });
      }
      m.add(yard);
    }
    g.add(m);
    return m;
  };
  const texA = sailTex(false, rival), texB = sailTex(true, rival);
  // fore mast on the bow deck, main mast behind the kitchen, mizzen on the quarterdeck
  const foreX = xB0 + 1.4, mainX = -0.6, mizX = xS0 + 0.45;
  const brace = 1.15; // yards swung well round so the canvas reads from the camera
  mast(foreX, 0, 9.2, [{ y: 3.6, w: 3.6, h: 2.3, sail: true, tex: texA, brace, top: true }, { y: 6.2, w: 2.8, h: 1.9, sail: true, tex: texB, brace }, { y: 8.2, w: 1.8, h: 1.3, sail: true, tex: texA, brace }]);
  mast(mainX, -H / 2 - 0.35, 11.5, [{ y: 4.3, w: 4.6, h: 2.8, sail: true, tex: texB, brace, top: true }, { y: 7.4, w: 3.6, h: 2.3, sail: true, tex: texA, brace }, { y: 9.9, w: 2.4, h: 1.6, sail: true, tex: texA, brace }]);
  const miz = mast(mizX, 0, 8.0, [{ y: 6.6, w: 2.0, h: 1.2, sail: true, tex: texA, brace, top: true }]);
  // mizzen gaff sail (fore-and-aft, faces the camera broadside)
  {
    const s = makeSail(2.4, 3.6, texB, { belly: 0.28, tri: false, taper: 0.35 });
    s.mesh.position.set(-1.25, 3.3, 0);
    miz.add(s.mesh);
    miz.add(part(cyl(8), spar, [-1.3, 1.45, 0], [0.05, 2.7, 0.05], [0, 0, Math.PI / 2]));
    miz.add(part(cyl(8), spar, [-0.95, 5.25, 0], [0.045, 2.1, 0.045], [0, 0, Math.PI / 2 + 0.35]));
    sails.push({ s, ph: 4.2 });
  }
  // bowsprit + jibs
  const tipX = xMax + 2.6, tipY = gunwale(xMax) + 1.5;
  g.add(part(cyl(12, 0.5), spar, [(xMax - 0.6 + tipX) / 2, (gunwale(xMax) + tipY) / 2, 0], [0.13, Math.hypot(tipX - xMax + 0.6, tipY - gunwale(xMax)), 0.13], [0, 0, -Math.atan2(tipX - xMax + 0.6, tipY - gunwale(xMax))]));
  for (const [k, top] of [[0.92, 8.6], [0.6, 6.8]]) {
    const ax = xMax - 0.6 + (tipX - xMax + 0.6) * k, ay = gunwale(xMax) + (tipY - gunwale(xMax)) * k;
    const shape = new THREE.Shape();
    shape.moveTo(ax, ay); shape.lineTo(foreX + 0.15, top); shape.quadraticCurveTo(foreX + 0.4, (top + 1.3) / 2, foreX + 0.25, 1.3); shape.quadraticCurveTo((ax + foreX) / 2, (ay + 1.3) / 2 - 0.35, ax, ay);
    const jg = new THREE.ShapeGeometry(shape, 12);
    const uvA = jg.attributes.uv, pA = jg.attributes.position;
    for (let i = 0; i < uvA.count; i++) uvA.setXY(i, pA.getX(i) * 0.25, pA.getY(i) * 0.25);
    const jib = new THREE.Mesh(jg, new THREE.MeshStandardMaterial({ map: texA, side: THREE.DoubleSide, roughness: 0.95 }));
    jib.position.z = 0.02; jib.castShadow = true;
    g.add(jib);
    g.add(rope([ax, ay, 0], [foreX, top + 0.1, 0], 0.02, ropeM));
  }
  // figurehead scroll at the bow
  g.add(part(sph(16), mat(0xd8a84a, { metal: 0.6, rough: 0.35 }), [xMax - 0.05, gunwale(xMax) - 0.35, 0], [0.22, 0.3, 0.14]));
  g.add(part(tor(), mat(0xd8a84a, { metal: 0.6, rough: 0.35 }), [xMax + 0.1, gunwale(xMax) - 0.75, 0], [0.18, 0.18, 0.25]));
  // stays between mastheads, shrouds down to the channels on both sides (kept clear of the kitchen)
  g.add(rope([foreX, 9.2, 0], [mainX, 11.3, -H / 2 - 0.35], 0.02, ropeM));
  g.add(rope([mainX, 11.3, -H / 2 - 0.35], [mizX, 7.9, 0], 0.02, ropeM));
  g.add(rope([foreX, 9.0, 0], [tipX, tipY, 0], 0.02, ropeM));
  for (const [mx, mz, top, xs] of [[foreX, 0, 8.4, [-0.6, -0.2, 0.2]], [mainX, -H / 2 - 0.35, 10.8, [-1.4, -0.8, -0.2, 0.4, 1.0, 1.6]], [mizX, 0, 7.4, [-0.3, 0.1]]]) {
    for (const dx of xs) {
      const bx = mx + dx;
      if (mz === 0) for (const s of [-1, 1]) g.add(rope([mx, top, mz], [bx, gunwale(bx) + 0.05, s * (halfAt(bx, gunwale(bx)) + 0.05)], 0.016, ropeM));
      else g.add(rope([mx, top, mz], [bx, gunwale(bx) + 0.05, -(halfAt(bx, gunwale(bx)) + 0.05)], 0.016, ropeM));
    }
  }
  // Jolly Roger on the main truck
  const flag = makeFlag(1.5, 0.95, jollyRoger());
  flag.mesh.position.set(mainX + 0.78, 11.9, -H / 2 - 0.35);
  g.add(flag.mesh);
  g.add(part(cyl(8), spar, [mainX, 11.9, -H / 2 - 0.35], [0.04, 1.2, 0.04]));
  // crow's nest lookout lantern
  makeLantern(mainX, 11.6, -H / 2 - 0.35 + 0.45);

  // ---------- deck clutter on the walkways around the kitchen
  if (!rival) {
    const barrelM = mat(0x7a4a24, { rough: 0.7 }), hoop = mat(0x2a2a2e, { metal: 0.6, rough: 0.4 });
    const barrel = (x, z, s = 1) => {
      const b = new THREE.Group(); b.position.set(x, 0, z); b.scale.setScalar(s);
      b.add(part(cyl(16), barrelM, [0, 0.32, 0], [0.26, 0.64, 0.26]));
      b.add(part(sph(16), barrelM, [0, 0.32, 0], [0.29, 0.3, 0.29]));
      for (const y of [0.1, 0.32, 0.54]) b.add(part(tor(), hoop, [0, y, 0], [0.285, 0.285, 0.08], [Math.PI / 2, 0, 0]));
      b.add(part(cyl(16), mat(0x5a3418), [0, 0.645, 0], [0.24, 0.01, 0.24]));
      g.add(b);
    };
    const crate = (x, z, s = 1, r = 0) => {
      const c = new THREE.Group(); c.position.set(x, 0.25 * s, z); c.rotation.y = r; c.scale.setScalar(s);
      c.add(part(box(), mat(0xa8784a, { rough: 0.8 }), [0, 0, 0], [0.5, 0.5, 0.5]));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.add(part(box(), mat(0x6a4422), [sx * 0.24, 0, sz * 0.24], [0.04, 0.52, 0.04]));
      c.add(part(box(), mat(0x6a4422), [0, 0, 0.255], [0.5, 0.05, 0.02], [0, 0, 0.78]));
      g.add(c);
    };
    // bow deck
    barrel(W / 2 + 0.55, H / 2 + 0.25, 0.85); barrel(W / 2 + 0.6, -H / 2 - 0.2, 0.85);
    crate(W / 2 + 1.4, H / 2 - 0.4, 0.9, 0.3); crate(W / 2 + 1.3, -H / 2 + 0.6, 0.8, -0.2); crate(W / 2 + 1.4, -H / 2 + 0.6, 0.6, 0.5);
    barrel(W / 2 + 2.6, 0.7, 0.75);
    // capstan
    const cap = new THREE.Group(); cap.position.set(W / 2 + 2.5, 0, -0.6);
    cap.add(part(cyl(12), mat(0x6a4422), [0, 0.3, 0], [0.24, 0.6, 0.24]));
    cap.add(part(cyl(12), mat(0x5a3418), [0, 0.62, 0], [0.32, 0.08, 0.32]));
    for (let k = 0; k < 4; k++) cap.add(part(cyl(6), mat(0x8a5a2a), [0, 0.55, 0], [0.03, 1.2, 0.03], [Math.PI / 2, (k * Math.PI) / 4, 0]));
    g.add(cap);
    // rope coils
    for (const [x, z] of [[W / 2 + 1.8, H / 2 + 0.15], [-W / 2 - 0.55, -H / 2 - 0.2]]) for (let k = 0; k < 3; k++) g.add(part(tor(), mat(0xc8a878, { rough: 0.95 }), [x, 0.04 + k * 0.05, z], [0.22 - k * 0.04, 0.22 - k * 0.04, 0.35], [Math.PI / 2, 0, 0]));
    // stern waist
    barrel(-W / 2 - 0.6, H / 2 + 0.2, 0.8); crate(-W / 2 - 0.65, 0.3, 0.8, 0.4);
    // anchor hanging off the bow
    const anchor = new THREE.Group(); anchor.position.set(xB0 + 2.2, -0.4, B * 0.86 + 0.1); anchor.rotation.y = -0.4;
    const iron = mat(0x2a2a2e, { metal: 0.7, rough: 0.45 });
    anchor.add(part(cyl(8), iron, [0, 0, 0], [0.05, 1.1, 0.05]));
    anchor.add(part(tor(), iron, [0, -0.45, 0], [0.32, 0.32, 0.18], [0, 0, Math.PI]));
    anchor.children[1].geometry = new THREE.TorusGeometry(1, 0.28, 8, 16, Math.PI);
    anchor.add(part(cyl(8), iron, [0, 0.5, 0], [0.04, 0.6, 0.04], [0, 0, Math.PI / 2]));
    anchor.add(part(tor(), iron, [0, 0.62, 0], [0.08, 0.08, 0.2]));
    g.add(anchor);
    // corner lanterns on posts at the kitchen corners
    for (const [x, z] of [[-W / 2 - 0.35, H / 2 + 0.35], [W / 2 + 0.35, H / 2 + 0.35], [W / 2 + 0.35, -H / 2 - 0.35]]) {
      g.add(part(cyl(8), mat(0x3a2a1a), [x, 0.6, z], [0.05, 1.2, 0.05]));
      g.add(part(box(), mat(0x3a2a1a), [x, 1.2, z], [0.3, 0.04, 0.04]));
      makeLantern(x + 0.13, 0.75, z, true);
    }
  }

  // ---------- seagulls circling overhead
  const gulls = [];
  if (!rival) {
    const wM = mat(0xf4f4f0, { rough: 0.8 }), tipM = mat(0x2a2a2e);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Group();
      b.add(part(sph(10), wM, [0, 0, 0], [0.22, 0.1, 0.1]));
      b.add(part(sph(8), wM, [0.2, 0.04, 0], 0.075));
      b.add(part(cone(6), mat(0xffb020), [0.3, 0.03, 0], [0.025, 0.08, 0.025], [0, 0, -Math.PI / 2]));
      const wings = [];
      for (const s of [-1, 1]) {
        const w = new THREE.Group();
        w.add(part(box(), wM, [0, 0, s * 0.26], [0.16, 0.02, 0.5]));
        w.add(part(box(), tipM, [-0.02, 0, s * 0.5], [0.12, 0.022, 0.08]));
        b.add(w); wings.push(w);
      }
      b.children.forEach((c) => { c.castShadow = false; });
      g.add(b);
      gulls.push({ b, wings, r: 6 + i * 2.2, h: 6 + i * 0.9, sp: 0.18 + i * 0.05, ph: i * 1.9, cx: (i % 2 ? 3 : -2), cz: -H / 2 - 2 });
    }
  }

  updaters.push((t) => {
    for (const { s, ph } of sails) s.update(t, ph);
    flag.update(t);
    for (const l of lanterns) {
      if (l.hang) l.L.rotation.z = Math.sin(t * 1.6 + l.ph) * 0.12;
      l.glow.material.opacity = 0.5 + Math.sin(t * 7.3 + l.ph) * 0.05 + Math.sin(t * 13.1 + l.ph) * 0.04;
    }
    for (const q of gulls) {
      const a = t * q.sp + q.ph;
      q.b.position.set(q.cx + Math.cos(a) * q.r, q.h + Math.sin(t * 0.7 + q.ph) * 0.4, q.cz + Math.sin(a) * q.r * 0.45);
      q.b.rotation.set(0, -a - Math.PI / 2, -0.25);
      const f = Math.sin(t * 7 + q.ph) * 0.5;
      q.wings[0].rotation.x = f; q.wings[1].rotation.x = -f;
    }
  });

  return {
    group: g,
    update: (t) => updaters.forEach((f) => f(t)),
    hull: { cx: (xS0 + xB0) / 2, cz: 0, hl: (xB0 - xS0) / 2, hb: halfAt(0, WATERLINE), bow: bowLen * 0.92, stern: sternLen },
    bounds: { xMin, xMax: tipX },
    muzzles,
  };
}

let _glow;
function glowSprite() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}
