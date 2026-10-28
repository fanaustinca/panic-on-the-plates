// Local profile + campaign progress (localStorage, wrapped so private mode still works).
import { WORLDS, OUTFITS, COLORS } from './config.js';

const KEY = 'panic-plates-save-v1';
const defaults = () => ({ name: '', outfit: 'chef', color: 0, skin: 0, stars: {}, best: {}, settings: { sfx: 0.8, music: 0.45, quality: 'high' } });

export function loadSave() {
  try { return { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return defaults(); }
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ } }

const unlockAll = () => new URLSearchParams(location.search).has('unlock');
export const totalStars = (s) => Object.values(s.stars).reduce((a, b) => a + b, 0);
export const worldNeed = (wi) => wi * 12;
export function worldUnlocked(s, wi) { return unlockAll() || totalStars(s) >= worldNeed(wi); }
export function levelUnlocked(s, wi, li) {
  if (unlockAll()) return true;
  if (!worldUnlocked(s, wi)) return false;
  return li === 0 || (s.stars[`${wi}-${li - 1}`] || 0) > 0;
}
export function outfitUnlocked(s, id) {
  const o = OUTFITS.find((q) => q.id === id);
  return !o || o.world < 0 || worldUnlocked(s, o.world);
}
export function recordResult(s, key, stars, score) {
  s.stars[key] = Math.max(s.stars[key] || 0, stars);
  s.best[key] = Math.max(s.best[key] || 0, score);
  writeSave(s);
}
export { WORLDS, COLORS };
