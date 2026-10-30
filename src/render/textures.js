// Procedural canvas textures (no image assets to load): floors, walls, counter tops, labels.
import * as THREE from 'three';
import { rng } from '../rng.js';

const cache = new Map();
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const shade = (c, f) => {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  const k = (v) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return (k(r) << 16) | (k(g) << 8) | k(b);
};
export { hex, shade };

function canvasTex(key, size, draw, { repeat = 1, srgb = true } = {}) {
  const k = key + ':' + repeat;
  if (cache.has(k)) return cache.get(k);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size, rng(key.split('').reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7) >>> 0));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  cache.set(k, t);
  return t;
}

const noise = (g, s, r, alpha, n = 900) => {
  for (let i = 0; i < n; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${alpha * r()})` : `rgba(255,255,255,${alpha * r()})`;
    g.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 2);
  }
};

/** Floor textures, one tile = one texture repeat. */
export function floorTex(kind) {
  return canvasTex('floor-' + kind, 256, (g, s, r) => {
    const P = {
      planks: [0xb07a45, 0x8a5a30], treeplanks: [0x9c6a3a, 0x3a2412], ice: [0xd6f1fb, 0x9fd3ec], basalt: [0x3a3330, 0x251f1d], metalgrid: [0x8b96a6, 0x5c6676],
      cloudtile: [0xf4f1ff, 0xd8d2f2], bamboo: [0xc9a85a, 0x9b7c38], steelplate: [0x7c848c, 0x5a6168], parquet: [0x8a5a3a, 0x5e3a24], clockfloor: [0x6a4026, 0x3a2414],
    }[kind] || [0xcccccc, 0x999999];
    g.fillStyle = hex(P[0]); g.fillRect(0, 0, s, s);
    if (kind === 'treeplanks') {
      // rough-sawn boards running front to back, dark gaps between, a nail at each end
      for (let i = 0; i < 5; i++) {
        const x = i * 51.2;
        g.fillStyle = hex(shade(P[0], (r() - 0.5) * 0.28)); g.fillRect(x, 0, 51.2, s);
        g.strokeStyle = 'rgba(50,25,8,0.3)'; g.lineWidth = 1;
        for (let k = 0; k < 5; k++) { g.beginPath(); const xx = x + 6 + r() * 40; g.moveTo(xx, 0); g.bezierCurveTo(xx + r() * 8 - 4, 90, xx + r() * 8 - 4, 170, xx, s); g.stroke(); }
        g.fillStyle = 'rgba(40,20,6,0.55)'; g.beginPath(); g.ellipse(x + 10 + r() * 30, r() * s, 4, 7, 0, 0, 7); g.fill();
        g.fillStyle = hex(P[1]); g.fillRect(x, 0, 4, s);
        g.fillStyle = '#2a2a2a'; for (const y of [14, s - 14]) for (const dx of [12, 39]) { g.beginPath(); g.arc(x + dx, y, 2.5, 0, 7); g.fill(); }
      }
    } else if (kind === 'planks') {
      for (let i = 0; i < 4; i++) {
        g.fillStyle = hex(shade(P[0], (r() - 0.5) * 0.18)); g.fillRect(0, i * 64, s, 64);
        g.strokeStyle = 'rgba(60,30,10,0.25)'; g.lineWidth = 1;
        for (let k = 0; k < 6; k++) { g.beginPath(); const y = i * 64 + 8 + r() * 48; g.moveTo(0, y); g.bezierCurveTo(80, y + r() * 8 - 4, 170, y + r() * 8 - 4, s, y); g.stroke(); }
        g.fillStyle = hex(P[1]); g.fillRect(0, i * 64, s, 3);
        g.fillStyle = 'rgba(40,25,10,0.7)'; const nx = (i % 2) * 128 + 30; g.beginPath(); g.arc(nx, i * 64 + 32, 3, 0, 7); g.arc(nx + 190 > s ? nx - 20 : nx + 190, i * 64 + 32, 3, 0, 7); g.fill();
      }
    } else if (kind === 'ice') {
      const grd = g.createLinearGradient(0, 0, s, s); grd.addColorStop(0, '#e6f8ff'); grd.addColorStop(1, '#b8e2f4'); g.fillStyle = grd; g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
      for (let i = 0; i < 6; i++) { g.beginPath(); let x = r() * s, y = r() * s; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 90; y += (r() - 0.5) * 90; g.lineTo(x, y); } g.stroke(); }
      g.strokeStyle = 'rgba(90,160,200,0.35)'; g.lineWidth = 3; g.strokeRect(1, 1, s - 2, s - 2);
    } else if (kind === 'basalt') {
      for (let i = 0; i < 9; i++) {
        const cx = (i % 3) * 86 + 43 + (r() - 0.5) * 20, cy = Math.floor(i / 3) * 86 + 43 + (r() - 0.5) * 20;
        g.fillStyle = hex(shade(P[0], (r() - 0.5) * 0.25));
        g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.lineTo(cx + Math.cos(a) * 46, cy + Math.sin(a) * 46); } g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,90,20,0.55)'; g.lineWidth = 2; g.stroke();
      }
    } else if (kind === 'metalgrid' || kind === 'steelplate') {
      g.fillStyle = hex(P[0]); g.fillRect(0, 0, s, s);
      g.strokeStyle = hex(P[1]); g.lineWidth = 4; g.strokeRect(2, 2, s - 4, s - 4);
      if (kind === 'metalgrid') {
        g.strokeStyle = 'rgba(30,40,60,0.5)'; g.lineWidth = 3;
        for (let i = 24; i < s; i += 26) { g.beginPath(); g.moveTo(i, 10); g.lineTo(i, s - 10); g.stroke(); }
        g.fillStyle = '#4ad8ff'; g.fillRect(s / 2 - 30, s - 14, 60, 4);
      } else {
        g.strokeStyle = 'rgba(40,40,40,0.35)'; g.lineWidth = 3;
        for (let y = 20; y < s; y += 36) for (let x = 14 + ((y / 36) % 2) * 18; x < s; x += 36) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 12, y + 12); g.stroke(); }
      }
      g.fillStyle = '#c8d0d8'; for (const [x, y] of [[12, 12], [s - 12, 12], [12, s - 12], [s - 12, s - 12]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
    } else if (kind === 'cloudtile') {
      g.fillStyle = '#f7f4ff'; g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(200,170,90,0.8)'; g.lineWidth = 3; g.strokeRect(6, 6, s - 12, s - 12);
      g.strokeStyle = 'rgba(180,170,220,0.4)'; g.lineWidth = 2;
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(r() * s, r() * s); g.bezierCurveTo(r() * s, r() * s, r() * s, r() * s, r() * s, r() * s); g.stroke(); }
      g.fillStyle = 'rgba(210,180,90,0.9)'; g.beginPath(); g.arc(s / 2, s / 2, 9, 0, 7); g.fill();
    } else if (kind === 'bamboo') {
      for (let i = 0; i < 8; i++) {
        const x = i * 32;
        const grd = g.createLinearGradient(x, 0, x + 32, 0);
        grd.addColorStop(0, hex(shade(P[0], -0.2))); grd.addColorStop(0.5, hex(shade(P[0], 0.15))); grd.addColorStop(1, hex(shade(P[0], -0.25)));
        g.fillStyle = grd; g.fillRect(x, 0, 32, s);
        g.fillStyle = 'rgba(90,60,20,0.6)'; const ny = (i * 53) % 128; g.fillRect(x, ny, 32, 4); g.fillRect(x, ny + 128, 32, 4);
      }
    } else if (kind === 'clockfloor') {
      // dark walnut boards with an inlaid brass dial on every tile
      for (let i = 0; i < 4; i++) { g.fillStyle = hex(shade(P[0], (r() - 0.5) * 0.2)); g.fillRect(0, i * 64, s, 63); g.fillStyle = hex(P[1]); g.fillRect(0, i * 64 + 62, s, 2); }
      const m = s / 2;
      g.strokeStyle = '#d8a84a'; g.lineWidth = 7; g.beginPath(); g.arc(m, m, 92, 0, 7); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.arc(m, m, 78, 0, 7); g.stroke();
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2, l = k % 3 ? 8 : 16; g.lineWidth = k % 3 ? 3 : 5; g.beginPath(); g.moveTo(m + Math.cos(a) * (76 - l), m + Math.sin(a) * (76 - l)); g.lineTo(m + Math.cos(a) * 76, m + Math.sin(a) * 76); g.stroke(); }
      g.fillStyle = '#d8a84a'; g.beginPath(); g.arc(m, m, 8, 0, 7); g.fill();
      g.strokeStyle = 'rgba(216,168,74,0.6)'; g.lineWidth = 3; g.strokeRect(3, 3, s - 6, s - 6);
    } else if (kind === 'parquet') {
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const vert = (x + y) % 2;
        for (let k = 0; k < 4; k++) {
          g.fillStyle = hex(shade(P[0], (r() - 0.5) * 0.25));
          if (vert) g.fillRect(x * 64 + k * 16, y * 64, 15, 63); else g.fillRect(x * 64, y * 64 + k * 16, 63, 15);
        }
      }
    }
    noise(g, s, r, 0.12);
  });
}

export function wallTex(kind) {
  return canvasTex('wall-' + kind, 256, (g, s, r) => {
    const P = {
      hull: [0x6b4424, 0x4a2c16], snowbrick: [0xeef6fb, 0xb9d3e3], obsidian: [0x241a26, 0x0f0a10], hullpanel: [0xd6dde6, 0x8d99a8],
      marble: [0xf6f2ea, 0xd8cfc0], trunk: [0x6a4a2a, 0x4a3018], logs: [0x7a5230, 0x3a2412], brickfactory: [0x8a4a3a, 0x5a2e24], bookshelf: [0x4a2a1a, 0x2a160c], clockwall: [0x4a2a18, 0x2a160c],
    }[kind] || [0x888888, 0x555555];
    g.fillStyle = hex(P[0]); g.fillRect(0, 0, s, s);
    if (kind === 'snowbrick' || kind === 'brickfactory') {
      for (let y = 0; y < 8; y++) for (let x = -1; x < 4; x++) {
        g.fillStyle = hex(shade(P[0], (r() - 0.5) * 0.18));
        g.fillRect(x * 64 + (y % 2) * 32 + 2, y * 32 + 2, 60, 28);
      }
    } else if (kind === 'clockwall') {
      // walnut panelling with brass gears set into it and a little dial in the top panel
      for (const [x, y, w, h] of [[8, 8, s - 16, s / 2 - 12], [8, s / 2 + 4, s - 16, s / 2 - 12]]) {
        g.fillStyle = hex(shade(P[0], 0.12)); g.fillRect(x, y, w, h);
        g.strokeStyle = hex(P[1]); g.lineWidth = 5; g.strokeRect(x, y, w, h);
      }
      const gear = (cx, cy, R, n) => {
        g.fillStyle = '#c8964a'; g.beginPath();
        for (let k = 0; k < n * 2; k++) { const a = (k / (n * 2)) * Math.PI * 2, rr = k % 2 ? R : R * 0.82; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        g.fill(); g.fillStyle = hex(P[1]); g.beginPath(); g.arc(cx, cy, R * 0.32, 0, 7); g.fill();
      };
      gear(70, 190, 44, 10); gear(140, 205, 28, 8); gear(196, 182, 36, 9);
      g.fillStyle = '#f4e6c0'; g.beginPath(); g.arc(s / 2, 64, 36, 0, 7); g.fill();
      g.strokeStyle = '#c8964a'; g.lineWidth = 5; g.stroke();
      g.strokeStyle = '#2a1a0a'; g.lineWidth = 3; g.beginPath(); g.moveTo(s / 2, 64); g.lineTo(s / 2, 40); g.moveTo(s / 2, 64); g.lineTo(s / 2 + 18, 70); g.stroke();
    } else if (kind === 'bookshelf') {
      for (let row = 0; row < 4; row++) {
        g.fillStyle = hex(P[1]); g.fillRect(0, row * 64 + 56, s, 8);
        let x = 4;
        while (x < s - 8) {
          const w = 8 + r() * 14, h = 34 + r() * 18;
          g.fillStyle = hex([0x8a2a2a, 0x2a4a8a, 0x2a6a3a, 0x8a6a2a, 0x5a2a6a, 0x1a1a3a][Math.floor(r() * 6)]);
          g.fillRect(x, row * 64 + 56 - h, w, h);
          g.fillStyle = 'rgba(255,215,120,0.7)'; g.fillRect(x + 1, row * 64 + 56 - h + 6, w - 2, 2);
          x += w + 1;
        }
      }
    } else if (kind === 'hull' || kind === 'trunk') {
      for (let i = 0; i < 8; i++) { g.fillStyle = hex(shade(P[0], (r() - 0.5) * 0.2)); g.fillRect(0, i * 32, s, 30); }
      g.strokeStyle = 'rgba(0,0,0,0.3)'; for (let i = 0; i < 30; i++) { g.beginPath(); const y = r() * s; g.moveTo(0, y); g.lineTo(s, y + (r() - 0.5) * 10); g.stroke(); }
    } else if (kind === 'logs') {
      // log-cabin wall: stacked round logs, each shaded as a cylinder, with chinking between
      g.fillStyle = '#c8b58a'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 6; i++) {
        const y = i * (s / 6), h = s / 6 - 3;
        const c = shade(P[0], (r() - 0.5) * 0.2);
        const grd = g.createLinearGradient(0, y, 0, y + h);
        grd.addColorStop(0, hex(shade(c, -0.45))); grd.addColorStop(0.35, hex(shade(c, 0.12))); grd.addColorStop(1, hex(shade(c, -0.55)));
        g.fillStyle = grd; g.beginPath(); g.roundRect(0, y + 1.5, s, h, h / 2); g.fill();
        g.strokeStyle = 'rgba(30,15,5,0.35)'; g.lineWidth = 1;
        for (let k = 0; k < 6; k++) { g.beginPath(); const yy = y + 4 + r() * (h - 8); g.moveTo(0, yy); g.bezierCurveTo(80, yy + r() * 4 - 2, 170, yy + r() * 4 - 2, s, yy); g.stroke(); }
      }
    } else if (kind === 'hullpanel') {
      g.strokeStyle = hex(P[1]); g.lineWidth = 4; g.strokeRect(4, 4, s - 8, s / 2 - 8); g.strokeRect(4, s / 2 + 4, s - 8, s / 2 - 8);
      g.fillStyle = '#2ad0ff'; g.fillRect(20, s / 2 - 2, s - 40, 4);
    } else if (kind === 'obsidian') {
      for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(255,${80 + r() * 80},20,${0.3 + r() * 0.5})`; g.lineWidth = 1 + r() * 2; g.beginPath(); let x = r() * s, y = r() * s; g.moveTo(x, y); for (let k = 0; k < 3; k++) { x += (r() - 0.5) * 80; y += r() * 60; g.lineTo(x, y); } g.stroke(); }
    } else if (kind === 'marble') {
      g.strokeStyle = 'rgba(160,150,140,0.35)';
      for (let i = 0; i < 10; i++) { g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(r() * s, 0); g.bezierCurveTo(r() * s, s / 3, r() * s, s * 2 / 3, r() * s, s); g.stroke(); }
      g.fillStyle = 'rgba(200,170,90,0.9)'; g.fillRect(0, 0, s, 8); g.fillRect(0, s - 8, s, 8);
    }
    noise(g, s, r, 0.1);
  });
}

/** Counter top texture per world style. */
export function topTex(style) {
  return canvasTex('top-' + style, 128, (g, s, r) => {
    const base = { wood: 0xc08a52, ice: 0xdaf2fb, stone: 0x3b3537, panel: 0xe8eef4, marble: 0xfaf6ee, bamboo: 0xd8b46a, steel: 0xaab2ba, darkwood: 0x6a3e26, brass: 0xc89a52 }[style] || 0xcccccc;
    g.fillStyle = hex(base); g.fillRect(0, 0, s, s);
    if (style === 'wood' || style === 'darkwood' || style === 'bamboo') {
      g.strokeStyle = `rgba(60,30,10,${style === 'darkwood' ? 0.4 : 0.22})`;
      for (let i = 0; i < 14; i++) { g.beginPath(); const y = r() * s; g.moveTo(0, y); g.bezierCurveTo(40, y + 4, 90, y - 4, s, y); g.stroke(); }
    } else if (style === 'marble' || style === 'ice') {
      g.strokeStyle = style === 'ice' ? 'rgba(255,255,255,0.9)' : 'rgba(150,140,130,0.35)';
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(r() * s, 0); g.bezierCurveTo(r() * s, 40, r() * s, 90, r() * s, s); g.stroke(); }
    } else if (style === 'brass') {
      const grd = g.createLinearGradient(0, 0, s, s); grd.addColorStop(0, 'rgba(255,240,200,0.45)'); grd.addColorStop(0.5, 'rgba(255,255,255,0)'); grd.addColorStop(1, 'rgba(255,230,180,0.3)');
      g.fillStyle = grd; g.fillRect(0, 0, s, s);
      g.fillStyle = '#7a5420'; for (const [x, y] of [[8, 8], [s - 8, 8], [8, s - 8], [s - 8, s - 8]]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    } else if (style === 'steel' || style === 'panel') {
      const grd = g.createLinearGradient(0, 0, s, s); grd.addColorStop(0, 'rgba(255,255,255,0.35)'); grd.addColorStop(0.5, 'rgba(255,255,255,0)'); grd.addColorStop(1, 'rgba(255,255,255,0.25)');
      g.fillStyle = grd; g.fillRect(0, 0, s, s);
    } else if (style === 'stone') {
      // polished basalt slab: mottled grain, pale flecks and a hairline lava vein or two
      for (let i = 0; i < 220; i++) { const l = r(); g.fillStyle = l < 0.5 ? `rgba(0,0,0,${0.1 + r() * 0.2})` : `rgba(160,150,150,${0.06 + r() * 0.12})`; g.beginPath(); g.arc(r() * s, r() * s, 0.6 + r() * 2.6, 0, 7); g.fill(); }
      for (let v = 0; v < 1; v++) {
        let x = s * (0.25 + r() * 0.5), y = 0;
        g.lineWidth = 1 + r() * 0.6; g.strokeStyle = 'rgba(255,110,30,0.5)'; g.shadowColor = '#ff5a00'; g.shadowBlur = 4;
        g.beginPath(); g.moveTo(x, y);
        while (y < s) { x += (r() - 0.5) * 22; y += 6 + r() * 12; g.lineTo(x, y); }
        g.stroke(); g.shadowBlur = 0;
      }
      const sh = g.createLinearGradient(0, 0, s, s); sh.addColorStop(0, 'rgba(255,255,255,0.08)'); sh.addColorStop(0.6, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(0, 0, s, s);
    }
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 3; g.strokeRect(1, 1, s - 2, s - 2);
    noise(g, s, r, 0.08, 300);
  });
}

/** Hazard warning stripes (yellow/black) for telegraphs. */
export function stripeTex(c1 = '#ffd23a', c2 = '#1a1a1a') {
  return canvasTex('stripes' + c1 + c2, 64, (g, s) => {
    g.fillStyle = c1; g.fillRect(0, 0, s, s);
    g.fillStyle = c2;
    for (let i = -s; i < s * 2; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 8, 0); g.lineTo(i + 8 - s, s); g.lineTo(i - s, s); g.fill(); }
  });
}

/** Belt surface texture (scrolled by offsetting .offset.x). */
export function beltTex() {
  return canvasTex('belt', 64, (g, s) => {
    g.fillStyle = '#2a2d31'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#3c4046'; for (let i = 0; i < s; i += 16) g.fillRect(i, 0, 8, s);
    g.fillStyle = '#ffcf3a'; g.beginPath(); g.moveTo(s * 0.35, s * 0.3); g.lineTo(s * 0.65, s * 0.5); g.lineTo(s * 0.35, s * 0.7); g.fill();
  });
}

/** A soft round sprite (glows, smoke, sparks). */
export function glowTex() {
  return canvasTex('glow', 64, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
  }, { srgb: false });
}

/** Text label texture (signs, name tags). Not cached by default. */
export function textTex(text, { w = 256, h = 64, bg = 'rgba(0,0,0,0)', fg = '#fff', font = '700 34px Fredoka, sans-serif', stroke = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (stroke) { g.lineWidth = 6; g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(text, w / 2, h / 2 + 2); }
  g.fillStyle = fg; g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Counter fronts: two panelled cupboard doors with handles, tinted per world by the material colour. */
export function cabinetTex(style = 'wood') {
  return canvasTex('cab-' + style, 256, (g, s, r) => {
    const metal = style === 'steel';
    g.fillStyle = metal ? '#d6dbe1' : '#e9e2d6'; g.fillRect(0, 0, s, s);
    if (!metal) for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(110,80,50,${0.05 + r() * 0.08})`; g.beginPath(); const x = r() * s; g.moveTo(x, 0); g.bezierCurveTo(x + 6, s * 0.3, x - 6, s * 0.6, x + r() * 6, s); g.stroke(); }
    else for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.15})`; g.fillRect(0, r() * s, s, 1); }
    // plinth shadow + top lip
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, s - 26, s, 26);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, s, 10);
    for (const x0 of [12, s / 2 + 4]) {
      const w = s / 2 - 16, y0 = 22, h = s - 58;
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x0, y0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x0 + 2, y0 + 2, w - 4, h - 4);
      g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(x0 + 14, y0 + 14, w - 28, h - 28);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x0 + 16, y0 + 16, w - 32, h - 32);
    }
    // handles
    g.fillStyle = '#3a3a40';
    g.fillRect(s / 2 - 22, 50, 8, 46); g.fillRect(s / 2 + 14, 50, 8, 46);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(s / 2 - 21, 52, 2, 42); g.fillRect(s / 2 + 15, 52, 2, 42);
  });
}

/** Straw thatch for treehouse roofs (strands run down the slope = texture v). */
export function thatchTex() {
  return canvasTex('thatch', 256, (g, s, r) => {
    g.fillStyle = '#a8843e'; g.fillRect(0, 0, s, s);
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < 260; i++) {
        const x = r() * s, y = row * 64 + r() * 20, len = 40 + r() * 30;
        const c = shade(0xc8a050, (r() - 0.5) * 0.5);
        g.strokeStyle = hex(c); g.lineWidth = 1 + r() * 1.5;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + len); g.stroke();
      }
      g.fillStyle = 'rgba(40,25,5,0.35)'; g.fillRect(0, row * 64 + 60, s, 4);
    }
  }, { repeat: 1 });
}

/** Vertical bark grooves. */
export function barkTex() {
  return canvasTex('bark', 256, (g, s, r) => {
    g.fillStyle = '#5a3c22'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) {
      const x = r() * s, w = 2 + r() * 6;
      g.fillStyle = r() < 0.5 ? `rgba(20,10,4,${0.3 + r() * 0.4})` : `rgba(150,110,70,${0.15 + r() * 0.2})`;
      g.beginPath(); g.moveTo(x, 0);
      let xx = x; for (let y = 0; y <= s; y += 16) { xx += (r() - 0.5) * 4; g.lineTo(xx, y); }
      for (let y = s; y >= 0; y -= 16) g.lineTo(xx + w, y);
      g.fill();
    }
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(70,110,40,${0.15 + r() * 0.25})`; g.beginPath(); g.ellipse(r() * s, r() * s, 6 + r() * 14, 3 + r() * 6, 0, 0, 7); g.fill(); }
  });
}

/** A single jungle leaf on transparent background (for canopy cards). */
export function leafTex(tint = '#3f8f32') {
  return canvasTex('leaf' + tint, 128, (g, s, r) => {
    g.clearRect(0, 0, s, s);
    for (let k = 0; k < 3; k++) {
      const a = -0.6 + k * 0.6, cx = s / 2, cy = s * 0.95;
      g.save(); g.translate(cx, cy); g.rotate(a);
      const L = s * (0.78 - Math.abs(k - 1) * 0.12), W = L * 0.32;
      const grd = g.createLinearGradient(-W, 0, W, 0);
      grd.addColorStop(0, hex(shade(parseInt(tint.slice(1), 16), -0.35))); grd.addColorStop(0.5, hex(shade(parseInt(tint.slice(1), 16), 0.15))); grd.addColorStop(1, hex(shade(parseInt(tint.slice(1), 16), -0.3)));
      g.fillStyle = grd;
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(W, -L * 0.3, W * 0.8, -L * 0.8, 0, -L); g.bezierCurveTo(-W * 0.8, -L * 0.8, -W, -L * 0.3, 0, 0); g.fill();
      g.strokeStyle = 'rgba(220,255,180,0.45)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -L * 0.95); g.stroke();
      g.restore();
    }
  }, { srgb: true });
}
