/* 第二阶段实测：河边场景——导航/三动词/场景美术/点触/事件可触发 */
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
  // 清掉可能的事件弹窗
  for (let i = 0; i < 6; i++) {
    if (await page.locator('#modal-event.hidden').count()) break;
    const c = page.locator('#event-choices .choice-btn');
    if (await c.count()) { await c.first().click(); await page.waitForTimeout(150); }
    const k = page.locator('#event-continue');
    if (await k.isVisible().catch(() => false)) { await k.click(); await page.waitForTimeout(150); } else break;
  }
  const r = await page.evaluate(() => {
    const out = {};
    // ① 导航栏有河边按钮且可切换
    const navBtns = [...document.querySelectorAll('#locations .loc-btn')].map(b => b.textContent.trim());
    out.navHasRiver = navBtns.some(t => t.includes('河边'));
    out.navOrder = navBtns.join('|');
    switchLocation('river');
    return out;
  });
  await page.waitForTimeout(600); // 换场动画 280ms 后才落 location
  const r2 = await page.evaluate(() => {
    const out = {};
    out.switched = S.location === 'river';
    out.title = document.getElementById('scene-title').textContent;
    out.desc = document.getElementById('scene-desc').textContent;
    // ② 三层 SVG 都渲染了
    const stage = document.getElementById('scene-stage');
    out.svgLayers = stage.querySelectorAll('svg').length;
    // ③ 三个动词按钮可见
    out.actionBtns = [...document.querySelectorAll('#actions button')].map(b => b.textContent.trim());
    // ④ 三动词各跑几次不报错，特殊分支抽查
    const boat = ACTIONS.find(a => a.id === 'boat');
    for (let i = 0; i < 30; i++) boat.run();
    out.boatMem = S.memories.some(m => m.text && m.text.includes('纸船'));
    S.age = 6;
    const skim = ACTIONS.find(a => a.id === 'skim');
    for (let i = 0; i < 40; i++) skim.run();
    out.skimBest = S.flags.skimBest;
    const tad = ACTIONS.find(a => a.id === 'tadpole');
    for (let i = 0; i < 40 && !S.flags.tadpole; i++) tad.run();
    out.tadpoleFlag = !!S.flags.tadpole;
    // ⑤ 点触热区
    const taps = document.querySelectorAll('#scene-taps .scene-tap');
    out.tapCount = taps.length;
    if (taps[0]) taps[0].dispatchEvent(new Event('click'));
    out.tapLine = document.getElementById('scene-tap-line').textContent;
    // ⑥ 事件条件抽查（真实 cond）
    S.day = 30; S.flags.tadpole = 5; S.slot = 2;
    const evOk = ['river-boat-race', 'river-laundry', 'river-splash', 'river-tadpole-grow'].every(id => {
      const ev = EVENTS.find(e => e.id === id);
      return ev && ev.cond(S);
    });
    S.slot = 4;
    const dusk = EVENTS.find(e => e.id === 'river-dusk');
    out.eventsCondOK = evOk && dusk.cond(S);
    return out;
  });
  console.log(JSON.stringify({ ...r, ...r2 }, null, 1));
  await page.screenshot({ path: '_dev/shots/shot23-river.png' });
  // 移动端视口再截一张
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '_dev/shots/shot23-river-mobile.png' });
  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
