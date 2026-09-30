// UI 改版验收截图：饭点/夜晚/清晨主按钮 + 公园 + 口袋位置 + 地图红点
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
  window.openMap = () => {};
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
});

async function shot(name, fn) {
  if (fn) await page.evaluate(fn);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('ok', name);
}

// 1. 中午饭点：主按钮应是「吃饭」
await shot('ui-new-1-meal', () => { S.slot = 2; render(); });

// 2. 夜晚且未做梦：主按钮应是「做个梦」，睡觉退居次位
await shot('ui-new-2-night-dream', () => { S.slot = 5; S.flags.dreamtToday = false; render(); });

// 3. 清晨：主按钮应是「洗漱」
await shot('ui-new-3-morning', () => { S.slot = 0; render(); });

// 4. 点 loc-next 切到公园：loc-line 名字应变，动作换成公园组
await page.evaluate(() => { eventLock = false; });
await shot('ui-new-4-park', () => { S.slot = 3; render(); document.querySelector('#loc-next').click(); window.scrollTo(0, 0); });
await page.waitForTimeout(400); // 等 swap-in 动画

// 5. 滚到身心+口袋（口袋应在身心下方、6 格空态）
await page.evaluate(() => { document.querySelector('#pocket')?.scrollIntoView({ block: 'center' }); });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/ui-new-5-pocket.png` });
console.log('ok ui-new-5-pocket');

// 6. 地图打开（真实 openMap）带红点 + loc-line 状态
await page.evaluate(async () => {
  // 恢复真 openMap 需要重载——直接用 DOM 检查替代：确认 loc-map 存在
  window.scrollTo(0, 0);
});
const checks = await page.evaluate(() => ({
  locLine: document.querySelector('#loc-cur')?.textContent,
  hasMapBtn: !!document.querySelector('#loc-map svg'),
  actionsCount: document.querySelectorAll('#actions .act-btn').length,
  primary: document.querySelector('#actions .act-primary')?.textContent.trim(),
  caption: document.querySelector('#actions .act-caption')?.textContent,
  pocketInNeeds: !!document.querySelector('.needs-box #pocket'),
  pocketSlots: document.querySelectorAll('#pocket .pocket-slot').length,
  oldNavGone: !document.querySelector('#locations'),
}));
console.log(JSON.stringify(checks, null, 2));

await browser.close();
console.log('done');
