/* 十四期实测：换场景漫游 / 边缘过街 / 热点动态可用性 */
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

  // ① 漫游入口在家也可见（十四期全场景）
  out.entryHome = await page.evaluate(() => {
    S.location = 'home'; render();
    return !document.getElementById('btn-roam').classList.contains('hidden');
  });

  // ② 进入家的漫游：场景装配成功、热点在床/桌/灶台/沙发
  await page.click('#btn-roam');
  await page.waitForTimeout(900);
  out.homeRoam = await page.evaluate(() => ({
    loc: S.location,
    spotCount: (ROAM_SCENES.home.spots || []).length,
    actorLoaded: !!document.getElementById('roam-actor-img').complete,
  }));
  await page.screenshot({ path: '_dev/shots/shot33-home-mobile.png' });

  // ③ 走到最右边缘 → 过街箭头浮出 → 点击 → 切到下一地点并落在左边缘
  await page.evaluate(() => { roam.x = 2330; roam.y = 446; });
  await page.waitForTimeout(400);
  out.edgeShow = await page.evaluate(() => {
    const n = document.getElementById('roam-next');
    const p = document.getElementById('roam-prev');
    return { next: !n.classList.contains('hidden'), prev: !p.classList.contains('hidden') };
  });
  const locBefore = await page.evaluate(() => S.location);
  await page.click('#roam-next');
  await page.waitForTimeout(900);
  out.edgeGo = await page.evaluate((before) => ({
    changed: S.location !== before, from: before, to: S.location,
    landX: Math.round(roam.x), loc: S.location,
  }), locBefore);
  await page.screenshot({ path: '_dev/shots/shot33-after-edge.png' });

  // ④ 热点动态可用性：菜市场没钱时「菜摊买菜」act 不满足 → 只亮圈不亮按钮
  await page.evaluate(() => {
    document.getElementById('modal-event').classList.add('hidden');
    document.getElementById('modal-map').classList.add('hidden');
    S.location = 'market'; S.money = 0; render();
  });
  // 先回主界面再进市场漫游
  await page.evaluate(() => { if (roam) exitRoam(); render(); });
  await page.waitForTimeout(300);
  await page.click('#btn-roam');
  await page.waitForTimeout(700);
  await page.evaluate(() => { roam.x = 500; roam.y = 446; });
  await page.waitForTimeout(400);
  out.spotGated = await page.evaluate(() => {
    const b = document.getElementById('roam-spot-veg');
    return { spot: roam.spot && roam.spot.id, btnHidden: !b || b.classList.contains('hidden') };
  });
  await page.screenshot({ path: '_dev/shots/shot33-market-mobile.png' });

  // ⑤ 河滨场景装配 + 截图
  await page.evaluate(() => { if (roam) exitRoam(); S.location = 'river'; render(); });
  await page.waitForTimeout(200);
  await page.click('#btn-roam');
  await page.waitForTimeout(900);
  out.riverRoam = await page.evaluate(() => ({ loc: S.location, x: Math.round(roam.x) }));
  await page.screenshot({ path: '_dev/shots/shot33-river-mobile.png' });

  // ⑥ 广场桌面复核
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => { if (roam) exitRoam(); S.location = 'square'; render(); enterRoam(); roam.x = 1000; roam.y = 446; });
  await page.waitForTimeout(900);
  out.squareDesktop = await page.evaluate(() => ({ loc: S.location, spot: roam.spot && roam.spot.id }));
  await page.screenshot({ path: '_dev/shots/shot33-square-desktop.png' });

  await page.evaluate(() => { if (roam) exitRoam(); });

  console.log(JSON.stringify(out, null, 1));
  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
