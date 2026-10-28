// The virtual lobby: a little stage where every connected cook stands in their chosen outfit,
// themed after the level currently winning the vote. Also used as the title-screen backdrop.
import * as THREE from 'three';
import { COLORS, WORLDS, SLOT_COLORS } from '../config.js';
import { Chef } from './chef.js';
import { mat, part, sph, cyl, box, cone, tor, makeIngredient } from './items.js';
import { floorTex, textTex } from './textures.js';
import { STYLE } from './env.js';

export class LobbyScene {
  constructor(renderer) {
    this.renderer = renderer;
    const scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    this.hemi = new THREE.HemisphereLight(0xfff4e6, 0x3a2a4a, 1.3);
    scene.add(this.hemi);
    const key = this.key = new THREE.DirectionalLight(0xfff0dc, 2.4);
    key.position.set(3, 8, 6); key.castShadow = true;
    Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    this.spots = [];
    for (let i = 0; i < 4; i++) {
      const s = new THREE.SpotLight(SLOT_COLORS[i], 30, 14, 0.32, 0.6, 1.4);
      s.position.set((i - 1.5) * 1.6, 6, 3);
      s.target.position.set((i - 1.5) * 1.6, 0, 0);
      scene.add(s, s.target);
      this.spots.push(s);
    }
    this.stage = new THREE.Group();
    scene.add(this.stage);
    this.chefs = new Map();
    this.theme = null;
    this.setTheme(0);
    this.fit();
  }

  setTheme(wi) {
    if (this.theme === wi) return;
    this.theme = wi;
    const W = WORLDS[wi], S = STYLE[W.id];
    this.stage.clear();
    const c = document.createElement('canvas'); c.width = 2; c.height = 256;
    const g = c.getContext('2d'); const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#1a1430'); grd.addColorStop(0.6, '#' + W.fog.toString(16).padStart(6, '0')); grd.addColorStop(1, '#0e0a1a');
    g.fillStyle = grd; g.fillRect(0, 0, 2, 256);
    this.scene.background = new THREE.CanvasTexture(c);
    this.scene.background.colorSpace = THREE.SRGBColorSpace;
    // round stage in the world's floor style
    const tex = floorTex(S.floor).clone(); tex.needsUpdate = true; tex.repeat.set(4, 4);
    const disc = part(cyl(64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), [0, -0.2, 0], [4.6, 0.4, 2.6]);
    this.stage.add(disc);
    this.stage.add(part(tor(), mat(S.trim, { metal: 0.6, rough: 0.3, emissive: S.trim, ei: 0.25 }), [0, 0, 0], [4.6, 2.6, 0.5], [Math.PI / 2, 0, 0]));
    this.stage.add(part(cyl(64), mat(0x1a1424, { rough: 0.9 }), [0, -0.9, 0], [5.4, 1.2, 3.2]));
    // back counters with the world's ingredients on display
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 1.9;
      this.stage.add(part(box(), mat(S.side, { rough: 0.6 }), [x, 0.45, -2.1], [1.5, 0.9, 0.8]));
      this.stage.add(part(box(), mat(0xf0e8dc, { rough: 0.4 }), [x, 0.93, -2.1], [1.6, 0.08, 0.9]));
      const ing = makeIngredient(W.ingredients[i].id, 'raw');
      ing.position.set(x, 0.97, -2.0); ing.scale.setScalar(1.8); ing.rotation.y = i;
      this.stage.add(ing);
    }
    // marquee sign
    const sign = part(new THREE.PlaneGeometry(5.4, 0.9), new THREE.MeshBasicMaterial({ map: textTex(W.name.toUpperCase(), { w: 1024, h: 160, fg: '#ffe9a8', bg: 'rgba(20,14,36,0.9)', font: '800 92px Fredoka, sans-serif' }), transparent: true }), [0, 2.9, -2.6]);
    sign.castShadow = false;
    this.stage.add(sign);
    for (let i = 0; i < 16; i++) {
      const bulb = part(sph(8), mat(0xffe08a, { emissive: 0xffc040, ei: 1.5 }), [-2.75 + i * (5.5 / 15), 3.42, -2.58], 0.05);
      this.stage.add(bulb);
    }
    this.hemi.color.setHex(S.hemi[0]);
  }

  /** players: [{ id, name, outfit, color, skin, ready }] */
  setPlayers(players) {
    const keep = new Set();
    players.forEach((p, i) => {
      const sig = `${p.outfit}|${p.color}|${p.skin}`;
      let e = this.chefs.get(p.id);
      if (e && e.sig !== sig) { this.scene.remove(e.chef.root); e = null; }
      if (!e) {
        const chef = new Chef({ outfit: p.outfit, color: COLORS[p.color % COLORS.length], skin: p.skin || 0 });
        chef.root.scale.setScalar(1.6);
        this.scene.add(chef.root);
        e = { chef, sig, hop: 0 };
        this.chefs.set(p.id, e);
        e.hop = 1;
      }
      e.slot = i; e.ready = p.ready;
      keep.add(p.id);
    });
    for (const [id, e] of this.chefs) if (!keep.has(id)) { this.scene.remove(e.chef.root); this.chefs.delete(id); }
    this.count = players.length;
  }

  fit() {
    const w = this.renderer.domElement.clientWidth || innerWidth, h = this.renderer.domElement.clientHeight || innerHeight;
    this.camera.aspect = w / h;
    const d = Math.max(9.5, 7 / Math.min(1.4, this.camera.aspect));
    this.camera.position.set(0, 3.2, d);
    this.camera.lookAt(0, 1.05, 0);
    if (this.shift) this.camera.setViewOffset(w, h, -w * this.shift, 0, w, h); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  render(dt, t) {
    const n = Math.max(1, this.count || 0);
    for (const e of this.chefs.values()) {
      const x = (e.slot - (n - 1) / 2) * 1.75;
      const r = e.chef.root;
      r.position.x += (x - r.position.x) * Math.min(1, dt * 6);
      e.hop = Math.max(0, e.hop - dt * 1.6);
      r.position.y = Math.abs(Math.sin(e.hop * Math.PI * 2)) * 0.5 * e.hop + (e.ready ? Math.abs(Math.sin(t * 5 + e.slot)) * 0.12 : 0);
      r.position.z = 0.3;
      r.rotation.y = Math.sin(t * 0.8 + e.slot) * 0.35;
      e.chef.animate({ speed: e.ready ? 1.2 : 0, z: r.position.y, act: null, holding: false, dt, t: t + e.slot });
      if (e.ready) { e.chef.handL.position.y += 0.35; e.chef.handR.position.y += 0.35; }
    }
    this.spots.forEach((s, i) => { s.intensity = i < (this.count || 0) ? 30 : 4; s.position.x = (i - 1.5) * 1.75 + Math.sin(t + i) * 0.4; s.target.position.x = (i - ((this.count || 1) - 1) / 2) * 1.75; });
    this.stage.rotation.y = Math.sin(t * 0.15) * 0.05;
    this.renderer.render(this.scene, this.camera);
  }
}
