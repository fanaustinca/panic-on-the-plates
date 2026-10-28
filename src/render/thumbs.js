// Renders 3D item models into small PNG icons for the HTML HUD (order tickets, hints, lobby).
import * as THREE from 'three';
import { makeIngredient, makePlate } from './items.js';
import { Chef } from './chef.js';

let R = null, scene, cam;
const cache = new Map();

function setup() {
  R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  R.setSize(128, 128, false);
  R.outputColorSpace = THREE.SRGBColorSpace;
  R.toneMapping = THREE.ACESFilmicToneMapping;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 2.2));
  const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(1, 2, 1.5); scene.add(d);
  cam = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
}

function snap(obj, { dist = 1.2, y = 0.12, elev = 0.75 } = {}) {
  if (!R) setup();
  scene.add(obj);
  cam.position.set(0, y + Math.sin(elev) * dist, Math.cos(elev) * dist);
  cam.lookAt(0, y, 0);
  R.render(scene, cam);
  scene.remove(obj);
  return R.domElement.toDataURL('image/png');
}

export function ingIcon(ing, state = 'raw') {
  const k = `ing:${ing}:${state}`;
  if (!cache.has(k)) {
    const m = makeIngredient(ing, state);
    m.rotation.y = 0.5;
    cache.set(k, snap(m, { dist: 1.0, y: 0.1 }));
  }
  return cache.get(k);
}

export function dishIcon(recipe, finalStates) {
  const k = `dish:${recipe.id}`;
  if (!cache.has(k)) {
    const m = makePlate({ c: recipe.ings.map((ing, i) => ({ ing, s: finalStates[i] })) });
    cache.set(k, snap(m, { dist: 1.25, y: 0.08, elev: 0.85 }));
  }
  return cache.get(k);
}

export function chefIcon(outfit, color, skin = 0) {
  const k = `chef:${outfit}:${color}:${skin}`;
  if (!cache.has(k)) {
    const c = new Chef({ outfit, color, skin });
    c.animate({ speed: 0, z: 0, act: null, holding: false, dt: 0, t: 0 });
    c.root.rotation.y = 0.35;
    cache.set(k, snap(c.root, { dist: 2.6, y: 0.62, elev: 0.18 }));
  }
  return cache.get(k);
}
