// Keyboard: WASD move, Space jump, Enter interact (tap = grab/place, hold = chop/wash/spray).
// Arrow keys mirror WASD. Esc pauses.
export class Input {
  constructor() {
    this.keys = new Set();
    this.jumpQ = false; this.pressQ = false; this.releaseQ = false;
    this.onPause = () => {};
    this.enabled = true;
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.code;
      if (k === 'Escape') { this.onPause(); return; }
      if (!this.enabled) return;
      if (['Space', 'Enter', 'NumpadEnter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(k);
      if (k === 'Space') this.jumpQ = true;
      if (k === 'Enter' || k === 'NumpadEnter') this.pressQ = true;
    });
    addEventListener('keyup', (e) => {
      const k = e.code;
      this.keys.delete(k);
      if (k === 'Enter' || k === 'NumpadEnter') this.releaseQ = true;
    });
    addEventListener('blur', () => { if (this.keys.has('Enter')) this.releaseQ = true; this.keys.clear(); });
  }
  has(...codes) { return codes.some((c) => this.keys.has(c)); }
  move() {
    let mx = 0, my = 0;
    if (this.has('KeyA', 'ArrowLeft')) mx -= 1;
    if (this.has('KeyD', 'ArrowRight')) mx += 1;
    if (this.has('KeyW', 'ArrowUp')) my -= 1;
    if (this.has('KeyS', 'ArrowDown')) my += 1;
    const m = Math.hypot(mx, my);
    return m ? { mx: mx / m, my: my / m } : { mx: 0, my: 0 };
  }
  consumeJump() { const j = this.jumpQ; this.jumpQ = false; return j; }
  consumePress() { const j = this.pressQ; this.pressQ = false; return j; }
  consumeRelease() { const j = this.releaseQ; this.releaseQ = false; return j; }
  clear() { this.keys.clear(); this.jumpQ = this.pressQ = this.releaseQ = false; }
}
