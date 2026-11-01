// What every food looks like inside: the cut-face textures for slices (tomato locules, citrus segments,
// melon seeds, marbled meat, bread crumb...), painted on a canvas in the slice's unit square, plus the
// cooked looks (seared, poached, roasted, burnt) layered over them.
import { TAU, rng, css, ctex, shadeC, mixc, col } from './geo.js';

const sg = (a, e) => Math.sign(a) * Math.pow(Math.abs(a), e);
/** unit outline of a cross-section: [[y, z], ...] counter-clockwise, fitting inside [-1, 1] */
export function outline(sec, n = 72, scale = 1) {
  const e = 2 / (sec.n || 2), la = sec.la || 0, lob = sec.lobes || 0;
  return Array.from({ length: n }, (_, i) => {
    const t = i / n * TAU, k = (1 + la * Math.cos(lob * t)) / (1 + la) * scale;
    return [sg(Math.sin(t), e) * k, sg(Math.cos(t), e) * k];
  });
}

/** CanvasTexture of the cut face for an ingredient I, its section spec and a cooking variant */
export function capTexture(I, sec, variant = 'raw') {
  return ctex(`cap:${I.id}:${variant}`, 256, (c, S) => draw(c, S, I, sec, variant));
}

function draw(c, S, I, sec, variant) {
  const A = I.c1, B = I.c2, C = I.c3, r = rng(I.id.length * 13 + 5);
  const X = (z) => (z * 0.5 + 0.5) * S, Y = (y) => (0.5 - y * 0.5) * S, R = (k) => k * S * 0.5;
  const pts = outline(sec, 96);
  const path = (k = 1) => { c.beginPath(); pts.forEach(([y, z], i) => (i ? c.lineTo : c.moveTo).call(c, X(z * k), Y(y * k))); c.closePath(); };
  const disc = (x, y, rr, fill) => { c.fillStyle = fill; c.beginPath(); c.arc(X(x), Y(y), R(rr), 0, TAU); c.fill(); };
  const ring = (k0, fill) => {
    c.fillStyle = fill; c.beginPath();
    for (const k of [1.02, k0]) { pts.forEach(([y, z], i) => (i ? c.lineTo : c.moveTo).call(c, X(z * k), Y(y * k))); c.closePath(); }
    c.fill('evenodd');
  };
  const grain = (n, a, sz = 2) => { for (let i = 0; i < n; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${a * r()})`; c.fillRect(r() * S, r() * S, sz, sz); } };
  const fill = (f) => { c.fillStyle = f; c.fillRect(0, 0, S, S); };
  const radial = (stops) => { const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.5); stops.forEach(([o, cc]) => g.addColorStop(o, cc)); return g; };

  c.save();
  // layer 1: everything inside the outline
  const inside = () => {
    switch (sec.pat) {
      case 'tomato': {
        fill(css(mixc(A, B, 0.25)));
        grain(1500, 0.06);
        const n = 4;
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + 0.4, x = Math.cos(a) * 0.42, y = Math.sin(a) * 0.42;
          c.save(); c.translate(X(x), Y(y)); c.rotate(-a);
          const g = c.createRadialGradient(0, 0, 2, 0, 0, R(0.3)); g.addColorStop(0, css(mixc(B, 0xffffff, 0.35))); g.addColorStop(1, css(mixc(A, B, 0.6)));
          c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, R(0.28), R(0.22), 0, 0, TAU); c.fill();
          for (let k = 0; k < 7; k++) { const sa = (k - 3) * 0.32; c.fillStyle = '#f4ecbc'; c.beginPath(); c.ellipse(Math.cos(sa) * R(0.15), Math.sin(sa) * R(0.15), R(0.035), R(0.02), sa, 0, TAU); c.fill(); }
          c.restore();
        }
        disc(0, 0, 0.17, css(mixc(A, B, 0.55)));
        c.strokeStyle = css(mixc(A, 0xffffff, 0.2)); c.lineWidth = 2;
        for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4 + Math.PI / 4; c.beginPath(); c.moveTo(X(0), Y(0)); c.lineTo(X(Math.cos(a) * 0.86), Y(Math.sin(a) * 0.86)); c.stroke(); }
        break;
      }
      case 'citrus': {
        fill('#f8f2d8');
        const n = 10;
        for (let i = 0; i < n; i++) {
          const a0 = i / n * TAU + 0.04, a1 = (i + 1) / n * TAU - 0.04;
          const g = c.createRadialGradient(S / 2, S / 2, R(0.08), S / 2, S / 2, R(0.78));
          g.addColorStop(0, css(mixc(A, B, 0.6))); g.addColorStop(1, css(mixc(A, B, 0.2)));
          c.fillStyle = g; c.beginPath(); c.moveTo(X(Math.cos((a0 + a1) / 2) * 0.1), Y(Math.sin((a0 + a1) / 2) * 0.1)); c.arc(S / 2, S / 2, R(0.78), -a1, -a0); c.closePath(); c.fill();
          c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1;
          for (let k = 0; k < 10; k++) { const a = a0 + (a1 - a0) * r(), d0 = 0.15 + r() * 0.5; c.beginPath(); c.moveTo(X(Math.cos(a) * d0), Y(Math.sin(a) * d0)); c.lineTo(X(Math.cos(a) * (d0 + 0.12)), Y(Math.sin(a) * (d0 + 0.12))); c.stroke(); }
        }
        disc(0, 0, 0.08, '#fbf6e2');
        ring(0.82, '#fbf6e2');
        break;
      }
      case 'melon': {
        const water = I.id === 'vinemelon', star = I.shape === 'starmelon';
        fill(css(B)); grain(4000, 0.08);
        if (water) {
          for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + r() * 0.2, d = 0.42 + r() * 0.16; c.save(); c.translate(X(Math.cos(a) * d), Y(Math.sin(a) * d)); c.rotate(-a); c.fillStyle = '#1a1210'; c.beginPath(); c.ellipse(0, 0, R(0.045), R(0.026), 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(-R(0.02), -R(0.012), R(0.012), R(0.008)); c.restore(); }
        } else {
          disc(0, 0, 0.36, css(mixc(B, star ? 0x101a40 : C, 0.5)));
          for (let i = 0; i < 18; i++) { const a = r() * TAU, d = r() * 0.3; c.fillStyle = star ? '#ffe880' : '#f4e8c0'; c.beginPath(); c.ellipse(X(Math.cos(a) * d), Y(Math.sin(a) * d), R(0.03), R(0.018), a, 0, TAU); c.fill(); }
        }
        ring(0.86, css(mixc(B, 0xf8f8e8, 0.6)));
        ring(0.92, water ? '#c8e0a0' : css(mixc(A, 0xffffff, 0.3)));
        break;
      }
      case 'steak': case 'meatbone': {
        fill(css(A)); grain(6000, 0.08);
        c.strokeStyle = css(B); c.lineCap = 'round';
        for (let i = 0; i < 26; i++) { let x = r() * S, y = r() * S, a = r() * TAU; c.lineWidth = 0.5 + r() * r() * 3.5; c.globalAlpha = 0.4 + r() * 0.5; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 8; k++) { a += (r() - 0.5) * 1.3; x += Math.cos(a) * 9; y += Math.sin(a) * 9; c.lineTo(x, y); } c.stroke(); }
        c.globalAlpha = 1;
        if (sec.pat === 'meatbone') { disc(0.05, 0, 0.3, css(C)); disc(0.05, 0, 0.21, css(mixc(C, 0xd8c8a0, 0.5))); disc(0.05, 0, 0.13, '#8a3a2a'); }
        else ring(0.84, css(B));
        break;
      }
      case 'fish': {
        fill(css(mixc(B, 0xffd0b8, 0.25)));
        c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2;
        for (let i = 1; i < 6; i++) { const k = i / 6; c.beginPath(); c.ellipse(X(0), Y(0.05), R(k * 0.95), R(k * 0.8), 0, 0, TAU); c.stroke(); }
        c.strokeStyle = 'rgba(160,80,60,0.4)'; c.beginPath(); c.moveTo(X(0), Y(-1)); c.lineTo(X(0), Y(1)); c.stroke();
        disc(0, 0.05, 0.08, '#d8b0a0');
        ring(0.9, css(mixc(C, 0x3a2a2a, 0.3)));
        break;
      }
      case 'tentacle': {
        fill(css(C)); grain(2500, 0.05);
        disc(0, -0.05, 0.22, css(mixc(C, A, 0.25))); disc(0, -0.05, 0.1, css(mixc(C, 0xffffff, 0.4)));
        ring(0.8, css(A));
        break;
      }
      case 'potato': {
        fill(css(B)); grain(5000, 0.05);
        c.strokeStyle = css(shadeC(col(B), -0.12)); c.lineWidth = 2; path(0.8); c.stroke();
        ring(0.94, css(A));
        break;
      }
      case 'kelp': case 'leek': {
        if (sec.pat === 'kelp') { fill(css(A)); c.fillStyle = css(mixc(A, B, 0.6)); c.fillRect(0, S * 0.42, S, S * 0.16); }
        else { for (let i = 10; i >= 1; i--) { c.fillStyle = i % 2 ? css(mixc(B, A, 0.1 + (10 - i) * 0.02)) : css(mixc(B, A, 0.35)); path(i / 10); c.fill(); } }
        grain(2000, 0.06);
        break;
      }
      case 'shrimp': {
        fill('#f8f0ec'); c.lineWidth = R(0.06);
        for (let i = 0; i < 3; i++) { c.strokeStyle = css(mixc(A, 0xff8a6a, 0.5)); c.globalAlpha = 0.5; c.beginPath(); c.arc(X(0), Y(-0.6), R(0.5 + i * 0.25), Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
        c.globalAlpha = 1;
        ring(0.88, css(mixc(A, C, 0.4)));
        break;
      }
      case 'mushroom': {
        fill(css(B)); c.strokeStyle = 'rgba(120,110,90,0.25)'; c.lineWidth = 1;
        for (let i = 0; i < 50; i++) { const x = r() * S; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 6, S * 0.3, x - 6, S * 0.6, x + 3, S); c.stroke(); }
        break;
      }
      case 'corn': {
        fill(css(mixc(A, 0x000000, 0.4)));
        for (let i = 0; i < 14; i++) {
          const a0 = i / 14 * TAU + 0.03, a1 = (i + 1) / 14 * TAU - 0.03;
          const g = c.createRadialGradient(S / 2, S / 2, R(0.45), S / 2, S / 2, R(1));
          g.addColorStop(0, css(mixc(A, 0xffffff, 0.55))); g.addColorStop(1, css(A));
          c.fillStyle = g; c.beginPath(); c.arc(S / 2, S / 2, R(0.98), -a1, -a0); c.arc(S / 2, S / 2, R(0.48), -a0, -a1, true); c.closePath(); c.fill();
        }
        disc(0, 0, 0.45, '#e8dcb0'); disc(0, 0, 0.3, '#d8c890'); grain(1500, 0.05);
        break;
      }
      case 'pepper': {
        fill(css(mixc(A, B, 0.3))); grain(2000, 0.06);
        c.strokeStyle = '#f8f0d8'; c.lineWidth = R(0.05); path(0.83); c.stroke();
        for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.3; for (let k = 0; k < 3; k++) disc(Math.sin(a) * 0.8 + (r() - 0.5) * 0.08, Math.cos(a) * 0.8 + (r() - 0.5) * 0.08, 0.04, '#f6e8b0'); }
        break;
      }
      case 'carrot': {
        fill(css(B)); grain(3000, 0.06);
        const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, R(0.45)); g.addColorStop(0, css(mixc(B, 0xffffff, 0.3))); g.addColorStop(1, css(mixc(B, A, 0.25)));
        c.fillStyle = g; c.beginPath(); c.arc(S / 2, S / 2, R(0.45), 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1;
        for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; c.beginPath(); c.moveTo(X(Math.cos(a) * 0.45), Y(Math.sin(a) * 0.45)); c.lineTo(X(Math.cos(a) * 0.95), Y(Math.sin(a) * 0.95)); c.stroke(); }
        ring(0.94, css(A));
        break;
      }
      case 'spore': {
        fill(css(B));
        for (let i = 0; i < 220; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 0.85; disc(Math.cos(a) * d, Math.sin(a) * d, 0.01 + r() * 0.035, css(mixc(C, 0x3a3010, 0.4))); }
        ring(0.86, css(A));
        break;
      }
      case 'bean': {
        fill('#f4fbf2'); disc(0, 0, 0.5, css(mixc(B, A, 0.35))); disc(-0.1, 0.12, 0.1, css(mixc(B, 0xffffff, 0.4)));
        ring(0.72, css(A));
        break;
      }
      case 'cheese': {
        fill(css(A)); grain(4000, 0.06);
        for (let i = 0; i < 9; i++) { const x = (r() - 0.5) * 1.5, y = (r() - 0.5) * 1.5, rr = 0.06 + r() * 0.12; const g = c.createRadialGradient(X(x) - R(rr) * 0.3, Y(y) - R(rr) * 0.3, 1, X(x), Y(y), R(rr)); g.addColorStop(0, css(A, -0.45)); g.addColorStop(0.75, css(A, -0.25)); g.addColorStop(1, css(A, 0.15)); c.fillStyle = g; c.beginPath(); c.arc(X(x), Y(y), R(rr), 0, TAU); c.fill(); }
        ring(0.95, css(C));
        break;
      }
      case 'bread': {
        fill(css(B));
        for (let i = 0; i < 520; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 0.9, rr = 0.008 + r() * r() * 0.05; c.fillStyle = `rgba(150,110,60,${0.25 + r() * 0.35})`; c.beginPath(); c.ellipse(X(Math.cos(a) * d), Y(Math.sin(a) * d), R(rr), R(rr * (0.5 + r() * 0.5)), r() * 3, 0, TAU); c.fill(); }
        ring(0.88, css(shadeC(col(A), -0.15)));
        break;
      }
      case 'poultry': case 'frog': {
        fill(css(mixc(B, 0xf0b8a8, 0.45))); grain(3000, 0.05);
        c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 2; c.beginPath(); c.moveTo(X(-0.8), Y(0.1)); c.bezierCurveTo(X(-0.2), Y(0.3), X(0.2), Y(-0.2), X(0.8), Y(0.05)); c.stroke();
        if (sec.pat === 'frog') { disc(0, 0, 0.17, '#f4f0e0'); disc(0, 0, 0.08, '#c8a090'); }
        ring(0.9, css(mixc(A, 0xf0d890, 0.3)));
        break;
      }
      case 'nut': {
        fill(css(B)); grain(2000, 0.05);
        c.strokeStyle = css(shadeC(col(A), -0.2)); c.lineWidth = R(0.05); c.beginPath();
        for (let i = 0; i <= 64; i++) { const a = i / 64 * TAU, d = 0.72 + Math.sin(a * 9) * 0.04; (i ? c.lineTo : c.moveTo).call(c, X(Math.cos(a) * d), Y(Math.sin(a) * d)); } c.stroke();
        ring(0.82, css(A));
        break;
      }
      case 'mango': {
        fill(css(mixc(A, B, 0.35))); grain(3000, 0.05);
        c.fillStyle = '#f6eed0'; c.beginPath(); c.ellipse(X(0), Y(0), R(0.5), R(0.16), 0, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,240,200,0.5)'; c.lineWidth = 1;
        for (let i = 0; i < 30; i++) { const x = (r() - 0.5) * 1.2; c.beginPath(); c.moveTo(X(x), Y(0.15)); c.lineTo(X(x * 1.2), Y(0.6 + r() * 0.3)); c.moveTo(X(x), Y(-0.15)); c.lineTo(X(x * 1.2), Y(-0.6 - r() * 0.3)); c.stroke(); }
        ring(0.95, css(mixc(A, C, 0.4)));
        break;
      }
      case 'bolt': {
        c.fillStyle = radial([[0, '#d8dee4'], [0.6, css(B)], [1, css(A)]]); c.fillRect(0, 0, S, S);
        c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1;
        for (let i = 1; i < 30; i++) { c.beginPath(); c.arc(S / 2, S / 2, R(i / 30), 0, TAU); c.stroke(); }
        break;
      }
      case 'crystal': {
        for (let i = 0; i < 6; i++) { c.fillStyle = css(mixc(A, B, (i % 3) * 0.3)); c.beginPath(); c.moveTo(S / 2, S / 2); c.arc(S / 2, S / 2, S, i / 6 * TAU, (i + 1) / 6 * TAU); c.closePath(); c.fill(); }
        for (let i = 0; i < 60; i++) disc((r() - 0.5) * 1.6, (r() - 0.5) * 1.6, 0.008 + r() * 0.012, 'rgba(255,255,255,0.9)');
        break;
      }
      case 'flour': {
        fill(css(B)); grain(5000, 0.05); ring(0.9, css(A));
        break;
      }
      case 'cream': default: {
        fill(css(mixc(B, A, 0.3))); grain(3000, 0.04); ring(0.9, css(mixc(C, 0xffffff, 0.3)));
      }
    }
  };
  if (sec.mush) fill(css(B)); else { path(1); c.clip(); }
  inside();
  // layer 2: the cooking
  if (variant === 'seared' || variant === 'roast') {
    const meat = ['steak', 'meatbone', 'poultry', 'frog', 'fish', 'tentacle'].includes(sec.pat);
    const tint = variant === 'seared' ? (meat ? 'rgb(205,150,110)' : 'rgba(150,85,35,0.75)') : 'rgba(205,140,60,0.6)';
    c.globalCompositeOperation = 'multiply'; fill(tint);
    if (meat && variant === 'seared') { c.globalCompositeOperation = 'source-over'; fill('rgba(150,90,60,0.35)'); c.globalCompositeOperation = 'multiply'; }
    c.fillStyle = radial([[0, 'rgba(255,255,255,0)'], [0.7, 'rgba(255,255,255,0)'], [1, variant === 'seared' ? 'rgba(90,45,15,0.9)' : 'rgba(150,80,25,0.7)']]); c.fillRect(0, 0, S, S);
    c.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 40; i++) disc((r() - 0.5) * 1.8, (r() - 0.5) * 1.8, 0.02 + r() * 0.06, `rgba(70,35,10,${0.15 + r() * 0.3})`);
    if (variant === 'seared') { c.strokeStyle = 'rgba(45,22,8,0.75)'; c.lineWidth = R(0.07); for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(X(-1 + i * 0.45), Y(-1)); c.lineTo(X(1 + i * 0.45), Y(1)); c.stroke(); } }
    grain(3000, 0.08);
  } else if (variant === 'poached') {
    fill('rgba(255,250,240,0.28)');
  } else if (variant === 'burnt') {
    fill('#1b1613');
    for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(${r() < 0.3 ? '120,110,100' : '0,0,0'},${0.4 * r()})`; c.fillRect(r() * S, r() * S, 2, 2); }
    c.lineCap = 'round';
    for (let i = 0; i < 12; i++) { let x = r() * S, y = r() * S, a = r() * TAU; c.strokeStyle = r() < 0.5 ? '#ff6a1a' : '#c83a0a'; c.lineWidth = 1 + r() * 2; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 6; k++) { a += (r() - 0.5) * 1.6; x += Math.cos(a) * 12; y += Math.sin(a) * 12; c.lineTo(x, y); } c.stroke(); }
  }
  c.restore();
}

/** colour of the slice's skin (its rim / outer surface) */
export function skinColor(I, variant) {
  let C = col(I.id === 'vinemelon' ? I.c3 : I.shape === 'cream' ? 0xe8eef0 : I.shape === 'bolt' ? I.c2 : I.c1);
  if (variant === 'seared') C = mixc(shadeC(C, -0.5), 0x4a2410, 0.65);
  else if (variant === 'roast') C = mixc(shadeC(C, -0.35), 0xb8702a, 0.3);
  else if (variant === 'poached') C = mixc(C, 0xffffff, 0.15);
  else if (variant === 'burnt') C = col(0x14100e);
  return C;
}
