// Controls. Every cook is driven by a controller:
//   'kb'   the whole keyboard (one cook on it): WASD / arrows, Space jump, Enter (or E) interact,
//          Shift dash, Q (or /) throw
//   'kb1'  left half when two cooks share the keyboard: WASD, Space jump, E interact, Q throw, Left Shift dash
//   'kb2'  right half: arrows, Right Shift jump, Enter interact, / throw, . dash
//   'pad0'..'pad3'  gamepads (standard mapping): stick / d-pad, A jump, X or B interact, Y throw, bumpers or
//          triggers dash, Start pauses
//   'free' every gamepad not already driving another cook
//   'touch' the on-screen joystick and buttons (phones and tablets)
//   controllers combine with '|': you are 'kb|free|touch' (or 'kb1|free|touch' once a second cook takes the arrows)
// Tap interact = grab / place, hold = chop / wash / spray. Esc (or Start) pauses.
export const LAYOUT = {
  kb: { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], jump: ['Space'], act: ['Enter', 'NumpadEnter', 'KeyE', 'KeyF'], dash: ['ShiftLeft', 'ShiftRight', 'Period'], throw: ['KeyQ', 'Slash'] },
  kb1: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], jump: ['Space'], act: ['KeyE', 'KeyF'], dash: ['ShiftLeft'], throw: ['KeyQ'] },
  kb2: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ShiftRight', 'Numpad0'], act: ['Enter', 'NumpadEnter'], dash: ['Period', 'NumpadDecimal'], throw: ['Slash', 'Numpad1'] },
};
/** human-readable key names for the HUD and the lobby */
export const KEYNAMES = {
  kb: { move: 'WASD', jump: 'Space', act: 'Enter', dash: 'Shift', throw: 'Q' },
  kb1: { move: 'WASD', jump: 'Space', act: 'E', dash: 'L-Shift', throw: 'Q' },
  kb2: { move: 'Arrows', jump: 'R-Shift', act: 'Enter', dash: '.', throw: '/' },
  pad: { move: 'Stick', jump: 'A', act: 'X', dash: 'RB', throw: 'Y' },
  touch: { move: 'Stick', jump: 'Jump', act: 'Grab', dash: 'Dash', throw: 'Throw' },
  any: { move: 'WASD', jump: 'Space', act: 'Enter', dash: 'Shift', throw: 'Q' },
};
/** true once the device is played by touch (a coarse pointer, or the first real touch) */
export const touchUI = { on: typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches };
export const keyNames = (ctrl) => {
  const parts = String(ctrl || 'kb').split('|'), c = parts[0];
  if (touchUI.on && parts.includes('touch')) return KEYNAMES.touch;
  return KEYNAMES[c] || (c.startsWith('pad') ? KEYNAMES.pad : KEYNAMES.kb);
};
export const ctrlLabel = (ctrl) => { const c = String(ctrl || 'kb').split('|')[0]; return c === 'kb2' ? 'Arrows + Enter' : c === 'kb1' ? 'WASD + E' : c.startsWith('pad') ? `Gamepad ${+c.slice(3) + 1}` : 'Keyboard'; };

const PAD = { jump: [0], act: [2, 1], throw: [3], dash: [4, 5, 6, 7], start: [9] };
const DEAD = 0.28;
const PREVENT = new Set(['Space', 'Enter', 'NumpadEnter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash', 'Period', 'Quote']);

export class Input {
  constructor() {
    this.keys = new Set();
    this.downs = new Set();   // keys pressed since the last poll of each controller (cleared in endFrame)
    this.ups = new Set();
    this.onPause = () => {};
    this.onPadJoin = null;    // (padIndex) => void: a free gamepad pressed A (the lobby listens for this)
    this.enabled = true;
    this.pads = [];           // previous button states per gamepad
    this.padDown = [];        // edge presses per gamepad this frame
    this.padUp = [];
    this.claimed = new Set(); // gamepads already driving a cook
    // on-screen controls: stick vector and button states, with edges like the keys
    this.touch = { mx: 0, my: 0, on: new Set(), downs: new Set(), ups: new Set() };
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.code;
      if (k === 'Escape') { this.onPause(); return; }
      if (!this.enabled) return;
      if (PREVENT.has(k)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(k);
      this.downs.add(k);
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); this.ups.add(e.code); });
    addEventListener('blur', () => { for (const k of this.keys) this.ups.add(k); this.keys.clear(); });
  }

  /** read the gamepads (once per frame, before any controller is polled) */
  pollPads() {
    const list = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < 4; i++) {
      const gp = list && list[i];
      const prev = this.pads[i] || [];
      const now = gp && gp.connected ? gp.buttons.map((b) => b.pressed || b.value > 0.5) : [];
      this.padDown[i] = now.map((v, b) => v && !prev[b]);
      this.padUp[i] = prev.map((v, b) => v && !now[b]);
      this.pads[i] = now;
      this.axes = this.axes || [];
      this.axes[i] = gp && gp.connected ? [gp.axes[0] || 0, gp.axes[1] || 0] : [0, 0];
      if (gp && gp.connected && this.padDown[i][PAD.start[0]]) this.onPause();
      if (gp && gp.connected && this.padDown[i][3] && !this.claimed.has(i) && this.onPadJoin) this.onPadJoin(i);
    }
  }
  padCount() { const l = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []; return [...(l || [])].filter((g) => g && g.connected).length; }
  endFrame() { this.downs.clear(); this.ups.clear(); this.touch.downs.clear(); this.touch.ups.clear(); }

  /** on-screen controls feed: stick (-1..1 each) and buttons 'jump' | 'act' | 'dash' | 'throw' */
  touchStick(mx, my) { this.touch.mx = mx; this.touch.my = my; }
  touchButton(b, down) {
    const T = this.touch;
    if (down && !T.on.has(b)) { T.on.add(b); T.downs.add(b); }
    else if (!down && T.on.has(b)) { T.on.delete(b); T.ups.add(b); }
  }

  has(...codes) { return codes.some((c) => this.keys.has(c)); }

  /**
   * The state of one controller this frame: { mx, my, jump, press, release, dash, throw }.
   * jump / press / release / dash / throw are edges (true for one frame).
   */
  read(ctrl) {
    const out = { mx: 0, my: 0, jump: false, press: false, release: false, dash: false, throw: false, holding: false };
    if (!this.enabled) return out;
    const parts = String(ctrl === 'any' ? 'kb|free|touch' : ctrl).split('|');
    const kbs = parts.filter((c) => LAYOUT[c]);
    for (const id of kbs) {
      const L = LAYOUT[id];
      const on = (a) => L[a].some((c) => this.keys.has(c)), dn = (a) => L[a].some((c) => this.downs.has(c));
      if (on('left')) out.mx -= 1;
      if (on('right')) out.mx += 1;
      if (on('up')) out.my -= 1;
      if (on('down')) out.my += 1;
      out.jump ||= dn('jump'); out.press ||= dn('act'); out.dash ||= dn('dash'); out.throw ||= dn('throw');
      out.release ||= L.act.some((c) => this.ups.has(c));
      out.holding ||= on('act');
    }
    if (parts.includes('touch')) {
      const T = this.touch;
      out.mx += T.mx; out.my += T.my;
      out.jump ||= T.downs.has('jump'); out.press ||= T.downs.has('act'); out.dash ||= T.downs.has('dash'); out.throw ||= T.downs.has('throw');
      out.release ||= T.ups.has('act');
      out.holding ||= T.on.has('act');
    }
    const pads = [];
    for (const c of parts) {
      if (c === 'free') pads.push(...[0, 1, 2, 3].filter((i) => !this.claimed.has(i)));
      else if (c.startsWith('pad')) pads.push(+c.slice(3));
    }
    for (const i of pads) {
      const now = this.pads[i], dn = this.padDown[i], up = this.padUp[i];
      if (!now || !now.length) continue;
      const [ax, ay] = this.axes[i];
      const m = Math.hypot(ax, ay);
      if (m > DEAD) { const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m; out.mx += ax * k; out.my += ay * k; }
      if (now[14]) out.mx -= 1; if (now[15]) out.mx += 1; if (now[12]) out.my -= 1; if (now[13]) out.my += 1;
      const any = (arr, b) => arr && b.some((x) => arr[x]);
      out.jump ||= any(dn, PAD.jump); out.press ||= any(dn, PAD.act); out.throw ||= any(dn, PAD.throw); out.dash ||= any(dn, PAD.dash);
      out.release ||= any(up, PAD.act);
      out.holding ||= any(now, PAD.act);
    }
    const m = Math.hypot(out.mx, out.my);
    if (m > 1) { out.mx /= m; out.my /= m; }
    return out;
  }

  /** legacy single-cook helpers (menus) */
  move() { const r = this.read('kb'); return { mx: r.mx, my: r.my }; }
  clear() {
    this.keys.clear(); this.downs.clear(); this.ups.clear();
    const T = this.touch; T.mx = T.my = 0; T.on.clear(); T.downs.clear(); T.ups.clear();
  }
}
