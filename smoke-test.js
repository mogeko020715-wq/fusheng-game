/* 冒烟测试：桩掉 DOM，完整模拟玩一世 */
const fs = require('fs');

function el() {
  return {
    style: {}, innerHTML: '', textContent: '', className: '', title: '', disabled: false,
    children: [],
    classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild(c) { this.children.push(c); },
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

const src = fs.readFileSync('game.js', 'utf8');

const driver = `
;(function smoke(){
  let lives = 0;
  for (let life = 0; life < 5; life++) {
    startLife();
    lives++;
    let guard = 0;
    while (S && S.alive && guard++ < 20000) {
      if (eventLock) {
        const kids = document.getElementById('event-choices').children;
        if (kids.length && kids[0]._onclick) kids[0]._onclick();
        const cont = document.getElementById('event-continue');
        if (cont._onclick) cont._onclick();
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
    console.log('第' + lives + '世:', S.name, S.family.name, '活到', S.age, '岁', S.alive ? '(成年)' : '(离世)', '天数', S.day, '记忆', S.memories.length, '中考', S.exam || '无');
  }
  const mem = JSON.parse(localStorage.getItem('fusheng_memorials_v1') || '[]');
  console.log('往生录条数:', mem.length, mem[0] ? ('最新: ' + mem[0].name + ' ' + mem[0].verdict) : '');
  console.log('SMOKE TEST PASSED');
})();
`;

eval(src + driver);
