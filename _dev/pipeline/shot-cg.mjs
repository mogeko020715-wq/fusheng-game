// CG 第一批 10 张 · 移动端弹窗实测截图
// 用法: node _dev/pipeline/shot-cg.mjs
import { chromium } from 'file:///Users/maxine/Documents/Kimi/Workspaces/Investigate/OpenMAIC/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright/index.mjs';

const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const URL = 'file:///Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng/index.html';
const OUT = '/Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng/_dev/shots';

const LIST = [
  ['milestone', 3,  'cg-m3'],
  ['event', 'piggyback',    'cg-piggyback'],
  ['event', 'firefly',      'cg-firefly'],
  ['event', 'grandpa-bike', 'cg-grandpa-bike'],
  ['event', 'album',        'cg-album'],
  ['milestone', 7,  'cg-m7'],
  ['milestone', 8,  'cg-m8'],
  ['milestone', 18, 'cg-m18'],
  ['event', 'gaokao-eve',   'cg-gaokao-eve'],
  ['event', 'grad-dinner',  'cg-grad-dinner'],
];

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', e => console.error('PAGEERROR:', e.message));

await page.goto(URL);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('#btn-born', { timeout: 10000 });
await page.click('#btn-born');
await page.waitForTimeout(800);

// 出生弹窗 dismiss 循环：把可见 modal 里的第一个按钮点掉，直到没有可见 modal
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

for (const [kind, key, name] of LIST) {
  await page.evaluate(([kind, key]) => {
    // 先关掉上一个弹窗
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    const ev = kind === 'milestone' ? MILESTONES[key] : EVENTS.find(e => e.id === key);
    if (!ev) throw new Error('event not found: ' + key);
    if (kind === 'milestone') S.age = key;
    else { S.age = ev.min; }
    openEvent(ev, kind === 'milestone');
  }, [kind, key]);
  await page.waitForTimeout(600); // 等 CG 图片加载
  await page.screenshot({ path: `${OUT}/cg-shot-${name}.png` });
  console.log('ok', name);
}

await browser.close();
console.log('done');
