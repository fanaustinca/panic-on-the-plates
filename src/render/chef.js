// Cook characters: rounded body, floating hands and feet, one of 9 outfits, and procedural
// animation (walk, carry, chop, wash, spray, jump, fall, knocked-out spin).
import * as THREE from 'three';
import { mat, part, sph, cyl, box, cone, tor, capsule } from './items.js';
import { shade } from './textures.js';

const OUTFIT = {
  chef: { body: 0xf6f6f2, pants: 0x2a2d36, accentApron: true },
  pirate: { body: 0xf2ece0, stripes: 0xb82a2a, pants: 0x3a2a1e, belt: 0x2a1a0e },
  parka: { body: 0x3a7ad8, fur: 0xf4efe6, pants: 0x2a3a5a, puffy: true },
  heatsuit: { body: 0xc8ccd2, pants: 0xa8aeb6, metal: true },
  spacesuit: { body: 0xf2f4f8, pants: 0xdfe3ea, pack: true },
  aviator: { body: 0x7a4a2a, pants: 0x4a3a2a, belt: 0x2a1a0e },
  explorer: { body: 0xc8b07a, pants: 0x8a7a50, belt: 0x5a3a1a },
  welder: { body: 0x3a5a7a, pants: 0x2a3a4a, apron: 0x6a4a2a },
  wizard: { body: 0x4a2a8a, pants: 0x3a1a6a, robe: true },
};
export const OUTFIT_IDS = Object.keys(OUTFIT);
const SKIN = [0xf2c8a0, 0xd9a07a, 0xa86e48, 0x6e4a32];

export class Chef {
  constructor({ outfit = 'chef', color = 0xe8553a, skin = 0, name = '' } = {}) {
    this.root = new THREE.Group();
    this.body = new THREE.Group(); // bobs / leans
    this.root.add(this.body);
    this.phase = Math.random() * 10;
    this.build(outfit, color, skin);
    this.name = name;
    this.knife = new THREE.Group();
    this.knife.add(part(box(), mat(0xdfe6ee, { metal: 0.8, rough: 0.25 }), [0, 0, 0.09], [0.012, 0.05, 0.14]));
    this.knife.add(part(box(), mat(0x3a2a1a), [0, 0, -0.02], [0.02, 0.035, 0.08]));
    this.knife.visible = false;
    this.handR.add(this.knife);
    this.holdAnchor = new THREE.Group();
    this.holdAnchor.position.set(0, 0.5, 0.36);
    this.root.add(this.holdAnchor);
  }

  build(outfitId, color, skinIdx) {
    const O = OUTFIT[outfitId] || OUTFIT.chef;
    const body = this.body;
    const B = mat(O.body, { rough: O.metal ? 0.25 : 0.6, metal: O.metal ? 0.7 : 0 });
    const skin = mat(SKIN[skinIdx % SKIN.length], { rough: 0.6 });
    const acc = mat(color, { rough: 0.5 });
    // torso
    if (O.robe) body.add(part(cone(20), B, [0, 0.36, 0], [0.27, 0.62, 0.26]));
    else body.add(part(capsule(), B, [0, 0.42, 0], O.puffy ? [0.52, 0.36, 0.46] : [0.46, 0.34, 0.4]));
    if (O.stripes) for (let i = 0; i < 3; i++) body.add(part(tor(), mat(O.stripes), [0, 0.3 + i * 0.1, 0], [0.225, 0.2, 0.12], [Math.PI / 2, 0, 0]));
    if (O.accentApron) {
      body.add(part(box(), acc, [0, 0.33, 0.19], [0.3, 0.32, 0.03]));
      body.add(part(box(), acc, [0, 0.47, 0.17], [0.42, 0.04, 0.05]));
    }
    if (O.apron) body.add(part(box(), mat(O.apron, { rough: 0.9 }), [0, 0.35, 0.2], [0.3, 0.36, 0.03]));
    if (O.belt) {
      body.add(part(cyl(20), mat(O.belt), [0, 0.3, 0], [0.235, 0.05, 0.215]));
      body.add(part(box(), mat(0xe8c040, { metal: 0.8, rough: 0.3 }), [0, 0.3, 0.215], [0.07, 0.05, 0.02]));
    }
    // scarf / collar in the player colour for every non-chef outfit
    if (!O.accentApron) body.add(part(tor(), acc, [0, 0.6, 0], [0.17, 0.17, 0.3], [Math.PI / 2, 0, 0]));
    if (O.fur) body.add(part(tor(), mat(O.fur, { rough: 1 }), [0, 0.32, 0], [0.25, 0.25, 0.25], [Math.PI / 2, 0, 0]));
    if (O.pack) {
      body.add(part(box(), mat(0xd8dde6, { rough: 0.4 }), [0, 0.45, -0.24], [0.3, 0.32, 0.12]));
      body.add(part(cyl(), mat(color, { emissive: color, ei: 0.6 }), [0.08, 0.5, -0.31], [0.03, 0.06, 0.03], [Math.PI / 2, 0, 0]));
    }
    if (outfitId === 'heatsuit') body.add(part(box(), mat(0xffb020, { emissive: 0xff8000, ei: 0.3 }), [0, 0.42, 0.21], [0.3, 0.04, 0.02]));
    // head
    const head = new THREE.Group();
    head.position.set(0, 0.78, 0);
    body.add(head);
    this.head = head;
    head.add(part(sph(24), skin, [0, 0, 0], [0.2, 0.19, 0.19]));
    const eyeW = mat(0xffffff, { rough: 0.3 }), eyeB = mat(0x1a1a22, { rough: 0.2 });
    for (const s of [-1, 1]) {
      head.add(part(sph(12), eyeW, [s * 0.07, 0.03, 0.155], [0.045, 0.055, 0.03]));
      head.add(part(sph(10), eyeB, [s * 0.07, 0.03, 0.18], [0.025, 0.033, 0.015]));
    }
    head.add(part(sph(10), mat(shade(SKIN[skinIdx % SKIN.length], -0.12)), [0, -0.02, 0.19], [0.035, 0.03, 0.03]));
    head.add(part(box(), mat(0x6a2a2a), [0, -0.09, 0.17], [0.07, 0.015, 0.01]));
    this.buildHat(outfitId, head, color, O);
    // hands and feet
    const handM = outfitId === 'heatsuit' || outfitId === 'spacesuit' || outfitId === 'welder' ? mat(outfitId === 'welder' ? 0x8a5a2a : 0xe8e8ee) : outfitId === 'parka' ? mat(color) : skin;
    this.handL = new THREE.Group(); this.handR = new THREE.Group();
    this.handL.add(part(sph(12), handM, [0, 0, 0], 0.075)); this.handR.add(part(sph(12), handM, [0, 0, 0], 0.075));
    this.root.add(this.handL, this.handR);
    const footM = mat(O.pants, { rough: 0.7 });
    this.footL = part(sph(12), footM, [0, 0.05, 0], [0.09, 0.06, 0.13]);
    this.footR = part(sph(12), footM, [0, 0.05, 0], [0.09, 0.06, 0.13]);
    this.root.add(this.footL, this.footR);
    // contact shadow helper ring for readability when jumping
    this.blob = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.012;
  }

  buildHat(id, head, color, O) {
    const add = (...a) => head.add(part(...a));
    const W = mat(0xffffff, { rough: 0.7 });
    switch (id) {
      case 'chef':
        add(cyl(20), W, [0, 0.19, 0], [0.16, 0.12, 0.16]);
        for (let i = 0; i < 5; i++) add(sph(14), W, [Math.cos(i * 1.256) * 0.1, 0.31, Math.sin(i * 1.256) * 0.1], 0.1);
        add(sph(14), W, [0, 0.34, 0], 0.12);
        break;
      case 'pirate': {
        const H = mat(0x1e1a1a, { rough: 0.8 });
        add(cyl(24), H, [0, 0.14, 0], [0.3, 0.03, 0.26]);
        add(sph(16), H, [0, 0.18, 0], [0.19, 0.12, 0.17]);
        for (const s of [-1, 1]) add(box(), H, [s * 0.2, 0.2, 0], [0.04, 0.1, 0.26], [0, 0, s * 0.5]);
        add(box(), H, [0, 0.2, -0.18], [0.3, 0.1, 0.04], [0.5, 0, 0]);
        add(sph(10), mat(0xf2f2f2), [0, 0.22, 0.17], [0.04, 0.035, 0.01]);
        add(sph(10), mat(0x111111), [-0.07, 0.03, 0.185], [0.05, 0.05, 0.02]);
        add(box(), mat(0x111111), [0, 0.06, 0], [0.42, 0.012, 0.4], [0, 0, -0.25]);
        break;
      }
      case 'parka':
        add(sph(20), mat(O.body, { rough: 0.8 }), [0, 0.03, -0.03], [0.25, 0.25, 0.24]);
        add(tor(), mat(O.fur, { rough: 1 }), [0, 0.02, 0.1], [0.19, 0.2, 0.3], [0, 0, 0]);
        add(sph(10), mat(0xffffff, { rough: 1 }), [0, 0.27, -0.05], 0.06);
        break;
      case 'heatsuit':
        add(sph(20), mat(0xc8ccd2, { metal: 0.8, rough: 0.25 }), [0, 0.03, -0.02], [0.24, 0.25, 0.24]);
        add(sph(20), mat(0xffa020, { metal: 0.9, rough: 0.1, emissive: 0x552200, ei: 0.4 }), [0, 0.02, 0.1], [0.19, 0.12, 0.13]);
        break;
      case 'spacesuit':
        add(sph(24), mat(0xbfe8ff, { rough: 0.05, opacity: 0.35 }), [0, 0, 0], 0.28);
        add(tor(), mat(0xd8dde6), [0, -0.17, 0], [0.24, 0.24, 0.25], [Math.PI / 2, 0, 0]);
        add(cyl(8), mat(0xd8dde6), [0.18, 0.2, -0.05], [0.01, 0.16, 0.01]);
        add(sph(8), mat(color, { emissive: color, ei: 1 }), [0.18, 0.29, -0.05], 0.025);
        break;
      case 'aviator':
        add(sph(20), mat(0x6a3e1e, { rough: 0.7 }), [0, 0.04, -0.02], [0.215, 0.2, 0.21]);
        for (const s of [-1, 1]) {
          add(box(), mat(0x6a3e1e), [s * 0.19, -0.07, 0], [0.04, 0.16, 0.1]);
          add(tor(), mat(0xb08a3a, { metal: 0.8, rough: 0.3 }), [s * 0.07, 0.13, 0.15], [0.055, 0.055, 0.25]);
          add(sph(12), mat(0x9fe0ff, { rough: 0.05, metal: 0.3 }), [s * 0.07, 0.13, 0.155], [0.045, 0.045, 0.02]);
        }
        add(box(), mat(0x3a2a1a), [0, 0.13, 0.14], [0.3, 0.02, 0.02]);
        break;
      case 'explorer': {
        const K = mat(0xe8d8a8, { rough: 0.8 });
        add(sph(20), K, [0, 0.12, 0], [0.22, 0.15, 0.22]);
        add(cyl(24), K, [0, 0.1, 0], [0.32, 0.015, 0.32]);
        add(cyl(24), mat(0x6a4a2a), [0, 0.13, 0], [0.223, 0.03, 0.223]);
        break;
      }
      case 'welder':
        add(box(), mat(0x2a2d31, { rough: 0.5 }), [0, 0.2, 0.04], [0.32, 0.26, 0.3], [-0.9, 0, 0]);
        add(box(), mat(0x3aff8a, { emissive: 0x0a4a2a, ei: 0.5, rough: 0.1 }), [0, 0.3, 0.15], [0.18, 0.06, 0.02], [-0.9, 0, 0]);
        add(cyl(20), mat(0x3a3d41), [0, 0.12, 0], [0.21, 0.04, 0.21]);
        break;
      case 'wizard': {
        const P = mat(0x4a2a8a, { rough: 0.7 });
        add(cyl(24), P, [0, 0.13, 0], [0.32, 0.02, 0.32]);
        const tip = part(cone(20), P, [0, 0.38, -0.03], [0.19, 0.5, 0.19], [-0.15, 0, 0]);
        head.add(tip);
        for (let i = 0; i < 4; i++) add(sph(6), mat(0xffe14a, { emissive: 0xffd000, ei: 0.8 }), [Math.cos(i * 1.7) * 0.12, 0.25 + i * 0.07, Math.sin(i * 1.7) * 0.12], 0.025);
        add(cone(12), mat(0xeeeeee, { rough: 1 }), [0, -0.2, 0.12], [0.11, 0.22, 0.06], [Math.PI + 0.25, 0, 0]);
        break;
      }
    }
  }

  /**
   * s = { speed, vx, vy, z, act, holding, ko, falling, dt, t }
   */
  animate(s) {
    const dt = s.dt;
    const sp = Math.min(1, s.speed / 4.4);
    this.phase += dt * (6 + sp * 8) * (sp > 0.05 ? 1 : 0.3);
    const ph = this.phase;
    const air = s.z > 0.02;
    const bob = sp > 0.05 && !air ? Math.abs(Math.sin(ph)) * 0.06 * sp : Math.sin(s.t * 2) * 0.01;
    this.body.position.y = bob;
    this.body.rotation.x = sp * 0.18 * (air ? 0.4 : 1);
    this.body.rotation.z = Math.sin(ph) * 0.05 * sp;
    // feet
    const stride = air ? 0 : Math.sin(ph) * 0.14 * sp;
    this.footL.position.set(-0.11, Math.max(0, -Math.sin(ph)) * 0.06 * sp + (air ? 0.06 : 0), stride);
    this.footR.position.set(0.11, Math.max(0, Math.sin(ph)) * 0.06 * sp + (air ? 0.06 : 0), -stride);
    // hands
    const hl = this.handL.position, hr = this.handR.position;
    this.knife.visible = false;
    if (s.act === 'chop') {
      const c = Math.abs(Math.sin(s.t * 14));
      hl.set(-0.14, 0.48, 0.34);
      hr.set(0.1, 0.48 + c * 0.2, 0.36);
      this.knife.visible = true;
      this.knife.rotation.x = -0.4 - c * 0.6;
      this.body.rotation.x = 0.2;
    } else if (s.act === 'wash') {
      hl.set(-0.12 + Math.sin(s.t * 9) * 0.05, 0.5, 0.36 + Math.cos(s.t * 9) * 0.04);
      hr.set(0.12 - Math.sin(s.t * 9) * 0.05, 0.5, 0.36 - Math.cos(s.t * 9) * 0.04);
      this.body.rotation.x = 0.25;
    } else if (s.holding) {
      hl.set(-0.2, 0.5, 0.3);
      hr.set(0.2, 0.5, 0.3);
    } else {
      const sw = Math.sin(ph) * 0.16 * sp;
      hl.set(-0.29, 0.38 + bob, sw);
      hr.set(0.29, 0.38 + bob, -sw);
    }
    if (air) { hl.y += 0.15; hr.y += 0.15; }
    this.holdAnchor.position.set(0, 0.52 + bob, 0.38);
    // knocked out: spin + shrink handled by caller via root
    this.head.rotation.y = Math.sin(s.t * 0.7 + this.phase * 0.01) * 0.08;
  }
}
