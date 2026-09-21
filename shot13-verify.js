/* UI 复验：竖屏角色卡 / 横屏两列 / 桌面无回归 */
const { chromium } = require('/Users/maxine/Documents/Kimi/Workspaces/Investigate/OpenMAIC/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');
(async () => {
  const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
  const browser = await chromium.launch({ executablePath: exe });
  const errors = [];
  async function born(page, tap) {
    await page.goto('file:///Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await (tap ? page.tap('#btn-born') : page.click('#btn-born'));
    await page.waitForTimeout(600);
    for (let i = 0; i < 4; i++) {
      if (await page.locator('#modal-event.hidden').count()) break;
      const c = page.locator('#event-choices .choice-btn');
      if (await c.count()) { await (tap ? c.first().tap() : c.first().click()); await page.waitForTimeout(200); }
      const k = page.locator('#event-continue');
      if (await k.isVisible().catch(() => false)) { await (tap ? k.tap() : k.click()); await page.waitForTimeout(200); } else break;
    }
    await page.evaluate(() => { S.slot = 1; render(); });
    await page.waitForTimeout(500);
  }
  // 1. 竖屏 390：角色卡（身心+资质拼卡）、无日志大框
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mp = await m.newPage();
  mp.on('pageerror', (e) => errors.push('portrait: ' + e.message));
  await born(mp, true);
  await mp.screenshot({ path: 'shot13-portrait-top.png' });
  await mp.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await mp.waitForTimeout(300);
  await mp.screenshot({ path: 'shot13-portrait-card.png' });
  const pState = await mp.evaluate(() => ({
    logHidden: getComputedStyle(document.querySelector('.log-box')).display === 'none',
    attrsShown: getComputedStyle(document.getElementById('attrs-body')).display !== 'none',
  }));
  console.log('portrait:', JSON.stringify(pState));
  // 2. 横屏 844×390：左场景右角色卡
  const l = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const lp = await l.newPage();
  lp.on('pageerror', (e) => errors.push('landscape: ' + e.message));
  await born(lp, true);
  await lp.screenshot({ path: 'shot13-landscape.png' });
  // 3. 桌面 1280：三栏不变、岁月框仍在
  const d = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const dp = await d.newPage();
  dp.on('pageerror', (e) => errors.push('desktop: ' + e.message));
  await born(dp, false);
  await dp.screenshot({ path: 'shot13-desktop.png' });
  const dState = await dp.evaluate(() => ({
    logShown: getComputedStyle(document.querySelector('.log-box')).display !== 'none',
    toggleShown: getComputedStyle(document.getElementById('attrs-toggle')).display === 'none',
  }));
  console.log('desktop:', JSON.stringify(dState));
  console.log('js errors:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
