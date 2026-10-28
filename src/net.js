// Peer-to-peer networking (star topology: the host runs the kitchen).
//  - PeerEndpoint: WebRTC data channels via PeerJS's public signalling server.
//  - LocalEndpoint: BroadcastChannel between tabs of one browser (?net=local, headless tests).
// Room matching needs no server of our own: public rooms live at well-known peer ids
// (PREFIX-pub-0..N). Quick Match probes every slot, joins the fullest open lobby, or hosts one.
import Peer from 'peerjs';

export const PREFIX = 'panic-plates-v1-';
export const PUBLIC_SLOTS = 12;
const slotId = (i) => `${PREFIX}pub-${i}`;
const codeId = (code) => `${PREFIX}room-${code.toUpperCase()}`;

export function roomCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}
const timeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} timed out`)), ms))]);

// ------------------------------------------------------------------ endpoints

class PeerEndpoint {
  static async create(id) {
    const e = new PeerEndpoint();
    e.peer = id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
    e.pending = new Map();
    await timeout(new Promise((res, rej) => {
      e.peer.on('open', (pid) => { e.id = pid; res(); });
      e.peer.on('error', (err) => {
        if (!e.id) { rej(err.type === 'unavailable-id' ? Object.assign(new Error('taken'), { taken: true }) : err); return; }
        if (err.type === 'peer-unavailable') {
          for (const [pid, p] of e.pending) if (String(err.message).includes(pid)) { p.rej(new Error('unavailable')); e.pending.delete(pid); }
        }
      });
    }), 12000, 'Connecting to matchmaking');
    e.peer.on('disconnected', () => { try { e.peer.reconnect(); } catch { /* destroyed */ } });
    return e;
  }
  listen(onConn) {
    this.peer.on('connection', (c) => c.on('open', () => onConn(wrapPeerConn(c))));
  }
  connect(id, ms = 6000) {
    return timeout(new Promise((res, rej) => {
      const c = this.peer.connect(id, { reliable: true, serialization: 'json' });
      this.pending.set(id, { rej });
      c.on('open', () => { this.pending.delete(id); res(wrapPeerConn(c)); });
      c.on('error', (err) => rej(err));
    }), ms, 'Connecting').finally(() => this.pending.delete(id));
  }
  destroy() { try { this.peer.destroy(); } catch { /* already */ } }
}
function wrapPeerConn(c) {
  const conn = { peer: c.peer, data: [], close: [], send: (m) => { if (c.open) c.send(m); }, end: () => c.close() };
  c.on('data', (d) => conn.data.forEach((f) => f(d)));
  c.on('close', () => conn.close.forEach((f) => f()));
  c.on('error', () => conn.close.forEach((f) => f()));
  return conn;
}

class LocalEndpoint {
  static lag = 0;
  static async create(id) {
    const e = new LocalEndpoint();
    e.ch = new BroadcastChannel('panic-plates-local');
    e.conns = new Map();
    e.id = id || 'local-' + Math.random().toString(36).slice(2, 9);
    e.waiting = new Map();
    let taken = false;
    const nonce = Math.random();
    e.ch.onmessage = (ev) => {
      const m = ev.data;
      if (m.sys === 'taken' && m.nonce === nonce) taken = true;
      if (m.sys === 'claim' && m.id === e.id && m.nonce !== nonce && e.ready) e.ch.postMessage({ sys: 'taken', nonce: m.nonce });
      if (m.to !== e.id) return;
      if (m.sys === 'conn' && e.onConn) {
        const c = e.makeConn(m.cid, m.from);
        e.ch.postMessage({ sys: 'accept', cid: m.cid, from: e.id, to: m.from });
        e.onConn(c);
      } else if (m.sys === 'accept') { const w = e.waiting.get(m.cid); if (w) { e.waiting.delete(m.cid); w(e.makeConn(m.cid, m.from)); } }
      else if (m.sys === 'data') { const c = e.conns.get(m.cid); if (c) { if (LocalEndpoint.lag) setTimeout(() => c.data.forEach((f) => f(m.d)), LocalEndpoint.lag); else c.data.forEach((f) => f(m.d)); } }
      else if (m.sys === 'close') { const c = e.conns.get(m.cid); if (c) { e.conns.delete(m.cid); c.close.forEach((f) => f()); } }
    };
    if (id) {
      e.ch.postMessage({ sys: 'claim', id, nonce });
      await new Promise((r) => setTimeout(r, 150));
      if (taken) { e.ch.close(); throw Object.assign(new Error('taken'), { taken: true }); }
    }
    e.ready = true;
    return e;
  }
  makeConn(cid, peer) {
    const conn = { peer, data: [], close: [], send: (d) => this.ch.postMessage({ sys: 'data', cid, from: this.id, to: peer, d }), end: () => { this.ch.postMessage({ sys: 'close', cid, from: this.id, to: peer }); this.conns.delete(cid); } };
    this.conns.set(cid, conn);
    return conn;
  }
  listen(onConn) { this.onConn = onConn; }
  connect(id, ms = 1500) {
    const cid = Math.random().toString(36).slice(2);
    return timeout(new Promise((res) => { this.waiting.set(cid, res); this.ch.postMessage({ sys: 'conn', cid, from: this.id, to: id }); }), ms, 'Connecting').catch((e) => { this.waiting.delete(cid); throw e; });
  }
  destroy() {
    for (const [cid, c] of this.conns) { this.ch.postMessage({ sys: 'close', cid, from: this.id, to: c.peer }); }
    this.ch.close();
  }
}

const Endpoint = () => (new URLSearchParams(location.search).get('net') === 'local' ? LocalEndpoint : PeerEndpoint);
export const isLocalNet = () => Endpoint() === LocalEndpoint;

// ------------------------------------------------------------------ room

export class Room {
  constructor(ep, isHost) {
    this.ep = ep;
    this.isHost = isHost;
    this.selfId = ep.id;
    this.conns = new Map(); // peerId -> conn (host: all members; client: just the host)
    this.onMessage = () => {};
    this.onJoin = () => {};
    this.onLeave = () => {};
    this.infoFn = () => ({});
    this.code = null;
    this.isPublic = false;
  }

  attach(conn, member) {
    conn.data.push((m) => {
      if (m && m.k === 'probe' && this.isHost) { conn.send({ k: 'info', ...this.infoFn() }); return; }
      if (m && m.k === 'hello' && this.isHost && !this.conns.has(conn.peer)) { this.conns.set(conn.peer, conn); this.onJoin(conn.peer, m); return; }
      this.onMessage(conn.peer, m);
    });
    conn.close.push(() => { if (this.conns.delete(conn.peer)) this.onLeave(conn.peer); });
    if (member) this.conns.set(conn.peer, conn);
  }

  static async host({ isPublic = true, code = null } = {}) {
    const E = Endpoint();
    let ep = null, slot = -1;
    if (isPublic) {
      for (let i = 0; i < PUBLIC_SLOTS && !ep; i++) {
        try { ep = await E.create(slotId(i)); slot = i; } catch (e) { if (!e.taken) throw e; }
      }
      if (!ep) throw new Error('All public rooms are busy — try a private room');
    } else {
      for (let k = 0; k < 5 && !ep; k++) {
        code = code || roomCode();
        try { ep = await E.create(codeId(code)); } catch (e) { if (!e.taken) throw e; code = null; }
      }
    }
    const r = new Room(ep, true);
    r.isPublic = isPublic;
    r.code = isPublic ? `PUB${slot + 1}` : code;
    ep.listen((conn) => r.attach(conn, false));
    return r;
  }

  /** Join by room code (private codes, or PUB# for public slots). */
  static async join(code, hello) {
    const E = Endpoint();
    const ep = await E.create(null);
    const m = /^PUB(\d+)$/i.exec(code.trim());
    const id = m ? slotId(+m[1] - 1) : codeId(code.trim());
    let conn;
    try { conn = await ep.connect(id, 8000); } catch { ep.destroy(); throw new Error(`Room ${code.toUpperCase()} not found`); }
    const r = new Room(ep, false);
    r.code = code.toUpperCase();
    r.attach(conn, true);
    conn.send({ k: 'hello', ...hello });
    return r;
  }

  /** Probe every public slot; returns [{ slot, info }] for rooms that answered. */
  static async scan(ep) {
    const found = [];
    await Promise.all(Array.from({ length: PUBLIC_SLOTS }, async (_, i) => {
      try {
        const conn = await ep.connect(slotId(i), 3500);
        const info = await timeout(new Promise((res) => { conn.data.push((m) => { if (m.k === 'info') res(m); }); conn.send({ k: 'probe' }); }), 2500, 'probe');
        found.push({ slot: i, info, conn });
      } catch { /* empty slot */ }
    }));
    return found;
  }

  /** Room browser listing (closes the probe connections). */
  static async browse() {
    const ep = await Endpoint().create(null);
    try {
      const found = await Room.scan(ep);
      found.forEach((f) => f.conn.end());
      return found.map((f) => ({ code: `PUB${f.slot + 1}`, ...f.info })).sort((a, b) => a.code.localeCompare(b.code));
    } finally { setTimeout(() => ep.destroy(), 200); }
  }

  /** Join the fullest open public lobby, or host a new public one. Returns { room, hosted }. */
  static async quickMatch(hello) {
    const ep = await Endpoint().create(null);
    const found = await Room.scan(ep);
    const open = found.filter((f) => f.info.state === 'lobby' && f.info.players < f.info.max).sort((a, b) => b.info.players - a.info.players);
    if (open.length) {
      const pick = open[0];
      found.forEach((f) => { if (f !== pick) f.conn.end(); });
      const r = new Room(ep, false);
      r.code = `PUB${pick.slot + 1}`;
      r.isPublic = true;
      r.attach(pick.conn, true);
      pick.conn.send({ k: 'hello', ...hello });
      return { room: r, hosted: false };
    }
    found.forEach((f) => f.conn.end());
    ep.destroy();
    return { room: await Room.host({ isPublic: true }), hosted: true };
  }

  send(to, msg) { const c = this.conns.get(to); if (c) c.send(msg); }
  broadcast(msg, except) { for (const [id, c] of this.conns) if (id !== except) c.send(msg); }
  toHost(msg) { for (const c of this.conns.values()) c.send(msg); }
  kick(id) { const c = this.conns.get(id); if (c) { c.send({ k: 'kicked' }); setTimeout(() => c.end(), 100); } }
  close() { for (const c of this.conns.values()) { try { c.end(); } catch { /* gone */ } } this.conns.clear(); setTimeout(() => this.ep.destroy(), 100); }
}
