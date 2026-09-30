// UI mock：场景即导航 + 动作三级分层（纯注入样式，不改源文件）
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
  window.openMap = () => {}; // mock 期间封锁地图教程
  S.slot = 2; // 中午·饭点 → 吃饭为"正当其时"
  render();
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
});
await page.waitForTimeout(400);

/* ---- mock 注入 ---- */
await page.evaluate(() => {
  // 1. 地点图标条 → 一行小字（点开地图），场景左右滑动提示
  const nav = document.querySelector('#locations');
  nav.style.display = 'none';
  const line = document.createElement('div');
  line.id = 'loc-line-mock';
  const cur = document.querySelector('#scene-title').textContent || '家';
  line.innerHTML = `‹ &nbsp;<u>${cur} · 筒子楼</u> ▦&nbsp; ›`;
  line.style.cssText = 'text-align:center;font-size:13px;letter-spacing:2px;color:#6b6455;margin:2px 0 6px;cursor:pointer;user-select:none;';
  nav.parentNode.insertBefore(line, nav);

  const stage = document.querySelector('#scene-stage');
  stage.style.position = 'relative';
  ['left', 'right'].forEach(side => {
    const hint = document.createElement('div');
    hint.textContent = side === 'left' ? '‹' : '›';
    hint.style.cssText = `position:absolute;top:50%;${side}:4px;transform:translateY(-50%);` +
      'font-size:22px;color:rgba(60,55,45,.45);z-index:5;pointer-events:none;text-shadow:0 0 6px #fbf9f3;';
    stage.appendChild(hint);
  });

  // 2. 动作三级分层
  const box = document.querySelector('#actions');
  const PRIMARY = '吃饭';                    // 时段驱动（mock 固定饭点）
  const SECOND = ['玩耍', '看书学习', '运动锻炼', '和家人聊天'];
  const btns = [...box.querySelectorAll('.act-btn')];
  const byName = {};
  btns.forEach(b => { byName[b.textContent.replace(/\d+$/, '').trim()] = b; });

  box.innerHTML = '';
  box.style.display = 'flex';
  box.style.flexDirection = 'column';
  box.style.gap = '10px';

  const style = document.createElement('style');
  style.textContent = `
    #actions .kbd { display:none !important; }
    #actions .act-primary {
      width:100%; padding:14px 10px; font-size:19px; letter-spacing:6px;
      background:#1c1c1c; color:#fbf9f3; border:1.5px solid #1c1c1c;
      border-radius:12px 4px 12px 4px; box-shadow:2.5px 2.5px 0 rgba(28,28,28,.25);
    }
    #actions .act-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    #actions .act-chips { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }
    #actions .act-chips .act-btn {
      flex:0 1 auto; padding:5px 13px; font-size:13px;
      border-width:1px; opacity:.82; border-radius:9px 3px 9px 3px;
    }
    #actions .act-caption {
      font-size:11px; letter-spacing:3px; color:#8a8272; text-align:center; margin-bottom:-4px;
    }`;
  document.head.appendChild(style);

  const cap1 = document.createElement('div');
  cap1.className = 'act-caption';
  cap1.textContent = '— 正当其时 · 饭点 —';
  box.appendChild(cap1);
  const p = byName[PRIMARY];
  if (p) { p.classList.add('act-primary'); box.appendChild(p); }

  const grid = document.createElement('div');
  grid.className = 'act-grid';
  SECOND.forEach(n => { if (byName[n]) grid.appendChild(byName[n]); });
  box.appendChild(grid);

  const chips = document.createElement('div');
  chips.className = 'act-chips';
  Object.keys(byName).forEach(n => {
    if (n !== PRIMARY && !SECOND.includes(n)) chips.appendChild(byName[n]);
  });
  box.appendChild(chips);
});
await page.waitForTimeout(300);

await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: `${OUT}/ui-8-mock-home.png` });
console.log('ok ui-8-mock-home');
await page.screenshot({ path: `${OUT}/ui-9-mock-fullpage.png`, fullPage: true });
console.log('ok ui-9-mock-fullpage');

await browser.close();
console.log('done');
