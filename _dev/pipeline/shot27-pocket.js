/* 第九期实测：口袋地基——小卖部购买/口袋渲染/使用道具/烹饪产出/小发现入兜/叠加上限/读档兼容 */
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
    await page.evaluate(() => {
      document.getElementById('modal-event').classList.add('hidden');
      document.getElementById('modal-map').classList.add('hidden');
    });
    if (await page.locator('#modal-event.hidden').count()) break;
  }
  const r = await page.evaluate(() => {
    const out = {};
    document.getElementById('modal-event').classList.add('hidden');
    // ① 口袋初始渲染 6 空槽
    out.emptySlots = document.querySelectorAll('#pocket .pocket-slot.empty').length;
    // ② 小卖部：去广场 → 打开 → 买糖葫芦
    S.money = 10; S.location = 'square'; render();
    const store = ACTIONS.find(a => a.id === 'store');
    out.storeHandled = store.run() === true; // 逛店不耗时
    out.shopShown = !document.getElementById('modal-shop').classList.contains('hidden');
    const slotBefore = S.slot;
    document.querySelector('#shop-items .shop-item').click(); // 买糖葫芦 ¥3
    out.boughtTanghulu = (S.pocket || []).some(p => p.id === 'tanghulu');
    out.moneyAfter = S.money;
    out.slotAdvanced = S.slot === slotBefore + 1; // 成交耗时
    out.shopClosed = document.getElementById('modal-shop').classList.contains('hidden');
    // ③ 口袋 UI 渲染出图标
    out.pocketRendered = document.querySelectorAll('#pocket .pocket-slot:not(.empty)').length;
    // ④ 使用道具：心情/饱食变化 + 数量减少
    S.needs.饱食 = 50;
    const before = S.needs.饱食;
    document.querySelector('#pocket .pocket-slot:not(.empty)').click();
    out.useWorked = S.needs.饱食 > before && !S.pocket.some(p => p.id === 'tanghulu');
    // ⑤ 烹饪产出道具（厨艺 3 级出妈妈的味道）
    S.flags.ingredients = 1; S.skills.烹饪 = { xp: 0, lvl: 3 };
    ACTIONS.find(a => a.id === 'cook').run();
    out.cookPacked = S.pocket.some(p => p.id === 'moms');
    // ⑥ 叠加与上限：塞满 6 格后 addItem 新物品返回 false
    addItem('marble'); addItem('soda'); addItem('soda'); addItem('soda'); // soda 叠 3
    addItem('noodle'); addItem('bento');
    out.stackOk = S.pocket.find(p => p.id === 'soda').n === 3;
    const full = S.pocket.length;
    out.capOk = addItem('tanghulu') === false && S.pocket.length === full;
    // ⑦ 发呆小发现入兜（跑 200 次必出 marble）
    S.pocket = [];
    const dd = ACTIONS.find(a => a.id === 'daydream');
    for (let i = 0; i < 200 && !S.pocket.some(p => p.id === 'marble'); i++) dd.run();
    out.idleMarble = S.pocket.some(p => p.id === 'marble');
    render();
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await page.screenshot({ path: '_dev/shots/shot27-pocket.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '_dev/shots/shot27-pocket-mobile.png' });
  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
