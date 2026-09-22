/* 验证 3+5：三种家境房屋 + 小人走位 */
const { chromium } = require('/Users/maxine/Documents/Kimi/Workspaces/Investigate/OpenMAIC/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');
(async () => {
  const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
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
    if (await k.isVisible().catch(() => false)) { await k.click(); await page.waitForTimeout(200); }
  }

  // 三种家境的家
  for (const fk of ['poor', 'rich']) {
    await page.evaluate((k) => { S.familyKey = k; S.location = 'home'; render(); }, fk);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `shot6-home-${fk}.png`, clip: { x: 290, y: 60, width: 700, height: 380 } });
  }

  async function dismissEvent() {
    for (let i = 0; i < 4; i++) {
      if (await page.locator('#modal-event.hidden').count()) return;
      const c = page.locator('#event-choices .choice-btn');
      if (await c.count()) { await c.first().click(); await page.waitForTimeout(200); }
      const k = page.locator('#event-continue');
      if (await k.isVisible().catch(() => false)) { await k.click(); await page.waitForTimeout(200); }
      else break;
    }
  }

  // 小人走位：点「运动锻炼」（应走到 22%），再点「和家人聊天」（应走到 43%）
  async function clickAct(name) {
    const btns = page.locator('#actions .act-btn');
    const n = await btns.count();
    for (let i = 0; i < n; i++) {
      if ((await btns.nth(i).textContent()).includes(name)) { await btns.nth(i).click(); return true; }
    }
    return false;
  }
  await page.evaluate(() => { S.needs.精力 = 90; S.needs.饱食 = 90; render(); });
  await clickAct('运动锻炼');
  await page.waitForTimeout(300); // 走位进行中
  const leftDuring = await page.evaluate(() => document.getElementById('actor').style.left);
  await page.screenshot({ path: 'shot6-actor-move.png', clip: { x: 290, y: 60, width: 700, height: 380 } });
  await page.waitForTimeout(1200);
  await dismissEvent();
  await clickAct('和家人聊天');
  await page.waitForTimeout(900);
  await dismissEvent();
  const leftChat = await page.evaluate(() => document.getElementById('actor').style.left);
  await page.screenshot({ path: 'shot6-actor-chat.png', clip: { x: 290, y: 60, width: 700, height: 380 } });

  // 切地点 → 应回到 15%
  await page.evaluate(() => switchLocation('park'));
  await page.waitForTimeout(1200);
  const leftPark = await page.evaluate(() => document.getElementById('actor').style.left);

  console.log('走位: 运动时 left =', leftDuring, '| 聊天时 left =', leftChat, '| 切公园后 left =', leftPark || '(默认)');
  console.log('js errors:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
