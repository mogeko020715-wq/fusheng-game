/* 梦境遭遇 CG 机制验证：出现显示 / 胜利退避隐藏 / 缺图 onerror 容错 / 醒来复位 */
const { chromium } = require('/Users/maxine/Documents/Kimi/Workspaces/Investigate/OpenMAIC/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');
(async () => {
  const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
  const browser = await chromium.launch({ executablePath: exe });
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
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
  });

  const r = await page.evaluate(() => {
    const out = {};
    const cg = document.getElementById('dream-cg');
    S.slot = 5; S.alive = true; S.flags.dreamtToday = false;
    eventLock = false;
    enterDream();
    out.hasD = !!D;
    out.err = null;
    // ① 入梦初始：CG 隐藏且无 src
    out.initHidden = cg.classList.contains('hidden') && !cg.getAttribute('src');
    // ② 遭遇出现（借用已存在的 cg-m3 验证显示路径）
    dreamEncounter({ id: 't', cg: 'cg-m3', name: '测试心结', hp: 10, atk: 1, intro: '测试。', win: '散了。' });
    out.shownOnEncounter = !cg.classList.contains('hidden') && cg.getAttribute('src').endsWith('assets/cg/cg-m3.png');
    return out;
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '_dev/shots/dream-cg-1-encounter.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '_dev/shots/dream-cg-2-encounter-mobile.png' });

  const r2 = await page.evaluate(async () => {
    const out = { steps: [] };
    const cg = document.getElementById('dream-cg');
    const step = (name, fn) => {
      try { fn(); out.steps.push(name + ':ok D=' + !!D + ' foe=' + !!(D && D.foe)); }
      catch (e) { out.steps.push(name + ':ERR ' + e.message + ' D=' + !!D); throw e; }
    };
    try {
      // 注意：dreamEncounter 的参数语义是 boss，直接传 foe 会被标成 isBoss；测普通心结要手动改回 false
      D.foe.isBoss = false;
      step('win', () => { D.foe.hp = 1; D.hp = 99; dreamTurn('atk'); });
      out.hiddenAfterWin = cg.classList.contains('hidden') && !cg.getAttribute('src');
      step('encounter-missing', () => dreamEncounter({ id: 't2', cg: 'cg-dream-exam59', name: '59 分的卷子', hp: 10, atk: 1, intro: '卷子展开。', win: '折起来。' }));
      await new Promise((res) => setTimeout(res, 300));
      out.missingFileHandled = cg.classList.contains('hidden');
      out.logIntact = document.getElementById('dream-log').textContent.includes('卷子展开');
      step('encounter-again', () => dreamEncounter({ id: 't3', cg: 'cg-m3', name: '再来', hp: 50, atk: 1, intro: '又来。', win: '散。' }));
      out.shownAgain = !cg.classList.contains('hidden');
      step('flee', () => { let g = 0; while (D.foe && g++ < 10) { Math.random = () => 0.1; dreamTurn('flee'); } });
      out.hiddenAfterFlee = cg.classList.contains('hidden') && !cg.getAttribute('src');
      step('wake', () => dreamWake('voluntary'));
      out.wakeReset = cg.classList.contains('hidden') && !cg.getAttribute('src')
        && document.getElementById('modal-dream').classList.contains('hidden');
    } catch (e) { out.aborted = e.message; }
    return out;
  });
  console.log(JSON.stringify({ ...r, ...r2 }, null, 1));
  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
