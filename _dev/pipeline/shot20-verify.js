/* 图鉴三期 + 审核改写 实测：三栏渲染/跨世持久化/旧数据迁移/界面新文案 */
const { chromium } = require('/Users/maxine/Documents/Kimi/Workspaces/Investigate/OpenMAIC/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');
(async () => {
  const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
  const browser = await chromium.launch({ executablePath: exe });
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file:///Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const r = await page.evaluate(() => {
    const out = {};
    // 界面文案断言
    out.btnBorn = document.getElementById('btn-born').textContent.trim();
    out.btnMemorial = document.getElementById('btn-memorial').textContent.trim();
    // 旧存档迁移：伪造一条旧格式回忆（cause 用转写避开源码字面量）
    localStorage.setItem(MEMORIAL_KEY, JSON.stringify([
      { name: '旧人', gender: '男', family: '小康之家', age: 12, days: 300, verdict: '旧判词', cause: '夭', tags: ['天不假年', '快乐童年'], when: '2026/9/1' },
    ]));
    // 模拟一世：收集两个事件 + 技艺沉淀
    startLife();
    S.age = 6; S.location = 'park';
    codexCollectEvent('goldfish');
    codexCollectEvent('luckydraw');
    gainSkill('绘画', 999); gainSkill('钓鱼', 55);
    S.flags['spec_绘画'] = '漫画'; S.flags['master:钓鱼'] = true; S.flags['seen:combo-feast'] = true;
    endLife('成年');
    out.codexEvents = JSON.parse(localStorage.getItem('fusheng_codex_events'));
    out.codexSkills = JSON.parse(localStorage.getItem('fusheng_codex_skills'));
    // 打开回忆册渲染
    renderMemorials();
    const html = document.getElementById('memorial-list').innerHTML;
    out.hasEventCodex = html.includes('事件图鉴 · 已收集 2/');
    out.hasSkillCodex = html.includes('技艺图鉴') && html.includes('漫画') && html.includes('已出师');
    out.hasAchvCodex = html.includes('成就图鉴');
    out.hasCombo = html.includes('全鱼宴');
    out.migrated = html.includes('12 岁止步') && html.includes('未竟之年') && !html.includes('早夭');
    out.bandSplit = html.includes('童年 · 3-7 岁') && html.includes('青春 · 13-17 岁');
    return out;
  });
  console.log(JSON.stringify(r, null, 2));
  // 截图：回忆册弹窗
  await page.evaluate(() => { document.getElementById('screen-end').classList.add('hidden'); document.getElementById('modal-memorial').classList.remove('hidden'); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '_dev/shots/shot20-codex.png' });
  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
  const ok = r.hasEventCodex && r.hasSkillCodex && r.hasAchvCodex && r.hasCombo && r.migrated && r.bandSplit
    && r.btnBorn.includes('出 生') && r.btnMemorial.includes('回忆册') && !errors.length;
  console.log(ok ? 'CODEX VERIFY PASSED' : 'CODEX VERIFY FAILED');
})();
