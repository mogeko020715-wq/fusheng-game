/* 梦境小径战斗过堂：三年龄段 ×3 场完整梦境，自动策略打全程，记录数值手感与文案 */
const fs = require('fs');

function el() {
  return {
    style: {}, innerHTML: '', textContent: '', className: '', title: '', disabled: false,
    children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(c) { c._parent = this; this.children.push(c); },
    prepend(c) { c._parent = this; this.children.unshift(c); },
    get lastChild() { return this.children[this.children.length - 1]; },
    remove() {
      if (this._parent) {
        const i = this._parent.children.indexOf(this);
        if (i >= 0) this._parent.children.splice(i, 1);
      }
    },
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
globalThis.__play = function play() {
  const REPORT = { runs: [], texts: {} };
  const _dl = dreamLog;
  let transcript = null;
  dreamLog = (t) => { if (transcript) transcript.push(t); return _dl(t); };

  const BANDS = [
    { band: 's', age: 4, attrs: { 体质: 25, 智力: 25, 魅力: 30 }, 健康: 85, arts: {} },
    { band: 'm', age: 10, attrs: { 体质: 50, 智力: 55, 魅力: 50 }, 健康: 88, arts: { 乐器: 3 } },
    { band: 'l', age: 16, attrs: { 体质: 72, 智力: 68, 魅力: 60 }, 健康: 90, arts: { 武术: 4 } },
  ];

  startLife();
  for (const b of BANDS) {
    for (let run = 0; run < 3; run++) {
      // 清场：解开可能挂着的事件锁
      eventLock = false;
      document.getElementById('modal-event').classList.add('hidden');
      document.getElementById('modal-dream').classList.add('hidden');
      S.age = b.age;
      S.attrs = { ...b.attrs };
      S.needs.健康 = b.健康; S.needs.心情 = 70; S.needs.精力 = 70;
      S.skills = {};
      for (const [a, l] of Object.entries(b.arts)) S.skills[a] = { xp: 0, lvl: l };
      S.flags.art = Object.keys(b.arts)[0] || null;
      S.pocket = [{ id: 'bento', n: 1 }, { id: 'marble', n: 1 }];
      S.flags.dreamtToday = false; S.slot = 5; S.alive = true;
      S.candy = 0;

      enterDream();
      if (!D) { REPORT.runs.push({ band: b.band, run, error: 'NO-DREAM' }); continue; }
      transcript = [];
      const t0 = { hp: D.hp, maxHp: D.maxHp, mp: D.mp, maxMp: D.maxMp, atk: D.atk, def: D.def, dodge: D.dodge, steps: D.steps };
      const foes = [];
      let cur = null, actions = 0, guard = 0;

      while (D && guard++ < 200) {
        if (D.foe) {
          if (!cur || cur.ref !== D.foe) { cur = { ref: D.foe, name: D.foe.name, boss: !!D.foe.isBoss, turns: 0, hpLost: 0, hp0: D.hp }; foes.push(cur); }
          cur.turns++;
          const art = Object.keys(b.arts).find((a) => (S.skills[a] || {}).lvl >= 2);
          if (D.hp < D.maxHp * 0.35 && S.pocket.some((p) => p.id === 'bento')) dreamUseItem('bento');
          else if (art && D.mp >= 6) dreamTurn('skill', art);
          else if (!D.vuln && D.mp >= 4) dreamTurn('skill', null); // 动脑筋找破绽（零伤害）
          else dreamTurn('atk'); // 有破绽就迎上去打双倍
        } else {
          if (cur) { cur.hpLost = cur.hp0 - D.hp; cur = null; }
          // 梦物三选一：自动拿第一件（skip 按钮带「都不拿」字样时说明在三选一界面）
          const acts = document.getElementById('dream-acts');
          if (acts.children.some((c) => (c._html || '').indexOf('都不拿') >= 0)) {
            acts.children[0]._onclick();
          } else {
            dreamStep();
          }
        }
      }
      if (cur) { cur.hpLost = cur.hp0 - (D ? D.hp : 0); }
      const outcome = D === null ? (S.needs.健康 < b.健康 ? '惊醒' : '好梦/主动') : '超时';
      REPORT.runs.push({
        band: b.band, run: run + 1, age: b.age,
        stats: t0, foes: foes.map(({ name, boss, turns, hpLost }) => ({ name, boss, turns, hpLost })),
        candy: S.candy, outcome,
        log: transcript.slice(),
      });
      transcript = null;
      dreamLog = _dl;
      dreamLog = (t) => { if (transcript) transcript.push(t); return _dl(t); };
    }
  }
  dreamLog = _dl;
  return REPORT;
};
`;

eval(src + driver);
const report = globalThis.__play();
fs.writeFileSync('_dev/dream-playtest.json', JSON.stringify(report, null, 1));

// 汇总输出
for (const r of report.runs) {
  if (r.error) { console.log(r.band, r.error); continue; }
  const s = r.stats;
  console.log(`\n=== ${r.band} 段（${r.age} 岁）第 ${r.run} 场 | HP ${s.maxHp} MP ${s.maxMp} ATK ${s.atk.toFixed(1)} DEF ${s.def.toFixed(1)} 闪避 ${(s.dodge * 100).toFixed(1)}% | 小径 ${s.steps} 步 ===`);
  for (const f of r.foes) console.log(`  ${f.boss ? '★BOSS' : '  心结'} ${f.name}：${f.turns} 回合，损血 ${f.hpLost}`);
  console.log(`  → ${r.outcome}，星星糖 +${r.candy}`);
}
