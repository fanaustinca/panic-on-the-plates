// Local profile + campaign progress (localStorage, wrapped so private mode still works).
import { WORLDS, OUTFITS, COLORS, cleanUpg, UPGRADE_COST, UPGRADE_MAX } from './config.js';

const KEY = 'panic-plates-save-v1';
const defaults = () => ({ name: '', outfit: 'chef', color: 0, skin: 0, stars: {}, best: {}, coins: 0, upg: {}, settings: { sfx: 0.8, music: 0.45, quality: 'high' } });

export function loadSave() {
  let s;
  try { s = { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { s = defaults(); }
  s.upg = cleanUpg(s.upg); s.coins = Math.max(0, s.coins | 0);
  return s;
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ } }

const unlockAll = () => new URLSearchParams(location.search).has('unlock');
export const totalStars = (s) => Object.values(s.stars).reduce((a, b) => a + b, 0);
export const worldNeed = (wi) => wi * 12;
export function worldUnlocked(s, wi) { return unlockAll() || totalStars(s) >= worldNeed(wi); }
/** The first level of every world is always open; the rest need the world's star gate + a star on the previous level. */
export function levelUnlocked(s, wi, li) {
  if (unlockAll() || li === 0) return true;
  if (!worldUnlocked(s, wi)) return false;
  return (s.stars[`${wi}-${li - 1}`] || 0) > 0;
}
export function outfitUnlocked(s, id) {
  const o = OUTFITS.find((q) => q.id === id);
  return !o || o.world < 0 || worldUnlocked(s, o.world);
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
export const upgradeCost = (s, id) => ((s.upg[id] | 0) >= UPGRADE_MAX ? null : UPGRADE_COST[s.upg[id] | 0]);
export function buyUpgrade(s, id) {
  const c = upgradeCost(s, id);
  if (c == null || s.coins < c) return false;
  s.coins -= c; s.upg[id] = (s.upg[id] | 0) + 1;
  writeSave(s);
  return true;
}
export { WORLDS, COLORS };
