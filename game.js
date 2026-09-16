/* ============================================================
 * 浮生 · 众生一梦 —— 向《众生》(The Lives) 致敬的浏览器复刻
 * 黑白简笔 · 人生模拟 · 一切随机，无法存档
 * ============================================================ */
'use strict';

/* ---------------- 工具 ---------------- */
const $ = (id) => document.getElementById(id);
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const chance = (p) => Math.random() < p;
const round1 = (v) => Math.round(v * 10) / 10;

/* ============================================================
 * 表现层：程序化音效 · 数值飘字 · 简笔小人 · 换场
 * （全部防御式编写：无音频/无真实 DOM 的环境下降级为静默）
 * ============================================================ */
const Sound = {
  ctx: null,
  muted: false,
  init() {
    try { this.muted = localStorage.getItem('fusheng_muted') === '1'; } catch (e) { this.muted = false; }
  },
  ensure() {
    if (this.ctx || typeof window === 'undefined') return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { /* 无音频环境 */ }
  },
  toggle() {
    this.muted = !this.muted;
    try { localStorage.setItem('fusheng_muted', this.muted ? '1' : '0'); } catch (e) { /* 忽略 */ }
    return this.muted;
  },
  _noise(dur, freq, q, gainV, sweepTo) {
    const c = this.ctx;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, c.currentTime + dur);
    const g = c.createGain(); g.gain.value = gainV;
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start();
  },
  _tone(freq, dur, type, gainV, delay = 0) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = c.createGain();
    const t = c.currentTime + delay;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gainV, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  },
  play(name) {
    if (this.muted) return;
    this.ensure();
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      switch (name) {
        case 'page':    this._noise(0.30, 900, 0.8, 0.10, 320); break;          // 翻纸
        case 'scratch': this._noise(0.09, 2400, 1.2, 0.06); this._noise(0.07, 1800, 1.2, 0.05); break; // 铅笔
        case 'chime':   this._tone(659, 0.5, 'sine', 0.08); this._tone(880, 0.7, 'sine', 0.07, 0.12); break;
        case 'bell':    this._tone(196, 1.8, 'sine', 0.10); this._tone(197.6, 1.8, 'sine', 0.06); break;
        case 'pop':     this._tone(520, 0.08, 'triangle', 0.06); break;
      }
    } catch (e) { /* 音频失败不影响游戏 */ }
  },
};

/* ---------------- 数值飘字 ---------------- */
let fxQueue = [];
let fxQuiet = false;           // 需求自然衰减期间不飘字
function fx(key, v) {
  if (fxQuiet || !v || Math.abs(v) < 0.05) return;
  fxQueue.push({ key, v });
}
function fxAnchorId(k) {
  if (k === 'money') return 'ui-money';
  if (k === '体质' || k === '智力' || k === '魅力') return 'bar-' + k;
  return 'need-' + k;
}
function flushFx() {
  if (!fxQueue.length) return;
  const layer = $('fx-layer');
  const items = fxQueue.slice(0, 6);
  fxQueue = [];
  items.forEach((it, i) => {
    const a = $(fxAnchorId(it.key));
    if (!a || typeof a.getBoundingClientRect !== 'function') return;
    const r = a.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'float-txt' + (it.v < 0 ? ' neg' : '');
    const val = Math.abs(it.v) >= 10 ? Math.round(it.v) : round1(it.v);
    el.textContent = it.key === 'money'
      ? (it.v > 0 ? '+¥' : '-¥') + Math.abs(val)
      : (it.v > 0 ? '+' : '') + val + ' ' + it.key;
    el.style.left = (r.left + r.width / 2 - 24 + rand(-8, 8)) + 'px';
    el.style.top = (r.top - 8 - i * 16) + 'px';
    layer.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 1250);
  });
}

/* ---------------- 简笔小人 ---------------- */
const ACT_ANIM = {
  meal: 'eat', sleep: 'sleep', wash: 'stand', play: 'jump', study: 'sit',
  exercise: 'jump', chore: 'walk', art: 'sit', cook: 'stand', chat: 'sit',
  walk: 'walk', slide: 'jump', fish: 'sit', watch: 'sit',
  class: 'run', skip: 'run', club: 'sit',
  book: 'walk', toy: 'jump', snack: 'eat', artist: 'stand', chess: 'sit',
  veg: 'walk', deli: 'eat', carry: 'walk', cure: 'stand', checkup: 'stand',
};
const ANIM_CLASSES = ['anim-walk', 'anim-run', 'anim-jump', 'anim-stand', 'anim-sit', 'anim-eat', 'anim-sleep'];
function actorAnim(name) {
  const a = $('actor');
  if (!a || !a.classList) return;
  a.classList.remove('ps-sit', 'ps-lie');
  if (name === 'sit' || name === 'eat') a.classList.add('ps-sit');
  if (name === 'sleep') a.classList.add('ps-lie');
  ANIM_CLASSES.forEach((c) => a.classList.remove(c));
  a.classList.add('anim-' + name);
  clearTimeout(actorAnim._t);
  actorAnim._t = setTimeout(() => {
    a.classList.remove('anim-' + name);
    a.classList.remove('ps-sit', 'ps-lie');
  }, name === 'sleep' ? 1500 : 950);
}

/* ---------------- 换场 ---------------- */
function switchLocation(id) {
  if (eventLock || !S || !S.alive || id === S.location) return;
  if (S.age < SCENES[id].min) return;
  Sound.play('page');
  actorAnim('walk');
  const stage = $('scene-stage');
  stage.classList.add('swap-out');
  setTimeout(() => {
    S.location = id;
    render();
    stage.classList.remove('swap-out');
    stage.classList.add('swap-in');
    const t = $('scene-title');
    t.classList.add('pop');
    setTimeout(() => { stage.classList.remove('swap-in'); t.classList.remove('pop'); }, 500);
  }, 260);
}
function cycleLoc(dir) {
  if (!S) return;
  const ids = Object.keys(SCENES).filter((k) => S.age >= SCENES[k].min);
  if (!ids.length) return;
  const i = ids.indexOf(S.location);
  switchLocation(ids[(i + dir + ids.length) % ids.length]);
}

/* ---------------- 常量 ---------------- */
const SLOTS = ['清晨', '上午', '中午', '下午', '傍晚', '夜晚'];
const MEAL_SLOTS = [0, 2, 4];           // 早 7 点 / 午 12 点 / 晚 6 点
const DAYS_PER_YEAR = 6;                // 六个时段为一天，六天一岁
const START_AGE = 3, END_AGE = 18;
const MEMORIAL_KEY = 'fusheng_memorials_v1';

const FAMILY = {
  poor:   { name: '贫寒之家', badge: '贫', home: ['一间漏风的平房', '筒子楼里的一居室'],
            meal: 38, allowance: 3,  meals: ['咸菜配白粥', '清汤寡水的面条', '残羹剩饭'] },
  middle: { name: '小康之家', badge: '康', home: ['两层小独栋', '方便的电梯公寓'],
            meal: 52, allowance: 12, meals: ['荤素搭配的家常菜', '热腾腾的三菜一汤', '妈妈拿手的红烧肉'] },
  rich:   { name: '富贵之家', badge: '富', home: ['带庭院的四合院', '三层大别墅，还有保姆'],
            meal: 66, allowance: 45, meals: ['山珍海味一大桌', '龙虾鲍鱼随便吃', '米其林大厨的私宴'] },
};
const FAMILY_KEYS = ['poor', 'poor', 'middle', 'middle', 'middle', 'rich']; // 概率

const SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '林', '何', '郭'];
const NAMES_M = ['志强', '建国', '小明', '子轩', '浩然', '铁蛋', '阿福', '一鸣', '念安', '知远', '石头', '晨光'];
const NAMES_F = ['秀英', '桂芳', '小雨', '诗涵', '欣怡', '招娣', '春花', '静姝', '晚晴', '念慈', '燕子', '繁星'];

const APT_LABEL = (v) => v < 0.85 ? '鲁钝' : v < 1.0 ? '平平' : v < 1.15 ? '出众' : '天资';
const APT_ORDER = ['学习', '运动', '艺术'];
const APT_TIP = { 学习: '影响看书与上课的智力收益', 运动: '影响锻炼与运动的体质收益', 艺术: '影响艺术练习的魅力收益' };

/* ---------------- 状态 ---------------- */
let S = null;          // 当前人生
let eventLock = false; // 弹窗打开时锁定操作

function newLife() {
  const gender = chance(0.5) ? '男' : '女';
  const fk = pick(FAMILY_KEYS);
  const fam = FAMILY[fk];
  const name = pick(SURNAMES) + (gender === '男' ? pick(NAMES_M) : pick(NAMES_F));
  S = {
    name, gender, familyKey: fk, family: fam,
    home: pick(fam.home),
    age: START_AGE, day: 1, slot: 0,
    attrs: { 体质: rand(25, 70), 智力: rand(25, 70), 魅力: rand(25, 70) },
    apt: { 学习: 0.7 + Math.random() * 0.6, 运动: 0.7 + Math.random() * 0.6, 艺术: 0.7 + Math.random() * 0.6 },
    needs: { 饱食: 80, 精力: 90, 清洁: 80, 娱乐: 70, 心情: 70, 健康: 100 },
    money: rand(0, 5),
    skills: {},            // { 烹饪: {xp, lvl} }
    buffs: [],             // { name, desc, slots, gainMul, energyMul }
    flags: { wentSchool: false, skipped: 0, intro: false },
    location: 'home',
    memories: [],          // 大事记
    eventCooldown: 0,
    log: [],
    alive: true,
    exam: null,            // 中考结果
    happinessSum: 70, happinessCnt: 1,
  };
  fxQueue = [];
  addLog(`你出生了。${fam.name}，${S.home}。`, 'sys');
  addLog(`父母给你取名「${name}」。这一世，请多保重。`, 'sys');
}

/* ---------------- 日志 & 记忆 ---------------- */
function addLog(text, cls = '') {
  S.log.unshift({ day: S.day, age: S.age, text, cls });
  if (S.log.length > 60) S.log.pop();
}
function remember(text) {
  S.memories.push({ age: S.age, text });
  addLog('★ ' + text, 'event');
}

/* ---------------- 属性/需求操作 ---------------- */
function gain(attr, v) {
  const mul = S.buffs.reduce((m, b) => m * (b.gainMul || 1), 1);
  const before = S.attrs[attr];
  S.attrs[attr] = clamp(round1(S.attrs[attr] + v * mul), 1, 100);
  fx(attr, S.attrs[attr] - before);
}
function gainNeed(k, v) {
  const before = S.needs[k];
  S.needs[k] = clamp(round1(S.needs[k] + v), 0, 100);
  fx(k, S.needs[k] - before);
}
function gainHealth(v) {
  const before = S.needs.健康;
  S.needs.健康 = clamp(round1(S.needs.健康 + v), 0, 100);
  fx('健康', S.needs.健康 - before);
  if (S.needs.健康 <= 0 && S.alive) endLife('夭');
}
function gainMoney(v) {
  const before = S.money;
  S.money = Math.max(0, S.money + v);
  fx('money', S.money - before);
}
function gainSkill(name, xp) {
  if (!S.skills[name]) S.skills[name] = { xp: 0, lvl: 1 };
  const sk = S.skills[name];
  sk.xp += xp;
  while (sk.xp >= sk.lvl * 10 && sk.lvl < 9) { sk.xp -= sk.lvl * 10; sk.lvl++; addLog(`你的「${name}」升到了 ${sk.lvl} 级。`, 'sys'); }
}
function addBuff(name, desc, slots, opts = {}) {
  S.buffs = S.buffs.filter((b) => b.name !== name);
  S.buffs.push({ name, desc, slots, gainMul: opts.gainMul || 1, energyMul: opts.energyMul || 1 });
  addLog(`【${name}】${desc}`, 'sys');
}

/* ---------------- 时间流逝 ---------------- */
function decayNeeds() {
  fxQuiet = true;
  const em = S.buffs.reduce((m, b) => m * (b.energyMul || 1), 1);
  gainNeed('饱食', -9);
  gainNeed('精力', -11 * em);
  gainNeed('清洁', -4);
  gainNeed('娱乐', -7);
  // 心情向其他需求的均值缓慢靠拢
  const avg = (S.needs.饱食 + S.needs.精力 + S.needs.清洁 + S.needs.娱乐) / 4;
  gainNeed('心情', (avg - S.needs.心情) * 0.18);
  // 健康：需求见底才会伤身，同一种伤害一天只结算一次
  S.dayHurt = S.dayHurt || {};
  let dmg = 0;
  if (S.needs.饱食 <= 0 && !S.dayHurt.hunger) { S.dayHurt.hunger = 1; dmg += 7; if (S.familyKey === 'poor' && chance(0.3)) addBuff('营养不良', '面黄肌瘦，学什么都慢。', 12, { gainMul: 0.55 }); }
  if (S.needs.精力 <= 0 && !S.dayHurt.tired) { S.dayHurt.tired = 1; dmg += 5; }
  if (S.needs.清洁 <= 0 && !S.dayHurt.dirty) { S.dayHurt.dirty = 1; dmg += 2; }
  if (dmg > 0) { gainHealth(-dmg); if (chance(0.2)) addBuff('感冒', '头昏脑涨，精力流失加快。', 8, { energyMul: 1.5 }); }
  else if (S.needs.饱食 > 60 && S.needs.精力 > 60 && S.needs.清洁 > 50) gainHealth(3);
  if (S.needs.心情 < 15 && chance(0.2)) addBuff('心情低落', '对什么都提不起劲。', 6, { gainMul: 0.7 });
  // buff 回合
  S.buffs.forEach((b) => b.slots--);
  S.buffs = S.buffs.filter((b) => b.slots > 0);
  S.happinessSum += S.needs.心情; S.happinessCnt++;
  fxQuiet = false;
}

function advanceSlot() {
  decayNeeds();
  if (!S.alive) return;
  if (S.slot < 5) { S.slot++; }
  else { S.slot = 0; nextDay(); }
  afterAction();
}

function nextDay() {
  S.day++;
  S.flags.wentSchool = false;
  S.dayHurt = {};
  // 生日：每 DAYS_PER_YEAR 天
  if ((S.day - 1) % DAYS_PER_YEAR === 0) {
    S.age++;
    gainMoney(S.family.allowance);
    addLog(`今天你 ${S.age} 岁了。父母给了 ¥${S.family.allowance} 零花钱。`, 'day');
    addBuff('被爱环绕', '新的一岁，家人的爱围绕着你。', 6);
    checkMilestones();
  }
}

function afterAction() {
  if (!S.alive) return;
  render();
  // 随机事件
  if (S.eventCooldown > 0) S.eventCooldown--;
  else if (S.age < END_AGE && chance(0.11)) {
    const ev = drawEvent();
    if (ev) { S.eventCooldown = 4; openEvent(ev); return; }
  }
  if (S.age >= END_AGE) { endLife('成年'); return; }
}

/* ---------------- 动作结算 ---------------- */
function doAction(fn, anim) {
  if (eventLock || !S || !S.alive) return;
  Sound.play('scratch');
  if (anim) actorAnim(anim);
  const handled = fn();
  if (S.alive && !handled) advanceSlot();
}

/* ---------------- 吃饭 & 睡觉 ---------------- */
function eatMeal() {
  const f = S.family;
  gainNeed('饱食', f.meal);
  gainNeed('心情', 4);
  const dish = pick(f.meals);
  addLog(`吃了${dish}。`);
  if (S.familyKey === 'rich' && chance(0.22)) {
    addBuff('营养过剩', '吃得太好，动一动就喘。', 8, { gainMul: 0.85 });
  }
  if (S.familyKey === 'poor' && chance(0.18)) {
    gainHealth(-3); addLog('长期吃不饱，你有些头晕。', 'sys');
  }
}

function sleep() {
  S.slot = 5; // 直接入夜
  gainNeed('精力', 100);
  gainNeed('清洁', -6);
  addLog('你睡着了，做了一个短短的梦。');
  nextDay();
  S.slot = 0;
  if (S.alive) afterAction();
  return true; // 时间已自行推进
}

/* ---------------- 上学 ---------------- */
function schoolName() {
  const a = S.age;
  if (a <= 6) return '幼儿园';
  if (a <= 12) return '小学';
  return '中学';
}
function goSchool() {
  S.flags.wentSchool = true;
  const tired = S.needs.精力 < 25;
  gain('智力', (1.1 + rand(0, 4) / 10) * S.apt.学习);
  gainNeed('精力', tired ? -12 : -8);
  gainNeed('娱乐', -6);
  gainNeed('心情', -3);
  if (chance(0.2)) gain('魅力', 0.4);
  addLog(`你在${schoolName()}上了一天课。${tired ? '太累了，听课直打瞌睡。' : ''}`);
}
function skipSchool() {
  S.flags.skipped++;
  gainNeed('娱乐', 10); gainNeed('心情', 6);
  gain('智力', -0.5);
  addLog('你逃了课。风很自由，心有点虚。', 'sys');
  if (S.flags.skipped > 0 && S.flags.skipped % 4 === 0) {
    addLog('老师家访了。父母的脸色很难看。', 'sys');
    gainNeed('心情', -12);
  }
}

/* ============================================================
 * 事件系统
 * ============================================================ */
function applyEffects(eff) {
  if (!eff) return;
  ['体质', '智力', '魅力'].forEach((k) => { if (eff[k]) gain(k, eff[k]); });
  ['饱食', '精力', '清洁', '娱乐', '心情'].forEach((k) => { if (eff[k]) gainNeed(k, eff[k]); });
  if (eff.健康) gainHealth(eff.健康);
  if (eff.money) gainMoney(eff.money);
  if (eff.skill) gainSkill(eff.skill.name, eff.skill.xp);
  if (eff.buff) addBuff(eff.buff.name, eff.buff.desc, eff.buff.slots, eff.buff);
  if (eff.mem) remember(eff.mem);
  if (eff.flag) Object.assign(S.flags, eff.flag);
}

function checkPass(chk) {
  if (!chk) return true;
  const val = S.attrs[chk.attr] + rand(0, 30);
  return val >= chk.dc;
}

/* ---------------- 事件池 ---------------- */
const EVENTS = [
  {
    id: 'cat', title: '巷口的流浪猫', min: 3, max: 9,
    text: '放学路上，一只瘦巴巴的流浪猫冲你喵喵叫，尾巴尖都秃了。',
    choices: [
      { t: '省下早饭钱给它买火腿肠', cond: (s) => s.money >= 1, ok: { money: -1, 心情: 10, 魅力: 1, mem: '你喂过一只秃尾巴的流浪猫，它蹭了蹭你的裤脚。' }, failTxt: '你摸摸口袋，空空如也。只能冲它抱歉地笑笑。' },
      { t: '蹲下来摸摸它的头', ok: { 心情: 6, 魅力: 0.6 } },
      { t: '绕开走', ok: { 心情: -3 }, okTxt: '你走了，身后还有细细的叫声。你有点不是滋味。' },
    ],
  },
  {
    id: 'fight', title: '胡同里的架', min: 5, max: 13,
    text: '巷子里，邻居家两个小孩扭打在一起，尘土飞扬。',
    choices: [
      { t: '上前把他们拉开（魅力检定）', check: { attr: '魅力', dc: 60 }, ok: { 魅力: 2, 心情: 8, mem: '你劝开了胡同里最凶的一场架，大人夸你懂事。' }, fail: { 健康: -4, 心情: -5 }, failTxt: '你挨了一肘子，还被骂「少管闲事」。' },
      { t: '在旁边喊「老师来了！」（智力检定）', check: { attr: '智力', dc: 55 }, ok: { 智力: 1.5, 心情: 6 }, fail: { 心情: -4 }, failTxt: '没人信你，你自己倒先跑远了。' },
      { t: '远远看热闹', ok: { 娱乐: 8 } },
    ],
  },
  {
    id: 'test', title: '课堂小测', min: 7, max: 13,
    cond: (s) => s.flags.wentSchool,
    text: '老师抱着一摞卷子走进教室：「这节课小测，突袭检查。」教室里哀嚎一片。',
    choices: [
      { t: '认真作答（智力检定）', check: { attr: '智力', dc: 58 }, ok: { 智力: 2, 心情: 8, mem: '一次突袭小测，你考了全班第一。' }, fail: { 心情: -6 }, failTxt: '卷子发下来，分数不太好看。' },
      { t: '偷看同桌的', check: { attr: '魅力', dc: 70 }, ok: { 智力: 1, 心情: 3 }, fail: { 心情: -10, mem: '你作弊被抓了，罚站了一下午。' } },
      { t: '听天由命，乱写一气', ok: { 心情: 2, 娱乐: 4 } },
    ],
  },
  {
    id: 'money', title: '地上的十块钱', min: 4, max: 15,
    text: '人来人往的路口，一张十块钱静静躺在地上，像在对谁使眼色。',
    choices: [
      { t: '捡起来交给警察叔叔', ok: { 心情: 6, 魅力: 1.5, mem: '你把捡到的钱交给了警察叔叔，得到了一面小红旗。' } },
      { t: '四下无人，装进口袋', ok: { money: 10, 心情: 2 }, okTxt: '钱到手了，心跳得有点快。' },
      { t: '踢到一边，不看不碰', ok: { 心情: 1 } },
    ],
  },
  {
    id: 'guest', title: '家里来客人了', min: 3, max: 14,
    cond: (s) => s.location === 'home',
    text: '门铃响了，是爸妈的老朋友，拎着大包小包。满屋子的大人笑声让你有点无措。',
    choices: [
      { t: '大方地打招呼、端茶倒水（魅力检定）', check: { attr: '魅力', dc: 55 }, ok: { 魅力: 2, 心情: 6, mem: '亲戚们夸你「这孩子真懂事」，你偷偷挺直了腰。' }, fail: { 心情: -3 }, failTxt: '你紧张得打翻了茶杯，脸红到了耳根。' },
      { t: '躲回自己房间', ok: { 心情: 2, 娱乐: 4 }, okTxt: '你躲进房间，世界安静了。' },
    ],
  },
  {
    id: 'needle', title: '打预防针', min: 3, max: 8,
    text: '学校组织打预防针。队伍排得老长，里面传来小孩此起彼伏的哭声。',
    choices: [
      { t: '咬着牙忍住（体质检定）', check: { attr: '体质', dc: 50 }, ok: { 体质: 2, 心情: 5, mem: '打针你没哭，护士阿姨奖励了你一颗糖。' }, fail: { 心情: -6 }, failTxt: '针还没扎你就哭了，哭完整张脸都是鼻涕。' },
      { t: '哭得比谁都大声', ok: { 心情: -3, 娱乐: 3 }, okTxt: '哭也是一种释放。' },
    ],
  },
  {
    id: 'ant', title: '蚂蚁搬家', min: 3, max: 7,
    cond: (s) => s.location === 'park',
    text: '公园的石阶上，一长列蚂蚁正排着队搬家，扛着比自己大好几倍的食物。',
    choices: [
      { t: '蹲着看了一下午（智力检定）', check: { attr: '智力', dc: 45 }, ok: { 智力: 1.5, mem: '你看蚂蚁搬家入了迷，觉得它们比人还有秩序。' }, fail: { 娱乐: 8 }, okTxt: '你看出了一身蚊子包，但心里痒痒的，像有什么发芽了。' },
      { t: '用小树枝给它们「指路」', ok: { 娱乐: 8, 心情: 4 } },
      { t: '一脚踩乱队伍', ok: { 心情: -5 }, okTxt: '队伍乱了。你忽然觉得没什么意思。' },
    ],
  },
  {
    id: 'singer', title: '流浪歌手', min: 4, max: 18,
    cond: (s) => s.location === 'square',
    text: '广场角落，一个抱着旧吉他的歌手在唱歌，嗓子沙哑，调子却亮。路人行色匆匆。',
    choices: [
      { t: '往琴盒里放两块钱', cond: (s) => s.money >= 2, ok: { money: -2, 心情: 10, 魅力: 0.8, mem: '你给流浪歌手投了两块钱，他冲你眨了眨眼。' } },
      { t: '驻足听完一整首', ok: { 心情: 7, 娱乐: 5 } },
      { t: '快步走过', ok: {} },
    ],
  },
  {
    id: 'bully', title: '高年级的「规矩」', min: 7, max: 14,
    text: '巷口被几个高年级学生堵住了。「新来的？懂不懂规矩，交保护费。」',
    choices: [
      { t: '硬碰硬（体质检定）', check: { attr: '体质', dc: 65 }, ok: { 体质: 2, 魅力: 2, 心情: 8, mem: '你把堵巷口的高年级学生打服了，一战成名。' }, fail: { 健康: -10, 心情: -10 }, failTxt: '你被推搡在地，膝盖磕破了。他们拿走你的钱，扬长而去。' },
      { t: '不卑不亢讲道理（智力检定）', check: { attr: '智力', dc: 62 }, ok: { 智力: 1.5, 魅力: 1.5, mem: '你三言两语说退了拦路的高年级学生，他们愣是没敢再拦你。' }, fail: { money: -5, 心情: -6 }, failTxt: '对方冷笑一声，搜走了你的零花钱。' },
      { t: '认栽给钱', cond: (s) => s.money >= 5, ok: { money: -5, 心情: -8 }, okTxt: '钱没了，你绕了很远的路回家。' },
    ],
  },
  {
    id: 'grandma', title: '奶奶的故事', min: 3, max: 12,
    cond: (s) => s.location === 'home',
    text: '奶奶摇着蒲扇，眯着眼叫你：「来，给你讲个从前的故事。」',
    choices: [
      { t: '搬个小板凳乖乖听', ok: { 心情: 10, 智力: 0.6, mem: '那个夏夜的故事，你记了很多年。' } },
      { t: '「我作业还没写完呢」', ok: { 智力: 0.8, 心情: -4 } },
    ],
  },
  {
    id: 'rain', title: '突如其来的雨', min: 3, max: 18,
    text: '天空毫无预兆地塌下一场大雨，豆大的雨点砸得地面冒烟。',
    choices: [
      { t: '在屋檐下躲雨，看雨发呆', ok: { 心情: 6, 娱乐: 4, mem: '一场豪雨把你困在屋檐下，你第一次发现雨声这么好听。' } },
      { t: '冒雨跑回家（体质检定）', check: { attr: '体质', dc: 52 }, ok: { 体质: 1, 清洁: -15 }, fail: { 健康: -8, buff: { name: '感冒', desc: '淋成了落汤鸡，头有点烫。', slots: 8, energyMul: 1.5 } }, okTxt: '你冲回了家，浑身湿透却莫名痛快。' },
    ],
  },
  {
    id: 'birthday', title: '同学的生日会', min: 5, max: 13,
    text: '同桌递来一张手绘请柬：「周六我过生日，来我家玩呀！带上你的零花钱，咱们去放风筝。」',
    choices: [
      { t: '精心准备小礼物去赴约', cond: (s) => s.money >= 3, ok: { money: -3, 魅力: 2, 心情: 12, mem: '那场生日会，你们放着风筝，笑到肚子痛。' } },
      { t: '找借口推掉', ok: { 心情: -5 }, okTxt: '你说那天没空。挂电话的时候，心里空了一下。' },
    ],
  },
  {
    id: 'queue', title: '插队的人', min: 5, max: 18,
    cond: (s) => s.location === 'market' || s.location === 'square',
    text: '长长的队伍前，一个大汉旁若无人地插到了最前面，没人作声。',
    choices: [
      { t: '指出他插队（魅力检定）', check: { attr: '魅力', dc: 62 }, ok: { 魅力: 2.5, 心情: 8, mem: '你当众指出了插队的人，队伍里响起零零星星的掌声。' }, fail: { 心情: -7 }, failTxt: '大汉瞪了你一眼：「小屁孩少管闲事。」你退缩了。' },
      { t: '随大流，沉默', ok: { 心情: -3 }, okTxt: '你低下了头。队伍很长，沉默的人很多。' },
    ],
  },
  {
    id: 'bird', title: '受伤的小鸟', min: 4, max: 10,
    cond: (s) => s.location === 'park',
    text: '草丛里扑腾着一只翅膀受伤的小鸟，眼睛又黑又亮，直直地看着你。',
    choices: [
      { t: '抱回家养着（体质检定：能不能养活）', check: { attr: '体质', dc: 48 }, ok: { 心情: 10, mem: '你救活了一只翅膀受伤的小鸟，它好全那天，你在窗台看了它一宿。' }, fail: { 心情: -8, mem: '小鸟没能撑过那个星期。你第一次明白，有些东西留不住。' } },
      { t: '把它放到安全的草丛高处', ok: { 心情: 4 }, okTxt: '你找来纸盒垫好，能做的只有这么多了。' },
    ],
  },
  {
    id: 'quarrel', title: '深夜的争吵', min: 4, max: 16,
    cond: (s) => s.location === 'home',
    text: '半夜，你被压低嗓门的争吵声惊醒。是爸妈。黑暗中，每个字都听得清清楚楚。',
    choices: [
      { t: '蒙着被子装睡', ok: { 心情: -8, 娱乐: -5 }, okTxt: '你一整夜没睡好。' },
      { t: '起来给他们倒两杯水', ok: { 魅力: 1.5, 心情: 2, mem: '争吵声在你端水出来的那一刻停了。那晚之后，家里安静了很久。' } },
      { t: '用画画/弹琴盖过那些声音（艺术检定）', check: { attr: '魅力', dc: 68 }, ok: { 心情: 5, skill: { name: '艺术', xp: 4 } }, fail: { 心情: -5 }, failTxt: '你的手在抖，画不出一条直线。' },
    ],
  },
  {
    id: 'fever', title: '深夜高烧', min: 3, max: 12,
    cond: (s) => s.needs.健康 < 55,
    text: '半夜里你烧得满脸通红，浑身像被火烤着，脑袋沉得抬不起来。',
    choices: [
      { t: '叫醒爸妈送医院', ok: { 健康: 25, 心情: 5, mem: '那次高烧，爸妈背着你跑了三条街。趴在那片背上，你觉得很安稳。' } },
      { t: '咬牙硬扛（体质检定）', check: { attr: '体质', dc: 66 }, ok: { 体质: 2, 健康: 8, mem: '你硬扛过了一夜高烧，醒来时天光大亮，你觉得自己长大了。' }, fail: { 健康: -18, buff: { name: '感冒', desc: '高烧未退，整个人都是飘的。', slots: 10, energyMul: 1.6 } }, failTxt: '烧得更厉害了，天旋地转。' },
    ],
  },
  {
    id: 'race', title: '运动会', min: 7, max: 14,
    cond: (s) => s.flags.wentSchool,
    text: '学校运动会。八百米报名的名单上还缺一个名字，体育委员的目光扫过全班，停在你身上。',
    choices: [
      { t: '报名！（体质检定）', check: { attr: '体质', dc: 60 }, ok: { 体质: 2.5, 魅力: 2, 心情: 10, mem: '你在运动会上拿了名次，全班为你欢呼。' }, fail: { 健康: -6, 心情: -3 }, failTxt: '你跑岔了气，倒数第二。不过你跑完了全程。' },
      { t: '摇头装没看见', ok: { 心情: -2 } },
    ],
  },
  {
    id: 'notes', title: '借笔记的人', min: 10, max: 16,
    cond: (s) => s.flags.wentSchool,
    text: '下课时，班里最好看的那个同学站到你桌前：「那个……能借你的笔记看看吗？」',
    choices: [
      { t: '大方地借，还附上讲解（魅力检定）', check: { attr: '魅力', dc: 55 }, ok: { 魅力: 2.5, 心情: 12, mem: '你把笔记借给了那个人。后来你们成了很好的朋友。' }, fail: { 心情: 3 }, okTxt: '对方道了谢。你心跳快了一节课。' },
      { t: '借，但一句话也不敢多说', ok: { 心情: 4, 智力: 0.5 } },
    ],
  },
  {
    id: 'shoes', title: '崭新的球鞋', min: 7, max: 13,
    text: '班里最阔气的同学穿着一双崭新的名牌球鞋，被一群人围着。你低头看了看自己开胶的鞋。',
    choices: [
      { t: '不在意，鞋合脚就行', ok: { 心情: 5, 智力: 0.5 }, okTxt: '你忽然觉得，开胶的鞋也能跑得很快。' },
      { t: '回家缠着爸妈要买（家境影响结果）', cond: (s) => true, ok: { 心情: -4 }, okTxt: S && S.familyKey === 'rich' ? '第二天你就穿上了新鞋，却没想象中那么开心。' : '爸妈面露难色。你话说到一半，咽了回去。那晚你懂事了很多。' },
    ],
  },
  {
    id: 'chess', title: '棋摊观战', min: 6, max: 18,
    cond: (s) => s.location === 'square',
    text: '广场树荫下，两个老爷子在下象棋，一圈人围着看，时不时发出「啧啧」声。',
    choices: [
      { t: '凑进去看，学着琢磨（智力检定）', check: { attr: '智力', dc: 50 }, ok: { 智力: 2, mem: '棋摊的老爷子收了你做「编外徒弟」，你的棋下得越来越好。' }, fail: { 娱乐: 6 }, okTxt: '你没看太懂，但觉得棋子拍在木头上的声音很好听。' },
      { t: '围观起哄', ok: { 娱乐: 5 } },
    ],
  },
  {
    id: 'goldfish', title: '金鱼的葬礼', min: 3, max: 8,
    cond: (s) => s.familyKey !== 'poor' && s.location === 'home',
    text: '鱼缸里那条你喂了两年的金鱼，今天肚皮朝上浮在水面上，一动也不动。',
    choices: [
      { t: '郑重地把它埋在花盆里', ok: { 心情: -4, mem: '你为小金鱼举行了葬礼。那是你第一次面对告别。' } },
      { t: '让大人处理掉，转身去玩', ok: { 心情: 1 } },
    ],
  },
  {
    id: 'tv', title: '动画片与作业', min: 5, max: 12,
    cond: (s) => s.location === 'home',
    text: '客厅里电视机正放着你最爱看的动画片，声音勾得你心痒痒。书包里，作业还一个字没动。',
    choices: [
      { t: '先写完作业再看（智力检定）', check: { attr: '智力', dc: 48 }, ok: { 智力: 1.5, 心情: 6, mem: '你战胜了电视机。多年以后你才明白，这叫「延迟满足」。' }, fail: { 心情: -3 }, okTxt: '你写着写着，耳朵一直竖着听剧情。' },
      { t: '先看！作业明天再说', ok: { 娱乐: 12, 心情: 6, 智力: -0.5 }, okTxt: '痛快是痛快，睡前你疯狂补作业补到眼冒金星。' },
    ],
  },
  {
    id: 'oldman', title: '赠书的老者', min: 5, max: 18, weight: 0.4,
    text: '路边摆摊的老者叫住你：「娃娃，看你面相，是个读书的料。这本书送你，不要钱。」书很旧，扉页上还有前人批注。',
    choices: [
      { t: '双手接过，道谢', ok: { 智力: 2.5, buff: { name: '灵感迸发', desc: '一本好书在手，学什么都事半功倍。', slots: 8, gainMul: 1.5 }, mem: '一位陌生的老者送过你一本书。你到现在还想不通他为什么选中你。' } },
      { t: '警惕地走开', ok: { 心情: 1 } },
    ],
  },
  {
    id: 'cook-help', title: '灶台边的学问', min: 5, max: 14,
    cond: (s) => s.location === 'home',
    text: '厨房里热气腾腾。大人忙着做饭，见你在旁边张望，笑道：「想学学？来，搭把手。」',
    choices: [
      { t: '系上小围裙认真学', ok: { skill: { name: '烹饪', xp: 6 }, 心情: 6, mem: '你在灶台边学会了人生的第一道菜。' } },
      { t: '偷吃一块就跑', ok: { 饱食: 8, 心情: 5 } },
    ],
  },
  {
    id: 'luckydraw', title: '广场抽奖摊', min: 6, max: 16,
    cond: (s) => s.location === 'square' && s.money >= 2,
    text: '广场上新摆了个抽奖摊，五块钱一次，大奖是一辆崭新的自行车。摊主笑得很热情。',
    choices: [
      { t: '来一抽！', ok: {}, okTxt: chance(0.25) ? '居然真的中了三等奖——一只铁皮青蛙！你高兴了一整天。' : '谢谢惠顾。摊主收走你的五块钱，笑容更热情了。' },
      { t: '转身离开', ok: { 心情: 1 }, okTxt: '你总觉得那笑容里有什么不对劲。后来你听说好几个同学上了当。' },
    ],
  },
  {
    id: 'stargaze', title: '夏夜的星空', min: 4, max: 18, weight: 0.5,
    cond: (s) => s.slot === 5,
    text: '停电了。整栋楼安安静静，你搬着小板凳坐到院子里，抬头看见了满天星星——多得数不清。',
    choices: [
      { t: '躺着看一晚上', ok: { 心情: 12, 智力: 0.8, mem: '那个停电的夏夜，你数星星数到睡着。' } },
      { t: '回屋睡觉', ok: { 精力: 8 } },
    ],
  },
  {
    id: 'winter', title: '手心的冻疮', min: 3, max: 10,
    cond: (s) => s.familyKey === 'poor',
    text: '冬天到了，屋里比屋外暖不了多少。你的手背裂开了一道道小口子，又痒又疼。',
    choices: [
      { t: '忍一忍，帮家里干活', ok: { 体质: 1.5, 心情: 4, 健康: -3, mem: '手上的冻疮好了一个冬天，又坏了一个冬天。你没吭过声。' } },
      { t: '把手泡在热水里', ok: { 心情: 3 } },
    ],
  },
  {
    id: 'tutor', title: '家庭教师', min: 6, max: 12,
    cond: (s) => s.familyKey === 'rich',
    text: '家里请来新的家庭教师，戴着金丝眼镜：「小同学，今天我们学点有意思的。」',
    choices: [
      { t: '好好跟着学（智力提升）', ok: { 智力: 2.5, 心情: -2 }, okTxt: '私教课排得满满当当。你学得很快，也有一点点累。' },
      { t: '装病逃课', ok: { 娱乐: 10, 智力: -1 }, okTxt: '你成功骗过了老师，躲在被窝里看了一下午漫画。' },
    ],
  },
  {
    id: 'first-love', title: '一封没送出的信', min: 13, max: 17,
    text: '你写了一封信，改了十几遍，信封上的名字是你最不敢对视的那个人。信就在书包里，揉得起了毛边。',
    choices: [
      { t: '塞进对方的课桌（魅力检定）', check: { attr: '魅力', dc: 65 }, ok: { 魅力: 2, 心情: 12, mem: '那封信有了回音。多年后想起，你还会心跳加速。' }, fail: { 心情: -8 }, failTxt: '信被原封不动退了回来，附言只有两个字：「好好学习。」' },
      { t: '把信烧了', ok: { 心情: -3, mem: '你烧掉了那封信。火苗窜起来的时候，你觉得有什么也随之烧掉了，又有什么留了下来。' } },
    ],
  },
  {
    id: 'volunteer', title: '敬老院献爱心', min: 8, max: 16,
    cond: (s) => s.flags.wentSchool,
    text: '学校组织去敬老院献爱心。教室里嗡嗡的，有人兴奋，有人嫌麻烦。',
    choices: [
      { t: '积极报名，认真表演节目（魅力检定）', check: { attr: '魅力', dc: 55 }, ok: { 魅力: 2.5, 心情: 10, mem: '敬老院里，一位老奶奶拉着你的手不放，说她孙子也这么大。' }, fail: { 心情: 2 }, okTxt: '你的节目演砸了，但老人们笑得很开心，你也跟着笑。' },
      { t: '能躲则躲', ok: { 心情: -2 } },
    ],
  },
];

/* ---------------- 里程碑事件 ---------------- */
const MILESTONES = {
  3: {
    id: 'm3', title: '第一次逛公园',
    text: '三岁这天，大人牵着你第一次走进公园。你看什么都新鲜：会发光的泡泡、追着泡泡跑的小孩、还有比你高好多的大树。\n世界原来这么大。',
    choices: [
      { t: '摇摇晃晃追着泡泡跑', ok: { 体质: 1, 心情: 8, mem: '你人生中第一次逛公园，追了一下午泡泡。' } },
      { t: '紧紧牵着大人的手', ok: { 心情: 5 }, okTxt: '大人的手很大，很暖和。' },
    ],
  },
  4: {
    id: 'm4', title: '幼儿园开学',
    text: '背上新书包，你站在幼儿园门口。里面全是哭声，有的小孩死死抱着家长的腿不放。',
    choices: [
      { t: '挥挥手，头也不回地走进去', ok: { 魅力: 1.5, mem: '幼儿园开学，你没哭，老师当着全班夸了你。' } },
      { t: '哇地一声哭出来', ok: { 心情: -3, mem: '幼儿园开学那天你哭得很凶，但下午就交到了朋友。' } },
    ],
  },
  7: {
    id: 'm7', title: '成为小学生',
    text: '红领巾系在胸前，你正式成为一名小学生。校门比幼儿园气派多了，课程表密密麻麻。',
    choices: [
      { t: '暗暗下决心要当学霸', ok: { 智力: 2, flag: { ambition: true }, mem: '上小学第一天，你暗下决心要当学霸。' } },
      { t: '先交几个朋友要紧', ok: { 魅力: 2, mem: '上小学第一天，你先认识了一群死党。' } },
    ],
  },
  10: {
    id: 'm10', title: '兴趣班的选择',
    text: '学校开兴趣班了，只能选一个：绘画、乐器、武术，还是编程？这可愁坏了你。',
    choices: [
      { t: '绘画——把世界涂成想要的样子', ok: { flag: { art: '绘画' }, skill: { name: '绘画', xp: 5 }, 心情: 6, mem: '你选了绘画班，从此作业本边角全是小人儿。' } },
      { t: '乐器——琴声多帅啊', ok: { flag: { art: '乐器' }, skill: { name: '乐器', xp: 5 }, 心情: 6, mem: '你选了乐器班，手指磨出茧，吹拉弹唱样样学。' } },
      { t: '武术——再也不怕被欺负', ok: { flag: { art: '武术' }, skill: { name: '武术', xp: 5 }, 体质: 2, mem: '你选了武术班，扎马步扎到腿抖，但眼神越来越亮。' } },
      { t: '编程——电脑里有个宇宙', ok: { flag: { art: '编程' }, skill: { name: '编程', xp: 5 }, 智力: 2, mem: '你选了编程班，在一行行代码里发现了新世界。' } },
    ],
  },
  12: {
    id: 'm12', title: '小升初',
    text: '小升初考试结束了。成绩出来那天，你在家门口转了三圈才敢进屋。',
    dynamic: (s) => {
      const score = s.attrs.智力 * 0.7 + s.needs.心情 * 0.2 + rand(0, 30);
      if (score >= 68) { s.flags.goodSchool = true; return { title: '小升初 · 名列前茅', okTxt: '你考上了区里的重点初中！通知书在阳光下红得晃眼。' }; }
      return { title: '小升初 · 尘埃落定', okTxt: '你考上了家门口的普通初中。不算惊艳，但路还长着呢。' };
    },
    choices: [{ t: '收下录取通知', ok: { mem: '小升初，你考上了初中。新的操场，新的同学。' } }],
  },
  13: {
    id: 'm13', title: '变声期与青春痘',
    text: '镜子里的陌生人是谁？个子蹿得飞快，嗓音变得古怪，额头还冒出了几颗倔强的痘痘。\n大人说：这是青春期，说明你正在长大。',
    choices: [
      { t: '接受这个新的自己', ok: { 体质: 2, 心情: 5, mem: '青春期来得气势汹汹。你决定和这个新的自己好好相处。' } },
      { t: '把帽子压低，少说话', ok: { 心情: -3, mem: '那段变声的日子，你变得沉默寡言。' } },
    ],
  },
  15: {
    id: 'm15', title: '中考',
    text: '中考三天，考场上安静得能听见笔尖的沙沙声。你写完了最后一门，交卷铃响起的那一刻，心里空落落的。\n成绩揭晓：你考上了『重点高中』',
    dynamic: (s) => {
      const score = s.attrs.智力 * 0.8 + s.attrs.体质 * 0.1 + s.needs.心情 * 0.2 + rand(0, 25);
      if (score >= 78) { s.exam = '重点高中'; return { title: '中考 · 金榜题名', okTxt: '重点高中！你盯着录取通知看了很久，手都有点抖。' }; }
      if (score >= 58) { s.exam = '普通高中'; return { title: '中考 · 尘埃落定', okTxt: '普通高中。不算惊艳，但也是个新起点。' }; }
      s.exam = '职业高中'; return { title: '中考 · 另一条路', okTxt: '职业高中。爸妈安慰你说，三百六十行，行行出状元。' };
    },
    choices: [{ t: '收下录取通知书', ok: {} }],
  },
  18: {
    id: 'm18', title: '成年礼',
    text: '十八岁的清晨，你在镜子里端详了很久。\n法律上说，从今天起你是个大人了。回头看这十五年：哭过、笑过、后悔过、也骄傲过。往后的路，要自己走了。\n谢谢你，来过这一世。',
    choices: [{ t: '告别童年', ok: {} }],
    final: true,
  },
};

let milestoneQueue = [];

function checkMilestones() {
  const m = MILESTONES[S.age];
  if (m) milestoneQueue.push(m);
}

function runMilestones() {
  if (!S.alive) return;
  const m = milestoneQueue.shift();
  if (!m) {
    if (S.age >= END_AGE) { endLife('成年'); return; }
    render();
    return;
  }
  if (m.dynamic) {
    const r = m.dynamic(S);
    m.title = r.title;
    m.choices[0].okTxt = r.okTxt;
  }
  openEvent(m, true);
}

/* ---------------- 事件触发与结算 ---------------- */
function drawEvent() {
  const pool = EVENTS.filter((e) => {
    if (S.age < e.min || S.age > e.max) return false;
    if (e.cond && !e.cond(S)) return false;
    return true;
  });
  if (!pool.length) return null;
  pool.sort((a, b) => (b.weight || 1) - (a.weight || 1));
  return pick(pool);
}

function openEvent(ev, isMilestone = false) {
  eventLock = true;
  if (isMilestone) Sound.play('chime');
  $('modal-event').classList.remove('hidden');
  $('event-title').textContent = ev.title;
  $('event-text').textContent = typeof ev.text === 'function' ? ev.text(S) : ev.text;
  $('event-result').classList.add('hidden');
  const box = $('event-choices');
  box.innerHTML = '';
  box.classList.remove('hidden');
  let n = 0;
  ev.choices.forEach((c) => {
    if (c.cond && !c.cond(S)) return;
    n++;
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = c.t;
    const k = document.createElement('span');
    k.className = 'kbd';
    k.textContent = n;
    btn.appendChild(k);
    btn.onclick = () => resolveChoice(ev, c, isMilestone);
    box.appendChild(btn);
  });
  if (!box.children.length) {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = '……';
    btn.onclick = () => resolveChoice(ev, { ok: {} }, isMilestone);
    box.appendChild(btn);
  }
}

function resolveChoice(ev, c, isMilestone) {
  $('event-choices').classList.add('hidden');
  const pass = checkPass(c.check);
  const eff = pass ? c.ok : (c.fail || {});
  applyEffects(eff);
  let txt = pass ? (c.okTxt || (eff && eff.mem ? '……' : '')) : (c.failTxt || '');
  if (!txt) txt = pass ? '（什么事也没有发生。）' : '（失败了。）';
  if (!pass && c.fail && c.fail.mem) txt = c.fail.mem + '\n' + txt;
  $('event-result-text').textContent = txt;
  $('event-result').classList.remove('hidden');
  $('event-continue').onclick = () => {
    $('modal-event').classList.add('hidden');
    eventLock = false;
    if (!S.alive) return; // 结局流程会接管
    if (isMilestone) { runMilestones(); return; }
    if (ev.final || (isMilestone && ev.final)) return;
    render();
    if (S.age >= END_AGE) endLife('成年');
  };
  render();
}

/* ============================================================
 * 场景与动作
 * ============================================================ */
const ART = {
  home: `<svg viewBox="0 0 220 110" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M30 60 L110 18 L190 60"/>
    <rect x="142" y="22" width="10" height="20"/>
    <circle cx="147" cy="18" r="3"><animate attributeName="cy" values="20;4" dur="3.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.75;0" dur="3.4s" repeatCount="indefinite"/></circle>
    <circle cx="148" cy="18" r="2.2"><animate attributeName="cy" values="20;2" dur="3.4s" begin="-1.7s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.6;0" dur="3.4s" begin="-1.7s" repeatCount="indefinite"/></circle>
    <rect x="48" y="60" width="124" height="42"/>
    <rect x="96" y="74" width="26" height="28"/><rect class="win" x="60" y="70" width="18" height="16"/><rect class="win" x="144" y="70" width="18" height="16"/>
    <path d="M15 102 H205"/></svg>`,
  park: `<svg viewBox="0 0 220 110" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <g><animateTransform attributeName="transform" type="rotate" values="-2.2 40 102; 2.2 40 102; -2.2 40 102" dur="5.2s" repeatCount="indefinite"/>
      <path d="M40 102 V55"/><circle cx="40" cy="42" r="18"/></g>
    <g><animateTransform attributeName="transform" type="rotate" values="1.8 80 102; -1.8 80 102; 1.8 80 102" dur="4.3s" repeatCount="indefinite"/>
      <path d="M80 102 V65"/><circle cx="80" cy="55" r="13"/></g>
    <path d="M120 92 h50 M126 92 v-16 h38 v16"/><path d="M126 76 q19 -10 38 0"/>
    <path d="M10 102 H210"/></svg>`,
  school: `<svg viewBox="0 0 220 110" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="45" y="35" width="130" height="67"/><path d="M45 35 L110 12 L175 35"/>
    <path d="M110 12 V30"/>
    <g><animateTransform attributeName="transform" type="rotate" values="0 110 14; 5 110 14; -3 110 14; 0 110 14" dur="2.8s" repeatCount="indefinite"/>
      <path d="M110 14 l24 6 -24 7"/></g>
    <rect x="98" y="70" width="24" height="32"/>
    <rect class="win" x="60" y="50" width="16" height="14"/><rect class="win" x="144" y="50" width="16" height="14"/>
    <path d="M15 102 H205"/></svg>`,
  square: `<svg viewBox="0 0 220 110" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M30 45 h90 l-8 14 h-74 z"/><path d="M40 59 v43 M110 59 v43 M40 70 h70 M40 82 h70"/>
    <path d="M75 45 V25"/>
    <g><animateTransform attributeName="transform" type="rotate" values="-3 75 25; 3 75 25; -3 75 25" dur="3.1s" repeatCount="indefinite"/>
      <path d="M75 25 h40 l-6 10 h-34"/></g>
    <g><animateTransform attributeName="transform" type="rotate" values="-1.6 160 102; 1.6 160 102; -1.6 160 102" dur="5.6s" repeatCount="indefinite"/>
      <circle cx="160" cy="80" r="12"/><path d="M160 92 v10 M152 102 h16"/></g>
    <path d="M10 102 H210"/></svg>`,
  market: `<svg viewBox="0 0 220 110" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <g><animateTransform attributeName="transform" type="rotate" values="-1.2 100 40; 1.2 100 40; -1.2 100 40" dur="4.4s" repeatCount="indefinite"/>
      <path d="M35 40 h120 l10 16 h-140 z"/><path d="M48 40 q6 -12 12 0 q6 -12 12 0 q6 -12 12 0 q6 -12 12 0 q6 -12 12 0 q6 -12 12 0 q6 -12 12 0 q6 -12 12 0 q6 -12 12 0"/></g>
    <rect x="48" y="56" width="94" height="46"/><circle cx="70" cy="76" r="7"/><circle cx="95" cy="78" r="8"/><circle cx="120" cy="75" r="6"/>
    <path d="M10 102 H210"/></svg>`,
  hospital: `<svg viewBox="0 0 220 110" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="60" y="28" width="100" height="74"/>
    <path class="keep-accent" d="M110 40 v24 M98 52 h24" stroke="#b3382c"><animate attributeName="opacity" values="1;.4;1" dur="1.8s" repeatCount="indefinite"/></path>
    <rect class="win" x="72" y="70" width="16" height="14"/><rect class="win" x="132" y="70" width="16" height="14"/>
    <path d="M50 28 h120" stroke-dasharray="4 5"/>
    <path d="M15 102 H205"/></svg>`,
};

const SCENES = {
  home: {
    title: '家', min: 3,
    desc: () => S.home + '。灯是暖的，饭是热的。',
  },
  park: {
    title: '公园', min: 3,
    desc: () => '众生市的老公园，树比楼多，风比人闲。',
  },
  school: {
    title: '学堂', min: 4,
    desc: () => S.age <= 6 ? '幼儿园里全是蜡笔和哭声。' : S.age <= 12 ? '小学的操场，一圈是四百米，一天是六年。' : '中学的教学楼很高，高得像未来。',
  },
  square: {
    title: '广场', min: 3,
    desc: () => '众生市的广场，卖什么的都有，人来人往。',
  },
  market: {
    title: '菜市场', min: 3,
    desc: () => '吆喝声、讨价还价声、鱼腥味，热热闹闹的烟火气。',
  },
  hospital: {
    title: '医院', min: 3,
    desc: () => '白墙白褂，消毒水味。但愿少来的地方。',
  },
};

function schoolTitle() {
  return S.age <= 6 ? '幼儿园' : S.age <= 12 ? '小学' : '中学';
}

const ACTIONS = [
  /* ---- 家 ---- */
  { id: 'meal', loc: 'home', label: '吃饭', cond: () => MEAL_SLOTS.includes(S.slot), run: eatMeal },
  { id: 'sleep', loc: 'home', label: '睡觉', cond: () => true, run: sleep },
  { id: 'wash', loc: 'home', label: '洗漱', cond: () => true, run: () => { gainNeed('清洁', 42); gainNeed('心情', 2); addLog('你把自己洗得干干净净。'); } },
  { id: 'play', loc: 'home', label: '玩耍', cond: () => true, run: () => {
      const bonus = S.familyKey === 'rich' ? 6 : 0;
      gainNeed('娱乐', 26 + bonus); gainNeed('心情', 7);
      addLog(S.familyKey === 'rich' ? '你在堆成山的玩具里玩了个痛快。' : '一个旧皮球，你也能玩出百般花样。');
    } },
  { id: 'study', loc: 'home', label: '看书学习', cond: () => true, run: () => {
      let g = 1.2 * S.apt.学习;
      if (S.needs.娱乐 < 20) { g *= 0.5; addLog('一直学习有点无聊，效率不高。', 'sys'); }
      gain('智力', g); gainNeed('娱乐', -6); gainNeed('精力', -3);
      addLog('你伏案看了一会儿书。');
    } },
  { id: 'exercise', loc: 'home', label: '运动锻炼', cond: () => true, run: () => {
      gain('体质', 1.2 * S.apt.运动); gainNeed('精力', -9); gainNeed('清洁', -4);
      addLog('你活动筋骨，跑得满头大汗。');
    } },
  { id: 'chore', loc: 'home', label: '帮忙家务', cond: () => true, run: () => {
      gainNeed('心情', 3); gain('魅力', 0.4);
      if (S.familyKey === 'poor' && chance(0.5)) { gainMoney(1); addLog('你帮家里干活，大人塞给你一块钱。'); }
      else addLog('你帮忙扫了地、叠了被子。');
    } },
  { id: 'art', loc: 'home', label: () => (S.flags.art ? '练习' + S.flags.art : '画画弹琴'), cond: () => !!S.flags.art, run: () => {
      gain('魅力', 1.0 * S.apt.艺术); gainSkill(S.flags.art, 3); gainNeed('心情', 4);
      addLog(`你练习${S.flags.art}，渐入佳境。`);
    } },
  { id: 'cook', loc: 'home', label: '动手做饭', cond: () => (S.flags.ingredients || 0) > 0, run: () => {
      S.flags.ingredients--;
      gainNeed('饱食', 42); gainSkill('烹饪', 3);
      if ((S.skills.烹饪 || { lvl: 1 }).lvl >= 2 && chance(0.6)) { gainNeed('心情', 6); addLog(`你做了顿饭，全家都吃得很香。「咱家孩子手艺真好。」`); }
      else addLog('你照着印象做了顿饭，能吃，甚至有点香。');
    } },
  { id: 'chat', loc: 'home', label: '和家人聊天', cond: () => true, run: () => {
      gainNeed('心情', 9);
      if (chance(0.15)) { addBuff('被爱环绕', '家人的话熨帖了心。', 5); addLog('和家人聊了很久，心里暖烘烘的。'); }
      else addLog('你们随口聊着天，鸡毛蒜皮，也挺好。');
    } },
  /* ---- 公园 ---- */
  { id: 'walk', loc: 'park', label: '散步', cond: () => true, run: () => { gainNeed('心情', 7); gain('体质', 0.3); addLog('你在林荫道上慢慢走，影子被太阳拉得老长。'); } },
  { id: 'slide', loc: 'park', label: '滑梯秋千', cond: () => S.age <= 9, run: () => { gainNeed('娱乐', 24); gainNeed('心情', 6); addLog('滑梯、秋千、跷跷板，你玩了个遍。'); } },
  { id: 'fish', loc: 'park', label: '湖边垂钓', cond: () => S.age >= 5, run: () => {
      gainNeed('娱乐', 14); gainSkill('钓鱼', 2);
      const roll = Math.random();
      if (roll < 0.3) addLog('钓上一团水草。你把它甩回了湖里。');
      else if (roll < 0.45) { gainMoney(1); addLog('钓上一只旧皮鞋，居然抖出一枚硬币。'); }
      else if (roll < 0.8) { gainNeed('饱食', 10); addLog('钓上一条小鱼！晚上可以加餐了。'); }
      else { gainSkill('钓鱼', 4); addLog('鱼没钓到，但你把「姜太公钓鱼」理解透了。'); }
    } },
  { id: 'watch', loc: 'park', label: '观察花鸟虫鱼', cond: () => S.age <= 9, run: () => {
      gain('智力', 0.6 * S.apt.学习); gainNeed('心情', 3);
      addLog('你看蚂蚁搬家、看蜻蜓点水，一看就是半天。');
    } },
  /* ---- 学堂 ---- */
  { id: 'class', loc: 'school', label: () => '去' + schoolTitle() + '上课', cond: () => !S.flags.wentSchool && S.slot <= 3, run: goSchool },
  { id: 'skip', loc: 'school', label: '逃课', cond: () => S.age >= 7 && !S.flags.wentSchool && S.slot <= 3, run: skipSchool },
  { id: 'club', loc: 'school', label: '参加兴趣社团', cond: () => S.age >= 10 && !!S.flags.art, run: () => {
      gain('魅力', 0.8); gainSkill(S.flags.art, 3); gainNeed('娱乐', 10);
      addLog(`你在社团里练习${S.flags.art}，还认识了新朋友。`);
    } },
  /* ---- 广场 ---- */
  { id: 'book', loc: 'square', label: '书店买书', cost: 8, cond: () => S.money >= 8, run: () => {
      gainMoney(-8); gain('智力', 1.5);
      addBuff('灵感迸发', '新书在手，学什么都事半功倍。', 6, { gainMul: 1.5 });
      addLog('你在旧书店淘到一本好书，如获至宝。');
    } },
  { id: 'toy', loc: 'square', label: '玩具摊', cost: 12, cond: () => S.money >= 12, run: () => {
      gainMoney(-12); gainNeed('娱乐', 32); gainNeed('心情', 8);
      addLog('你买了个新玩具，一路都是蹦着回家的。');
    } },
  { id: 'snack', loc: 'square', label: '小吃摊', cost: 4, cond: () => S.money >= 4, run: () => {
      gainMoney(-4); gainNeed('饱食', 26); gainNeed('心情', 4);
      addLog('一串糖葫芦下肚，甜到了心里。');
    } },
  { id: 'artist', loc: 'square', label: '看街头艺人', cond: () => true, run: () => { gainNeed('娱乐', 14); gainNeed('心情', 4); addLog('街头艺人翻着跟头，你看得津津有味。'); } },
  { id: 'chess', loc: 'square', label: '棋摊看棋', cond: () => S.age >= 6, run: () => { gain('智力', 0.8); gainNeed('娱乐', 6); addLog('你在棋摊边看了两盘，似懂非懂。'); } },
  /* ---- 菜市场 ---- */
  { id: 'veg', loc: 'market', label: '买菜', cost: 3, cond: () => S.money >= 3, run: () => {
      gainMoney(-3); S.flags.ingredients = (S.flags.ingredients || 0) + 1;
      gainSkill('烹饪', 1);
      addLog('你买了些菜，掂在手里沉甸甸的。回家可以做饭了。');
    } },
  { id: 'deli', loc: 'market', label: '熟食铺', cost: 6, cond: () => S.money >= 6, run: () => {
      gainMoney(-6); gainNeed('饱食', 44); gainNeed('心情', 3);
      addLog('错过了饭点，熟食铺的烧鸡救了你一命。');
    } },
  { id: 'carry', loc: 'market', label: '帮摊主搬货', cond: () => S.age >= 7, run: () => {
      gain('体质', 0.5); gain('魅力', 0.5);
      if (chance(0.5)) { gainMoney(1); addLog('你帮摊主搬了几筐菜，摊主硬塞给你一块钱。'); }
      else addLog('你帮摊主搬货，摊主夸你力气大。');
    } },
  /* ---- 医院 ---- */
  { id: 'cure', loc: 'hospital', label: '看病', cost: 10, cond: () => S.money >= 10, run: () => {
      gainMoney(-10); gainHealth(38);
      S.buffs = S.buffs.filter((b) => !['感冒', '营养不良'].includes(b.name));
      addLog('医生开了药，叮嘱你按时吃饭睡觉。');
    } },
  { id: 'checkup', loc: 'hospital', label: '健康体检', cond: () => S.flags.checkupAge !== S.age, run: () => {
      S.flags.checkupAge = S.age; gainHealth(5);
      const best = APT_ORDER.reduce((a, b) => (S.apt[a] > S.apt[b] ? a : b));
      addLog(`体检结果：各项指标正常。医生说你${best === '学习' ? '脑子灵' : best === '运动' ? '体格棒' : '有艺术细胞'}，是块好料子。`);
    } },
];

/* ============================================================
 * 渲染
 * ============================================================ */
function setBar(id, v) { $(id).style.width = clamp(v, 0, 100) + '%'; }

function render() {
  if (!S) return;
  // 顶栏
  $('ui-name').textContent = `${S.name}（${S.gender}）`;
  $('ui-age').textContent = `${S.age} 岁`;
  $('ui-family-badge').textContent = S.family.name + ' · ' + S.home;
  $('ui-day').textContent = `第 ${S.day} 天`;
  $('ui-slot').textContent = SLOTS[S.slot] + (MEAL_SLOTS.includes(S.slot) ? ' · 饭点' : '');
  $('ui-money').textContent = `零花钱 ¥${S.money}`;
  // 时段光影
  const stage = $('scene-stage');
  for (let i = 0; i <= 5; i++) stage.classList.remove('slot-' + i);
  stage.classList.add('slot-' + S.slot);
  // 属性
  ['体质', '智力', '魅力'].forEach((k) => {
    setBar('bar-' + k, S.attrs[k]);
    $('num-' + k).textContent = Math.round(S.attrs[k]);
  });
  // 天赋
  $('ui-aptitudes').innerHTML = APT_ORDER.map((k) =>
    `<div title="${k}天赋 ×${S.apt[k].toFixed(2)} · ${APT_TIP[k]}"><span>${k}</span><span>${APT_LABEL(S.apt[k])}</span></div>`).join('');
  // 技艺
  const sk = Object.entries(S.skills);
  $('ui-skills').innerHTML = sk.length
    ? sk.map(([n, v]) => `<span class="tag" title="等级 ${v.lvl} · 经验 ${v.xp}/${v.lvl * 10}">${n} ${'★'.repeat(v.lvl)}</span>`).join('')
    : '<span class="dim">尚无</span>';
  // 状态
  $('ui-buffs').innerHTML = S.buffs.length
    ? S.buffs.map((b) => `<span class="tag bad" title="${b.desc}">${b.name}</span>`).join('')
    : '<span class="dim">平常</span>';
  // 需求 + 低位预警
  ['饱食', '精力', '清洁', '娱乐', '心情', '健康'].forEach((k) => {
    setBar('need-' + k, S.needs[k]);
    const bar = $('need-' + k);
    const row = bar && bar.parentNode;
    if (row && row.classList) {
      if (S.needs[k] < 25) row.classList.add('low'); else row.classList.remove('low');
    }
  });
  // 小人精神状态
  const actor = $('actor');
  const weak = S.needs.精力 < 25 || S.needs.健康 < 30;
  if (weak) actor.classList.add('weak'); else actor.classList.remove('weak');
  if (!weak && S.needs.心情 >= 80) actor.classList.add('happy'); else actor.classList.remove('happy');
  // 地点导航
  const nav = $('locations');
  nav.innerHTML = '';
  Object.entries(SCENES).forEach(([id, sc]) => {
    const locked = S.age < sc.min;
    const btn = document.createElement('button');
    btn.className = 'loc-btn' + (S.location === id ? ' active' : '');
    btn.textContent = id === 'school' ? schoolTitle() : sc.title;
    btn.disabled = locked;
    btn.title = locked ? `${sc.min} 岁解锁` : '← → 方向键切换地点';
    btn.onclick = () => switchLocation(id);
    nav.appendChild(btn);
  });
  // 场景
  $('scene-art').innerHTML = ART[S.location];
  $('scene-title').textContent = S.location === 'school' ? schoolTitle() : SCENES[S.location].title;
  $('scene-desc').textContent = SCENES[S.location].desc();
  // 动作
  const box = $('actions');
  box.innerHTML = '';
  let n = 0;
  ACTIONS.filter((a) => a.loc === S.location).forEach((a) => {
    if (a.cond && !a.cond()) return;
    n++;
    const btn = document.createElement('button');
    btn.className = 'act-btn';
    const label = typeof a.label === 'function' ? a.label() : a.label;
    btn.innerHTML = (a.cost ? `${label} <span class="cost ${S.money < a.cost ? 'no' : ''}">¥${a.cost}</span>` : label) +
      (n <= 9 ? `<span class="kbd">${n}</span>` : '');
    btn.onclick = () => {
      Sound.play('pop');
      btn.classList.add('clicked');
      setTimeout(() => btn.classList.remove('clicked'), 320);
      doAction(a.run, ACT_ANIM[a.id] || 'stand');
    };
    box.appendChild(btn);
  });
  // 日志
  $('log').innerHTML = S.log.map((l) =>
    `<p class="${l.cls || ''}">【${l.age}岁·${l.day}日】${l.text}</p>`).join('');
  // 数值飘字
  flushFx();
}

/* ============================================================
 * 结局与往生录
 * ============================================================ */
function dominantAttr() {
  return Object.entries(S.attrs).sort((a, b) => b[1] - a[1])[0][0];
}

function shortVerdict() {
  const d = dominantAttr();
  const head = { 体质: '筋骨强健', 智力: '敏而好学', 魅力: '人见人爱' }[d];
  const tail = { poor: '，寒门走出一条路', middle: '，平安喜乐', rich: '，锦衣玉食亦知忧' }[S.familyKey];
  const exam = S.exam ? (S.exam === '重点高中' ? '，金榜题名' : S.exam === '普通高中' ? '，平平顺顺' : '，另辟蹊径') : '';
  return head + tail + exam;
}

function buildVerdict(cause) {
  if (cause === '夭') {
    return `${S.name}，${S.family.name}的孩子。\n${S.age} 岁那年，这一世提前谢幕了。\n人生无常，像一盒没吃完就化掉的巧克力。\n\n——愿来生，被世界温柔以待。`;
  }
  const lines = [];
  lines.push(`${S.name}，${S.family.name}的孩子，在${S.home}长到 ${S.age} 岁。`);
  const sorted = Object.entries(S.attrs).sort((a, b) => b[1] - a[1]);
  const praise = { 体质: '你体格结实，跑得比风快。', 智力: '你脑子灵光，书本一翻就懂。', 魅力: '你走到哪儿都招人喜欢。' }[sorted[0][0]];
  const weak = { 体质: '体质是短板，你常羡慕跑得快的同学。', 智力: '念书于你有些吃力，但你从没放弃。', 魅力: '你沉默寡言，像墙角一株安静的植物。' }[sorted[2][0]];
  lines.push(praise + weak);
  if (S.exam) lines.push(`中考那年，你考上了${S.exam}。`);
  const sks = Object.entries(S.skills);
  if (sks.length) lines.push(`这些年你学会了：${sks.map(([n, v]) => `${n}（${v.lvl}级）`).join('、')}。`);
  const happy = Math.round(S.happinessSum / S.happinessCnt);
  lines.push(happy >= 60 ? `大多数日子里，你是笑着的。（幸福均值 ${happy}）` : `这一路你常常心事重重。（幸福均值 ${happy}）`);
  lines.push(`这一生你经历了 ${S.memories.length} 件忘不了的事。`);
  lines.push('\n人生是一盒巧克力，你永远不知道下一颗什么味道。');
  lines.push('这一颗，你尝过了。');
  return lines.join('\n');
}

function loadMemorials() {
  try { return JSON.parse(localStorage.getItem(MEMORIAL_KEY)) || []; } catch (e) { return []; }
}
function saveMemorial(entry) {
  const list = loadMemorials();
  list.unshift(entry);
  try { localStorage.setItem(MEMORIAL_KEY, JSON.stringify(list.slice(0, 30))); } catch (e) { /* 忽略 */ }
}

function endLife(cause) {
  if (!S || !S.alive) return;
  S.alive = false;
  eventLock = false;
  Sound.play('bell');
  const verdict = buildVerdict(cause);
  saveMemorial({
    name: S.name, gender: S.gender, family: S.family.name,
    age: S.age, days: S.day, verdict: shortVerdict(), cause,
    when: new Date().toLocaleDateString('zh-CN'),
  });
  $('screen-game').classList.add('hidden');
  $('modal-event').classList.add('hidden');
  $('screen-end').classList.remove('hidden');
  $('end-title').textContent = cause === '夭' ? '提 前 谢 幕' : '落 幕 · 成 年';
  $('end-verdict').textContent = verdict;
  $('end-stats').innerHTML = ['体质', '智力', '魅力']
    .map((k) => `<span class="tag">${k} ${Math.round(S.attrs[k])}</span>`).join('') +
    `<span class="tag">幸福 ${Math.round(S.happinessSum / S.happinessCnt)}</span>` +
    `<span class="tag">在世 ${S.day} 天</span>` +
    (S.exam ? `<span class="tag">${S.exam}</span>` : '');
  renderLifeScroll(cause);
  const mems = S.memories.slice(-6);
  $('end-memories').innerHTML = '<h3>忘不了的事</h3>' + (mems.length
    ? mems.map((m) => `<p>${m.age} 岁：${m.text}</p>`).join('')
    : '<p class="dim">平平淡淡，也是一生。</p>');
}

/* ============================================================
 * 界面流程
 * ============================================================ */
function startLife() {
  newLife();
  milestoneQueue = [];
  checkMilestones();
  Sound.play('page');
  $('screen-start').classList.add('hidden');
  $('screen-end').classList.add('hidden');
  $('screen-game').classList.remove('hidden');
  render();
  runMilestones();
}

function renderMemorials() {
  const list = loadMemorials();
  $('memorial-list').innerHTML = list.length
    ? list.map((m) => `<div class="mem-item"><span class="mem-name">${m.name}</span>（${m.gender} · ${m.family}）<br>
        ${m.cause === '夭' ? `${m.age} 岁早夭` : `平安长到 ${m.age} 岁`} · ${m.verdict} <span class="dim">${m.when}</span></div>`).join('')
    : '<div class="empty">往生录还是空白。<br>去活一世吧。</div>';
}

/* ---------------- 键盘操作 ---------------- */
window.addEventListener('keydown', (e) => {
  if (!S) return;
  if ($('screen-game').classList.contains('hidden')) return;
  if (!$('modal-memorial').classList.contains('hidden')) return;
  // 事件弹窗：数字键选选项，回车/空格继续
  if (!$('modal-event').classList.contains('hidden')) {
    if (/^[1-9]$/.test(e.key)) {
      const box = $('event-choices');
      const btn = box.children[+e.key - 1];
      if (btn && !box.classList.contains('hidden') && typeof btn.click === 'function') btn.click();
    } else if ((e.key === 'Enter' || e.key === ' ') && !$('event-result').classList.contains('hidden')) {
      e.preventDefault();
      const c = $('event-continue');
      if (typeof c.click === 'function') c.click();
    }
    return;
  }
  if (eventLock || !S.alive) return;
  if (/^[1-9]$/.test(e.key)) {
    const btn = $('actions').children[+e.key - 1];
    if (btn && typeof btn.click === 'function') btn.click();
  } else if (e.key === 'ArrowLeft') { e.preventDefault(); cycleLoc(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); cycleLoc(1); }
});

window.addEventListener('DOMContentLoaded', () => {
  Sound.init();
  const sb = $('btn-sound');
  sb.textContent = Sound.muted ? '🔇' : '🔊';
  sb.onclick = () => {
    const m = Sound.toggle();
    sb.textContent = m ? '🔇' : '🔊';
    if (!m) Sound.play('pop');
  };
  $('btn-born').onclick = startLife;
  $('btn-reborn').onclick = startLife;
  $('btn-to-title').onclick = () => {
    $('screen-end').classList.add('hidden');
    $('screen-start').classList.remove('hidden');
  };
  $('btn-memorial').onclick = () => { renderMemorials(); $('modal-memorial').classList.remove('hidden'); };
  $('btn-memorial-close').onclick = () => $('modal-memorial').classList.add('hidden');
});

/* ============================================================
 * 结局 · 人生长卷：小人从 3 岁走到谢幕，沿途挂满记忆
 * ============================================================ */
const ACTOR_INNER = `
  <g class="pose pose-stand"><g class="whole">
    <circle cx="30" cy="14" r="7"/>
    <path d="M30 21 V46"/>
    <path d="M30 27 L20 38 M30 27 L40 38"/>
    <path class="leg-l" d="M30 46 L23 66"/>
    <path class="leg-r" d="M30 46 L37 66"/>
  </g></g>
  <g class="pose pose-lie"><g class="whole">
    <circle cx="15" cy="58" r="7"/>
    <path d="M22 58 H46"/>
    <path d="M28 54 L36 47"/>
    <path d="M46 58 L56 53 M46 58 L56 61"/>
  </g></g>`;

function renderLifeScroll(cause) {
  const box = $('end-scroll');
  if (!box) return;
  const startAge = START_AGE;
  const endAge = Math.max(startAge + 1, S.age);
  const span = endAge - startAge;
  const yearW = 92;                       // 每一岁的卷面宽度
  const innerW = span * yearW + 140;
  // 记忆按年龄归组
  const byAge = {};
  S.memories.forEach((m) => { (byAge[m.age] = byAge[m.age] || []).push(m.text); });
  const xOf = (a) => 60 + (a - startAge) * yearW;
  let html = `<div class="scroll-inner" style="width:${innerW}px">`;
  html += '<div class="scroll-ground"></div>';
  // 岁数刻度
  for (let a = startAge; a <= endAge; a++) {
    html += `<div class="scroll-tick" style="left:${xOf(a)}px"><i></i><span>${a} 岁</span></div>`;
  }
  // 记忆节点（悬停展开）
  Object.keys(byAge).sort((a, b) => a - b).forEach((age) => {
    const texts = byAge[age];
    html += `<div class="scroll-node" style="left:${xOf(age)}px">` +
      `<div class="mem-tip">${texts.map((t) => `<p>${age} 岁：${t}</p>`).join('')}</div>` +
      `<i class="dot"></i>${texts.length > 1 ? `<b>${texts.length}</b>` : ''}</div>`;
  });
  // 终点：成年旗 / 早夭花
  html += `<div class="scroll-flag${cause === '夭' ? ' die' : ''}" style="left:${xOf(endAge)}px">${cause === '夭' ? '✿' : '⚑'}</div>`;
  // 行走的小人
  const walkW = xOf(endAge) - 60;
  const dur = Math.max(2.5, Math.min(14, span * 0.9));
  html += `<div class="scroll-walker" style="--walk-w:${walkW}px;animation-duration:${dur}s">` +
    `<svg viewBox="0 0 60 80" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${ACTOR_INNER}</svg></div>`;
  box.innerHTML = html;
  // 卷面自动跟随小人的脚步
  if (typeof box.clientWidth === 'number' && innerW > box.clientWidth && 'scrollLeft' in box) {
    const maxScroll = innerW - box.clientWidth;
    const t0 = Date.now();
    const timer = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / (dur * 1000));
      box.scrollLeft = maxScroll * p;
      if (p >= 1) clearInterval(timer);
    }, 60);
  }
  if (cause === '夭') {
    setTimeout(() => {
      const w = box.querySelector ? box.querySelector('.scroll-walker') : null;
      if (w) w.classList.add('fallen');
    }, dur * 1000 + 200);
  }
}
