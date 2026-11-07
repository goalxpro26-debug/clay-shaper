// Focused headless test for the game-over path only (the full test.js covers
// everything else; this short run verifies the 3-fails -> game-over -> restart
// flow, which needs a fresh browser and is quick enough to survive VM load).
const { chromium } = require('playwright-core');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, 'index.html');
let browser = null;
(async () => {
  browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hatch-webgl-allowed-domains-file=/home/hatch/workspace/tools/pw-shot/webgl-policy.txt', '--hatch-webgl-allowed-domains-sha256=dc8a0e5eec744f6590a4c1889139c00568ffedc3eced6d0a1a5127e35f9ccd16'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const S = () => page.evaluate(() => window.__clay.state());
  const clickBtn = async (label) => {
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
  await clickBtn('Play');
  let s = await S();
  console.log('start:', JSON.stringify(s));
  if (s.screen !== 'play') throw new Error('did not start');
  const ruinClay = async () => {
    // Keep pinching the top of the pot until it scores below the pass mark.
    // (Under heavy VM load some pointermove steps can be dropped, so a fixed
    // drag count is not deterministic — loop on the measured accuracy.)
    for (let attempt = 0; attempt < 10; attempt++) {
      const ti = await page.evaluate(() => window.__clay.state().n - 1);
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
  for (let f = 0; f < 3; f++) {
    await page.evaluate(() => window.__clay.setRadiiToTarget());
    await ruinClay();
    s = await S();
    console.log('fail #' + (f + 1) + ' accuracy before submit:', s.accuracy);
    if (s.accuracy >= s.pass) throw new Error('ruined clay unexpectedly passes');
    await clickBtn('Fire It!');
    await page.waitForTimeout(250);
    s = await S();
    console.log('fail #' + (f + 1) + ': screen=' + s.screen + ' hearts=' + s.hearts);
    if (f < 2) {
      if (s.screen !== 'leveldone') throw new Error('expected leveldone after fail ' + (f + 1));
      await clickBtn('Try Again');
    }
  }
  if (s.screen !== 'gameover') throw new Error('game over screen not reached, screen=' + s.screen);
  console.log('GAME OVER confirmed, hearts=' + s.hearts);
  await page.screenshot({ path: path.resolve(__dirname, 'test-shots/gameover.png') });
  await clickBtn('Try Again');
  s = await S();
  console.log('after restart:', JSON.stringify(s));
  if (s.screen !== 'play' || s.level !== 1 || s.hearts !== 3) throw new Error('game-over restart failed');
  console.log('CONSOLE ERRORS:', errors.length, errors);
  if (errors.length) throw new Error('console errors present');
  console.log('GAME-OVER TEST PASSED');
  await browser.close();
})().catch(async (e) => {
  console.error('TEST FAILED:', e.message);
  if (browser) { try { await browser.close(); } catch (_) {} }
  process.exit(1);
});
