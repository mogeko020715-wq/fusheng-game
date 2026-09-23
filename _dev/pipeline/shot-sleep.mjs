// 睡觉动画截图 v3：彻底封锁事件弹窗（清队列 + openEvent 暂时置空）
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

// 点掉出生流程所有弹窗
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

// 封锁：清空里程碑队列 + openEvent 置空 + 隐藏所有弹窗
await page.evaluate(() => {
  try { milestoneQueue.length = 0; } catch (e) { console.log('queue clear fail', e); }
  window.openEvent = () => {};
  S.eventCooldown = 9999;
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  S.slot = 5;
  render();
});
await page.waitForTimeout(500);
const left = await page.evaluate(() => document.querySelectorAll('.modal:not(.hidden)').length);
console.log('visible modals before sleep:', left);

await page.evaluate(() => { document.querySelector('#actor')?.scrollIntoView({ block: 'center' }); });
await page.waitForTimeout(300);

await page.evaluate(() => actorAnim('sleep'));
const T = [400, 600, 500, 600, 800]; // 累计 400/1000/1500/2100/2900ms
const NAMES = ['1-tilt', '2-fadeout', '3-lying-in', '4-lying-zzz', '5-settled'];
for (let i = 0; i < T.length; i++) {
  await page.waitForTimeout(T[i]);
  await page.screenshot({ path: `${OUT}/sleep-${NAMES[i]}.png` });
  console.log('ok sleep-' + NAMES[i]);
}

await browser.close();
console.log('done');
