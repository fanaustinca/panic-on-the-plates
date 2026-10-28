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
      planks: [0xb07a45, 0x8a5a30], ice: [0xd6f1fb, 0x9fd3ec], basalt: [0x3a3330, 0x251f1d], metalgrid: [0x8b96a6, 0x5c6676],
      cloudtile: [0xf4f1ff, 0xd8d2f2], bamboo: [0xc9a85a, 0x9b7c38], steelplate: [0x7c848c, 0x5a6168], parquet: [0x8a5a3a, 0x5e3a24],
    }[kind] || [0xcccccc, 0x999999];
    g.fillStyle = hex(P[0]); g.fillRect(0, 0, s, s);
    if (kind === 'planks') {
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
      marble: [0xf6f2ea, 0xd8cfc0], trunk: [0x6a4a2a, 0x4a3018], brickfactory: [0x8a4a3a, 0x5a2e24], bookshelf: [0x4a2a1a, 0x2a160c],
    }[kind] || [0x888888, 0x555555];
    g.fillStyle = hex(P[0]); g.fillRect(0, 0, s, s);
    if (kind === 'snowbrick' || kind === 'brickfactory') {
      for (let y = 0; y < 8; y++) for (let x = -1; x < 4; x++) {
        g.fillStyle = hex(shade(P[0], (r() - 0.5) * 0.18));
        g.fillRect(x * 64 + (y % 2) * 32 + 2, y * 32 + 2, 60, 28);
      }
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
    const base = { wood: 0xc08a52, ice: 0xdaf2fb, stone: 0x5a4a44, panel: 0xe8eef4, marble: 0xfaf6ee, bamboo: 0xd8b46a, steel: 0xaab2ba, darkwood: 0x6a3e26 }[style] || 0xcccccc;
    g.fillStyle = hex(base); g.fillRect(0, 0, s, s);
    if (style === 'wood' || style === 'darkwood' || style === 'bamboo') {
      g.strokeStyle = `rgba(60,30,10,${style === 'darkwood' ? 0.4 : 0.22})`;
      for (let i = 0; i < 14; i++) { g.beginPath(); const y = r() * s; g.moveTo(0, y); g.bezierCurveTo(40, y + 4, 90, y - 4, s, y); g.stroke(); }
    } else if (style === 'marble' || style === 'ice') {
      g.strokeStyle = style === 'ice' ? 'rgba(255,255,255,0.9)' : 'rgba(150,140,130,0.35)';
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(r() * s, 0); g.bezierCurveTo(r() * s, 40, r() * s, 90, r() * s, s); g.stroke(); }
    } else if (style === 'steel' || style === 'panel') {
      const grd = g.createLinearGradient(0, 0, s, s); grd.addColorStop(0, 'rgba(255,255,255,0.35)'); grd.addColorStop(0.5, 'rgba(255,255,255,0)'); grd.addColorStop(1, 'rgba(255,255,255,0.25)');
      g.fillStyle = grd; g.fillRect(0, 0, s, s);
    } else if (style === 'stone') {
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${r() < 0.2 ? '255,120,40' : '0,0,0'},${0.15 + r() * 0.2})`; g.beginPath(); g.arc(r() * s, r() * s, 1 + r() * 4, 0, 7); g.fill(); }
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
