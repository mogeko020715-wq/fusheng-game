/* 梦境按钮 2x2 等宽网格验收：战斗四键 / 行进三键 / 口袋菜单 / 星星糖罐 */
const { chromium } = require('/Users/maxine/Documents/Kimi/Workspaces/Investigate/OpenMAIC/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');
(async () => {
  const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
  const browser = await chromium.launch({ executablePath: exe });
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file:///Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('#btn-born');
  await page.waitForTimeout(600);
  for (let i = 0; i < 8; i++) {
    if (await page.locator('#modal-event.hidden').count()) break;
    const c = page.locator('#event-choices .choice-btn');
    if (await c.count()) { await c.first().click(); await page.waitForTimeout(150); }
    const k = page.locator('#event-continue');
    if (await k.isVisible().catch(() => false)) { await k.click(); await page.waitForTimeout(150); } else break;
  }
  await page.evaluate(() => {
    document.getElementById('modal-map').classList.add('hidden');
    milestoneQueue.length = 0;
    eventLock = false;
    S.age = 5; S.slot = 5; S.alive = true; S.flags.dreamtToday = false;
    S.pocket = [{ id: 'tanghulu', n: 1 }, { id: 'soda', n: 2 }, { id: 'marble', n: 1 }];
    S.candy = 9;
    enterDream();
  });
  // ① 行进三键（往前走/星星糖罐/回头）
  await page.waitForTimeout(300);
  await page.screenshot({ path: '_dev/shots/dream-btn-1-walk.png' });
  // ② 星星糖罐菜单（3 祝福 + 衣柜占位 + 算了）
  await page.evaluate(() => dreamCandyShop());
  await page.waitForTimeout(200);
  await page.screenshot({ path: '_dev/shots/dream-btn-2-shop.png' });
  // ③ 战斗四键
  await page.evaluate(() => dreamEncounter(DREAM_FOES[dreamBand()][1]));
  await page.waitForTimeout(400);
  await page.screenshot({ path: '_dev/shots/dream-btn-3-fight.png' });
  // ④ 口袋菜单（3 道具 + 算了）
  await page.evaluate(() => dreamPickItem());
  await page.waitForTimeout(200);
  await page.screenshot({ path: '_dev/shots/dream-btn-4-pocket.png' });
  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
