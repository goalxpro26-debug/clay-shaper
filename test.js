// Headless test for Clay Shaper: Pottery Studio.
// Uses playwright-core + /opt/meta-chromium/chrome. Real mouse clicks/drags only.
const { chromium } = require('playwright-core');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, 'index.html');

let browser = null;
(async () => {
  browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hatch-webgl-allowed-domains-file=/home/hatch/workspace/tools/pw-shot/webgl-policy.txt', '--hatch-webgl-allowed-domains-sha256=dc8a0e5eec744f6590a4c1889139c00568ffedc3eced6d0a1a5127e35f9ccd16'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 800 } });
  const errors = [], logs = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  const S = () => page.evaluate(() => window.__clay.state());
  const clickBtn = async (label) => {
    // Headless Chromium here runs rAF at only ~0.3-4 fps, so BUTTONS (rebuilt
    // every frame) may lag a screen change by seconds: poll generously.
    let p = null;
    for (let i = 0; i < 60; i++) {
      p = await page.evaluate(l => window.__clay.button(l), label);
      if (p) break;
      await page.waitForTimeout(250);
    }
    if (!p) throw new Error('button not found: ' + label);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(300);
  };

  await page.goto(FILE);
  await page.waitForTimeout(800);
  let s = await S();
  console.log('1. load:', JSON.stringify(s), '| errors:', errors.length);
  if (s.screen !== 'menu') throw new Error('expected menu screen');

  // How to Play opens and closes
  await clickBtn('How to Play');
  s = await S(); console.log('2. howto screen:', s.screen);
  if (s.screen !== 'howto') throw new Error('howto did not open');
  await clickBtn('Got It!');
  s = await S(); if (s.screen !== 'menu') throw new Error('did not return to menu');

  // Start game via real click on Play
  await clickBtn('Play');
  await page.waitForTimeout(400);
  s = await S();
  console.log('3. after Play:', JSON.stringify(s));
  if (s.screen !== 'play' || s.level !== 1) throw new Error('game did not start at level 1');

  // REAL DRAG: grab clay at a mid control point and drag right (push out)
  const before = await S();
  const pt = await page.evaluate(() => window.__clay.pointScreen(5));
  const c = await page.evaluate(() => window.__clay.clayCenter());
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  await page.mouse.move(pt.x + 60, pt.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = await S();
  console.log('4. real drag: radii[5] before=' + before.radii[5] + ' after=' + after.radii[5] +
    ' accuracy ' + before.accuracy + '->' + after.accuracy);
  if (after.radii[5] <= before.radii[5]) throw new Error('real drag did not push clay outward');
  // drag left on same point to pinch back in
  const pt2 = await page.evaluate(() => window.__clay.pointScreen(5));
  await page.mouse.move(pt2.x, pt2.y); await page.mouse.down();
  await page.mouse.move(pt2.x - 40, pt2.y, { steps: 8 }); await page.mouse.up();
  const after2 = await S();
  if (after2.radii[5] >= after.radii[5]) throw new Error('pinch drag did not reduce radius');

  // Pause / resume via real clicks
  await clickBtn('❚❚'); s = await S(); console.log('5. pause:', s.screen);
  if (s.screen !== 'paused') throw new Error('pause failed');
  await clickBtn('▶'); s = await S();
  if (s.screen !== 'play') throw new Error('resume failed');
  // Mute toggle
  await clickBtn('♪'); await page.waitForTimeout(200);
  console.log('6. mute toggled (no error)');

  // FAIL path: ruin the clay with real drags, submit, lose a heart, retry
  // (top control point = index n-1). Loop on measured accuracy: under heavy
  // VM load some pointermove steps can be dropped, so a fixed drag count
  // is not deterministic.
  const topIdx = () => page.evaluate(() => window.__clay.state().n - 1);
  const ruinClay = async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const ti = await topIdx();
      for (let k = 0; k < 3; k++) {
        const p = await page.evaluate(i => window.__clay.pointScreen(i), ti);
        await page.mouse.move(p.x, p.y); await page.mouse.down();
        await page.mouse.move(p.x - 90, p.y, { steps: 8 }); await page.mouse.up();
        await page.waitForTimeout(120);
      }
      const s = await S();
      if (s.accuracy < s.pass) return;
    }
    throw new Error('could not ruin clay below pass mark');
  };
  await ruinClay();
  s = await S();
  console.log('7. ruined clay accuracy:', s.accuracy, 'pass mark:', s.pass);
  if (s.accuracy >= s.pass) throw new Error('ruined clay unexpectedly passes');
  await clickBtn('Fire It!');
  s = await S();
  console.log('8. after failed submit:', JSON.stringify(s));
  if (s.screen !== 'leveldone' || s.hearts !== 2) throw new Error('fail path wrong (expected leveldone, 2 hearts)');
  await clickBtn('Try Again');
  s = await S();
  if (s.screen !== 'play' || s.hearts !== 2) throw new Error('retry failed');

  // PASS path: snap to target, submit via real Fire click -> level 2
  await page.evaluate(() => window.__clay.setRadiiToTarget());
  s = await S();
  console.log('9. snapped accuracy:', s.accuracy);
  if (s.accuracy < 99) throw new Error('snapped-to-target accuracy too low: ' + s.accuracy);
  await clickBtn('Fire It!');
  s = await S();
  console.log('10. after pass:', JSON.stringify(s));
  if (s.screen !== 'leveldone' || s.coins <= 0) throw new Error('pass path wrong');
  await clickBtn('Next Customer');
  s = await S();
  console.log('11. level 2:', JSON.stringify(s));
  if (s.screen !== 'play' || s.level !== 2) throw new Error('level did not advance to 2');

  // Play through levels 2..20 with snap-to-target + Fire + Next (verifies progression + win)
  for (let lvl = 2; lvl <= 20; lvl++) {
    await page.evaluate(() => window.__clay.setRadiiToTarget());
    await clickBtn('Fire It!');
    await page.waitForTimeout(200);
    s = await S();
    if (s.screen !== 'leveldone' || !s.stars || s.stars.length < lvl) throw new Error('level ' + lvl + ' did not complete: ' + JSON.stringify(s));
    if (lvl < 20) { await clickBtn('Next Customer'); await page.waitForTimeout(200); }
    else { await clickBtn('See Results'); await page.waitForTimeout(300); }
  }
  s = await S();
  console.log('12. after level 20:', JSON.stringify(s));
  if (s.screen !== 'win') throw new Error('win screen not reached, screen=' + s.screen);
  console.log('13. win: coins=' + s.coins + ' score=' + s.score + ' stars=' + JSON.stringify(s.stars));

  // Play Again returns to level 1
  await clickBtn('Play Again');
  s = await S();
  if (s.screen !== 'play' || s.level !== 1 || s.hearts !== 3) throw new Error('play again failed');
  console.log('14. play again OK:', JSON.stringify(s));

  // GAME OVER path: fail 3 times on level 1
  for (let f = 0; f < 3; f++) {
    await page.evaluate(() => window.__clay.setRadiiToTarget());
    await ruinClay();
    await clickBtn('Fire It!');
    await page.waitForTimeout(250);
    s = await S();
    console.log('15. fail #' + (f + 1) + ': screen=' + s.screen + ' hearts=' + s.hearts);
    if (f < 2) { if (s.screen !== 'leveldone') throw new Error('expected leveldone after fail ' + (f + 1)); await clickBtn('Try Again'); }
  }
  if (s.screen !== 'gameover') throw new Error('game over screen not reached, screen=' + s.screen);
  console.log('16. game over confirmed');
  await clickBtn('Try Again'); // game-over Try Again = restart
  s = await S();
  if (s.screen !== 'play' || s.level !== 1 || s.hearts !== 3) throw new Error('game-over restart failed');

  // Screenshot of gameplay for visual check
  await page.screenshot({ path: path.resolve(__dirname, 'test-shots/gameplay.png') });
  console.log('CONSOLE ERRORS:', errors.length, errors);
  console.log('PAGE console errors:', logs.length, logs);
  if (errors.length || logs.length) throw new Error('console errors present');
  console.log('ALL TESTS PASSED');
  await browser.close();
})().catch(async (e) => {
  console.error('TEST FAILED:', e.message);
  if (browser) { try { await browser.close(); } catch (_) { /* already dead */ } }
  process.exit(1);
});
