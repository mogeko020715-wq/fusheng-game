/* 十四期补：漫游 HUD 时间表 / 天色 slot 类 / 地图入口与跳点重建 */
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

  // ① 进入漫游：HUD 显示时间表，roam 根带 slot 类
  await page.evaluate(() => { S.location = 'park'; S.slot = 2; render(); });
  await page.click('#btn-roam');
  await page.waitForTimeout(800);
  out.hud = await page.evaluate(() => ({
    text: document.getElementById('roam-time').textContent,
    slotCls: document.getElementById('roam').className.match(/slot-\d/)[0],
    mapBtn: !!document.querySelector('#roam-map svg'),
  }));
  await page.screenshot({ path: '_dev/shots/shot34-hud-noon.png' });

  // ② 改时段到夜晚 → 天色变深、HUD 文字刷新
  await page.evaluate(() => { S.slot = 5; });
  await page.waitForTimeout(400);
  out.night = await page.evaluate(() => ({
    cls: document.getElementById('roam').className.match(/slot-\d/)[0],
    bg: getComputedStyle(document.getElementById('roam')).backgroundColor,
    hud: document.getElementById('roam-time').textContent,
  }));
  await page.screenshot({ path: '_dev/shots/shot34-hud-night.png' });

  // ③ 点地图按钮 → 地图弹窗开在漫游层之上；点河滨 → 漫游场景跟着重建
  await page.evaluate(() => { S.slot = 1; document.getElementById('modal-map').classList.add('hidden'); });
  await page.waitForTimeout(200);
  await page.click('#roam-map');
  await page.waitForTimeout(500);
  out.mapOpen = await page.evaluate(() => !document.getElementById('modal-map').classList.contains('hidden'));
  await page.screenshot({ path: '_dev/shots/shot34-map-over-roam.png' });
  await page.evaluate(() => {
    // 直接点地图上的河滨（跳过地图内部结构断言，用游戏自己的入口）
    document.getElementById('btn-map-close').click();
    switchLocation('river');
  });
  await page.waitForTimeout(700);
  out.mapJump = await page.evaluate(() => ({
    loc: S.location, built: roam.builtLoc,
    spotRebuilt: !!document.getElementById('roam-spot-shore'),
  }));

  // ④ 傍晚桌面复核
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => { S.slot = 4; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '_dev/shots/shot34-dusk-desktop.png' });

  console.log(JSON.stringify(out, null, 1));
  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
