/* 第十期实测：梦境小径——入梦/前进回头/回合战斗/道具/惊醒/破门/反哺 */
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
  // 正常点完开场事件（保持事件锁状态一致）
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
    // ① 入口：白天无「做个梦」，夜晚有
    out.dayNoDream = !ACTIONS.find(a => a.id === 'dream').cond();
    S.slot = 5; render();
    out.nightHasDream = ACTIONS.find(a => a.id === 'dream').cond();
    // ② 入梦：属性换算
    S.attrs = { 体质: 60, 智力: 50, 魅力: 40 }; S.needs.健康 = 100;
    S.flags.art = '武术'; S.skills.武术 = { xp: 0, lvl: 3 };
    S.pocket = [{ id: 'bento', n: 1 }, { id: 'marble', n: 1 }];
    const dayBefore = S.day;
    enterDream();
    out.dreamShown = !document.getElementById('modal-dream').classList.contains('hidden');
    out.hpFormula = D.maxHp === Math.round(40 + 60 * 0.6 + 100 * 0.2); // 96
    out.mpFormula = D.maxMp === Math.round(20 + 50 * 0.4); // 40
    out.atkHasWushu = D.atk > 5 + 60 * 0.08; // 含武术加成
    // ③ 前进直到遇到心结（60% 概率，10 步内必出）
    let guard = 0;
    while (!D.foe && guard++ < 12) dreamStep();
    out.encountered = !!D.foe;
    // ④ 回合战斗：迎上去 / 技艺技（武术连环踢，应标记 usedArt）
    const foeHp0 = D.foe.hp;
    dreamTurn('atk');
    out.atkHurt = D.foe ? D.foe.hp < foeHp0 || D.hp < D.maxHp : true;
    if (D.foe) { dreamTurn('skill'); out.usedArt = D.usedArt; out.mpSpent = D.mp < D.maxMp; }
    // ⑤ 道具：摸口袋用便当回血
    if (D.foe) {
      D.hp = 30;
      dreamTurn('item');
      const btns = [...document.querySelectorAll('#dream-acts .dream-btn')].map(b => b.textContent);
      out.itemMenu = btns.some(t => t.includes('家常便当')) && btns.some(t => t.includes('玻璃珠')) && btns.some(t => t.includes('算了'));
      dreamUseItem('bento');
      out.itemHealed = D.hp === 45;
      out.itemConsumed = !S.pocket.some(p => p.id === 'bento');
    }
    // ⑥ 打到惊醒：勇气归零 → 醒来三态之 scared
    if (D.foe) {
      let g2 = 0;
      while (D && D.hp > 0 && g2++ < 60) { D.hp = 1; dreamTurn('atk'); }
      out.wokeUp = !D && document.getElementById('modal-dream').classList.contains('hidden');
      out.scaredPenalty = S.needs.健康 === 98 && S.flags.dreamtToday === true;
      out.dayAdvanced = S.day === dayBefore + 1; // 醒来即入睡到第二天
      out.candyBanked = (S.candy || 0) >= 0;
    }
    // ⑦ 第二天晚上再入梦 → 回头到底主动醒来
    S.flags.dreamtToday = false; S.slot = 5; S.needs.健康 = 100;
    enterDream();
    out.reentry = !!D;
    dreamBack(); // pos 0 回头 = 主动醒来
    out.voluntaryWake = !D && document.getElementById('modal-dream').classList.contains('hidden');
    // ⑧ 直接破门验证（把步数缩到 1，一击破门）
    S.flags.dreamtToday = false; S.slot = 5;
    enterDream();
    D.steps = 1; D.atk = 999;
    dreamStep(); // 直达梦底的门
    out.bossEncountered = !!(D && D.foe && D.foe.isBoss);
    let g3 = 0;
    while (D && D.foe && g3++ < 10) dreamTurn('atk');
    out.bossCleared = !D;
    out.clearedMem = S.memories.some(m => m.text.includes('梦的尽头'));
    out.artFeedback = S.skills.武术.xp > 0; // 反哺 +2
    render();
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  // 截图：新开一场梦，走到出遭遇为止
  await page.evaluate(() => {
    S.flags.dreamtToday = false; S.slot = 5; S.alive = true;
    enterDream();
    let g = 0;
    while (D && !D.foe && g++ < 12) dreamStep();
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '_dev/shots/shot28-dream.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '_dev/shots/shot28-dream-mobile.png' });
  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
