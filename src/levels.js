// Deterministic level builder: 8 worlds x 10 levels, every layout generated from a fixed seed
// and checked for reachability (see validate). Pure data, no Three.js, so node tests can import it.
import { WORLDS, LEVEL_RECIPES, worldRecipes, T } from './config.js';
import { rng, hash } from './rng.js';
import { planFor, layOut } from './layouts.js';

export const LEVELS_PER_WORLD = 10;
/** Index of each world's multiplayer kitchen (bigger, more workstations); key `${wi}-10`. */
export const MP_LEVEL = 10;
const MP_TITLES = ['Fleet Galley', 'Ice Station Banquet', 'Magma Mess Hall', 'Orbital Canteen', 'Sky Palace Feast', 'Treetop Village', 'Mega Plant', 'Grand Clocktower'];

const TITLES = [
  ['Galley Ho!', 'Plank Prep', 'Two Decks', 'Brig Brunch', 'Cannon Kitchen', 'Keelhaul Kitchen', 'Mutiny Mise', "Crow's Nest Cuisine", 'Kraken Shallows', "Captain's Table"],
  ['First Frost', 'Thin Ice', 'Floe Motion', 'Igloo Line', 'Polar Plates', 'Crevasse Café', 'Drift Dinner', 'Avalanche Alley', 'Mammoth Rush', 'Frozen Throne'],
  ['Warm Welcome', 'Cinder Station', 'Ember Shift', 'Geyser Grill', 'Ash Alley', 'Fire Wall Feast', 'Molten Mise', 'Pyroclastic Prep', 'Caldera Crunch', 'Heart of the Core'],
  ['Docking Bay Diner', 'Zero-G Grill', 'Laser Lunch', 'Orbital Oven', 'Airlock Appetizers', 'Gravity Well', 'Meteor Shower', 'Reactor Room', 'Dark Side Deli', 'Mission Critical'],
  ['Cloud Nine Café', 'Tailwind Table', 'Gust Front', 'Sky Bridge Bistro', 'Thunder Prep', 'Jet Stream Kitchen', 'Cumulus Cuisine', 'Storm Cell', 'Eye of the Storm', 'Stratosphere Supper'],
  ['Treetop Takeout', 'Monkey Business', 'Rope Bridge Run', 'Canopy Kitchen', 'Vine Dining', 'Banana Heist', 'Swinging Skillets', 'Lost Temple Lunch', 'Howler Hollow', 'King of the Canopy'],
  ['Clock In', 'Belt Drive', 'Assembly Line', 'Lever Lunch', 'Hot Rivets', 'Night Shift', 'Overtime', 'Quality Control', 'Full Throttle', 'Mainframe Feast'],
  ['First Tick', 'Wind-Up', 'Tick Tock Toast', 'Gear Grill', 'The Cuckoo Hour', 'Hourglass Hall', 'Midnight Chime', 'Pendulum Pantry', 'Time Loop Lunch', 'Clockwork Finale'],
];
export const levelTitle = (wi, li) => (li === MP_LEVEL ? MP_TITLES[wi] : TITLES[wi][li]);
export const levelKey = (wi, li) => `${wi}-${li}`;

const SOLID = new Set(['counter']); // blocks movement (walls handled separately)
const WALKWAY = 1.35; // walkway conveyor carry speed (x 1.7 tiles/s)
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
  const plan = planFor(wi, li, mp, r);
  const lay = layOut(plan, r);
  const { W, H } = lay;
  const tiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles.push({ k: 'void', x, y });
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? tiles[y * W + x] : null);
  const set = (x, y, k, extra) => { const t = at(x, y); if (t) { for (const key of Object.keys(t)) if (key !== 'x' && key !== 'y' && key !== 'zi') delete t[key]; t.k = k; Object.assign(t, extra); } };
  const zi = (x, y) => { const t = at(x, y); return t && t.zi != null ? t.zi : -1; };

  // ---- zones: fill each shape, border it with counters, a back wall where nothing stands behind ----
  const zones = lay.zones.map((z, i) => ({ x0: z.x0, y0: z.y0, x1: z.x1, y1: z.y1, i }));
  lay.zones.forEach((z, i) => {
    for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0; x <= z.x1; x++) if (!z.cut.has(`${x},${y}`)) { const t = at(x, y); t.k = 'floor'; t.zi = i; }
  });
  for (const z of zones) {
    // back wall only when no other zone stands behind this one (it would hide it from the camera)
    z.wall = !zones.some((o) => o !== z && o.y1 < z.y0 && o.x1 >= z.x0 && o.x0 <= z.x1);
    for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0; x <= z.x1; x++) {
      if (zi(x, y) !== z.i) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dy]) => zi(x + dx, y + dy) !== z.i);
      if (z.wall && y === z.y0) set(x, y, 'wall');
      else if (edge || (z.wall && y === z.y0 + 1)) set(x, y, 'counter');
    }
    z.yi0 = z.y0 + (z.wall ? 2 : 1); z.yi1 = z.y1 - 1; // interior rows
  }
  const interiorOf = (z, x, y) => zi(x, y) === z.i && at(x, y).k === 'floor';

  // ---- connections across gaps: bridges (rope, ice, tube...), drifting floes or conveyor shuttles ----
  const bridges = [], floes = [], gaps = [], hands = [];
  const kind = wi === 5 ? 'rope' : 'bridge';
  for (const ln of lay.links) {
    const A = zones[ln.a], B = zones[ln.b];
    if (ln.dir === 'x') {
      // A on the left, B on the right: rows where both edges are counters backed by floor
      const ex = (z, y, side) => { for (let x = side > 0 ? z.x1 : z.x0; side > 0 ? x >= z.x0 : x <= z.x1; x -= side) if (zi(x, y) === z.i) return x; return null; };
      const gx0 = A.x1 + 1, gx1 = B.x0 - 1;
      const rows = [];
      for (let y = Math.max(A.yi0, B.yi0); y <= Math.min(A.yi1, B.yi1); y++) {
        const ax = ex(A, y, 1), bx = ex(B, y, -1);
        if (ax === A.x1 && bx === B.x0 && interiorOf(A, ax - 1, y) && interiorOf(B, bx + 1, y)) rows.push(y);
      }
      if (!rows.length) return null;
      gaps.push({ dir: 'x', a: ln.a, b: ln.b, x0: gx0, x1: gx1, y0: rows[0], y1: rows[rows.length - 1] });
      const gw = gx1 - gx0 + 1;
      if (wi === 6 && gw >= 2 && rows.length >= 2) {
        // factory: a pair of walkway conveyors across the gap, one each way: step on and it carries you
        const y = r.pick(rows.slice(0, -1).filter((q) => rows.includes(q + 1))) ?? null;
        if (y == null) return null;
        const d0 = r.chance(0.5) ? 1 : -1;
        for (const [yy, d] of [[y, d0], [y + 1, -d0]]) {
          set(A.x1, yy, 'floor'); set(B.x0, yy, 'floor');
          for (let x = gx0; x <= gx1; x++) set(x, yy, 'floor', { push: d * WALKWAY, walkway: true });
        }
        continue;
      }
      if (wi === 7 && li >= 2 && r.chance(0.6)) {
        // clock tower: a giant clock hand pivots in the gap, a quarter turn at a time: ride it across
        const y = rows[Math.floor(rows.length / 2)];
        set(A.x1, y, 'floor'); set(B.x0, y, 'floor');
        hands.push({ x: gx0 + gw / 2, y: y + 0.5, len: gw + 1.6, w: 0.9, axis: 'x', period: 10 + r() * 3, phase: r(), cells: Array.from({ length: gw }, (_, k) => [gx0 + k, y]) });
        continue;
      }
      if (wi === 1 && li >= 3 && rows.length >= 3 && r.chance(0.7)) {
        // glacier: a floe drifts up and down the channel; the banks are open along its path
        const y0 = rows[0], y1 = rows[rows.length - 1] - 1;
        if (rows.length === y1 - y0 + 2) {
          for (let y = y0; y <= y1 + 1; y++) { set(A.x1, y, 'floor'); set(B.x0, y, 'floor'); }
          floes.push({ x: gx0, w: gw, h: 2, y0, y1, period: 9 + r() * 4, phase: r() });
          continue;
        }
      }
      const nb = rows.length >= 4 && (li >= 5 || r.chance(0.35)) ? 2 : 1;
      const pick = r.shuffle(rows.slice()).slice(0, nb).sort((a, b) => a - b);
      if (pick.length === 2 && pick[1] - pick[0] < 2) pick.pop();
      pick.forEach((y, i) => {
        set(A.x1, y, 'floor'); set(B.x0, y, 'floor');
        const tb = [];
        for (let x = gx0; x <= gx1; x++) { set(x, y, 'bridge', { rope: kind === 'rope', dir: 'x' }); tb.push([x, y]); }
        bridges.push({ tiles: tb, rope: kind === 'rope', dir: 'x', shifting: (li >= 6 && wi !== 6 && pick.length > 1 && i === 1) || (wi === 2 && li >= 4 && i === 0 && pick.length > 1), row: y, a: ln.a, b: ln.b });
      });
    } else {
      // A behind, B in front: columns where both edges are counters backed by floor
      const gy0 = A.y1 + 1, gy1 = B.y0 - 1;
      const cols = [];
      for (let x = Math.max(A.x0 + 1, B.x0 + 1); x <= Math.min(A.x1 - 1, B.x1 - 1); x++) {
        if (zi(x, A.y1) === A.i && zi(x, B.y0) === B.i && interiorOf(A, x, A.y1 - 1) && interiorOf(B, x, B.y0 + 1)) cols.push(x);
      }
      if (!cols.length) return null;
      gaps.push({ dir: 'y', a: ln.a, b: ln.b, y0: gy0, y1: gy1, x0: cols[0], x1: cols[cols.length - 1] });
      if (wi === 7 && li >= 3 && r.chance(0.5)) {
        const x = cols[Math.floor(cols.length / 2)], gh = gy1 - gy0 + 1;
        set(x, A.y1, 'floor'); set(x, B.y0, 'floor');
        hands.push({ x: x + 0.5, y: gy0 + gh / 2, len: gh + 1.6, w: 0.9, axis: 'y', period: 10 + r() * 3, phase: r(), cells: Array.from({ length: gh }, (_, k) => [x, gy0 + k]) });
        continue;
      }
      const nb = cols.length >= 4 && li >= 5 && r.chance(0.5) ? 2 : 1;
      const pick = r.shuffle(cols.slice()).slice(0, nb).sort((a, b) => a - b);
      if (pick.length === 2 && pick[1] - pick[0] < 2) pick.pop();
      pick.forEach((x) => {
        set(x, A.y1, 'floor'); set(x, B.y0, 'floor');
        const tb = [];
        for (let y = gy0; y <= gy1; y++) { set(x, y, 'bridge', { rope: kind === 'rope', dir: 'y' }); tb.push([x, y]); }
        bridges.push({ tiles: tb, rope: kind === 'rope', dir: 'y', shifting: wi === 2 && li >= 7 && pick.length > 1 && x === pick[1], col: x, a: ln.a, b: ln.b });
      });
    }
  }

  // ---- interior features per zone ----
  const islands = [];
  const tight = wi === 3; // space compartments are cramped enough as they are
  for (const z of zones) {
    const iw = z.x1 - z.x0 - 1, ih = z.yi1 - z.yi0 + 1;
    if (plan.divider) {
      // divider with a walk-through opening
      const dx = z.x0 + Math.floor((z.x1 - z.x0) / 2);
      const open = r.chance(0.5) ? [z.yi0, z.yi0 + 1] : [z.yi1, z.yi1 - 1];
      for (let y = z.yi0; y <= z.yi1; y++) if (!open.includes(y)) set(dx, y, 'counter');
      continue;
    }
    if (tight || iw < 5 || ih < 4) continue;
    if (li === 0) {
      const len = Math.min(3, iw - 4);
      if (len < 1) continue;
      const sx = z.x0 + 1 + Math.floor((iw - len) / 2), sy = z.yi0 + Math.floor(ih / 2);
      if (![...Array(len)].every((_, k) => interiorOf(z, sx + k, sy))) continue;
      for (let x = sx; x < sx + len; x++) set(x, sy, 'counter');
      islands.push({ x0: sx, x1: sx + len - 1, y: sy });
      continue;
    }
    const len = Math.max(2, Math.min(iw - 4, r.int(2, 4)));
    const sx = z.x0 + 2 + r.int(0, Math.max(0, iw - 4 - len));
    const sy = r.int(z.yi0 + 1, Math.max(z.yi0 + 1, z.yi1 - 1));
    const thick = li >= 5 && iw >= 6 && ih >= 5 && r.chance(0.4) ? 2 : 1;
    let ok = true;
    for (let x = sx; x < sx + len; x++) for (let d = 0; d < thick; d++) ok = ok && interiorOf(z, x, sy + d);
    if (!ok) continue;
    for (let x = sx; x < sx + len; x++) for (let d = 0; d < thick; d++) set(x, sy + d, 'counter');
    islands.push({ x0: sx, x1: sx + len - 1, y: sy });
  }
  // ---- pits: lava holes, crevasses and holes in the cloud you can fall through ----
  const pitWorld = { 1: 4, 2: 2, 4: 4 }[wi];
  if (pitWorld != null && li >= pitWorld) {
    const want = li >= 8 || mp ? 2 : 1;
    let made = 0;
    for (const z of r.shuffle(zones.slice())) {
      if (made >= want) break;
      const cand = [];
      for (let y = z.yi0 + 1; y <= z.yi1 - 1; y++) for (let x = z.x0 + 2; x <= z.x1 - 2; x++) {
        const pw = wi === 1 ? 1 : 2, ph = wi === 1 ? 2 : r.int(1, 2);
        let ok = true;
        for (let dy = -1; dy <= ph && ok; dy++) for (let dx = -1; dx <= pw && ok; dx++) ok = interiorOf(z, x + dx, y + dy) && !at(x + dx, y + dy).bridgeEnd;
        if (ok) cand.push([x, y, pw, ph]);
      }
      if (!cand.length) continue;
      const [x, y, pw, ph] = r.pick(cand);
      for (let dy = 0; dy < ph; dy++) for (let dx = 0; dx < pw; dx++) set(x + dx, y + dy, 'void', { pit: true });
      made++;
    }
  }

  // ---- shifting walls (later levels): pairs of tiles that rise/sink in opposite phase ----
  const shifters = [];
  if (li >= 5) {
    const floorTiles = tiles.filter((t) => t.k === 'floor' && t.zi != null && t.y >= zones[t.zi].yi0 && t.y <= zones[t.zi].yi1);
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

  // ---- moving counters: a counter on a rail gliding along an interior row (from level 4) ----
  const movers = [];
  const nMovers = mp ? 2 : li >= 7 ? 2 : li >= 3 ? 1 : 0;
  const okCell = (x, yy) => { const t = at(x, yy); return t && t.k === 'floor' && !t.wallShift && !t.push && !t.track; };
  for (const z of [...zones].sort((a, b) => (b.x1 - b.x0) - (a.x1 - a.x0))) {
    if (movers.length >= nMovers) break;
    // try spans that leave at least one walkable column at either end of the rail
    const spans = [[z.x0 + 2, z.x1 - 2], [z.x0 + 1, z.x1 - 2], [z.x0 + 2, z.x1 - 1]].filter(([a, b]) => b - a >= 2);
    const opts = [];
    for (const [tx0, tx1] of spans) for (let y = z.yi0; y <= z.yi1; y++) {
      let good = true;
      for (let x = tx0; x <= tx1 && good; x++) good = okCell(x, y) && okCell(x, y - 1) && okCell(x, y + 1);
      if (good) opts.push([tx0, tx1, y]);
    }
    if (!opts.length) continue;
    const [tx0, tx1, y] = r.pick(opts);
    for (let x = tx0; x <= tx1; x++) at(x, y).track = true;
    movers.push({ x0: tx0, x1: tx1, y, period: 9 + (tx1 - tx0) * 1.2, phase: r() });
  }

  // ---- factory: no way to fall out. The gaps between sections are filled with counters (some of
  // them item belts, below) and every open edge next to somewhere you can walk gets a counter ----
  if (wi === 6) {
    for (const g of gaps) for (let y = g.y0; y <= g.y1; y++) for (let x = g.x0; x <= g.x1; x++) { const t = at(x, y); if (t.k === 'void' && !t.pit) set(x, y, 'counter', { fill: true }); }
    const walk = (t) => t && (t.k === 'floor' || t.k === 'bridge');
    for (const t of tiles) {
      if (t.k !== 'void' || t.pit) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) near = walk(at(t.x + dx, t.y + dy));
      if (near) set(t.x, t.y, 'counter', { fill: true });
    }
  }

  const recipes = LEVEL_RECIPES[mp ? 7 : li].map((ri) => worldRecipes(wi)[ri]);
  const ings = [...new Set(recipes.flatMap((rc) => rc.ings))];
  const methods = new Set(ings.map((id) => world.ingredients.find((g) => g.id === id).method));
  const interior = (t) => t && (t.k === 'floor' || t.k === 'bridge') && !t.wallShift;
  const candidates = tiles.filter((t) => t.k === 'counter' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => interior(at(t.x + dx, t.y + dy))));
  const zoneOf = (t) => (t.zi != null ? t.zi : -1);
  const outside = (q) => !q || q.k === 'void' || q.k === 'wall';
  const back = (t) => outside(at(t.x, t.y - 1)), front = (t) => !at(t.x, t.y + 1) || at(t.x, t.y + 1).k === 'void';
  const free = new Set(candidates);
  const take = (pred, prefer) => {
    let pool = [...free].filter(pred);
    if (!pool.length) pool = [...free];
    if (prefer) pool.sort(prefer);
    const t = prefer ? pool[0] : r.pick(pool);
    if (t) free.delete(t);
    return t;
  };
  // zones in reading order; the rightmost one serves (window), the leftmost holds the larder (bins)
  const Z = zones.length;
  const firstZ = zones.reduce((a, z) => (z.x0 < a.x0 || (z.x0 === a.x0 && z.y0 < a.y0) ? z : a)).i;
  const lastZ = zones.reduce((a, z) => (z.x1 > a.x1 || (z.x1 === a.x1 && z.y1 > a.y1) ? z : a)).i;
  const nth = (k) => zones[(firstZ + k) % Z].i;
  const stations = [];
  const put = (t, st, extra = {}) => { if (!t) return; t.st = st; Object.assign(t, extra); stations.push(t); };
  // ---- factory: conveyor belts along the back row bridging zones, with a reroute lever ----
  const belts = [];
  if (wi === 6 && li >= 1) {
    const backs = zones.filter((z) => z.wall && z.y0 === 0).sort((a, b) => a.x0 - b.x0);
    const z0 = backs[0], z1 = backs[1] && gaps.some((g) => g.dir === 'x' && ((g.a === z0.i && g.b === backs[1].i))) ? backs[1] : z0;
    const line = [];
    for (let x = z0.x0 + 2; x <= z1.x1 - 2; x++) {
      const t = at(x, 1);
      if (t.k === 'void' && !t.pit) set(x, 1, 'counter', { overVoid: true });
      if (at(x, 1).k === 'counter') line.push([x, 1]);
    }
    // contiguous run only
    const runs = [];
    let cur = [];
    for (const p of line) { if (cur.length && p[0] !== cur[cur.length - 1][0] + 1) { runs.push(cur); cur = []; } cur.push(p); }
    if (cur.length) runs.push(cur);
    for (const t of tiles) if (t.overVoid && !runs.some((rn) => rn.length >= 3 && rn.some(([x, y]) => x === t.x && y === t.y))) set(t.x, t.y, 'void');
    const best = runs.sort((a, b) => b.length - a.length)[0];
    if (best && best.length >= 3) {
      best.forEach(([x, y], i) => { const t = at(x, y); free.delete(t); t.belt = belts.length; t.beltI = i; });
      belts.push({ tiles: best, dir: 1, speed: 0.9 + li * 0.05, lever: null });
    }
    // item belts running across the filled gaps between side-by-side sections
    for (const g of gaps.filter((q) => q.dir === 'x')) {
      const opts = [];
      for (let y = g.y0; y <= g.y1; y++) {
        const run = [];
        for (let x = g.x0 - 1; x <= g.x1 + 1; x++) run.push(at(x, y));
        if (run.every((t) => t.k === 'counter' && free.has(t) && t.belt == null) && !run.some((t) => [[0, -1], [0, 1]].some(([dx, dy]) => { const q = at(t.x + dx, t.y + dy); return q && q.belt != null; }))) opts.push(run);
      }
      if (!opts.length) continue;
      const run = r.pick(opts), d = r.chance(0.5) ? 1 : -1;
      run.forEach((t, i) => { free.delete(t); t.belt = belts.length; t.beltI = i; });
      belts.push({ tiles: run.map((t) => [t.x, t.y]), dir: d, speed: 0.9 + li * 0.05, lever: null });
    }
    if (li >= 5) {
      // floor conveyors along one interior row push cooks around
      const fy = r.int(3, H - 3);
      for (const t of tiles) if (t.y === fy && t.k === 'floor' && !t.wallShift && !t.track && !t.walkway) t.push = (li % 2 ? 1 : -1);
    }
  }

  // delivery window on the outer right edge of the rightmost zone, dish return near it
  const rightOpen = (t) => { const q = at(t.x + 1, t.y); return !q || (q.k === 'void' && !q.pit && !gaps.some((g) => g.dir === 'x' && g.x0 === t.x + 1)); };
  const win = take((t) => zoneOf(t) === lastZ && rightOpen(t),
    (a, b) => (b.x - a.x) || Math.abs(a.y - (zones[lastZ].y0 + zones[lastZ].y1) / 2) - Math.abs(b.y - (zones[lastZ].y0 + zones[lastZ].y1) / 2));
  put(win, 'window');
  put(take((t) => zoneOf(t) === lastZ && Math.abs(t.x - win.x) + Math.abs(t.y - win.y) <= 4 && t !== win, (a, b) => (Math.abs(a.x - win.x) + Math.abs(a.y - win.y)) - (Math.abs(b.x - win.x) + Math.abs(b.y - win.y)) || (a.y - b.y)), 'return');
  const sinkZ = Z > 1 ? r.int(0, Z - 1) : 0;
  put(take((t) => zoneOf(t) === sinkZ && (back(t) || front(t))), 'sink');
  put(take((t) => zoneOf(t) === lastZ && !front(t)), 'plates');
  // bins: mostly in the first zone so ingredients have to travel
  for (const id of ings) put(take((t) => zoneOf(t) === firstZ && (back(t) || t.x === zones[firstZ].x0)), 'bin', { ing: id });
  const nBoards = mp ? 4 : 1 + (li >= 3 ? 1 : 0) + (li >= 7 ? 1 : 0);
  for (let i = 0; i < nBoards; i++) put(take((t) => zoneOf(t) === nth(i)), 'board');
  const dup = () => (mp ? 2 : li >= 6 && ings.length >= 3 ? 2 : 1);
  if (methods.has('pan')) for (let i = 0; i < dup(); i++) put(take((t) => back(t) && zoneOf(t) === nth(i + 1)), 'pan');
  if (methods.has('pot')) for (let i = 0; i < dup(); i++) put(take((t) => back(t) && zoneOf(t) === nth(i + Z - 1)), 'pot');
  if (methods.has('oven')) for (let i = 0; i < (li >= 8 || mp ? 2 : 1); i++) put(take((t) => (back(t) || front(t)) && zoneOf(t) === (i ? nth(Z - 1 + i) : lastZ)), 'oven');
  put(take((t) => front(t) || back(t)), 'trash');
  if (methods.has('pan') || methods.has('pot') || methods.has('oven') || wi === 2 || wi === 4) put(take(() => true), 'ext');
  if (Z > 1 && r.chance(0.6)) put(take((t) => zoneOf(t) !== firstZ), 'trash');
  if (mp) {
    // more workstations so four cooks aren't queueing: a second sink, plate stack and extinguisher
    put(take((t) => zoneOf(t) !== sinkZ && (back(t) || front(t))), 'sink');
    put(take((t) => zoneOf(t) === firstZ), 'plates');
    put(take((t) => front(t)), 'trash');
  }

  if (belts.length && li >= 3) {
    const lever = take((t) => zoneOf(t) === firstZ && t.y !== 1);
    if (lever) { put(lever, 'lever', { belt: 0 }); belts[0].lever = [lever.x, lever.y]; }
  }
  for (const t of free) if (!t.st) t.st = 'counter';
  for (const t of tiles) if (t.k === 'counter' && !t.st) t.st = 'counter';

  // ---- spawns ----
  const spawnPool = [];
  for (let i = 0; i < 4; i++) {
    const z = zones[nth(i % Z)];
    const opts = tiles.filter((t) => t.k === 'floor' && t.zi === z.i && !t.wallShift && !t.push && !t.track && !spawnPool.some((s) => s[0] === t.x && s[1] === t.y));
    const mx = (z.x0 + z.x1) / 2, my = (z.y0 + z.y1) / 2;
    opts.sort((a, b) => Math.abs(a.y - my) - Math.abs(b.y - my) || Math.abs(a.x - mx) - Math.abs(b.x - mx));
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
        const z = r.pick(zones.filter((q) => q.x1 - q.x0 >= 4)) || zones[0];
        const fx = r.int(z.x0 + 2, z.x1 - 2);
        const cells = tiles.filter((t) => t.x === fx && t.zi === z.i && t.k === 'floor' && !spawnPool.some((s) => s[0] === t.x && s[1] === t.y)).map((t) => [t.x, t.y]);
        hz.firewalls = [{ cells, period: 10, on: 2.6, phase: 0.2 }];
        if (li >= 7) {
          const z2 = r.pick(zones);
          const fy = r.int(z2.yi0, z2.yi1);
          hz.firewalls.push({ cells: tiles.filter((t) => t.y === fy && t.zi === z2.i && t.k === 'floor' && Math.abs(t.x - fx) > 1 && !spawnPool.some((s) => s[0] === t.x && s[1] === t.y)).map((t) => [t.x, t.y]), period: 10, on: 2.6, phase: 0.7 });
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
          const z = zones[firstZ];
          const lx = z.x0 + Math.floor((z.x1 - z.x0) / 2);
          hz.lasers.push({ cells: tiles.filter((t) => t.x === lx && t.zi === z.i && t.k === 'floor' && !t.wallShift && !spawnPool.some((s) => s[0] === t.x && s[1] === t.y)).map((t) => [t.x, t.y]), period: 8, on: 2.4, phase: 0.25 });
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
        const cuckooRows = [...new Set(tiles.filter((t) => t.k === 'floor').map((t) => t.y))];
        hz.cuckoo = [];
        for (let t = 25; t < D; t += Math.max(12, 24 - li * 1.2) + r() * 4) hz.cuckoo.push({ t, row: r.pick(cuckooRows) });
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
    zones, gaps, bridges, floes, hands, plan: { shape: plan.shape, pods: !!plan.pods }, islands, shifters, belts, stations, spawns: spawnPool, movers,
    recipes, duration: D, maxOrders: mp ? 5 : li < 2 ? 3 : li < 6 ? 4 : 5,
    orderGap: Math.max(9, 18 - li), stars: [round5(X * 0.3), round5(X * 0.55), round5(X * 0.8)], hz,
  };
}

/** Reachability check: every station must touch floor reachable from spawn, in every wall phase. */
export function validate(L) {
  const { W, H, tiles } = L;
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? tiles[y * W + x] : null);
  // cells a floe or shuttle passes over count as walkable (you wait for it)
  const lane = new Set();
  for (const f of L.floes) {
    if (f.axis === 'x') { for (let x = f.x0; x <= f.x1 + f.w - 1; x++) for (let y = f.y; y < f.y + f.h; y++) lane.add(x + ',' + y); }
    else for (let x = f.x; x < f.x + f.w; x++) for (let y = f.y0; y <= f.y1 + f.h - 1; y++) lane.add(x + ',' + y);
  }
  for (const h of L.hands || []) for (const [x, y] of h.cells) lane.add(x + ',' + y);
  const offB = new Set();
  for (const b of L.bridges) if (b.shifting) for (const [x, y] of b.tiles) offB.add(x + ',' + y);
  const errors = [];
  for (const phase of [0, 1]) {
    const walk = (t) => {
      if (!t) return false;
      if (t.wallShift) {
        const s = L.shifters.find((q) => q.x === t.x && q.y === t.y);
        if (s && ((s.phase < 0.25 ? 0 : 1) === phase)) return false;
      }
      if (t.track) return false;
      if (t.k === 'bridge') return !(phase === 1 && offB.has(t.x + ',' + t.y));
      if (t.k === 'floor') return true;
      if (t.k === 'void' && lane.has(t.x + ',' + t.y)) return true;
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
