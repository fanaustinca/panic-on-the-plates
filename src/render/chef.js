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
  wizard: { body: 0x6a4228, pants: 0x2a1e18, robe: true },
  // ---- gift-box outfits
  diner: { body: 0x3ab0a8, pants: 0x2a2d36, accentApron: true, hat: 'cap', hatC: 0xffffff },
  baker: { body: 0xf4e8d0, pants: 0x8a6a4a, apron: 0xffffff, hat: 'beret', hatC: 0xffffff },
  linecook: { body: 0x2a2c32, pants: 0x1a1a1e, accentApron: true, hat: 'bandana' },
  barista: { body: 0x7a5a44, pants: 0x2a2a30, apron: 0x2a6a4a, hat: 'beret', hatC: 0x2a2226 },
  lunchlady: { body: 0xf28ab0, pants: 0x4a4a5a, apron: 0xffffff, hat: 'hairnet' },
  sous: { body: 0xdfe3ea, pants: 0x2a2d36, accentApron: true, hat: 'toque' },
  cowboy: { body: 0xb07a4a, pants: 0x3a4a6a, belt: 0x3a2412, hat: 'cowboy', hatC: 0x8a5a2a },
  sushi: { body: 0xf6f6f2, pants: 0x1a1a22, stripes: 0x1a1a22, hat: 'headband' },
  ninja: { body: 0x1c1c24, pants: 0x1c1c24, belt: 0x8a1a1a, hat: 'ninja', gloves: 0x1c1c24 },
  viking: { body: 0x6a4a2a, pants: 0x4a3a2a, fur: 0xd8c8a8, belt: 0x2a1a0e, hat: 'viking' },
  knight: { body: 0xb8c0c8, pants: 0x8a929a, metal: true, hat: 'knight', gloves: 0x9aa2aa },
  royal: { body: 0x6a2a8a, pants: 0x2a1a3a, cape: 0xc02a3a, fur: 0xfff8f0, hat: 'crown' },
  robo: { body: 0xa8b4c0, pants: 0x6a7480, metal: true, hat: 'robo', gloves: 0x6a7480 },
  witch: { body: 0x3a2a5a, pants: 0x1a1a2a, robe: true, hat: 'witch' },
  dragon: { body: 0x3a9a4a, pants: 0x2a6a3a, spikes: 0xf2c84a, hat: 'dragon', gloves: 0x3a9a4a },
  ghost: { body: 0xeef2ff, pants: 0xeef2ff, robe: true, ghost: true, hat: 'halo' },
  // ---- chroma: animated
  prism: { body: 0xffffff, pants: 0x2a2d36, chroma: 'prism', hat: 'chefC' },
  galaxy: { body: 0x1a1440, pants: 0x0e0a24, chroma: 'galaxy', hat: 'chefC', cape: 0x2a1a6a },
  golden: { body: 0xffc83a, pants: 0xb8862a, metal: true, chroma: 'golden', hat: 'crown', cape: 0xc02a3a },
  neon: { body: 0x14141c, pants: 0x14141c, chroma: 'neon', stripes: 0x00ffd0, hat: 'cap', hatC: 0x14141c },
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
    // a proper cleaver: wide steel blade, bolster and wooden handle
    this.knife = new THREE.Group();
    this.knife.add(part(box(), mat(0xe6edf4, { metal: 0.9, rough: 0.18 }), [0, 0.02, 0.17], [0.014, 0.13, 0.22]));
    this.knife.add(part(box(), mat(0x9aa4ae, { metal: 0.9, rough: 0.3 }), [0, 0.085, 0.17], [0.016, 0.012, 0.22]));
    this.knife.add(part(cyl(8), mat(0x8a8f96, { metal: 0.8 }), [0, 0, 0.05], [0.02, 0.03, 0.02], [Math.PI / 2, 0, 0]));
    this.knife.add(part(box(), mat(0x5a3418, { rough: 0.6 }), [0, 0, -0.03], [0.03, 0.035, 0.12]));
    this.knife.visible = false;
    this.knife.scale.setScalar(1.5);
    this.land = 0; this.prevZ = 0; this.prevAir = false; this.blinkT = 2 + Math.random() * 3;
    this.handR.add(this.knife);
    this.holdAnchor = new THREE.Group();
    this.holdAnchor.position.set(0, 0.5, 0.36);
    this.root.add(this.holdAnchor);
  }

  build(outfitId, color, skinIdx) {
    const O = OUTFIT[outfitId] || OUTFIT.chef;
    const body = this.body;
    this.chroma = null;
    let B = mat(O.body, { rough: O.metal ? 0.25 : 0.6, metal: O.metal ? 0.7 : 0, opacity: O.ghost ? 0.62 : undefined });
    if (O.chroma) {
      // chroma outfits own their materials: they shimmer and cycle colour every frame (see animate)
      B = new THREE.MeshStandardMaterial({ color: O.body, roughness: O.metal ? 0.22 : 0.4, metalness: O.metal ? 0.85 : 0.1, emissive: O.chroma === 'golden' ? 0x6a4000 : 0x000000 });
      this.chroma = { kind: O.chroma, mats: [B] };
    }
    const skin = mat(SKIN[skinIdx % SKIN.length], { rough: 0.6 });
    const acc = mat(color, { rough: 0.5 });
    // torso
    if (O.robe) body.add(part(cone(20), B, [0, 0.36, 0], [0.27, 0.62, 0.26]));
    else body.add(part(capsule(), B, [0, 0.42, 0], O.puffy ? [0.52, 0.36, 0.46] : [0.46, 0.34, 0.4]));
    const stripeM = O.chroma === 'neon' ? new THREE.MeshStandardMaterial({ color: O.stripes, emissive: O.stripes, emissiveIntensity: 1.6 }) : O.stripes != null ? mat(O.stripes) : null;
    if (stripeM && O.chroma) this.chroma.mats.push(stripeM);
    if (O.stripes != null) for (let i = 0; i < 3; i++) body.add(part(tor(), stripeM, [0, 0.3 + i * 0.1, 0], [0.225, 0.2, 0.12], [Math.PI / 2, 0, 0]));
    if (O.cape) body.add(part(box(), mat(O.cape, { rough: 0.7 }), [0, 0.36, -0.22], [0.42, 0.5, 0.03], [0.12, 0, 0]));
    if (O.spikes) for (let i = 0; i < 4; i++) body.add(part(cone(8), mat(O.spikes, { rough: 0.5 }), [0, 0.68 - i * 0.12, -0.2 - (i === 0 ? 0 : 0.02)], [0.05, 0.1, 0.05], [-1.2, 0, 0]));
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
    this.eyes = [];
    for (const s of [-1, 1]) {
      const eg = new THREE.Group(); eg.position.set(s * 0.07, 0.03, 0);
      eg.add(part(sph(12), eyeW, [0, 0, 0.155], [0.045, 0.055, 0.03]));
      eg.add(part(sph(10), eyeB, [0, 0, 0.18], [0.025, 0.033, 0.015]));
      head.add(eg); this.eyes.push(eg);
    }
    head.add(part(sph(10), mat(shade(SKIN[skinIdx % SKIN.length], -0.12)), [0, -0.02, 0.19], [0.035, 0.03, 0.03]));
    head.add(part(box(), mat(0x6a2a2a), [0, -0.09, 0.17], [0.07, 0.015, 0.01]));
    this.buildHat(outfitId, head, color, O);
    // hands and feet
    const handM = O.gloves != null ? mat(O.gloves, { metal: O.metal ? 0.7 : 0, rough: 0.5 }) : O.ghost ? B : outfitId === 'heatsuit' || outfitId === 'spacesuit' || outfitId === 'welder' ? mat(outfitId === 'welder' ? 0x8a5a2a : 0xe8e8ee) : outfitId === 'parka' ? mat(color) : skin;
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
    switch (O.hat || id) {
      case 'chefC': {
        // a chroma toque: owns its material so it cycles with the outfit
        const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, emissive: 0x000000 });
        this.chroma.mats.push(m);
        add(cyl(20), m, [0, 0.19, 0], [0.16, 0.12, 0.16]);
        for (let i = 0; i < 5; i++) add(sph(14), m, [Math.cos(i * 1.256) * 0.1, 0.31, Math.sin(i * 1.256) * 0.1], 0.1);
        add(sph(14), m, [0, 0.34, 0], 0.12);
        break;
      }
      case 'toque':
        add(cyl(20), W, [0, 0.17, 0], [0.165, 0.1, 0.165]);
        add(sph(14), W, [0, 0.25, 0], [0.18, 0.08, 0.18]);
        break;
      case 'cap': {
        const C = O.chroma === 'neon' ? new THREE.MeshStandardMaterial({ color: 0x00ffd0, emissive: 0x00ffd0, emissiveIntensity: 1.4 }) : mat(O.hatC, { rough: 0.6 });
        if (O.chroma) this.chroma.mats.push(C);
        add(box(), C, [0, 0.19, 0], [0.34, 0.08, 0.2]);
        add(box(), C, [0, 0.235, 0], [0.3, 0.04, 0.05]);
        if (!O.chroma) add(box(), mat(color), [0, 0.165, 0], [0.345, 0.025, 0.205]);
        break;
      }
      case 'beret':
        add(sph(18), mat(O.hatC, { rough: 0.8 }), [0.03, 0.16, -0.02], [0.23, 0.07, 0.22], [0, 0, -0.2]);
        add(sph(8), mat(O.hatC), [0.03, 0.23, -0.02], 0.025);
        break;
      case 'bandana':
        add(sph(18), mat(color, { rough: 0.8 }), [0, 0.06, -0.01], [0.205, 0.16, 0.2]);
        add(sph(8), mat(color, { rough: 0.8 }), [0, 0.0, -0.21], [0.06, 0.05, 0.05]);
        break;
      case 'hairnet':
        add(sph(18), mat(0xffffff, { rough: 0.6, opacity: 0.55 }), [0, 0.07, -0.01], [0.215, 0.17, 0.21]);
        break;
      case 'cowboy': {
        const H = mat(O.hatC, { rough: 0.8 });
        add(cyl(24), H, [0, 0.13, 0], [0.34, 0.02, 0.34]);
        add(sph(16), H, [0, 0.2, 0], [0.18, 0.14, 0.17]);
        add(cyl(20), mat(0x3a2412), [0, 0.15, 0], [0.185, 0.03, 0.175]);
        for (const sx of [-1, 1]) add(box(), H, [sx * 0.3, 0.17, 0], [0.08, 0.02, 0.4], [0, 0, sx * 0.5]);
        break;
      }
      case 'headband':
        add(cyl(20), mat(0xffffff, { rough: 0.7 }), [0, 0.09, 0], [0.205, 0.05, 0.2]);
        add(sph(10), mat(0xd82a2a), [0, 0.09, 0.2], [0.035, 0.035, 0.01]);
        add(sph(14), mat(0x1a1a1a, { rough: 0.6 }), [0, 0.15, -0.02], [0.19, 0.1, 0.18]);
        break;
      case 'ninja':
        add(sph(20), mat(0x1c1c24, { rough: 0.7 }), [0, 0.02, -0.02], [0.215, 0.205, 0.21]);
        add(box(), mat(0x1c1c24), [0, -0.07, 0.16], [0.3, 0.1, 0.06]);
        add(box(), mat(color), [0, 0.12, 0.05], [0.42, 0.03, 0.3]);
        add(box(), mat(color), [-0.06, 0.1, -0.22], [0.04, 0.03, 0.16], [0.5, 0.3, 0]);
        break;
      case 'viking': {
        const steel = mat(0x9aa2aa, { metal: 0.8, rough: 0.3 });
        add(sph(20), steel, [0, 0.07, -0.01], [0.22, 0.18, 0.21]);
        add(cyl(20), mat(0x6a4a2a), [0, 0.04, 0], [0.225, 0.04, 0.215]);
        for (const sx of [-1, 1]) add(cone(10), mat(0xf4ecd8, { rough: 0.5 }), [sx * 0.24, 0.17, 0], [0.05, 0.2, 0.05], [0, 0, -sx * 0.9]);
        add(sph(12), mat(0xd88a3a, { rough: 0.9 }), [0, -0.14, 0.15], [0.14, 0.09, 0.08]);
        break;
      }
      case 'knight': {
        const steel = mat(0xb8c0c8, { metal: 0.85, rough: 0.25 });
        add(cyl(20), steel, [0, 0.03, 0], [0.235, 0.36, 0.235]);
        add(box(), mat(0x1a1a1a), [0, 0.04, 0.22], [0.26, 0.035, 0.02]);
        add(box(), mat(0x1a1a1a), [0, -0.04, 0.22], [0.035, 0.12, 0.02]);
        add(sph(10), mat(color, { rough: 0.8 }), [0, 0.3, -0.04], [0.06, 0.12, 0.16]);
        break;
      }
      case 'crown': {
        const gold = mat(0xffd040, { metal: 0.9, rough: 0.2 });
        add(cyl(20, 0.5), gold, [0, 0.19, 0], [0.17, 0.09, 0.17]);
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; add(cone(6), gold, [Math.cos(a) * 0.15, 0.27, Math.sin(a) * 0.15], [0.03, 0.08, 0.03]); }
        for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.4; add(sph(8), mat([0xd82a3a, 0x2a8ad8, 0x2ad86a][i], { rough: 0.1 }), [Math.cos(a) * 0.17, 0.19, Math.sin(a) * 0.17], 0.025); }
        break;
      }
      case 'robo': {
        const steel = mat(0xa8b4c0, { metal: 0.85, rough: 0.25 });
        add(box(), steel, [0, 0.02, 0], [0.4, 0.36, 0.36]);
        add(box(), new THREE.MeshStandardMaterial({ color: 0x0a1a2a, emissive: 0x2ad8ff, emissiveIntensity: 0.8 }), [0, 0.04, 0.18], [0.3, 0.1, 0.02]);
        add(cyl(8), steel, [0, 0.27, 0], [0.012, 0.16, 0.012]);
        add(sph(8), new THREE.MeshStandardMaterial({ color: 0xff3a3a, emissive: 0xff2020, emissiveIntensity: 1.5 }), [0, 0.36, 0], 0.035);
        break;
      }
      case 'witch': {
        const H = mat(0x2a1a3a, { rough: 0.7 });
        add(cyl(24), H, [0, 0.13, 0], [0.34, 0.02, 0.34]);
        add(cone(20), H, [0.02, 0.36, -0.03], [0.17, 0.46, 0.17], [-0.15, 0, 0.1]);
        add(cyl(20), mat(0x8a3ad8), [0, 0.17, 0], [0.175, 0.04, 0.175]);
        break;
      }
      case 'dragon':
        for (const sx of [-1, 1]) add(cone(10), mat(0xf2e8c8, { rough: 0.5 }), [sx * 0.11, 0.2, -0.04], [0.04, 0.16, 0.04], [-0.4, 0, -sx * 0.3]);
        add(cone(8), mat(O.spikes), [0, 0.2, -0.1], [0.04, 0.1, 0.04], [-0.8, 0, 0]);
        break;
      case 'halo':
        add(new THREE.TorusGeometry(0.15, 0.022, 8, 32), new THREE.MeshStandardMaterial({ color: 0xfff0a0, emissive: 0xffd040, emissiveIntensity: 1.6 }), [0, 0.32, 0], 1, [Math.PI / 2, 0, 0]);
        break;
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
        // clockmaker: top hat with a brass band and a little cog, goggles on the brim
        const P = mat(0x2a1a12, { rough: 0.6 }), brass = mat(0xd8a84a, { metal: 0.85, rough: 0.3 });
        add(cyl(24), P, [0, 0.13, 0], [0.3, 0.02, 0.3]);
        add(cyl(24), P, [0, 0.29, 0], [0.19, 0.3, 0.19]);
        add(cyl(24), brass, [0, 0.19, 0], [0.195, 0.05, 0.195]);
        add(cyl(10), brass, [0.17, 0.25, 0.08], [0.06, 0.02, 0.06], [0, 0, Math.PI / 2]);
        for (const s of [-1, 1]) {
          add(cyl(16), brass, [s * 0.08, 0.17, 0.17], [0.065, 0.05, 0.065], [Math.PI / 2 - 0.3, 0, 0]);
          add(cyl(16), mat(0x7ad8ff, { emissive: 0x2a6a8a, ei: 0.6, rough: 0.1 }), [s * 0.08, 0.17, 0.195], [0.048, 0.01, 0.048], [Math.PI / 2 - 0.3, 0, 0]);
        }
        break;
      }
    }
  }

  /**
   * s = { speed, vx, vy, z, act, holding, ko, falling, dt, t }
   */
  animate(s) {
    const dt = Math.min(0.05, s.dt);
    const sp = Math.min(1.2, s.speed / 4.4);
    const moving = sp > 0.08;
    const air = s.z > 0.02;
    const vz = (s.z - this.prevZ) / Math.max(1e-3, dt);
    this.prevZ = s.z;
    if (this.prevAir && !air) this.land = 1;          // just touched down: squash
    this.prevAir = air;
    this.land = Math.max(0, this.land - dt * 6);
    // stride phase advances with distance travelled
    this.phase += dt * (moving ? 5 + sp * 7.5 : 0);
    const ph = this.phase;
    const step = Math.sin(ph), stepAbs = Math.abs(Math.cos(ph));
    const B = this.body;
    // ---- body: bob twice per stride, lean into the run, sway side to side, squash & stretch
    let bob = moving && !air ? stepAbs * 0.07 * sp : Math.sin(s.t * 2.2) * 0.008;
    let sy = 1 + (moving && !air ? (stepAbs - 0.5) * 0.08 * sp : Math.sin(s.t * 2.2) * 0.015);
    if (air) sy = 1 + Math.max(-0.12, Math.min(0.16, vz * 0.035));
    sy -= this.land * 0.22;
    const sxz = 1 / Math.sqrt(Math.max(0.6, sy));
    B.scale.set(sxz, sy, sxz);
    B.position.y = bob - this.land * 0.04;
    B.rotation.x = (air ? 0.05 : sp * 0.22) + this.land * 0.15;
    B.rotation.z = moving && !air ? step * 0.07 * sp : 0;
    B.rotation.y = moving && !air ? step * 0.12 * sp : 0;
    // ---- feet: lift on the forward swing, plant and push back
    const lift = (v) => Math.max(0, v) * 0.11 * Math.min(1, sp);
    const stride = 0.17 * Math.min(1, sp);
    if (air) {
      const tuck = vz > 0 ? 0.12 : 0.05;
      this.footL.position.set(-0.11, tuck, 0.06); this.footR.position.set(0.11, tuck * 0.8, -0.04);
      this.footL.rotation.x = -0.5; this.footR.rotation.x = 0.3;
    } else if (moving) {
      this.footL.position.set(-0.11, lift(Math.cos(ph)), step * stride);
      this.footR.position.set(0.11, lift(-Math.cos(ph)), -step * stride);
      this.footL.rotation.x = -Math.cos(ph) * 0.5; this.footR.rotation.x = Math.cos(ph) * 0.5;
    } else {
      this.footL.position.set(-0.11, 0, 0.02); this.footR.position.set(0.11, 0, -0.02);
      this.footL.rotation.x = this.footR.rotation.x = 0;
    }
    if (this.land > 0) { this.footL.position.x = -0.14; this.footR.position.x = 0.14; }
    // ---- hands
    const hl = this.handL.position, hr = this.handR.position;
    const by = bob + 0.0;
    this.knife.visible = false;
    let headDown = 0;
    if (s.act === 'chop') {
      // raise the cleaver high, then slam it down: impact at the cycle wrap (matches the kitchen's hit clock)
      const u = (s.t * 4.5) % 1;
      const up = u < 0.72 ? Math.sin((u / 0.72) * Math.PI / 2) : 1 - (u - 0.72) / 0.28;
      const hit = u > 0.9 || u < 0.08 ? 1 : 0;
      hl.set(-0.15, 0.5 + hit * 0.01, 0.36);
      hr.set(0.2 + up * 0.12, 0.55 + up * 0.72, 0.32 - up * 0.06);
      this.knife.visible = true;
      this.knife.rotation.set(-0.2 - up * 1.3 + (1 - up) * 0.9, 0, 0);
      B.rotation.x = 0.28 + up * -0.1 + hit * 0.06;
      B.position.y = by - hit * 0.03;
      B.scale.set(1.0 + hit * 0.04, 1 - hit * 0.06, 1.0 + hit * 0.04);
      headDown = 0.25;
    } else if (s.act === 'wash') {
      const w = s.t * 11;
      hl.set(-0.13 + Math.sin(w) * 0.07, 0.42 + Math.abs(Math.cos(w)) * 0.03, 0.4 + Math.cos(w) * 0.06);
      hr.set(0.13 - Math.sin(w) * 0.07, 0.42 + Math.abs(Math.sin(w)) * 0.03, 0.4 - Math.cos(w) * 0.06);
      B.rotation.x = 0.32; B.rotation.z = Math.sin(w) * 0.04;
      headDown = 0.3;
    } else if (s.act === 'spray') {
      const j = Math.sin(s.t * 40) * 0.012;
      hl.set(-0.12, 0.5 + j, 0.4); hr.set(0.12, 0.5 - j, 0.38);
      B.rotation.x = -0.05; B.position.y = by + j;
    } else if (s.holding) {
      const c = moving ? Math.sin(ph * 2) * 0.02 : Math.sin(s.t * 2.2) * 0.008;
      hl.set(-0.2, 0.5 + c + by, 0.3); hr.set(0.2, 0.5 + c + by, 0.3);
    } else {
      // arms swing opposite to the legs
      const sw = moving ? step * 0.2 * Math.min(1, sp) : 0;
      hl.set(-0.3, 0.38 + by + (moving ? Math.max(0, -step) * 0.05 : Math.sin(s.t * 2.2) * 0.01), -sw);
      hr.set(0.3, 0.38 + by + (moving ? Math.max(0, step) * 0.05 : Math.sin(s.t * 2.2 + 1) * 0.01), sw);
    }
    if (air) {
      // arms fling up while rising, spread out while falling
      const up = vz > 0 ? 0.32 : 0.18;
      hl.y += up; hr.y += up; hl.x -= 0.06; hr.x += 0.06;
    }
    if (this.land > 0) { hl.y -= this.land * 0.08; hr.y -= this.land * 0.08; }
    this.holdAnchor.position.set(0, 0.52 + by, 0.38);
    // ---- head: lags the bob, looks at work, blinks
    this.head.rotation.x = headDown + (moving ? -stepAbs * 0.05 : 0);
    this.head.rotation.y = s.act ? 0 : Math.sin(s.t * 0.7 + this.phase * 0.01) * 0.12;
    this.blinkT -= dt;
    const blink = this.blinkT < 0.12 ? 0.1 : 1;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3.5;
    this.eyes.forEach((e) => { e.scale.y = blink; });
    if (this.chroma) this.shimmer(s.t);
  }

  /** Chroma outfits: colour that never sits still. */
  shimmer(t) {
    const { kind, mats } = this.chroma;
    mats.forEach((m, k) => {
      if (kind === 'neon' && k === 0) return; // the suit stays black, the trims glow
      const h = (t * 0.18 + k * 0.17) % 1;
      if (kind === 'prism') { m.color.setHSL(h, 0.8, 0.62); m.emissive.setHSL(h, 0.9, 0.18); }
      else if (kind === 'galaxy') m.emissive.setHSL((0.62 + Math.sin(t * 0.7 + k) * 0.12 + 1) % 1, 0.9, 0.22 + Math.sin(t * 2.3 + k) * 0.06);
      else if (kind === 'golden') { m.emissiveIntensity = 0.5 + Math.sin(t * 3 + k) * 0.35; }
      else if (kind === 'neon') m.emissive.setHSL(h, 1, 0.5), m.color.copy(m.emissive);
    });
  }
}
