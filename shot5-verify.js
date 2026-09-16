/* 效果验证：白天+幽灵条 / 傍晚夕阳窗灯 / 夜晚路灯月色 */
const path = require('path');
const { chromium } = require('/Users/maxine/Documents/Kimi/Workspaces/Investigate/OpenMAIC/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');

(async () => {
  const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('file://' + path.resolve(__dirname, 'index.html'));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('#btn-born');
  await page.waitForTimeout(600);

  // 随机事件弹窗兜底：选第一个选项并继续
  async function dismissEvent() {
    for (let i = 0; i < 4; i++) {
      if (await page.locator('#modal-event.hidden').count()) return;
      const choices = page.locator('#event-choices .choice-btn');
      if (await choices.count()) { await choices.first().click(); await page.waitForTimeout(250); }
      const cont = page.locator('#event-continue');
      if (await cont.isVisible().catch(() => false)) { await cont.click(); await page.waitForTimeout(250); }
      else break;
    }
  }
  await dismissEvent();

  // 1) 白天 + 悬停「玩耍」的幽灵条（清晨有饭点，悬停吃饭更直观）
  const btns = page.locator('#actions .act-btn');
  const n = await btns.count();
  let hovered = false;
  for (let i = 0; i < n; i++) {
    const t = await btns.nth(i).textContent();
    if (t.includes('吃饭')) { await btns.nth(i).hover(); hovered = true; break; }
  }
  if (!hovered) await btns.first().hover();
  await page.waitForTimeout(400);
  const ghostCount = await page.locator('.bar-ghost').count();
  await page.screenshot({ path: 'shot5-day-ghost.png' });

  // 2) 视差：鼠标移到场景右侧，看三层位移
  const stage = page.locator('#scene-stage');
  const box = await stage.boundingBox();
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.3);
  await page.waitForTimeout(400);
  const tf = await page.evaluate(() => ['.lyr-far', '.lyr-mid', '.lyr-near'].map((s) => {
    const el = document.querySelector(s); return s + '=' + (el ? el.style.transform : 'MISSING');
  }).join('  '));

  // 3) 傍晚（夕阳 + 窗灯）
  await page.mouse.move(640, 700);
  await page.evaluate(() => { S.slot = 4; render(); });
  await page.waitForTimeout(1100);
  await page.screenshot({ path: 'shot5-dusk.png' });

  // 4) 夜晚（月亮 + 星星 + 窗灯 + 远景压暗）——去公园看路灯
  await page.evaluate(() => { S.location = 'park'; S.slot = 5; render(); });
  await page.waitForTimeout(1100);
  await page.screenshot({ path: 'shot5-night-park.png' });

  // 5) 夜晚的家（窗灯）
  await page.evaluate(() => { S.location = 'home'; S.slot = 5; render(); });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'shot5-night-home.png' });

  console.log('ghost bars on hover:', ghostCount);
  console.log('parallax transforms:', tf);
  console.log('js errors:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
