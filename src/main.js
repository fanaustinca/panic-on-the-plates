// App controller: renderer + main loop, menus, lobby membership/voting over the Room, and matches.
import * as THREE from 'three';
import './style.css';
import { WORLDS, MAX_PLAYERS, OUTFITS, cleanUpg, finalState } from './config.js';
import { MP_LEVEL } from './levels.js';
import { Room, isLocalNet } from './net.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { LobbyScene } from './render/lobby3d.js';
import { installDev } from './dev.js';
import { loadSave, writeSave, recordResult, levelUnlocked, outfitUnlocked, openBox, skipLevel } from './save.js';
import { initAudio, setVolumes, playMusic, stopMusic, sfx } from './audio.js';

class App {
  constructor() {
    this.save = loadSave();
    this.canvas = document.getElementById('view');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: new URLSearchParams(location.search).has('test') });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.ui = new UI(this);
    this.input = new Input();
    this.input.onPause = () => this.togglePause();
    this.lobby3d = new LobbyScene(this.renderer);
    this.mode = 'title';
    this.room = null;
    this.isHost = true;
    this.selfId = 'me';
    this.members = new Map();
    this.game = null;
    this.applySettings();
    this.resize();
    addEventListener('resize', () => this.resize());
    const unlock = () => { initAudio(); setVolumes(this.save.settings.sfx, this.save.settings.music); if (!this.musicOn) { this.musicOn = true; if (this.mode !== 'game') playMusic('lobby', 112); } };
    addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
    this.showTitle();
    let last = performance.now();
    this.rt = 0;
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // schedule first: one bad frame must never freeze the game
      requestAnimationFrame(loop);
      try { this.frame(dt); } catch (e) { if (!this.frameErr) { this.frameErr = true; console.error(e); } }
    };
    requestAnimationFrame(loop);
    // a hidden host tab gets no rAF; keep the kitchen running for everybody else
    // (a Worker clock, because timers in hidden tabs are throttled to 1 Hz)
    try {
      const w = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 50)'], { type: 'text/javascript' })));
      let lastHidden = performance.now();
      w.onmessage = () => {
        if (!document.hidden || !this.game || !this.room) { lastHidden = performance.now(); return; }
        const now = performance.now();
        this.frame(Math.min(0.1, (now - lastHidden) / 1000), true);
        lastHidden = now;
      };
    } catch { /* no workers: hidden tabs just pause */ }
    this.ready = true;
  }

  frame(dt, hidden = false) {
    this.rt += dt;
    if (this.game) this.game.update(dt * (this.devSpeed || 1), this.rt, hidden);
    else if (hidden) return;
    else this.lobby3d.render(dt, this.rt);
  }

  resize() {
    const s = this.save.settings.quality;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, s === 'high' ? 2 : s === 'medium' ? 1.5 : 1));
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.lobby3d.fit();
    if (this.game) this.game.fit();
  }

  applySettings() {
    setVolumes(this.save.settings.sfx, this.save.settings.music);
    this.renderer.shadowMap.enabled = this.save.settings.quality !== 'low';
    this.resize();
  }

  // ------------------------------------------------------------ profile / members
  profile() { const s = this.save; return { name: s.name || 'Chef', outfit: outfitUnlocked(s, s.outfit) ? s.outfit : 'chef', color: s.color, skin: s.skin, upg: cleanUpg(s.upg) }; }
  /** In a room you pick worlds (any world, its multiplayer kitchen); solo is the campaign. */
  get multi() { return !!this.room; }
  me() { return this.members.get(this.selfId); }
  memberList() { return [...this.members.values()].sort((a, b) => (b.host ? 1 : 0) - (a.host ? 1 : 0) || a.joined - b.joined); }

  setProfile(patch) {
    Object.assign(this.save, patch); writeSave(this.save);
    const me = this.me();
    Object.assign(me, patch);
    if (this.isHost) this.lobbyChanged(); else this.room.toHost({ k: 'prof', ...patch });
    this.ui.renderLobby();
    this.refresh3d();
  }
  vote(key) {
    const me = this.me();
    me.vote = key;
    if (this.isHost) this.lobbyChanged(); else this.room.toHost({ k: 'vote', key });
    this.ui.renderLobby();
    this.refresh3d();
  }
  toggleReady() {
    const me = this.me();
    me.ready = !me.ready;
    this.room.toHost({ k: 'ready', v: me.ready });
    this.ui.renderLobby(); this.refresh3d();
  }
  previewWorld(wi) { this.lobby3d.setTheme(wi); }

  /** Buy and open a gift box; returns what was inside (or null if you cannot afford it). */
  openGift(id, free = false) {
    const res = openBox(this.save, id, Math.random, free);
    if (res && this.me()) this.setProfile({ upg: cleanUpg(this.save.upg) });
    return res;
  }
  skipLevel(key) { skipLevel(this.save, key); }

  /** Multiplayer: every cook's world vote (null = no vote). */
  worldVotes() { return this.memberList().map((m, i) => ({ id: m.id, name: m.name, slot: i, world: m.vote != null && /^\d$/.test(String(m.vote)) ? +m.vote : null })); }

  /** Host: roll the dice between the cooks' world picks, show it to everyone, then start. */
  rollAndStart() {
    if (this.rolling) return;
    const votes = this.worldVotes().filter((v) => v.world != null);
    const entries = votes.length ? votes : [{ id: null, name: 'The kitchen', slot: -1, world: Math.floor(Math.random() * WORLDS.length) }];
    const win = Math.floor(Math.random() * entries.length);
    const msg = { k: 'dice', entries, win, face: 1 + Math.floor(Math.random() * 6) };
    if (this.room) this.room.broadcast(msg);
    this.rolling = true;
    this.ui.diceRoll(msg, () => { this.rolling = false; if (this.mode === 'lobby') this.startMatch(`${entries[win].world}-${MP_LEVEL}`); });
  }

  /** Most-voted level (ties: earliest vote order, falling back to host's pick). */
  pickLevel() {
    if (this.multi) {
      const v = this.worldVotes().find((q) => q.world != null && this.members.get(q.id)?.host) || this.worldVotes().find((q) => q.world != null);
      return `${v ? v.world : 0}-${MP_LEVEL}`;
    }
    const tally = new Map();
    for (const m of this.memberList()) if (m.vote) tally.set(m.vote, (tally.get(m.vote) || 0) + 1);
    let best = null, bn = 0;
    for (const [k, n] of tally) if (n > bn) { best = k; bn = n; }
    if (best) return best;
    // nothing voted: the first level with no stars yet
    for (let w = 0; w < 8; w++) for (let l = 0; l < 10; l++) if (levelUnlocked(this.save, w, l) && !this.save.stars[`${w}-${l}`]) return `${w}-${l}`;
    return '0-0';
  }

  refresh3d() {
    this.lobby3d.setPlayers(this.memberList());
    this.lobby3d.setTheme(+this.pickLevel().split('-')[0]);
  }

  lobbyState() { return { k: 'lobby', members: this.memberList(), state: this.mode === 'game' ? 'game' : 'lobby' }; }
  lobbyChanged() { if (this.room && this.isHost) this.room.broadcast(this.lobbyState()); this.ui.renderLobby(); this.refresh3d(); }

  // ------------------------------------------------------------ flows
  showTitle() {
    this.mode = 'title';
    this.members.clear();
    this.lobby3d.shift = innerWidth > 860 ? 0.17 : 0; this.lobby3d.fit();
    this.lobby3d.setTheme(0);
    this.lobby3d.setPlayers(OUTFITS.slice(0, 4).map((o, i) => ({ id: 'demo' + i, outfit: ['chef', 'pirate', 'spacesuit', 'wizard'][i], color: [0, 1, 3, 4][i], skin: i, ready: true })));
    this.ui.showTitle();
    if (this.musicOn) playMusic('lobby', 112);
  }

  enterLobby() {
    this.mode = 'lobby';
    this.lobby3d.shift = 0; this.lobby3d.fit();
    this.input.clear();
    this.ui.showLobby();
    this.refresh3d();
    if (this.musicOn) playMusic('lobby', 112);
  }

  solo() {
    this.room = null; this.isHost = true; this.selfId = 'me';
    this.members = new Map([['me', { id: 'me', ...this.profile(), host: true, ready: true, vote: null, joined: 0 }]]);
    this.ui.viewWorld = +this.pickLevel().split('-')[0];
    this.ui.tab = 'level';
    this.enterLobby();
  }

  async host(isPublic) {
    let cancelled = false;
    this.ui.connecting(isPublic ? 'Opening a public kitchen' : 'Opening a private kitchen', () => { cancelled = true; this.showTitle(); });
    try {
      const room = await Room.host({ isPublic });
      if (cancelled) { room.close(); return; }
      this.setupHost(room);
    } catch (e) { if (!cancelled) { this.showTitle(); this.ui.toast('Could not open a room: ' + e.message); } }
  }

  async join(code) {
    let cancelled = false;
    this.ui.connecting(`Joining ${code.toUpperCase()}`, () => { cancelled = true; this.showTitle(); });
    try {
      const room = await Room.join(code, this.profile());
      if (cancelled) { room.close(); return; }
      this.setupClient(room);
    } catch (e) { if (!cancelled) { this.showTitle(); this.ui.toast(e.message); } }
  }

  async quickMatch() {
    let cancelled = false;
    this.ui.connecting('Quick Match', () => { cancelled = true; this.showTitle(); });
    try {
      const { room, hosted } = await Room.quickMatch(this.profile());
      if (cancelled) { room.close(); return; }
      if (hosted) { this.setupHost(room); this.ui.toast('No open kitchens. You are hosting one; others will match into it'); }
      else this.setupClient(room);
    } catch (e) { if (!cancelled) { this.showTitle(); this.ui.toast('Matchmaking failed: ' + e.message); } }
  }

  browse() { return Room.browse(); }

  setupHost(room) {
    this.room = room; this.isHost = true; this.selfId = room.selfId;
    this.members = new Map([[this.selfId, { id: this.selfId, ...this.profile(), host: true, ready: true, vote: null, joined: 0 }]]);
    let joinN = 1;
    room.infoFn = () => ({ name: `${this.profile().name}'s kitchen`, players: this.members.size, max: MAX_PLAYERS, state: this.mode === 'game' ? 'game' : 'lobby', level: this.pickLevel() });
    room.onJoin = (id, hello) => {
      if (this.members.size >= MAX_PLAYERS || this.mode === 'game') { room.send(id, { k: 'full', msg: this.mode === 'game' ? 'That kitchen is mid-service' : 'That kitchen is full' }); setTimeout(() => room.kick(id), 200); return; }
      const outfit = OUTFITS.some((o) => o.id === hello.outfit) ? hello.outfit : 'chef';
      this.members.set(id, { id, name: String(hello.name || 'Chef').slice(0, 14), outfit, color: hello.color | 0, skin: hello.skin | 0, upg: cleanUpg(hello.upg), host: false, ready: false, vote: null, joined: joinN++ });
      room.send(id, { k: 'welcome', you: id });
      this.ui.toast(`${this.members.get(id).name} joined the kitchen`);
      sfx.order();
      this.lobbyChanged();
    };
    room.onLeave = (id) => {
      const m = this.members.get(id);
      if (!m) return;
      this.members.delete(id);
      this.ui.toast(`${m.name} left`);
      if (this.game) this.game.removePlayer(id);
      this.lobbyChanged();
    };
    room.onMessage = (from, m) => {
      const mem = this.members.get(from);
      if (!mem) return;
      if (m.k === 'prof') { for (const k of ['outfit', 'color', 'skin']) if (k in m) mem[k] = m[k]; if ('upg' in m) mem.upg = cleanUpg(m.upg); this.lobbyChanged(); }
      else if (m.k === 'vote') { mem.vote = /^\d$/.test(String(m.key)) ? String(m.key) : null; this.lobbyChanged(); }
      else if (m.k === 'ready') { mem.ready = !!m.v; this.lobbyChanged(); }
      else if (this.game) this.game.onMessage(from, m);
    };
    this.ui.viewWorld = +this.pickLevel().split('-')[0];
    this.enterLobby();
  }

  setupClient(room) {
    this.room = room; this.isHost = false; this.selfId = room.selfId;
    this.members = new Map([[this.selfId, { id: this.selfId, ...this.profile(), host: false, ready: false, vote: null, joined: 99 }]]);
    room.onLeave = () => { if (this.room !== room) return; this.ui.toast('The host closed the kitchen'); this.teardown(); this.showTitle(); };
    room.onMessage = (from, m) => {
      if (m.k === 'lobby') {
        const mine = this.me();
        this.members = new Map(m.members.map((x) => [x.id, x]));
        if (!this.members.has(this.selfId) && mine) this.members.set(this.selfId, mine);
        if (this.mode === 'lobby') { this.ui.renderLobby(); this.refresh3d(); }
      } else if (m.k === 'start') { this.ui.closeDice(); this.beginMatch(m.level, m.roster, m.seed); }
      else if (m.k === 'dice') this.ui.diceRoll(m, () => {});
      else if (m.k === 'end') this.showResults(m.res);
      else if (m.k === 'tolobby') this.backToLobby();
      else if (m.k === 'full' || m.k === 'kicked') { this.ui.toast(m.msg || 'Removed from room'); this.teardown(); this.showTitle(); }
      else if (this.game) this.game.onMessage(from, m);
    };
    this.ui.tab = 'outfit';
    this.enterLobby();
  }

  startMatch(level) {
    if (!this.isHost) return;
    if (!level && this.multi) { this.rollAndStart(); return; }
    const key = level || this.pickLevel();
    const roster = this.memberList().map((m) => ({ id: m.id, name: m.name, outfit: m.outfit, color: m.color, skin: m.skin, upg: cleanUpg(m.upg) }));
    const seed = (Math.random() * 1e9) | 0;
    if (this.room) this.room.broadcast({ k: 'start', level: key, roster, seed });
    this.beginMatch(key, roster, seed);
  }

  beginMatch(level, roster, seed) {
    this.closeResults();
    this.ui.closeDice();
    if (this.game) { this.game.dispose(); this.game = null; }
    this.mode = 'game';
    if (this.isHost) this.lobbyChanged();
    this.input.clear();
    this.paused = false;
    this.game = new Game({
      renderer: this.renderer, room: this.room, selfId: this.selfId, isHost: this.isHost, roster, level, seed,
      hud: this.ui, input: this.input, quality: this.save.settings.quality,
      onEnd: (res) => {
        if (this.isHost) { if (this.room) this.room.broadcast({ k: 'end', res }); this.showResults(res); }
      },
    });
    window.PANIC.game = this.game;
  }

  showResults(res) {
    if (this.resultsEl) return;
    res.coins = recordResult(this.save, res.level, res.stars, res.score);
    res.wallet = this.save.coins;
    const [wi, li] = res.level.split('-').map(Number);
    const nextKey = li >= MP_LEVEL ? null : li < 9 ? `${wi}-${li + 1}` : wi < 7 ? `${wi + 1}-0` : null;
    this.resultsEl = this.ui.showResults(res, {
      isHost: this.isHost,
      hasNext: !!nextKey && levelUnlocked(this.save, ...nextKey.split('-').map(Number)),
      onNext: () => this.startMatch(nextKey),
      onReplay: () => this.startMatch(res.level),
      onLobby: () => { if (this.room) this.room.broadcast({ k: 'tolobby' }); this.backToLobby(); },
      onLeave: () => this.leave(),
      // solo, no stars: a (placeholder) ad skips the level and opens the next one
      onSkip: !this.room && res.stars === 0 && nextKey ? () => { skipLevel(this.save, res.level); this.startMatch(nextKey); } : null,
    });
    this.lastResult = res;
  }
  closeResults() { if (this.resultsEl) { this.resultsEl.remove(); this.resultsEl = null; } }

  backToLobby() {
    this.closeResults();
    if (this.game) { this.game.dispose(); this.game = null; }
    for (const m of this.members.values()) if (!m.host) m.ready = false;
    this.enterLobby();
    if (this.isHost) this.lobbyChanged();
  }

  togglePause() {
    if (!this.game || this.game.ended) return;
    if (this.pauseClose) { this.pauseClose(); this.pauseClose = null; this.game.paused = false; return; }
    this.game.paused = true;
    this.input.clear();
    this.pauseClose = this.ui.pauseMenu(
      () => { if (this.pauseClose) { this.pauseClose(); this.pauseClose = null; } if (this.game) this.game.paused = false; },
      () => { this.pauseClose = null; if (this.isHost) { if (this.room) this.room.broadcast({ k: 'tolobby' }); this.backToLobby(); } else this.leave(); },
      this.isHost, !!this.room,
    );
  }

  leave() {
    this.teardown();
    this.showTitle();
  }

  teardown() {
    this.closeResults();
    if (this.pauseClose) { this.pauseClose(); this.pauseClose = null; }
    if (this.game) { this.game.dispose(); this.game = null; }
    if (this.room) { const r = this.room; this.room = null; r.close(); }
    this.isHost = true; this.selfId = 'me';
  }
}

const app = new App();
// test / debug hooks
window.PANIC = { app, ready: true, local: isLocalNet(), game: null, finalState };
window.dev = installDev(app);
