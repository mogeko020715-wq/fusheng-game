/* 第三阶段实测：众生市地图——图标条/地图弹层/锁定态/星标/开局导览/跳转 */
const { chromium } = require('/Users/maxine/Documents/Kimi/Workspaces/Investigate/OpenMAIC/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');
(async () => {
  const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
  const browser = await chromium.launch({ executablePath: exe });
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file:///Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('#btn-born');
  await page.waitForTimeout(1400); // 开局导览 900ms 后弹地图
  const r1 = await page.evaluate(() => ({
    introMapShown: !document.getElementById('modal-map').classList.contains('hidden'),
    mapNodeCount: document.querySelectorAll('.map-node').length,
    mapTip: document.getElementById('map-tip').textContent,
  }));
  // 关掉事件弹窗（如有）再关地图
  for (let i = 0; i < 8; i++) {
    const ev = await page.locator('#modal-event.hidden').count();
    const mapOpen = await page.locator('#modal-map.hidden').count() === 0;
    if (mapOpen) { await page.click('#btn-map-close'); await page.waitForTimeout(200); }
    if (ev) break;
    const c = page.locator('#event-choices .choice-btn');
    if (await c.count()) { await c.first().click(); await page.waitForTimeout(150); }
    const k = page.locator('#event-continue');
    if (await k.isVisible().catch(() => false)) { await k.click(); await page.waitForTimeout(150); } else break;
  }
  const r2 = await page.evaluate(() => {
    const out = {};
    // 图标条：8 场景图标 + 1 地图按钮
    const btns = [...document.querySelectorAll('#locations .loc-btn')];
    out.stripCount = btns.length;
    out.stripHasMap = !!document.querySelector('#locations .map-open');
    out.stripIcons = btns.every(b => b.querySelector('svg'));
    // 3 岁：学堂（4 岁）应锁定；河边可点
    out.schoolLocked = !!document.querySelector('.map-node[data-loc="school"].locked');
    // 打开地图：点河边节点 → 跳转
    openMap();
    out.mapOpens = !document.getElementById('modal-map').classList.contains('hidden');
    document.querySelector('.map-node[data-loc="river"]').dispatchEvent(new Event('click'));
    out.mapClosedAfterPick = document.getElementById('modal-map').classList.contains('hidden');
    return out;
  });
  await page.waitForTimeout(700);
  const r3 = await page.evaluate(() => {
    const out = {};
    out.landedRiver = S.location === 'river';
    // 锁定点击：5 岁前点学堂 → 提示不解锁（地图开着时点）
    openMap();
    document.querySelector('.map-node[data-loc="school"]').dispatchEvent(new Event('click'));
    out.lockTip = document.getElementById('map-tip').textContent;
    out.stillRiver = S.location === 'river';
    closeMap();
    // 星标：制造一个「河边有未见过事件」的状态（3 岁有 river-laundry）
    out.freshHasRiver = freshScenes().has('river');
    out.mapDotShown = !!document.querySelector('#locations .map-dot');
    // 标记全部见过后星标消失
    EVENTS.forEach(e => { if (e.loc) S.flags['seen:' + e.id] = true; });
    render();
    out.freshCleared = freshScenes().size === 0 && !document.querySelector('#locations .map-dot');
    return out;
  });
  console.log(JSON.stringify({ ...r1, ...r2, ...r3 }, null, 1));
  // 截图：地图打开态（星标清掉后重开一张干净的 + 带星标的）
  await page.evaluate(() => {
    EVENTS.forEach(e => { if (e.loc) delete S.flags['seen:' + e.id]; });
    openMap();
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '_dev/shots/shot25-map.png' });
  await page.evaluate(() => closeMap());
  await page.screenshot({ path: '_dev/shots/shot25-map-strip.png' });
  // 移动端
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.evaluate(() => openMap());
  await page.waitForTimeout(300);
  await page.screenshot({ path: '_dev/shots/shot25-map-mobile.png' });
  await page.evaluate(() => closeMap());
  await page.waitForTimeout(200);
  await page.screenshot({ path: '_dev/shots/shot25-map-strip-mobile.png' });
  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
