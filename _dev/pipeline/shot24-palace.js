/* 第二阶段·二期实测：少年宫——导航/动词门控/汇演检定/点触/事件 cond */
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
  // 未学艺的 5 岁视角
  const r1 = await page.evaluate(() => {
    const out = {};
    S.age = 5; render();
    const navBtns = [...document.querySelectorAll('#locations .loc-btn')].map(b => b.textContent.trim());
    out.navOrder = navBtns.join('|');
    switchLocation('palace');
    return out;
  });
  await page.waitForTimeout(600);
  const r2 = await page.evaluate(() => {
    const out = {};
    out.switched = S.location === 'palace';
    out.title = document.getElementById('scene-title').textContent;
    out.descNoArt = document.getElementById('scene-desc').textContent;
    out.btnsNoArt = [...document.querySelectorAll('#actions button')].map(b => b.textContent.trim());
    out.svgLayers = document.getElementById('scene-stage').querySelectorAll('svg').length;
    // 围观兴趣班
    const wc = ACTIONS.find(a => a.id === 'watchclass');
    for (let i = 0; i < 10; i++) wc.run();
    // 看展览 → inspireArt 联动
    ACTIONS.find(a => a.id === 'exhibit').run();
    out.exhibitInspire = S.flags.inspireArt === S.day;
    // 学技艺后：上课/汇演
    S.flags.art = '绘画'; S.money = 20; gainSkill('绘画', 200); // 直冲 5 级
    render();
    out.btnsArt = [...document.querySelectorAll('#actions button')].map(b => b.textContent.trim());
    const lesson = ACTIONS.find(a => a.id === 'lesson');
    const before = S.skills.绘画.xp;
    lesson.run();
    out.lessonCost = S.money === 18;
    out.lessonXp = S.skills.绘画.xp - before; // 看展 buff → 5+2
    // 汇演两次：第二次被每年一次门控拦下
    S.attrs.魅力 = 90;
    const rec = ACTIONS.find(a => a.id === 'recital');
    const memBefore = S.memories.length;
    rec.run();
    out.recitalMem = S.memories.length === memBefore + 1;
    out.recitalGate = !rec.cond();
    S.age = 6; out.recitalNextYear = rec.cond();
    // 点触
    const taps = document.querySelectorAll('#scene-taps .scene-tap');
    if (taps[1]) taps[1].dispatchEvent(new Event('click'));
    out.tapLine = document.getElementById('scene-tap-line').textContent;
    // 事件 cond 抽查
    S.slot = 3; S.day = 10;
    const evOk = ['palace-first-day', 'palace-own-painting', 'palace-backstage', 'palace-eraser'].every(id => {
      const ev = EVENTS.find(e => e.id === id);
      return ev && ev.cond(S);
    });
    out.eventsCondOK = evOk;
    render();
    return out;
  });
  console.log(JSON.stringify({ ...r1, ...r2 }, null, 1));
  await page.screenshot({ path: '_dev/shots/shot24-palace.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '_dev/shots/shot24-palace-mobile.png' });
  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
