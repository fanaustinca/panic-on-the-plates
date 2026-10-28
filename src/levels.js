// Deterministic level builder: 8 worlds x 10 levels, every layout generated from a fixed seed
// and checked for reachability (see validate). Pure data, no Three.js, so node tests can import it.
import { WORLDS, LEVEL_RECIPES, worldRecipes, T } from './config.js';
import { rng, hash } from './rng.js';

export const LEVELS_PER_WORLD = 10;
/** Index of each world's multiplayer kitchen (bigger, more workstations); key `${wi}-10`. */
export const MP_LEVEL = 10;
const MP_TITLES = ['Fleet Galley', 'Ice Station Banquet', 'Magma Mess Hall', 'Orbital Canteen', 'Sky Palace Feast', 'Treetop Village', 'Mega Plant', 'Grand Archive'];

const TITLES = [
  ['Galley Ho!', 'Plank Prep', 'Two Decks', 'Brig Brunch', 'Cannon Kitchen', 'Keelhaul Kitchen', 'Mutiny Mise', "Crow's Nest Cuisine", 'Kraken Shallows', "Captain's Table"],
  ['First Frost', 'Thin Ice', 'Floe Motion', 'Igloo Line', 'Polar Plates', 'Crevasse Café', 'Drift Dinner', 'Avalanche Alley', 'Mammoth Rush', 'Frozen Throne'],
  ['Warm Welcome', 'Cinder Station', 'Ember Shift', 'Geyser Grill', 'Ash Alley', 'Fire Wall Feast', 'Molten Mise', 'Pyroclastic Prep', 'Caldera Crunch', 'Heart of the Core'],
  ['Docking Bay Diner', 'Zero-G Grill', 'Laser Lunch', 'Orbital Oven', 'Airlock Appetizers', 'Gravity Well', 'Meteor Shower', 'Reactor Room', 'Dark Side Deli', 'Mission Critical'],
  ['Cloud Nine Café', 'Tailwind Table', 'Gust Front', 'Sky Bridge Bistro', 'Thunder Prep', 'Jet Stream Kitchen', 'Cumulus Cuisine', 'Storm Cell', 'Eye of the Storm', 'Stratosphere Supper'],
  ['Treetop Takeout', 'Monkey Business', 'Rope Bridge Run', 'Canopy Kitchen', 'Vine Dining', 'Banana Heist', 'Swinging Skillets', 'Lost Temple Lunch', 'Howler Hollow', 'King of the Canopy'],
  ['Clock In', 'Belt Drive', 'Assembly Line', 'Lever Lunch', 'Hot Rivets', 'Night Shift', 'Overtime', 'Quality Control', 'Full Throttle', 'Mainframe Feast'],
  ['Quiet Please', 'Overdue Orders', 'Tick Tock Toast', 'Grimoire Grill', 'The Cuckoo Hour', 'Hourglass Hall', 'Midnight Index', 'Pendulum Pantry', 'Time Loop Lunch', 'Clockwork Finale'],
];
export const levelTitle = (wi, li) => (li === MP_LEVEL ? MP_TITLES[wi] : TITLES[wi][li]);
export const levelKey = (wi, li) => `${wi}-${li}`;

const SOLID = new Set(['counter']); // blocks movement (walls handled separately)
export const isCounter = (t) => t && t.k === 'counter';
export const isBlocking = (t) => !t || t.k === 'counter' || t.k === 'wall';

/**
 * Build level li (0..9) of world wi (0..7). Retries seeds until the layout validates, so the
 * result is still deterministic.
 */
export function buildLevel(wi, li) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const L = tryBuild(wi, li, hash(wi + 1, li + 1, 9173, attempt));
    if (!L) continue;
    if (validate(L).ok) return L;
    // a moving counter that cuts a route off is dropped rather than throwing the layout away
    if (L.movers.length) { L.movers = []; for (const t of L.tiles) delete t.track; if (validate(L).ok) return L; }
  }
  throw new Error(`level ${wi}-${li} failed to generate`);
}

function tryBuild(wi, liIn, seed) {
  const r = rng(seed);
  const world = WORLDS[wi];
  // the multiplayer kitchen plays like a mid-campaign level, on a much bigger floor
  const mp = liIn === MP_LEVEL;
  const li = mp ? 5 : liIn;
  const W = mp ? 19 : [11, 12, 12, 13, 13, 14, 14, 15, 15, 16][li];
  const H = mp ? 11 : li < 4 ? 9 : 10;
  const tiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles.push({ k: 'floor', x, y });
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? tiles[y * W + x] : null);
  const set = (x, y, k, extra) => { const t = at(x, y); if (t) { for (const key of Object.keys(t)) if (key !== 'x' && key !== 'y') delete t[key]; t.k = k; Object.assign(t, extra); } };

  // ---- zones (islands separated by void gaps) ----
  let Z = mp ? 2 : li < 2 ? 1 : li < 4 ? (r.chance(0.5) ? 1 : 2) : li < 8 ? 2 : (W >= 15 ? 3 : 2);
  if (wi === 1 && li >= 2) Z = Math.max(Z, 2); // glacier: drifting floes need water channels
  if (wi === 5 && li >= 2) Z = Math.max(Z, 2); // jungle: rope bridges between treehouses
  const gapW = wi === 1 ? 2 : (li >= 6 && r.chance(0.5) ? 2 : 1);
  const zones = [];
  const usable = W - (Z - 1) * gapW;
  let cx = 0;
  for (let z = 0; z < Z; z++) {
    const w = z < Z - 1 ? Math.floor(usable / Z) + (z === 0 && usable % Z ? 1 : 0) : W - cx;
    zones.push({ x0: cx, x1: cx + w - 1 });
    cx += w + gapW;
  }
  const gaps = zones.slice(0, -1).map((z) => ({ x0: z.x1 + 1, x1: z.x1 + gapW }));

  for (const g of gaps) for (let y = 0; y < H; y++) for (let x = g.x0; x <= g.x1; x++) set(x, y, 'void');
  for (const z of zones) {
    for (let x = z.x0; x <= z.x1; x++) { set(x, 0, 'wall'); set(x, 1, 'counter'); set(x, H - 1, 'counter'); }
    for (let y = 1; y < H; y++) { set(z.x0, y, 'counter'); set(z.x1, y, 'counter'); }
  }

  // ---- connections across gaps ----
  const bridges = [], floes = [];
  const kind = wi === 1 ? 'floe' : wi === 5 ? 'rope' : 'bridge';
  for (const g of gaps) {
    const left = zones.find((z) => z.x1 === g.x0 - 1), right = zones.find((z) => z.x0 === g.x1 + 1);
    if (kind === 'floe') {
      // a 2x2 ice floe drifts up and down the channel; the banks are open along its path
      const y0 = 2, y1 = H - 4;
      for (let y = y0; y <= y1 + 1; y++) { set(left.x1, y, 'floor'); set(right.x0, y, 'floor'); }
      floes.push({ x: g.x0, w: gapW, h: 2, y0, y1, period: 9 + r() * 4, phase: r() });
      // a second floe on long channels in later levels
      if (li >= 7) floes.push({ x: g.x0, w: gapW, h: 2, y0, y1, period: 11 + r() * 4, phase: 0.5 + r() * 0.3 });
      continue;
    }
    const nb = li >= 5 ? 2 : r.chance(0.35) ? 2 : 1;
    const rows = r.shuffle([2, 3, 4, 5, 6, H - 3].filter((y) => y >= 2 && y <= H - 3)).slice(0, nb).sort((a, b) => a - b);
    if (rows.length === 2 && rows[1] - rows[0] < 2) rows.pop();
    rows.forEach((y, i) => {
      set(left.x1, y, 'floor'); set(right.x0, y, 'floor');
      const tilesB = [];
      for (let x = g.x0; x <= g.x1; x++) { set(x, y, 'bridge', { rope: kind === 'rope' }); tilesB.push([x, y]); }
      bridges.push({ tiles: tilesB, rope: kind === 'rope', shifting: li >= 6 && rows.length > 1 && i === 1, row: y });
    });
  }

  // ---- interior features per zone ----
  const islands = [];
  for (const [zi, z] of zones.entries()) {
    const iw = z.x1 - z.x0 - 1; // interior width
    const ih = H - 3;
    if (Z === 1 && li >= 2 && li <= 3) {
      // divider with a walk-through opening
      const dx = z.x0 + Math.floor((z.x1 - z.x0) / 2);
      const open = r.chance(0.5) ? [2, 3] : [H - 3, H - 4];
      for (let y = 2; y <= H - 2; y++) if (!open.includes(y)) set(dx, y, 'counter');
      continue;
    }
    if (li === 0 && zi === 0) {
      const len = Math.min(3, iw - 4);
      const sx = z.x0 + 1 + Math.floor((iw - len) / 2);
      const sy = 2 + Math.floor(ih / 2);
      for (let x = sx; x < sx + len; x++) set(x, sy, 'counter');
      islands.push({ x0: sx, x1: sx + len - 1, y: sy });
      continue;
    }
    if (iw >= 5) {
      const len = Math.max(2, Math.min(iw - 4, r.int(2, 4)));
      const sx = z.x0 + 2 + r.int(0, Math.max(0, iw - 4 - len));
      const sy = r.int(3, H - 4);
      const thick = li >= 5 && iw >= 6 && r.chance(0.4) ? 2 : 1;
      for (let x = sx; x < sx + len; x++) for (let d = 0; d < thick; d++) if (sy + d <= H - 3) set(x, sy + d, 'counter');
      islands.push({ x0: sx, x1: sx + len - 1, y: sy });
    }
  }

  // ---- shifting walls (later levels): pairs of tiles that rise/sink in opposite phase ----
  const shifters = [];
  if (li >= 5) {
    const floorTiles = tiles.filter((t) => t.k === 'floor' && t.y >= 2 && t.y <= H - 2);
    const n = li >= 8 ? 3 : 2;
    for (let i = 0; i < n * 3 && shifters.length < n; i++) {
      const t = r.pick(floorTiles);
      if (!t || t.wallShift) continue;
      // only in a corridor (blocked above and below or left and right) so it actually re-routes
      const vert = isBlocking(at(t.x, t.y - 1)) && isBlocking(at(t.x, t.y + 1));
      const horz = isBlocking(at(t.x - 1, t.y)) && isBlocking(at(t.x + 1, t.y));
      if (!vert && !horz && !r.chance(0.25)) continue;
      t.wallShift = true;
      shifters.push({ x: t.x, y: t.y, period: 14, phase: (shifters.length % 2) * 0.5 });
    }
  }

  // ---- station placement ----
  // ---- moving counters: a counter on a rail gliding along an interior row (from level 4) ----
  const movers = [];
  const nMovers = mp ? 2 : li >= 7 ? 2 : li >= 3 ? 1 : 0;
  const okCell = (x, yy) => { const t = at(x, yy); return t && t.k === 'floor' && !t.wallShift && !t.push && !t.track; };
  for (const z of [...zones].sort((a, b) => (b.x1 - b.x0) - (a.x1 - a.x0))) {
    if (movers.length >= nMovers) break;
    // try spans that leave at least one walkable column at either end of the rail
    const spans = [[z.x0 + 2, z.x1 - 2], [z.x0 + 1, z.x1 - 2], [z.x0 + 2, z.x1 - 1]].filter(([a, b]) => b - a >= 2);
    const opts = [];
    for (const [tx0, tx1] of spans) for (let y = 2; y <= H - 3; y++) {
      let good = true;
      for (let x = tx0; x <= tx1 && good; x++) good = okCell(x, y) && okCell(x, y - 1) && okCell(x, y + 1);
      if (good) opts.push([tx0, tx1, y]);
    }
    if (!opts.length) continue;
    const [tx0, tx1, y] = r.pick(opts);
    for (let x = tx0; x <= tx1; x++) at(x, y).track = true;
    movers.push({ x0: tx0, x1: tx1, y, period: 9 + (tx1 - tx0) * 1.2, phase: r() });
    if (mp && movers.length < nMovers && zones.length === 1) break;
  }

  const recipes = LEVEL_RECIPES[mp ? 7 : li].map((ri) => worldRecipes(wi)[ri]);
  const ings = [...new Set(recipes.flatMap((rc) => rc.ings))];
  const methods = new Set(ings.map((id) => world.ingredients.find((g) => g.id === id).method));
  const interior = (t) => t && (t.k === 'floor' || t.k === 'bridge') && !t.wallShift;
  const candidates = tiles.filter((t) => t.k === 'counter' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => interior(at(t.x + dx, t.y + dy))));
  const zoneOf = (x) => zones.findIndex((z) => x >= z.x0 && x <= z.x1);
  const free = new Set(candidates);
  const take = (pred, prefer) => {
    let pool = [...free].filter(pred);
    if (!pool.length) pool = [...free];
    if (prefer) pool.sort(prefer);
    const t = prefer ? pool[0] : r.pick(pool);
    if (t) free.delete(t);
    return t;
  };
  const lastZ = zones.length - 1;
  const stations = [];
  const put = (t, st, extra = {}) => { if (!t) return; t.st = st; Object.assign(t, extra); stations.push(t); };
  // ---- factory: conveyor belts along the back row bridging zones, with a reroute lever ----
  const belts = [];
  if (wi === 6 && li >= 1) {
    let x0 = zones[0].x0 + 2, x1 = zones[Math.min(1, lastZ)].x1 - 2;
    if (Z === 1) { x0 = zones[0].x0 + 2; x1 = zones[0].x1 - 2; }
    const line = [];
    for (let x = x0; x <= x1; x++) {
      const t = at(x, 1);
      if (t.k === 'void') set(x, 1, 'counter', { overVoid: true });
      const tt = at(x, 1);
      line.push([x, 1]);
    }
    // contiguous run only
    const runs = [];
    let cur = [];
    for (const p of line) { if (cur.length && p[0] !== cur[cur.length - 1][0] + 1) { runs.push(cur); cur = []; } cur.push(p); }
    if (cur.length) runs.push(cur);
    const best = runs.sort((a, b) => b.length - a.length)[0];
    if (best && best.length >= 3) {
      best.forEach(([x, y], i) => { const t = at(x, y); free.delete(t); t.belt = belts.length; t.beltI = i; });
      belts.push({ tiles: best, dir: 1, speed: 0.9 + li * 0.05, lever: null });
    }
    if (li >= 5) {
      // floor conveyors along one interior row push cooks around
      const fy = r.int(3, H - 3);
      for (const t of tiles) if (t.y === fy && t.k === 'floor' && !t.wallShift && !t.track) t.push = (li % 2 ? 1 : -1);
    }
  }


  // delivery window on the outer right edge of the last zone (or the front row), dish return near it
  const outerX = zones[lastZ].x1;
  const win = take((t) => t.x === outerX && t.y >= 2 && t.y <= H - 2, (a, b) => Math.abs(a.y - H / 2) - Math.abs(b.y - H / 2));
  put(win, 'window');
  put(take((t) => zoneOf(t.x) === lastZ && Math.abs(t.x - win.x) + Math.abs(t.y - win.y) <= 4 && t !== win, (a, b) => (Math.abs(a.x - win.x) + Math.abs(a.y - win.y)) - (Math.abs(b.x - win.x) + Math.abs(b.y - win.y)) || (a.y - b.y)), 'return');
  const sinkZ = Z > 1 ? r.int(0, lastZ) : 0;
  put(take((t) => zoneOf(t.x) === sinkZ && (t.y === 1 || t.y === H - 1)), 'sink');
  put(take((t) => zoneOf(t.x) === lastZ && t.y !== H - 1), 'plates');
  // bins: mostly in the first zone so ingredients have to travel
  for (const id of ings) put(take((t) => zoneOf(t.x) === 0 && (t.y === 1 || t.x === zones[0].x0)), 'bin', { ing: id });
  const nBoards = mp ? 4 : 1 + (li >= 3 ? 1 : 0) + (li >= 7 ? 1 : 0);
  for (let i = 0; i < nBoards; i++) put(take((t) => zoneOf(t.x) === i % (Z) ), 'board');
  const dup = (m) => (mp ? 2 : li >= 6 && ings.length >= 3 ? 2 : 1);
  if (methods.has('pan')) for (let i = 0; i < dup('pan'); i++) put(take((t) => t.y === 1 && zoneOf(t.x) === (i + 1) % Z), 'pan');
  if (methods.has('pot')) for (let i = 0; i < dup('pot'); i++) put(take((t) => t.y === 1 && zoneOf(t.x) === (i + Z - 1) % Z), 'pot');
  if (methods.has('oven')) for (let i = 0; i < (li >= 8 || mp ? 2 : 1); i++) put(take((t) => (t.y === 1 || t.y === H - 1) && zoneOf(t.x) === (lastZ - i + Z) % Z), 'oven');
  put(take((t) => t.y === H - 1 || t.y === 1), 'trash');
  if (methods.has('pan') || methods.has('pot') || methods.has('oven') || wi === 2 || wi === 4) put(take(() => true), 'ext');
  if (Z > 1 && r.chance(0.6)) put(take((t) => zoneOf(t.x) !== 0), 'trash');
  if (mp) {
    // more workstations so four cooks aren't queueing: a second sink, plate stack and extinguisher
    put(take((t) => zoneOf(t.x) !== sinkZ && (t.y === 1 || t.y === H - 1)), 'sink');
    put(take((t) => zoneOf(t.x) === 0), 'plates');
    put(take((t) => t.y === H - 1), 'trash');
  }

  if (belts.length && li >= 3) {
    const lever = take((t) => zoneOf(t.x) === 0 && t.y !== 1);
    if (lever) { put(lever, 'lever', { belt: 0 }); belts[0].lever = [lever.x, lever.y]; }
  }
  for (const t of free) if (!t.st) t.st = 'counter';
  for (const t of tiles) if (t.k === 'counter' && !t.st) t.st = 'counter';

  // ---- spawns ----
  const spawnPool = [];
  for (let i = 0; i < 4; i++) {
    const z = zones[i % Z];
    const opts = tiles.filter((t) => t.k === 'floor' && !t.wallShift && !t.push && !t.track && t.x > z.x0 && t.x < z.x1 && t.y >= 2 && t.y <= H - 2 && !spawnPool.some((s) => s[0] === t.x && s[1] === t.y));
    opts.sort((a, b) => Math.abs(a.y - H / 2) - Math.abs(b.y - H / 2) || Math.abs(a.x - (z.x0 + z.x1) / 2) - Math.abs(b.x - (z.x0 + z.x1) / 2));
    const s = opts[Math.min(opts.length - 1, i < Z ? 0 : 1 + i)];
    if (!s) return null;
    spawnPool.push([s.x, s.y]);
  }

  // ---- hazard description (all timed deterministically from level time) ----
  const D = mp ? 210 : 150 + li * 8;
  const hz = { world: world.id };
  const floorList = () => tiles.filter((t) => t.k === 'floor' && !t.wallShift && !t.track && t.y >= 2 && !spawnPool.some((s) => s[0] === t.x && s[1] === t.y));
  const schedule = (every, jitter, startAt, pickTile) => {
    const out = [];
    for (let t = startAt; t < D + 5; t += every * (0.75 + r() * jitter)) { const tt = pickTile(); if (tt) out.push({ t, x: tt.x, y: tt.y }); }
    return out;
  };
  switch (world.id) {
    case 'pirate':
      hz.tilt = { amp: 0.035 + li * 0.009, period: 11 - li * 0.3, push: 1.2 + li * 0.25 };
      if (li >= 1) hz.cannon = schedule(Math.max(4.5, 14 - li), 0.6, li === 1 ? 20 : 12, () => r.pick(floorList()));
      break;
    case 'glacier':
      hz.ice = { accel: 7 - li * 0.25, drag: 1.4 };
      break;
    case 'volcano': {
      if (li >= 1) hz.embers = schedule(Math.max(3, 10 - li * 0.7), 0.6, 10, () => r.pick(tiles.filter((t) => t.k === 'floor' || (t.k === 'counter' && t.st === 'counter'))));
      const fl = floorList();
      if (li >= 2) hz.geysers = r.shuffle(fl.slice()).slice(0, Math.min(1 + Math.floor(li / 3), 4)).map((t, i) => ({ x: t.x, y: t.y, period: 9, phase: i * 0.37 }));
      if (li >= 4) {
        // a fire wall sweeps across an interior column of one zone
        const z = zones[r.int(0, lastZ)];
        const fx = r.int(z.x0 + 2, z.x1 - 2);
        const cells = tiles.filter((t) => t.x === fx && t.k === 'floor' && !spawnPool.some((s) => s[0] === t.x && s[1] === t.y)).map((t) => [t.x, t.y]);
        hz.firewalls = [{ cells, period: 10, on: 2.6, phase: 0.2 }];
        if (li >= 7) {
          const fy = r.int(3, H - 3);
          hz.firewalls.push({ cells: tiles.filter((t) => t.y === fy && t.k === 'floor' && Math.abs(t.x - fx) > 1 && !spawnPool.some((s) => s[0] === t.x && s[1] === t.y)).map((t) => [t.x, t.y]), period: 10, on: 2.6, phase: 0.7 });
        }
      }
      break;
    }
    case 'space': {
      hz.gravity = { period: 24 - li, low: 7 + li * 0.4, phase: 0.45 };
      if (li >= 2) {
        hz.lasers = [];
        for (const b of bridges) hz.lasers.push({ cells: b.tiles, period: 7, on: 2.8, phase: (hz.lasers.length * 0.5) % 1 });
        if (!hz.lasers.length || li >= 6) {
          const z = zones[0];
          const lx = z.x0 + Math.floor((z.x1 - z.x0) / 2);
          hz.lasers.push({ cells: tiles.filter((t) => t.x === lx && t.k === 'floor' && !t.wallShift && !spawnPool.some((s) => s[0] === t.x && s[1] === t.y)).map((t) => [t.x, t.y]), period: 8, on: 2.4, phase: 0.25 });
        }
      }
      break;
    }
    case 'clouds':
      hz.gusts = [];
      for (let t = 14; t < D; t += 13 - li * 0.4 + r() * 3) hz.gusts.push({ t, dur: 3.2, dx: r.pick([-1, 1, 0, 0]), dy: 0, strength: 2.4 + li * 0.2 });
      hz.gusts.forEach((g) => { if (g.dx === 0) g.dy = r.pick([-1, 1]); });
      if (li >= 2) hz.lightning = schedule(Math.max(4, 12 - li * 0.8), 0.6, 15, () => r.pick(tiles.filter((t) => t.k === 'floor' || t.k === 'bridge' || (t.k === 'counter' && t.st === 'counter'))));
      break;
    case 'jungle':
      hz.sway = { amp: 0.8 + li * 0.15, period: 3.4 };
      if (li >= 1) hz.monkeys = { count: Math.min(1 + Math.floor(li / 3), 3), every: Math.max(14, 30 - li * 1.6), start: 18 };
      break;
    case 'factory':
      break;
    case 'library':
      hz.dilation = [];
      for (let t = 12; t < D; t += 11 + r() * 5) hz.dilation.push({ t, dur: 5 + r() * 3, scale: r.pick([0.55, 0.55, 1.6]) });
      if (li >= 2) {
        hz.cuckoo = [];
        for (let t = 25; t < D; t += Math.max(12, 24 - li * 1.2) + r() * 4) hz.cuckoo.push({ t, row: r.int(2, H - 2) });
      }
      break;
  }

  const recAvg = recipes.reduce((s, rc) => s + rc.ings.length, 0) / recipes.length;
  const perDish = 9 + 8.5 * recAvg;
  const value = 10 + 10 * recAvg;
  const X = (D / perDish) * value;
  const round5 = (v) => Math.max(5, Math.round(v / 5) * 5);

  return {
    world: wi, index: liIn, diff: li, mp, id: levelKey(wi, liIn), name: levelTitle(wi, liIn), W, H, seed, tiles,
    zones, gaps, bridges, floes, islands, shifters, belts, stations, spawns: spawnPool, movers,
    recipes, duration: D, maxOrders: mp ? 5 : li < 2 ? 3 : li < 6 ? 4 : 5,
    orderGap: Math.max(9, 18 - li), stars: [round5(X * 0.3), round5(X * 0.55), round5(X * 0.8)], hz,
  };
}

/** Reachability check: every station must touch floor reachable from spawn, in every wall phase. */
export function validate(L) {
  const { W, H, tiles } = L;
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? tiles[y * W + x] : null);
  const floeCols = new Set();
  for (const f of L.floes) for (let x = f.x; x < f.x + f.w; x++) floeCols.add(x);
  const errors = [];
  for (const phase of [0, 1]) {
    const walk = (t) => {
      if (!t) return false;
      if (t.wallShift) {
        const s = L.shifters.find((q) => q.x === t.x && q.y === t.y);
        if (s && ((s.phase < 0.25 ? 0 : 1) === phase)) return false;
      }
      if (t.track) return false;
      if (t.k === 'floor' || t.k === 'bridge') return true;
      if (t.k === 'void' && floeCols.has(t.x) && t.y >= 2 && t.y <= H - 3) return true;
      return false;
    };
    const seen = new Set();
    const q = [L.spawns[0]];
    seen.add(L.spawns[0].join());
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (!seen.has(k) && walk(at(nx, ny))) { seen.add(k); q.push([nx, ny]); }
      }
    }
    for (const s of L.spawns) if (!seen.has(s.join())) errors.push(`spawn ${s} unreachable (phase ${phase})`);
    for (const t of tiles) {
      if (t.k !== 'counter' || !t.st || t.st === 'counter') continue;
      const ok = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${t.x + dx},${t.y + dy}`));
      if (!ok) errors.push(`${t.st} at ${t.x},${t.y} unreachable (phase ${phase})`);
    }
  }
  const need = ['window', 'return', 'sink', 'plates', 'board', 'trash'];
  for (const n of need) if (!tiles.some((t) => t.st === n)) errors.push(`missing ${n}`);
  for (const rc of L.recipes) for (const id of rc.ings) if (!tiles.some((t) => t.st === 'bin' && t.ing === id)) errors.push(`missing bin ${id}`);
  return { ok: errors.length === 0, errors };
}

export const tileAt = (L, x, y) => (x >= 0 && y >= 0 && x < L.W && y < L.H ? L.tiles[y * L.W + x] : null);
export { SOLID, T };
