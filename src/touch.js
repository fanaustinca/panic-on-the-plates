// On-screen controls for phones and tablets: a floating joystick on the left half of the screen and
// four buttons in an arc on the right (Grab / work is held like the key: tap = grab, hold = chop).
// They feed Input.touchStick / touchButton, so the game reads them like any other controller.
const ICONS = {
  act: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.5 11V4.8a1.6 1.6 0 113.2 0V10h.3V3.6a1.6 1.6 0 113.2 0V10h.3V4.8a1.6 1.6 0 113.2 0v7.4c0 5-2.6 9.3-7.4 9.3-3 0-4.8-1.6-6.3-4.2l-2.2-3.9a1.5 1.5 0 012.5-1.6L7 13.7V7.2a1.6 1.6 0 113.2 0z"/></svg>',
  jump: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l8 9h-5v8H9v-8H4z"/></svg>',
  dash: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 7h8v2.4H3zM1 11h9v2.4H1zM3 15h8v2.4H3zM13 5l9 7-9 7z"/></svg>',
  throw: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="17" cy="6" r="3.6"/><path d="M2 20c3-7 7-10.5 11.6-11.4l-1.2 2.6C9 12.5 6.4 15.6 4.4 20.6z" opacity=".75"/></svg>',
};

export class TouchPad {
  constructor(input) {
    this.input = input;
    const el = this.el = document.createElement('div');
    el.className = 'tpad';
    el.innerHTML = `
      <div class="tzone"></div>
      <div class="stick"><div class="knob"></div></div>
      <div class="tbtns">
        ${['act', 'jump', 'dash', 'throw'].map((b) => `<button class="tb tb-${b}" data-b="${b}" aria-label="${b}">${ICONS[b]}<span>${b === 'act' ? 'Grab' : b[0].toUpperCase() + b.slice(1)}</span></button>`).join('')}
      </div>`;
    this.zone = el.querySelector('.tzone');
    this.stick = el.querySelector('.stick');
    this.knob = el.querySelector('.knob');
    this.actLabel = el.querySelector('.tb-act span');
    this.pid = null;
    const z = this.zone;
    z.addEventListener('pointerdown', (e) => this.stickDown(e));
    z.addEventListener('pointermove', (e) => this.stickMove(e));
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) z.addEventListener(ev, (e) => this.stickUp(e));
    for (const b of el.querySelectorAll('.tb')) {
      const name = b.dataset.b;
      const down = (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); b.classList.add('on'); input.touchButton(name, true); navigator.vibrate?.(8); };
      const up = () => { b.classList.remove('on'); input.touchButton(name, false); };
      b.addEventListener('pointerdown', down);
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // the joystick floats: it is centred wherever the thumb lands in the left half, and springs back after
  stickDown(e) {
    if (this.pid != null) return;
    e.preventDefault();
    this.pid = e.pointerId;
    this.zone.setPointerCapture?.(e.pointerId);
    const r = this.stick.getBoundingClientRect();
    this.R = r.width * 0.42;
    // keep the whole base on screen
    const cx = Math.max(r.width / 2 + 6, Math.min(innerWidth - r.width / 2, e.clientX));
    const cy = Math.max(r.height / 2 + 6, Math.min(innerHeight - r.height / 2 - 6, e.clientY));
    this.home = this.home || { left: this.stick.style.left, top: this.stick.style.top };
    this.cx = cx; this.cy = cy;
    this.stick.classList.add('on', 'free');
    this.stick.style.left = cx + 'px'; this.stick.style.top = cy + 'px';
    this.stickMove(e);
  }
  stickMove(e) {
    if (e.pointerId !== this.pid) return;
    let dx = e.clientX - this.cx, dy = e.clientY - this.cy;
    const m = Math.hypot(dx, dy), R = this.R;
    if (m > R) { dx *= R / m; dy *= R / m; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const k = Math.min(1, m / R);
    const dead = 0.14;
    const s = k < dead ? 0 : (k - dead) / (1 - dead) / Math.max(1e-6, Math.min(m, R) / R);
    this.input.touchStick((dx / R) * s, (dy / R) * s);
  }
  stickUp(e) {
    if (e.pointerId !== this.pid) return;
    this.pid = null;
    this.stick.classList.remove('on', 'free');
    this.stick.style.left = ''; this.stick.style.top = '';
    this.knob.style.transform = '';
    this.input.touchStick(0, 0);
  }

  /** the big button names what it will do right now */
  setAct(word, canThrow) {
    if (this.actWord !== word) { this.actWord = word; this.actLabel.textContent = word; }
    this.el.classList.toggle('canthrow', !!canThrow);
  }

  /** screen rects (CSS px) the kitchen should stay clear of */
  rects() {
    const out = [];
    const s = this.stick.getBoundingClientRect();
    if (s.width) out.push(s);
    for (const b of this.el.querySelectorAll('.tb')) { const r = b.getBoundingClientRect(); if (r.width) out.push(r); }
    return out;
  }

  release() {
    for (const b of this.el.querySelectorAll('.tb.on')) { b.classList.remove('on'); this.input.touchButton(b.dataset.b, false); }
    if (this.pid != null) this.stickUp({ pointerId: this.pid });
  }
}
