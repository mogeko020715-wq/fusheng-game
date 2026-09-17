/* 移动端验证：字幕条 / 岁月底栏 / 长按预览 / 滑动切地点 / 资质折叠 */
const { chromium, devices } = require('/Users/maxine/Documents/Kimi/Workspaces/Investigate/OpenMAIC/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');
(async () => {
  const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
  const browser = await chromium.launch({ executablePath: exe });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('file:///Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('#btn-born');
  await page.waitForTimeout(600);
  async function dismissEvent() {
    for (let i = 0; i < 4; i++) {
      if (await page.locator('#modal-event.hidden').count()) return;
      const c = page.locator('#event-choices .choice-btn');
      if (await c.count()) { await c.first().click(); await page.waitForTimeout(200); }
      const k = page.locator('#event-continue');
      if (await k.isVisible().catch(() => false)) { await k.click(); await page.waitForTimeout(200); }
      else break;
    }
  }
  await dismissEvent();
  await page.screenshot({ path: 'shot7-mobile-main.png' });

  // 做一个行动 → 字幕条应更新
  const btns = page.locator('#actions .act-btn');
  const n = await btns.count();
  for (let i = 0; i < n; i++) {
    if ((await btns.nth(i).textContent()).includes('玩耍')) { await btns.nth(i).tap(); break; }
  }
  await page.waitForTimeout(500);
  await dismissEvent();
  const tickerText = await page.locator('#log-ticker').textContent();
  await page.screenshot({ path: 'shot7-mobile-ticker.png' });

  // 点字幕条 → 岁月底栏
  await page.locator('#log-ticker').tap();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'shot7-mobile-sheet.png' });
  await page.tap('#sheet-log-close');
  await page.waitForTimeout(300);

  // 长按「运动锻炼」→ 幽灵条出现且不执行行动
  const logLenBefore = await page.evaluate(() => S.log.length);
  const target = page.locator('#actions .act-btn', { hasText: '运动锻炼' });
  await target.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: 200, clientY: 500 }] });
  await page.waitForTimeout(550);
  const ghostCount = await page.locator('.bar-ghost').count();
  await page.screenshot({ path: 'shot7-mobile-longpress.png' });
  await target.dispatchEvent('touchend', { changedTouches: [{ identifier: 1, clientX: 200, clientY: 500 }] });
  await page.waitForTimeout(700);
  const logLenAfter = await page.evaluate(() => S.log.length);

  // 场景左滑 → 切到下一个地点（公园）
  const locBefore = await page.evaluate(() => S.location);
  const stage = page.locator('#scene-stage');
  const sb = await stage.boundingBox();
  await page.touchscreen.tap(sb.x + sb.width / 2, sb.y + sb.height / 2); // 激活
  await stage.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: sb.x + sb.width - 30, clientY: sb.y + 60 }] });
  await page.waitForTimeout(80);
  await stage.dispatchEvent('touchend', { changedTouches: [{ identifier: 1, clientX: sb.x + 30, clientY: sb.y + 60 }] });
  await page.waitForTimeout(900);
  const locAfter = await page.evaluate(() => S.location);

  // 资质折叠展开
  await page.evaluate(() => { document.getElementById('panel-left').scrollIntoView(); });
  await page.waitForTimeout(200);
  await page.tap('#attrs-toggle');
  await page.waitForTimeout(300);
  const attrsVisible = await page.locator('#attrs-body').isVisible();

  console.log('字幕条:', JSON.stringify(tickerText));
  console.log('长按: 幽灵条', ghostCount, '条, 日志数', logLenBefore, '→', logLenAfter, logLenBefore === logLenAfter ? '(未误触发行动 ✓)' : '(误触发了!)');
  console.log('滑动切地点:', locBefore, '→', locAfter);
  console.log('资质展开:', attrsVisible);
  console.log('js errors:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
