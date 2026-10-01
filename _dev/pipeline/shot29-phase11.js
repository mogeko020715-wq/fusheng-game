/* 第十一期实测：技艺技能子菜单（多技艺+等级缩放）+ 星星糖罐兑换雏形 */
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
  await page.evaluate(() => document.getElementById('modal-map').classList.add('hidden'));
  const r = await page.evaluate(() => {
    const out = {};
    S.slot = 5;
    S.attrs = { 体质: 60, 智力: 50, 魅力: 40 }; S.needs.健康 = 100;
    S.skills = { 武术: { xp: 0, lvl: 5 }, 绘画: { xp: 0, lvl: 3 } };
    S.candy = 12; S.pocket = [];
    enterDream();
    // ① 非战斗三键：往前走 / 星星糖罐 / 回头
    let btns = [...document.querySelectorAll('#dream-acts .dream-btn')].map((b) => b.textContent);
    out.pathBtns = btns.some((t) => t.includes('往前走')) && btns.some((t) => t.includes('星星糖罐')) && btns.some((t) => t.includes('回头'));
    out.candyShown = document.getElementById('dream-candy').textContent.includes('12');
    // ② 打开糖罐：三种祝福 + 衣柜预告（禁用）+ 算了
    dreamCandyShop();
    btns = [...document.querySelectorAll('#dream-acts .dream-btn')].map((b) => b.textContent);
    out.shopBtns = ['一夜好梦', '云朵枕头', '梦的礼物', '小小衣柜', '算了'].every((k) => btns.some((t) => t.includes(k)));
    const wardrobe = [...document.querySelectorAll('#dream-acts .dream-btn')].find((b) => b.textContent.includes('小小衣柜'));
    out.wardrobeDisabled = wardrobe.disabled === true;
    // ③ 买「一夜好梦」：扣 5 糖、标记祝福、再买变禁用
    [...document.querySelectorAll('#dream-acts .dream-btn')].find((b) => b.textContent.includes('一夜好梦')).click();
    out.blessBought = D.bless.mood === true && dreamCandy() === 7;
    const again = [...document.querySelectorAll('#dream-acts .dream-btn')].find((b) => b.textContent.includes('一夜好梦'));
    out.blessOnce = again.disabled === true;
    // ④ 算了回到小径 → 前进到遭遇
    [...document.querySelectorAll('#dream-acts .dream-btn')].find((b) => b.textContent.includes('算了')).click();
    let g = 0;
    while (!D.foe && g++ < 20) dreamStep();
    if (!D.foe) dreamEncounter(); // 保底：步数上限长就直接遇敌
    out.encountered = !!D.foe;
    // ⑤ 战斗四键含「用点本事」，点开是多技艺子菜单
    btns = [...document.querySelectorAll('#dream-acts .dream-btn')].map((b) => b.textContent);
    out.battleBtns = ['迎上去', '用点本事', '摸口袋', '退避'].every((k) => btns.some((t) => t.includes(k)));
    dreamPickSkill();
    btns = [...document.querySelectorAll('#dream-acts .dream-btn')].map((b) => b.textContent);
    out.skillMenu = ['动动脑筋', '连环踢', '纸盾', '算了'].every((k) => btns.some((t) => t.includes(k)));
    // ⑥ 用连环踢：扣 6 心力、两段伤害、标记反哺（先把心结血量垫高，防止一脚化开）
    D.foe.hp = 9999; D.foe.maxHp = 9999;
    const hp0 = D.foe.hp, mp0 = D.mp;
    [...document.querySelectorAll('#dream-acts .dream-btn')].find((b) => b.textContent.includes('连环踢')).click();
    const per = Math.round(D.atk * (0.5 + 0.1 * 5));
    out.kickOk = (hp0 - D.foe.hp) === per * 2 && (mp0 - D.mp) === 6 && D.usedArts.武术 === true;
    // ⑦ 主动醒来：祝福兑现（心情+10）、武术反哺 +1xp
    const mood0 = S.needs.心情;
    dreamWake('voluntary');
    out.blessPaid = S.needs.心情 === Math.min(100, mood0 + 10);
    out.artXp = S.skills.武术.xp === 1;
    out.candyKept = S.candy >= 8; // 12 - 4（好梦）+ 路上可能捡到奇遇糖
    render();
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  // 截图 1：桌面 · 糖罐子菜单
  await page.evaluate(() => {
    eventLock = false;
    document.getElementById('modal-event').classList.add('hidden');
    S.flags.dreamtToday = false; S.slot = 5; S.alive = true; S.candy = 17;
    enterDream();
    dreamCandyShop();
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '_dev/shots/shot29-candy-shop.png' });
  // 截图 2：移动端 · 战斗中技艺子菜单
  await page.evaluate(() => {
    eventLock = false;
    document.getElementById('modal-event').classList.add('hidden');
    document.getElementById('modal-dream').classList.add('hidden');
    D = null;
    S.flags.dreamtToday = false; S.slot = 5; S.alive = true;
    enterDream();
    let g = 0;
    while (D && !D.foe && g++ < 20) dreamStep();
    if (D && !D.foe) dreamEncounter();
    dreamPickSkill();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '_dev/shots/shot29-skill-menu-mobile.png' });
  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
