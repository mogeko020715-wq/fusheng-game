// UI 盘点补充：关掉地图后的干净截图 + 按钮计数
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
  S.slot = 2;
  render();
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
});
await page.waitForTimeout(400);

// 指标：各区块按钮数与页面总高
const metrics = await page.evaluate(() => {
  const locs = [...document.querySelectorAll('#locations button, #locations .loc-btn, #locations *')].filter(el => el.tagName === 'BUTTON');
  const acts = [...document.querySelectorAll('#actions button')];
  return {
    locationBtns: locs.map(b => (b.textContent || '').trim()).filter(Boolean),
    actionBtns: acts.map(b => (b.textContent || '').trim()).filter(Boolean),
    pageHeight: document.body.scrollHeight,
    viewportH: window.innerHeight,
  };
});
console.log(JSON.stringify(metrics, null, 2));

// 干净首屏
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/ui-5-home-clean.png` });
console.log('ok ui-5-home-clean');

// 干净整页长截图
await page.screenshot({ path: `${OUT}/ui-6-fullpage-clean.png`, fullPage: true });
console.log('ok ui-6-fullpage-clean');

// 公园（点地点按钮而不是直接调函数，走真实路径）
await page.evaluate(() => {
  const b = [...document.querySelectorAll('#locations button')].find(x => /公园|⛲/.test(x.textContent)) ||
            document.querySelectorAll('#locations button')[1];
  if (b) b.click();
  window.scrollTo(0, 0);
});
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')));
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/ui-7-park-clean.png` });
console.log('ok ui-7-park-clean');

await browser.close();
console.log('done');
