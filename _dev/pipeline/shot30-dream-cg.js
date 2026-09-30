/* CG 第五批实测：12 张梦境 CG 在游戏内全部加载成功（naturalWidth>0）+ 遭遇/破门截图 */
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

  const bands = { s: ['needle', 'dog', 'thunder', 'dark'], m: ['exam59', 'bully', 'alone'], l: ['rank', 'farewell'] };
  const bosses = { s: 'firstnight', m: 'finalexam', l: 'future-self' };
  const out = { loaded: {}, missing: [] };

  for (const [band, ids] of Object.entries(bands)) {
    for (const id of ids) {
      const ok = await page.evaluate(async ([band, id]) => {
        eventLock = false;
        document.getElementById('modal-event').classList.add('hidden');
        S.age = band === 's' ? 4 : band === 'm' ? 9 : 15;
        S.flags.dreamtToday = false; S.slot = 5; S.alive = true;
        enterDream();
        if (!D) return 'NO-DREAM';
        const f = DREAM_FOES[band].find((x) => x.id === id);
        dreamEncounter(f);
        const img = document.getElementById('dream-cg');
        if (!img || !img.src.includes('cg-dream-' + id)) return 'SRC-WRONG';
        if (img.classList.contains('hidden')) return 'HIDDEN';
        if (img.complete && img.naturalWidth > 0) return true;
        return await new Promise((res) => {
          img.onload = () => res(img.naturalWidth > 0);
          img.onerror = () => res('LOAD-ERROR');
          setTimeout(() => res('TIMEOUT'), 3000);
        });
      }, [band, id]);
      out.loaded[id] = ok;
      if (ok !== true) out.missing.push(id + ':' + ok);
    }
    // boss
    const bid = bosses[band];
    const ok = await page.evaluate(async ([band, bid]) => {
      eventLock = false;
      document.getElementById('modal-event').classList.add('hidden');
      S.age = band === 's' ? 4 : band === 'm' ? 9 : 15;
      S.flags.dreamtToday = false; S.slot = 5; S.alive = true;
      enterDream();
      if (!D) return 'NO-DREAM';
      dreamDoor();
      const img = document.getElementById('dream-cg');
      if (!img || !img.src.includes('cg-dream-' + bid)) return 'SRC-WRONG';
      if (img.classList.contains('hidden')) return 'HIDDEN';
      if (!D.foe.isBoss) return 'NOT-BOSS';
      if (img.complete && img.naturalWidth > 0) return true;
      return await new Promise((res) => {
        img.onload = () => res(img.naturalWidth > 0);
        img.onerror = () => res('LOAD-ERROR');
        setTimeout(() => res('TIMEOUT'), 3000);
      });
    }, [band, bid]);
    out.loaded[bid + '(boss)'] = ok;
    if (ok !== true) out.missing.push(bid + ':' + ok);
  }
  console.log(JSON.stringify(out, null, 1));

  // 截图：9 岁遭遇「59 分的卷子」（带 CG 的战斗画面）
  await page.evaluate(() => {
    eventLock = false;
    document.getElementById('modal-event').classList.add('hidden');
    S.age = 9; S.flags.dreamtToday = false; S.slot = 5; S.alive = true; S.candy = 7;
    enterDream();
    const f = DREAM_FOES.m.find((x) => x.id === 'exam59');
    dreamEncounter(f);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '_dev/shots/shot30-dream-cg.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '_dev/shots/shot30-dream-cg-mobile.png' });
  // 截图 3：桌面 · 出过一招后 CG 收起，四按钮一屏可见
  await page.setViewportSize({ width: 1280, height: 800 });
  const turn2 = await page.evaluate(() => {
    if (D && D.foe) dreamTurn('atk');
    return {
      cgHidden: document.getElementById('dream-cg').classList.contains('hidden'),
      actsVisible: [...document.querySelectorAll('#dream-acts .dream-btn')].every((b) => {
        const r = b.getBoundingClientRect();
        return r.bottom <= window.innerHeight && r.top >= 0;
      }),
    };
  });
  console.log('turn2:', JSON.stringify(turn2));
  await page.waitForTimeout(300);
  await page.screenshot({ path: '_dev/shots/shot30-dream-turn2.png' });
  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
