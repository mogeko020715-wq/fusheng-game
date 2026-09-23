// 睡觉动画时间轴截图（深夜底色）+ CG 第二批弹窗实测
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
await page.waitForTimeout(800);
for (let i = 0; i < 12; i++) {
  const done = await page.evaluate(() => {
    const m = [...document.querySelectorAll('.modal')].find(el => !el.classList.contains('hidden'));
    if (!m) return true;
    const b = m.querySelector('button');
    if (b) b.click();
    return false;
  });
  if (done) break;
  await page.waitForTimeout(300);
}
await page.evaluate(() => { S.eventCooldown = 9999; });

/* ---- Part 1: 睡觉动画时间轴（深夜 slot 5 深蓝底）---- */
await page.evaluate(() => { S.slot = 5; render(); window.scrollTo(0, 0); });
await page.waitForTimeout(500);

// 把角色滚动到视野中央再开睡
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

/* ---- Part 2: CG 第二批弹窗实测 ---- */
await page.evaluate(() => { S.slot = 1; render(); window.scrollTo(0, 0); });
const CG2 = [
  ['event', 'stargaze',        'cg-stargaze'],
  ['event', 'poor-finale-a',   'cg-poor-finale'],
  ['event', 'mid-finale-a',    'cg-mid-finale'],
  ['event', 'bond-transfer-3a','cg-bond-capsule'],
  ['event', 'bond-chess-3a',   'cg-bond-chess'],
  ['milestone', 15,            'cg-m15'],
];
for (const [kind, key, name] of CG2) {
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
