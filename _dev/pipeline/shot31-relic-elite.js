/* P1/P2 实测截图：三选一界面 / 大心结（390 竖屏 + 1280 桌面） */
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
  await page.evaluate(() => document.getElementById('modal-map').classList.add('hidden'));
  const out = {};

  // ① 三选一界面（第 3 步）· 390 竖屏
  out.relicPick = await page.evaluate(() => {
    eventLock = false;
    document.getElementById('modal-event').classList.add('hidden');
    S.age = 5; S.flags.dreamtToday = false; S.slot = 5; S.alive = true; S.candy = 3;
    enterDream();
    if (!D) return 'NO-DREAM';
    D.pos = 2; dreamStep(); // pos 3 → 三选一
    const btns = [...document.querySelectorAll('#dream-acts .dream-btn')].map((b) => b.textContent);
    return { n: btns.length, skip: btns.some((t) => t.includes('都不拿')), relics: btns.slice(0, 3).map((t) => t.split('闪')[0].split('每')[0].split('化')[0]) };
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '_dev/shots/shot31-relic-pick-mobile.png' });

  // ② 拿下一件梦物后回到小径（梦物播报）
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#dream-acts .dream-btn')][0];
    b.click();
  });
  await page.waitForTimeout(300);
  out.afterPick = await page.evaluate(() => ({
    relics: D.relics.length,
    log0: document.getElementById('dream-log').children[0].textContent.slice(0, 30),
  }));
  await page.screenshot({ path: '_dev/shots/shot31-relic-taken-mobile.png' });

  // ③ 大心结（推门前一站）· 390 竖屏，带 CG
  out.elite = await page.evaluate(() => {
    D.pos = D.steps - 2;
    dreamStep(); // pos = steps-1 → 大心结
    return { elite: D.foe && D.foe.elite === true, name: D.foe && D.foe.name, hp: D.foe && D.foe.maxHp };
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '_dev/shots/shot31-elite-mobile.png' });

  // ④ 桌面 1280 复核三选一排版
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => {
    eventLock = false;
    S.flags.dreamtToday = false; S.slot = 5; S.alive = true;
    enterDream();
    D.pos = 2; dreamStep();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '_dev/shots/shot31-relic-pick-desktop.png' });

  console.log(JSON.stringify(out, null, 1));
  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
