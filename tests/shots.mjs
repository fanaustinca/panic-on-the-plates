// Visual review: renders the title, lobby, countdown and a gameplay frame of chosen levels.
// usage: node tests/shots.mjs [level ...]   e.g. node tests/shots.mjs 0-0 3-5   (default: level 1 of every world)
import { serve, launch, openPage, shots } from './harness.mjs';
import path from 'node:path';

const levels = process.argv.slice(2).filter((a) => /^\d-\d+$/.test(a));
const list = levels.length ? levels : ['0-0', '1-3', '2-5', '3-4', '4-6', '5-6', '6-5', '7-8'];
const menus = !levels.length || process.argv.includes('menus');
const srv = await serve();
const url = `http://127.0.0.1:${srv.address().port}/?test&unlock&net=local`;
const browser = await launch();
const { page, errors } = await openPage(browser, url, { width: 1600, height: 900 });
const snap = async (name) => { await new Promise((r) => setTimeout(r, 120)); await page.screenshot({ path: path.join(shots, name) }); console.log('  shot', name); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.evaluate(() => document.fonts.ready);
if (menus) {
  await sleep(800);
  await snap('title.png');
  await page.evaluate(() => { PANIC.app.save.name = 'Austin'; PANIC.app.solo(); });
  await sleep(700);
  await snap('lobby-level.png');
  await page.evaluate(() => { PANIC.app.ui.tab = 'outfit'; PANIC.app.ui.renderSide(); PANIC.app.setProfile({ outfit: 'pirate' }); });
  await sleep(500);
  await snap('lobby-outfit.png');
}
for (const lv of list) {
  await page.evaluate((lv) => { if (!PANIC.app.members || !PANIC.app.members.size) PANIC.app.solo(); PANIC.app.startMatch(lv); }, lv);
  await sleep(400);
  if (menus && lv === list[0]) await snap(`countdown-${lv}.png`);
  // skip the countdown, then let the kitchen run a few seconds with some activity
  await page.evaluate(() => {
    const g = PANIC.game; for (let i = 0; i < 80; i++) g.sim.step(0.05);
    const s = g.sim; const L = g.L;
    // stage a busy kitchen for the screenshot
    const pan = L.stations.find((t) => t.st === 'pan' || t.st === 'pot' || t.st === 'oven');
    const ing = L.recipes.flatMap((r) => r.ings).find((id) => true);
    const board = L.stations.find((t) => t.st === 'board');
    if (board) s.st(board.x, board.y).item = { kind: 'ing', ing, s: 'raw', p: 0.5 };
    const counter = L.tiles.find((t) => t.st === 'counter' && t.y === L.H - 1 && t.x > 2);
    if (counter) s.st(counter.x, counter.y).item = { kind: 'plate', n: 1, dirty: false, c: [{ ing, s: 'chopped' }] };
    s.players[0].held = { kind: 'ing', ing, s: 'raw', p: 0 };
    s.players[0].fx = 0; s.players[0].fy = 1;
  });
  await sleep(1500);
  await snap(`play-${lv}.png`);
  await page.evaluate(() => PANIC.app.backToLobby());
  await sleep(200);
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
srv.close();
