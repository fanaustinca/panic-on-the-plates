// Factory hall: the kitchen stands on a steel mezzanine (one deck per zone, so the gaps look down
// onto the shop floor), surrounded by conveyor lines, welding robots, a stamping press, storage
// tanks, a gantry crane and a wall of factory windows. Returns spark/steam emitters for the
// kitchen's particle system.
import * as THREE from 'three';
import { mat, part, sph, cyl, box } from './items.js';
import { stripeTex, glowTex, beltTex } from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const FLOOR = -7;

function canvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

const concreteTex = (r) => canvas(512, 512, (g, s) => {
  g.fillStyle = '#6e6c68'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.06})`; g.fillRect(r() * s, r() * s, 2 + r() * 3, 2 + r() * 3); }
  for (let i = 0; i < 14; i++) { const x = r() * s, y = r() * s, rr = 20 + r() * 60; const grd = g.createRadialGradient(x, y, 0, x, y, rr); grd.addColorStop(0, 'rgba(30,25,20,0.25)'); grd.addColorStop(1, 'rgba(30,25,20,0)'); g.fillStyle = grd; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  g.strokeStyle = 'rgba(30,30,30,0.5)'; g.lineWidth = 2;
  for (let k = 0; k <= 2; k++) { g.beginPath(); g.moveTo(0, k * 256); g.lineTo(s, k * 256); g.moveTo(k * 256, 0); g.lineTo(k * 256, s); g.stroke(); }
  // painted walkway lines
  g.fillStyle = '#e8b81a'; g.fillRect(0, 120, s, 10); g.fillRect(0, 390, s, 10);
});

const windowTex = () => canvas(256, 512, (g, w, h) => {
  g.fillStyle = '#2a2e34'; g.fillRect(0, 0, w, h);
  const cols = 4, rows = 8, pw = (w - 20) / cols, ph = (h - 20) / rows;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const grd = g.createLinearGradient(0, 10 + y * ph, 0, 10 + (y + 1) * ph);
    const k = 0.75 + Math.random() * 0.25;
    grd.addColorStop(0, `rgba(${215 * k},${232 * k},${240 * k},1)`); grd.addColorStop(1, `rgba(${170 * k},${195 * k},${210 * k},1)`);
    g.fillStyle = grd; g.fillRect(12 + x * pw, 12 + y * ph, pw - 4, ph - 4);
    if (Math.random() < 0.12) { g.fillStyle = 'rgba(60,70,80,0.8)'; g.fillRect(12 + x * pw, 12 + y * ph, pw - 4, ph - 4); }
  }
});

const signTex = () => canvas(1024, 192, (g, w, h) => {
  g.fillStyle = '#1e2a3a'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#ffc020'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = '#ffffff'; g.font = '900 104px Fredoka, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('PLATEWORKS No.7', w / 2, h / 2 + 6);
});

const brickTex = (r) => canvas(256, 256, (g, s) => {
  g.fillStyle = '#5a3a30'; g.fillRect(0, 0, s, s);
  for (let y = 0; y < 16; y++) for (let x = -1; x < 9; x++) {
    const c = 0.8 + r() * 0.35;
    g.fillStyle = `rgb(${120 * c},${62 * c},${48 * c})`;
    g.fillRect(x * 32 + (y % 2) * 16 + 1, y * 16 + 1, 30, 14);
  }
  for (let i = 0; i < 20; i++) { g.fillStyle = `rgba(20,20,20,${r() * 0.25})`; g.fillRect(r() * s, r() * s * 0.3, 2 + r() * 30, s * (0.2 + r() * 0.6)); }
});

/** Horizontal I-beam (web + two flanges) from a to b. */
function ibeam(parent, a, b, h, w, m) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const g = new THREE.Group();
  g.position.copy(a).addScaledVector(d, 0.5);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.clone().normalize());
  g.add(part(box(), m, [0, 0, 0], [len, h, 0.04]));
  for (const s of [-1, 1]) g.add(part(box(), m, [0, s * h / 2, 0], [len, 0.04, w]));
  g.traverse((c) => { c.castShadow = true; c.receiveShadow = true; });
  parent.add(g);
  return g;
}

export function buildFactory(g, L, W, H, r, updaters) {
  const steel = mat(0x5a6470, { metal: 0.7, rough: 0.4 }), steelD = mat(0x3a4048, { metal: 0.7, rough: 0.45 });
  const yellow = mat(0xffb81a, { rough: 0.5, metal: 0.2 }), orange = mat(0xe8641a, { rough: 0.5, metal: 0.2 });
  const rubber = mat(0x1a1a1c, { rough: 0.8 });
  const sparks = [], steam = [], dust = [];
  // ---- shop floor far below
  const ct = concreteTex(r); ct.repeat.set(10, 10);
  const floor = part(new THREE.PlaneGeometry(W * 4 + 40, H * 4 + 40), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.9 }), [0, FLOOR, 0], 1, [-Math.PI / 2, 0, 0]);
  floor.receiveShadow = true; floor.castShadow = false;
  g.add(floor);

  // ---- mezzanine: a riveted steel deck under each zone, girders, columns and bracing
  const zones = L ? L.zones : [{ x0: 0, x1: W - 1 }];
  const wx = (x) => x - W / 2;
  const zf = H / 2, zb = -H / 2;
  const stripes = stripeTex('#ffc020', '#1a1a1a').clone(); stripes.needsUpdate = true;
  for (const z of zones) {
    const x0 = wx(z.x0), x1 = wx(z.x1 + 1), w = x1 - x0, cx = (x0 + x1) / 2;
    g.add(part(box(), steelD, [cx, -0.85, 0], [w + 0.1, 0.3, H + 0.1]));
    // perimeter girders
    ibeam(g, V(x0 - 0.05, -1.25, zf + 0.06), V(x1 + 0.05, -1.25, zf + 0.06), 0.5, 0.3, steel);
    ibeam(g, V(x0 - 0.05, -1.25, zb - 0.06), V(x1 + 0.05, -1.25, zb - 0.06), 0.5, 0.3, steel);
    ibeam(g, V(x0 - 0.06, -1.25, zb), V(x0 - 0.06, -1.25, zf), 0.5, 0.3, steel);
    ibeam(g, V(x1 + 0.06, -1.25, zb), V(x1 + 0.06, -1.25, zf), 0.5, 0.3, steel);
    // hazard stripe along the front edge of the deck
    const st = stripes.clone(); st.needsUpdate = true; st.repeat.set(w * 2, 1);
    g.add(part(new THREE.PlaneGeometry(w + 0.1, 0.18), new THREE.MeshStandardMaterial({ map: st, roughness: 0.6 }), [cx, -0.83, zf + 0.06], 1));
    // rivets along the front girder
    for (let x = x0 + 0.15; x < x1; x += 0.3) g.add(part(sph(6), steel, [x, -1.25, zf + 0.21], 0.025));
    // columns + cross bracing to the floor
    const cols = [];
    for (let k = 0; k <= Math.max(1, Math.round(w / 3.5)); k++) cols.push(x0 + 0.2 + (w - 0.4) * k / Math.max(1, Math.round(w / 3.5)));
    for (const z2 of [zf - 0.2, zb + 0.2]) {
      cols.forEach((x, k) => {
        g.add(part(box(), steel, [x, (FLOOR - 1.5) / 2, z2], [0.3, -1.5 - FLOOR, 0.05]), part(box(), steel, [x, (FLOOR - 1.5) / 2, z2 - 0.13], [0.3, -1.5 - FLOOR, 0.03]), part(box(), steel, [x, (FLOOR - 1.5) / 2, z2 + 0.13], [0.3, -1.5 - FLOOR, 0.03]));
        g.add(part(box(), steelD, [x, FLOOR + 0.05, z2], [0.6, 0.1, 0.6]));
        if (k > 0) {
          const xa = cols[k - 1], dx = x - xa, dy = -1.6 - FLOOR - 0.4;
          const len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
          for (const sgn of [1, -1]) g.add(part(box(), steelD, [(x + xa) / 2, (FLOOR - 1.4) / 2, z2], [len, 0.08, 0.04], [0, 0, sgn * ang]));
        }
      });
    }
  }

  // ---- conveyor lines: crates riding belts on the shop floor (seen through the gaps) and on
  // raised lines either side of the kitchen
  const crateM = [mat(0xb8874a, { rough: 0.8 }), mat(0x8a5a30, { rough: 0.8 }), mat(0x4a6a8a, { rough: 0.6, metal: 0.3 })];
  const belt = (a, b, y, width, n, speed) => {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length(), dir = d.clone().normalize();
    const grp = new THREE.Group();
    grp.position.copy(a);
    grp.rotation.y = Math.atan2(-dir.z, dir.x);
    const bt = beltTex().clone(); bt.needsUpdate = true; bt.repeat.set(len * 1.2, 1);
    grp.add(part(new THREE.PlaneGeometry(len, width), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.7 }), [len / 2, y + 0.01, 0], 1, [-Math.PI / 2, 0, 0]));
    for (const s of [-1, 1]) grp.add(part(box(), yellow, [len / 2, y - 0.05, s * (width / 2 + 0.04)], [len, 0.22, 0.08]));
    for (let x = 0.4; x < len; x += 1.4) for (const s of [-1, 1]) grp.add(part(box(), steelD, [x, (y + FLOOR) / 2 - 0.1, s * width * 0.45], [0.08, y - FLOOR - 0.2, 0.08]));
    const crates = [];
    for (let k = 0; k < n; k++) {
      const c = new THREE.Group();
      const sz = 0.45 + r() * 0.25;
      c.add(part(box(), crateM[k % 3], [0, sz / 2, 0], [sz, sz * (0.8 + r() * 0.3), sz]));
      if (k % 3 !== 2) for (const s of [-1, 1]) c.add(part(box(), mat(0x5a3a1e, { rough: 0.8 }), [0, sz / 2, s * sz * 0.51], [sz * 1.01, 0.05, 0.02]));
      grp.add(c);
      crates.push({ c, off: k / n });
    }
    g.add(grp);
    updaters.push((t) => {
      bt.offset.x = -t * speed * 1.2 / 1;
      for (const k of crates) { const u = ((t * speed / len + k.off) % 1); k.c.position.set(u * len, y + 0.02, 0); k.c.visible = u > 0.02 && u < 0.98; }
    });
    return grp;
  };
  (L ? L.gaps : []).forEach((gp, i) => belt(V(wx(gp.x0) + (gp.x1 - gp.x0 + 1) / 2, 0, zb - 6), V(wx(gp.x0) + (gp.x1 - gp.x0 + 1) / 2, 0, zf + 8), FLOOR + 0.6, 1.1, 6, i % 2 ? 0.9 : 1.1));
  belt(V(-W / 2 - 12, 0, zf + 3.2), V(W / 2 + 12, 0, zf + 3.2), FLOOR + 0.6, 1.3, 10, 1.2);
  for (const s of [-1, 1]) belt(V(s * (W / 2 + 2.3), 0, s < 0 ? zb - 3 : zf + 4), V(s * (W / 2 + 2.3), 0, s < 0 ? zf + 4 : zb - 3), -0.9, 1.0, 5, 0.8);

  // ---- welding robots beside the side lines
  const robot = (x, z, face, ph) => {
    const base = new THREE.Group();
    base.position.set(x, -0.6, z);
    base.rotation.y = face;
    base.add(part(cyl(18), steelD, [0, 0.1, 0], [0.42, 0.2, 0.42]));
    const turret = new THREE.Group(); turret.position.y = 0.2; base.add(turret);
    turret.add(part(cyl(16), orange, [0, 0.22, 0], [0.3, 0.44, 0.3]));
    const sh = new THREE.Group(); sh.position.y = 0.45; turret.add(sh);
    sh.add(part(sph(12), steelD, [0, 0, 0], 0.2));
    sh.add(part(box(), orange, [0, 0.55, 0], [0.2, 1.1, 0.22]));
    const el = new THREE.Group(); el.position.y = 1.1; sh.add(el);
    el.add(part(sph(12), steelD, [0, 0, 0], 0.16));
    el.add(part(box(), orange, [0, 0.45, 0], [0.16, 0.9, 0.18]));
    const wr = new THREE.Group(); wr.position.y = 0.9; el.add(wr);
    wr.add(part(cyl(10), steelD, [0, 0.1, 0], [0.08, 0.2, 0.08]));
    wr.add(part(cyl(8), mat(0x222222), [0, 0.28, 0], [0.03, 0.18, 0.03]));
    const tip = new THREE.Object3D(); tip.position.y = 0.38; wr.add(tip);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x9ad8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(0.8); tip.add(glow);
    g.add(base);
    const state = { welding: false };
    updaters.push((t) => {
      const c = (t * 0.35 + ph) % 1;
      // reach down to the belt, weld, swing back
      const k = c < 0.4 ? Math.sin(c / 0.4 * Math.PI) : 0;
      turret.rotation.y = Math.sin(t * 0.6 + ph * 6) * 0.5;
      sh.rotation.x = 0.5 + k * 0.45;
      el.rotation.x = 1.3 + k * 0.4;
      wr.rotation.x = 0.4 + Math.sin(t * 3) * 0.1;
      state.welding = c > 0.12 && c < 0.3;
      glow.material.opacity = state.welding ? 0.7 + Math.random() * 0.3 : 0;
    });
    sparks.push({ obj: tip, on: () => state.welding });
  };
  robot(-W / 2 - 3.3, -1.2, Math.PI / 2, 0);
  robot(-W / 2 - 3.3, 2.6, Math.PI / 2, 0.45);
  robot(W / 2 + 3.3, 0.6, -Math.PI / 2, 0.2);

  // ---- stamping press: a slamming ram and a burst of steam each stroke
  {
    const px = W / 2 + 4.6, pz = zb - 1.2;
    const pg = new THREE.Group(); pg.position.set(px, FLOOR, pz); g.add(pg);
    for (const s of [-1, 1]) pg.add(part(box(), mat(0x2a6a9a, { metal: 0.5, rough: 0.4 }), [s * 1.1, 4.2, 0], [0.5, 8.4, 1.4]));
    pg.add(part(box(), mat(0x2a6a9a, { metal: 0.5, rough: 0.4 }), [0, 8.6, 0], [2.9, 0.9, 1.6]));
    pg.add(part(box(), steelD, [0, 0.5, 0], [2.9, 1, 1.8]));
    pg.add(part(box(), steel, [0, 6.75, 0], [1.6, 0.3, 1.1]));
    const ram = new THREE.Group(); pg.add(ram);
    ram.add(part(cyl(16), mat(0xd8dde2, { metal: 0.9, rough: 0.15 }), [0, 7.7, 0], [0.32, 2, 0.32]));
    ram.add(part(box(), steelD, [0, 6.5, 0], [1.5, 0.5, 1.1]));
    const stripes2 = stripeTex().clone(); stripes2.needsUpdate = true; stripes2.repeat.set(3, 1);
    ram.add(part(new THREE.PlaneGeometry(1.5, 0.3), new THREE.MeshStandardMaterial({ map: stripes2 }), [0, 6.5, 0.56], 1));
    const lamp = part(sph(10), new THREE.MeshStandardMaterial({ color: 0xff3a1a, emissive: 0xff2000, emissiveIntensity: 0.2 }), [1.1, 8.7, 0.82], 0.14);
    pg.add(lamp);
    const st = { hit: false };
    updaters.push((t) => {
      const c = (t / 3.2) % 1;
      const y = c < 0.12 ? -c / 0.12 * 4.6 : c < 0.22 ? -4.6 : -4.6 * (1 - (c - 0.22) / 0.78);
      ram.position.y = y;
      lamp.material.emissiveIntensity = c > 0.85 || c < 0.22 ? 3 : 0.2;
      st.hit = c >= 0.12 && c < 0.16;
    });
    steam.push({ at: V(px, FLOOR + 1.6, pz + 0.9), burst: () => st.hit });
  }

  // ---- storage tanks with ladders and pipes, both sides
  for (const [x, z, rr, h] of [[-W / 2 - 5, zb - 1.5, 1.3, 9], [-W / 2 - 7.5, zb + 2.5, 1.1, 7.5], [W / 2 + 6.8, zb + 3.5, 1.2, 8]]) {
    g.add(part(cyl(24), mat(0xc8ccd0, { metal: 0.6, rough: 0.35 }), [x, FLOOR + h / 2, z], [rr, h, rr]));
    g.add(part(sph(24), mat(0xc8ccd0, { metal: 0.6, rough: 0.35 }), [x, FLOOR + h, z], [rr, rr * 0.4, rr]));
    for (let k = 1; k < 4; k++) g.add(part(cyl(24), steelD, [x, FLOOR + h * k / 4, z], [rr + 0.03, 0.1, rr + 0.03]));
    for (const s of [-1, 1]) g.add(part(box(), yellow, [x + s * 0.18, FLOOR + h / 2, z + rr + 0.12], [0.04, h, 0.04]));
    for (let y = FLOOR + 0.4; y < FLOOR + h; y += 0.35) g.add(part(box(), yellow, [x, y, z + rr + 0.12], [0.36, 0.03, 0.03]));
    g.add(part(cyl(12), mat(0xc0442a, { metal: 0.4, rough: 0.5 }), [x + (x < 0 ? 1 : -1) * (rr + 1), FLOOR + h - 1, z], [0.16, 2.4, 0.16], [0, 0, Math.PI / 2]));
    steam.push({ at: V(x, FLOOR + h + rr * 0.4, z), drift: true });
  }

  // ---- back wall: brick, tall factory windows, wall fans, pipe runs, the plant's name
  const wz = zb - 5;
  const bt = brickTex(r); bt.repeat.set(10, 5);
  g.add(part(new THREE.PlaneGeometry(W * 3 + 30, 22), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.9 }), [0, FLOOR + 11, wz], 1));
  const wt = windowTex();
  for (let k = -3; k <= 3; k++) {
    const win = part(new THREE.PlaneGeometry(2.6, 6), new THREE.MeshStandardMaterial({ map: wt, emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: 0.55, roughness: 0.4 }), [k * 4.4, 3.5, wz + 0.02], 1);
    g.add(win);
    g.add(part(box(), mat(0x6a6e74), [k * 4.4, 0.4, wz + 0.15], [2.9, 0.18, 0.3]));
  }
  for (let k = -1; k <= 1; k += 2) {
    const fan = new THREE.Group(); fan.position.set(k * 6.6, -2, wz + 0.1);
    fan.add(part(cyl(24), steelD, [0, 0, 0], [1.2, 0.2, 1.2], [Math.PI / 2, 0, 0]));
    const blades = new THREE.Group(); fan.add(blades);
    for (let b = 0; b < 5; b++) blades.add(part(box(), steel, [Math.cos(b * 1.257) * 0.5, Math.sin(b * 1.257) * 0.5, 0.12], [0.9, 0.28, 0.03], [0, 0.3, b * 1.257]));
    g.add(fan);
    updaters.push((t) => { blades.rotation.z = t * 4 * k; });
  }
  const sign = part(new THREE.PlaneGeometry(9, 1.7), new THREE.MeshStandardMaterial({ map: signTex(), roughness: 0.5 }), [0, 7.6, wz + 0.05], 1);
  g.add(sign);
  for (const [y, c, rr] of [[1.2, 0xc0442a, 0.22], [1.9, 0x8a929c, 0.16], [-3.5, 0x3a7a4a, 0.28]]) {
    g.add(part(cyl(14), mat(c, { metal: 0.5, rough: 0.4 }), [0, y, wz + 0.6], [rr, W * 3 + 20, rr], [0, 0, Math.PI / 2]));
    for (let x = -W * 1.4; x < W * 1.4; x += 3.3) g.add(part(cyl(14), steelD, [x, y, wz + 0.6], [rr + 0.05, 0.12, rr + 0.05], [0, 0, Math.PI / 2]));
  }
  steam.push({ at: V(-W * 0.35, 1.2, wz + 0.8), jet: true }, { at: V(W * 0.4, 1.9, wz + 0.8), jet: true });

  // ---- gantry crane running along behind the kitchen with a swinging crate
  {
    const y = 5.6, z = zb - 2.4;
    for (const s of [-1, 1]) ibeam(g, V(-W / 2 - 8, y, z + s * 1.1), V(W / 2 + 8, y, z + s * 1.1), 0.45, 0.25, yellow);
    const trolley = new THREE.Group(); g.add(trolley);
    trolley.add(part(box(), orange, [0, y + 0.1, z], [1.2, 0.5, 2.6]));
    const cable = part(cyl(6), mat(0x222222), [0, y - 1.4, z], [0.03, 2.8, 0.03]);
    trolley.add(cable);
    const load = new THREE.Group(); load.position.set(0, y - 2.9, z); trolley.add(load);
    load.add(part(box(), crateM[0], [0, -0.4, 0], [1.1, 0.8, 0.9]));
    load.add(part(box(), mat(0x5a3a1e), [0, -0.4, 0.46], [1.12, 0.1, 0.02]));
    updaters.push((t) => {
      trolley.position.x = Math.sin(t * 0.18) * (W / 2 + 4);
      load.rotation.z = Math.cos(t * 0.18) * 0.12 + Math.sin(t * 1.3) * 0.03;
    });
  }

  // ---- hanging lamps (with dusty light cones) and spinning beacons
  for (const [x, z] of [[-W / 2 - 3, zb + 1], [-W / 2 - 3, zf - 1], [W / 2 + 3, zb + 1], [W / 2 + 3, zf - 1]]) {
    const y = 6.5;
    g.add(part(cyl(6), mat(0x222222), [x, y + 3, z], [0.02, 6, 0.02]));
    g.add(part(new THREE.ConeGeometry(0.55, 0.45, 20, 1, true), mat(0x3a5a3a, { metal: 0.4, rough: 0.5 }), [x, y, z]));
    const bulb = part(sph(10), new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xfff2d0, emissiveIntensity: 2.5 }), [x, y - 0.18, z], 0.14);
    g.add(bulb);
    const beam = part(new THREE.ConeGeometry(2.2, 6, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), [x, y - 3.2, z]);
    beam.castShadow = false;
    g.add(beam);
    dust.push([x, y - 3, z]);
  }
  for (const [x, z] of [[-W / 2 - 2.3, zf + 0.6], [W / 2 + 2.3, zb - 0.6]]) {
    const bg = new THREE.Group(); bg.position.set(x, -0.3, z); g.add(bg);
    bg.add(part(cyl(12), steelD, [0, 0, 0], [0.12, 0.1, 0.12]));
    bg.add(part(sph(12), new THREE.MeshStandardMaterial({ color: 0xff9a1a, emissive: 0xff7a00, emissiveIntensity: 1.5, transparent: true, opacity: 0.85 }), [0, 0.15, 0], [0.12, 0.16, 0.12]));
    const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff9a1a, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    flare.position.y = 0.15; bg.add(flare);
    updaters.push((t) => { const k = Math.max(0, Math.cos(t * 5 + x)); flare.scale.set(0.4 + k * 1.2, 0.4 + k * 0.4, 1); flare.material.opacity = 0.2 + k * 0.6; });
  }
  return { sparks, steam, dust };
}
