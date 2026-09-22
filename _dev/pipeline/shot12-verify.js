/* P1 复验：sleep 横躺帧 / eat / sit / sick 情绪帧 / 动作打断 */
const { chromium } = require('/Users/maxine/Documents/Kimi/Workspaces/Investigate/OpenMAIC/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');
(async () => {
  const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
  const browser = await chromium.launch({ executablePath: exe });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto('file:///Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('#btn-born');
  await page.waitForTimeout(600);
  for (let i = 0; i < 4; i++) {
    if (await page.locator('#modal-event.hidden').count()) break;
    const c = page.locator('#event-choices .choice-btn');
    if (await c.count()) { await c.first().click(); await page.waitForTimeout(200); }
    const k = page.locator('#event-continue');
    if (await k.isVisible().catch(() => false)) { await k.click(); await page.waitForTimeout(200); } else break;
  }
  await page.waitForFunction(() => document.getElementById('actor').classList.contains('spr-off'), null, { timeout: 5000 })
    .catch(() => errors.push('spr-off never applied'));
  await page.evaluate(() => { S.slot = 1; render(); });
  await page.waitForTimeout(400);
  // 1. 睡觉：躺定后的横躺帧
  await page.evaluate(() => actorAnim('sleep'));
  await page.waitForTimeout(1300);
  const sleepState = await page.evaluate(() => ({
    cur: document.getElementById('actor-sprite').dataset.cur,
    fSleep: document.getElementById('actor-sprite').classList.contains('f-sleep'),
  }));
  console.log('sleep state:', JSON.stringify(sleepState));
  await page.locator('#scene-stage').screenshot({ path: 'shot12-sleep-lying.png' });
  await page.waitForTimeout(1400); // 等起身恢复
  const woke = await page.evaluate(() => document.getElementById('actor-sprite').dataset.cur);
  console.log('after wake frame:', woke);
  // 2. 吃饭帧
  await page.evaluate(() => actorAnim('eat'));
  await page.waitForTimeout(500);
  console.log('eat frame:', await page.evaluate(() => document.getElementById('actor-sprite').dataset.cur));
  await page.locator('#scene-stage').screenshot({ path: 'shot12-eat.png' });
  await page.waitForTimeout(1400);
  // 3. 坐姿帧（学习）
  await page.evaluate(() => actorAnim('sit'));
  await page.waitForTimeout(500);
  console.log('sit frame:', await page.evaluate(() => document.getElementById('actor-sprite').dataset.cur));
  await page.locator('#scene-stage').screenshot({ path: 'shot12-sit.png' });
  await page.waitForTimeout(1400);
  // 4. 感冒 → sick 帧
  await page.evaluate(() => { S.buffs.push({ name: '感冒', days: 2 }); render(); });
  await page.waitForTimeout(300);
  console.log('sick frame:', await page.evaluate(() => document.getElementById('actor-sprite').dataset.cur));
  await page.locator('#scene-stage').screenshot({ path: 'shot12-sick.png' });
  await page.evaluate(() => { S.buffs = S.buffs.filter((b) => b.name !== '感冒'); render(); });
  // 5. 打断测试：睡觉中途触发走路，不应残留横躺帧
  await page.evaluate(() => actorAnim('sleep'));
  await page.waitForTimeout(600);
  await page.evaluate(() => actorAnim('walk'));
  await page.waitForTimeout(1000);
  const afterInterrupt = await page.evaluate(() => ({
    cur: document.getElementById('actor-sprite').dataset.cur,
    fSleep: document.getElementById('actor-sprite').classList.contains('f-sleep'),
  }));
  console.log('after interrupt:', JSON.stringify(afterInterrupt));

  // 移动端睡觉
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mp = await m.newPage();
  mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
  await mp.goto('file:///Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng/index.html');
  await mp.evaluate(() => localStorage.clear());
  await mp.reload();
  await mp.tap('#btn-born');
  await mp.waitForTimeout(600);
  for (let i = 0; i < 4; i++) {
    if (await mp.locator('#modal-event.hidden').count()) break;
    const c = mp.locator('#event-choices .choice-btn');
    if (await c.count()) { await c.first().tap(); await mp.waitForTimeout(200); }
    const k = mp.locator('#event-continue');
    if (await k.isVisible().catch(() => false)) { await k.tap(); await mp.waitForTimeout(200); } else break;
  }
  await mp.evaluate(() => { S.slot = 1; render(); actorAnim('sleep'); });
  await mp.waitForTimeout(1300);
  await mp.locator('#panel-center').screenshot({ path: 'shot12-mobile-sleep.png' });
  console.log('js errors:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
