// Node logic tests: every one of the 80 levels generates, validates, and every recipe in it can
// actually be cooked and delivered through the real Sim rules (cook teleported between stations).
import { WORLDS, INGREDIENTS, T } from '../src/config.js';
import { buildLevel, validate } from '../src/levels.js';
import { Sim, movePlayer, starsFor } from '../src/sim.js';
import { envAt, deadlyCells } from '../src/hazards.js';

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
};
const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };

const levels = [];
test('all 80 levels generate and validate', () => {
  for (let w = 0; w < 8; w++) for (let l = 0; l < 10; l++) {
    const L = buildLevel(w, l);
    const v = validate(L);
    assert(v.ok, `${L.id}: ${v.errors.join('; ')}`);
    levels.push(L);
  }
  assert(levels.length === 80);
});

test('levels are unique layouts', () => {
  const sig = new Set(levels.map((L) => L.tiles.map((t) => t.k[0] + (t.st || '')[0]).join('')));
  assert(sig.size === 80, `only ${sig.size} unique layouts`);
});

test('levels are deterministic', () => {
  const a = buildLevel(3, 7), b = buildLevel(3, 7);
  assert(JSON.stringify(a.tiles) === JSON.stringify(b.tiles));
});

test('recipe complexity grows through each world', () => {
  for (let w = 0; w < 8; w++) {
    const avg = (L) => L.recipes.reduce((s, r) => s + r.ings.length, 0) / L.recipes.length;
    const first = levels[w * 10], last = levels[w * 10 + 9];
    assert(avg(last) > avg(first) + 1, `${WORLDS[w].id}: ${avg(first)} -> ${avg(last)}`);
  }
});

test('each world has its signature hazard', () => {
  const need = { pirate: 'tilt', glacier: 'ice', volcano: 'firewalls', space: 'lasers', clouds: 'gusts', jungle: 'monkeys', library: 'cuckoo' };
  for (const L of levels.filter((L) => L.index === 9)) {
    const id = WORLDS[L.world].id;
    if (need[id]) assert(L.hz[need[id]], `${L.id} missing ${need[id]}`);
    if (id === 'factory') assert(L.belts.length && L.belts[0].lever, `${L.id} missing belts/lever`);
    if (id === 'glacier') assert(L.floes.length, 'glacier floes');
  }
  assert(levels.some((L) => L.shifters.length) && levels.some((L) => L.bridges.some((b) => b.shifting)), 'shifting walls/bridges');
});

// --- cook every recipe through the rules ---
function standNext(sim, p, [x, y]) {
  const L = sim.L;
  let best = null;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const t = x + dx >= 0 && x + dx < L.W ? L.tiles[(y + dy) * L.W + (x + dx)] : null;
    if (!t || (t.k !== 'floor' && t.k !== 'bridge') || t.wallShift) continue;
    const d = Math.hypot(dx, dy);
    if (!best || d < best[2]) best = [dx, dy, d];
  }
  const [dx, dy, d] = best;
  p.x = x + dx + 0.5; p.y = y + dy + 0.5; p.fx = -dx / d; p.fy = -dy / d;
}
function act(sim, p, tile) { standNext(sim, p, [tile.x, tile.y]); sim.press(p.id, [tile.x, tile.y]); }
function work(sim, p, tile, secs) {
  standNext(sim, p, [tile.x, tile.y]);
  sim.press(p.id, [tile.x, tile.y]);
  sim.setWork(p.id, true, [tile.x, tile.y]);
  for (let i = 0; i < secs * 30; i++) { standNext(sim, p, [tile.x, tile.y]); sim.step(1 / 30); }
  sim.setWork(p.id, false);
}
const find = (L, pred) => L.stations.find(pred);
const reach = (L, t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const q = L.tiles[(t.y + dy) * L.W + t.x + dx]; return q && t.x + dx >= 0 && t.x + dx < L.W && (q.k === 'floor' || q.k === 'bridge') && !q.wallShift; });
const freeCounter = (sim) => sim.L.tiles.find((t) => t.k === 'counter' && t.st === 'counter' && t.belt == null && reach(sim.L, t) && !sim.st(t.x, t.y).item && !sim.st(t.x, t.y).fire);

function cookRecipe(sim, p, rc) {
  const L = sim.L;
  const plates = find(L, (s) => s.st === 'plates');
  const spot = freeCounter(sim);
  act(sim, p, plates); assert(p.held && p.held.kind === 'plate', 'took plate: ' + JSON.stringify(p.held));
  act(sim, p, spot); assert(!p.held, 'put plate down');
  for (const id of rc.ings) {
    const m = INGREDIENTS[id].method;
    act(sim, p, find(L, (s) => s.st === 'bin' && s.ing === id));
    assert(p.held && p.held.ing === id, 'grabbed ' + id);
    const board = find(L, (s) => s.st === 'board' && !sim.st(s.x, s.y).item);
    act(sim, p, board);
    work(sim, p, board, T.chopTime + 0.3);
    assert(sim.st(board.x, board.y).item.s === 'chopped', 'chopped ' + id);
    act(sim, p, board);
    if (m !== 'chop') {
      const cooker = find(L, (s) => s.st === m && !sim.st(s.x, s.y).item && !sim.st(s.x, s.y).fire);
      assert(cooker, 'cooker ' + m);
      act(sim, p, cooker); assert(!p.held, 'into ' + m);
      for (let i = 0; i < (T.cook[m] + 0.3) * 30; i++) sim.step(1 / 30);
      assert(sim.st(cooker.x, cooker.y).item.s === 'cooked', m + ' cooked');
      act(sim, p, cooker);
    }
    act(sim, p, spot);
    assert(!p.held, 'plated ' + id + ' held=' + JSON.stringify(p.held));
  }
  act(sim, p, spot);
  assert(p.held && p.held.c.length === rc.ings.length, 'picked full plate');
  const before = sim.score;
  act(sim, p, find(L, (s) => s.st === 'window'));
  return sim.score - before;
}

test('every recipe in every level can be cooked and delivered', () => {
  for (const L of levels) {
    for (const rc of L.recipes) {
      const sim = new Sim(L, [{ id: 'a', name: 'A', outfit: 'chef', color: 0 }], 5);
      sim.L.hz = {}; // isolate the rules from hazards for this test
      const p = sim.players[0];
      while (sim.phase !== 'play') sim.step(0.1);
      sim.orders = [{ id: 99, r: L.recipes.indexOf(rc), t0: sim.t, lim: 999 }];
      try {
        const gained = cookRecipe(sim, p, rc);
        assert(gained > 0, `no score for ${rc.name}`);
      } catch (e) { throw new Error(`${L.id} ${rc.name}: ${e.message}`); }
    }
  }
});

test('burning a pan starts a fire that spreads and the extinguisher puts it out', () => {
  const L = buildLevel(0, 0);
  const sim = new Sim(L, [{ id: 'a', name: 'A', outfit: 'chef', color: 0 }], 1);
  sim.L = { ...L, hz: {} };
  const p = sim.players[0];
  while (sim.phase !== 'play') sim.step(0.1);
  const pan = find(L, (s) => s.st === 'pan');
  sim.st(pan.x, pan.y).item = { kind: 'ing', ing: 'saltfish', s: 'chopped', p: 0 };
  for (let i = 0; i < 30 * 30; i++) sim.step(1 / 30);
  assert(sim.st(pan.x, pan.y).fire > 0, 'pan on fire');
  const burning = sim.ts.filter((s) => s.fire).length;
  assert(burning >= 2, 'fire spread: ' + burning);
  const ext = find(L, (s) => s.st === 'ext');
  act(sim, p, ext); assert(p.held && p.held.kind === 'ext', 'took extinguisher');
  for (let k = 0; k < 40 && sim.ts.some((s) => s.fire); k++) {
    const i = sim.ts.findIndex((s) => s.fire);
    standNext(sim, p, [i % L.W, Math.floor(i / L.W)]);
    sim.setWork('a', true);
    for (let j = 0; j < 30; j++) { standNext(sim, p, [i % L.W, Math.floor(i / L.W)]); sim.step(1 / 30); }
  }
  assert(!sim.ts.some((s) => s.fire), 'all fires out: ' + JSON.stringify(sim.ts.map((s, i) => (s.fire ? [i % L.W, Math.floor(i / L.W), +s.fire.toFixed(2)] : null)).filter(Boolean)) + ' held ' + JSON.stringify(p.held));
});

test('dirty plates come back and can be washed', () => {
  const L = buildLevel(0, 0);
  const sim = new Sim(L, [{ id: 'a', name: 'A', outfit: 'chef', color: 0 }], 1);
  sim.L = { ...L, hz: {} };
  const p = sim.players[0];
  while (sim.phase !== 'play') sim.step(0.1);
  sim.orders = [{ id: 99, r: 0, t0: sim.t, lim: 999 }];
  cookRecipe(sim, p, L.recipes[0]);
  for (let i = 0; i < (T.dirtyDelay + 1) * 30; i++) sim.step(1 / 30);
  const ret = find(L, (s) => s.st === 'return');
  assert(sim.st(ret.x, ret.y).dirty === 1, 'dirty plate returned');
  act(sim, p, ret); assert(p.held.dirty, 'carry dirty');
  const sink = find(L, (s) => s.st === 'sink');
  act(sim, p, sink);
  work(sim, p, sink, T.washTime + 0.3);
  assert(sim.st(sink.x, sink.y).clean === 1, 'washed');
  act(sim, p, sink); assert(p.held && p.held.kind === 'plate' && !p.held.dirty, 'clean plate');
});

test('orders expire and cost points; game ends with stars', () => {
  const L = buildLevel(0, 1);
  const sim = new Sim(L, [{ id: 'a', name: 'A', outfit: 'chef', color: 0 }], 1);
  sim.score = 50;
  while (sim.phase !== 'over') sim.step(0.1);
  assert(sim.failed > 0 && sim.score < 50, `failed ${sim.failed} score ${sim.score}`);
  assert(starsFor(L, L.stars[2]) === 3 && starsFor(L, 0) === 0);
});

test('movement: walls block, ice slides, falling into the void knocks out', () => {
  const L = buildLevel(0, 0);
  const p = { x: 2.5, y: 2.5, z: 0, vx: 0, vy: 0, vz: 0, fx: 0, fy: 1, ko: 0 };
  for (let i = 0; i < 120; i++) movePlayer({ ...L, hz: {} }, p, { mx: -1, my: 0 }, 1 / 60, 0);
  assert(p.x >= 1 + T.radius - 1e-6, 'stopped at counter ' + p.x);
  const G = buildLevel(1, 3);
  const q = { x: G.spawns[0][0] + 0.5, y: G.spawns[0][1] + 0.5, z: 0, vx: 0, vy: 0, vz: 0, fx: 0, fy: 1, ko: 0 };
  for (let i = 0; i < 20; i++) movePlayer(G, q, { mx: 1, my: 0 }, 1 / 60, 0);
  const v1 = q.vx;
  for (let i = 0; i < 6; i++) movePlayer(G, q, { mx: 0, my: 0 }, 1 / 60, 0);
  assert(q.vx > v1 * 0.5, 'ice keeps momentum');
  // walk a cook into a gap
  const P = buildLevel(0, 9);
  const gap = P.gaps[0];
  const r = { x: gap.x0 - 0.5, y: P.bridges[0].row + 1.5, z: 0, vx: 0, vy: 0, vz: 0, fx: 1, fy: 0, ko: 0 };
  let fell = false;
  for (let i = 0; i < 400 && !fell; i++) {
    r.x = Math.max(r.x, gap.x0 + 0.2); // stand over the gap
    fell = movePlayer({ ...P, hz: {}, bridges: [], tiles: P.tiles }, r, { mx: 0, my: 0 }, 1 / 60, 0) === 'fell';
  }
  assert(fell, 'fell');
});

test('hazards fire on schedule', () => {
  const V = buildLevel(2, 9);
  let hit = false;
  for (let t = 0; t < 60 && !hit; t += 0.1) hit = deadlyCells(V, t).size > 0;
  assert(hit, 'volcano deadly cells');
  const P = buildLevel(0, 5);
  assert(Math.abs(envAt(P, P.hz.tilt.period / 4).tiltAngle) > 0.03, 'tilt');
  const C = buildLevel(4, 5);
  const g = C.hz.gusts[0];
  assert(Math.hypot(...envAt(C, g.t + 0.5).push) > 1, 'gust push');
  const S = buildLevel(3, 4);
  let low = false;
  for (let t = 0; t < 40; t += 0.5) low ||= envAt(S, t).lowG;
  assert(low, 'gravity drops');
});

test('jungle monkeys steal from counters', () => {
  const L = buildLevel(5, 6);
  const sim = new Sim(L, [], 3);
  while (sim.phase !== 'play') sim.step(0.1);
  const c = freeCounter(sim);
  sim.st(c.x, c.y).item = { kind: 'ing', ing: 'treenut', s: 'raw', p: 0 };
  let stolen = false;
  sim.events.length = 0;
  for (let i = 0; i < 60 * 30 && !stolen; i++) { sim.step(1 / 30); stolen = sim.events.some((e) => e.type === 'stolen'); }
  assert(stolen, 'monkey stole something');
});

test('factory belts carry items and the lever reverses them', () => {
  const L = buildLevel(6, 4);
  const sim = new Sim(L, [{ id: 'a', name: 'A', outfit: 'chef', color: 0 }], 1);
  while (sim.phase !== 'play') sim.step(0.1);
  const b = L.belts[0];
  const [x0, y0] = b.tiles[0];
  sim.st(x0, y0).item = { kind: 'ing', ing: 'gearcorn', s: 'raw', p: 0 };
  for (let i = 0; i < 30 * 3; i++) sim.step(1 / 30);
  assert(!sim.st(x0, y0).item, 'item moved off the first tile');
  const lv = L.stations.find((s) => s.st === 'lever');
  act(sim, sim.players[0], lv);
  assert(sim.beltDir[0] === -1, 'lever flipped');
});

test('snapshot round trip', () => {
  const L = buildLevel(4, 4);
  const host = new Sim(L, [{ id: 'a', name: 'A', outfit: 'chef', color: 0 }, { id: 'b', name: 'B', outfit: 'chef', color: 1 }], 1);
  for (let i = 0; i < 100; i++) host.step(0.05);
  const json = JSON.stringify(host.snapshot());
  const cl = new Sim(L, [{ id: 'a', name: 'A', outfit: 'chef', color: 0 }, { id: 'b', name: 'B', outfit: 'chef', color: 1 }], 1);
  cl.applySnapshot(JSON.parse(json), 'b');
  assert(cl.orders.length === host.orders.length && Math.abs(cl.t - host.t) < 1e-3);
  assert(json.length < 6000, 'snapshot size ' + json.length);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
