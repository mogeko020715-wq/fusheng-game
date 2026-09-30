/* 第五批梦境 CG 实机验收：三龄段心结 + 梦底门 boss 各截一张 */
const { chromium } = require('/Users/maxine/Documents/Kimi/Workspaces/Investigate/OpenMAIC/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');
(async () => {
  const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
  const browser = await chromium.launch({ executablePath: exe });
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
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
    eventLock = false;
  });

  // [文件名, 年龄段, foeId 或 boss]
  const cases = [
    ['needle', 3, 'needle'], ['exam59', 9, 'exam59'],
    ['rank', 15, 'rank'], ['boss-firstnight', 3, 'BOSS'], ['boss-future-self', 15, 'BOSS'],
  ];
  const results = [];
  for (const [shot, age, foeId] of cases) {
    await page.evaluate(({ age, foeId }) => {
      S.age = age; S.slot = 5; S.alive = true; S.flags.dreamtToday = false;
      render();
      enterDream();
      if (foeId === 'BOSS') { dreamEncounter(DREAM_BOSSES[dreamBand()]); }
      else {
        const f = DREAM_FOES[dreamBand()].find((x) => x.id === foeId);
        dreamEncounter(f); // 直接传入：intro/CG/血条全部一致（isBoss 只影响结算，不影响画面）
      }
    }, { age, foeId });
    await page.waitForTimeout(500);
    const state = await page.evaluate(() => {
      const cg = document.getElementById('dream-cg');
      return { src: cg.getAttribute('src'), visible: !cg.classList.contains('hidden'), loaded: cg.naturalWidth > 0 };
    });
    results.push({ shot, ...state });
    await page.screenshot({ path: `_dev/shots/dream-cg-real-${shot}.png` });
  }
  console.log(JSON.stringify(results, null, 1));
  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
