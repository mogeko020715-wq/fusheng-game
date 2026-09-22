/* 事件审核修复验证：桩掉 DOM，跑 60 世，断言修复后的规则全部成立 */
const fs = require('fs');

function el() {
  return {
    style: {}, innerHTML: '', textContent: '', className: '', title: '', disabled: false,
    children: [],
    classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild(c) { this.children.push(c); },
    setAttribute() {}, removeAttribute() {},
    set innerHTML(v) { if (v === '') this.children = []; this._html = v; },
    get innerHTML() { return this._html || ''; },
    set onclick(fn) { this._onclick = fn; },
    get onclick() { return this._onclick; },
  };
}
const registry = {};
global.document = {
  getElementById: (id) => (registry[id] = registry[id] || el()),
  createElement: () => el(),
};
global.window = { addEventListener() {} };
global.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = v; } };

const src = fs.readFileSync('events.js', 'utf8') + '\n' + fs.readFileSync('game.js', 'utf8');

const driver = `
;(function audit(){
  const recs = []; // {id, age, wentSchool, hasCooking, moneyBefore}
  const origOpen = openEvent;
  openEvent = function(ev, isM) {
    if (ev && ev.id) recs.push({ id: ev.id, age: S.age, life: S.name + '|' + S.day0,
      wentSchool: S.flags.wentSchool, hasCooking: !!S.skills.烹饪, money: S.money });
    return origOpen(ev, isM);
  };
  // 加权随机验证：直接调 drawEvent 5 万次，统计 weight 是否生效
  startLife();
  S.age = 10; S.location = 'square';
  const cnt = {};
  for (let i = 0; i < 50000; i++) { const e = drawEvent(); if (e) cnt[e.id] = (cnt[e.id] || 0) + 1; }
  const wSum = {}; let tot = 0;
  EVENTS.filter(e => 10 >= e.min && 10 <= e.max && (!e.cond || e.cond(S))).forEach(e => { wSum[e.id] = effWeight(e); tot += effWeight(e); });
  let weightOK = true;
  Object.keys(wSum).forEach(id => {
    const expect = wSum[id] / tot, actual = (cnt[id] || 0) / 50000;
    if (Math.abs(expect - actual) > Math.max(0.02, expect * 0.35)) { weightOK = false; console.log('权重偏差:', id, '期望', expect.toFixed(3), '实际', actual.toFixed(3)); }
  });
  console.log('加权随机分布校验:', weightOK ? 'OK' : 'FAIL');

  // 跑 60 世收集事件记录
  for (let life = 0; life < 60; life++) {
    startLife();
    S.day0 = life;
    let guard = 0;
    while (S && S.alive && guard++ < 20000) {
      if (eventLock) {
        const kids = document.getElementById('event-choices').children;
        const k = kids.length ? kids[Math.floor(Math.random() * kids.length)] : null;
        if (k && k._onclick) k._onclick();
        const cont = document.getElementById('event-continue');
        if (cont._onclick) cont._onclick();
        if (S.skills && S.skills['艺术']) { console.log('FAIL: 出现幽灵技能 艺术 @life', life); process.exitCode = 1; }
        continue;
      }
      if (S.age >= 18) break;
      const homeActs = ACTIONS.filter(a => a.loc === 'home' && (!a.cond || a.cond()));
      const eat = homeActs.find(a => a.id === 'meal');
      const wash = homeActs.find(a => a.id === 'wash');
      const sleepA = homeActs.find(a => a.id === 'sleep');
      let chosen = null;
      if (eat && S.needs.饱食 < 75) chosen = eat;
      else if (wash && S.needs.清洁 < 35) chosen = wash;
      else if ((S.slot === 5 || S.needs.精力 < 25) && sleepA) chosen = sleepA;
      else {
        const acts = ACTIONS.filter(a => a.loc === S.location && (!a.cond || a.cond()));
        if (acts.length) chosen = pick(acts);
        else { S.location = pick(Object.keys(SCENES).filter(k => S.age >= SCENES[k].min)); continue; }
      }
      doAction(chosen.run);
    }
  }

  let fail = 0;
  const bad = (msg) => { console.log('FAIL:', msg); fail++; };
  // 按世分组
  const byLife = {};
  recs.forEach(r => { (byLife[r.life] = byLife[r.life] || []).push(r); });
  // 1. 金鱼：5 岁后才出现，每世最多 1 次
  recs.filter(r => r.id === 'goldfish').forEach(r => { if (r.age < 5) bad('金鱼在 ' + r.age + ' 岁触发'); });
  Object.values(byLife).forEach(rs => { const n = rs.filter(r => r.id === 'goldfish').length; if (n > 1) bad('金鱼一世死了 ' + n + ' 次'); });
  // 2. 疫苗：必须已上学
  recs.filter(r => r.id === 'needle').forEach(r => { if (!r.wentSchool) bad('未上学触发学校疫苗 @' + r.age + '岁'); });
  // 3. 第一道菜：触发时不能有烹饪技能
  recs.filter(r => r.id === 'cook-help').forEach(r => { if (r.hasCooking) bad('已有烹饪仍触发第一道菜 @' + r.age + '岁'); });
  // 4. maxLife 上限
  const caps = { bully: 2, needle: 2, 'poor-bottles': 2, 'mid-cram': 2, 'newyear-dinner': 1, olympiad: 1, 'rich-treat': 1, notes: 1, 'cook-help': 1, goldfish: 1 };
  Object.values(byLife).forEach(rs => {
    Object.keys(caps).forEach(id => {
      const n = rs.filter(r => r.id === id).length;
      if (n > caps[id]) bad(id + ' 一世触发 ' + n + ' 次（上限 ' + caps[id] + '）');
    });
  });
  // 5. 抽奖摊：触发时 money>=5
  recs.filter(r => r.id === 'luckydraw').forEach(r => { if (r.money < 5) bad('抽奖摊触发时余额 ' + r.money); });
  console.log('事件记录总数:', recs.length, '覆盖事件种类:', new Set(recs.map(r => r.id)).size);
  console.log(fail === 0 ? 'AUDIT TEST PASSED' : ('AUDIT TEST FAILED x' + fail));
})();
`;

eval(src + driver);
