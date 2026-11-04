// Headless browser tests (Puppeteer): boots the built game, renders and checks the canvas,
// plays with the real keyboard, and runs a two-tab multiplayer session over ?net=local.
import { serve, launch, openPage, test, assert, summary, shot } from './harness.mjs';

const srv = await serve();
const base = `http://127.0.0.1:${srv.address().port}/?test&unlock&net=local`;
const browser = await launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.env.ONLY;
const T = async (name, fn) => { if (only && !name.includes(only)) return; await test(name, fn); };

/** Canvas pixel statistics (needs ?test so the drawing buffer is preserved). */
const canvasStats = (page) => page.evaluate(() => {
  const c = document.getElementById('view');
  const s = document.createElement('canvas'); s.width = 160; s.height = 90;
  const g = s.getContext('2d'); g.drawImage(c, 0, 0, 160, 90);
  const d = g.getImageData(0, 0, 160, 90).data;
  let sum = 0, sum2 = 0; const colors = new Set();
  for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; sum += v; sum2 += v * v; colors.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4)); }
  const n = d.length / 4, mean = sum / n;
  return { mean, std: Math.sqrt(sum2 / n - mean * mean), colors: colors.size };
});
const waitPlay = (page) => page.waitForFunction(() => PANIC.game && PANIC.game.sim.phase === 'play', { polling: 100, timeout: 120000 });

await T('boots to the title screen with no errors', async () => {
  const { page, errors } = await openPage(browser, base);
  await page.waitForSelector('.title-screen');
  const txt = await page.$eval('.logo', (e) => e.textContent);
  assert(/PANIC/.test(txt), 'logo');
  await sleep(500);
  const st = await canvasStats(page);
  assert(st.std > 10 && st.colors > 40, 'lobby scene rendered: ' + JSON.stringify(st));
  assert(!errors.length, errors.join('\n'));
  await shot(page, 'e2e-title.png');
  await page.close();
});

await T('solo: countdown, keyboard movement, grab with Enter, chop by holding Enter', async () => {
  const { page, errors } = await openPage(browser, base);
  await page.evaluate(() => { PANIC.app.save.name = 'Tester'; PANIC.app.solo(); });
  if (process.env.TRACE) console.log('      wait #1');
  await page.waitForSelector('.lobby');
  await page.click('#start');
  if (process.env.TRACE) console.log('      wait #2');
  await page.waitForFunction(() => document.querySelector('.countdown .word.ready'), { polling: 100, timeout: 20000 }).catch(async (e) => { console.log(await page.evaluate(() => JSON.stringify({ hidden: document.hidden, g: !!PANIC.game, t: PANIC.game && PANIC.game.sim.t, cd: document.querySelector('.countdown')?.innerHTML.slice(0, 200), mode: PANIC.app.mode }))); throw e; });
  const before = await page.evaluate(() => ({ x: PANIC.game.me.x, y: PANIC.game.me.y }));
  await page.keyboard.down('KeyD'); await sleep(300); await page.keyboard.up('KeyD');
  const still = await page.evaluate(() => ({ x: PANIC.game.me.x, y: PANIC.game.me.y }));
  assert(Math.abs(still.x - before.x) < 1e-6, 'inputs locked during the countdown');
  if (process.env.TRACE) console.log('      wait #3');
  await page.waitForFunction(() => [...document.querySelectorAll('.countdown .word')].some((w) => /Cook/.test(w.textContent)) || PANIC.game.sim.t > 0.3, { polling: 50 });
  await waitPlay(page);
  await page.keyboard.down('KeyD');
  await page.waitForFunction((x0) => PANIC.game.me.x > x0 + 0.5, { polling: 50, timeout: 60000 }, before.x).catch(() => {});
  await page.keyboard.up('KeyD');
  const after = await page.evaluate(() => ({ x: PANIC.game.me.x, y: PANIC.game.me.y }));
  assert(after.x > before.x + 0.3, `moved right ${before.x} -> ${after.x}`);
  // jump
  await page.keyboard.press('Space');
  if (process.env.TRACE) console.log('      wait #4');
  await page.waitForFunction(() => PANIC.game.me.z > 0.05, { polling: 20, timeout: 5000 });
  // walk the cook in front of the first ingredient crate and press Enter
  if (process.env.TRACE) console.log('      wait #5');
  await page.waitForFunction(() => PANIC.game.me.z === 0, { polling: 50 });
  await page.evaluate(() => {
    const g = PANIC.game, L = g.L, me = g.me;
    const bin = L.stations.find((t) => t.st === 'bin');
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) { const t = L.tiles[(bin.y + dy) * L.W + bin.x + dx]; if (t && t.k === 'floor') { me.x = bin.x + dx + 0.5; me.y = bin.y + dy + 0.5; me.fx = -dx; me.fy = -dy; break; } }
  });
  await sleep(100);
  await page.keyboard.press('Enter');
  if (process.env.TRACE) console.log('      wait #6');
  await page.waitForFunction(() => PANIC.game.me.held && PANIC.game.me.held.kind === 'ing', { polling: 50, timeout: 5000 });
  // to a board: put it down, hold Enter to chop
  await page.evaluate(() => {
    const g = PANIC.game, L = g.L, me = g.me;
    const b = L.stations.find((t) => t.st === 'board');
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) { const t = L.tiles[(b.y + dy) * L.W + b.x + dx]; if (t && t.k === 'floor') { me.x = b.x + dx + 0.5; me.y = b.y + dy + 0.5; me.fx = -dx; me.fy = -dy; break; } }
  });
  await sleep(100);
  await page.keyboard.press('Enter');
  if (process.env.TRACE) console.log('      wait #7');
  await page.waitForFunction(() => !PANIC.game.me.held, { polling: 50, timeout: 5000 });
  await page.keyboard.down('Enter');
  if (process.env.TRACE) console.log('      wait #8');
  await page.waitForFunction(() => { const g = PANIC.game; return g.sim.ts.some((s) => s.item && s.item.kind === 'ing' && s.item.s === 'chopped'); }, { polling: 100, timeout: 90000 });
  await page.keyboard.up('Enter');
  await sleep(300);
  const st = await canvasStats(page);
  assert(st.std > 12 && st.colors > 60, 'kitchen rendered: ' + JSON.stringify(st));
  const hud = await page.evaluate(() => ({ tickets: document.querySelectorAll('.ticket').length, hint: document.querySelector('.hint').textContent }));
  assert(hud.tickets >= 1, 'order tickets on screen');
  await shot(page, 'e2e-solo.png');
  // serve a finished plate at the window: the game must keep rendering afterwards (regression: froze after the first delivery)
  await page.evaluate(() => {
    const g = PANIC.game, L = g.L, me = g.me, o = g.sim.orders[0];
    const rc = L.recipes[o.r];
    me.held = { kind: 'plate', n: 1, dirty: false, c: rc.ings.map((ing) => ({ ing, s: PANIC.finalState(ing) })) };
    const w = L.stations.find((t) => t.st === 'window');
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) { const t = L.tiles[(w.y + dy) * L.W + w.x + dx]; if (t && t.k === 'floor') { me.x = w.x + dx + 0.5; me.y = w.y + dy + 0.5; me.fx = -dx; me.fy = -dy; break; } }
  });
  await sleep(100);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => PANIC.game.sim.delivered >= 1, { polling: 100, timeout: 45000 });
  // software GL on CI can be ~1 fps, so wait for frames rather than a fixed time
  const f0 = await page.evaluate(() => PANIC.game.frames);
  const ok = await page.waitForFunction((f0) => PANIC.game.frames > f0 + 3, { polling: 100, timeout: 45000 }, f0).then(() => true, () => false);
  assert(ok, `still rendering after a delivery (stuck at ${f0} frames)`);
  assert(!errors.length, errors.join('\n'));
  await page.close();
});

await T('every world renders a level', async () => {
  const { page, errors } = await openPage(browser, base);
  await page.evaluate(() => PANIC.app.solo());
  for (let w = 0; w < 8; w++) {
    const lv = `${w}-${(w * 3) % 10}`;
    await page.evaluate((lv) => PANIC.app.startMatch(lv), lv);
    await page.evaluate(() => { for (let i = 0; i < 90; i++) PANIC.game.sim.step(0.05); });
    await sleep(500);
    const st = await canvasStats(page);
    assert(st.std > 8 && st.colors > 40, `${lv} rendered: ${JSON.stringify(st)}`);
    await shot(page, `e2e-world-${w}.png`);
    await page.evaluate(() => PANIC.app.backToLobby());
  }
  assert(!errors.length, errors.join('\n'));
  await page.close();
});

await T('multiplayer: quick match pairs two tabs, world vote + dice, start, movement and actions sync', async () => {
  const A = await openPage(browser, base);
  const B = await openPage(browser, base);
  await A.page.evaluate(() => { PANIC.app.save.name = 'Host'; PANIC.app.quickMatch(); });
  console.log('      mp step 1');
  await A.page.waitForSelector('.lobby', { timeout: 90000 });
  assert(await A.page.evaluate(() => PANIC.app.isHost), 'A hosts when no rooms are open');
  await B.page.bringToFront();
  await B.page.evaluate(() => { PANIC.app.save.name = 'Guest'; PANIC.app.save.outfit = 'wizard'; PANIC.app.quickMatch(); });
  console.log('      mp step 2');
  await B.page.waitForSelector('.lobby', { timeout: 90000 });
  assert(!(await B.page.evaluate(() => PANIC.app.isHost)), 'B joined as client');
  console.log('      mp step 3');
  await A.page.waitForFunction(() => PANIC.app.members.size === 2, { polling: 100, timeout: 60000 });
  console.log('      mp step 4');
  await B.page.waitForFunction(() => PANIC.app.members.size === 2, { polling: 100, timeout: 60000 });
  // the room browser sees the room
  // vote + ready from B, start from A
  await B.page.evaluate(() => { PANIC.app.vote('4'); PANIC.app.toggleReady(); });
  console.log('      mp step 5');
  await A.page.waitForFunction(() => PANIC.app.pickLevel() === '4-10' && [...PANIC.app.members.values()].every((m) => m.ready), { polling: 100, timeout: 60000 });
  await shot(A.page, 'e2e-mp-lobby.png');
  console.log('      mp step 6');
  await A.page.evaluate(() => PANIC.app.startMatch());
  console.log('      mp step 7');
  // the dice overlay shows on both screens, then the world's multiplayer kitchen loads
  await B.page.waitForSelector('.dice-bg', { timeout: 60000 });
  await B.page.waitForFunction(() => PANIC.game && PANIC.game.L.id === '4-10', { polling: 100, timeout: 90000 });
  console.log('      mp step 8');
  await B.page.waitForFunction(() => PANIC.game.sim.phase === 'play', { polling: 100, timeout: 60000 });
  const bid = await B.page.evaluate(() => PANIC.app.selfId);
  const p0 = await A.page.evaluate((id) => { const p = PANIC.game.sim.player(id); return { x: p.x, y: p.y, outfit: p.outfit }; }, bid);
  assert(p0.outfit === 'wizard', 'host sees guest outfit');
  await B.page.bringToFront();
  await B.page.keyboard.down('KeyA');
  console.log('      mp step 9');
  await B.page.waitForFunction((x0) => PANIC.game.me.x < x0 - 0.6, { polling: 50, timeout: 60000 }, p0.x).catch(() => {});
  await B.page.keyboard.up('KeyA');
  // the host hears about it within a few position packets
  console.log('      mp step 10');
  await A.page.waitForFunction((id, x0) => PANIC.game.sim.player(id).x < x0 - 0.3, { polling: 100, timeout: 90000 }, bid, p0.x).catch(() => {});
  const p1 = await A.page.evaluate((id) => { const p = PANIC.game.sim.player(id); return { x: p.x, y: p.y }; }, bid);
  assert(p1.x < p0.x - 0.3, `host saw guest move ${p0.x} -> ${p1.x}`);
  // guest grabs from a crate through the host
  await B.page.evaluate(() => {
    const g = PANIC.game, L = g.L, me = g.me;
    const bin = L.stations.find((t) => t.st === 'bin');
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) { const t = L.tiles[(bin.y + dy) * L.W + bin.x + dx]; if (t && t.k === 'floor') { me.x = bin.x + dx + 0.5; me.y = bin.y + dy + 0.5; me.fx = -dx; me.fy = -dy; break; } }
  });
  await sleep(300);
  await B.page.keyboard.press('Enter');
  console.log('      mp step 11');
  await A.page.waitForFunction((id) => { const p = PANIC.game.sim.player(id); return p.held && p.held.kind === 'ing'; }, { polling: 100, timeout: 60000 }, bid);
  console.log('      mp step 12');
  await B.page.waitForFunction(() => PANIC.game.me.held && PANIC.game.me.held.kind === 'ing', { polling: 100, timeout: 60000 });
  // orders mirrored
  const oa = await A.page.evaluate(() => PANIC.game.sim.orders.map((o) => o.id).join());
  await sleep(300);
  const ob = await B.page.evaluate(() => PANIC.game.sim.orders.map((o) => o.id).join());
  assert(oa && oa === ob, `orders synced ${oa} / ${ob}`);
  await shot(B.page, 'e2e-mp-guest.png');
  // host ends the round -> both back in the lobby
  await A.page.evaluate(() => { PANIC.app.room.broadcast({ k: 'tolobby' }); PANIC.app.backToLobby(); });
  console.log('      mp step 13');
  await B.page.waitForSelector('.lobby', { timeout: 60000 });
  // host leaves -> guest returns to title
  await A.page.evaluate(() => PANIC.app.leave());
  console.log('      mp step 14');
  await B.page.waitForSelector('.title-screen', { timeout: 60000 });
  assert(!A.errors.length && !B.errors.length, [...A.errors, ...B.errors].join('\n'));
  await A.page.close(); await B.page.close();
});

await T('couch co-op: second keyboard cook and a gamepad cook, dash and throw', async () => {
  const { page, errors } = await openPage(browser, base);
  // a fake standard gamepad the test can press buttons on
  await page.evaluate(() => {
    const pad = { index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    window.__pad = pad;
    navigator.getGamepads = () => [pad, null, null, null];
  });
  await page.evaluate(() => { PANIC.app.save.name = 'Couch'; PANIC.app.solo(); });
  await page.waitForSelector('[data-add="kb2"]');
  await page.click('[data-add="kb2"]');
  await page.waitForFunction(() => PANIC.app.couch.length === 1);
  // the pad presses Y in the lobby to join
  await page.evaluate(() => { window.__pad.buttons[3].pressed = true; });
  await page.waitForFunction(() => PANIC.app.couch.length === 2, { timeout: 60000 });
  await page.evaluate(() => { window.__pad.buttons[3].pressed = false; });
  assert(await page.evaluate(() => document.querySelectorAll('.pcard.couchc').length === 2), 'two couch cards');
  // CI renders in software at a few frames a second: skip the countdown and run the clock at 4x
  await page.evaluate(() => { PANIC.app.startMatch('0-2'); const sim = PANIC.game.sim; while (sim.t < 0.05) sim.step(0.05); PANIC.app.devSpeed = 4; });
  await waitPlay(page);
  const ids = await page.evaluate(() => PANIC.game.locals.map((l) => l.id + ':' + l.ctrl));
  assert(ids.length === 3 && ids[0].endsWith('kb1|free|touch') && ids.some((x) => x.endsWith('kb2')) && ids.some((x) => x.endsWith('pad0')), 'three local cooks: ' + ids);
  const pos = () => page.evaluate(() => PANIC.game.sim.players.map((p) => [p.x, p.y]));
  const p0 = await pos();
  await page.bringToFront();
  await page.keyboard.down('KeyD'); await page.keyboard.down('ArrowLeft');
  await page.evaluate(() => { window.__pad.axes[1] = -1; });
  await page.waitForFunction((p0) => { const P = PANIC.game.sim.players; return Math.abs(P[0].x - p0[0][0]) > 0.4 && Math.abs(P[1].x - p0[1][0]) > 0.4 && Math.abs(P[2].y - p0[2][1]) > 0.2; }, { polling: 50, timeout: 90000 }, p0).catch(() => {});
  await page.keyboard.up('KeyD'); await page.keyboard.up('ArrowLeft');
  await page.evaluate(() => { window.__pad.axes[1] = 0; });
  const p1 = await pos();
  assert(p1[0][0] > p0[0][0] + 0.3, 'P1 moved right with D');
  assert(p1[1][0] < p0[1][0] - 0.3, 'P2 moved left with the arrow');
  assert(Math.abs(p1[2][1] - p0[2][1]) > 0.15, 'the gamepad cook moved with the stick');
  // dash on each controller
  await page.keyboard.press('ShiftLeft'); await page.keyboard.press('Period');
  await page.evaluate(() => { window.__pad.buttons[5].pressed = true; });
  await page.waitForFunction(() => PANIC.game.sim.players.every((p) => p.dn >= 1), { polling: 50, timeout: 60000 }).catch(() => {});
  await page.evaluate(() => { window.__pad.buttons[5].pressed = false; });
  assert(await page.evaluate(() => PANIC.game.sim.players.every((p) => p.dn >= 1)), 'all three dashed');
  // throw: P1 holds food and presses Q
  await page.evaluate(() => { const g = PANIC.game, p = g.sim.players[0]; p.held = { kind: 'ing', ing: g.L.recipes[0].ings[0], s: 'raw', p: 0 }; });
  await page.keyboard.press('KeyQ');
  await page.waitForFunction(() => PANIC.game.sim.players[0].stats.throws === 1, { polling: 50, timeout: 60000 });
  await page.waitForFunction(() => !PANIC.game.sim.flying.length, { polling: 50, timeout: 90000 });
  assert(!(await page.evaluate(() => PANIC.game.sim.players[0].held)), 'the food left P1');
  await shot(page, 'e2e-couch.png');
  await page.evaluate(() => { PANIC.app.devSpeed = 1; });
  assert(!errors.length, errors.join('\n'));
  await page.close();
});

await T('touch: on-screen stick moves the cook, Throw and Jump buttons work', async () => {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.emulate({ viewport: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }, userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' });
  await page.goto(base);
  await page.waitForFunction(() => window.PANIC && PANIC.app && PANIC.app.ready);
  await page.touchscreen.tap(400, 40);
  assert(await page.evaluate(() => document.body.classList.contains('touch')), 'touch mode after the first tap');
  await page.evaluate(() => { PANIC.app.solo(); PANIC.app.startMatch('0-0'); const sim = PANIC.game.sim; while (sim.t < 0.05) sim.step(0.05); PANIC.app.devSpeed = 4; });
  await waitPlay(page);
  assert(await page.evaluate(() => getComputedStyle(document.querySelector('.tb-act')).display !== 'none'), 'touch buttons shown');
  assert(await page.evaluate(() => getComputedStyle(document.querySelector('.hud .keys')).display === 'none'), 'keyboard legend hidden');
  const p0 = await page.evaluate(() => [PANIC.game.me.x, PANIC.game.me.y]);
  // thumb down on the left half, slide right
  await page.touchscreen.touchStart(150, 260);
  await page.touchscreen.touchMove(200, 260);
  await page.touchscreen.touchMove(240, 260);
  await page.waitForFunction((x0) => PANIC.game.me.x > x0 + 0.4, { polling: 50, timeout: 90000 }, p0[0]).catch(() => {});
  await page.touchscreen.touchEnd();
  const p1 = await page.evaluate(() => [PANIC.game.me.x, PANIC.game.me.y]);
  assert(p1[0] > p0[0] + 0.3, `stick moved the cook right: ${p0} -> ${p1}`);
  assert(await page.evaluate(() => PANIC.app.input.touch.mx === 0), 'stick springs back');
  // throw with the button
  await page.evaluate(() => { const g = PANIC.game; g.me.held = { kind: 'ing', ing: g.L.recipes[0].ings[0], s: 'raw', p: 0 }; });
  const tb = await page.evaluate(() => { const r = document.querySelector('.tb-throw').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await page.touchscreen.tap(tb[0], tb[1]);
  await page.waitForFunction(() => PANIC.game.me.stats.throws === 1, { polling: 50, timeout: 60000 });
  // the Grab button names the action
  const word = await page.evaluate(() => document.querySelector('.tb-act span').textContent);
  assert(word.length > 1, 'Grab button label: ' + word);
  await shot(page, 'e2e-touch.png');
  await page.evaluate(() => { PANIC.app.devSpeed = 1; });
  assert(!errors.length, errors.join('\n'));
  await page.close();
});

await T('layout: the kitchen never sits under the HUD at common screen sizes', async () => {
  const page = await browser.newPage();
  await page.goto(base);
  await page.waitForFunction(() => window.PANIC && PANIC.app && PANIC.app.ready);
  const bad = [];
  for (const [w, h] of [[1920, 1080], [1280, 720], [960, 540], [800, 450], [1024, 768], [2560, 1080]]) {
    await page.setViewport({ width: w, height: h });
    for (const lv of ['0-6', '5-10', '2-9', '7-4']) {
      const hits = await page.evaluate(async (lv) => {
        const app = PANIC.app; if (!app.members.size) app.solo(); if (PANIC.game) app.backToLobby();
        app.startMatch(lv); const g = PANIC.game, ui = app.ui;
        while (g.sim.t < 1) g.sim.step(0.05);
        const R = ui.ordersRect, oz = +document.querySelector('#orders').style.getPropertyValue('--oz');
        const n = Math.round((R.right - R.left) / ((ui.ticketBox.w + 10) * oz));
        g.sim.maxOrders = 99;
        while (g.sim.orders.length < n) g.sim.spawnOrder();
        ui.updateMatch(g, 1, 0.016);
        await new Promise((r) => setTimeout(r, 700));
        return g.hudOverlaps();
      }, lv);
      if (hits.length) bad.push(`${w}x${h} ${lv}: ${hits.join(',')}`);
    }
  }
  assert(!bad.length, bad.join('\n'));
  await page.close();
});

await T('full round ends with results and saves stars', async () => {
  const { page, errors } = await openPage(browser, base);
  await page.evaluate(() => { PANIC.app.solo(); PANIC.app.startMatch('0-0'); });
  await page.evaluate(() => { const g = PANIC.game; for (let i = 0; i < 80; i++) g.sim.step(0.05); g.sim.orders = []; g.sim.t = g.L.duration - 0.1; g.sim.score = g.sim.stars[1] + 1; });
  await page.waitForSelector('.results', { timeout: 90000 });
  const stars = await page.evaluate(() => PANIC.app.save.stars['0-0']);
  assert(stars === 2, 'saved 2 stars: ' + stars);
  await sleep(1500);
  await shot(page, 'e2e-results.png');
  await page.click('[data-a="next"]');
  await page.waitForFunction(() => PANIC.game && PANIC.game.L.id === '0-1', { polling: 100 });
  assert(!errors.length, errors.join('\n'));
  await page.close();
});

const failed = summary();
await browser.close();
srv.close();
process.exit(failed ? 1 : 0);
