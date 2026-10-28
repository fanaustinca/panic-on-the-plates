// DOM UI: title, lobby (outfits, colours, level vote), modals, the in-game HUD and results.
import * as THREE from 'three';
import { WORLDS, OUTFITS, COLORS, SLOT_COLORS, INGREDIENTS, finalState, worldRecipes, LEVEL_RECIPES, VERSION, UPGRADES, UPGRADE_MAX } from './config.js';
import { buildLevel, levelTitle, MP_LEVEL } from './levels.js';
import { envAt, cuckooAt } from './hazards.js';
import { ingIcon, dishIcon, chefIcon } from './render/thumbs.js';
import { loadSave, writeSave, totalStars, worldUnlocked, levelUnlocked, outfitUnlocked, worldNeed, upgradeCost } from './save.js';
const lvLabel = (wi, li) => (li === MP_LEVEL ? `${wi + 1}-MP` : `${wi + 1}-${li + 1}`);
import { sfx } from './audio.js';

const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

// ---------------------------------------------------------------- icons (inline SVG)
export const ICON = {
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="13" r="8.5"/><path d="M12 8.5V13l3 2M9 2.5h6"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="8" r="3.6"/><circle cx="17" cy="9" r="2.8"/><path d="M2 20c.6-4.2 3.4-6.4 7-6.4s6.4 2.2 7 6.4zM15.5 13.8c3 .1 5.6 1.9 6.3 5.6h-4.6c-.3-2.2-.9-4-1.7-5.6z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 2L4 14h6.5L9 22l11-13h-7z"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l9 8h-3v9h-4.5v-6h-3v6H6v-9H3z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5z"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 3a6.5 6.5 0 00-6.2 8.5L2 17.8V22h4.2v-2.4h2.4v-2.4H11l1.6-1.6A6.5 6.5 0 1014.5 3zm2 4.4a1.6 1.6 0 110 3.2 1.6 1.6 0 010-3.2z"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="3.6" rx="1.8"/><rect x="3" y="10.2" width="18" height="3.6" rx="1.8"/><rect x="3" y="16.4" width="18" height="3.6" rx="1.8"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10.3 2h3.4l.5 2.6 1.8.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.8 2.6.5v3.4l-2.6.5-.8 1.8 1.5 2.2-2.4 2.4-2.2-1.5-1.8.8-.5 2.6h-3.4l-.5-2.6-1.8-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.8L2 13.7v-3.4l2.6-.5.8-1.8-1.5-2.2 2.4-2.4 2.2 1.5 1.8-.8zM12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.3a2.9 2.9 0 115 2.1c-1 .8-2.2 1.3-2.2 2.9M12 17.6v.1"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4.2" height="16" rx="1.4"/><rect x="13.8" y="4" width="4.2" height="16" rx="1.4"/></svg>',
  knife: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M3 19L17 5c2-2 5 1 3 3L9 16l-2 3z"/></svg>',
  pan: '<svg viewBox="0 0 24 24" fill="#fff"><ellipse cx="10" cy="13" rx="8" ry="5"/><rect x="16" y="11" width="7" height="3" rx="1.5"/></svg>',
  pot: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M4 9h16v8a4 4 0 01-4 4H8a4 4 0 01-4-4z"/><rect x="2" y="7" width="20" height="3" rx="1.5"/><rect x="10" y="3" width="4" height="4" rx="1"/></svg>',
  oven: '<svg viewBox="0 0 24 24" fill="#fff"><rect x="3" y="3" width="18" height="18" rx="3"/><rect x="6" y="9" width="12" height="9" rx="1.5" fill="#d86a1a"/></svg>',
  fire: '<svg viewBox="0 0 24 24" fill="#ff6a2a"><path d="M12 2c1 4 6 6 6 12a6 6 0 01-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z"/></svg>',
  wind: '<svg viewBox="0 0 24 24" fill="none" stroke="#9fd8ff" stroke-width="2.6" stroke-linecap="round"><path d="M3 8h11a3 3 0 10-3-3M3 13h16a3 3 0 11-3 3M3 18h8"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l8 9h-5v9H9v-9H4z"/></svg>',
  dice: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="4"/><g fill="#1d1530"><circle cx="8" cy="8" r="1.7"/><circle cx="16" cy="16" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="16" cy="8" r="1.7"/><circle cx="8" cy="16" r="1.7"/></g></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="#ffcf3a"><path d="M12 2l10.5 19h-21z"/><path d="M11 9h2v6h-2zM11 17h2v2h-2z" fill="#1d1530"/></svg>',
};
const METHOD_ICON = { chop: ['knife', '#e8a43a'], pan: ['pan', '#e8553a'], pot: ['pot', '#3a8ae8'], oven: ['oven', '#9a5ad8'] };

// World emblems drawn as simple SVG pictograms (no emoji)
export const WORLD_ICON = [
  '<svg viewBox="0 0 32 32" fill="#fff"><path d="M15 4v18H5l10-18zM17 8l9 14h-9z"/><path d="M3 24h26l-4 5H7z"/></svg>',
  '<svg viewBox="0 0 32 32" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><path d="M16 3v26M4.7 9.5l22.6 13M4.7 22.5l22.6-13M12 5l4 4 4-4M12 27l4-4 4 4"/></svg>',
  '<svg viewBox="0 0 32 32" fill="#fff"><path d="M3 29l9-17h8l9 17z"/><path d="M13 10c0-4 2-7 3-8 1 1 3 4 3 8z" fill="#ffcf3a"/></svg>',
  '<svg viewBox="0 0 32 32" fill="#fff"><path d="M16 2c5 4 7 10 6 18h-12C9 12 11 6 16 2z"/><circle cx="16" cy="12" r="3" fill="#2a72c4"/><path d="M10 18l-5 6 6-1zM22 18l5 6-6-1zM13 22h6l-3 8z"/></svg>',
  '<svg viewBox="0 0 32 32" fill="#fff"><path d="M8 24a6 6 0 01-.5-12A8 8 0 0123 10a7 7 0 011 14z"/></svg>',
  '<svg viewBox="0 0 32 32" fill="#fff"><path d="M15 30l1.5-16h1L19 30z"/><path d="M16 14C11 8 5 9 3 12c4-1 8 0 13 2zM17 14c5-6 11-5 13-2-4-1-8 0-13 2zM16.5 14c-2-6-6-9-10-9 3 2 6 5 10 9zM17 14c2-6 6-9 10-9-3 2-6 5-10 9z"/></svg>',
  '<svg viewBox="0 0 32 32" fill="#fff"><path d="M14 2h4l1 4 3 1.3 3.5-2 2.8 2.8-2 3.5L27.6 15l4 1v4l-4 1-1.3 3 2 3.5-2.8 2.8-3.5-2L19 30l-1 2h-4l-1-2-3-1.3-3.5 2-2.8-2.8 2-3.5L4.4 21l-4-1v-4l4-1 1.3-3-2-3.5 2.8-2.8 3.5 2L13 6z" transform="scale(.9) translate(2 1)"/><circle cx="16" cy="16" r="5" fill="#56606c"/></svg>',
  '<svg viewBox="0 0 32 32" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><circle cx="16" cy="17" r="12"/><path d="M16 9v8l5 4"/><path d="M10 3h12" /></svg>',
];
const WORLD_COLOR = ['#2a6fa8', '#5aa8d8', '#c8441a', '#3a3a8a', '#7a9ae8', '#3a8a3a', '#6a727c', '#6a3aa8'];
const MECHANICS = [
  'The deck <b>tilts</b> side to side, and cannonballs punch <b>holes</b> in the floor. Watch for the red rings!',
  'Floors are <b>slippery ice</b>. Ride the drifting <b>ice floes</b> across the channels.',
  '<b>Fire walls</b>, <b>magma geysers</b> and falling <b>embers</b>. Embers can set counters alight!',
  '<b>Laser doors</b> cycle on and off. When <b>gravity fails</b>, everything floats. Jump with Space!',
  'Strong <b>gusts</b> push cooks around, and <b>lightning</b> strikes the red markers.',
  '<b>Rope bridges</b> sway, and <b>monkeys</b> steal food from counters. Run into them to make them drop it!',
  '<b>Conveyor belts</b> carry items between stations. Flip the <b>lever</b> to reverse them.',
  'Random <b>time dilation</b> speeds up or slows down cooks and stoves. Jump over the <b>Cuckoo</b> when it sweeps a row!',
];
export { MECHANICS };

const finals = (rc) => rc.ings.map((id) => finalState(id));

export class UI {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('ui');
    this.tagsEl = document.getElementById('tags');
    this.popEl = document.getElementById('popups');
    this.toastEl = document.getElementById('toasts');
    this.tab = 'outfit';
    this.viewWorld = 0;
  }

  clear() { this.root.innerHTML = ''; this.tagsEl.innerHTML = ''; }
  toast(msg) { const t = el(`<div class="toast">${msg}</div>`); this.toastEl.appendChild(t); setTimeout(() => t.remove(), 3900); }

  modal(html, onMount) {
    const bg = el(`<div class="modal-bg"><div class="modal panel">${html}</div></div>`);
    this.root.appendChild(bg);
    const close = () => bg.remove();
    bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
    bg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { sfx.ui(); close(); }));
    onMount && onMount(bg, close);
    return close;
  }

  // ---------------------------------------------------------------- title
  showTitle() {
    this.clear();
    const s = this.app.save;
    const stars = totalStars(s);
    const v = el(`
      <div class="title-screen">
        <div>
          <div class="logo"><span class="l1">PANIC</span><span class="l2">ON THE</span><span class="l3">PLATES</span></div>
          <p class="tagline">Co-op kitchen chaos for 1–4 cooks. 8 wild worlds, 80 levels, and nobody washing the plates.</p>
          <div class="panel title-card">
            <div class="name-field"><label for="nm">Chef name</label><input id="nm" class="text" maxlength="14" placeholder="Your name" value="${esc(s.name)}" /></div>
            <button class="btn big mustard" data-a="quick">${ICON.bolt} Quick Match</button>
            <div class="row">
              <button class="btn sky" data-a="host">${ICON.people} Host Room</button>
              <button class="btn sky" data-a="join">${ICON.key} Join Code</button>
            </div>
            <div class="row">
              <button class="btn mint" data-a="solo">${ICON.play} Play Solo</button>
              <button class="btn ghost" data-a="browse">${ICON.list} Rooms</button>
            </div>
            <div class="row">
              <button class="btn ghost small" data-a="howto">${ICON.help} How to play</button>
              <button class="btn ghost small" data-a="settings">${ICON.gear} Settings</button>
            </div>
          </div>
        </div>
        <div></div>
        <div class="title-foot">v${VERSION} · <b>${stars}</b> / 240 stars · peer-to-peer over WebRTC</div>
      </div>`);
    this.root.appendChild(v);
    const nm = v.querySelector('#nm');
    nm.addEventListener('input', () => { s.name = nm.value.trim().slice(0, 14); writeSave(s); });
    v.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
      sfx.ui();
      if (!s.name) { s.name = 'Chef ' + Math.floor(100 + Math.random() * 900); nm.value = s.name; writeSave(s); }
      const a = b.dataset.a;
      if (a === 'quick') this.app.quickMatch();
      if (a === 'host') this.hostDialog();
      if (a === 'join') this.joinDialog();
      if (a === 'solo') this.app.solo();
      if (a === 'browse') this.browseDialog();
      if (a === 'howto') this.howTo();
      if (a === 'settings') this.settings();
    }));
  }

  hostDialog() {
    this.modal(`<h2>Host a room</h2>
      <p>Public rooms show up in Quick Match and the room list. Private rooms are invite-only by code.</p>
      <div class="actions"><button class="btn ghost" data-close>Cancel</button><button class="btn sky" data-p="0">${ICON.key} Private</button><button class="btn mustard" data-p="1">${ICON.people} Public</button></div>`,
    (bg, close) => bg.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { close(); this.app.host(b.dataset.p === '1'); })));
  }

  joinDialog() {
    this.modal(`<h2>Join with code</h2>
      <input class="text" id="code" maxlength="6" placeholder="e.g. K7QXP" style="text-transform:uppercase;font-size:28px;letter-spacing:6px;text-align:center" />
      <div class="actions"><button class="btn ghost" data-close>Cancel</button><button class="btn mustard" id="go">Join</button></div>`,
    (bg, close) => {
      const inp = bg.querySelector('#code');
      inp.focus();
      const go = () => { const c = inp.value.trim(); if (c.length >= 4) { close(); this.app.join(c); } };
      bg.querySelector('#go').addEventListener('click', go);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    });
  }

  async browseDialog() {
    const close = this.modal(`<h2>Open kitchens</h2><div class="rooms"><div class="spinner"></div><p style="text-align:center;color:var(--muted)">Searching public rooms…</p></div>
      <div class="actions"><button class="btn ghost" data-close>Close</button><button class="btn sky" id="mk">${ICON.people} Host public</button></div>`,
    (bg, cl) => bg.querySelector('#mk').addEventListener('click', () => { cl(); this.app.host(true); }));
    let rooms = [];
    try { rooms = await this.app.browse(); } catch (e) { rooms = null; }
    const box = this.root.querySelector('.rooms');
    if (!box) return;
    if (rooms === null) { box.innerHTML = '<p>Could not reach the matchmaking server. Check your connection.</p>'; return; }
    if (!rooms.length) { box.innerHTML = '<p style="color:var(--muted)">No public kitchens open right now. Host one and friends can Quick Match into it!</p>'; return; }
    box.innerHTML = '';
    for (const r of rooms) {
      const full = r.players >= r.max || r.state !== 'lobby';
      const row = el(`<div class="room-row"><span class="code">${esc(r.code)}</span><div class="grow"><b>${esc(r.name || 'Kitchen')}</b><br><span style="color:var(--muted);font-size:13px">${r.state === 'lobby' ? 'In lobby' : 'Cooking'}${r.level ? ' · ' + esc(r.level) : ''}</span></div><span class="chip">${ICON.people.replace('<svg', '<svg width="16" height="16"')} ${r.players}/${r.max}</span><button class="btn small ${full ? 'ghost' : 'mustard'}" ${full ? 'disabled' : ''}>Join</button></div>`);
      row.querySelector('button').addEventListener('click', () => { close(); this.app.join(r.code); });
      box.appendChild(row);
    }
  }

  howTo() {
    this.modal(`<h2>How to cook</h2>
      <div class="howto">
        <div><b>Move</b><br><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to run</div>
        <div><b>Jump</b><br><kbd>Space</kbd> to hop gaps &amp; hazards</div>
        <div><b>Interact</b><br>Tap <kbd>Enter</kbd> to grab, place, cook, serve</div>
        <div><b>Work</b><br>Hold <kbd>Enter</kbd> to chop, wash, or spray</div>
        <div><b>1.</b> Grab ingredients from the crates and <b>chop</b> them on a board.</div>
        <div><b>2.</b> Cook chopped food in the <b>pan</b>, <b>pot</b> or <b>oven</b> its ticket shows.</div>
        <div><b>3.</b> Combine everything on a <b>clean plate</b> and serve at the <b>ORDER UP</b> window.</div>
        <div><b>4.</b> Dirty plates come back. <b>Wash</b> them in the sink!</div>
        <div><b>Fire!</b> Overcooked food bursts into flames that spread. Grab the red <b>extinguisher</b> and hold Enter.</div>
        <div><b>Stars</b> Earn stars to unlock new worlds and outfits. Quick serves earn tips &amp; combos.</div>
      </div>
      <div class="actions"><button class="btn mustard" data-close>Let's cook!</button></div>`);
  }

  settings() {
    const s = this.app.save;
    this.modal(`<h2>Settings</h2>
      <div class="slider"><label>Sound FX</label><input type="range" min="0" max="1" step="0.05" id="sfx" value="${s.settings.sfx}"></div>
      <div class="slider"><label>Music</label><input type="range" min="0" max="1" step="0.05" id="mus" value="${s.settings.music}"></div>
      <div class="slider"><label>Graphics</label><div class="tabs" id="q" style="flex:1">${['low', 'medium', 'high'].map((q) => `<button data-q="${q}" class="${s.settings.quality === q ? 'on' : ''}">${q[0].toUpperCase() + q.slice(1)}</button>`).join('')}</div></div>
      <div class="actions"><button class="btn mustard" data-close>Done</button></div>`,
    (bg) => {
      const upd = () => { s.settings.sfx = +bg.querySelector('#sfx').value; s.settings.music = +bg.querySelector('#mus').value; writeSave(s); this.app.applySettings(); };
      bg.querySelector('#sfx').addEventListener('input', upd);
      bg.querySelector('#mus').addEventListener('input', upd);
      bg.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { s.settings.quality = b.dataset.q; writeSave(s); bg.querySelectorAll('[data-q]').forEach((x) => x.classList.toggle('on', x === b)); this.app.applySettings(); }));
    });
  }

  connecting(msg, onCancel) {
    this.clear();
    const v = el(`<div class="modal-bg"><div class="modal panel" style="text-align:center;width:420px"><div class="spinner"></div><h2 style="font-size:26px">${esc(msg)}</h2><p id="cs" style="color:var(--muted);margin:0">Finding cooks over WebRTC…</p><div class="actions" style="justify-content:center"><button class="btn ghost">Cancel</button></div></div></div>`);
    v.querySelector('button').addEventListener('click', () => { sfx.ui(); onCancel(); });
    this.root.appendChild(v);
  }

  // ---------------------------------------------------------------- lobby
  showLobby() {
    this.clear();
    const v = el(`
      <div class="lobby">
        <div class="lobby-head">
          <button class="btn ghost small" id="leave">${ICON.home} Leave</button>
          <h2 id="lt">Kitchen Lobby</h2>
          <div class="panel wallet" id="wallet"></div>
          <div class="panel code-box" id="codebox"></div>
        </div>
        <div class="panel players" id="players"></div>
        <div class="passthrough"></div>
        <div class="panel side">
          <div class="tabs"><button data-t="outfit">Outfit</button><button data-t="upg">Upgrades</button><button data-t="level" id="votetab">Vote Level</button></div>
          <div class="scroll" id="side"></div>
        </div>
        <div class="lobby-foot">
          <div class="status" id="status"></div>
          <button class="btn big ghost" id="ready">Ready up</button>
          <button class="btn big mustard" id="start">${ICON.play} Start cooking</button>
        </div>
      </div>`);
    this.root.appendChild(v);
    this.lobbyEl = v;
    v.querySelector('#leave').addEventListener('click', () => { sfx.ui(); this.app.leave(); });
    v.querySelector('#ready').addEventListener('click', () => { sfx.ui(); this.app.toggleReady(); });
    v.querySelector('#start').addEventListener('click', () => { sfx.ui(); this.app.startMatch(); });
    v.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { sfx.ui(); this.tab = b.dataset.t; this.renderSide(); }));
    this.renderLobby();
  }

  renderLobby() {
    if (!this.lobbyEl) return;
    const app = this.app, v = this.lobbyEl;
    const members = app.memberList();
    const room = app.room;
    v.querySelector('#wallet').innerHTML = `<span class="coin">$</span><b>${app.save.coins}</b>`;
    v.querySelector('#votetab').textContent = app.multi ? 'Vote World' : 'Choose Level';
    v.querySelector('#lt').textContent = room ? `${members.find((m) => m.host)?.name || 'Host'}'s Kitchen` : 'Solo Kitchen';
    v.querySelector('#codebox').innerHTML = room
      ? `<span style="color:var(--muted);font-size:13px">${room.isPublic ? 'PUBLIC ROOM' : 'ROOM CODE'}</span><span class="code">${esc(room.code)}</span><button class="btn small ghost" id="copy">Copy</button>`
      : '<span style="color:var(--muted);font-size:13px">OFFLINE · Host a room to invite friends</span>';
    const cp = v.querySelector('#copy');
    if (cp) cp.addEventListener('click', () => { navigator.clipboard?.writeText(room.code); this.toast('Room code copied'); });
    const P = v.querySelector('#players');
    P.innerHTML = `<h3>Cooks ${members.length}/4</h3>`;
    members.forEach((m, i) => {
      const lv = m.vote != null && String(m.vote).includes('-') ? String(m.vote).split('-').map(Number) : null;
      const wv = app.multi && m.vote != null && /^\d$/.test(String(m.vote)) ? WORLDS[+m.vote].name : null;
      P.appendChild(el(`<div class="pcard" style="--c:${hex(SLOT_COLORS[i])}"><img src="${chefIcon(m.outfit, COLORS[m.color % COLORS.length], m.skin)}" alt="" /><div><div class="nm">${esc(m.name)}${m.id === app.selfId ? ' <span style="color:var(--muted);font-size:12px">(you)</span>' : ''}</div><div class="sub">${m.host ? 'Host · ' : ''}${wv ? `Wants ${esc(wv)}` : lv ? `Picked ${lv[0] + 1}-${lv[1] + 1}` : 'No vote yet'}</div></div><span class="rd ${m.ready || m.host ? 'on' : ''}">${m.host ? 'HOST' : m.ready ? 'READY' : 'WAITING'}</span></div>`));
    });
    for (let i = members.length; i < 4; i++) P.appendChild(el(`<div class="pcard empty">${room ? 'Waiting for a cook…' : 'Empty station'}</div>`));
    const me = app.me();
    const ready = v.querySelector('#ready'), start = v.querySelector('#start');
    ready.style.display = app.isHost ? 'none' : '';
    ready.textContent = me && me.ready ? 'Not ready' : 'Ready up';
    ready.className = `btn big ${me && me.ready ? 'ghost' : 'mint'}`;
    start.style.display = app.isHost ? '' : 'none';
    const pick = app.pickLevel();
    const [pw, pl] = pick.split('-').map(Number);
    const notReady = members.filter((m) => !m.host && !m.ready).length;
    const wv = app.multi ? app.worldVotes().filter((q) => q.world != null) : [];
    if (app.multi) v.querySelector('#status').innerHTML = wv.length
      ? `${ICON.dice.replace('<svg', '<svg width="18" height="18" style="vertical-align:-3px"')} Dice decides between: <b>${[...new Set(wv.map((q) => WORLDS[q.world].name))].map(esc).join(', ')}</b>${notReady ? ` · ${notReady} not ready` : ''}`
      : `Vote for a world. The dice picks one cook's choice${notReady ? ` · ${notReady} not ready` : ''}`;
    else v.querySelector('#status').innerHTML = app.isHost
      ? `Next up: <b>${pw + 1}-${pl + 1} ${esc(levelTitle(pw, pl))}</b>${notReady ? ` · ${notReady} cook${notReady > 1 ? 's' : ''} not ready` : ''}`
      : `Waiting for the host to start · Leading vote: <b>${pw + 1}-${pl + 1} ${esc(levelTitle(pw, pl))}</b>`;
    this.renderSide();
  }

  renderSide() {
    const v = this.lobbyEl;
    if (!v) return;
    v.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === this.tab));
    const side = v.querySelector('#side');
    const app = this.app, s = app.save, me = app.me();
    if (!me) return;
    side.innerHTML = '';
    if (this.tab === 'outfit') {
      side.appendChild(el('<h3>Outfit mods</h3>'));
      const grid = el('<div class="outfits"></div>');
      for (const o of OUTFITS) {
        const unlocked = outfitUnlocked(s, o.id);
        const b = el(`<button class="outfit ${me.outfit === o.id ? 'on' : ''} ${unlocked ? '' : 'locked'}" data-lock="Reach ${o.world >= 0 ? WORLDS[o.world].name : ''}"><img src="${chefIcon(o.id, COLORS[me.color % COLORS.length], me.skin)}" alt="" />${esc(o.name)}</button>`);
        b.addEventListener('click', () => { if (!unlocked) { sfx.wrong(); return; } sfx.ui(); app.setProfile({ outfit: o.id }); });
        grid.appendChild(b);
      }
      side.appendChild(grid);
      side.appendChild(el('<h3 style="margin-top:12px">Colour</h3>'));
      const sw = el('<div class="swatches"></div>');
      COLORS.forEach((c, i) => { const d = el(`<div class="swatch ${me.color === i ? 'on' : ''}" style="background:${hex(c)}"></div>`); d.addEventListener('click', () => { sfx.ui(); app.setProfile({ color: i }); }); sw.appendChild(d); });
      side.appendChild(sw);
      side.appendChild(el('<h3 style="margin-top:12px">Skin tone</h3>'));
      const sk = el('<div class="swatches"></div>');
      [0xf2c8a0, 0xd9a07a, 0xa86e48, 0x6e4a32].forEach((c, i) => { const d = el(`<div class="swatch ${me.skin === i ? 'on' : ''}" style="background:${hex(c)}"></div>`); d.addEventListener('click', () => { sfx.ui(); app.setProfile({ skin: i }); }); sk.appendChild(d); });
      side.appendChild(sk);
      return;
    }
    if (this.tab === 'upg') { this.renderUpgrades(side); return; }
    if (app.multi) { this.renderWorldVote(side); return; }
    // level vote
    const votes = new Map();
    app.memberList().forEach((m, i) => { if (m.vote) { if (!votes.has(m.vote)) votes.set(m.vote, []); votes.get(m.vote).push(i); } });
    const wt = el('<div class="worlds"></div>');
    WORLDS.forEach((w, wi) => {
      const un = worldUnlocked(s, wi);
      const got = Array.from({ length: 10 }, (_, li) => s.stars[`${wi}-${li}`] || 0).reduce((a, b) => a + b, 0);
      const b = el(`<button class="wtab ${this.viewWorld === wi ? 'on' : ''}" style="--wc:${WORLD_COLOR[wi]}" title="${esc(w.name)}">${WORLD_ICON[wi]}<span>${esc(w.name.split(' ').slice(-1)[0])}</span><span class="stars">${un ? `${got}/30` : `Lvl 1 open`}</span></button>`);
      b.addEventListener('click', () => { sfx.ui(); this.viewWorld = wi; this.renderSide(); app.previewWorld(wi); });
      wt.appendChild(b);
    });
    side.appendChild(wt);
    const wi = this.viewWorld, W = WORLDS[wi];
    side.appendChild(el(`<h3 style="margin-top:12px">${esc(W.name)}</h3>`));
    side.appendChild(el(`<p style="margin:0 0 10px;color:var(--muted);font-size:13.5px">${MECHANICS[wi]}</p>`));
    const lv = el('<div class="levels"></div>');
    for (let li = 0; li < 10; li++) {
      const key = `${wi}-${li}`, un = levelUnlocked(s, wi, li), st = s.stars[key] || 0;
      const vv = votes.get(key) || [];
      const b = el(`<button class="lvl ${me.vote === key ? 'on' : ''} ${un ? '' : 'locked'}"><span class="n">${wi + 1}-${li + 1}</span><span class="st">${[0, 1, 2].map((k) => `<span class="${k < st ? 'f' : ''}">★</span>`).join('')}</span><span class="votes">${vv.map((i) => `<i style="background:${hex(SLOT_COLORS[i])}"></i>`).join('')}</span></button>`);
      b.title = levelTitle(wi, li);
      b.addEventListener('click', () => { if (!un) { sfx.wrong(); this.toast(worldUnlocked(s, wi) ? 'Earn a star on the previous level first' : `Collect ${worldNeed(wi)} stars to open the rest of ${WORLDS[wi].name}`); return; } sfx.ui(); app.vote(key); });
      lv.appendChild(b);
    }
    side.appendChild(lv);
    const key = me.vote && me.vote.startsWith(wi + '-') ? me.vote : `${wi}-0`;
    const li = +key.split('-')[1];
    const rcs = LEVEL_RECIPES[li].map((r) => worldRecipes(wi)[r]);
    const best = s.best[key] || 0;
    const info = el(`<div class="level-info" style="margin-top:12px"><div class="t">${wi + 1}-${li + 1} · ${esc(levelTitle(wi, li))}</div><div style="color:var(--muted)">${best ? `Best score ${best}` : 'Not cooked yet'}</div><div class="dishes">${rcs.map((rc) => `<span class="dish"><img src="${dishIcon(rc, finals(rc))}" alt="" />${esc(rc.name)}</span>`).join('')}</div></div>`);
    side.appendChild(info);
  }

  // ---------------------------------------------------------------- HUD
  startMatch(game) {
    this.clear();
    this.lobbyEl = null;
    this.game = game;
    const L = game.L;
    const v = el(`
      <div class="hud">
        <div class="panel score-card"><div class="lv">${lvLabel(game.L.world, game.L.index)} · ${esc(L.name)}</div><div class="sc"><span class="coin">$</span><span id="score">0</span><span class="combo" id="combo"></span></div>
          <div class="starbar"><div class="fill" id="sfill"></div>${game.sim.stars.map((s, i) => `<span class="mk" id="mk${i}" style="left:${(s / game.sim.stars[2]) * 100}%">${ICON.star}</span>`).join('')}</div></div>
        <div class="panel timer" id="timer">${ICON.clock}<span id="time">0:00</span></div>
        <div class="orders" id="orders"></div>
        <div class="alert" id="alert"></div>
        <div class="panel hint" id="hint"></div>
        <div class="panel keys"><span><kbd>WASD</kbd> move · <kbd>Space</kbd> jump</span><span><kbd>Enter</kbd> grab / hold to work · <kbd>Esc</kbd> menu</span></div>
        <div class="countdown" id="cd"></div>
      </div>`);
    this.root.appendChild(v);
    this.hud = v;
    this.tickets = new Map();
    this.lastScore = -1;
    this.cdWord = null;
    this.alertT = 0;
    this.lastTimeS = null;
    this.tagMap = new Map();
  }

  updateMatch(game, t, dt) {
    const v = this.hud;
    if (!v) return;
    const sim = game.sim, L = game.L;
    // countdown overlay
    const cd = v.querySelector('#cd');
    const word = t < -2.4 ? 'ready' : t < -1.2 ? 'set' : t < 0.25 ? 'cook' : null;
    if (word !== this.cdWord) {
      this.cdWord = word;
      cd.innerHTML = word ? `<div class="bd"></div><div class="word ${word}">${{ ready: 'Ready', set: 'Set', cook: 'Cook!' }[word]}</div>${word !== 'cook' ? `<div class="panel sub"><span class="st">${esc(L.name)}</span>${MECHANICS[L.world]}</div>` : ''}` : '';
    }
    // score / stars
    if (sim.score !== this.lastScore) {
      this.lastScore = sim.score;
      v.querySelector('#score').textContent = sim.score;
      v.querySelector('#sfill').style.width = Math.min(100, (sim.score / sim.stars[2]) * 100) + '%';
      sim.stars.forEach((s, i) => v.querySelector('#mk' + i).classList.toggle('on', sim.score >= s));
    }
    v.querySelector('#combo').textContent = sim.combo > 1 ? `x${sim.combo} combo` : '';
    // timer
    const left = Math.max(0, L.duration - Math.max(0, t));
    const secs = Math.ceil(left);
    if (secs !== this.lastTimeS) {
      this.lastTimeS = secs;
      v.querySelector('#time').textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      v.querySelector('#timer').classList.toggle('low', secs <= 30 && t > 0);
      if (secs <= 10 && secs > 0 && t > 0) sfx.tick();
    }
    // tickets
    const O = v.querySelector('#orders');
    const live = new Set();
    for (const o of sim.orders) {
      live.add(o.id);
      let tk = this.tickets.get(o.id);
      if (!tk) {
        const rc = L.recipes[o.r];
        const node = el(`<div class="ticket"><div class="dn">${esc(rc.name)}</div><img class="dimg" src="${dishIcon(rc, finals(rc))}" alt="" /><div class="ings">${rc.ings.map((id) => { const m = INGREDIENTS[id].method; const [ic, col] = METHOD_ICON[m]; return `<span class="ing" title="${esc(INGREDIENTS[id].name)}"><img src="${ingIcon(id, 'raw')}" alt="" /><span class="m" style="background:${col}">${ICON[ic]}</span></span>`; }).join('')}</div><div class="bar"><i></i></div></div>`);
        O.appendChild(node);
        tk = { node, bar: node.querySelector('.bar i') };
        this.tickets.set(o.id, tk);
      }
      const f = Math.max(0, 1 - (Math.max(0, t) - o.t0) / o.lim);
      tk.bar.style.width = f * 100 + '%';
      tk.bar.style.background = f > 0.5 ? 'var(--mint)' : f > 0.25 ? 'var(--mustard)' : 'var(--tomato)';
      tk.node.classList.toggle('urgent', f < 0.2);
    }
    for (const [id, tk] of this.tickets) if (!live.has(id) && !tk.leaving) { tk.leaving = true; tk.node.classList.add(tk.done ? 'done' : 'failed'); setTimeout(() => { tk.node.remove(); this.tickets.delete(id); }, 600); }
    // hint
    const h = game.hint();
    const hintEl = v.querySelector('#hint');
    if (hintEl.dataset.h !== h) { hintEl.dataset.h = h; hintEl.innerHTML = sim.phase === 'play' ? h : ''; }
    // hazard alerts (time based, so clients see them too)
    this.alertT -= dt;
    const env = envAt(L, Math.max(0, t));
    let a = null;
    if (sim.phase === 'play') {
      if (env.wind && env.wind.warn) a = [ICON.wind, `Gust incoming ${env.wind.dx > 0 ? '→' : env.wind.dx < 0 ? '←' : env.wind.dy > 0 ? '↓' : '↑'}`, '#9fd8ff'];
      else if (env.wind) a = [ICON.wind, 'Hold on to your hats!', '#9fd8ff'];
      else if (env.gravityWarn) a = [ICON.warn, 'Gravity generator failing…', '#ffcf3a'];
      else if (env.lowG) a = [ICON.bolt, 'Low gravity!', '#9a6aff'];
      else if (env.dilWarn) a = [ICON.clock, 'Time is warping…', '#c8a8ff'];
      else if (env.scale < 1) a = [ICON.clock, 'Time slowed', '#c8a8ff'];
      else if (env.scale > 1) a = [ICON.clock, 'Time rush!', '#ff8ad8'];
      const ck = cuckooAt(L, Math.max(0, t));
      if (ck && ck.warn) a = [ICON.warn, 'CUCKOO! Jump or clear the lane!', '#ff3a6a'];
    }
    const al = v.querySelector('#alert');
    if (a) { this.alertT = 0; this.setAlert(al, a); }
    else if (this.alertT <= 0) al.classList.remove('show');
    // name tags
    this.updateTags(game);
  }

  setAlert(al, [icon, text, color]) {
    const k = text;
    if (al.dataset.k !== k) { al.dataset.k = k; al.innerHTML = `${icon}<span>${text}</span>`; al.style.setProperty('--ac', color); }
    al.classList.add('show');
  }

  alert(text, kind) {
    const al = this.hud && this.hud.querySelector('#alert');
    if (!al) return;
    this.setAlert(al, [kind === 'fire' ? ICON.fire : ICON.warn, text, kind === 'fire' ? '#ff6a2a' : '#ffcf3a']);
    this.alertT = 2.6;
  }

  updateTags(game) {
    const cam = game.camera, r = game.renderer.domElement.getBoundingClientRect();
    const seen = new Set();
    for (const p of game.sim.players) {
      const c = game.chefs.get(p.id);
      if (!c || !c.root.visible) continue;
      seen.add(p.id);
      let t = this.tagMap.get(p.id);
      if (!t) { t = el(`<div class="tag" style="--c:${hex(SLOT_COLORS[p.slot % 4])}">${esc(p.name)}</div>`); this.tagsEl.appendChild(t); this.tagMap.set(p.id, t); }
      const v = new THREE.Vector3(0, 1.55, 0);
      c.root.localToWorld(v);
      v.project(cam);
      t.style.left = (v.x * 0.5 + 0.5) * r.width + 'px';
      t.style.top = (-v.y * 0.5 + 0.5) * r.height + 'px';
      t.style.display = '';
    }
    for (const [id, t] of this.tagMap) if (!seen.has(id)) t.style.display = 'none';
  }

  popup(worldPos, html, cls = '') {
    if (!this.game) return;
    const v = worldPos.clone().project(this.game.camera);
    const r = this.game.renderer.domElement.getBoundingClientRect();
    const p = el(`<div class="pop ${cls}">${html}</div>`);
    p.style.left = (v.x * 0.5 + 0.5) * r.width + 'px';
    p.style.top = (-v.y * 0.5 + 0.5) * r.height + 'px';
    this.popEl.appendChild(p);
    setTimeout(() => p.remove(), 1400);
  }

  orderDone(oid) { const t = this.tickets.get(oid); if (t) t.done = true; }
  orderFailed(oid) { const t = this.tickets.get(oid); if (t) t.done = false; }

  timesUp() {
    if (!this.hud) return;
    this.hud.appendChild(el(`<div class="timesup"><div class="word">Time's up!</div></div>`));
  }

  endMatch() { this.hud = null; this.tagsEl.innerHTML = ''; this.tagMap = new Map(); }

  pauseMenu(onResume, onQuit, isHost, online) {
    return this.modal(`<h2>Paused</h2>${online ? '<p style="color:var(--muted);margin:0">The kitchen keeps cooking while you are in this menu.</p>' : ''}
      <div style="display:flex;flex-direction:column;gap:10px">
        <button class="btn mustard big" data-r>${ICON.play} Resume</button>
        <button class="btn ghost" data-s>${ICON.gear} Settings</button>
        <button class="btn ghost" data-h>${ICON.help} How to play</button>
        <button class="btn" data-q>${ICON.home} ${isHost ? 'End round &amp; back to lobby' : 'Leave game'}</button>
      </div>`,
    (bg, close) => {
      bg.querySelector('[data-r]').addEventListener('click', () => { close(); onResume(); });
      bg.querySelector('[data-s]').addEventListener('click', () => this.settings());
      bg.querySelector('[data-h]').addEventListener('click', () => this.howTo());
      bg.querySelector('[data-q]').addEventListener('click', () => { close(); onQuit(); });
      bg.addEventListener('mousedown', (e) => { if (e.target === bg) onResume(); });
    });
  }

  renderUpgrades(side) {
    const app = this.app, s = app.save;
    side.appendChild(el(`<h3>Upgrades <span class="wallet-inline"><span class="coin">$</span>${s.coins}</span></h3>`));
    side.appendChild(el('<p style="margin:0 0 8px;color:var(--muted);font-size:13.5px">Earn coins every shift (score, stars and first-time stars). Upgrades work in solo and multiplayer.</p>'));
    const list = el('<div class="upgrades"></div>');
    for (const g of UPGRADES) {
      const lvl = s.upg[g.id] | 0, cost = upgradeCost(s, g.id);
      const can = cost != null && s.coins >= cost;
      const row = el(`<div class="upg ${cost == null ? 'max' : ''}">
        <div class="ui-ic">${UPG_ICON[g.id]}</div>
        <div class="grow"><b>${esc(g.name)}</b><span>${esc(g.desc)}${lvl ? ` · +${Math.round(g.per * lvl * 100)}${esc(g.unit)}` : ''}</span>
          <div class="pips">${Array.from({ length: UPGRADE_MAX }, (_, k) => `<i class="${k < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
        <button class="btn small ${can ? 'mint' : 'ghost'}" ${cost == null ? 'disabled' : ''}>${cost == null ? 'MAX' : `<span class="coin sm">$</span>${cost}`}</button></div>`);
      row.querySelector('button').addEventListener('click', () => {
        if (cost == null) return;
        if (!app.buy(g.id)) { sfx.wrong(); this.toast(`Need ${cost - s.coins} more coins`); return; }
        row.classList.add('bought');
        this.toast(`${g.name} upgraded to tier ${s.upg[g.id]}`);
      });
      list.appendChild(row);
    }
    side.appendChild(list);
  }

  /** Multiplayer: vote for a world; every world is open and plays its multiplayer kitchen. */
  renderWorldVote(side) {
    const app = this.app, me = app.me();
    side.appendChild(el('<h3>Vote for a world</h3>'));
    side.appendChild(el(`<p style="margin:0 0 8px;color:var(--muted);font-size:13.5px">Every world is open in multiplayer. When the host starts, a dice roll picks one cook's vote, and you play that world's <b>multiplayer kitchen</b>: a bigger floor with extra stations.</p>`));
    const votes = new Map();
    app.worldVotes().forEach((q) => { if (q.world != null) { if (!votes.has(q.world)) votes.set(q.world, []); votes.get(q.world).push(q.slot); } });
    const grid = el('<div class="wvote"></div>');
    WORLDS.forEach((w, wi) => {
      const vv = votes.get(wi) || [];
      const b = el(`<button class="wcard ${String(me.vote) === String(wi) ? 'on' : ''}" style="--wc:${WORLD_COLOR[wi]}">${WORLD_ICON[wi]}<div class="t"><b>${esc(w.name)}</b><span>${esc(levelTitle(wi, MP_LEVEL))}</span></div><span class="votes">${vv.map((i) => `<i style="background:${hex(SLOT_COLORS[i])}"></i>`).join('')}</span></button>`);
      b.title = MECHANICS[wi];
      b.addEventListener('click', () => { sfx.ui(); app.vote(String(wi)); app.previewWorld(wi); });
      grid.appendChild(b);
    });
    side.appendChild(grid);
  }

  /** Dice-roll reveal: cycles through each cook's pick and lands on the winner. */
  diceRoll({ entries, win, face }, done) {
    this.closeDice();
    const v = el(`<div class="dice-bg"><div class="dice-card panel">
      <h2>Rolling for the kitchen…</h2>
      <div class="dice3d"><div class="cube" id="cube">${[1, 2, 3, 4, 5, 6].map((n) => `<div class="face f${n}">${pips(n)}</div>`).join('')}</div></div>
      <div class="dice-picks">${entries.map((e, i) => `<div class="dpick" data-i="${i}" style="--c:${e.slot >= 0 ? hex(SLOT_COLORS[e.slot]) : '#888'};--wc:${WORLD_COLOR[e.world]}">${WORLD_ICON[e.world]}<b>${esc(WORLDS[e.world].name)}</b><span>${esc(e.name)}</span></div>`).join('')}</div>
      <div class="dice-result" id="dres"></div></div></div>`);
    this.root.appendChild(v);
    this.diceEl = v;
    const picks = [...v.querySelectorAll('.dpick')];
    const cube = v.querySelector('#cube');
    const rot = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [180, 0] }[face];
    requestAnimationFrame(() => { cube.style.transform = `rotateX(${720 + rot[0]}deg) rotateY(${1080 + rot[1]}deg)`; });
    let k = 0, delay = 70;
    const target = picks.length > 1 ? picks.length * 3 + win : 0;
    const spin = () => {
      if (!this.diceEl) return;
      picks.forEach((p, i) => p.classList.toggle('hot', i === k % picks.length));
      sfx.tick();
      if (k >= target) {
        picks[win].classList.add('win');
        sfx.star(2);
        v.querySelector('#dres').innerHTML = `${esc(entries[win].name)}'s pick: <b>${esc(WORLDS[entries[win].world].name)}</b>`;
        setTimeout(() => { done(); }, 1300);
        return;
      }
      k++; delay *= 1.12;
      setTimeout(spin, delay);
    };
    setTimeout(spin, 300);
  }
  closeDice() { if (this.diceEl) { this.diceEl.remove(); this.diceEl = null; } }

  // ---------------------------------------------------------------- results
  showResults(res, { isHost, hasNext, onNext, onReplay, onLobby, onLeave }) {
    const [wi, li] = res.level.split('-').map(Number);
    const v = el(`
      <div class="results"><div class="panel card">
        <div style="color:var(--muted);font-weight:600;letter-spacing:1px">${esc(WORLDS[wi].name.toUpperCase())} · ${lvLabel(wi, li)}</div>
        <h2>${res.stars === 3 ? 'Kitchen legends!' : res.stars === 2 ? 'Great service!' : res.stars === 1 ? 'Order up!' : 'Kitchen nightmare…'}</h2>
        <div class="big-stars">${[0, 1, 2].map((i) => ICON.star.replace('<svg', `<svg class="${i < res.stars ? 'on' : ''}" style="animation-delay:${0.3 + i * 0.35}s"`)).join('')}</div>
        <div class="total"><span class="coin" style="display:inline-grid;width:44px;height:44px;vertical-align:middle;margin-right:8px">$</span>${res.score}</div>
        ${res.coins != null ? `<div class="earned"><span class="coin sm">$</span>+${res.coins} coins <span>· wallet ${res.wallet}</span></div>` : ''}
        <div class="thresholds">${res.thresholds.map((s, i) => `${'★'.repeat(i + 1)} ${s}`).join(' &nbsp;·&nbsp; ')}</div>
        <div class="grid">
          <div class="stat"><b>${res.delivered}</b><span>Dishes served</span></div>
          <div class="stat"><b>${res.failed}</b><span>Orders missed</span></div>
          <div class="stat"><b>${res.tips}</b><span>Tips earned</span></div>
          <div class="stat"><b>${res.players.reduce((a, p) => a + p.stats.fires, 0)}</b><span>Fires put out</span></div>
        </div>
        <div class="team">${res.players.map((p) => `<div class="mate" style="--c:${hex(SLOT_COLORS[p.slot % 4])}"><img src="${chefIcon(p.outfit, COLORS[p.color % COLORS.length], p.skin)}" alt="" /><div><b>${esc(p.name)}</b>${p.stats.delivered} served · ${p.stats.chopped} chopped · ${p.stats.washed} washed${p.stats.kos ? ` · ${p.stats.kos} oops` : ''}</div></div>`).join('')}</div>
        <div class="acts">${isHost
          ? `<button class="btn ghost" data-a="lobby">${ICON.home} Lobby</button><button class="btn sky" data-a="replay">Replay</button>${hasNext ? `<button class="btn mustard big" data-a="next">${ICON.play} Next level</button>` : ''}`
          : `<span style="color:var(--muted);align-self:center">Waiting for the host…</span><button class="btn ghost" data-a="leave">Leave</button>`}</div>
      </div></div>`);
    this.root.appendChild(v);
    [0, 1, 2].forEach((i) => { if (i < res.stars) setTimeout(() => sfx.star(i), 300 + i * 350); });
    const map = { next: onNext, replay: onReplay, lobby: onLobby, leave: onLeave };
    v.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => { sfx.ui(); map[b.dataset.a](); }));
    return v;
  }
}

function pips(n) {
  const P = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[25, 25], [50, 50], [75, 75]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]] }[n];
  return P.map(([x, y]) => `<i style="left:${x}%;top:${y}%"></i>`).join('');
}
const UPG_ICON = {
  speed: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M13 3l-1 6h6l-8 12 1-8H5z"/></svg>',
  chop: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M3 19L17 5c2-2 5 1 3 3L9 16l-2 3z"/></svg>',
  wash: '<svg viewBox="0 0 24 24" fill="#fff"><circle cx="8" cy="15" r="5"/><circle cx="16" cy="9" r="3.5"/><circle cx="18" cy="17" r="2.2"/></svg>',
  jump: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2l6 7h-4v6h-4V9H6z"/><rect x="5" y="18" width="14" height="3" rx="1.5"/></svg>',
  spray: '<svg viewBox="0 0 24 24" fill="#fff"><rect x="6" y="8" width="7" height="13" rx="3"/><path d="M8 8V5h4l5-2v6l-5-2"/><circle cx="20" cy="5" r="1.2"/><circle cx="21" cy="9" r="1.2"/></svg>',
  recover: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 21s-8-5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 6-8 11-8 11z"/></svg>',
};
