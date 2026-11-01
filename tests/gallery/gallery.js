// Visual QA page for food models (served by `npm run dev`, open /tests/gallery/).
//   ?w=0..7            one world: its 4 ingredients (rows) x raw / chopped / cooked / burnt (columns)
//   ?ing=id&chop=1      the chop sequence of one ingredient at several progress values
//   ?plates=w           plates, a few dishes and the extinguisher
//   ?chefs=0..3         cooks: a page of outfits (each with a different skin colour); &pose=chop|run|air
//   &zoom=1.5           closer camera
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { WORLDS, worldRecipes, finalState } from '../../src/config.js';
import * as Items from '../../src/render/items.js';
import { Chef, OUTFIT_IDS } from '../../src/render/chef.js';
const { makeIngredient, makePlate, makeExtinguisher } = Items;

const q = new URLSearchParams(location.search);
const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
R.setPixelRatio(1); R.setSize(innerWidth, innerHeight);
R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
R.shadowMap.enabled = true; R.localClippingEnabled = true;
document.body.appendChild(R.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3a332c);
scene.add(new THREE.HemisphereLight(0xfff4e6, 0x6a5a4a, 1.6));
const sun = new THREE.DirectionalLight(0xfff0dd, 2.6); sun.position.set(-3, 7, 4); sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 }); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
scene.add(sun, new THREE.AmbientLight(0xffffff, 0.25));
const pm = new THREE.PMREMGenerator(R); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.28;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.8 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const label = document.getElementById('l');
const tag = (txt, x, y) => { const d = document.createElement('div'); d.textContent = txt; d.style.cssText = `position:absolute;left:${x}px;top:${y}px`; label.appendChild(d); };

const cells = []; // [obj, col, row, text]
const zoom = +(q.get('zoom') || 1.5);
let cols = 4, rows = 4, rigs = [];
if (q.has('w')) {
  const W = WORLDS[+q.get('w')];
  W.ingredients.forEach((ing, r) => ['raw', 'chopped', 'cooked', 'burnt'].forEach((s, c) => cells.push([makeIngredient(ing.id, s), c, r, `${ing.name} ${s}`])));
} else if (q.has('ing')) {
  const ks = [0, 0.15, 0.35, 0.55, 0.75, 0.95, 1];
  cols = ks.length; rows = 1;
  ks.forEach((k, c) => {
    if (k >= 1) { cells.push([makeIngredient(q.get('ing'), 'chopped'), c, 0, 'chopped']); return; }
    const rig = new Items.ChopRig(q.get('ing')); rigs.push([rig, k]);
    cells.push([rig.group, c, 0, `k=${k}`]);
  });
} else if (q.has('one')) {
  cols = 4; rows = 1;
  q.get('one').split(',').forEach((spec, c) => { const [ing, st] = spec.split(':'); cells.push([makeIngredient(ing, st), c, 0, spec]); });
} else if (q.has('plates')) {
  cols = 4; rows = 2;
  const rs = worldRecipes(+q.get('plates')).filter((r, i) => [0, 2, 4, 7, 9].includes(i));
  rs.forEach((rc, i) => cells.push([makePlate({ c: rc.ings.map((ing) => ({ ing, s: finalState(ing) })) }), i % 4, Math.floor(i / 4), rc.name]));
  cells.push([makePlate({ n: 3 }), 2, 1, 'clean x3']); cells.push([makePlate({ n: 2, dirty: true }), 3, 1, 'dirty']);
  cells.push([makeExtinguisher(), 3, 0, 'ext']);
}
const chefs = [];
if (q.has('chefs')) {
  cols = 4; rows = 2;
  const page = +q.get('chefs');
  OUTFIT_IDS.slice(page * 8, page * 8 + 8).forEach((id, i) => {
    const c = new Chef({ outfit: id, color: [0xe8553a, 0x3a8ae8, 0x4ab84a, 0xf2b52a, 0xa05ad8, 0x2ac0b8, 0xf27ab0, 0x5a5a6a][i], skin: (page * 8 + i) % 16 });
    c.root.scale.setScalar(0.5); c.root.add(c.blob);
    chefs.push(c);
    cells.push([c.root, i % 4, Math.floor(i / 4), id]);
  });
}
if (q.has('plain')) for (const [o] of cells) o.traverse((m) => { if (m.isMesh && !Array.isArray(m.material)) m.material = new THREE.MeshStandardMaterial({ vertexColors: !!m.geometry.attributes.color, color: m.material.color, roughness: 0.5 }); });
if (q.has('tweak')) { const [k, v] = q.get('tweak').split(':'); for (const [o] of cells) o.traverse((m) => { if (m.isMesh) for (const mt of [m.material].flat()) { mt[k] = +v; mt.needsUpdate = true; } }); }
const sp = 0.62;
for (const [o, c, r] of cells) { o.position.set((c - (cols - 1) / 2) * sp, 0, (r - (rows - 1) / 2) * sp); scene.add(o); }
const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 50);
const span = Math.max(cols, rows * 1.6) * sp;
cam.position.set(0, span * 1.05 / zoom, span * 0.95 / zoom); cam.lookAt(0, 0, 0.05);
if (chefs.length) {
  // front view, two shelves of cooks
  for (const [o, c, r] of cells) { o.position.set((c - 1.5) * 0.62, (1 - r) * 0.72, 0); o.rotation.y = 0.3; }
  floor.visible = false;
  cam.position.set(0, 0.62, 3.0 / zoom); cam.lookAt(0, 0.6, 0);
}
let t = 0;
function frame() {
  t += 1 / 60;
  for (const [rig, k] of rigs) rig.update(k, 1 / 60);
  const pose = q.get('pose');
  for (const c of chefs) c.animate({ speed: pose === 'run' ? 4.4 : 0, z: pose === 'air' ? 0.3 : 0, act: pose === 'chop' ? 'chop' : null, holding: pose === 'hold', shock: pose === 'air', dt: 1 / 60, t });
  R.render(scene, cam);
  if (!label.childNodes.length) for (const [o, , , txt] of cells) { const v = o.position.clone().project(cam); tag(txt, (v.x + 1) / 2 * innerWidth - 40, (1 - v.y) / 2 * innerHeight + 30); }
  requestAnimationFrame(frame);
}
frame();
window.ready = true;
