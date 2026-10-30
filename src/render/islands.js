// What each zone of the kitchen stands on, built from the level's own cells so oddly shaped
// islands get matching bases: basalt columns in the lava, glacier cliffs in the sea, cumulus
// clouds, space-station modules and clockwork platforms.
import * as THREE from 'three';
import { mat, part, sph, cyl, box, dode, ico } from './items.js';
import { wallTex, glowTex, textTex } from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Cells that belong to a zone (anything that is not void or a bridge) and their open edges. */
export function zoneCells(L) {
  const at = (x, y) => (x >= 0 && y >= 0 && x < L.W && y < L.H ? L.tiles[y * L.W + x] : null);
  const solid = (t) => t && t.k !== 'void' && t.k !== 'bridge';
  const cells = L.tiles.filter(solid);
  const edges = [];
  for (const t of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!solid(at(t.x + dx, t.y + dy))) edges.push({ t, dx, dy });
  const cx = (x) => x + 0.5 - L.W / 2, cz = (y) => y + 0.5 - L.H / 2;
  return { cells, edges, cx, cz };
}

/** One InstancedMesh with a transform per entry: fn(o, item, i) sets position/rotation/scale. */
function instanced(parent, geo, m, list, fn, shadow = true) {
  const im = new THREE.InstancedMesh(geo, m, Math.max(1, list.length));
  const o = new THREE.Object3D();
  list.forEach((it, i) => { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); fn(o, it, i); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
  im.count = list.length;
  im.castShadow = shadow; im.receiveShadow = true;
  parent.add(im);
  return im;
}

// ------------------------------------------------------------------ volcano: basalt islands

export function basaltIslands(g, L, r) {
  const { cells, edges, cx, cz } = zoneCells(L);
  const rock = mat(0x241c1c, { flat: true, rough: 0.95 }), rock2 = mat(0x352a28, { flat: true, rough: 0.9 });
  const hot = mat(0x1e1412, { flat: true, rough: 0.85, emissive: 0xff3a00, ei: 0.12 });
  // hexagonal basalt columns under every cell, of uneven depth, poking out a little at the edges
  const hex = new THREE.CylinderGeometry(0.62, 0.66, 1, 6);
  instanced(g, hex, mat(0x221a1b, { flat: true, rough: 0.92 }), cells, (o, t) => {
    const d = 1.6 + r() * 0.9;
    o.position.set(cx(t.x) + (r() - 0.5) * 0.08, -0.32 - d / 2, cz(t.y) + (r() - 0.5) * 0.08);
    o.scale.set(1, d, 1); o.rotation.y = r() * 1.05;
  });
  // a ragged skirt of boulders where the island meets the lava
  const skirt = edges.filter(() => r() < 0.75);
  for (const [m, pick] of [[rock, 0], [rock2, 1], [hot, 2]]) {
    const list = skirt.filter((_, i) => i % 3 === pick);
    instanced(g, new THREE.DodecahedronGeometry(1, 0), m, list, (o, e) => {
      const s = 0.4 + r() * 0.45;
      o.position.set(cx(e.t.x) + e.dx * (0.55 + r() * 0.2) + (r() - 0.5) * 0.4, -1.55 + r() * 0.35, cz(e.t.y) + e.dy * (0.55 + r() * 0.2) + (r() - 0.5) * 0.4);
      o.scale.set(s * 1.3, s * 0.8, s * 1.2); o.rotation.set(r() * 3, r() * 3, r() * 3);
    });
  }
}

// ------------------------------------------------------------------ glacier: ice cliffs

export function glacierIslands(g, L, r) {
  const { cells, edges, cx, cz } = zoneCells(L);
  const iceM = new THREE.MeshStandardMaterial({ color: 0xbfe8fa, roughness: 0.22, metalness: 0.05, flatShading: true });
  const deepM = new THREE.MeshStandardMaterial({ color: 0x6fb8de, roughness: 0.3, flatShading: true });
  const snowM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  // the body of the glacier: an ice column under every cell, down below the sea
  instanced(g, new THREE.BoxGeometry(1, 1, 1), iceM, cells, (o, t) => {
    const d = 3.6 + r() * 0.8;
    o.position.set(cx(t.x), -0.3 - d / 2, cz(t.y));
    o.scale.set(1.02, d, 1.02);
  });
  // jagged cliff faces: big ice shards stuck to every open edge, deeper blue towards the water
  instanced(g, new THREE.IcosahedronGeometry(1, 0), iceM, edges, (o, e) => {
    const s = 0.35 + r() * 0.3;
    o.position.set(cx(e.t.x) + e.dx * 0.5 + (e.dy ? (r() - 0.5) * 0.7 : 0), -0.75 - r() * 0.5, cz(e.t.y) + e.dy * 0.5 + (e.dx ? (r() - 0.5) * 0.7 : 0));
    o.scale.set(s * (e.dx ? 0.6 : 1.4), s * 2.2, s * (e.dy ? 0.6 : 1.4)); o.rotation.set((r() - 0.5) * 0.4, r() * 3, (r() - 0.5) * 0.4);
  });
  instanced(g, new THREE.IcosahedronGeometry(1, 0), deepM, edges.filter(() => r() < 0.7), (o, e) => {
    const s = 0.45 + r() * 0.35;
    o.position.set(cx(e.t.x) + e.dx * 0.55 + (r() - 0.5) * 0.6, -1.7 - r() * 0.4, cz(e.t.y) + e.dy * 0.55 + (r() - 0.5) * 0.6);
    o.scale.set(s * 1.3, s * 1.6, s * 1.3); o.rotation.set(r(), r() * 3, r());
  });
  // snow drifted along the rim
  instanced(g, new THREE.SphereGeometry(1, 12, 8), snowM, edges, (o, e) => {
    o.position.set(cx(e.t.x) + e.dx * 0.52 + (e.dy ? (r() - 0.5) * 0.5 : 0), -0.3, cz(e.t.y) + e.dy * 0.52 + (e.dx ? (r() - 0.5) * 0.5 : 0));
    o.scale.set(0.32 + r() * 0.2, 0.14 + r() * 0.08, 0.32 + r() * 0.2);
  }, false);
  // icicles hanging off the rim
  instanced(g, new THREE.ConeGeometry(1, 1, 6), new THREE.MeshStandardMaterial({ color: 0xe6f8ff, roughness: 0.15, transparent: true, opacity: 0.85 }), edges.filter(() => r() < 0.5), (o, e) => {
    const l = 0.25 + r() * 0.4;
    o.position.set(cx(e.t.x) + e.dx * 0.6 + (r() - 0.5) * 0.6, -0.42 - l / 2, cz(e.t.y) + e.dy * 0.6 + (r() - 0.5) * 0.6);
    o.scale.set(0.05, l, 0.05); o.rotation.x = Math.PI;
  }, false);
}

// ------------------------------------------------------------------ clouds: every zone is a cumulus

export function cloudIslands(g, L, r, updaters) {
  const { cells, edges, cx, cz } = zoneCells(L);
  const puffM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0x9aa8c8, emissiveIntensity: 0.18 });
  const shadeM = new THREE.MeshStandardMaterial({ color: 0xdfe6f8, roughness: 1, emissive: 0x8090b8, emissiveIntensity: 0.12 });
  const geo = new THREE.SphereGeometry(1, 18, 12);
  // billows bulging out round the rim, a little below the kitchen floor
  const rim = instanced(g, geo, puffM, edges.concat(edges.filter(() => r() < 0.5)), (o, e) => {
    const s = 0.42 + r() * 0.32;
    o.position.set(cx(e.t.x) + e.dx * (0.45 + r() * 0.25) + (r() - 0.5) * 0.6, -0.42 - r() * 0.3, cz(e.t.y) + e.dy * (0.45 + r() * 0.25) + (r() - 0.5) * 0.6);
    o.scale.set(s * 1.2, s * 0.9, s * 1.2);
  }, false);
  // the cloud's body: big heaped puffs underneath, greyer towards the bottom
  instanced(g, geo, puffM, cells.filter(() => r() < 0.55), (o, t) => {
    const s = 0.8 + r() * 0.5;
    o.position.set(cx(t.x) + (r() - 0.5) * 0.6, -0.95 - r() * 0.4, cz(t.y) + (r() - 0.5) * 0.6);
    o.scale.set(s * 1.1, s * 0.75, s * 1.1);
  }, false);
  instanced(g, geo, shadeM, cells.filter(() => r() < 0.35), (o, t) => {
    const s = 0.7 + r() * 0.5;
    o.position.set(cx(t.x) + (r() - 0.5) * 0.5, -1.7 - r() * 0.4, cz(t.y) + (r() - 0.5) * 0.5);
    o.scale.set(s, s * 0.7, s);
  }, false);
  // wisps that peel off and drift around the rim
  const wisps = [];
  for (const e of edges.filter(() => r() < 0.12)) {
    const w = part(sph(14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.7, emissive: 0x9aa8c8, emissiveIntensity: 0.2 }), [cx(e.t.x) + e.dx * 1.1, -0.6, cz(e.t.y) + e.dy * 1.1], [0.35, 0.22, 0.35]);
    w.castShadow = false;
    g.add(w);
    wisps.push({ w, x: w.position.x, y: w.position.y, ph: r() * 6 });
  }
  updaters.push((t) => { for (const k of wisps) { k.w.position.x = k.x + Math.sin(t * 0.3 + k.ph) * 0.25; k.w.position.y = k.y + Math.sin(t * 0.5 + k.ph) * 0.1; } });
  return rim;
}

// ------------------------------------------------------------------ space station modules

export function stationModules(g, L, r, updaters) {
  const cx0 = (x) => x - L.W / 2, cz0 = (y) => y - L.H / 2;
  const hullT = wallTex('hullpanel').clone(); hullT.needsUpdate = true;
  const hull = new THREE.MeshStandardMaterial({ map: hullT, color: 0xe2e8f0, metalness: 0.4, roughness: 0.45 });
  const dark = mat(0x3a4250, { metal: 0.6, rough: 0.4 }), frame = mat(0x8a96a8, { metal: 0.7, rough: 0.35 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x2ad0ff, emissive: 0x2ad0ff, emissiveIntensity: 1.5 });
  const portM = new THREE.MeshStandardMaterial({ color: 0x0a1a30, emissive: 0x3a8aff, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.1 });
  const blink = [];
  for (const z of L.zones) {
    const x0 = cx0(z.x0), x1 = cx0(z.x1 + 1), zb = cz0(z.y0), zf = cz0(z.y1 + 1), w = x1 - x0, d = zf - zb, mx = (x0 + x1) / 2, mz = (zb + zf) / 2;
    // the module's pressure hull under the deck: a rounded box with a lit seam and portholes
    g.add(part(box(), hull, [mx, -0.95, mz], [w + 0.3, 1.3, d + 0.3]));
    g.add(part(cyl(24), hull, [mx, -1.6, mz], [Math.min(w, d) * 0.42, 0.4, Math.min(w, d) * 0.42]));
    for (const [px, pz, sx, sz] of [[mx, zf + 0.16, w + 0.32, 0.04], [mx, zb - 0.16, w + 0.32, 0.04], [x0 - 0.16, mz, 0.04, d + 0.32], [x1 + 0.16, mz, 0.04, d + 0.32]]) g.add(part(box(), glow, [px, -0.42, pz], [sx, 0.05, sz]));
    for (let x = x0 + 0.8; x < x1 - 0.4; x += 1.3) {
      const p = part(cyl(16), portM, [x, -0.9, zf + 0.16], [0.17, 0.04, 0.17], [Math.PI / 2, 0, 0]);
      g.add(p, part(new THREE.TorusGeometry(0.19, 0.035, 6, 18), frame, [x, -0.9, zf + 0.17]));
    }
    // greebles: tanks, vents and conduits on the underside
    for (let k = 0; k < 4; k++) g.add(part(k % 2 ? cyl(12) : box(), dark, [x0 + 0.6 + r() * (w - 1.2), -1.7 - r() * 0.2, zb + 0.6 + r() * (d - 1.2)], [0.3 + r() * 0.4, 0.3, 0.3 + r() * 0.4]));
    // bulkhead frames at the module's ends and corner posts: you are inside a pressurised can
    for (const x of [x0 - 0.06, x1 + 0.06]) {
      for (const zz of [zb, zf]) g.add(part(box(), frame, [x, 1.15, zz], [0.14, 2.6, 0.14]));
      g.add(part(box(), frame, [x, 2.45, mz], [0.16, 0.16, d]));
      g.add(part(box(), glow, [x, 2.34, mz], [0.05, 0.04, d - 0.3]));
    }
    // a little antenna on top of back modules
    if (z.wall) {
      g.add(part(cyl(8), frame, [x1 - 0.6, 3.2, zb + 0.4], [0.03, 1.4, 0.03]));
      const l = part(sph(8), new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0xff2020, emissiveIntensity: 2 }), [x1 - 0.6, 3.92, zb + 0.4], 0.06);
      g.add(l); blink.push({ m: l.material, ph: r() * 6 });
    }
  }
  // the station beyond the kitchen: a main truss behind, solar wings off both ends, radiators
  const zb = cz0(0) - 1.6, W = L.W, H = L.H;
  const truss = (a, b, s) => {
    const dv = new THREE.Vector3().subVectors(b, a), len = dv.length();
    const tg = new THREE.Group(); tg.position.copy(a).addScaledVector(dv, 0.5);
    tg.quaternion.setFromUnitVectors(V(1, 0, 0), dv.normalize());
    for (const [y, z] of [[s, s], [s, -s], [-s, s], [-s, -s]]) tg.add(part(box(), frame, [0, y, z], [len, 0.06, 0.06]));
    for (let x = -len / 2; x <= len / 2; x += s * 2) {
      tg.add(part(box(), frame, [x, 0, s], [0.05, s * 2, 0.05]), part(box(), frame, [x, 0, -s], [0.05, s * 2, 0.05]));
      tg.add(part(box(), frame, [x + s, 0, s], [s * 2.6, 0.04, 0.04], [0, 0, 0.78]), part(box(), frame, [x + s, 0, -s], [s * 2.6, 0.04, 0.04], [0, 0, -0.78]));
    }
    g.add(tg);
    return tg;
  };
  truss(V(-W / 2 - 9, -0.6, zb), V(W / 2 + 9, -0.6, zb), 0.32);
  const solarT = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#0c1a4a'; x.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) {
      const gr = x.createLinearGradient(0, j * 32, 32, j * 32 + 32); gr.addColorStop(0, '#1d3a8a'); gr.addColorStop(1, '#0f2260');
      x.fillStyle = gr; x.fillRect(i * 32 + 2, j * 32 + 2, 28, 28);
    }
    x.strokeStyle = '#b8c4d8'; x.lineWidth = 3; x.strokeRect(1, 1, 126, 254);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  })();
  const solar = new THREE.MeshStandardMaterial({ map: solarT, metalness: 0.6, roughness: 0.25, side: THREE.DoubleSide });
  const wings = [];
  for (const s of [-1, 1]) {
    const root = s < 0 ? -W / 2 - 1.5 : W / 2 + 1.5;
    truss(V(root, -0.6, zb), V(root, -0.6, zb + 8.6), 0.22);
    for (let k = 0; k < 3; k++) {
      const wg = new THREE.Group();
      wg.position.set(root + s * 2.6, -0.6, zb + 1 + k * 3.6);
      wg.add(part(box(), frame, [-s * 1.3, 0, 0], [2.6, 0.08, 0.08]));
      wg.add(part(new THREE.PlaneGeometry(4.2, 3.2), solar, [s * 1.0, 0, 0], 1, [-Math.PI / 2, 0, 0]));
      g.add(wg);
      wings.push({ wg, s });
    }
    const nav = part(sph(8), new THREE.MeshStandardMaterial({ color: s < 0 ? 0xff3030 : 0x30ff60, emissive: s < 0 ? 0xff2020 : 0x20ff50, emissiveIntensity: 2 }), [root + s * 5.2, -0.5, zb + 1], 0.12);
    g.add(nav); blink.push({ m: nav.material, ph: s });
  }
  // radiator panels standing up off the truss behind the kitchen
  for (let k = 0; k < 4; k++) {
    const x = -W / 2 + (k + 0.5) * W / 4;
    g.add(part(box(), mat(0xf0f2f6, { rough: 0.5, metal: 0.2 }), [x, 1.6, zb - 1.4], [1.8, 3.4, 0.06], [-0.3, 0, 0]));
    for (let j = 0; j < 6; j++) g.add(part(box(), frame, [x - 0.75 + j * 0.3, 1.6, zb - 1.37], [0.03, 3.3, 0.04], [-0.3, 0, 0]));
  }
  // a dish antenna
  const dish = new THREE.Group();
  dish.position.set(-W / 2 - 3, 1.2, zb - 1);
  dish.add(part(new THREE.SphereGeometry(1.1, 24, 10, 0, Math.PI * 2, 0, 0.9), mat(0xf2f4f8, { rough: 0.4, metal: 0.3 }), [0, 0, 0], 1, [-0.9, 0, 0]));
  dish.add(part(cyl(8), frame, [0, -0.9, 0], [0.06, 1.8, 0.06]));
  g.add(dish);
  updaters.push((t) => {
    for (const b of blink) b.m.emissiveIntensity = Math.sin(t * 3 + b.ph) > 0.6 ? 3 : 0.2;
    for (const w of wings) w.wg.rotation.x = Math.sin(t * 0.08) * 0.25;
    dish.rotation.y = Math.sin(t * 0.2) * 0.6;
  });
}

// ------------------------------------------------------------------ clockwork platforms

export function clockIslands(g, L, r) {
  const { cells, edges, cx, cz } = zoneCells(L);
  const wood = mat(0x4a2c18, { rough: 0.7 });
  const brass = mat(0xd8a84a, { metal: 0.85, rough: 0.3 }), brassD = mat(0x9a7030, { metal: 0.8, rough: 0.35 });
  instanced(g, new THREE.BoxGeometry(1, 1, 1), wood, cells, (o, t) => { o.position.set(cx(t.x), -0.6, cz(t.y)); o.scale.set(1.01, 0.6, 1.01); });
  // a brass band round the rim with gear teeth sticking out
  instanced(g, new THREE.BoxGeometry(1, 1, 1), brass, edges, (o, e) => {
    o.position.set(cx(e.t.x) + e.dx * 0.52, -0.42, cz(e.t.y) + e.dy * 0.52);
    o.scale.set(e.dx ? 0.06 : 1.06, 0.26, e.dy ? 0.06 : 1.06);
  });
  instanced(g, new THREE.BoxGeometry(1, 1, 1), brassD, edges.flatMap((e) => [{ ...e, k: -0.25 }, { ...e, k: 0.25 }]), (o, e) => {
    o.position.set(cx(e.t.x) + e.dx * 0.6 + (e.dy ? e.k : 0), -0.42, cz(e.t.y) + e.dy * 0.6 + (e.dx ? e.k : 0));
    o.scale.set(e.dx ? 0.14 : 0.2, 0.22, e.dy ? 0.14 : 0.2);
  });
  // a big gear turning under each platform, an axle down into the works
  return L.zones.map((z) => {
    const mx = (z.x0 + z.x1 + 1) / 2 - L.W / 2, mz = (z.y0 + z.y1 + 1) / 2 - L.H / 2;
    const rad = Math.min(z.x1 - z.x0, z.y1 - z.y0) * 0.45 + 0.4;
    const gear = makeGear(rad, Math.round(rad * 7), 0.3, brassD);
    gear.position.set(mx, -1.15, mz);
    g.add(gear);
    g.add(part(cyl(12), mat(0x3a3a3a, { metal: 0.8, rough: 0.3 }), [mx, -4, mz], [0.18, 6, 0.18]));
    return gear;
  });
}

/** A spur gear lying flat: rim, teeth, spokes and hub. */
export function makeGear(R, teeth, thick, m, spokes = 5) {
  const gg = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, Math.max(0.08, R * 0.08), 6, Math.max(24, teeth * 3)), m);
  ring.rotation.x = Math.PI / 2; ring.scale.z = thick / Math.max(0.08, R * 0.08) / 2;
  gg.add(ring);
  const tg = new THREE.BoxGeometry(1, 1, 1);
  const im = new THREE.InstancedMesh(tg, m, teeth);
  const o = new THREE.Object3D();
  for (let k = 0; k < teeth; k++) {
    const a = (k / teeth) * Math.PI * 2;
    o.position.set(Math.cos(a) * (R + R * 0.1), 0, Math.sin(a) * (R + R * 0.1)); o.rotation.set(0, -a, 0);
    o.scale.set(R * 0.16 + 0.05, thick, (Math.PI * 2 * R / teeth) * 0.5); o.updateMatrix(); im.setMatrixAt(k, o.matrix);
  }
  im.castShadow = true;
  gg.add(im);
  for (let k = 0; k < spokes; k++) {
    const a = (k / spokes) * Math.PI * 2;
    gg.add(part(box(), m, [Math.cos(a) * R / 2, 0, Math.sin(a) * R / 2], [R, thick * 0.7, R * 0.12], [0, -a, 0]));
  }
  gg.add(part(cyl(20), m, [0, 0, 0], [R * 0.22, thick * 1.3, R * 0.22]));
  gg.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  return gg;
}
