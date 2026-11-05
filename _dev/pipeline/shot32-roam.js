/* 漫游模式实测：入口显隐 / 摇杆行走 / 镜头跟随 / 热点浮出（390 竖屏 + 1280 桌面） */
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

  // ① 到公园：入口按钮出现
  const out = await page.evaluate(() => {
    S.location = 'park';
    render();
    const btn = document.getElementById('btn-roam');
    return { btnVisible: !btn.classList.contains('hidden') };
  });
  await page.screenshot({ path: '_dev/shots/shot32-entry-mobile.png' });

  // ② 进入漫游
  await page.click('#btn-roam');
  await page.waitForTimeout(900); // 立绘加载 + 首帧
  out.entered = await page.evaluate(() => {
    const img = document.getElementById('roam-actor-img');
    return {
      visible: !document.getElementById('roam').classList.contains('hidden'),
      actorLoaded: !!(img && img.src && img.complete),
      frame: (typeof roam !== 'undefined' && roam && roam.frame) || '',
      x: Math.round(roam.x), cam: Math.round(roam.cam),
    };
  });
  await page.screenshot({ path: '_dev/shots/shot32-idle-mobile.png' });

  // ③ 摇杆拖拽：左半屏按下向右推 → 小人右移、镜头跟随、帧在走
  await page.mouse.move(100, 600);
  await page.mouse.down();
  await page.mouse.move(170, 600, { steps: 6 });
  const walkFrames = new Set();
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(120);
    walkFrames.add(await page.evaluate(() => roam.frame));
  }
  out.walk = await page.evaluate(() => ({ x: Math.round(roam.x), cam: Math.round(roam.cam), joy: roam.joyId !== null }));
  out.walkFrames = [...walkFrames];
  await page.screenshot({ path: '_dev/shots/shot32-walk-mobile.png' });
  await page.mouse.up();
  await page.waitForTimeout(300);
  out.stop = await page.evaluate(() => ({ frame: roam.frame, joy: roam.joyId === null }));

  // ③b 点右半屏 = 跳跃：空中帧 + 抛物线顶点离地
  await page.evaluate(() => roamJump());
  await page.waitForTimeout(300); // 跳到一半
  out.jump = await page.evaluate(() => ({
    mid: roam.jumpT > 0 && roam.jumpT < 650,
    frame: roam.frame,
    transform: document.getElementById('roam-actor').style.transform.includes('NaN') ? 'NaN!' : 'ok',
  }));
  await page.screenshot({ path: '_dev/shots/shot32-jump-mobile.png' });
  await page.waitForTimeout(500);
  out.jumpLand = await page.evaluate(() => roam.jumpT === -1 && roam.frame === 'stand');

  // ④ 走到滑梯热点 → 按钮浮出；走远 → 收起
  await page.evaluate(() => { roam.x = 1930; roam.y = 436; });
  await page.waitForTimeout(400);
  out.spotShow = await page.evaluate(() => {
    const b = document.getElementById('roam-spot-slide');
    return b && !b.classList.contains('hidden') && roam.spot && roam.spot.id === 'slide';
  });
  await page.waitForTimeout(400); // 镜头跟上
  await page.screenshot({ path: '_dev/shots/shot32-spot-mobile.png' });
  await page.evaluate(() => { roam.x = 1200; });
  await page.waitForTimeout(400);
  out.spotHide = await page.evaluate(() => document.getElementById('roam-spot-slide').classList.contains('hidden'));

  // ⑤ 点热点按钮 → 触发真实动作（日志镜像出现；动作可能推进时段弹出事件，属预期）
  await page.evaluate(() => { roam.x = 300; roam.y = 446; });
  await page.waitForTimeout(500);
  out.spotClick = await page.evaluate(() => {
    const b = document.getElementById('roam-spot-bench');
    if (!b || b.classList.contains('hidden')) return 'NO-BTN';
    b.click();
    return 'clicked';
  });
  await page.waitForTimeout(800);
  out.spotLog = await page.evaluate(() => {
    const rl = document.getElementById('roam-log');
    return { shown: rl.classList.contains('show'), txt: rl.textContent.slice(0, 24), slot: S.slot };
  });
  // 事件弹窗压漫游层是设计行为；测试里关掉它再继续
  out.modalOverlay = await page.evaluate(() => {
    const m = document.getElementById('modal-event');
    const was = !m.classList.contains('hidden');
    m.classList.add('hidden');
    document.getElementById('modal-map').classList.add('hidden');
    return was; // true = 漫游中触发事件并正确压在漫游层之上
  });

  // ⑥ 回去
  await page.click('#roam-back', { force: true });
  await page.waitForTimeout(300);
  out.exited = await page.evaluate(() => document.getElementById('roam').classList.contains('hidden') && roam === null);

  // ⑦ 桌面 1280 复核
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => { enterRoam(); roam.x = 1300; roam.y = 452; });
  await page.waitForTimeout(900);
  await page.screenshot({ path: '_dev/shots/shot32-desktop.png' });
  out.desktop = await page.evaluate(() => ({ x: Math.round(roam.x), cam: Math.round(roam.cam), spot: roam.spot && roam.spot.id }));

  console.log(JSON.stringify(out, null, 1));
  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
