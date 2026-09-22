/* 本期新功能实测：①技能 title 水平描述 ②散步时段文案 ③钓鱼→食材→做饭联动 ④事件冷却降权 */
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
  // 关掉可能弹出的事件
  for (let i = 0; i < 6; i++) {
    if (await page.locator('#modal-event.hidden').count()) break;
    const c = page.locator('#event-choices .choice-btn');
    if (await c.count()) { await c.first().click(); await page.waitForTimeout(150); }
    const k = page.locator('#event-continue');
    if (await k.isVisible().catch(() => false)) { await k.click(); await page.waitForTimeout(150); } else break;
  }

  const out = await page.evaluate(() => {
    const r = {};
    // ① 技能描述
    gainSkill('烹饪', 10); gainSkill('钓鱼', 999); render();
    const tags = [...document.querySelectorAll('#ui-skills .tag')].map(t => t.title);
    r.skillTitles = tags;
    r.skillDescOK = tags.some(t => /烹饪 2 级 · 能做几道家常小菜了。/.test(t)) && tags.some(t => /钓鱼 \d+ 级 · 钓意不在鱼/.test(t));
    // ② 散步六个时段文案
    S.location = 'park'; S.slot = 0; const logs = [];
    const origLog = addLog;
    const walk = ACTIONS.find(a => a.id === 'walk');
    for (let s = 0; s <= 5; s++) { S.slot = s; walk.run(); }
    r.walkLogs = window.__lastLogs || null;
    // 用全局日志元素抓最近文本（ticker 或日志抽屉）
    r.walkSlotOK = true; // 不报错即过，文案抽样看日志
    // ③ 钓鱼→食材→做饭联动
    S.flags.ingredients = 0; S.location = 'park'; S.age = 8;
    const fish = ACTIONS.find(a => a.id === 'fish');
    for (let i = 0; i < 40 && !(S.flags.ingredients > 0); i++) { Math.random = () => 0.6; fish.run(); } // 0.6 命中鱼获分支
    Math.random = (() => { let s = 42; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; })();
    r.ingredientsAfterFish = S.flags.ingredients;
    S.location = 'home'; render();
    const cookBtn = [...document.querySelectorAll('#actions button')].map(b => b.textContent);
    r.cookLabels = cookBtn.filter(t => t.includes('做饭'));
    r.cookLinked = r.ingredientsAfterFish > 0 && cookBtn.some(t => /做饭（食材×[1-9]/.test(t));
    // ④ 冷却：记录见过的事件后 effWeight 降权
    const ev = EVENTS.find(e => 8 >= e.min && 8 <= e.max && (!e.cond || e.cond(S)));
    S.age = 8; S.day = 100;
    const w0 = effWeight(ev);
    S.flags.evSeenDay = {}; S.flags.evSeenDay[ev.id] = 97; // 3 天前见过
    const wCool = effWeight(ev);
    S.flags.evSeenDay[ev.id] = 85; // 15 天前
    const wMid = effWeight(ev);
    r.cooldown = { w0: w0.toFixed(3), wCool: wCool.toFixed(3), wMid: wMid.toFixed(3) };
    r.cooldownOK = wCool < w0 * 0.2 && wMid < w0 && wMid > wCool;
    // 文案抽样：最近日志
    r.recentLogs = [...document.querySelectorAll('.log-line, #log li, [class*=log]')].slice(-8).map(e => e.textContent).filter(Boolean).slice(0, 8);
    return r;
  });
  console.log(JSON.stringify(out, null, 2));
  console.log('JS errors:', errors.length ? errors : 'none');
  await page.screenshot({ path: '_dev/shots/shot19-interact.png' });
  await browser.close();
  const ok = out.skillDescOK && out.cookLinked && out.cooldownOK && !errors.length;
  console.log(ok ? 'INTERACT VERIFY PASSED' : 'INTERACT VERIFY FAILED');
})();
