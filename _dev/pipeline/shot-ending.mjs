// 结局页横幅实测：提前谢幕（空镜）+ 落幕·成年（复用 cg-m18）
import { chromium } from 'file:///Users/maxine/Documents/Kimi/Workspaces/Investigate/OpenMAIC/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright/index.mjs';

const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const URL = 'file:///Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng/index.html';
const OUT = '/Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng/_dev/shots';

const browser = await chromium.launch({ executablePath: EXE });

async function shotEnding(cause, file, age) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => console.error('PAGEERROR:', e.message));
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#btn-born', { timeout: 10000 });
  await page.click('#btn-born');
  await page.waitForTimeout(800);
  for (let i = 0; i < 12; i++) {
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
    await page.waitForTimeout(250);
  }
  await page.evaluate(([cause, age]) => {
    try { milestoneQueue.length = 0; } catch (e) {}
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    S.age = age;
    S.memories.push({ age: 3, text: '第一次逛公园，追了一下午泡泡。' });
    S.memories.push({ age: 7, text: '上小学第一天，暗下决心要当学霸。' });
    endLife(cause);
    window.scrollTo(0, 0);
  }, [cause, age]);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: false });
  console.log('ok', file);
  await page.close();
}

await shotEnding('early', 'ending-early.png', 9);
await shotEnding('成年', 'ending-adult.png', 18);

await browser.close();
console.log('done');
