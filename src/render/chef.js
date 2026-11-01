// Cook characters: rounded body, floating hands and feet, one of 9 outfits, and procedural
// animation (walk, carry, chop, wash, spray, jump, fall, knocked-out spin).
import * as THREE from 'three';
import { makeKnife } from './tools.js';
import { mat, part, sph, cyl, box, cone, tor, capsule } from './items.js';
import { shade } from './textures.js';
import { SKINS } from '../config.js';
import { rimLight } from './geo.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
  // ---- diamond-box exclusives
  diamond: { body: 0xd8f6ff, pants: 0x8ad0ec, chroma: 'diamond', hat: 'gem', gloves: 0xeafcff },
  aurora: { body: 0x16263a, pants: 0x0c1422, chroma: 'aurora', hat: 'chefC', cape: 0x3a2a8a, stripes: 0x5affb0 },
  inferno: { body: 0x1e1412, pants: 0x0e0a08, chroma: 'inferno', hat: 'flame', gloves: 0x2a1a14, stripes: 0xff6a1a },
};
export const OUTFIT_IDS = Object.keys(OUTFIT);

const IRIS = [0x5a3a1e, 0x3a6a2a, 0x2a5aa8, 0x3a2414, 0x1a4a8a, 0x6a2a8a, 0x2a6a1a, 0x1a3a8a, 0xd83a7a, 0x8a3a0a, 0xc81a1a, 0x2a1a0a, 0x6a4a0a, 0xffc83a, 0x3a8ad8, 0xff5ad8];
const geos = new Map();
const G = (k, make) => { if (!geos.has(k)) geos.set(k, make()); return geos.get(k); };
const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg);
/** torso radius at height h (the jacket's silhouette) */
const torsoR = (h) => { const t = Math.min(1, Math.max(0, (h - 0.16) / 0.52)); return 0.2 + 0.055 * Math.sin(Math.PI * Math.min(1, t * 1.25)) - 0.07 * Math.pow(t, 3); };
const torsoGeo = () => G('torso', () => { const pts = []; for (let i = 0; i <= 18; i++) { const h = 0.26 + i / 18 * 0.42; pts.push([torsoR(h), h]); } pts.push([0.09, 0.69], [0.0, 0.7]); pts.unshift([torsoR(0.26) + 0.006, 0.255]); return lathe(pts, 40); });
const trouserGeo = () => G('trousers', () => { const pts = [[0, 0.12], [0.12, 0.125], [0.18, 0.15]]; for (let i = 0; i <= 8; i++) { const h = 0.17 + i / 8 * 0.14; pts.push([torsoR(h) * 0.985, h]); } return lathe(pts, 36); });
const robeGeo = () => G('robe', () => lathe([[0, 0.1], [0.27, 0.1], [0.285, 0.13], [0.26, 0.24], [0.235, 0.4], [0.205, 0.56], [0.15, 0.66], [0.09, 0.69], [0, 0.7]], 40));
const collarGeo = () => G('collar', () => new THREE.CylinderGeometry(0.1, 0.118, 0.05, 28, 1, false));
const band = () => G('band', () => new THREE.CylinderGeometry(1, 1, 1, 40, 1, true));
const capeGeo = () => G('cape', () => { const g = new THREE.CylinderGeometry(0.17, 0.31, 0.52, 20, 6, true, Math.PI * 0.58, Math.PI * 0.84); g.translate(0, 0.4, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, p.getZ(i) * 1.12 - 0.02 + Math.sin(Math.atan2(p.getX(i), p.getZ(i)) * 9) * 0.008 * (0.65 - y)); } g.computeVertexNormals(); return g; });
const apronGeo = () => G('apron', () => { const g = new THREE.CylinderGeometry(1, 1, 0.34, 18, 4, true, -0.75, 1.5); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 0.4, r = torsoR(y) * 1.035 + (y < 0.3 ? (0.3 - y) * 0.15 : 0); p.setXYZ(i, p.getX(i) * r, y, p.getZ(i) * r); } g.computeVertexNormals(); return g; });
const hairGeo = () => G('hair', () => mergeGeometries([new THREE.SphereGeometry(0.2, 28, 8, 0, Math.PI * 2, 0, 0.9), new THREE.SphereGeometry(0.2, 28, 12, Math.PI * 0.86, Math.PI * 1.28, 0.9, 1.0)]).scale(1, 0.96, 0.98));
const browGeo = () => G('brow', () => { const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.03, -0.004, 0), new THREE.Vector3(0.0, 0.01, 0.006), new THREE.Vector3(0.03, 0.0, 0)); return new THREE.TubeGeometry(c, 8, 0.0085, 6); });
const smileGeo = () => G('smile', () => new THREE.TorusGeometry(0.038, 0.0075, 6, 16, Math.PI * 0.8).rotateZ(Math.PI * 1.1));
const shoeGeo = () => G('shoe', () => { const g = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55); g.scale(0.085, 0.085, 0.12); g.translate(0, 0.012, 0.015); return g; });
const rbox = () => G('rbox', () => new RoundedBoxGeometry(1, 1, 1, 3, 0.18));
const domeGeo = () => G('dome', () => new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2));
const peakGeo = () => G('peak', () => { const g = new THREE.CylinderGeometry(0.13, 0.13, 0.014, 24, 1, false, -Math.PI / 2, Math.PI); g.scale(1, 1, 0.75); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) - Math.pow(p.getX(i) / 0.13, 2) * 0.02); g.computeVertexNormals(); return g; });
const hoodGeo = () => G('hood', () => new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.4));
const maskGeo = () => G('mask', () => new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45));
let blushM = null;
const blushMat = () => blushM || (blushM = new THREE.MeshStandardMaterial({ color: 0xff6a7a, roughness: 0.8, transparent: true, opacity: 0.38, depthWrite: false }));

export class Chef {
  constructor({ outfit = 'chef', color = 0xe8553a, skin = 0, name = '' } = {}) {
    this.root = new THREE.Group();
    this.body = new THREE.Group(); // bobs / leans
    this.root.add(this.body);
    this.phase = Math.random() * 10;
    this.build(outfit, color, skin);
    // the cartoon finish: a soft rim of light round every soft surface
    this.root.traverse((m) => { if (m.isMesh && m.material && !m.material.metalness && !m.material.transparent) rimLight(m.material, 0.4); });
    this.name = name;
    // a proper cleaver: wide steel blade, bolster and wooden handle
    this.knife = makeKnife();
    this.knife.visible = false;
    this.knife.scale.setScalar(1.5);
    this.land = 0; this.prevZ = 0; this.prevAir = false; this.blinkT = 2 + Math.random() * 3;
    this.handR.add(this.knife);
    this.holdAnchor = new THREE.Group();
    this.holdAnchor.position.set(0, 0.5, 0.36);
    this.root.add(this.holdAnchor);
  }

  build(outfitId, color, skinIdx) {
    skinIdx = ((skinIdx | 0) % SKINS.length + SKINS.length) % SKINS.length;
    const O = OUTFIT[outfitId] || OUTFIT.chef;
    const body = this.body;
    this.chroma = null;
    let B = mat(O.body, { rough: O.metal ? 0.3 : 0.72, metal: O.metal ? 0.6 : 0, opacity: O.ghost ? 0.62 : undefined });
    if (O.chroma) {
      // chroma outfits own their materials: they shimmer and cycle colour every frame (see animate)
      B = O.chroma === 'diamond'
        ? new THREE.MeshPhysicalMaterial({ color: O.body, roughness: 0.12, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 1, iridescenceIOR: 1.8, emissive: 0x3a8aa8, emissiveIntensity: 0.3 })
        : new THREE.MeshStandardMaterial({ color: O.body, roughness: O.metal ? 0.22 : 0.4, metalness: O.metal ? 0.85 : 0.1, emissive: O.chroma === 'golden' ? 0x6a4000 : O.chroma === 'inferno' ? 0xff4a10 : 0x000000, emissiveIntensity: O.chroma === 'inferno' ? 0.25 : 1 });
      this.chroma = { kind: O.chroma, mats: [B] };
    }
    const SK = SKINS[skinIdx % SKINS.length] || SKINS[0];
    const skin = mat(SK.c, { rough: 0.55 });
    const acc = mat(color, { rough: 0.6 });
    const P = mat(O.pants, { rough: 0.8, opacity: O.ghost ? 0.62 : undefined });
    const puff = O.puffy ? 1.12 : 1;
    // ---- torso: a soft pear (lathe), jacket over trousers, so the cook reads as one rounded shape
    const R = torsoR, at = (h) => R(h) * puff;
    if (O.robe) body.add(part(robeGeo(), B, [0, 0, 0], [puff, 1, puff * 0.9]));
    else {
      body.add(part(torsoGeo(), B, [0, 0, 0], [puff, 1, puff * 0.9]));
      body.add(part(trouserGeo(), P, [0, 0, 0], [puff, 1, puff * 0.9]));
    }
    const ring = (h, m, k = 1.02, th = 0.04) => body.add(part(band(), m, [0, h, 0], [at(h) * k, th, at(h) * k * 0.9]));
    const stripeM = ['neon', 'aurora', 'inferno'].includes(O.chroma) ? new THREE.MeshStandardMaterial({ color: O.stripes, emissive: O.stripes, emissiveIntensity: 1.6 }) : O.stripes != null ? mat(O.stripes, { rough: 0.7 }) : null;
    if (stripeM && O.chroma) this.chroma.mats.push(stripeM);
    if (O.stripes != null) for (let i = 0; i < 3; i++) ring(0.36 + i * 0.09, stripeM, 1.015, 0.035);
    if (O.cape) body.add(part(capeGeo(), new THREE.MeshStandardMaterial({ color: O.cape, roughness: 0.75, side: THREE.DoubleSide }), [0, 0, 0], [puff, 1, puff]));
    if (O.spikes) for (let i = 0; i < 4; i++) body.add(part(cone(8), mat(O.spikes, { rough: 0.5 }), [0, 0.66 - i * 0.12, -at(0.66 - i * 0.12) * 0.9], [0.05, 0.1, 0.05], [-1.2, 0, 0]));
    // chef's jacket: double-breasted buttons and a stand collar
    const jacket = !O.robe && !O.metal && !O.puffy && !O.pack && !O.ghost;
    if (jacket) {
      const btn = mat(O.accentApron ? 0xf4f0e6 : shade(O.body, -0.35), { rough: 0.35 });
      const aproned = O.accentApron || O.apron != null;
      for (let i = 0; i < (aproned ? 1 : 3); i++) for (const s of [-1, 1]) {
        const h = 0.6 - i * 0.075, a = s * 0.42;
        body.add(part(sph(8), btn, [Math.sin(a) * at(h), h, Math.cos(a) * at(h) * 0.9 + 0.004], [0.016, 0.016, 0.01]));
      }
      body.add(part(collarGeo(), B, [0, 0.695, 0], [puff, 1, puff * 0.92]));
    }
    // apron: a curved panel hugging the front, with a waist tie and a bow at the back
    const apronC = O.accentApron ? null : O.apron;
    if (O.accentApron || apronC != null) {
      const am = O.accentApron ? acc : mat(apronC, { rough: 0.9 });
      body.add(part(apronGeo(), am, [0, 0, 0], [puff, 1, puff * 0.9]));
      ring(0.42, am, 1.045, 0.028);
      body.add(part(sph(10), am, [0, 0.42, -at(0.42) * 0.95], [0.05, 0.035, 0.03]));
      for (const s of [-1, 1]) body.add(part(sph(10), am, [s * 0.05, 0.42, -at(0.42) * 0.97], [0.045, 0.03, 0.02], [0, 0, s * 0.6]));
    }
    if (O.belt) {
      ring(0.3, mat(O.belt, { rough: 0.6 }), 1.03, 0.05);
      body.add(part(box(), mat(0xe8c040, { metal: 0.8, rough: 0.3 }), [0, 0.3, at(0.3) * 0.94], [0.07, 0.055, 0.02]));
    }
    // neckerchief in the player colour for every non-chef outfit (a knotted scarf with a little flap)
    if (!O.accentApron) {
      body.add(part(tor(), acc, [0, 0.665, 0], [0.135, 0.125, 0.28], [Math.PI / 2, 0, 0]));
      body.add(part(sph(10), acc, [0.03, 0.64, 0.12], [0.04, 0.035, 0.03]));
      body.add(part(cone(4), acc, [0.04, 0.58, 0.13], [0.05, 0.09, 0.015], [0.2, 0, 0.25]));
    }
    if (O.fur) body.add(part(tor(), mat(O.fur, { rough: 1 }), [0, 0.27, 0], [at(0.27) * 1.02, at(0.27) * 0.92, 0.3], [Math.PI / 2, 0, 0]));
    if (O.pack) {
      body.add(part(rbox(), mat(0xd8dde6, { rough: 0.4 }), [0, 0.45, -0.27], [0.3, 0.32, 0.12]));
      body.add(part(cyl(), mat(color, { emissive: color, ei: 0.6 }), [0.08, 0.5, -0.34], [0.03, 0.06, 0.03], [Math.PI / 2, 0, 0]));
    }
    if (outfitId === 'heatsuit') ring(0.42, mat(0xffb020, { emissive: 0xff8000, ei: 0.3 }), 1.02, 0.04);
    // ---- head
    const head = new THREE.Group();
    head.position.set(0, 0.8, 0);
    body.add(head);
    this.head = head;
    const hairM = mat(SK.hair, { rough: 0.7 });
    head.add(part(sph(32), skin, [0, 0, 0], [0.2, 0.19, 0.19]));
    const face = this.face = new THREE.Group();
    head.add(face);
    this.mouthOff = false;
    // chubby cheeks + chin give the face its shape; ears; a button nose
    for (const s of [-1, 1]) {
      face.add(part(sph(16), skin, [s * 0.07, -0.05, 0.085], [0.09, 0.08, 0.09]));
      face.add(part(sph(12), skin, [s * 0.2, 0.0, 0.0], [0.035, 0.05, 0.03]));
      face.add(part(sph(12), mat(shade(SK.c, -0.18), { rough: 0.6 }), [s * 0.215, 0.0, 0.006], [0.018, 0.03, 0.014]));
      // blush
      face.add(part(sph(12), blushMat(), [s * 0.112, -0.05, 0.172], [0.034, 0.02, 0.012], [0, s * 0.55, 0]));
    }
    face.add(part(sph(14), mat(shade(SK.c, -0.08), { rough: 0.45 }), [0, -0.02, 0.195], [0.032, 0.028, 0.03]));
    // hair: a short back-and-sides cut peeking from under every hat
    if (!O.ghost && !['robo', 'knight', 'ninja', 'spacesuit', 'heatsuit'].includes(O.hat || outfitId)) {
      head.add(part(hairGeo(), hairM, [0, 0, 0], [1.04, 1.04, 1.04]));
      for (const s of [-1, 1]) head.add(part(sph(12), hairM, [s * 0.178, 0.02, 0.07], [0.03, 0.06, 0.04], [0.3, 0, s * 0.2]));
    }
    // eyes: white, coloured iris, pupil and a catch-light, set in shallow sockets
    const eyeW = mat(0xffffff, { rough: 0.25 }), irisM = mat(IRIS[skinIdx % IRIS.length], { rough: 0.3 }), eyeB = mat(0x14121a, { rough: 0.2 });
    const glint = mat(0xffffff, { emissive: 0xffffff, ei: 0.8 });
    this.eyes = []; this.brows = [];
    for (const s of [-1, 1]) {
      const eg = new THREE.Group(); eg.position.set(s * 0.068, 0.025, 0.166);
      eg.rotation.y = s * 0.28;
      eg.add(part(sph(16), eyeW, [0, 0, 0], [0.042, 0.054, 0.03]));
      eg.add(part(sph(14), irisM, [0, -0.004, 0.022], [0.028, 0.034, 0.014]));
      eg.add(part(sph(12), eyeB, [0, -0.004, 0.031], [0.015, 0.019, 0.008]));
      eg.add(part(sph(8), glint, [0.009, 0.009, 0.037], [0.007, 0.008, 0.004]));
      face.add(eg); this.eyes.push(eg);
      const brow = part(browGeo(), hairM, [s * 0.07, 0.092, 0.168], [s, 1, 1], [0.2, 0, 0]);
      face.add(brow); this.brows.push(brow);
    }
    // mouth: a smile curve, swapped for an open "O" when shocked or straining
    this.smile = part(smileGeo(), mat(0x5a1a1e, { rough: 0.5 }), [0, -0.085, 0.176], 1, [0.35, 0, 0]);
    this.oMouth = new THREE.Group();
    this.oMouth.add(part(sph(14), mat(0x4a0e14, { rough: 0.6 }), [0, 0, 0], [0.028, 0.032, 0.02]));
    this.oMouth.add(part(sph(10), mat(0xe86a7a, { rough: 0.5 }), [0, -0.016, 0.006], [0.018, 0.01, 0.012]));
    this.oMouth.position.set(0, -0.092, 0.172); this.oMouth.rotation.x = 0.3; this.oMouth.visible = false;
    face.add(this.smile, this.oMouth);
    this.buildHat(outfitId, head, color, O);
    // ---- hands (mittens with a thumb and a sleeve cuff) and shoes
    const handM = O.gloves != null ? mat(O.gloves, { metal: O.metal ? 0.7 : 0, rough: 0.5 }) : O.ghost ? B : outfitId === 'heatsuit' || outfitId === 'spacesuit' || outfitId === 'welder' ? mat(outfitId === 'welder' ? 0x8a5a2a : 0xe8e8ee, { rough: 0.6 }) : outfitId === 'parka' ? mat(color, { rough: 0.8 }) : skin;
    const mkHand = (s) => {
      const h = new THREE.Group();
      h.add(part(sph(16), handM, [0, 0, 0], [0.068, 0.06, 0.074]));
      h.add(part(sph(10), handM, [-s * 0.052, 0.022, 0.03], [0.026, 0.024, 0.032], [0, 0, -s * 0.5]));
      if (!O.ghost) h.add(part(tor(), O.chroma ? B : mat(O.body, { rough: 0.7, metal: O.metal ? 0.6 : 0 }), [0, 0, -0.05], [0.058, 0.058, 0.12]));
      return h;
    };
    this.handL = mkHand(-1); this.handR = mkHand(1);
    this.root.add(this.handL, this.handR);
    const shoeM = O.ghost ? B : mat(O.metal ? shade(O.pants, -0.2) : 0x2a2226, { rough: O.metal ? 0.35 : 0.5, metal: O.metal ? 0.6 : 0 });
    const mkFoot = () => {
      const f = new THREE.Group();
      f.add(part(shoeGeo(), shoeM));
      if (!O.ghost) f.add(part(cyl(16), mat(0xf2ece4, { rough: 0.8 }), [0, 0.012, 0.012], [0.084, 0.012, 0.118]));
      return f;
    };
    this.footL = mkFoot(); this.footR = mkFoot();
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
      case 'gem': {
        // a cut diamond floating over a crystal circlet
        const m = new THREE.MeshPhysicalMaterial({ color: 0xeafcff, roughness: 0.04, metalness: 0.1, clearcoat: 1, iridescence: 1, iridescenceIOR: 2, emissive: 0x7ae8ff, emissiveIntensity: 0.5, flatShading: true });
        this.chroma.mats.push(m);
        add(new THREE.OctahedronGeometry(1, 0), m, [0, 0.36, 0], [0.09, 0.13, 0.09]);
        add(new THREE.TorusGeometry(1, 0.12, 6, 12), m, [0, 0.13, 0], [0.19, 0.19, 0.19], [Math.PI / 2, 0, 0]);
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(new THREE.OctahedronGeometry(1, 0), m, [Math.cos(a) * 0.19, 0.17, Math.sin(a) * 0.19], [0.025, 0.045, 0.025]); }
        this.gem = head.children[head.children.length - 8];
        break;
      }
      case 'flame': {
        // hair of living fire
        const fm = [0xffd23a, 0xff8a1a, 0xff4a10].map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.4, transparent: true, opacity: 0.92 }));
        this.flames = [];
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2, r = i ? 0.12 : 0;
          const f = part(cone(10), fm[i % 3], [Math.cos(a) * r, 0.22 + (i ? 0 : 0.04), Math.sin(a) * r - 0.02], [0.06, i ? 0.18 : 0.24, 0.06], [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3]);
          head.add(f); this.flames.push(f);
        }
        break;
      }
      case 'toque':
        add(cyl(20), W, [0, 0.17, 0], [0.165, 0.1, 0.165]);
        add(sph(14), W, [0, 0.25, 0], [0.18, 0.08, 0.18]);
        break;
      case 'cap': {
        const C = O.chroma === 'neon' ? new THREE.MeshStandardMaterial({ color: 0x00ffd0, emissive: 0x00ffd0, emissiveIntensity: 1.4 }) : mat(O.hatC, { rough: 0.6 });
        if (O.chroma) this.chroma.mats.push(C);
        // baseball cap: a soft crown, a curved peak, a button on top
        add(domeGeo(), C, [0, 0.06, -0.005], [0.212, 0.19, 0.205]);
        add(peakGeo(), C, [0, 0.085, 0.16], 1, [-0.12, 0, 0]);
        add(sph(8), C, [0, 0.25, -0.005], [0.022, 0.012, 0.022]);
        if (!O.chroma) add(band(), mat(color), [0, 0.075, -0.005], [0.214, 0.03, 0.207]);
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
        // hood over the crown, a mask over nose and mouth: only the eyes show
        add(hoodGeo(), mat(0x1c1c24, { rough: 0.75 }), [0, 0, 0], [0.222, 0.212, 0.222]);
        add(maskGeo(), mat(0x24242e, { rough: 0.75 }), [0, 0, 0], [0.232, 0.222, 0.232]);
        add(band(), mat(color, { rough: 0.6 }), [0, 0.1, 0], [0.205, 0.035, 0.205]);
        for (const k of [0, 1]) add(rbox(), mat(color, { rough: 0.6 }), [-0.03 + k * 0.05, 0.08 - k * 0.02, -0.25 - k * 0.03], [0.035, 0.022, 0.14], [0.5 + k * 0.3, 0.3 - k * 0.6, 0]);
        this.face.visible = true; this.mouthOff = true;
        break;
      case 'viking': {
        const steel = mat(0x9aa2aa, { metal: 0.8, rough: 0.3 });
        add(sph(20), steel, [0, 0.07, -0.01], [0.22, 0.18, 0.21]);
        add(cyl(20), mat(0x6a4a2a), [0, 0.04, 0], [0.225, 0.04, 0.215]);
        for (const sx of [-1, 1]) add(cone(10), mat(0xf4ecd8, { rough: 0.5 }), [sx * 0.24, 0.17, 0], [0.05, 0.2, 0.05], [0, 0, -sx * 0.9]);
        // braided beard and a big moustache
        const beard = mat(0xd88a3a, { rough: 0.9 });
        add(sph(16), beard, [0, -0.17, 0.12], [0.13, 0.1, 0.08]);
        for (const sx of [-1, 1]) { add(sph(12), beard, [sx * 0.05, -0.085, 0.175], [0.06, 0.025, 0.03], [0, sx * 0.4, -sx * 0.35]); add(capsule(), beard, [sx * 0.06, -0.27, 0.12], [0.03, 0.06, 0.03]); }
        this.mouthOff = true;
        break;
      }
      case 'knight': {
        this.face.visible = false;
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
        this.face.visible = false;
        const steel = mat(0xa8b4c0, { metal: 0.85, rough: 0.25 });
        add(box(), steel, [0, 0.02, 0], [0.4, 0.36, 0.36]);
        add(box(), new THREE.MeshStandardMaterial({ color: 0x0a1a2a, emissive: 0x1a6a8a, emissiveIntensity: 0.6 }), [0, 0.04, 0.18], [0.3, 0.1, 0.02]);
        for (const sx of [-1, 1]) add(sph(10), new THREE.MeshStandardMaterial({ color: 0xaaf6ff, emissive: 0x2ad8ff, emissiveIntensity: 1.6 }), [sx * 0.07, 0.045, 0.19], [0.03, 0.03, 0.01]);
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
   * s = { speed, z, act, holding, shock, dt, t }
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
    // point each mitten (and its sleeve cuff) away from the shoulder it hangs from
    for (const [h, sd] of [[this.handL, -1], [this.handR, 1]]) {
      if (sd > 0 && s.act === 'chop') { h.rotation.set(0, 0, 0); continue; }
      const dx = h.position.x - sd * 0.17, dy = h.position.y - (0.58 + by), dz = h.position.z;
      h.rotation.set(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0, 'YXZ');
    }
    // face: brows knit while working, shoot up in the air; the mouth pops open when startled
    const shock = air || s.shock;
    const work = s.act === 'chop' || s.act === 'wash' || s.act === 'spray';
    this.brows.forEach((b, i) => {
      const sd = i ? 1 : -1;
      b.rotation.z += ((work ? sd * 0.28 : shock ? -sd * 0.15 : 0) - b.rotation.z) * Math.min(1, dt * 12);
      b.position.y += ((shock ? 0.108 : work ? 0.084 : 0.092) - b.position.y) * Math.min(1, dt * 12);
    });
    this.smile.visible = !shock && !this.mouthOff;
    this.oMouth.visible = shock && !this.mouthOff;
    this.smile.scale.x = work ? 0.7 : 1;
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
    if (this.gem) { this.gem.rotation.y = t * 1.4; this.gem.position.y = 0.36 + Math.sin(t * 2.2) * 0.02; }
    if (this.flames) this.flames.forEach((f, i) => { f.scale.y = (i ? 0.18 : 0.24) * (0.85 + 0.25 * Math.abs(Math.sin(t * 9 + i * 1.9))); });
    mats.forEach((m, k) => {
      if (kind === 'neon' && k === 0) return; // the suit stays black, the trims glow
      const h = (t * 0.18 + k * 0.17) % 1;
      if (kind === 'prism') { m.color.setHSL(h, 0.8, 0.62); m.emissive.setHSL(h, 0.9, 0.18); }
      else if (kind === 'galaxy') m.emissive.setHSL((0.62 + Math.sin(t * 0.7 + k) * 0.12 + 1) % 1, 0.9, 0.22 + Math.sin(t * 2.3 + k) * 0.06);
      else if (kind === 'golden') { m.emissiveIntensity = 0.5 + Math.sin(t * 3 + k) * 0.35; }
      else if (kind === 'neon') m.emissive.setHSL(h, 1, 0.5), m.color.copy(m.emissive);
      else if (kind === 'diamond') { m.emissiveIntensity = 0.25 + Math.pow(Math.max(0, Math.sin(t * 5.3 + k * 2.1)), 12) * 1.6; }
      else if (kind === 'aurora') { const q = 0.5 + 0.5 * Math.sin(t * 0.9 + k * 1.3); m.emissive.setHSL(0.38 + q * 0.42, 0.9, 0.2 + 0.1 * Math.sin(t * 2.1 + k)); if (k) m.color.copy(m.emissive); }
      else if (kind === 'inferno') { m.emissiveIntensity = (k ? 1.2 : 0.25) + Math.abs(Math.sin(t * 7 + k * 1.7)) * (k ? 0.8 : 0.3); }
    });
  }
}
