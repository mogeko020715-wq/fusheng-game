/* 立绘模式验证：stand/jump/walk/夜晚反白/低落/移动端 */
const { chromium } = require('/Users/maxine/Documents/Kimi/Workspaces/Investigate/OpenMAIC/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');
(async () => {
  const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
  const browser = await chromium.launch({ executablePath: exe });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file:///Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('#btn-born');
  await page.waitForTimeout(600);
  for (let i = 0; i < 4; i++) {
    if (await page.locator('#modal-event.hidden').count()) break;
    const c = page.locator('#event-choices .choice-btn');
    if (await c.count()) { await c.first().click(); await page.waitForTimeout(200); }
    const k = page.locator('#event-continue');
    if (await k.isVisible().catch(() => false)) { await k.click(); await page.waitForTimeout(200); } else break;
  }
  // 等预载完成
  await page.waitForFunction(() => document.getElementById('actor').classList.contains('spr-off'), null, { timeout: 5000 })
    .catch(() => errors.push('spr-off never applied'));
  const st = await page.evaluate(() => ({
    ready: spriteSt.ready,
    sprOff: document.getElementById('actor').classList.contains('spr-off'),
    src: document.getElementById('actor-sprite').src,
    wrapShown: getComputedStyle(document.getElementById('actor-sprite-wrap')).display,
    imgH: document.getElementById('actor-sprite').getBoundingClientRect().height,
  }));
  console.log('sprite state:', JSON.stringify(st));
  // 1. 白天站立
  await page.evaluate(() => { S.slot = 1; render(); });
  await page.waitForTimeout(400);
  await page.locator('#panel-center').screenshot({ path: 'shot10-stand-day.png' });
  // 2. 跳跃中间帧
  await page.evaluate(() => actorAnim('jump'));
  await page.waitForTimeout(480);
  await page.locator('#scene-stage').screenshot({ path: 'shot10-jump-mid.png' });
  await page.waitForTimeout(700);
  // 3. 走路中间帧（走向玩耍站位）
  await page.evaluate(() => { actorAnim('walk'); actorGo('play'); });
  await page.waitForTimeout(400);
  await page.locator('#scene-stage').screenshot({ path: 'shot10-walk-mid.png' });
  await page.waitForTimeout(700);
  // 4. 低落/虚弱情绪 → weak.png
  await page.evaluate(() => { S.needs.精力 = 10; render(); });
  await page.waitForTimeout(300);
  const weakSrc = await page.evaluate(() => document.getElementById('actor-sprite').dataset.cur);
  console.log('weak mood frame:', weakSrc);
  await page.locator('#scene-stage').screenshot({ path: 'shot10-weak.png' });
  // 5. 开心情绪 → happy.png
  await page.evaluate(() => { S.needs.精力 = 90; S.needs.心情 = 95; render(); });
  await page.waitForTimeout(300);
  console.log('happy mood frame:', await page.evaluate(() => document.getElementById('actor-sprite').dataset.cur));
  // 6. 夜晚反白
  await page.evaluate(() => { S.needs.心情 = 60; S.slot = 5; render(); });
  await page.waitForTimeout(400);
  await page.locator('#scene-stage').screenshot({ path: 'shot10-night.png' });

  // 移动端
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mp = await m.newPage();
  mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
  await mp.goto('file:///Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng/index.html');
  await mp.evaluate(() => localStorage.clear());
  await mp.reload();
  await mp.tap('#btn-born');
  await mp.waitForTimeout(600);
  for (let i = 0; i < 4; i++) {
    if (await mp.locator('#modal-event.hidden').count()) break;
    const c = mp.locator('#event-choices .choice-btn');
    if (await c.count()) { await c.first().tap(); await mp.waitForTimeout(200); }
    const k = mp.locator('#event-continue');
    if (await k.isVisible().catch(() => false)) { await k.tap(); await mp.waitForTimeout(200); } else break;
  }
  await mp.evaluate(() => { S.slot = 1; render(); });
  await mp.waitForTimeout(500);
  await mp.screenshot({ path: 'shot10-mobile.png' });
  console.log('js errors:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
