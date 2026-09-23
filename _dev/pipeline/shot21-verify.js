/* dist 小工具包实测：无 BGM 模式起播零报错 / CG 显示 / events.js 加载 / 基础流程 */
const { chromium } = require('/Users/maxine/Documents/Kimi/Workspaces/Investigate/OpenMAIC/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');
(async () => {
  const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
  const browser = await chromium.launch({ executablePath: exe });
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file:///Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng/dist/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const r = { born: await page.locator('#btn-born').textContent() };
  await page.tap('#btn-born');
  await page.waitForTimeout(800);
  // 出生里程碑 m3 弹窗应带 CG
  const cg = await page.evaluate(() => {
    const img = document.getElementById('event-cg');
    return { visible: img && !img.classList.contains('hidden'), src: img && img.getAttribute('src'), loaded: img && img.complete && img.naturalWidth > 0 };
  });
  r.cg = cg;
  // 关掉里程碑弹窗
  for (let i = 0; i < 4; i++) {
    if (await page.locator('#modal-event.hidden').count()) break;
    const c = page.locator('#event-choices .choice-btn');
    if (await c.count()) { await c.first().tap(); await page.waitForTimeout(200); }
    const k = page.locator('#event-continue');
    if (await k.isVisible().catch(() => false)) { await k.tap(); await page.waitForTimeout(200); } else break;
  }
  r.state = await page.evaluate(() => ({
    noBgm: !!window.FUSHENG_NO_BGM,
    eventsLoaded: typeof EVENTS !== 'undefined' && EVENTS.length,
    milestones: typeof MILESTONES !== 'undefined',
    age: S.age, alive: S.alive,
    bgmHidden: !document.getElementById('set-bgm') || document.getElementById('set-bgm').offsetParent === null,
  }));
  // 做两个动作确认流程
  await page.evaluate(() => { const w = ACTIONS.find(a => a.id === 'wash'); if (w && (!w.cond || w.cond())) w.run(); });
  await page.waitForTimeout(300);
  r.errorsAfterActions = errors.length;
  console.log(JSON.stringify(r, null, 2));
  await page.screenshot({ path: '_dev/shots/shot21-dist.png' });
  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
  const ok = cg.visible && cg.loaded && r.state.eventsLoaded > 100 && r.state.alive && !errors.length;
  console.log(ok ? 'DIST VERIFY PASSED' : 'DIST VERIFY FAILED');
})();
