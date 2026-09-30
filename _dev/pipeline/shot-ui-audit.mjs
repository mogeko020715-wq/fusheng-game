// 移动端 UI 现状盘点截图：主界面（顶/中/底三段）+ 另一个地点
import { chromium } from 'file:///Users/maxine/Documents/Kimi/Workspaces/Investigate/OpenMAIC/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright/index.mjs';

const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const URL = 'file:///Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng/index.html';
const OUT = '/Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng/_dev/shots';

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', e => console.error('PAGEERROR:', e.message));

await page.goto(URL);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('#btn-born', { timeout: 10000 });
await page.click('#btn-born');
await page.waitForTimeout(1000);
for (let i = 0; i < 15; i++) {
  const n = await page.evaluate(() => {
    let n = 0;
    document.querySelectorAll('.modal').forEach(m => {
      if (!m.classList.contains('hidden')) {
        const b = m.querySelector('button');
        if (b) b.click(); else m.classList.add('hidden');
        n++;
      }
    });
    return n;
  });
  if (n === 0) break;
  await page.waitForTimeout(300);
}
await page.evaluate(() => {
  try { milestoneQueue.length = 0; } catch (e) {}
  S.eventCooldown = 9999;
  S.slot = 2; // 上午
  render();
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
});
await page.waitForTimeout(500);

// 1. 首屏（顶部：顶栏+地点按钮+场景+互动按钮）
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/ui-1-home-top.png` });
console.log('ok ui-1-home-top');

// 2. 滚到底部（属性面板/底部面板）
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/ui-2-home-bottom.png` });
console.log('ok ui-2-home-bottom');

// 3. 切到公园
await page.evaluate(() => { switchLocation('park'); window.scrollTo(0, 0); });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/ui-3-park.png` });
console.log('ok ui-3-park');

// 4. 全页长截图（完整一页看到底有多长）
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: `${OUT}/ui-4-fullpage.png`, fullPage: true });
console.log('ok ui-4-fullpage');

await browser.close();
console.log('done');
