// CG 第三批弹窗实测截图
import { chromium } from 'file:///Users/maxine/Documents/Kimi/Workspaces/Investigate/OpenMAIC/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright/index.mjs';

const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const URL = 'file:///Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng/index.html';
const OUT = '/Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng/_dev/shots';

const LIST = [
  ['event', 'rich-finale-a', 'cg-rich-finale'],
  ['event', 'crush-3a',      'cg-crush-date'],
  ['event', 'dream-form',    'cg-dream-form'],
];

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
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
});

for (const [kind, key, name] of LIST) {
  await page.evaluate(([kind, key]) => {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    const ev = kind === 'milestone' ? MILESTONES[key] : EVENTS.find(e => e.id === key);
    if (!ev) throw new Error('event not found: ' + key);
    if (kind === 'milestone') S.age = key; else S.age = ev.min;
    openEvent(ev, kind === 'milestone');
  }, [kind, key]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/cg-shot-${name}.png` });
  console.log('ok', name);
}

await browser.close();
console.log('done');
