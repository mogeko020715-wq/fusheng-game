/* 第十一期定向补测：多技艺技能子菜单 / 等级缩放 / 多技艺反哺 / 星星糖兑换雏形 */
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
;(function phase11(){
  function spawnFoe(hp) {
    const f = { name: '测试心结', hp: hp || 9999, atk: 0, intro: '', win: '化开了', cg: null };
    D.foe = Object.assign({}, f, { maxHp: f.hp, isBoss: false });
    D.foeShield = 0; D.foeCalm = 0;
  }
  const R = {};
  startLife();
  S.age = 5;

  // 1. 多技艺技能子菜单：武术5/绘画2 列出，编程1 不解锁
  S.skills = { 武术: { xp: 0, lvl: 5 }, 绘画: { xp: 0, lvl: 2 }, 编程: { xp: 0, lvl: 1 } };
  dreamInit();
  spawnFoe();
  D.mp = 50; D.maxMp = 50;
  dreamPickSkill();
  const labels = document.getElementById('dream-acts').children.map((c) => c._html || c.textContent);
  R.skillMenuHas =
    labels.some((h) => h && h.indexOf('动动脑筋') >= 0) &&
    labels.some((h) => h && h.indexOf('连环踢') >= 0) &&
    labels.some((h) => h && h.indexOf('纸盾') >= 0) &&
    !labels.some((h) => h && h.indexOf('修一修') >= 0);

  // 2. 等级缩放：武术 5 级连环踢 = atk×(0.5+0.1×5) 一段，共两段
  const hp0 = D.foe.hp, mp0 = D.mp;
  dreamTurn('skill', '武术');
  const per = Math.round(D.atk * (0.5 + 0.1 * 5));
  R.kickDmgOk = (hp0 - D.foe.hp) === per * 2;
  R.kickMpOk = (mp0 - D.mp) === 6;
  R.usedArtsMarked = D.usedArts.武术 === true;

  // 3. 纸盾 lvl2 → 两回合护；心结当回合反扑消耗一层，剩一层；并标记反哺
  spawnFoe();
  D.mp = 50;
  dreamTurn('skill', '绘画');
  R.shieldOk = D.foeShield === 1 && D.usedArts.绘画 === true;

  // 4. 心力不足不耗回合
  D.mp = 1;
  const hpBefore = D.foe.hp;
  dreamTurn('skill', '武术');
  R.noMpNoTurn = D.foe.hp === hpBefore && D.mp === 1;

  // 5. 反哺：用过的每门技艺醒来各 +1xp；祝福在醒来时兑现
  const gainCalls = [], needCalls = [];
  const _gs = gainSkill, _gn = gainNeed;
  gainSkill = function (n, x) { gainCalls.push([n, x]); return _gs(n, x); };
  gainNeed = function (k, v) { needCalls.push([k, v]); return _gn(k, v); };
  D.bless.mood = true; D.bless.energy = true;
  dreamWake('voluntary');
  gainSkill = _gs; gainNeed = _gn;
  R.feedbackArts = gainCalls.filter((c) => c[0] === '武术' && c[1] === 1).length === 1 &&
                   gainCalls.filter((c) => c[0] === '绘画' && c[1] === 1).length === 1;
  R.blessApplied = needCalls.some((c) => c[0] === '心情' && c[1] === 10) &&
                   needCalls.some((c) => c[0] === '精力' && c[1] === 10);

  // 6. 星星糖：合计 / 先花本场再花银行 / 不足拒绝
  dreamInit();
  D.candy = 3; S.candy = 10;
  R.totalOk = dreamCandy() === 13;
  spendCandy(5);
  R.spendOrder = D.candy === 0 && S.candy === 8;
  R.spendReject = spendCandy(99) === false && dreamCandy() === 8;

  // 7. 糖罐：好梦每夜一次 / 礼物进口袋 / 口袋满退糖 / 衣柜预告禁用
  S.candy = 20; D.candy = 0;
  dreamCandyShop();
  const kids = () => document.getElementById('dream-acts').children;
  const find = (key) => kids().find((c) => c._html && c._html.indexOf(key) >= 0);
  find('一夜好梦')._onclick();
  R.moodBought = D.bless.mood === true && dreamCandy() === 16;
  R.moodOnceDisabled = find('一夜好梦').disabled === true;
  S.pocket = [];
  find('梦的礼物')._onclick();
  R.giftGot = S.pocket.length === 1 && dreamCandy() === 8;
  S.pocket = [
    { id: 'tanghulu', n: 3 }, { id: 'soda', n: 3 }, { id: 'noodle', n: 3 },
    { id: 'bento', n: 3 }, { id: 'moms', n: 3 }, { id: 'marble', n: 3 },
  ];
  const cBefore = dreamCandy();
  find('梦的礼物')._onclick();
  R.giftRefund = dreamCandy() === cBefore && S.pocket.length === 6;
  R.wardrobeTeaser = !!(find('小小衣柜') && find('小小衣柜').disabled === true);

  // 8. 同心结复撞变体 + 未见优先（临时把 s 段池子换成只剩一个心结，避免被当成 boss）
  dreamInit();
  S.age = 5;
  const foe8 = DREAM_FOES.s[3]; // 关灯后的房间
  const log0 = () => document.getElementById('dream-log').children[0].textContent;
  const _poolS = DREAM_FOES.s;
  DREAM_FOES.s = [foe8];
  dreamEncounter();
  const firstIntro = log0();
  R.firstNotBoss = D.foe.isBoss === false;
  D.foe = null;
  dreamEncounter();
  R.againIntro = firstIntro === foe8.intro && log0() === foe8.intro2 && D.foe.isBoss === false;
  D.foe.hp = 1; dreamTurn('atk'); // 第一次化开 → win
  const win1 = log0();
  dreamEncounter();
  D.foe.hp = 1; dreamTurn('atk'); // 第二次化开 → win2
  R.againWin = win1.indexOf(foe8.win) === 0 && log0().indexOf(foe8.win2) === 0;
  DREAM_FOES.s = _poolS;
  dreamInit();
  dreamEncounter();
  const id1 = D.foe.id; D.foe = null;
  dreamEncounter();
  R.unseenFirst = id1 !== D.foe.id; // 未见优先：第二次必是没见过的心结

  console.log(JSON.stringify(R));
  const pass = Object.values(R).every(Boolean);
  console.log(pass ? 'PHASE11 TEST PASSED' : 'PHASE11 TEST FAILED');
  if (!pass) process.exit(1);
})();
`;

eval(src + driver);
