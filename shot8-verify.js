/* 场景质量验证：六种场景 × 关键时段，检查重叠与构图 */
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
  async function dismissEvent() {
    for (let i = 0; i < 4; i++) {
      if (await page.locator('#modal-event.hidden').count()) return;
      const c = page.locator('#event-choices .choice-btn');
      if (await c.count()) { await c.first().click(); await page.waitForTimeout(220); }
      const k = page.locator('#event-continue');
      if (await k.isVisible().catch(() => false)) { await k.click(); await page.waitForTimeout(220); }
      else break;
    }
  }
  await dismissEvent();

  const shot = async (name) => {
    await page.waitForTimeout(450);
    await page.locator('#panel-center').screenshot({ path: name });
  };

  // 家 · 上午
  await page.evaluate(() => { S.slot = 1; render(); });
  await shot('shot8-home-day.png');
  // 家 · 夜晚（窗灯）
  await page.evaluate(() => { S.slot = 5; render(); });
  await shot('shot8-home-night.png');
  // 公园 · 傍晚（路灯）
  await page.evaluate(() => { S.slot = 4; switchLocation('park'); });
  await page.waitForTimeout(900);
  await shot('shot8-park-dusk.png');
  // 学堂 · 上午（调到 6 岁解锁学堂）
  await page.evaluate(() => { S.age = 6; S.slot = 1; S.location = 'park'; render(); switchLocation('school'); });
  await page.waitForTimeout(900);
  await shot('shot8-school-day.png');
  // 广场
  await page.evaluate(() => switchLocation('square'));
  await page.waitForTimeout(900);
  await shot('shot8-square-day.png');
  // 菜市场
  await page.evaluate(() => switchLocation('market'));
  await page.waitForTimeout(900);
  await shot('shot8-market-day.png');
  // 医院 · 夜晚
  await page.evaluate(() => { S.slot = 5; switchLocation('hospital'); });
  await page.waitForTimeout(900);
  await shot('shot8-hospital-night.png');
  // 走位检查：回家吃饭，小人应走到门前
  await page.evaluate(() => { S.slot = 2; switchLocation('home'); });
  await page.waitForTimeout(900);
  await dismissEvent();
  const mealBtn = page.locator('#actions .act-btn', { hasText: '吃饭' });
  if (await mealBtn.count()) {
    await mealBtn.first().click();
    await page.waitForTimeout(500);
    await dismissEvent();
    await shot('shot8-home-meal-spot.png');
  }

  console.log('js errors:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
