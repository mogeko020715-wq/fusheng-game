/* 补充验证：贫寒之家构图 / 走路中间帧 / 移动端 */
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
  await page.waitForTimeout(500);
  for (let i = 0; i < 4; i++) {
    if (await page.locator('#modal-event.hidden').count()) break;
    const c = page.locator('#event-choices .choice-btn');
    if (await c.count()) { await c.first().click(); await page.waitForTimeout(200); }
    const k = page.locator('#event-continue');
    if (await k.isVisible().catch(() => false)) { await k.click(); await page.waitForTimeout(200); } else break;
  }
  // 贫寒之家 · 白天
  await page.evaluate(() => { S.familyKey = 'poor'; S.slot = 1; render(); });
  await page.waitForTimeout(400);
  await page.locator('#panel-center').screenshot({ path: 'shot9-home-poor.png' });
  // 富贵之家 · 傍晚（灯笼 + 窗灯）
  await page.evaluate(() => { S.familyKey = 'rich'; S.slot = 4; render(); });
  await page.waitForTimeout(400);
  await page.locator('#panel-center').screenshot({ path: 'shot9-home-rich-dusk.png' });
  // 走路中间帧：走到「玩耍」站位途中
  await page.evaluate(() => { S.familyKey = 'middle'; S.slot = 1; render(); actorAnim('walk'); actorGo('play'); });
  await page.waitForTimeout(420);
  await page.locator('#scene-stage').screenshot({ path: 'shot9-walk-mid.png' });
  await page.waitForTimeout(800);
  // 跳跃中间帧（squash & stretch）
  await page.evaluate(() => actorAnim('jump'));
  await page.waitForTimeout(430);
  await page.locator('#scene-stage').screenshot({ path: 'shot9-jump-mid.png' });

  // 移动端
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mp = await m.newPage();
  mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
  await mp.goto('file:///Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng/index.html');
  await mp.evaluate(() => localStorage.clear());
  await mp.reload();
  await mp.tap('#btn-born');
  await mp.waitForTimeout(500);
  for (let i = 0; i < 4; i++) {
    if (await mp.locator('#modal-event.hidden').count()) break;
    const c = mp.locator('#event-choices .choice-btn');
    if (await c.count()) { await c.first().tap(); await mp.waitForTimeout(200); }
    const k = mp.locator('#event-continue');
    if (await k.isVisible().catch(() => false)) { await k.tap(); await mp.waitForTimeout(200); } else break;
  }
  await mp.evaluate(() => { S.slot = 1; render(); });
  await mp.waitForTimeout(400);
  await mp.screenshot({ path: 'shot9-mobile-home.png' });
  console.log('js errors:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
