/* 存档系统功能测试：玩几步 → 模拟刷新 → 恢复 → 校验状态一致 */
const fs = require('fs');

function el() {
  const e = {
    style: {}, textContent: '', className: '', title: '', disabled: false,
    children: [],
    classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild(c) { this.children.push(c); },
    set onclick(f) { this._c = f; }, get onclick() { return this._c; },
  };
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
const storage = {};
global.localStorage = { _s: storage, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = v; }, removeItem(k) { delete this._s[k]; } };

const src = fs.readFileSync('game.js', 'utf8');
const driver = `
;(function saveTest(){
  const dismiss = () => {
    if (!eventLock) return;
    const kids = document.getElementById('event-choices').children;
    if (kids.length && kids[0]._c) kids[0]._c();
    const cont = document.getElementById('event-continue');
    if (cont._c) cont._c();
  };
  // 1. 开始一生，做 6 个动作
  startLife();
  dismiss();
  const snap = {};
  for (let i = 0; i < 6; i++) {
    const home = ACTIONS.filter(a => a.loc === 'home' && (!a.cond || a.cond()));
    const eat = home.find(a => a.id === 'meal');
    const ch = (eat && S.needs.饱食 < 75) ? eat : home.find(a => a.id === 'play') || home[0];
    doAction(ch.run);
    dismiss();
  }
  Object.assign(snap, { day: S.day, slot: S.slot, age: S.age, money: S.money,
    智力: Math.round(S.attrs.智力 * 10), health: Math.round(S.needs.健康),
    mem: S.memories.length, name: S.name });
  console.log('游玩快照:', JSON.stringify(snap));

  // 2. 验证存档已写入
  const raw = localStorage.getItem('fusheng_save_v1');
  console.log('存档存在:', !!raw, '| 大小:', raw ? raw.length + 'B' : 0);

  // 3. 模拟刷新：清空内存状态
  S = null; eventLock = false; milestoneQueue = [];
  console.log('--- 模拟刷新（S 已清空）---');

  // 4. 恢复
  const ok = resumeLife();
  const match = S && S.day === snap.day && S.slot === snap.slot && S.name === snap.name
    && Math.round(S.attrs.智力 * 10) === snap.智力 && S.memories.length === snap.mem;
  console.log('恢复成功:', ok, '| 状态一致:', match, '| 恢复后:', S.day + '天', S.slot + '时段', S.name, '智力x10=' + Math.round(S.attrs.智力 * 10));

  // 5. 事件弹窗中刷新 → 事件应重开
  dismiss();
  doAction((ACTIONS.filter(a => a.loc === 'home' && (!a.cond || a.cond())).find(a => a.id === 'play') || ACTIONS[0]).run);
  if (!eventLock) { for (let i = 0; i < 40 && !eventLock; i++) { doAction((ACTIONS.filter(a => a.loc === 'home' && (!a.cond || a.cond())).find(a => a.id === 'play')).run); } }
  console.log('触发了事件弹窗:', eventLock, currentEventId);
  const evId = currentEventId;
  S = null; eventLock = false; milestoneQueue = [];
  resumeLife();
  console.log('刷新后事件重开:', eventLock, currentEventId === evId ? ('同一事件: ' + currentEventId) : ('事件id: ' + currentEventId + ' vs ' + evId));
  dismiss();

  // 6. 落幕 → 存档清除
  S.age = 18; S.day = 91;
  endLife('成年');
  console.log('落幕后存档已清除:', localStorage.getItem('fusheng_save_v1') === null);
  console.log('SAVE TEST DONE');
})();
`;
eval(src + driver);
