// Kitchen floor plans. Every level is a handful of zones (islands, compartments, pods...) laid on a
// coarse grid of columns/rows, joined across void gaps. Pure data so the node tests can import it.
//
// A plan is { cw: [column widths], rh: [row heights], gx, gy (gap sizes), cells: [[c0, r0, c1, r1]...],
// shape: 'rect' | 'notch' | 'round' | 'gear', inset, drop (links to leave out) }.

const single = (w, h) => ({ cw: [w], rh: [h], cells: [[0, 0, 0, 0]] });
const row = (ws, h) => ({ cw: ws, rh: [h], cells: ws.map((_, i) => [i, 0, i, 0]) });
/** One wide zone across the back, smaller ones in front. */
const stackTop = (ws, h1, h2) => ({ cw: ws, rh: [h1, h2], cells: [[0, 0, ws.length - 1, 0], ...ws.map((_, i) => [i, 1, i, 1])] });
/** Smaller zones across the back, one wide zone in front. */
const stackBot = (ws, h1, h2) => ({ cw: ws, rh: [h1, h2], cells: [...ws.map((_, i) => [i, 0, i, 0]), [0, 1, ws.length - 1, 1]] });
/** A tall zone down the left, two stacked on the right. */
const lLeft = (w1, w2, h1, h2) => ({ cw: [w1, w2], rh: [h1, h2], cells: [[0, 0, 0, 1], [1, 0, 1, 0], [1, 1, 1, 1]] });
const lRight = (w1, w2, h1, h2) => ({ cw: [w1, w2], rh: [h1, h2], cells: [[0, 0, 0, 0], [0, 1, 0, 1], [1, 0, 1, 1]] });
const grid = (ws, hs, skip = []) => ({ cw: ws, rh: hs, cells: hs.flatMap((_, j) => ws.map((_, i) => [i, j, i, j])).filter((_, k) => !skip.includes(k)) });

/** Pick the plan for level li (0..9, mp = multiplayer kitchen) of world wi. */
export function planFor(wi, li, mp, r) {
  const P = (plan, extra = {}) => {
    Object.assign(plan, { gx: 1, gy: 1, shape: 'rect', inset: 0, drop: 0 }, extra);
    if (wi && wi !== 3 && plan.cw.length >= 3 && plan.rh.length === 1) plan.gx = 1; // three across: keep the kitchen from getting too wide
    return plan;
  };
  switch (wi) {
    case 0: { // pirate: the deck stays a rectangle; hatches split it into two or three galleys
      const W = mp ? 19 : [11, 12, 12, 13, 13, 14, 14, 15, 15, 16][li], H = mp ? 11 : li < 4 ? 9 : 10;
      const Z = mp ? 2 : li < 2 ? 1 : li < 4 ? (r.chance(0.5) ? 1 : 2) : li < 8 ? 2 : (W >= 15 ? 3 : 2);
      const g = li >= 6 && r.chance(0.5) ? 2 : 1, use = W - (Z - 1) * g;
      const ws = Array.from({ length: Z }, (_, i) => (i < Z - 1 ? Math.floor(use / Z) + (i === 0 && use % Z ? 1 : 0) : 0));
      ws[Z - 1] = use - ws.reduce((a, b) => a + b, 0);
      return P(row(ws, H), { gx: g, divider: Z === 1 && li >= 2 });
    }
    case 1: { // glacier: separate glaciers in the sea, joined by ice bridges (and the odd drifting floe)
      if (mp) return P(grid([8, 8], [6, 6]), { gx: 2, gy: 2, shape: 'notch' });
      return P([
        single(10, 8), row([6, 7], 8), stackTop([6, 6], 5, 5), lLeft(6, 6, 5, 5), row([7, 7], 9),
        grid([6, 6], [5, 5]), stackBot([6, 6], 5, 5), lRight(7, 6, 5, 5), grid([6, 7], [5, 6]), stackTop([7, 7], 6, 5),
      ][li], { gx: 2, gy: 2, shape: 'notch', inset: li >= 1 ? 1 : 0, drop: li === 5 ? 1 : 0 });
    }
    case 2: { // volcanic core: basalt islands in the lava, lava pits, sinking stepping stones
      if (mp) return P(grid([9, 8], [6, 6]), { gx: 2, gy: 2, shape: 'notch' });
      return P([
        single(11, 8), row([6, 6], 9), stackTop([6, 6], 5, 5), lLeft(6, 6, 5, 5), row([5, 5, 5], 9),
        grid([6, 6], [5, 5]), stackBot([6, 7], 5, 5), lRight(7, 6, 5, 6), grid([7, 6], [5, 6]), row([5, 6, 5], 10),
      ][li], { gx: li >= 6 ? 2 : 1, gy: li >= 5 ? 2 : 1, shape: 'notch', inset: li >= 1 ? 1 : 0, drop: li === 5 ? 1 : 0 });
    }
    case 3: { // space station: tight compartments joined by tube corridors
      if (mp) return P(grid([6, 6, 6], [6, 5]), { gx: 2, gy: 2, shape: 'rect', drop: 1 });
      return P([
        row([6, 7], 6), grid([6, 6], [6, 5], [3]), grid([6, 6], [6, 5], [0]), grid([6, 6], [6, 5]), grid([5, 5, 5], [6, 5], [0]),
        grid([6, 6], [6, 5]), grid([5, 5, 5], [6, 5]), grid([5, 5, 5], [6, 5], [5]), grid([5, 5, 5], [6, 5]), grid([5, 6, 5], [6, 5]),
      ][li], { gx: 2, gy: 2, shape: 'rect', drop: li === 3 ? 1 : li === 6 ? 2 : li === 8 ? 1 : li === 7 ? 1 : 0 });
    }
    case 4: { // clouds: every zone is its own cloud, rounded off at the corners
      if (mp) return P(grid([9, 8], [6, 6]), { gx: 2, gy: 2, shape: 'round' });
      return P([
        single(10, 8), row([6, 6], 8), stackBot([6, 6], 5, 5), lRight(6, 6, 5, 5), row([5, 5, 5], 9),
        stackTop([6, 7], 5, 5), grid([6, 6], [5, 5]), lLeft(7, 6, 5, 6), row([5, 6, 5], 10), grid([7, 6], [5, 6]),
      ][li], { gx: li >= 3 ? 2 : 1, gy: 2, shape: 'round', inset: li >= 1 ? 1 : 0, drop: li === 6 ? 1 : 0 });
    }
    case 5: { // jungle: three or four small treehouse pods around the great tree
      if (mp) return P(grid([7, 7], [6, 6]), { gx: 3, gy: 3, shape: 'rect', pods: true });
      const plan = li >= 5 ? grid([6, 6], [6, 5]) : li % 2 ? stackTop([6, 6], 6, 5) : stackBot([6, 6], 6, 5);
      return P(plan, { gx: 3, gy: 3, shape: 'rect', pods: true, podInset: li < 5 ? 1 : 0, drop: li === 6 || li === 8 ? 1 : 0 });
    }
    case 6: { // factory: sections joined by conveyor shuttles (side to side) and catwalks (front to back)
      if (mp) return P(grid([8, 8], [6, 6]), { gx: 3, gy: 2, shape: 'rect' });
      return P([
        single(11, 8), row([6, 6], 8), row([6, 7], 9), lLeft(6, 6, 5, 5), row([6, 6], 9),
        stackTop([6, 6], 5, 5), lRight(7, 6, 5, 5), grid([6, 6], [5, 5]), stackBot([6, 7], 5, 5), grid([7, 6], [5, 6]),
      ][li], { gx: 3, gy: 2, shape: li >= 2 ? 'notch' : 'rect', inset: li >= 2 ? 1 : 0 });
    }
    default: { // clockwork tower: gear-cut platforms on the clock's works
      if (mp) return P(grid([9, 8], [6, 6]), { gx: 2, gy: 2, shape: 'gear' });
      return P([
        single(11, 8), row([7, 6], 9), lLeft(6, 6, 5, 5), stackTop([6, 6], 5, 5), row([5, 5, 5], 9),
        grid([6, 6], [5, 5]), stackBot([7, 6], 5, 5), lRight(6, 7, 6, 5), row([5, 6, 5], 10), grid([6, 7], [6, 5]),
      ][li], { gx: li >= 4 ? 2 : 1, gy: 2, shape: 'gear', inset: li >= 1 ? 1 : 0, drop: li === 5 ? 1 : 0 });
    }
  }
}

/**
 * Lay a plan out on the grid: zone rectangles (with outer edges randomly pulled in), the links
 * between neighbouring zones, and which cells each zone's shape cuts away. Returns
 * { W, H, zones: [{x0, y0, x1, y1, cut: Set("x,y")}], links: [{a, b, dir}] }.
 */
export function layOut(plan, r) {
  const { cw, rh, gx, gy } = plan;
  const colX = [], rowY = [];
  cw.reduce((x, w, i) => { colX[i] = x; return x + w + gx; }, 0);
  rh.reduce((y, h, i) => { rowY[i] = y; return y + h + gy; }, 0);
  const zones = plan.cells.map(([c0, r0, c1, r1]) => ({ c0, r0, c1, r1, x0: colX[c0], x1: colX[c1] + cw[c1] - 1, y0: rowY[r0], y1: rowY[r1] + rh[r1] - 1 }));
  // links: zones whose grid cells touch across a gap
  let links = [];
  zones.forEach((a, i) => zones.forEach((b, j) => {
    if (j <= i) return;
    const ovR = Math.min(a.r1, b.r1) >= Math.max(a.r0, b.r0), ovC = Math.min(a.c1, b.c1) >= Math.max(a.c0, b.c0);
    if (ovR && (a.c1 + 1 === b.c0 || b.c1 + 1 === a.c0)) links.push({ a: a.c0 < b.c0 ? i : j, b: a.c0 < b.c0 ? j : i, dir: 'x' });
    if (ovC && (a.r1 + 1 === b.r0 || b.r1 + 1 === a.r0)) links.push({ a: a.r0 < b.r0 ? i : j, b: a.r0 < b.r0 ? j : i, dir: 'y' });
  }));
  // optionally leave links out (a ring of four becomes a horseshoe), never disconnecting the zones
  for (let k = 0; k < (plan.drop || 0); k++) {
    const order = r.shuffle(links.map((_, i) => i));
    for (const i of order) {
      const rest = links.filter((_, j) => j !== i);
      if (connected(zones.length, rest)) { links = rest; break; }
    }
  }
  // pull outer edges in a little so neighbours don't line up like boxes
  const inset = plan.inset || 0;
  if (inset) for (const z of zones) {
    const free = (side) => !zones.some((o) => o !== z && (side === 'top' ? o.r1 < z.r0 && o.c1 >= z.c0 && o.c0 <= z.c1
      : side === 'bot' ? o.r0 > z.r1 && o.c1 >= z.c0 && o.c0 <= z.c1 : side === 'left' ? o.c1 < z.c0 && o.r1 >= z.r0 && o.r0 <= z.r1 : o.c0 > z.c1 && o.r1 >= z.r0 && o.r0 <= z.r1));
    if (z.y1 - z.y0 >= 6 && free('top') && r.chance(0.5)) z.y0 += r.int(1, inset);
    if (z.y1 - z.y0 >= 6 && free('bot') && r.chance(0.5)) z.y1 -= r.int(1, inset);
    if (z.x1 - z.x0 >= 6 && free('left') && r.chance(0.3)) z.x0 += 1;
    if (z.x1 - z.x0 >= 6 && free('right') && r.chance(0.3)) z.x1 -= 1;
  }
  if (plan.podInset) for (const z of zones) if (z.c1 > z.c0) { z.x0 += 3; z.x1 -= 3; } // the wide pod shrinks to sit between the other two
  // normalise so the layout starts at 0,0
  const mx = Math.min(...zones.map((z) => z.x0)), my = Math.min(...zones.map((z) => z.y0));
  for (const z of zones) { z.x0 -= mx; z.x1 -= mx; z.y0 -= my; z.y1 -= my; }
  const W = Math.max(...zones.map((z) => z.x1)) + 1, H = Math.max(...zones.map((z) => z.y1)) + 1;
  // shapes: cut cells away from the corners
  for (const z of zones) {
    z.cut = new Set();
    const w = z.x1 - z.x0 + 1, h = z.y1 - z.y0 + 1;
    const corner = (cx, cy, nw, nh) => {
      for (let dy = 0; dy < nh; dy++) for (let dx = 0; dx < nw; dx++) z.cut.add(`${cx < 0 ? z.x1 - dx : z.x0 + dx},${cy < 0 ? z.y1 - dy : z.y0 + dy}`);
    };
    const corners = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
    if (plan.shape === 'round' && w >= 5 && h >= 5) corners.forEach(([a, b]) => corner(a, b, 1, 1));
    if (plan.shape === 'gear' && w >= 5 && h >= 5) corners.forEach(([a, b]) => { corner(a, b, 1, 1); if (w >= 8 && h >= 8) { corner(a, b, 2, 1); corner(a, b, 1, 2); } });
    if (plan.shape === 'notch' && w >= 7 && h >= 6) {
      for (const [a, b] of r.shuffle(corners.slice()).slice(0, r.int(1, 2))) corner(a, b, r.int(2, Math.min(3, Math.floor(w / 3))), r.int(2, Math.min(3, Math.floor(h / 3))));
    }
  }
  return { W, H, zones, links };
}

function connected(n, links) {
  const seen = new Set([0]), q = [0];
  while (q.length) { const i = q.shift(); for (const l of links) for (const [u, v] of [[l.a, l.b], [l.b, l.a]]) if (u === i && !seen.has(v)) { seen.add(v); q.push(v); } }
  return seen.size === n;
}
