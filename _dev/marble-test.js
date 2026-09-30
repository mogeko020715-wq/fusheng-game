/* 玻璃珠闪避持久性补测：同场战斗跨回合生效、战斗结束（化开/逃遁）归零 */
const fs = require('fs');

function el() {
  return {
    style: {}, innerHTML: '', textContent: '', className: '', title: '', disabled: false,
    children: [],
    classList: { add() {}, remove() {}, contains() { return false; } },
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
;(function marbleTest(){
  function spawnFoe(name) {
    const f = { name, hp: 9999, atk: 0, intro:'', win:'化开了', cg:null };
    D.foe = Object.assign({}, f, { maxHp: f.hp, isBoss: false });
    D.foeShield = 0; D.foeCalm = 0;
  }
  startLife();
  S.age = 5; S.pocket = [{ id: 'marble', n: 1 }];
  dreamInit();
  spawnFoe('测试心结');
  dreamUseItem('marble');
  const afterUse = D.marbleDodge;
  dreamTurn('atk'); // 普攻一回合，闪避加成不该被清掉
  const afterTurn = D.marbleDodge;
  D.foe.hp = 1; dreamTurn('atk'); // 化开心结 → 清零
  const afterKill = D.marbleDodge;
  const foeGone = D.foe === null;
  // 第二场：逃遁 → 清零
  spawnFoe('测试心结2');
  D.hp = 99999; D.maxHp = 99999;
  S.pocket = [{ id: 'marble', n: 1 }];
  dreamUseItem('marble');
  let fled = false;
  for (let t = 0; t < 50 && !fled; t++) { dreamTurn('flee'); fled = D.foe === null; }
  const afterFlee = D.marbleDodge;
  const pass = afterUse === 0.1 && afterTurn === 0.1 && afterKill === 0 && foeGone && fled && afterFlee === 0;
  console.log(JSON.stringify({ afterUse, afterTurn, afterKill, foeGone, fled, afterFlee }));
  if (!pass) { console.log('MARBLE TEST FAILED'); process.exit(1); }
  console.log('MARBLE TEST PASSED');
})();
`;

eval(src + driver);
