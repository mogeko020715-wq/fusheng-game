/* 统计模拟：以“普通玩家”策略连玩 N 世，采集平衡数据 */
const fs = require('fs');

function el() {
  const e = {
    style: {}, textContent: '', className: '', title: '', disabled: false,
    children: [],
    classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild(c) { this.children.push(c); },
    set onclick(f) { this._c = f; }, get onclick() { return this._c; },
  };
  // innerHTML 赋值时清空 children（模拟真实 DOM）
  let html = '';
  Object.defineProperty(e, 'innerHTML', {
    get() { return html; },
    set(v) { html = v; if (v === '') e.children = []; },
  });
  return e;
}
const registry = {};
global.document = {
  getElementById: (id) => (registry[id] = registry[id] || el()),
  createElement: () => el(),
  querySelectorAll: () => [],
};
global.window = { addEventListener() {} };
global.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = v; } };

const src = fs.readFileSync('game.js', 'utf8');

const driver = `
;(function statsRun(){
  const N = 200;
  const stat = {
    death: 0, deathAges: [], exam: { '重点高中':0, '普通高中':0, '职业高中':0, '无':0 },
    happy: [], attrs: { '体质':[], '智力':[], '魅力':[] }, money: [],
    dreamOk: 0, dreamTotal: 0, tags: {}, events: {}, arcs: 0, skills5: 0,
    lifeDays: [], buffSeen: {},
  };
  const origOpen = openEvent;
  let curEv = null;
  openEvent = function(ev, m) { curEv = ev.id || 'milestone'; stat.events[curEv] = (stat.events[curEv]||0)+1; origOpen(ev, m); };
  const origEnd = endLife;
  endLife = function(cause) { stat.lastCause = cause; origEnd(cause); };

  function reasonablePlay() {
    let guard = 0;
    while (S && S.alive && guard++ < 20000) {
      if (eventLock) {
        const kids = document.getElementById('event-choices').children;
        if (kids.length && kids[0]._c) kids[0]._c();
        const cont = document.getElementById('event-continue');
        if (cont._c) cont._c();
        continue;
      }
      if (S.age >= 18) break;
      const home = ACTIONS.filter(a => a.loc === 'home' && (!a.cond || a.cond()));
      const find = (id) => home.find(a => a.id === id);
      let chosen = null;
      const eat = find('meal'), wash = find('wash'), sleepA = find('sleep');
      // 生存优先
      if (eat && S.needs.饱食 < 70) chosen = eat;
      else if (S.needs.健康 < 45 && S.money >= 10) { S.location = 'hospital'; chosen = ACTIONS.find(a => a.id === 'cure'); }
      else if (wash && S.needs.清洁 < 30) chosen = wash;
      else if ((S.slot === 5 || S.needs.精力 < 30) && sleepA) chosen = sleepA;
      // 学龄期去上学
      else if (S.age >= 4 && S.slot <= 3 && !S.flags.wentSchool && Math.random() < 0.8) {
        S.location = 'school';
        chosen = ACTIONS.find(a => a.id === 'class');
      }
      // 发展：娱乐不足就玩， otherwise 学习/锻炼
      else if (S.needs.娱乐 < 45) {
        const fun = [
          ACTIONS.find(a => a.id === 'play'),
          ACTIONS.find(a => a.id === 'slide'),
          ACTIONS.find(a => a.id === 'fish'),
          ACTIONS.find(a => a.id === 'artist'),
          ACTIONS.find(a => a.id === 'toy' && S.money >= 12),
        ].filter(Boolean);
        chosen = pick(fun);
      }
      else if (Math.random() < 0.55) chosen = find('study');
      else if (Math.random() < 0.5) chosen = find('exercise');
      else {
        const locs = ['home','park','square','market'].filter(l => S.age >= (SCENES[l]?SCENES[l].min:3));
        S.location = pick(locs);
        const acts = ACTIONS.filter(a => a.loc === S.location && (!a.cond || a.cond()) && !['meal','sleep'].includes(a.id));
        chosen = acts.length ? pick(acts) : find('chat');
      }
      if (!chosen) { S.location = 'home'; chosen = find('chat') || find('wash'); }
      doAction(chosen.run);
    }
  }

  for (let i = 0; i < N; i++) {
    startLife();
    reasonablePlay();
    // 统计
    stat.lifeDays.push(S.day);
    const diedYoung = stat.lastCause === 'early';
    if (diedYoung) { stat.death++; stat.deathAges.push(S.age); }
    stat.exam[S.exam || '无']++;
    stat.happy.push(Math.round(S.happinessSum / S.happinessCnt));
    ['体质','智力','魅力'].forEach(k => stat.attrs[k].push(Math.round(S.attrs[k])));
    stat.money.push(S.money);
    if (S.flags.dream) { stat.dreamTotal++; if (dreamFulfilled()) stat.dreamOk++; }
    if (S.flags.arcDone) stat.arcs++;
    computeTags(diedYoung ? 'early' : '成年').forEach(t => stat.tags[t] = (stat.tags[t]||0)+1);
    if (Object.values(S.skills).some(s => s.lvl >= 5)) stat.skills5++;
    (S.buffs||[]).forEach(b => stat.buffSeen[b.name] = (stat.buffSeen[b.name]||0)+1);
  }

  const avg = (a) => a.length ? Math.round(a.reduce((x,y)=>x+y,0)/a.length) : 0;
  const pc = (n) => Math.round(n / N * 100) + '%';
  console.log('=== 模拟 ' + N + ' 世（普通玩家策略）===');
  console.log('提前落幕率:', pc(stat.death), stat.death ? ('死亡年龄: ' + stat.deathAges.slice(0,10).join(',')) : '');
  console.log('中考分布: 重点', pc(stat.exam['重点高中']), '普通', pc(stat.exam['普通高中']), '职高', pc(stat.exam['职业高中']), '未参加(提前落幕)', pc(stat.exam['无']));
  console.log('幸福均值: 平均', avg(stat.happy), '最高', Math.max(...stat.happy), '最低', Math.min(...stat.happy));
  ['体质','智力','魅力'].forEach(k => console.log(k + ' 终值: 平均', avg(stat.attrs[k]), '范围', Math.min(...stat.attrs[k]) + '-' + Math.max(...stat.attrs[k])));
  console.log('成年时零花钱: 平均', avg(stat.money), '最高', Math.max(...stat.money));
  console.log('心愿达成率:', stat.dreamTotal ? Math.round(stat.dreamOk/stat.dreamTotal*100)+'% (' + stat.dreamOk + '/' + stat.dreamTotal + ')' : '无心愿');
  console.log('家庭暗线完成:', pc(stat.arcs));
  console.log('有5级技艺:', pc(stat.skills5));
  console.log('标签分布:', JSON.stringify(stat.tags));
  console.log('事件触发次数 Top12:', Object.entries(stat.events).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,v])=>k+':'+v).join(' '));
})();
`;

eval(src + driver);
