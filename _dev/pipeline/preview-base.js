/* 立绘预览底图：隐藏简笔小人后的白天/夜晚场景 */
const { chromium } = require('/Users/maxine/Documents/Kimi/Workspaces/Investigate/OpenMAIC/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');
(async () => {
  const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
  const browser = await chromium.launch({ executablePath: exe });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
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
  await page.evaluate(() => {
    S.familyKey = 'middle'; S.slot = 1; render();
    document.getElementById('actor').style.display = 'none';
    document.getElementById('actor-fx').style.display = 'none';
  });
  await page.waitForTimeout(400);
  await page.locator('#scene-stage').screenshot({ path: 'preview-base-day.png' });
  await page.evaluate(() => { S.slot = 5; render(); });
  await page.waitForTimeout(400);
  await page.locator('#scene-stage').screenshot({ path: 'preview-base-night.png' });
  await browser.close();
})();
