/* P1/P2 定向补测：梦物三选一 / 破绽双倍 / 后退递减 / 退避递减 / 大心结与后半程纵深 */
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
;(function relicTest(){
  const R = {};
  function spawnFoe(hp, atk) {
    const f = { id: 't' + Math.random(), name: '测试心结', hp: hp || 9999, atk: atk || 0, intro: '', win: '化开了', cg: null };
    D.foe = Object.assign({}, f, { maxHp: f.hp, isBoss: false });
    D.foeShield = 0; D.foeCalm = 0; D.vuln = false; D.foeFleeN = 0; D.foeFirstMove = false;
  }
  const acts = () => document.getElementById('dream-acts').children;
  startLife();
  S.age = 5; S.alive = true; S.slot = 5; S.flags.dreamtToday = false;

  // 1. 第 3 步必出三选一（3 件梦物 + 1 个跳过键）
  dreamInit();
  D.steps = 12; D.pos = 2;
  dreamStep();
  R.pickAt3 = acts().length === 4 && acts().some((c) => (c._html || '').indexOf('都不拿') >= 0);
  // 2. 跳过 +2 糖
  const c0 = D.candy;
  acts().find((c) => (c._html || '').indexOf('都不拿') >= 0)._onclick();
  R.skipGives2 = D.candy === c0 + 2 && D.relics.length === 0;
  // 3. 第 7 步再次三选一；拿过的梦物不再出现
  D.pos = 6;
  dreamStep();
  const first = acts()[0];
  const firstName = (first._html || '').split('<')[0];
  first._onclick();
  R.tookOne = D.relics.length === 1;
  dreamRelicPick();
  R.noRepeat = !acts().some((c) => (c._html || '').indexOf(firstName) === 0);
  acts().find((c) => (c._html || '').indexOf('都不拿') >= 0)._onclick(); // 清掉界面

  // 4. 凉白开：遭遇开始勇气 +4
  D.relics.push('water');
  D.hp = D.maxHp - 10;
  const hpW = D.hp;
  D.pos = 1; // 前半程，不吃纵深 buff
  dreamEncounter();
  R.waterHeal = D.hp === Math.min(D.maxHp, hpW + 4);
  D.foe = null;

  // 5. 小抄：动脑筋心力 -3，且不造成伤害只上破绽
  D.relics.push('chit');
  spawnFoe();
  D.mp = 10;
  const foeHp0 = D.foe.hp;
  dreamTurn('skill', null);
  R.thinkNoDmg = D.foe.hp === foeHp0 && D.mp === 7 && D.vuln === true;

  // 6. 破绽双倍：下一次迎上去 ×2，打出后破绽清零
  const hpBefore = D.foe.hp;
  D.hp = 99999; D.maxHp = 99999;
  dreamTurn('atk');
  const drop = hpBefore - D.foe.hp;
  R.vulnDouble = drop >= 2 * D.atk && drop <= 2 * (D.atk + 4) && D.vuln === false;

  // 7. 糖纸：化开心结额外 +1
  D.relics.push('candywrap');
  spawnFoe(1, 0);
  const c1 = D.candy;
  dreamTurn('atk');
  R.wrapBonus = (D.candy - c1) >= 2; // 基础 1 + 糖纸 1（不含 40% 暴击时也是 2）

  // 8. 口袋弹珠：每场遭遇首次逼近必闪
  D.relics.push('marble2');
  spawnFoe(9999, 50);
  D.dodge = -1; // 强制普通闪避必不中
  const hpM = D.hp;
  dreamTurn('atk'); // 心结首次逼近 → 必闪
  R.marbleFirst = D.hp === hpM && D.foeFirstMove === true;
  dreamTurn('atk'); // 第二次逼近 → 必挨（atk 50, dodge -1）
  R.marbleOnce = D.hp < hpM;

  // 9. 后退递减：+3/+2/+1/+0，走一步重置
  D.foe = null; D.pos = 5; D.hp = 10; D.maxHp = 100;
  dreamBack(); const h1 = D.hp;
  dreamBack(); const h2 = D.hp;
  dreamBack(); const h3 = D.hp;
  dreamBack(); const h4 = D.hp;
  R.backDecay = (h1 - 10) === 3 && (h2 - h1) === 2 && (h3 - h2) === 1 && (h4 - h3) === 0;
  D.pos = 2; D.steps = 12;
  D.relics = DREAM_RELICS.map((r) => r.id); // 塞满库存，第 3 步不再触发三选一
  dreamStep(); // pos 3：库存已空 → 走随机分支，backTrack 重置
  R.backReset = D.backTrack === 0;

  // 10. 退避递减：连续失败计数递增（Math.random 钉在 0.99 必失败）
  D.relics = [];
  spawnFoe(9999, 0);
  D.hp = 99999; D.maxHp = 99999;
  const _rnd = Math.random;
  Math.random = () => 0.99;
  dreamTurn('flee'); dreamTurn('flee'); dreamTurn('flee');
  Math.random = _rnd;
  R.fleeDecay = D.foeFleeN === 3 && D.foe !== null;
  D.foe = null;

  // 11. 大心结：推门前一站必出、HP×1.5、atk+1、糖 +3、不重复刷
  dreamInit();
  D.steps = 10; D.pos = 8; D.hp = 99999; D.maxHp = 99999;
  dreamStep(); // pos 9 = steps-1 → elite
  const eliteBase = DREAM_FOES[dreamBand()].find((x) => x.id === D.foe.id);
  R.eliteSpawn = D.foe.elite === true && D.eliteDone === true &&
    D.foe.maxHp === Math.round(eliteBase.hp * 1.5) && D.foe.atk === eliteBase.atk + 1;
  const c2 = D.candy;
  D.foe.hp = 1; dreamTurn('atk');
  R.eliteCandy = (D.candy - c2) === 3; // 无梦物，恰为 3
  D.pos = 8;
  dreamStep(); // 再到最后一站：eliteDone → 不再出大心结
  R.eliteOnce = !(D.foe && D.foe.elite);
  D.foe = null;

  // 12. 后半程变沉：pos > steps/2 的普通心结 HP×1.15+2、atk+1；前半程不变
  D.pos = 6; D.steps = 10; // > 5
  dreamEncounter();
  const midBase = DREAM_FOES[dreamBand()].find((x) => x.id === D.foe.id);
  R.lateBuff = D.foe.maxHp === Math.round(midBase.hp * 1.15) + 2 && D.foe.atk === midBase.atk + 1;
  D.foe = null; D.seenFoes = {};
  D.pos = 1;
  dreamEncounter();
  const earlyBase = DREAM_FOES[dreamBand()].find((x) => x.id === D.foe.id);
  R.earlySame = D.foe.maxHp === earlyBase.hp && D.foe.atk === earlyBase.atk;
  D.foe = null;

  // 13. Boss 数值不动
  dreamDoor();
  const bossBase = DREAM_BOSSES[dreamBand()];
  R.bossSame = D.foe.maxHp === bossBase.hp && D.foe.atk === bossBase.atk && D.foe.isBoss === true;

  console.log(JSON.stringify(R, null, 1));
  const pass = Object.values(R).every(Boolean);
  console.log(pass ? 'DREAM RELIC TEST PASSED' : 'DREAM RELIC TEST FAILED');
  if (!pass) process.exit(1);
})();
`;

eval(src + driver);
