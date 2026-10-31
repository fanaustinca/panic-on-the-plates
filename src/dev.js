// Developer console: press ` (backquote) to open, type `help`. Also reachable as window.dev.run('...').
import { OUTFITS, BOXES, UPGRADES, UPGRADE_MAX, WORLDS, cleanUpg } from './config.js';
import { writeSave, openBox } from './save.js';
import { starThresholds } from './sim.js';
import { MP_LEVEL } from './levels.js';
import { initAudio, playMusic, songList } from './audio.js';

const HELP = `commands:
  coins <n>              add n coins (negative takes them away)
  give <outfit|all>      unlock an outfit (or every outfit)
  outfits                list outfit ids
  box <bronze|silver|gold> [n]   open n gift boxes for free
  upg <id|all> <0-5>     set an upgrade tier (ids: ${UPGRADES.map((g) => g.id).join(', ')})
  stars <w-l|all> <0-3>  set stars on a level (w, l from 1), e.g. stars 3-4 2
  unlock                 open every level (marks them all skipped)
  play <w-l>             start a solo level, e.g. play 8-3 (mp for the multiplayer kitchen: play 8-mp)
  win [stars]            end the current round now with that many stars (default 3)
  time <s>               set the seconds left in the current round
  speed <x>              game speed multiplier (1 = normal)
  music <world> [1|2] [final]   preview a song (worlds: lobby, ${WORLDS.map((w) => w.id).join(', ')}); music list
  fps                    toggle an fps counter
  reset yes              wipe the save
  clear                  clear this log`;

export function installDev(app) {
  let box = null, log = null, fpsEl = null;
  const hist = []; let hi = 0;
  const out = (msg, cls = '') => { if (!log) return; const d = document.createElement('div'); d.className = cls; d.textContent = msg; log.appendChild(d); log.scrollTop = 1e9; };
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
    give: (id) => {
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
  return { run, toggle };
}
