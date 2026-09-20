/* 复验：100px 新尺寸 / 穿模修复 / 睡觉过渡 / age-l / 移动端 */
const { chromium } = require('/Users/maxine/Documents/Kimi/Workspaces/Investigate/OpenMAIC/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');
(async () => {
  const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
  const browser = await chromium.launch({ executablePath: exe });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
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
  await page.waitForFunction(() => document.getElementById('actor').classList.contains('spr-off'), null, { timeout: 5000 })
    .catch(() => errors.push('spr-off never applied'));
  // 1. 白天站立（新 100px 尺寸）
  await page.evaluate(() => { S.slot = 1; render(); });
  await page.waitForTimeout(400);
  await page.locator('#panel-center').screenshot({ path: 'shot11-stand-100px.png' });
  // 2. 穿模验证：走到屋子前面（吃饭站位 x=100 在房屋正中）
  await page.evaluate(() => actorGo('meal'));
  await page.waitForTimeout(700);
  await page.locator('#scene-stage').screenshot({ path: 'shot11-overlap-house.png' });
  // 3. 睡觉中间帧（蹲下→侧躺过渡中）
  await page.evaluate(() => { actorGo(null); actorAnim('sleep'); });
  await page.waitForTimeout(650);
  await page.locator('#scene-stage').screenshot({ path: 'shot11-sleep-mid.png' });
  await page.waitForTimeout(800);
  await page.locator('#scene-stage').screenshot({ path: 'shot11-sleep-lying.png' });
  await page.waitForTimeout(1200);
  // 4. 青年体型 age-l
  await page.evaluate(() => { S.age = 20; render(); });
  await page.waitForTimeout(400);
  await page.locator('#scene-stage').screenshot({ path: 'shot11-age-l.png' });

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
  await mp.screenshot({ path: 'shot11-mobile.png' });
  console.log('js errors:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
