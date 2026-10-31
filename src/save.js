// Local profile + campaign progress (localStorage, wrapped so private mode still works).
import { WORLDS, OUTFITS, COLORS, cleanUpg, UPGRADES, UPGRADE_MAX, BOXES } from './config.js';

const KEY = 'panic-plates-save-v1';
const defaults = () => ({ name: '', outfit: 'chef', color: 0, skin: 0, stars: {}, best: {}, coins: 0, upg: {}, owned: [], skipped: {}, boxes: 0, settings: { sfx: 0.8, music: 0.45, quality: 'high' } });

export function loadSave() {
  let s;
  try { s = { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { s = defaults(); }
  s.upg = cleanUpg(s.upg); s.coins = Math.max(0, s.coins | 0);
  if (!Array.isArray(s.owned)) s.owned = [];
  if (!s.skipped || typeof s.skipped !== 'object') s.skipped = {};
  return s;
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ } }

const unlockAll = () => typeof location !== 'undefined' && new URLSearchParams(location.search).has('unlock');
export const totalStars = (s) => Object.values(s.stars).reduce((a, b) => a + b, 0);
/** Every world is open from the start: play them in any order. */
export function worldUnlocked() { return true; }
/** Level 1 of every world is always open; each next level needs a star on the one before (or an ad skip). */
export function levelUnlocked(s, wi, li) {
  if (unlockAll() || li === 0) return true;
  const prev = `${wi}-${li - 1}`;
  return (s.stars[prev] || 0) > 0 || !!(s.skipped && s.skipped[prev]);
}
/** Mark a level as skipped (after watching an ad), which opens the next one. */
export function skipLevel(s, key) { s.skipped[key] = true; writeSave(s); }
/** Classic whites are free; world outfits come from clearing that world's level 1; the rest from gift boxes. */
export function outfitUnlocked(s, id) {
  const o = OUTFITS.find((q) => q.id === id);
  if (!o || o.world === -1 || unlockAll() || (s.owned || []).includes(id)) return true;
  return o.world >= 0 && (s.stars[`${o.world}-0`] || 0) > 0;
}
/** Records a finished shift and pays out coins; returns the coins earned. */
export function recordResult(s, key, stars, score) {
  const newStars = Math.max(0, stars - (s.stars[key] || 0));
  s.stars[key] = Math.max(s.stars[key] || 0, stars);
  s.best[key] = Math.max(s.best[key] || 0, score);
  const coins = Math.floor(Math.max(0, score) / 4) + stars * 15 + newStars * 30;
  s.coins = (s.coins | 0) + coins;
  writeSave(s);
  return coins;
}

/**
 * Open a gift box: pays for it and grants one surprise. Returns null if unaffordable, otherwise
 * { kind: 'skin', id, tier } | { kind: 'dupe', id, tier, coins } | { kind: 'upg', ids: [...] } | { kind: 'coins', coins }.
 * rand: () => [0, 1) (Math.random in the game, seeded in the tests). free: dev command, no charge.
 */
export function openBox(s, boxId, rand = Math.random, free = false) {
  const B = BOXES.find((b) => b.id === boxId);
  if (!B || (!free && s.coins < B.cost)) return null;
  if (!free) s.coins -= B.cost;
  s.boxes = (s.boxes | 0) + 1;
  const coinsOut = () => { const c = Math.round(B.coins[0] + rand() * (B.coins[1] - B.coins[0])); s.coins += c; return { kind: 'coins', coins: c }; };
  let res;
  const roll = rand();
  if (roll < B.odds.skin) {
    const wsum = B.tiers.reduce((a, b) => a + b, 0);
    let w = rand() * wsum, tier = 0;
    while (tier < B.tiers.length - 1 && w >= B.tiers[tier]) { w -= B.tiers[tier]; tier++; }
    const pool = OUTFITS.filter((o) => o.tier === tier && o.world !== -1);
    const fresh = pool.filter((o) => !outfitUnlocked(s, o.id));
    if (fresh.length) {
      const o = fresh[Math.floor(rand() * fresh.length)];
      s.owned.push(o.id);
      res = { kind: 'skin', id: o.id, tier };
    } else {
      // already have every outfit of that tier: a duplicate pays out instead
      const o = pool[Math.floor(rand() * pool.length)], c = Math.round(B.cost * 0.4 * (1 + tier * 0.5));
      s.coins += c;
      res = { kind: 'dupe', id: o.id, tier, coins: c };
    }
  } else if (roll < B.odds.skin + B.odds.upg) {
    const ids = [];
    for (let k = 0; k < (B.upgN || 1); k++) {
      const open = UPGRADES.filter((g) => (s.upg[g.id] | 0) < UPGRADE_MAX);
      if (!open.length) break;
      const g = open[Math.floor(rand() * open.length)];
      s.upg[g.id] = (s.upg[g.id] | 0) + 1;
      ids.push(g.id);
    }
    res = ids.length ? { kind: 'upg', ids } : coinsOut();
  } else res = coinsOut();
  writeSave(s);
  return res;
}
export { WORLDS, COLORS };
