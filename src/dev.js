// Developer console: press ` (backquote) to open, type `help`. Also in the browser's F12 console:
// dev.help() lists every command, and each one is a function there too, e.g. dev.coins(500), dev.play('3-4').
import { OUTFITS, BOXES, UPGRADES, UPGRADE_MAX, WORLDS, INGREDIENTS, cleanUpg } from './config.js';
import { writeSave, openBox } from './save.js';
import { starThresholds, rushStart } from './sim.js';
import { MP_LEVEL } from './levels.js';
import { initAudio, playMusic, songList } from './audio.js';

const HELP = `commands:
  coins <n>              add n coins (negative takes them away)
  give <outfit|all>      unlock an outfit (or every outfit)
  outfits                list outfit ids
  box <bronze|silver|gold|diamond> [n]   open n gift boxes for free
  upg <id|all> <0-5>     set an upgrade tier (ids: ${UPGRADES.map((g) => g.id).join(', ')})
  stars <w-l|all> <0-3>  set stars on a level (w, l from 1), e.g. stars 3-4 2
  unlock                 open every level (marks them all skipped)
  play <w-l>             start a solo level, e.g. play 8-3 (mp for the multiplayer kitchen: play 8-mp)
  win [stars]            end the current round now with that many stars (default 3)
  time <s>               set the seconds left in the current round
  speed <x>              game speed multiplier (1 = normal)
  gold                   a golden (food critic) order right now
  rush                   jump the clock to rush hour
  couch <kb2|pad0..3|off>  add a couch co-op cook on the arrow keys or a gamepad (off removes them all)
  give food <ing>        put an ingredient in your hands (for throwing practice); food lists the ids
  music <world> [1|2] [final]   preview a song (worlds: lobby, ${WORLDS.map((w) => w.id).join(', ')}); music list
  fps                    toggle an fps counter
  reset yes              wipe the save
  clear                  clear this log`;

export function installDev(app) {
  let box = null, log = null, fpsEl = null;
  const hist = []; let hi = 0;
  let viaConsole = false; // a call from the F12 console prints there instead of the in-game panel
  const out = (msg, cls = '') => { if (viaConsole) { (cls === 'err' ? console.warn : console.log)(msg); return; } if (!log) return; const d = document.createElement('div'); d.className = cls; d.textContent = msg; log.appendChild(d); log.scrollTop = 1e9; };
  const s = () => app.save;
  const save = () => { writeSave(s()); if (app.me && app.me()) app.setProfile({ upg: cleanUpg(s().upg) }); else if (app.ui.renderSide) app.ui.renderSide(); };
  const lvl = (str) => {
    const [w, l] = String(str || '').split('-');
    const wi = +w - 1, li = l === 'mp' ? MP_LEVEL : +l - 1;
    if (!(wi >= 0 && wi < WORLDS.length && li >= 0 && (li < 10 || li === MP_LEVEL))) throw new Error(`bad level "${str}" (use world-level, e.g. 3-4)`);
    return [wi, li];
  };
  const C = {
    help: () => out(HELP),
    clear: () => { log.innerHTML = ''; },
    music: (w, n, f) => {
      if (!w || w === 'list') return out(songList());
      if (n === 'final') [n, f] = [1, 'final'];
      initAudio(); playMusic(w, 0, 'dev', { song: Math.max(0, (parseInt(n, 10) || 1) - 1), final: f === 'final' });
      out(`playing ${w} song ${parseInt(n, 10) || 1}${f === 'final' ? ' (final 30 s arrangement)' : ''}`);
    },
    coins: (n) => { s().coins = Math.max(0, (s().coins | 0) + (parseInt(n, 10) || 0)); save(); out(`coins: ${s().coins}`); },
    outfits: () => out(OUTFITS.map((o) => `${o.id} (${['common', 'rare', 'epic', 'legendary', 'chroma'][o.tier]})`).join('\n')),
    give: (id, what) => {
      if (id === 'food') {
        const g = app.game, p = g && g.sim.player(app.selfId);
        if (!p || !g.isHost) throw new Error('start a round first');
        if (!what || !INGREDIENTS[what]) return out('food ids: ' + Object.keys(INGREDIENTS).join(', '));
        p.held = { kind: 'ing', ing: what, s: 'raw', p: 0 }; out(`holding ${INGREDIENTS[what].name}`); return;
      }
      const ids = id === 'all' ? OUTFITS.map((o) => o.id) : [id];
      for (const q of ids) { if (!OUTFITS.some((o) => o.id === q)) throw new Error(`no outfit "${q}" (try: outfits)`); if (!s().owned.includes(q)) s().owned.push(q); }
      save(); out(`unlocked ${ids.length} outfit${ids.length > 1 ? 's' : ''}`);
    },
    box: (id = 'gold', n = 1) => {
      if (!BOXES.some((b) => b.id === id)) throw new Error(`no box "${id}"`);
      for (let k = 0; k < Math.min(50, +n || 1); k++) {
        const r = openBox(s(), id, Math.random, true);
        out(r.kind === 'skin' ? `outfit: ${r.id}` : r.kind === 'dupe' ? `duplicate ${r.id}: +${r.coins} coins` : r.kind === 'upg' ? `upgrade: ${r.ids.join(', ')}` : `coins: +${r.coins}`);
      }
      save();
    },
    upg: (id, n) => {
      const tier = Math.max(0, Math.min(UPGRADE_MAX, parseInt(n, 10) || 0));
      const ids = id === 'all' ? UPGRADES.map((g) => g.id) : [id];
      for (const q of ids) { if (!UPGRADES.some((g) => g.id === q)) throw new Error(`no upgrade "${q}"`); s().upg[q] = tier; }
      save(); out(`upgrades: ${JSON.stringify(s().upg)}`);
    },
    stars: (where, n) => {
      const k = Math.max(0, Math.min(3, parseInt(n, 10) || 0));
      const keys = where === 'all' ? WORLDS.flatMap((_, wi) => Array.from({ length: 10 }, (_, li) => `${wi}-${li}`)) : [lvl(where).join('-')];
      for (const key of keys) { if (k) s().stars[key] = k; else delete s().stars[key]; }
      save(); out(`set ${keys.length} level${keys.length > 1 ? 's' : ''} to ${k} star${k === 1 ? '' : 's'}`);
    },
    unlock: () => { WORLDS.forEach((_, wi) => { for (let li = 0; li < 10; li++) s().skipped[`${wi}-${li}`] = true; }); save(); out('every level is open'); },
    play: (where) => {
      const [wi, li] = lvl(where);
      if (!app.members || !app.me || !app.me()) app.solo();
      app.startMatch(`${wi}-${li}`); out(`starting ${wi + 1}-${li === MP_LEVEL ? 'mp' : li + 1}`);
    },
    win: (n = 3) => {
      const g = app.game; if (!g || !g.isHost) throw new Error('no round running here (or you are not the host)');
      const th = starThresholds(g.L, g.sim.players.length), k = Math.max(0, Math.min(3, +n));
      g.sim.score = k ? th[k - 1] : 0;
      g.sim.t = g.L.duration; out(`ending the round with ${k} star${k === 1 ? '' : 's'}`);
    },
    time: (sec) => { const g = app.game; if (!g || !g.isHost) throw new Error('no round running here'); g.sim.t = Math.max(0, g.L.duration - (+sec || 0)); out(`${sec}s left`); },
    gold: () => { const g = app.game; if (!g || !g.isHost) throw new Error('no round running here'); const o = g.sim.spawnOrder(); o.gold = 1; out(`golden order: ${g.L.recipes[o.r].name}`); },
    rush: () => { const g = app.game; if (!g || !g.isHost) throw new Error('no round running here'); const at = rushStart(g.L); if (!Number.isFinite(at)) throw new Error('this level has no rush hour'); g.sim.t = at; out('rush hour!'); },
    couch: (c = 'kb2') => {
      if (c === 'off') { [...app.couch].forEach((q) => app.removeLocal(q.id)); return out('couch cooks removed'); }
      if (!/^(kb2|pad[0-3])$/.test(c)) throw new Error('couch kb2 | pad0..pad3 | off');
      if (app.mode !== 'lobby') { if (app.game) throw new Error('add couch cooks in the lobby'); app.solo(); }
      out(app.addLocal(c) ? `added a cook on ${c}` : 'could not add (already there, or the kitchen is full)');
    },
    speed: (x) => { app.devSpeed = Math.max(0.1, Math.min(8, +x || 1)); out(`speed x${app.devSpeed}`); },
    fps: () => {
      if (fpsEl) { fpsEl.remove(); fpsEl = null; return; }
      fpsEl = document.createElement('div');
      fpsEl.style.cssText = 'position:fixed;top:6px;left:50%;transform:translateX(-50%);z-index:9999;font:12px monospace;color:#5ad15a;background:rgba(0,0,0,.6);padding:2px 8px;border-radius:6px';
      document.body.appendChild(fpsEl);
      let n = 0, t0 = performance.now();
      const tick = () => { if (!fpsEl) return; n++; const now = performance.now(); if (now - t0 > 500) { fpsEl.textContent = `${Math.round((n * 1000) / (now - t0))} fps`; n = 0; t0 = now; } requestAnimationFrame(tick); };
      tick();
    },
    reset: (yes) => { if (yes !== 'yes') throw new Error('type "reset yes" to wipe the save'); localStorage.removeItem('panic-plates-save-v1'); out('save wiped: reloading'); setTimeout(() => location.reload(), 400); },
  };
  const run = (line) => {
    const [cmd, ...args] = line.trim().split(/\s+/);
    if (!cmd) return;
    out('> ' + line, 'in');
    try { if (!C[cmd]) throw new Error(`unknown command "${cmd}" (try: help)`); C[cmd](...args); } catch (e) { out(e.message, 'err'); }
  };
  const toggle = () => {
    if (box) { box.remove(); box = null; log = null; return; }
    box = document.createElement('div');
    box.className = 'devcon';
    box.innerHTML = '<div class="log"></div><input placeholder="dev command (help)" spellcheck="false" />';
    document.body.appendChild(box);
    log = box.querySelector('.log');
    const inp = box.querySelector('input');
    out('Panic on the Plates dev console. Type help.');
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation(); // keep the cook still while typing
      if (e.key === 'Enter') { hist.push(inp.value); hi = hist.length; run(inp.value); inp.value = ''; }
      else if (e.key === 'ArrowUp' && hi > 0) inp.value = hist[--hi];
      else if (e.key === 'ArrowDown') { hi = Math.min(hist.length, hi + 1); inp.value = hist[hi] || ''; }
      else if (e.key === '`' || e.key === 'Escape') { e.preventDefault(); toggle(); }
    });
    inp.addEventListener('keyup', (e) => e.stopPropagation());
    setTimeout(() => inp.focus(), 0);
  };
  addEventListener('keydown', (e) => { if (e.key === '`' && !box && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); toggle(); } });
  // F12 console API: dev.help() and one function per command, arguments as in the panel
  const api = { run, toggle };
  const call = (cmd, args) => {
    viaConsole = true;
    try { C[cmd](...args.map((a) => (a == null ? a : String(a)))); } catch (e) { console.warn(e.message); } finally { viaConsole = false; }
  };
  for (const cmd of Object.keys(C)) if (cmd !== 'clear') api[cmd] = (...args) => call(cmd, args);
  api.help = () => {
    const lines = HELP.split('\n').slice(1).filter((l) => !/^\s*clear\b/.test(l)).map((l) => {
      const m = l.match(/^\s{2}(\S+)((?:\s+[<\[][^>\]]+[>\]])*)\s{2,}(.*)$/);
      if (!m) return l.replace(/^\s{2}reset yes\s+/, "  dev.reset('yes')".padEnd(46));
      const args = (m[2].match(/[<\[][^>\]]+[>\]]/g) || []).map((a) => (a.startsWith('[') ? a.slice(1, -1) + '?' : a.slice(1, -1)));
      return `  dev.${m[1]}(${args.join(', ')})`.padEnd(46) + m[3];
    });
    console.log(`%cPanic on the Plates dev commands%c\n${lines.join('\n')}\n\nExamples: dev.coins(500)  dev.give('all')  dev.box('gold', 5)  dev.play('3-4')  dev.win(3)  dev.music('pirate', 2, 'final')  dev.box('diamond')  dev.couch('kb2')  dev.gold()  dev.rush()\nThe same commands work in the in-game console (press \` and type them without dev. or brackets).`, 'font-weight:bold;font-size:13px;color:#ffb21a', '');
  };
  return api;
}
