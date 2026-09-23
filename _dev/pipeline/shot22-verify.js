/* 第一阶段实测：无所事事按钮 / 三联动 / 场景点触 */
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
  await page.waitForTimeout(500);
  for (let i = 0; i < 6; i++) {
    if (await page.locator('#modal-event.hidden').count()) break;
    const c = page.locator('#event-choices .choice-btn');
    if (await c.count()) { await c.first().click(); await page.waitForTimeout(150); }
    const k = page.locator('#event-continue');
    if (await k.isVisible().catch(() => false)) { await k.click(); await page.waitForTimeout(150); } else break;
  }
  const r = await page.evaluate(() => {
    const out = {};
    const lastLog = () => document.getElementById('log') ? [...document.querySelectorAll('body *')].map(e => e.textContent) : null;
    // ① 发呆：连点 20 次应出现小发现（12% 概率）
    let findSeen = null, idleSeen = null;
    const dd = ACTIONS.find(a => a.id === 'daydream');
    for (let i = 0; i < 20; i++) {
      dd.run();
      const l = S.logs ? S.logs[S.logs.length - 1] : null;
    }
    out.daydreamOK = true; // 不报错即过，文案看下面日志抽样
    // ② 联动：观花 → 练习技艺带灵感文案
    S.age = 8; S.flags.art = '绘画'; S.location = 'park';
    ACTIONS.find(a => a.id === 'watch').run();
    out.inspireFlag = S.flags.inspireArt === S.day;
    S.location = 'home';
    const origAdd = addLog; let captured = [];
    // 拦截 addLog 抓文案
    window.__cap = [];
    const art = ACTIONS.find(a => a.id === 'art');
    art.run();
    // ③ 看棋 → 读书
    S.location = 'square'; ACTIONS.find(a => a.id === 'chess').run();
    out.chessFlag = S.flags.chessThink === S.day;
    S.location = 'home'; ACTIONS.find(a => a.id === 'study').run();
    // ④ 小吃 → 食材（25%，连试 12 次）
    S.money = 100; S.location = 'square';
    const sn = ACTIONS.find(a => a.id === 'snack');
    const before = S.flags.ingredients || 0;
    for (let i = 0; i < 12 && !(S.flags.ingredients > before); i++) sn.run();
    out.snackIngredient = (S.flags.ingredients || 0) > before;
    // ⑤ 场景点触
    const taps = document.querySelectorAll('#scene-taps .scene-tap');
    out.tapZones = taps.length;
    if (taps[1]) taps[1].dispatchEvent(new Event('click'));
    const line = document.getElementById('scene-tap-line');
    out.tapLineShown = !line.classList.contains('hidden') && line.textContent.length > 4;
    out.tapLineText = line.textContent;
    out.tapHintLogged = !!S.flags.tapHint;
    // 日志抽样（S.log 是新条目在前）
    const all = S.log.map(l => l.text).join('\n');
    out.sampleInspired = all.includes('落进了绘画里') || all.includes('格外有感觉');
    out.sampleChess = all.includes('残局，你想了一路');
    out.idleSample = S.log.filter(l => l.cls === 'event').slice(0, 2).map(l => l.text);
    return out;
  });
  console.log(JSON.stringify(r, null, 2));
  await page.evaluate(() => { S.location = 'park'; render(); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '_dev/shots/shot22-phase1.png' });
  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
  const ok = r.inspireFlag && r.chessFlag && r.tapZones === 3 && r.tapLineShown && r.sampleInspired && r.sampleChess && !errors.length;
  console.log(ok ? 'PHASE1 VERIFY PASSED' : 'PHASE1 VERIFY FAILED');
})();
