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
  // iOS 解锁：必须在用户手势调用栈里 resume，并真实播放一帧静音
  unlock() {
    this.ensure();
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      const buf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
    } catch (e) { /* 忽略 */ }
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
      if (this.ctx.state === 'suspended') { this.ctx.resume().catch(() => {}); return; } // 未解锁：丢弃这一声
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
let barFlash = {};             // 条闪烁方向记录（仅玩家行动触发，衰减不闪）
function fx(key, v) {
  if (fxQuiet || !v || Math.abs(v) < 0.05) return;
  fxQueue.push({ key, v });
  barFlash[fxAnchorId(key)] = v > 0 ? 'up' : 'down';
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

/* ---------------- 幽灵条：悬停行动按钮预览身心变化（无数字，只看影子） ---------------- */
function showHint(hint) {
  clearHints();
  if (!S || !hint) return;
  Object.entries(hint).forEach(([k, dv]) => {
    if (!dv) return;
    const fill = $('need-' + k);
    if (!fill || !fill.parentNode || !fill.parentNode.appendChild) return;
    const cur = clamp(S.needs[k], 0, 100);
    const nxt = clamp(cur + dv, 0, 100);
    if (Math.abs(nxt - cur) < 1) return;
    const g = document.createElement('div');
    g.className = 'bar-ghost ' + (dv > 0 ? 'up' : 'down');
    g.style.left = Math.min(cur, nxt) + '%';
    g.style.width = Math.abs(nxt - cur) + '%';
    fill.parentNode.appendChild(g);
  });
}
function clearHints() {
  if (typeof document.querySelectorAll !== 'function') return;
  document.querySelectorAll('.bar-ghost').forEach((e) => { if (e.parentNode) e.parentNode.removeChild(e); });
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
const ANIM_CLASSES = ['anim-walk', 'anim-run', 'anim-jump', 'anim-stand', 'anim-sit', 'anim-eat', 'anim-sleep', 'anim-startle', 'anim-celebrate', 'anim-trip'];
const PROP_CLASSES = ['p-rod', 'p-book', 'p-notes', 'p-easel', 'p-steam', 'p-bubble'];
function actorAnim(name, prop) {
  const a = $('actor');
  if (!a || !a.classList) return;
  a.classList.remove('ps-sit', 'ps-lie');
  if (name === 'sit' || name === 'eat') a.classList.add('ps-sit');
  if (name === 'sleep') a.classList.add('ps-lie');
  ANIM_CLASSES.forEach((c) => a.classList.remove(c));
  PROP_CLASSES.forEach((c) => a.classList.remove(c));
  a.classList.add('anim-' + name);
  if (prop) a.classList.add('p-' + prop);
  clearTimeout(actorAnim._t);
  actorAnim._t = setTimeout(() => {
    a.classList.remove('anim-' + name);
    a.classList.remove('ps-sit', 'ps-lie');
    PROP_CLASSES.forEach((c) => a.classList.remove(c));
  }, name === 'sleep' ? 1500 : 950);
}

/* 动作 → 手中道具 */
function propFor(id) {
  if (id === 'fish') return 'rod';
  if (id === 'study' || id === 'book') return 'book';
  if (id === 'art') return S.flags.art === '乐器' ? 'notes' : S.flags.art === '绘画' ? 'easel' : 'book';
  if (id === 'cook' || id === 'meal') return 'steam';
  if (id === 'chat') return 'bubble';
  return null;
}

/* ---------------- 小人走位：行动时走到场景对应位置 ----------------
 * 站位用场景坐标（viewBox 宽 220），渲染时按 SVG 实际位置换算成舞台 %，
 * 保证任何窗口宽度下小人都能真正走到家门口 / 湖边 / 摊位前 */
const ACTOR_HOME_X = 30;
const ACTOR_SPOT = {
  home:     { sleep: 106, meal: 100, wash: 22, play: 66, study: 110, exercise: 36, chore: 82, art: 118, cook: 102, chat: 90 },
  park:     { walk: 112, slide: 142, fish: 172, watch: 72 },
  school:   { class: 110, skip: 32, club: 114 },
  square:   { book: 66, toy: 92, snack: 58, artist: 116, chess: 152 },
  market:   { veg: 92, deli: 124, carry: 52 },
  hospital: { cure: 110, checkup: 94 },
};
function actorGo(actId) {
  const spot = actId && S && ACTOR_SPOT[S.location] ? ACTOR_SPOT[S.location][actId] : null;
  const x = spot != null ? spot : ACTOR_HOME_X;
  let left = '15%';
  const stage = $('scene-stage');
  const svg = stage && stage.querySelector ? stage.querySelector('.lyr-mid svg') : null;
  const actorEl = $('actor');
  if (stage && svg && stage.getBoundingClientRect) {
    const sr = stage.getBoundingClientRect();
    const vr = svg.getBoundingClientRect();
    if (sr.width && vr.width) {
      const aw = (actorEl && actorEl.offsetWidth) || 52;
      const px = vr.left - sr.left + (x / 220) * vr.width - aw / 2;
      left = (px / sr.width * 100).toFixed(2) + '%';
    }
  }
  ['actor', 'actor-fx'].forEach((id) => {
    const el = $(id);
    if (el && el.style) el.style.left = left;
  });
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
    setTimeout(() => { stage.classList.remove('swap-in'); t.classList.remove('pop'); }, 520);
  }, 280);
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
const SAVE_KEY = 'fusheng_save_v1';     // 这一世活着就一直在，落幕即清除

const FAMILY = {
  poor:   { name: '贫寒之家', badge: '贫', home: ['一间漏风的平房', '筒子楼里的一居室'],
            meal: 38, allowance: 3,  meals: ['咸菜配白粥', '清汤寡水的面条', '残羹剩饭'] },
  middle: { name: '小康之家', badge: '康', home: ['两层小独栋', '方便的电梯公寓'],
            meal: 52, allowance: 12, meals: ['荤素搭配的家常菜', '热腾腾的三菜一汤', '妈妈拿手的红烧肉'] },
  rich:   { name: '富贵之家', badge: '富', home: ['带庭院的四合院', '临湖的三层小楼'],
            meal: 66, allowance: 45, meals: ['精心搭配的一桌菜', '时令鲜蔬与好汤', '妈妈点的一桌好菜'] },
};
const FAMILY_KEYS = ['poor', 'poor', 'middle', 'middle', 'middle', 'rich']; // 概率

const SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '林', '何', '郭'];
const NAMES_M = ['志强', '建国', '小明', '子轩', '浩然', '铁蛋', '阿福', '一鸣', '念安', '知远', '石头', '晨光'];
const NAMES_F = ['秀英', '桂芳', '小雨', '诗涵', '欣怡', '望舒', '春花', '静姝', '晚晴', '念慈', '燕子', '繁星'];

const APT_LABEL = (v) => v < 0.85 ? '鲁钝' : v < 1.0 ? '平平' : v < 1.15 ? '出众' : '天资';
const APT_ORDER = ['学习', '运动', '艺术'];
const APT_TIP = { 学习: '影响看书与上课的智力收益', 运动: '影响锻炼与运动的体质收益', 艺术: '影响艺术练习的魅力收益' };

/* ---------------- 心愿 ---------------- */
const DREAMS = {
  science: { name: '科学家', attr: '智力' },
  sports:  { name: '运动员', attr: '体质' },
  art:     { name: '艺术家', attr: '魅力' },
  food:    { name: '美食家', skill: '烹饪' },
  money:   { name: '有钱人' },
};
const DREAM_OKTXT = '说出来的那一刻，连你自己都吓了一跳。原来，这就是愿望。\n从那以后，朝着这个方向的每一分努力，都格外有劲。（对应成长 +10%）';

function dreamFulfilled() {
  const d = S.flags.dream;
  if (!d) return false;
  const skillLvl = (n) => (S.skills[n] || { lvl: 0 }).lvl;
  switch (d) {
    case 'science': return S.attrs.智力 >= 75 || S.exam === '重点高中';
    case 'sports':  return S.attrs.体质 >= 75;
    case 'art':     return S.attrs.魅力 >= 70 || (S.flags.art && skillLvl(S.flags.art) >= 4);
    case 'food':    return skillLvl('烹饪') >= 4;
    case 'money':   return S.money >= 120;
  }
  return false;
}

/* ---------------- 人生图鉴 ---------------- */
const ALL_TAGS = {
  '天不假年': '在成年之前谢幕',
  '金榜题名': '中考考上重点高中',
  '按部就班': '考上普通高中，平稳落地',
  '另辟蹊径': '走进职业高中，换一条赛道',
  '心想事成': '实现八岁那年许下的心愿',
  '寒门贵子': '贫寒之家走出重点高中生',
  '无忧无虑': '富贵之家，幸福均值 65 以上',
  '快乐童年': '幸福均值 70 以上的一生',
  '心事重重': '幸福均值不足 55 的一生',
  '身怀绝技': '任一技艺练到 5 级',
  '文武双全': '体质与智力都达到 75',
  '小有积蓄': '成年时攒下 120 元',
  '知寒知暖': '贫寒之家暗线：焐热过妈妈的手，也读懂了它',
  '灯火可亲': '小康之家暗线：看懂了饭桌规矩与自行车后座的爱',
  '锦衣知暖': '富贵之家暗线：等到了那顿推掉应酬的生日饭',
  '莫逆之交': '走完一世的羁绊约定',
  '年少欢喜': '把那段懵懂心事，走成了约定',
  '水墨传人': '绘画专精 · 师从国画老先生',
  '同人画手': '绘画专精 · 班级同人志的传说',
  '黑白键上': '乐器专精 · 钢琴考级之路',
  '操场歌手': '乐器专精 · 一把吉他唱三年',
  '竞赛少年': '编程专精 · 奥赛榜上有名',
  '独立开发者': '编程专精 · 做出过自己的小游戏',
  '擂台新秀': '武术专精 · 散打市级选手',
  '以柔克刚': '武术专精 · 太极晨练的接班人',
};

/* ---------------- 专精分岔：4 门技艺在 3 级时选择方向 ---------------- */
const SPEC_SKILLS = { 绘画: 1, 乐器: 1, 武术: 1, 编程: 1 };
const SPEC_TAGS = {
  绘画: { 国画: '水墨传人', 漫画: '同人画手' },
  乐器: { 钢琴: '黑白键上', 吉他: '操场歌手' },
  编程: { 奥赛: '竞赛少年', 游戏: '独立开发者' },
  武术: { 散打: '擂台新秀', 太极: '以柔克刚' },
};
function computeTags(cause) {
  const tags = [];
  const happy = Math.round(S.happinessSum / S.happinessCnt);
  if (cause === '夭') tags.push('天不假年');
  if (S.exam === '重点高中') tags.push('金榜题名');
  if (S.exam === '普通高中') tags.push('按部就班');
  if (S.exam === '职业高中') tags.push('另辟蹊径');
  if (dreamFulfilled()) tags.push('心想事成');
  if (S.familyKey === 'poor' && S.exam === '重点高中') tags.push('寒门贵子');
  if (S.familyKey === 'rich' && happy >= 65) tags.push('无忧无虑');
  if (happy >= 70) tags.push('快乐童年');
  if (happy < 55) tags.push('心事重重');
  if (Object.values(S.skills).some((s) => s.lvl >= 5)) tags.push('身怀绝技');
  if (S.attrs.体质 >= 75 && S.attrs.智力 >= 75) tags.push('文武双全');
  if (S.money >= 120) tags.push('小有积蓄');
  if (S.flags.arcDone === 'poor') tags.push('知寒知暖');
  if (S.flags.arcDone === 'middle') tags.push('灯火可亲');
  if (S.flags.arcDone === 'rich') tags.push('锦衣知暖');
  if (S.flags.bondDone) tags.push('莫逆之交');
  if (S.flags.crushDone) tags.push('年少欢喜');
  Object.keys(SPEC_TAGS).forEach((n) => {
    const dir = S.flags['spec_' + n];
    if (dir && SPEC_TAGS[n][dir]) tags.push(SPEC_TAGS[n][dir]);
  });
  return tags;
}

/* ---------------- 状态 ---------------- */
let S = null;          // 当前人生
let eventLock = false; // 弹窗打开时锁定操作
let currentEventId = null; // 当前打开的事件（存档用）

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
    flags: { wentSchool: false, skipped: 0, intro: false, dream: null,
             bond: pick(['pang', 'transfer', 'sis', 'chess']) },
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
  // 心愿加成：朝着梦想方向的努力 +10%
  const da = S.flags.dream && DREAMS[S.flags.dream] && DREAMS[S.flags.dream].attr;
  const dreamMul = (da === attr && v > 0) ? 1.1 : 1;
  // 软上限：50 以上成长逐渐放缓，85 以上几乎停滞（让高分需要经营）
  const soft = v > 0 ? clamp(1 - Math.max(0, S.attrs[attr] - 50) / 35, 0.05, 1) : 1;
  const before = S.attrs[attr];
  S.attrs[attr] = clamp(round1(S.attrs[attr] + v * mul * dreamMul * soft), 1, 100);
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
  const before = sk.lvl;
  sk.xp += xp;
  while (sk.xp >= sk.lvl * 10 && sk.lvl < 9) { sk.xp -= sk.lvl * 10; sk.lvl++; addLog(`你的「${name}」升到了 ${sk.lvl} 级。`, 'sys'); }
  // 专精分岔（3 级）与出师礼（5 级）：跨级瞬间保底弹出专属事件
  if (before < 3 && sk.lvl >= 3 && SPEC_SKILLS[name] && !S.flags['spec_' + name] && !S.flags['seen:spec-' + name]) {
    const ev = EVENTS.find((e) => e.id === 'spec-' + name);
    if (ev) milestoneQueue.push(ev);
  }
  if (before < 5 && sk.lvl >= 5 && !S.flags['master:' + name] && !S.flags['seen:master-' + name]) {
    const ev = EVENTS.find((e) => e.id === 'master-' + name);
    if (ev) milestoneQueue.push(ev);
  }
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
  // 心情向其他需求的均值缓慢靠拢（中枢略低于均值，快乐需要经营）
  const avg = (S.needs.饱食 + S.needs.精力 + S.needs.清洁 + S.needs.娱乐) / 4;
  gainNeed('心情', (avg - 6 - S.needs.心情) * 0.18);
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
  // 生日里程碑优先弹出
  if (milestoneQueue.length) { runMilestones(); return; }
  // 随机事件
  if (S.eventCooldown > 0) S.eventCooldown--;
  else if (S.age < END_AGE && chance(0.085)) {
    const ev = drawEvent();
    if (ev) { S.eventCooldown = 5; openEvent(ev); return; }
  }
  if (S.age >= END_AGE) { endLife('成年'); return; }
}

/* ---------------- 动作结算 ---------------- */
function doAction(fn, anim, actId) {
  if (eventLock || !S || !S.alive) return;
  Sound.play('scratch');
  actorGo(actId);
  if (anim) {
    let prop = actId ? propFor(actId) : null;
    if (actId === 'art' && S.flags.art === '武术') { anim = 'jump'; prop = null; }
    actorAnim(anim, prop);
  }
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
    id: 'cat', maxLife: 2, title: '巷口的流浪猫', min: 3, max: 9,
    text: '放学路上，一只瘦巴巴的流浪猫冲你喵喵叫，尾巴尖都秃了。',
    choices: [
      { t: '省下早饭钱给它买火腿肠', cond: (s) => s.money >= 1, ok: { money: -1, 心情: 10, 魅力: 1, mem: '你喂过一只秃尾巴的流浪猫，它蹭了蹭你的裤脚。' }, failTxt: '你摸摸口袋，空空如也。只能冲它抱歉地笑笑。' },
      { t: '蹲下来摸摸它的头', ok: { 心情: 6, 魅力: 0.6 } },
      { t: '绕开走', ok: { 心情: -3 }, okTxt: '你走了，身后还有细细的叫声。你有点不是滋味。' },
    ],
  },
  {
    id: 'fight', maxLife: 2, title: '胡同里的架', min: 5, max: 13,
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
    id: 'money', maxLife: 2, title: '地上的十块钱', min: 4, max: 15,
    text: '人来人往的路口，一张十块钱静静躺在地上，像在对谁使眼色。',
    choices: [
      { t: '捡起来交给警察叔叔', ok: { 心情: 6, 魅力: 1.5, mem: '你把捡到的钱交给了警察叔叔，得到了一面小红旗。' } },
      { t: '四下无人，装进口袋', ok: { money: 10, 心情: 2 }, okTxt: '钱到手了，心跳得有点快。' },
      { t: '踢到一边，不看不碰', ok: { 心情: 1 } },
    ],
  },
  {
    id: 'guest', maxLife: 2, title: '家里来客人了', min: 3, max: 14,
    cond: (s) => s.location === 'home',
    text: '门铃响了，是爸妈的老朋友，拎着大包小包。满屋子的大人笑声让你有点无措。',
    choices: [
      { t: '大方地打招呼、端茶倒水（魅力检定）', check: { attr: '魅力', dc: 55 }, ok: { 魅力: 2, 心情: 6, mem: '亲戚们夸你「这孩子真懂事」，你偷偷挺直了腰。' }, fail: { 心情: -3 }, failTxt: '你紧张得打翻了茶杯，脸红到了耳根。' },
      { t: '躲回自己房间', ok: { 心情: 2, 娱乐: 4 }, okTxt: '你躲进房间，世界安静了。' },
    ],
  },
  {
    id: 'needle', maxLife: 2, title: '打预防针', min: 3, max: 8,
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
      { t: '练家子，直接放倒（武术傍身）', cond: (s) => (s.skills.武术 || { lvl: 0 }).lvl >= 3, ok: { 体质: 2, 魅力: 2, 心情: 10, mem: '练过的身手派上了用场。从那以后，巷口没人再拦你。' }, okTxt: '三下五除二，对面落荒而逃。你拍拍手，像做了件小事。' },
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
    id: 'rain', maxLife: 2, title: '突如其来的雨', min: 3, max: 18,
    cond: (s) => s.location !== 'home' && s.slot <= 4, // 只在户外、白天遇雨
    weight: 0.6,
    text: '天空毫无预兆地塌下一场大雨，豆大的雨点砸得地面冒烟。',
    choices: [
      { t: '在屋檐下躲雨，看雨发呆', ok: { 心情: 6, 娱乐: 4, mem: '一场豪雨把你困在屋檐下，你第一次发现雨声这么好听。' } },
      { t: '冒雨跑回家（体质检定）', check: { attr: '体质', dc: 52 }, ok: { 体质: 1, 清洁: -15 }, fail: { 健康: -8, buff: { name: '感冒', desc: '淋成了落汤鸡，头有点烫。', slots: 8, energyMul: 1.5 } }, okTxt: '你冲回了家，浑身湿透却莫名痛快。' },
    ],
  },
  {
    id: 'birthday', maxLife: 2, title: '同学的生日会', min: 5, max: 13,
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
    id: 'quarrel', maxLife: 2, title: '深夜的争吵', min: 4, max: 16,
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
      { t: '报名！武术功底，稳赢', cond: (s) => (s.skills.武术 || { lvl: 0 }).lvl >= 3, ok: { 体质: 2.5, 魅力: 2.5, 心情: 12, mem: '运动会上你一路领先冲过终点，武术班的底子让全场看呆了。' }, okTxt: '你赢得轻轻松松，冲线时还有空朝看台挥了挥手。' },
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
    id: 'shoes', maxLife: 2, title: '崭新的球鞋', min: 7, max: 13,
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
    id: 'oldman', maxLife: 2, title: '赠书的老者', min: 5, max: 18, weight: 0.4,
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
    id: 'volunteer', title: '敬老院献爱心', min: 8, max: 16,
    cond: (s) => s.flags.wentSchool,
    text: '学校组织去敬老院献爱心。教室里嗡嗡的，有人兴奋，有人嫌麻烦。',
    choices: [
      { t: '积极报名，认真表演节目（魅力检定）', check: { attr: '魅力', dc: 55 }, ok: { 魅力: 2.5, 心情: 10, mem: '敬老院里，一位老奶奶拉着你的手不放，说她孙子也这么大。' }, fail: { 心情: 2 }, okTxt: '你的节目演砸了，但老人们笑得很开心，你也跟着笑。' },
      { t: '能躲则躲', ok: { 心情: -2 } },
    ],
  },
  /* ---- 技艺开花：练出来的本事，会自己长出故事 ---- */
  {
    id: 'olympiad', title: '奥赛选拔', min: 11, max: 16,
    cond: (s) => s.flags.wentSchool && (s.skills.编程 || { lvl: 0 }).lvl >= 3,
    text: '信息课老师把你叫到办公室，推过来一张报名表：「市里奥赛选拔，我推荐了你。去试试？」',
    choices: [
      { t: '去！（智力检定）', check: { attr: '智力', dc: 62 }, ok: { 智力: 3, 心情: 10, skill: { name: '编程', xp: 5 }, mem: '你在奥赛选拔里拿了名次，升旗仪式上校长点了你的名。' }, fail: { 心情: -4, 智力: 0.5 }, failTxt: '题目难得离谱，出考场时你腿都是软的。但至少，你去过了。' },
      { t: '算了，怕耽误功课', ok: { 心情: -2 }, okTxt: '你摇摇头。老师有点惋惜：「可惜了。」' },
    ],
  },
  {
    id: 'newyear-dinner', title: '年夜饭', min: 9, max: 17, weight: 0.6,
    cond: (s) => s.location === 'home' && (s.skills.烹饪 || { lvl: 0 }).lvl >= 3,
    text: '除夕临近，厨房里的年味一天比一天浓。妈妈擦着手回头看你：「今年年夜饭，要不要你来露一手？」',
    choices: [
      { t: '系上围裙，掌勺！', ok: { 心情: 14, 魅力: 1.5, skill: { name: '烹饪', xp: 4 }, mem: '那年的年夜饭是你做的。全家人吃得很慢，很认真，爸爸破例多喝了两杯。' } },
      { t: '打打下手就好', ok: { 心情: 6, 饱食: 6 }, okTxt: '你剥了一晚上的蒜，也偷吃了一晚上的菜。' },
    ],
  },
  {
    id: 'talent-show', title: '校园文艺汇演', min: 8, max: 16,
    cond: (s) => s.flags.wentSchool && s.flags.art && (s.skills[s.flags.art] || { lvl: 0 }).lvl >= 3,
    text: (s) => `学校要办文艺汇演，文艺委员第一个想到你：「你的${s.flags.art}练了这么久，上台露一手吧！」`,
    choices: [
      { t: '登台表演', ok: { 魅力: 3, 心情: 10, mem: '文艺汇演的舞台上，灯光打在你脸上。掌声响起来的时候，你有点晕。' } },
      { t: '紧张，还是算了', ok: { 心情: -2 }, okTxt: '你在台下看完了整场演出，手心出了一晚上的汗。' },
    ],
  },

  /* ============================================================
   * 家境专属事件包
   * 贫寒暗线「妈妈的手」/ 小康暗线「自行车后座」/ 富贵暗线「等一盏灯」
   * ============================================================ */

  /* ---- 贫寒之家 ---- */
  {
    id: 'poor-hands', title: '妈妈的手', min: 5, max: 8, weight: 3,
    cond: (s) => s.familyKey === 'poor' && !s.flags['seen:poor-hands'],
    text: '冬天特别冷。夜里你钻进被窝，碰到妈妈的手——粗糙得像老树皮，裂着好几道口子。\n她白天在食堂帮人洗碗，手一直泡在冰水里。',
    choices: [
      { t: '把妈妈的手揣进自己怀里焐着', ok: { 心情: 6, flag: { poorArc1: true }, mem: '那个冬天，你用小小的身体焐热了妈妈的手。' }, okTxt: '妈妈愣了一下，然后笑了，眼角有点湿。\n「我们家孩子，长大了。」' },
      { t: '往里缩了缩，假装睡着了', ok: { 心情: -2 }, okTxt: '被窝里很暖和。可你总觉得，那双手碰到的地方，有点凉。' },
    ],
  },
  {
    id: 'poor-sewing', title: '深夜的缝纫机', min: 9, max: 12, weight: 3,
    cond: (s) => s.familyKey === 'poor' && !s.flags['seen:poor-sewing'],
    text: '半夜醒来，你听见隔壁传来咔嗒、咔嗒的声音。\n门缝里透出灯光——妈妈在踩缝纫机，接了好多改裤脚的活儿，一条五毛钱。',
    choices: [
      { t: '第二天早起，帮她穿针引线', ok: { 智力: 1, 心情: 5, flag: { poorArc2: true }, mem: '你学会了穿针。妈妈踩机器，你递线，谁也没说话，灯一直很亮。' }, okTxt: '妈妈嘴上嫌你笨手笨脚，却把你的手攥在手心里，暖了很久。' },
      { t: '翻个身，装睡', ok: { 心情: -2 }, okTxt: '咔嗒、咔嗒。这声音陪你睡着了，像一首听不懂的歌。' },
    ],
  },
  {
    id: 'poor-finale-a', title: '家长会那天', min: 13, max: 16, weight: 5,
    cond: (s) => s.familyKey === 'poor' && s.flags.poorArc1 && s.flags.poorArc2 && !s.flags.poorFinale,
    text: '开家长会了。你在教室窗口张望，心里打鼓：妈妈会来吗？她会穿那件洗得发白的工装吗？\n然后你看见了她——穿着过年才舍得穿的呢子外套，头发梳得整整齐齐，站在校门口，有点局促地找人打听初三（2）班怎么走。',
    choices: [
      { t: '跑过去，大声喊「妈！」', ok: { 心情: 14, 魅力: 2, flag: { poorFinale: true, arcDone: 'poor' }, mem: '家长会那天，妈妈穿上了她最好的衣服。你牵着她穿过整个校园，一点都不觉得丢人。' }, okTxt: '你牵着她的手穿过校园。那双手还是粗糙的，可你握得很紧、很紧。\n这一天你忽然明白：贫寒从来不是丢人的事，把手松开才是。' },
    ],
  },
  {
    id: 'poor-finale-b', title: '家长会那天', min: 14, max: 17, weight: 2,
    cond: (s) => s.familyKey === 'poor' && !(s.flags.poorArc1 && s.flags.poorArc2) && !s.flags.poorFinale,
    text: '开家长会了。同学们的家长陆续到了，你的座位旁边一直空着。\n快散会时，班主任走过来说：你妈妈来过电话，厂里加班，走不开，让你好好听老师讲。',
    choices: [
      { t: '点点头，把椅子收好', ok: { 心情: -3, 智力: 1, flag: { poorFinale: true }, mem: '家长会妈妈没来，她在加班。你把旁边的空椅子收得整整齐齐。' }, okTxt: '回家的路上你给自己买了个烤红薯。\n你想，等以后挣钱了，要让妈妈少加几年班。' },
    ],
  },
  {
    id: 'poor-bottles', title: '捡瓶子换糖', min: 6, max: 10, weight: 2,
    cond: (s) => s.familyKey === 'poor',
    text: '放学路上，你看见奶奶在翻垃圾桶捡饮料瓶。她说，攒一袋子能卖两块多。\n有同学正好经过，朝这边看了一眼。',
    choices: [
      { t: '大大方方帮奶奶一起捡', ok: { money: 2, 体质: 1, 心情: 5, mem: '你和奶奶捡了一下午瓶子，换了两块四，一人一根冰棍。' }, okTxt: '你接过奶奶手里的蛇皮袋：「我来拿，这个沉。」\n两块四毛钱，两根冰棍，甜了一路。' },
      { t: '装作不认识，快步走过', ok: { 心情: -5 }, okTxt: '你走得飞快。那天晚上，奶奶给你留了半块西瓜，你吃得不是滋味。' },
    ],
  },

  /* ---- 小康之家 ---- */
  {
    id: 'mid-table', title: '饭桌上的规矩', min: 6, max: 9, weight: 3,
    cond: (s) => s.familyKey === 'middle' && !s.flags['seen:mid-table'],
    text: '你家饭桌有条规矩：食不言。爸爸觉得吃饭就该安安静静。\n可你今天在学校得了一朵小红花，憋了一路，就想在饭桌上宣布。',
    choices: [
      { t: '扒完饭，放下筷子再说', ok: { 心情: 5, flag: { midArc1: true }, mem: '你得的小红花，是规规矩矩吃完饭才宣布的。爸爸听完，嘴角动了一下。' }, okTxt: '爸爸听完，「嗯」了一声，给你夹了一筷子肉。\n你后来才懂，那一筷子肉就是他全部的夸奖。' },
      { t: '忍不住，含着饭就喊出来', ok: { 心情: 6, 魅力: 0.5 }, okTxt: '「食不言！」爸爸板起脸。但那天晚上，小红花被贴在了冰箱最中间。' },
    ],
  },
  {
    id: 'mid-bike', title: '自行车后座', min: 10, max: 13, weight: 3,
    cond: (s) => s.familyKey === 'middle' && !s.flags['seen:mid-bike'],
    text: '你半夜发烧，外面下着雨。爸爸二话不说，给你裹上雨衣，把你架上他那辆老凤凰的后座，往医院蹬。\n雨点砸在他的背上，你趴在里面，一点都没淋着。',
    choices: [
      { t: '搂紧爸爸的腰', ok: { 心情: 8, flag: { midArc2: true }, mem: '雨夜里，爸爸的自行车后座是世界上最安全的地方。' }, okTxt: '他的背很宽，把风挡得严严实实。\n你迷迷糊糊地想：原来「父爱如山」是这个意思，山不说话，只是挡雨。' },
      { t: '迷迷糊糊地睡过去', ok: { 健康: 4 }, okTxt: '到医院时你睡得很沉。爸爸的后背湿透了，你身上是干的。' },
    ],
  },
  {
    id: 'mid-finale-a', title: '爸爸的白头发', min: 14, max: 17, weight: 5,
    cond: (s) => s.familyKey === 'middle' && s.flags.midArc1 && s.flags.midArc2 && !s.flags.midFinale,
    text: '周末大扫除，你踩着凳子擦吊柜，一低头，看见爸爸蹲在地上修那辆老凤凰。\n他的头顶，白头发已经连成了一小片。你突然意识到，那个能把你举过头顶的人，开始老了。',
    choices: [
      { t: '跳下凳子，蹲过去帮他递扳手', ok: { 心情: 12, 魅力: 1.5, flag: { midFinale: true, arcDone: 'middle' }, mem: '你发现爸爸有了白头发。那天你们爷俩一起修好了那辆老自行车。' }, okTxt: '你们蹲在地上修了一下午车。爸爸话还是不多，但每颗螺丝都让你亲手拧。\n「学会了，以后你自己的车链子掉了，不求人。」——这就是他表达爱的方式。' },
    ],
  },
  {
    id: 'mid-finale-b', title: '爸爸的白头发', min: 15, max: 17, weight: 2,
    cond: (s) => s.familyKey === 'middle' && !(s.flags.midArc1 && s.flags.midArc2) && !s.flags.midFinale,
    text: '周末大扫除，你一低头，看见爸爸蹲在地上修自行车，头顶的白头发连成了一小片。\n你们平日里话不多，这一刻，你也不知道该说点什么。',
    choices: [
      { t: '默默给他倒了杯热水', ok: { 心情: 4, flag: { midFinale: true }, mem: '你发现爸爸有了白头发。你没说什么，给他倒了杯热水。' }, okTxt: '爸爸接过水杯，愣了一下，说「谢谢」。\n父子之间，一杯水也算一次拥抱。' },
    ],
  },
  {
    id: 'mid-cram', title: '补习班风波', min: 8, max: 14, weight: 2,
    cond: (s) => s.familyKey === 'middle',
    text: '妈妈宣布：给你报了周末数学补习班，「别人家孩子都在补，咱不能掉队。」\n你的周末，眼看要没了。',
    choices: [
      { t: '去就去，学点真本事（智力检定）', check: { attr: '智力', dc: 55 }, ok: { 智力: 2.5, 娱乐: -8 }, okTxt: '补习班很苦，但你解出难题的那一刻，是真的爽。', fail: { 智力: 0.8, 心情: -5 }, failTxt: '你坐在教室最后一排，听得云里雾里，只想窗外的麻雀。' },
      { t: '跟妈妈讨价还价：补一科换半天玩', ok: { 智力: 1, 娱乐: 6, 魅力: 0.5 }, okTxt: '妈妈想了想，居然同意了。你第一次体会到「谈判」的甜头。' },
    ],
  },

  /* ---- 富贵之家 ---- */
  {
    id: 'rich-nanny', title: '王姨的口袋', min: 4, max: 7, weight: 3,
    cond: (s) => s.familyKey === 'rich' && !s.flags['seen:rich-nanny'],
    text: '爸爸妈妈又出差了。家里很大，大得说话有回音。\n保姆王姨在厨房给你煮小馄饨，她的围裙口袋里，总装着给你留的奶糖。',
    choices: [
      { t: '搬小板凳坐在厨房陪她', ok: { 心情: 7, flag: { richArc1: true }, mem: '大房子里的童年，是王姨围裙口袋里的奶糖味。' }, okTxt: '王姨一边搅馄饨一边给你唱她老家的童谣。\n很多年后你才反应过来：你关于「家」的最早记忆，主角是王姨。' },
      { t: '抱着玩具熊回自己房间', ok: { 心情: -3 }, okTxt: '你的房间很大，玩具很多。可玩具不会给你煮馄饨。' },
    ],
  },
  {
    id: 'rich-meeting', title: '缺席的家长会', min: 8, max: 12, weight: 3,
    cond: (s) => s.familyKey === 'rich' && !s.flags['seen:rich-meeting'],
    text: '家长会。别人的座位上坐着爸爸或妈妈，你的座位上坐着司机叔叔，他甚至不太敢和老师说话。\n同桌小声问：「你爸妈呢？」',
    choices: [
      { t: '「他们忙。我自己也行。」', ok: { 智力: 1, 心情: 2, flag: { richArc2: true }, mem: '家长会爸妈没来。你把老师说的每句话都记了下来，回家贴在冰箱上。' }, okTxt: '你把老师的话一条条记在本子上，回家贴在冰箱门上。\n第二天冰箱上多了一张便签，是妈妈的笔迹：「宝贝真棒。——妈妈」' },
      { t: '赌气说「我没有爸妈」', ok: { 心情: -4 }, okTxt: '同桌被你噎得不敢说话了。可说完这句，你自己的鼻子先酸了。' },
    ],
  },
  {
    id: 'rich-finale-a', title: '生日那天', min: 13, max: 17, weight: 5,
    cond: (s) => s.familyKey === 'rich' && s.flags.richArc1 && s.flags.richArc2 && !s.flags.richFinale,
    text: '你生日。你以为今年又是司机接送、蛋糕由秘书代订。\n可傍晚，门响了——爸爸拎着菜，妈妈系着围裙，他们推掉了所有应酬。\n妈妈的手艺很生疏，糖醋排骨有点糊。但灯全亮着，人在，家就在。',
    choices: [
      { t: '把糊掉的排骨也吃得干干净净', ok: { 心情: 14, 魅力: 2, flag: { richFinale: true, arcDone: 'rich' }, mem: '那年生日，爸妈推掉应酬回家做饭。排骨糊了，灯全亮着。' }, okTxt: '你吃完了最后一块糊排骨，说：「这是我吃过最好吃的生日饭。」\n妈妈转过身去擦眼睛。爸爸给你盛了第二碗饭。' },
    ],
  },
  {
    id: 'rich-finale-b', title: '生日那天', min: 15, max: 17, weight: 2,
    cond: (s) => s.familyKey === 'rich' && !(s.flags.richArc1 && s.flags.richArc2) && !s.flags.richFinale,
    text: '你生日。蛋糕是秘书订的，很精致，卡片上印着烫金的「生日快乐」，没有署名。\n手机震了一下：爸爸转来一笔钱，「喜欢什么自己买」。',
    choices: [
      { t: '给自己点一碗长寿面', ok: { 心情: -2, 智力: 1, flag: { richFinale: true }, mem: '那个生日，蛋糕很贵，祝福是打印的。你给自己点了碗长寿面。' }, okTxt: '面很便宜，热气腾腾。\n你一边吃一边想：以后我有了家，生日一定要自己下厨。' },
    ],
  },
  {
    id: 'rich-treat', title: '请客风波', min: 7, max: 12, weight: 2,
    cond: (s) => s.familyKey === 'rich',
    text: '你零花钱多，总请同学吃零食，身边围着的人越来越多。\n今天你忘了带钱，围着你的人一下子散了大半。只有同桌小胖，把自己的辣条分了你一半。',
    choices: [
      { t: '记住小胖，看清了这场热闹', ok: { 智力: 1.5, 魅力: 1, mem: '你请客时高朋满座，忘带钱时只剩小胖。你把这根辣条记了很多年。' }, okTxt: '你嚼着那半根辣条，忽然明白了什么叫朋友。\n从此你的零食，只分给特定的人。' },
      { t: '明天带双倍的钱，把排场找回来', ok: { money: -10, 心情: 3 }, okTxt: '第二天你又成了人群的中心。可你总觉得，这些笑脸有点吵。' },
    ],
  },

  /* ============================================================
   * 一生一羁绊：每世随机一位命定之人，相识 → 深交 → 告别/约定
   * ============================================================ */

  /* ---- 同桌小胖 ---- */
  {
    id: 'bond-pang-1', title: '桌上的三八线', min: 6, max: 8, weight: 3,
    cond: (s) => s.flags.bond === 'pang' && !s.flags['seen:bond-pang-1'],
    text: '开学排座位，你和班里最圆的小胖同桌。课桌中间不知谁先画了一道三八线，可小胖的胳膊肘总是过界，霸占你半块橡皮的地盘。',
    choices: [
      { t: '把线擦了：「桌子一人一半。」', ok: { 心情: 6, 魅力: 1, flag: { bondA1: true }, mem: '你擦掉三八线那天，小胖分了你半根辣条。友谊是从半根辣条开始的。' }, okTxt: '小胖愣了半天，从书包最里层摸出一根辣条，撕成两半。\n大的那半给了你。' },
      { t: '拿尺子敲他的胳膊肘', ok: { 心情: 2 }, okTxt: '小胖嗷嗷叫，下课就去告了老师。你们冷战了三天，又莫名其妙和好了。' },
    ],
  },
  {
    id: 'bond-pang-2', title: '小胖的饭盒', min: 11, max: 13, weight: 3,
    cond: (s) => s.flags.bond === 'pang' && !s.flags['seen:bond-pang-2'],
    text: '这几年你发现一个秘密：小胖的饭盒里，红烧肉永远比别人的多一份。今天他支支吾吾坦白——是他妈妈特意多做的，「我妈说，同桌要一起长肉。」',
    choices: [
      { t: '明天开始，你的饭盒也分他一半', ok: { 心情: 8, 魅力: 1.5, flag: { bondA2: true }, mem: '你们的饭盒从此不分彼此。两个半大孩子，一起长了好多斤。' }, okTxt: '第二天你把自己饭盒推过去的时候，小胖眼睛亮得像灯泡。\n「咱俩天下第一好！」' },
      { t: '白吃就白吃，笑嘻嘻', ok: { 心情: 4, 饱食: 8 }, okTxt: '你吃得很香。小胖也不介意，只是帮你把肥肉都挑走了——他说你不爱吃肥的。' },
    ],
  },
  {
    id: 'bond-pang-3a', title: '毕业前的约定', min: 15, max: 17, weight: 5,
    cond: (s) => s.flags.bond === 'pang' && s.flags.bondA1 && s.flags.bondA2 && !s.flags.bondDone && !s.flags['seen:bond-pang-3a'],
    text: '晚自习后，小胖请你吃烤串，吃到一半忽然说：「我想好了，以后我要开一家饭馆。\n你答应我，等你以后出息了，也得回来吃。我给你留靠窗的座，终身免费。」',
    choices: [
      { t: '碰杯：「一言为定。」', ok: { 心情: 12, flag: { bondDone: true }, mem: '毕业前你和小胖约好了：他开饭馆，你终身免费，靠窗的座。' }, okTxt: '两瓶汽水碰在一起，泡沫溅了满脸。\n很多年后你才明白，人这一辈子，能有一个「终身免费」的朋友，是多大的福气。' },
    ],
  },
  {
    id: 'bond-pang-3b', title: '渐渐安静的同桌', min: 15, max: 17, weight: 2,
    cond: (s) => s.flags.bond === 'pang' && !(s.flags.bondA1 && s.flags.bondA2) && !s.flags.bondDone && !s.flags['seen:bond-pang-3b'],
    text: '毕业照拍完那天，小胖塞给你一包辣条，还是撕成两半的那种。\n你们谁都没提"以后"两个字。有些事就是这样，不知道怎么的，就慢慢断了。',
    choices: [
      { t: '收下，说声保重', ok: { 心情: -3, mem: '毕业时小胖给了你一包辣条。后来你们渐渐断了联系。' }, okTxt: '辣条你吃了很多年。\n每次撕开，都会想起那张圆圆的脸。' },
    ],
  },

  /* ---- 巷尾转学生 ---- */
  {
    id: 'bond-transfer-1', title: '巷尾的新面孔', min: 5, max: 7, weight: 3,
    cond: (s) => s.flags.bond === 'transfer' && !s.flags['seen:bond-transfer-1'],
    text: '巷尾的空房子里搬来一户人家。他们家的小孩总是一个人蹲在墙根玩石子，玩得特别认真，好像全世界只剩他和那几颗石子。',
    choices: [
      { t: '蹲过去：「这局算我一个。」', ok: { 心情: 6, 魅力: 1, flag: { bondA1: true }, mem: '你用一局石子游戏，捡到了巷尾转学生的友谊。' }, okTxt: '他抬起头看了你很久，往旁边挪了挪，给你让出半个墙根。\n那天你们玩到天黑，谁都没怎么说话，但明天他还会在墙根等你。' },
      { t: '看一眼，走自己的路', ok: { 心情: 1 }, okTxt: '你们擦肩而过。巷子很长，各走各的。' },
    ],
  },
  {
    id: 'bond-transfer-2', title: '秘密基地', min: 10, max: 12, weight: 3,
    cond: (s) => s.flags.bond === 'transfer' && !s.flags['seen:bond-transfer-2'],
    text: '转学生神神秘秘地拉你穿过三条巷子，扒开一堵废墙后的野藤——里面竟然藏着一小片干净的空地，有他捡来的木板凳、铁皮盒，还有半本翻烂了的《水浒传》。\n「这是咱俩的秘密基地。」他第一次用了「咱俩」这个词。',
    choices: [
      { t: '拉钩：谁也不告诉', ok: { 心情: 8, 智力: 1, flag: { bondA2: true }, mem: '废墙后的秘密基地，是你们俩的王国。拉过钩的，谁也不告诉。' }, okTxt: '你们把那半本《水浒传》读完了一遍又一遍。\n后来你所有关于「江湖」的想象，都带着那片空地上的阳光。' },
      { t: '第二天就讲给了班里同学听', ok: { 心情: -4, 魅力: -1 }, okTxt: '第三天你再去，野藤还是那丛野藤，木板凳和铁皮盒都不见了。\n他再也没提过「咱俩」。' },
    ],
  },
  {
    id: 'bond-transfer-3a', title: '时间胶囊', min: 15, max: 17, weight: 5,
    cond: (s) => s.flags.bond === 'transfer' && s.flags.bondA1 && s.flags.bondA2 && !s.flags.bondDone && !s.flags['seen:bond-transfer-3a'],
    text: '转学生又要转学了——他爸的工作又调动了。\n临走前一晚，你们回到秘密基地，把各自写的一封信装进铁皮盒，埋在那棵歪脖子树下。\n「十年之后，不管在哪，都回来挖。」',
    choices: [
      { t: '埋下盒子，约好十年', ok: { 心情: 10, flag: { bondDone: true }, mem: '你们把十年之约埋进了歪脖子树下。铁皮盒里有两封信。' }, okTxt: '他走的那天你没去送，怕当面哭鼻子丢人。\n但你知道，有些东西埋在土里，比带在身上更牢靠。' },
    ],
  },
  {
    id: 'bond-transfer-3b', title: '空了的巷尾', min: 15, max: 17, weight: 2,
    cond: (s) => s.flags.bond === 'transfer' && !(s.flags.bondA1 && s.flags.bondA2) && !s.flags.bondDone && !s.flags['seen:bond-transfer-3b'],
    text: '不知什么时候开始，巷尾又空了。那户人家的窗户黑洞洞的，像从来没住过人。\n你甚至想不起来，是从哪一天起，墙根下再没有那个玩石子的身影。',
    choices: [
      { t: '在墙根站一会儿再走', ok: { 心情: -3, mem: '转学生悄无声息地走了。巷尾空了很久。' }, okTxt: '风穿过巷子，卷起几片落叶。\n有些人走进你的生命，又退出去，连一声再见都省了。' },
    ],
  },

  /* ---- 隔壁姐姐 ---- */
  {
    id: 'bond-sis-1', title: '会飞的纸飞机', min: 4, max: 6, weight: 3,
    cond: (s) => s.flags.bond === 'sis' && !s.flags['seen:bond-sis-1'],
    text: '隔壁住着一位大你五岁的姐姐。傍晚她坐在楼道口折纸飞机，折出来的飞机又稳又远，能飞过整个院子。\n你蹲在旁边看了很久很久。她笑着把最后一张糖纸递给你：「教你？」',
    choices: [
      { t: '学会后，把飞得最远的那架送给她', ok: { 心情: 6, 魅力: 1, flag: { bondA1: true }, mem: '你学会折纸飞机那天，把飞得最远的一架送给了隔壁姐姐。' }, okTxt: '她把那架纸飞机夹进了课本里。\n「姐姐上学带着它，考试就不紧张了。」' },
      { t: '学会了就自己玩个够', ok: { 娱乐: 8 }, okTxt: '你的纸飞机挂满了院子里的树梢。她远远看着，笑而不语。' },
    ],
  },
  {
    id: 'bond-sis-2', title: '姐姐的自行车', min: 11, max: 13, weight: 3,
    cond: (s) => s.flags.bond === 'sis' && !s.flags['seen:bond-sis-2'],
    text: '姐姐考上外地的大学了。临走前那个暑假，她天天傍晚在院子里扶着你练自行车：「我走了就没人陪你练了，这个夏天必须学会。」\n你摔了无数次，她一次都没嫌烦。',
    choices: [
      { t: '开学前，骑完一整条巷子给她看', ok: { 体质: 2, 心情: 8, flag: { bondA2: true }, mem: '姐姐去上大学前，你终于骑完了一整条巷子。她在巷子那头鼓掌。' }, okTxt: '你摇摇晃晃骑到巷子那头，她鼓掌鼓得整条街都听见了。\n「以后想我了，就骑车骑快一点，风会把想念吹淡的。」' },
      { t: '怕摔，不想学了', ok: { 心情: -2 }, okTxt: '她走的那天，自行车靠墙放着，落了很薄一层灰。' },
    ],
  },
  {
    id: 'bond-sis-3a', title: '远方来的信', min: 15, max: 17, weight: 5,
    cond: (s) => s.flags.bond === 'sis' && s.flags.bondA1 && s.flags.bondA2 && !s.flags.bondDone && !s.flags['seen:bond-sis-3a'],
    text: '信箱里躺着一封信，是姐姐从大学寄来的。信里夹着那架纸飞机——已经压得平平整整，颜色都旧了。\n「飞机还你。它陪了我四年，现在我把它寄回去，换你给我讲讲家里的事。常写信。」',
    choices: [
      { t: '提笔回信，从此月月不断', ok: { 心情: 10, 智力: 1, flag: { bondDone: true }, mem: '姐姐寄回了那架纸飞机。你们的信，从此月月不断。' }, okTxt: '你的第一封信写了四页，从巷口的猫写到月考成绩。\n原来有些人搬走了，却可以住在一封信里，一直不走。' },
    ],
  },
  {
    id: 'bond-sis-3b', title: '安静的楼道', min: 15, max: 17, weight: 2,
    cond: (s) => s.flags.bond === 'sis' && !(s.flags.bondA1 && s.flags.bondA2) && !s.flags.bondDone && !s.flags['seen:bond-sis-3b'],
    text: '过年时隔壁偶尔会有动静，是姐姐回来了。你们在楼道里碰见，客气地点头，像两个刚搬来的邻居。\n你忽然想起，已经很多年没听过她折纸飞机的声音了。',
    choices: [
      { t: '点点头，擦肩而过', ok: { 心情: -3, mem: '隔壁姐姐成了点头之交。楼道安静了很多年。' }, okTxt: '长大大概就是这样：不是吵架，不是告别，\n只是某天你发现，你们已经没什么好说的了。' },
    ],
  },

  /* ---- 棋摊忘年交 ---- */
  {
    id: 'bond-chess-1', title: '让你三子', min: 6, max: 8, weight: 3,
    cond: (s) => s.flags.bond === 'chess' && !s.flags['seen:bond-chess-1'],
    text: '广场棋摊上，一位白胡子老爷子冲你招手：「小娃娃，来一盘？我让你三个子。」\n你本来只是看热闹的，不知怎么就被按到了棋凳上。',
    choices: [
      { t: '输了也常来，陪他杀两盘', ok: { 智力: 1.5, 心情: 5, flag: { bondA1: true }, mem: '你成了棋摊的常客。白胡子老爷子让你三子，你输了整整一个夏天。' }, okTxt: '输了一个夏天之后，老爷子捋着胡子说：「能一直输还一直来的，你是头一个。\n行，我好好教。」' },
      { t: '赢了一局就得意地跑了', ok: { 心情: 4 }, okTxt: '老爷子在你背后笑：「让你三个子呢，小娃娃。」你跑得更快了。' },
    ],
  },
  {
    id: 'bond-chess-2', title: '老爷子的心事', min: 11, max: 13, weight: 3,
    cond: (s) => s.flags.bond === 'chess' && !s.flags['seen:bond-chess-2'],
    text: '连着下了几年棋，老爷子今天格外沉默。收摊时他忽然说：「我儿子跟你差不多大的时候，也天天在这儿下棋。后来出去了，十年没回来喽。」\n夕阳把他的影子拉得很长。',
    choices: [
      { t: '默默陪他坐到路灯亮', ok: { 心情: 7, 魅力: 1, flag: { bondA2: true }, mem: '老爷子说起他十年没回家的儿子。那天你陪他坐到了路灯亮。' }, okTxt: '路灯亮起来的时候，老爷子收拾棋盘的手停了一下：\n「以后他回来了，我介绍你们认识。你们俩，下棋一样臭。」' },
      { t: '不知道怎么接话，先回家了', ok: { 心情: -2 }, okTxt: '你走出很远回头看了一眼，老爷子还坐在那儿，一个人，一盘棋。' },
    ],
  },
  {
    id: 'bond-chess-3a', title: '最后一盘棋', min: 15, max: 17, weight: 5,
    cond: (s) => s.flags.bond === 'chess' && s.flags.bondA1 && s.flags.bondA2 && !s.flags.bondDone && !s.flags['seen:bond-chess-3a'],
    text: '广场要改造了，棋摊最后一天出摊。老爷子特意等你放学，摆好棋：「来，最后一盘。今天不让子了。」\n他顿了顿：「你要赢了，这副老棋盘就归你。」\n那盘棋下了很久，很久。',
    choices: [
      { t: '收下棋盘：「老爷子，后会有期。」', ok: { 心情: 10, 智力: 1.5, flag: { bondDone: true }, mem: '棋摊拆了。老爷子把那副旧棋盘送给了你，彩头是你赢的最后一盘。' }, okTxt: '「下棋如做人，落子无悔。」他拍拍你的肩膀，背着手走进了人群。\n那副棋盘你收了很多年，一直没舍得再下。' },
    ],
  },
  {
    id: 'bond-chess-3b', title: '换了人的棋摊', min: 15, max: 17, weight: 2,
    cond: (s) => s.flags.bond === 'chess' && !(s.flags.bondA1 && s.flags.bondA2) && !s.flags.bondDone && !s.flags['seen:bond-chess-3b'],
    text: '有些日子没去广场，再去时棋摊还在，摊主却换了人。\n你问了句白胡子老爷子，新摊主摆摆手：「回老家抱孙子去喽。」棋还是那些棋，可看棋的心情不一样了。',
    choices: [
      { t: '在棋摊边站一会儿', ok: { 心情: -3, mem: '白胡子老爷子回老家了。棋摊换了人，你再没去看过棋。' }, okTxt: '原来「改天再来」是最靠不住的四个字。\n改天，常常就是再也不见。' },
    ],
  },

  /* ============================================================
   * 年少欢喜：一段懵懂的三幕心事，传纸条 → 同行 → 毕业约定
   * ============================================================ */
  {
    id: 'crush-1', title: '夹在课本里的纸条', min: 12, max: 13, weight: 3,
    cond: (s) => !s.flags['seen:crush-1'],
    text: (s) => {
      const t = s.gender === '男' ? '她' : '他';
      return `自习课上，一张折得方方正正的纸条从后排传到你手里。展开只有一行字：「这道题你会吗？」\n字迹很秀气。你回头，${t}飞快地低下头，耳根却红了。`;
    },
    choices: [
      { t: '认真写下解法，末尾多问一句「还有哪题不会？」', ok: { 心情: 6, 魅力: 1, flag: { crushA1: true }, mem: '那张纸条在你们之间传了很久，题目越写越少，闲话越写越多。' }, okTxt: '纸条传回来得越来越快。\n后来纸条上的字，比课本上的笔记还工整。' },
      { t: '写完解法就传回去，不多写一个字', ok: { 智力: 1, 心情: 1 }, okTxt: '纸条传了几次就断了。你把那几张纸条夹进课本最厚的一页，一直没扔。' },
    ],
  },
  {
    id: 'crush-2', title: '一把伞的距离', min: 14, max: 15, weight: 3,
    cond: (s) => !s.flags['seen:crush-2'],
    text: (s) => {
      const t = s.gender === '男' ? '她' : '他';
      const lead = s.flags.crushA1
        ? '传了很久的纸条之后，你们已经很熟了，熟到全班都看得出来，只有你们俩不承认。'
        : '不知从什么时候起，你总会下意识在人群里找一个身影，找到了，又赶紧移开视线。';
      return `${lead}\n这天放学突降大雨，你没带伞，站在教学楼门口看雨帘发呆。一把伞忽然撑到你头顶——是${t}：「顺路，一起走吧。」`;
    },
    choices: [
      { t: '把伞往对方那边推了推，约好明天一起上学', ok: { 心情: 8, 魅力: 1.5, flag: { crushA2: true }, mem: '那个雨天，一把伞挤了两个人。从那天起，你们每天放学都「顺路」。' }, okTxt: '伞其实不大，你们各湿了半边肩膀，谁也没说破。\n那条回家的路，你希望它再长一点。' },
      { t: '道了谢，到路口就各自回家', ok: { 心情: 2 }, okTxt: '雨很大，路很短。到家后你发现，外套上落了一滴不属于自己的雨。' },
    ],
  },
  {
    id: 'crush-3a', title: '同一座城市的约定', min: 16, max: 17, weight: 5,
    cond: (s) => s.flags.crushA1 && s.flags.crushA2 && !s.flags.crushDone && !s.flags['seen:crush-3a'],
    text: (s) => {
      const t = s.gender === '男' ? '她' : '他';
      return `毕业纪念册在班里传来传去。轮到你们互相留言，那一页${t}写了很久很久，久到笔尖下的纸都洇开了。\n还回来的时候，${t}没看你的眼睛，声音压得很低：「以后……考同一座城市的大学，好不好？」`;
    },
    choices: [
      { t: '「好，一言为定。」', ok: { 心情: 12, flag: { crushDone: true }, mem: '毕业前你们约好了：考同一座城市的大学。纪念册那一页，你看了很多遍。' }, okTxt: '纪念册合上的时候，蝉鸣正响。\n很多年后你才会知道，那年夏天的约定，是年少能给出去的、最郑重的东西。' },
    ],
  },
  {
    id: 'crush-3b', title: '留在夏天的心事', min: 16, max: 17, weight: 2,
    cond: (s) => !(s.flags.crushA1 && s.flags.crushA2) && !s.flags.crushDone && !s.flags['seen:crush-3b'],
    text: '拍毕业照那天，全班在台阶上挤作一团。你们站得很远，隔着好几排脑袋。\n快门响的前一秒，你忽然想：有些话再不说，就要跟着这个夏天一起结束了。\n可快门还是响了。',
    choices: [
      { t: '挥挥手，把没说出口的话留在这个夏天', ok: { 心情: -3, mem: '毕业照上你们隔得很远。有句话，最终留在了那个夏天。' }, okTxt: '照片洗出来，你在人群里找了很久。\n原来青春里的大多数心事，都是没有下文的。' },
    ],
  },

  /* ============================================================
   * 专精分岔：技艺 3 级时选择方向，走向不同的剧情线
   * ============================================================ */
  {
    id: 'spec-绘画', title: '画展上的两束目光', min: 10, max: 15, weight: 4,
    cond: (s) => (s.skills.绘画 || { lvl: 0 }).lvl >= 3 && !s.flags['spec_绘画'] && !s.flags['seen:spec-绘画'],
    text: '少年宫办画展，你的画被挂在了正中间。来看画的人里，有两位停得最久：\n一位是须发皆白的国画老先生，背着手看了半个钟头；另一个是隔壁班漫画社的社长，举着手机拍了又拍。\n他们都给你留了话。',
    choices: [
      { t: '拜老先生为师，学国画', ok: { 智力: 1, 心情: 6, flag: { spec_绘画: '国画' }, mem: '你拜了国画老先生为师。第一课不教画，教研墨。' }, okTxt: '老先生只问了一句：「吃得了苦吗？」\n你点头。从那天起，你的周末都是墨味的。' },
      { t: '加入漫画社，画自己的连载', ok: { 心情: 8, 魅力: 1, flag: { spec_绘画: '漫画' }, mem: '你加入了漫画社，作业本的空白处全是连载。' }, okTxt: '社长把社里最好的蘸水笔借给了你：「下周交三页，主角你自己定。」' },
    ],
  },
  {
    id: 'spec-乐器', title: '指尖的分岔口', min: 10, max: 15, weight: 4,
    cond: (s) => (s.skills.乐器 || { lvl: 0 }).lvl >= 3 && !s.flags['spec_乐器'] && !s.flags['seen:spec-乐器'],
    text: '少年宫汇演的名单上有你。散场后老师把你留下：「你的底子够了，该选条路了——\n钢琴，一级一级往上考，这条路走得最远；吉他，操场上一坐，自己弹自己唱，这条路最自在。」',
    choices: [
      { t: '钢琴——把考级的路走到底', ok: { 智力: 1, 心情: 6, flag: { spec_乐器: '钢琴' }, mem: '你选了钢琴。琴凳比别的椅子都硬，路也是。' }, okTxt: '老师给你排了考级时间表，密密麻麻贴到明年。\n第一页写着：「慢练，是一切的本事。」' },
      { t: '吉他——自己弹自己唱', ok: { 心情: 8, 魅力: 1, flag: { spec_乐器: '吉他' }, mem: '你选了吉他。第一笔零花钱，换了把二手木吉他。' }, okTxt: '吉他比钢琴轻多了，轻到可以抱着它去任何地方。\n你给它起了个名字，没告诉任何人。' },
    ],
  },
  {
    id: 'spec-编程', title: '代码的两种用法', min: 10, max: 15, weight: 4,
    cond: (s) => (s.skills.编程 || { lvl: 0 }).lvl >= 3 && !s.flags['spec_编程'] && !s.flags['seen:spec-编程'],
    text: '信息课老师找你谈话：「奥赛班还有一个名额。含金量高，重点中学认这个。」\n同一节课下课，同桌凑过来，压低声音：「别去奥赛。咱俩做个小游戏吧——就咱俩，做一个我们自己的。」',
    choices: [
      { t: '进奥赛班，去赛场上证明自己', ok: { 智力: 2, flag: { spec_编程: '奥赛' }, mem: '你进了奥赛班。那里的草稿纸，堆得比课本高。' }, okTxt: '奥赛班的灯总是最后一个灭。\n你在第一页讲义上写：「保送」两个字，写得又小又重。' },
      { t: '和同桌做一个自己的游戏', ok: { 心情: 8, 智力: 1, flag: { spec_编程: '游戏' }, mem: '你和同桌开始做一个自己的游戏。第一个版本，bug 比功能多。' }, okTxt: '你们击了个掌，把课表背面画满了策划案。\n游戏名字想了一整节自习课。' },
    ],
  },
  {
    id: 'spec-武术', title: '擂台与晨练', min: 10, max: 15, weight: 4,
    cond: (s) => (s.skills.武术 || { lvl: 0 }).lvl >= 3 && !s.flags['spec_武术'] && !s.flags['seen:spec-武术'],
    text: '体校教练来看你们训练，临走拍拍你的肩：「好苗子。要不要来我这儿，打真正的散打比赛？」\n同一天清晨，公园晨练的白发爷爷看你扎马步，笑呵呵地说：「小家伙，跟我学太极吧。急什么，功夫是熬出来的。」',
    choices: [
      { t: '上擂台，打真正的比赛', ok: { 体质: 2, flag: { spec_武术: '散打' }, mem: '你去了体校练散打。那里的沙袋，比训练馆的硬三倍。' }, okTxt: '教练扔给你一副缠手带：「先学挨打，再学打人。」\n你缠得很紧。' },
      { t: '跟爷爷学太极，慢慢熬', ok: { 智力: 1, 心情: 6, flag: { spec_武术: '太极' }, mem: '你拜了公园的白发爷爷学太极。每天清晨，比别人早起一小时。' }, okTxt: '爷爷教你第一句话：「不顶，不丢。」\n你没听懂，但记住了。' },
    ],
  },

  /* ---- 绘画 · 国画 ---- */
  {
    id: 'guohua-1', title: '研墨的规矩', min: 11, max: 15, weight: 2,
    cond: (s) => s.flags['spec_绘画'] === '国画' && !s.flags['seen:guohua-1'],
    text: '拜师一个月了，师父还没让你碰毛笔。每天去了就是研墨：清水、墨锭、一圈，又一圈。\n「墨研得匀，心才静得下来。」师父说完就去喝茶了，留你一个人对着砚台。',
    choices: [
      { t: '耐住性子，把墨研到发亮', ok: { 智力: 1.5, 心情: 5, mem: '你研了一个月的墨。师父第一次让你碰笔那天，只说了一个字：「嗯。」' }, okTxt: '第三十天，师父用手指蘸了蘸你的墨，点了点头。\n「明天开始，学握笔。」你差点把砚台打翻。' },
      { t: '趁师父不在，偷偷画两笔', ok: { 心情: -2 }, okTxt: '师父回来只看了一眼：「墨都没研好，画什么画。」\n那天的墨，你研到了天黑。' },
    ],
  },
  {
    id: 'guohua-2', title: '留白', min: 14, max: 17, weight: 3,
    cond: (s) => s.flags['spec_绘画'] === '国画' && !s.flags['seen:guohua-2'],
    text: '你把最满意的一幅新作呈给师父。画上山水俱全，还有一只你最得意的鸟。\n师父看了很久，只说两个字：「太满。」\n你盯着画看了三天。第四天，你提笔，把那只鸟擦掉了。',
    choices: [
      { t: '再呈上去', ok: { 智力: 2, 心情: 8, mem: '擦掉了最爱的那只鸟，你的画第一次被师父挂进了堂屋。' }, okTxt: '师父把画挂在了堂屋正中。\n「画留三分白，事让三分闲。」他顿了顿，「你出师了一半了。」' },
    ],
  },

  /* ---- 绘画 · 漫画 ---- */
  {
    id: 'manhua-1', title: '班级同人志', min: 11, max: 15, weight: 2,
    cond: (s) => s.flags['spec_绘画'] === '漫画' && !s.flags['seen:manhua-1'],
    text: '你偷偷画的班级同人漫画在班里传疯了——连载三期，主角是班主任，大反派是教导主任。\n今天早读，班主任本人站到了你桌前，手里拿着最新一期。',
    choices: [
      { t: '硬着头皮承认是自己画的', ok: { 魅力: 1.5, 心情: 8, mem: '班主任看完了你的同人漫画。他笑了，还让你给毕业纪念册画封面。' }, okTxt: '教室里安静了三秒，班主任忽然笑出了声：「把我画年轻了十岁，可以。」\n顿了顿：「毕业纪念册的封面，你来画。别画教导主任了。」' },
      { t: '死不承认', ok: { 心情: -4 }, okTxt: '班主任把漫画轻轻放回你桌上：「画得不错。就是下次，别把教案的事也画进去。」\n你恨不得钻进抽屉里。' },
    ],
  },
  {
    id: 'manhua-2', title: '第一本单行本', min: 14, max: 17, weight: 3,
    cond: (s) => s.flags['spec_绘画'] === '漫画' && !s.flags['seen:manhua-2'],
    text: '毕业前，你把三年的连载一页页整理好，用粗线装订成厚厚一本「单行本」，封面是你画了三个通宵的全班群像。\n它在班里传阅，每个人都要在上面留一句话。',
    choices: [
      { t: '在扉页写下全班每个人的名字', ok: { 心情: 10, 魅力: 1, mem: '你的「单行本」在全班传了一圈，回来时写满了留言。班主任留的是：「未完待续。」' }, okTxt: '本子传回你手里时，沉甸甸的。\n最后一页是班主任的字：「画得不错。老师等你出第二本。」' },
    ],
  },

  /* ---- 乐器 · 钢琴 ---- */
  {
    id: 'piano-1', title: '考级前夜', min: 11, max: 15, weight: 2,
    cond: (s) => s.flags['spec_乐器'] === '钢琴' && !s.flags['seen:piano-1'],
    text: '明天考六级。琴谱翻得起了毛边，节拍器被妈妈换上了新电池。\n她比你还紧张，在客厅来回走：「要不要再练一遍？还是早点睡？」',
    choices: [
      { t: '再练最后一遍，慢练', ok: { 智力: 1, 心情: 6, mem: '六级通过那天，证书是妈妈拿去塑封的，比你还宝贝。' }, okTxt: '最后一遍你弹得很慢，一个错音都没有。\n第二天考级，考官在你的评语栏写：「稳。」' },
      { t: '合上琴盖，早点睡', ok: { 心情: 2 }, okTxt: '那晚你梦见自己在考场忘了谱子。醒来发现，谱子早就在手指里了。' },
    ],
  },
  {
    id: 'piano-2', title: '礼堂的独奏', min: 14, max: 17, weight: 3,
    cond: (s) => s.flags['spec_乐器'] === '钢琴' && !s.flags['seen:piano-2'],
    text: '毕业典礼，你的独奏排在压轴。礼堂的灯暗下来，只留一盏打在琴键上。\n你弹了《送别》。台下安静得能听见有人翻节目单的声音。',
    choices: [
      { t: '鞠躬，看见妈妈在擦眼睛', ok: { 心情: 10, 魅力: 1.5, mem: '毕业典礼的《送别》弹完，掌声响了很久。妈妈在第一排擦眼睛。' }, okTxt: '最后一个音散在礼堂里，掌声才响起来。\n鞠躬的时候你看见妈妈——她一边鼓掌，一边用手背抹眼睛。' },
    ],
  },

  /* ---- 乐器 · 吉他 ---- */
  {
    id: 'guitar-1', title: '操场弹唱会', min: 11, max: 15, weight: 2,
    cond: (s) => s.flags['spec_乐器'] === '吉他' && !s.flags['seen:guitar-1'],
    text: '夏夜，晚自习前，你抱着吉他坐到操场边的看台上，本来只想弹给同桌听。\n一曲弹完，身后不知什么时候围了一圈人，有人小声说：「再来一个。」',
    choices: [
      { t: '一首接一首，唱到熄灯', ok: { 魅力: 2, 心情: 10, mem: '那个夏夜，操场上的弹唱会一直开到熄灯。蚊子很多，没人先走。' }, okTxt: '熄灯铃响的时候，人群里有人喊你的名字。\n回宿舍的路上，同桌说：「你知道吗，你唱歌的时候整个人都在发光。」' },
      { t: '不好意思，抱着吉他跑了', ok: { 心情: -2 }, okTxt: '你跑得比下课铃还快。第二天，有人在你桌肚里塞了张纸条：「昨天那首，叫什么？」' },
    ],
  },
  {
    id: 'guitar-2', title: '写给毕业的歌', min: 14, max: 17, weight: 3,
    cond: (s) => s.flags['spec_乐器'] === '吉他' && !s.flags['seen:guitar-2'],
    text: '你写了一首歌，歌词全是你们班的事：后门的班主任、传了三年的纸条、运动会输掉的那场接力。\n毕业聚会上你唱到副歌，第一句还没唱完，全班就跟着唱了起来。',
    choices: [
      { t: '把最后一段让给全班唱', ok: { 心情: 12, 魅力: 1.5, mem: '毕业聚会上，你写的歌被全班合唱。有人笑着笑着就哭了。' }, okTxt: '后来你忘了那晚所有菜的的味道，\n但永远记得四十个人跑调的合唱，和你按弦按到发抖的手指。' },
    ],
  },

  /* ---- 编程 · 奥赛 ---- */
  {
    id: 'aosa-1', title: '集训营的怪物们', min: 11, max: 15, weight: 2,
    cond: (s) => s.flags['spec_编程'] === '奥赛' && !s.flags['seen:aosa-1'],
    text: '奥赛集训营里全是怪物：有人心算快过计算器，有人初一就学完了初三的算法。\n第一次模拟考，你排在中下游。你第一次觉得，自己「也就那样」。',
    choices: [
      { t: '咬牙跟上，每天多刷十道题', ok: { 智力: 2.5, 心情: -2, mem: '集训营排名一点点往前爬。你明白了：天赋决定起点，刷题决定名次。' }, okTxt: '三个月后的排名表上，你从后往前找不到自己了。\n要从前往后找。' },
      { t: '接受普通，按自己的节奏来', ok: { 心情: 2, 智力: 1 }, okTxt: '你不再盯着排名，只盯着自己的错题本。\n奇怪的是，名次反而慢慢上去了。' },
    ],
  },
  {
    id: 'aosa-2', title: '榜上有名', min: 13, max: 17, weight: 3,
    cond: (s) => s.flags['spec_编程'] === '奥赛' && !s.flags['seen:aosa-2'],
    text: '复赛名单贴在公告栏，围了一圈人。你个子小，挤不进去，只好从最后一排的名字往前找——\n不用找了。第一排就有你，全市第三。',
    choices: [
      { t: '拍下来，发给爸妈', ok: { 心情: 12, 智力: 1, mem: '奥赛复赛全市第三。照片发回家，爸爸回了一个他从来不会用的表情：👍。' }, okTxt: '那天晚上，爸爸把那张照片设成了手机壁纸。\n你假装没看见，心里美得冒泡。' },
    ],
  },

  /* ---- 编程 · 做游戏 ---- */
  {
    id: 'game-1', title: '第一个玩家', min: 11, max: 15, weight: 2,
    cond: (s) => s.flags['spec_编程'] === '游戏' && !s.flags['seen:game-1'],
    text: '你和同桌的小游戏终于能跑了：画面简陋，bug 比功能多，角色走到墙角会卡住。\n但同桌接过鼠标，一声不吭玩了一整节自习课，下课才抬头：「这是我玩过最好玩的游戏。」',
    choices: [
      { t: '继续打磨，先修那个卡墙角的 bug', ok: { 智力: 1.5, 心情: 8, mem: '你们的游戏有了第一个玩家。他说的那句「最好玩」，你记了很多年。' }, okTxt: '那天晚上你修 bug 修到十一点，一点也不困。\n原来被人认真玩着自己做的东西，是这种感觉。' },
    ],
  },
  {
    id: 'game-2', title: '班级服务器', min: 13, max: 17, weight: 3,
    cond: (s) => s.flags['spec_编程'] === '游戏' && !s.flags['seen:game-2'],
    text: '你的小游戏在班里传开了。课间全是讨论攻略的声音；有人给你画了角色图，有人专门帮你找 bug，还有人提议加隐藏关卡。\n这个两个人开始的项目，长成了全班的作品。',
    choices: [
      { t: '把大家的名字都写进制作者名单', ok: { 魅力: 2, 心情: 10, mem: '游戏最终版的制作者名单很长很长——长到一个班都装下了。' }, okTxt: '毕业前，最终版刻进了十几张光盘，一人一张。\n片头滚动着四十个名字，你的排在第一行，同桌的排在第二行。' },
    ],
  },

  /* ---- 武术 · 散打 ---- */
  {
    id: 'sanda-1', title: '第一次挨重拳', min: 11, max: 15, weight: 2,
    cond: (s) => s.flags['spec_武术'] === '散打' && !s.flags['seen:sanda-1'],
    text: '实战课上，师兄一记摆拳打在你护具边缘，你眼前白了三秒，一屁股坐倒在垫子上。\n全场安静。教练走过来，没有扶你，只问了一句：「还打吗？」',
    choices: [
      { t: '扶着围绳站起来：「打。」', ok: { 体质: 2.5, 心情: 4, mem: '挨了人生第一记重拳，你扶着围绳站了起来。那天之后，师兄看你的眼神不一样了。' }, okTxt: '你站起来的时候，腿还在抖。\n但教练转身时说了句：「这孩子，能练出来。」' },
      { t: '摆摆手，今天先到这里', ok: { 心情: -3 }, okTxt: '你提前换了衣服。淋浴的水很凉，你冲了很久。\n第二天你还是来了——但那一拳，你记了很久。' },
    ],
  },
  {
    id: 'sanda-2', title: '市级比赛', min: 13, max: 17, weight: 3,
    cond: (s) => s.flags['spec_武术'] === '散打' && !s.flags['seen:sanda-2'],
    text: '市青少年散打锦标赛。你一场一场啃下来，打到半决赛，最后输在点数上。\n颁奖台上，铜牌挂上脖子的那一刻，比你想象的重得多。',
    choices: [
      { t: '把奖牌举给台下的教练看', ok: { 体质: 2, 魅力: 1.5, 心情: 10, mem: '市级比赛铜牌。教练在台下冲你挥拳，像他自己赢了。' }, okTxt: '回去的大巴上，教练说：「第三名，明年就是奔着第一去了。」\n你握着奖牌，已经开始想明年的决赛了。' },
    ],
  },

  /* ---- 武术 · 太极 ---- */
  {
    id: 'taiji-1', title: '推手', min: 11, max: 15, weight: 2,
    cond: (s) => s.flags['spec_武术'] === '太极' && !s.flags['seen:taiji-1'],
    text: '爷爷教你推手：「不顶，不丢。他使劲，你就顺着走；他收劲，你就跟着进。」\n你使尽全力一推——被一位七十岁的老人轻轻巧巧放倒在草坪上。他连呼吸都没乱。',
    choices: [
      { t: '每天早到半小时，缠着爷爷多学点', ok: { 智力: 1.5, 体质: 1, 心情: 6, mem: '被爷爷放倒一百次之后，你终于学会了「顺着走」。' }, okTxt: '第一百次被放倒时，你忽然明白了：\n原来不是爷爷力气大，是你一直在跟自己的力气较劲。' },
    ],
  },
  {
    id: 'taiji-2', title: '晨练的队伍', min: 13, max: 17, weight: 3,
    cond: (s) => s.flags['spec_武术'] === '太极' && !s.flags['seen:taiji-2'],
    text: (s) => `不知从哪天起，爷爷身后跟了一群小孩，都是冲你来的——「跟那个${s.gender === '男' ? '哥哥' : '姐姐'}学」。\n爷爷背着手站在一边笑：「以后，早课你带。」`,
    choices: [
      { t: '接下早课，从起势教起', ok: { 魅力: 1.5, 心情: 8, mem: '公园的晨练队伍里，最前面领打的人换成了你。爷爷坐在长椅上，揣着手看。' }, okTxt: '第一堂早课你紧张得同手同脚。\n收势的时候回头，爷爷正冲你点头，一下，又一下。' },
    ],
  },

  /* ============================================================
   * 组合技：两门技艺交叉，长出独有的剧情
   * ============================================================ */
  {
    id: 'combo-feast', title: '全鱼宴', min: 11, max: 17, weight: 2,
    cond: (s) => (s.skills.钓鱼 || { lvl: 0 }).lvl >= 2 && (s.skills.烹饪 || { lvl: 0 }).lvl >= 2 && !s.flags['seen:combo-feast'],
    text: '今天你钓上来一条三斤重的大草鱼，一路拎回家，街坊看了都咂舌。\n妈妈围着鱼转了两圈，忽然把围裙解下来递给你：「钓的是你，烧的也是你练的——今天这条鱼，全归你处置。」',
    choices: [
      { t: '一鱼三吃，办一桌全鱼宴', ok: { 心情: 12, 魅力: 1, skill: { name: '烹饪', xp: 4 }, mem: '一桌全鱼宴：鱼头炖汤，鱼身红烧，鱼尾清蒸。鱼是你钓的，菜是你烧的。' }, okTxt: '爸爸就着鱼汤吃了三碗饭，妈妈把你做的菜拍了发给所有亲戚。\n这一晚你明白了：会钓，是本事；会做，是温柔。' },
      { t: '还是请妈妈掌勺，我打下手', ok: { 心情: 6, 饱食: 8 }, okTxt: '妈妈烧的鱼还是那么香。你在旁边剥蒜，把做法全记在了心里。' },
    ],
  },
  {
    id: 'combo-minigame', title: '自己的小游戏', min: 11, max: 17, weight: 2,
    cond: (s) => (s.skills.绘画 || { lvl: 0 }).lvl >= 2 && (s.skills.编程 || { lvl: 0 }).lvl >= 2 && !s.flags['seen:combo-minigame'],
    text: '信息课的期末作业是「做一个作品」。别人交了演示文稿，你交了一个小游戏——\n代码是自己敲的，角色、封面、按钮，全是你一笔一笔画的。',
    choices: [
      { t: '拷给全班同学玩', ok: { 魅力: 2, 心情: 10, mem: '你的小游戏在班里传开了。代码是你写的，角色是你画的，连背景音乐都是你用口哨哼的。' }, okTxt: '一周后，全年级的电脑上都有了你的游戏。\n信息课老师在评语里写：「这是我收过最好的作业。」' },
      { t: '存在自己的文件夹里，自己玩', ok: { 心情: 4 }, okTxt: '那个文件夹你一直没删。偶尔打开玩一局，像探望一个老朋友。' },
    ],
  },
  {
    id: 'combo-lion', title: '庙会舞狮', min: 12, max: 17, weight: 2,
    cond: (s) => (s.skills.武术 || { lvl: 0 }).lvl >= 2 && s.attrs.魅力 >= 55 && !s.flags['seen:combo-lion'],
    text: '正月十五庙会，舞狮队的狮尾崴了脚，师傅急得团团转，一眼相中了看热闹的你：\n「底盘稳，眼神活——小家伙，顶一场？」',
    choices: [
      { t: '披上狮尾，上！', ok: { 体质: 2, 魅力: 2, 心情: 12, mem: '庙会上你顶着狮尾翻腾跳跃，采青那一跃，喝彩声盖过了锣鼓。' }, okTxt: '狮头一摆，你跟着腾空。落地那刻，全场喝彩。\n散场后师傅塞给你一个红包：「明年，还来！」' },
      { t: '连连摆手，怕演砸了', ok: { 心情: -2 }, okTxt: '你挤在人群里看完了整场。狮尾换人上了，动作其实还不如你稳。\n锣鼓声里，你有点后悔。' },
    ],
  },

  /* ============================================================
   * 出师礼：技艺 5 级时的收梢事件
   * ============================================================ */
  {
    id: 'master-绘画', title: '最后一幅学生作品', min: 12, max: 17, weight: 5,
    cond: (s) => (s.skills.绘画 || { lvl: 0 }).lvl >= 5 && !s.flags['master:绘画'] && !s.flags['seen:master-绘画'],
    text: '毕业前，你画完了这一世作为学生的最后一幅画。装裱那天，来看的人比想象的多——\n少年宫的老师说，要把这幅画留在走廊里，挂给后来的孩子们看。',
    choices: [
      { t: '在画的角落，签下自己的名字', ok: { 心情: 14, flag: { 'master:绘画': true }, mem: '你的毕业画作被装裱起来，挂在了少年宫的走廊里。角落有你的签名。' }, okTxt: '签完名你退后两步，看了很久。\n一支画笔陪你走过了这么多年——它替你记住了你看世界的目光。' },
    ],
  },
  {
    id: 'master-乐器', title: '压轴的最后一个音', min: 12, max: 17, weight: 5,
    cond: (s) => (s.skills.乐器 || { lvl: 0 }).lvl >= 5 && !s.flags['master:乐器'] && !s.flags['seen:master-乐器'],
    text: '毕业演出的压轴节目是你的。报幕声落下，全场的灯暗下来，只留你和你怀里的老伙计。\n这些年所有的练习，都走到了这一个晚上。',
    choices: [
      { t: '深吸一口气，开始', ok: { 心情: 14, 魅力: 1, flag: { 'master:乐器': true }, mem: '毕业演出的压轴，掌声是从最后一个音落地开始响的，响了很久很久。' }, okTxt: '最后一个音落下来，你听见掌声从礼堂最后一排涌过来。\n鞠躬时你在想：以后不管走到哪里，都要带着它。' },
    ],
  },
  {
    id: 'master-武术', title: '出师', min: 12, max: 17, weight: 5,
    cond: (s) => (s.skills.武术 || { lvl: 0 }).lvl >= 5 && !s.flags['master:武术'] && !s.flags['seen:master-武术'],
    text: '这天训练结束，你被单独留了下来。对方上上下下打量你很久，忽然说：\n「从明天起，你不用来了——我没什么可教你的了。」',
    choices: [
      { t: '站直，鞠一个最深的躬', ok: { 心情: 14, 体质: 1, flag: { 'master:武术': true }, mem: '出师那天，你鞠了一个最深的躬。教练/师父背过身去，挥了挥手。' }, okTxt: '你鞠完躬抬头，对方已经背过身去，只挥了挥手。\n走出很远你回头看——那个人还站在原地，看着你的方向。' },
    ],
  },
  {
    id: 'master-编程', title: '按下发布键', min: 12, max: 17, weight: 5,
    cond: (s) => (s.skills.编程 || { lvl: 0 }).lvl >= 5 && !s.flags['master:编程'] && !s.flags['seen:master-编程'],
    text: '毕业前，你把最后一个 bug 修完，按下了发布键。\n你的作品挂进了学校机房的共享盘。一周后，下载量：全班，加半个年级。',
    choices: [
      { t: '在 README 里写下第一行：献给这个班', ok: { 心情: 14, 智力: 1, flag: { 'master:编程': true }, mem: '你的作品挂在学校机房的共享盘上，一届一届传了下去。README 第一行写着：献给这个班。' }, okTxt: '很多年后回母校，机房的电脑里居然还有它。\n图标都被双击得褪了色。' },
    ],
  },
  {
    id: 'master-烹饪', title: '一个人的年夜饭', min: 12, max: 17, weight: 5,
    cond: (s) => (s.skills.烹饪 || { lvl: 0 }).lvl >= 5 && !s.flags['master:烹饪'] && !s.flags['seen:master-烹饪'],
    text: '今年除夕，你宣布：年夜饭从买菜到洗碗，全归你一个人。爸妈被按在沙发上看春晚，不许进厨房。\n晚上八点，八道菜准时上桌。',
    choices: [
      { t: '看全家把最后一口吃完', ok: { 心情: 14, flag: { 'master:烹饪': true }, mem: '那一年的年夜饭是你一个人做的。妈妈边吃边拍照，爸爸喝了三杯。' }, okTxt: '妈妈吃第一口就红了眼眶：「以后……年夜饭都归你了啊。」\n你笑着应下来。厨房里的烟火气，从此有了接班人。' },
    ],
  },
  {
    id: 'master-钓鱼', title: '放流', min: 12, max: 17, weight: 5,
    cond: (s) => (s.skills.钓鱼 || { lvl: 0 }).lvl >= 5 && !s.flags['master:钓鱼'] && !s.flags['seen:master-钓鱼'],
    text: '守了整整一个下午，浮漂猛地一沉——你钓上了这辈子最大的一条鱼，拉上岸时胳膊都在抖。\n拍照留念之后，你蹲下来，托着它，轻轻放回了水里。',
    choices: [
      { t: '看它摆尾游走', ok: { 心情: 14, flag: { 'master:钓鱼': true }, mem: '你钓上了最大的一条鱼，又把它放回了水里。钓鱼的尽头，不是鱼。' }, okTxt: '大鱼摆了摆尾，消失在深水处。\n你忽然懂了老爷子们常说的那句话：钓的是鱼，守的是心。' },
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
  8: {
    id: 'm8', title: '长大以后……',
    text: '语文课上，老师让大家轮流说：长大以后想做什么。\n有人说要当医生，有人说要开飞机。教室里热闹极了。\n轮到你了——',
    choices: [
      { t: '「我要当科学家！」', ok: { flag: { dream: 'science' }, 智力: 1, mem: '八岁那年，你说你想当科学家。' }, okTxt: DREAM_OKTXT },
      { t: '「我要当运动员！」', ok: { flag: { dream: 'sports' }, 体质: 1, mem: '八岁那年，你说你想当运动员。' }, okTxt: DREAM_OKTXT },
      { t: '「我要当艺术家！」', ok: { flag: { dream: 'art' }, 魅力: 1, mem: '八岁那年，你说你想当艺术家。' }, okTxt: DREAM_OKTXT },
      { t: '「我要吃遍天下美食！」', ok: { flag: { dream: 'food' }, 心情: 4, mem: '八岁那年，你立志要吃遍天下美食。' }, okTxt: DREAM_OKTXT },
      { t: '「我要当有钱人！」', ok: { flag: { dream: 'money' }, 心情: 2, mem: '八岁那年，你大声宣布以后要当有钱人。' }, okTxt: DREAM_OKTXT },
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
      const score = s.attrs.智力 + s.needs.心情 * 0.15 + rand(0, 20) + (((s.skills.编程 || { lvl: 0 }).lvl >= 4) ? 6 : 0);
      if (score >= 98) { s.exam = '重点高中'; return { title: '中考 · 金榜题名', okTxt: '重点高中！你盯着录取通知看了很久，手都有点抖。' }; }
      if (score >= 80) { s.exam = '普通高中'; return { title: '中考 · 尘埃落定', okTxt: '普通高中。不算惊艳，但也是个新起点。' }; }
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

/* ---------------- 家境暗线保底调度：到年龄未触发则补弹 ---------------- */
const FAMILY_ARC = {
  poor: [
    { age: 6, id: 'poor-hands' },
    { age: 10, id: 'poor-sewing' },
    { age: 14, a: 'poor-finale-a', b: 'poor-finale-b', okFlags: ['poorArc1', 'poorArc2'] },
  ],
  middle: [
    { age: 7, id: 'mid-table' },
    { age: 11, id: 'mid-bike' },
    { age: 15, a: 'mid-finale-a', b: 'mid-finale-b', okFlags: ['midArc1', 'midArc2'] },
  ],
  rich: [
    { age: 5, id: 'rich-nanny' },
    { age: 9, id: 'rich-meeting' },
    { age: 14, a: 'rich-finale-a', b: 'rich-finale-b', okFlags: ['richArc1', 'richArc2'] },
  ],
};

function checkFamilyArc() {
  const steps = FAMILY_ARC[S.familyKey];
  if (!steps) return;
  steps.forEach((st) => {
    if (S.age < st.age) return;
    if (st.a) {
      if (S.flags['seen:' + st.a] || S.flags['seen:' + st.b]) return;
      const ok = st.okFlags.every((f) => S.flags[f]);
      const ev = EVENTS.find((e) => e.id === (ok ? st.a : st.b));
      if (ev) milestoneQueue.push(ev);
    } else if (!S.flags['seen:' + st.id]) {
      const ev = EVENTS.find((e) => e.id === st.id);
      if (ev) milestoneQueue.push(ev);
    }
  });
}

/* ---------------- 羁绊保底调度 ---------------- */
function checkBondArc() {
  const b = S.flags.bond;
  if (!b) return;
  const steps = [
    { age: 6, id: `bond-${b}-1` },
    { age: 11, id: `bond-${b}-2` },
    { age: 16, a: `bond-${b}-3a`, b: `bond-${b}-3b` },
  ];
  steps.forEach((st) => {
    if (S.age < st.age) return;
    if (st.a) {
      if (S.flags['seen:' + st.a] || S.flags['seen:' + st.b]) return;
      const ok = S.flags.bondA1 && S.flags.bondA2;
      const ev = EVENTS.find((e) => e.id === (ok ? st.a : st.b));
      if (ev) milestoneQueue.push(ev);
    } else if (!S.flags['seen:' + st.id]) {
      const ev = EVENTS.find((e) => e.id === st.id);
      if (ev) milestoneQueue.push(ev);
    }
  });
}

/* ---------------- 年少欢喜保底调度 ---------------- */
function checkCrushArc() {
  const steps = [
    { age: 12, id: 'crush-1' },
    { age: 14, id: 'crush-2' },
    { age: 16, a: 'crush-3a', b: 'crush-3b' },
  ];
  steps.forEach((st) => {
    if (S.age < st.age) return;
    if (st.a) {
      if (S.flags['seen:' + st.a] || S.flags['seen:' + st.b]) return;
      const ok = S.flags.crushA1 && S.flags.crushA2;
      const ev = EVENTS.find((e) => e.id === (ok ? st.a : st.b));
      if (ev) milestoneQueue.push(ev);
    } else if (!S.flags['seen:' + st.id]) {
      const ev = EVENTS.find((e) => e.id === st.id);
      if (ev) milestoneQueue.push(ev);
    }
  });
}

let milestoneQueue = [];

function checkMilestones() {
  const m = MILESTONES[S.age];
  if (m) milestoneQueue.push(m);
  checkFamilyArc();
  checkBondArc();
  checkCrushArc();
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
    if (e.maxLife) {
      S.flags.evCount = S.flags.evCount || {};
      if ((S.flags.evCount[e.id] || 0) >= e.maxLife) return false;
    }
    if (e.cond && !e.cond(S)) return false;
    return true;
  });
  if (!pool.length) return null;
  pool.sort((a, b) => (b.weight || 1) - (a.weight || 1));
  return pick(pool);
}

function openEvent(ev, isMilestone = false) {
  eventLock = true;
  currentEventId = ev && ev.id ? ev.id : null;
  if (ev && ev.id) {
    S.flags['seen:' + ev.id] = true;
    S.flags.evCount = S.flags.evCount || {};
    S.flags.evCount[ev.id] = (S.flags.evCount[ev.id] || 0) + 1;
  }
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
  saveGame(); // 弹窗状态也存档（刷新后事件重开）
}

let pendingAnim = null; // 事件弹窗关闭后要播的小人动画

function resolveChoice(ev, c, isMilestone) {
  $('event-choices').classList.add('hidden');
  const pass = checkPass(c.check);
  const eff = pass ? c.ok : (c.fail || {});
  applyEffects(eff);
  pendingAnim = pass ? (eff && eff.mem ? 'celebrate' : null) : (c.fail ? 'trip' : null);
  let txt = pass ? (c.okTxt || (eff && eff.mem ? '……' : '')) : (c.failTxt || '');
  if (!txt) txt = pass ? '（什么事也没有发生。）' : '（失败了。）';
  if (!pass && c.fail && c.fail.mem) txt = c.fail.mem + '\n' + txt;
  $('event-result-text').textContent = txt;
  $('event-result').classList.remove('hidden');
  $('event-continue').onclick = () => {
    $('modal-event').classList.add('hidden');
    eventLock = false;
    currentEventId = null;
    if (pendingAnim) { const pa = pendingAnim; pendingAnim = null; setTimeout(() => actorAnim(pa), 80); }
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
/* 每个场景三层：far 远景天际线（淡墨）· mid 主体建筑 · near 前景小物（浓一点）
 * 三层随鼠标视差移动；.win 夜晚亮灯；.lamp-dot/.lamp-halo 傍晚起亮 */
/* 三种家境的家：贫寒漏风平房（屋顶低歪、补丁、关不严的门、墙缝）
 * 小康坡顶小屋 · 富贵大屋檐四合院（飞檐、灯笼、窗棂） */
const HOME_MID = {
  /* 贫寒：歪斜的低平房 —— 屋顶一块补丁、一扇关不严的门、一道墙缝，各自留足间距 */
  poor: `<svg viewBox="0 0 220 110" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M48 60 L106 32 L170 54"/>
      <path d="M120 41 l15 -4 6 10 -15 4 z"/>
      <path d="M54 60 L52 102 M164 54 L168 102"/>
      <path d="M94 78 V102 M94 78 H118 V97"/>
      <rect class="win" x="63" y="68" width="15" height="13"/>
      <path d="M140 66 l3 8 -2 8 4 9" stroke-width="1.7"/>
      <path d="M15 102 H205"/></svg>`,
  /* 小康：坡顶小屋 + 烟囱炊烟 */
  middle: `<svg viewBox="0 0 220 110" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M30 60 L110 18 L190 60"/>
      <rect x="142" y="22" width="10" height="20"/>
      <circle cx="147" cy="18" r="3"><animate attributeName="cy" values="20;4" dur="3.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.75;0" dur="3.4s" repeatCount="indefinite"/></circle>
      <circle cx="148" cy="18" r="2.2"><animate attributeName="cy" values="20;2" dur="3.4s" begin="-1.7s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.6;0" dur="3.4s" begin="-1.7s" repeatCount="indefinite"/></circle>
      <rect x="48" y="60" width="124" height="42"/>
      <rect x="96" y="74" width="26" height="28"/><rect class="win" x="60" y="70" width="18" height="16"/><rect class="win" x="144" y="70" width="18" height="16"/>
      <path d="M15 102 H205"/></svg>`,
  /* 富贵：大屋檐四合院，灯笼挂在门窗之间的空白处 */
  rich: `<svg viewBox="0 0 220 110" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M24 58 L110 20 L196 58"/>
      <path d="M24 58 q-7 1 -10 9 M196 58 q7 1 10 9"/>
      <rect x="42" y="58" width="136" height="44"/>
      <rect x="96" y="72" width="28" height="30"/><path d="M90 72 h40"/>
      <rect class="win" x="54" y="68" width="17" height="16"/><path d="M62 68 v16 M54 76 h17" stroke-width="1.5"/>
      <rect class="win" x="149" y="68" width="17" height="16"/><path d="M157 68 v16 M149 76 h17" stroke-width="1.5"/>
      <g><animateTransform attributeName="transform" type="rotate" values="-4 82 58; 4 82 58; -4 82 58" dur="3.6s" repeatCount="indefinite"/>
        <path d="M82 58 v5"/><circle cx="82" cy="67" r="4.5"/></g>
      <g><animateTransform attributeName="transform" type="rotate" values="4 138 58; -4 138 58; 4 138 58" dur="4.1s" repeatCount="indefinite"/>
        <path d="M138 58 v5"/><circle cx="138" cy="67" r="4.5"/></g>
      <path d="M15 102 H205"/></svg>`,
};

/* 构图分区约定（viewBox 220×110，地面线 y=102）：
 * far  只画远处剪影与云，线条少而淡，地面略高（配合 CSS 抬升），绝不与主体抢戏
 * mid  主体建筑居中，门窗屋顶各自留间距
 * near 只放两侧角落小物（x≤40 或 x≥180），中间留作小人走位廊道 */
const ART = {
  home: {
    far: `<svg viewBox="0 0 220 110" fill="none" stroke="#8a867d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 102 Q56 84 108 94 T216 88"/>
      <path d="M20 102 V72 h18 v30 M184 102 V78 h16 v24" stroke-width="1.8"/>
      <g><animateTransform attributeName="transform" type="translate" values="0 0;16 0;0 0" dur="26s" repeatCount="indefinite"/>
        <path d="M60 22 q7 -7 14 0 q8 -5 13 2"/></g>
    </svg>`,
    mid: () => HOME_MID[S.familyKey] || HOME_MID.middle,
    near: `<svg viewBox="0 0 220 110" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 102 V64 M10 68 H34"/>
      <g><animateTransform attributeName="transform" type="rotate" values="-3 20 68; 3 20 68; -3 20 68" dur="3.8s" repeatCount="indefinite"/>
        <path d="M16 68 h8 v12 h-8 z"/></g>
      <g><animateTransform attributeName="transform" type="rotate" values="2 30 68; -2 30 68; 2 30 68" dur="4.6s" repeatCount="indefinite"/>
        <path d="M27 68 h6 v9 h-6 z"/></g>
      <path d="M186 102 q2 -7 4 0 M192 102 q2 -9 4 0 M198 102 q2 -6 4 0 M204 102 q2 -8 4 0"/>
    </svg>`,
  },
  park: {
    far: `<svg viewBox="0 0 220 110" fill="none" stroke="#8a867d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 100 Q40 84 74 94 T146 92 T214 88"/>
      <path d="M172 100 V70 h12 v30 M188 100 V78 h10 v22" stroke-width="1.8"/>
      <g><animateTransform attributeName="transform" type="translate" values="0 0;10 -6;0 0;-8 -3;0 0" dur="14s" repeatCount="indefinite"/>
        <path d="M150 20 l7 9 -7 9 -7 -9 z"/><path d="M150 38 q2 6 -2 10 q-4 4 -1 9" stroke-dasharray="2 3"/></g>
      <g><animateTransform attributeName="transform" type="translate" values="0 0;20 2;0 0" dur="18s" repeatCount="indefinite"/>
        <path d="M56 26 q4 -4 8 0 q4 -4 8 0"/></g>
    </svg>`,
    mid: `<svg viewBox="0 0 220 110" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <g><animateTransform attributeName="transform" type="rotate" values="-2.2 40 102; 2.2 40 102; -2.2 40 102" dur="5.2s" repeatCount="indefinite"/>
        <path d="M40 102 V55"/><circle cx="40" cy="42" r="18"/></g>
      <g><animateTransform attributeName="transform" type="rotate" values="1.8 80 102; -1.8 80 102; 1.8 80 102" dur="4.3s" repeatCount="indefinite"/>
        <path d="M80 102 V65"/><circle cx="80" cy="55" r="13"/></g>
      <path d="M120 92 h50 M126 92 v-16 h38 v16"/><path d="M126 76 q19 -10 38 0"/>
      <path d="M10 102 H210"/></svg>`,
    near: `<svg viewBox="0 0 220 110" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M196 102 V64 q0 -5 6 -5"/>
      <circle class="lamp-halo" cx="203" cy="61" r="7"/>
      <circle class="lamp-dot" cx="203" cy="61" r="3"/>
      <path d="M14 102 q2 -7 4 0 M20 102 q2 -9 4 0 M26 102 q2 -6 4 0 M176 102 q2 -7 4 0 M182 102 q2 -8 4 0"/>
      <g><animateTransform attributeName="transform" type="translate" values="0 0;6 -5;12 0" dur="5s" repeatCount="indefinite"/>
        <path d="M96 74 q-4 -4 -1 -7 q3 1 3 5 q0 -4 3 -5 q3 3 -1 7 z"/></g>
    </svg>`,
  },
  school: {
    far: `<svg viewBox="0 0 220 110" fill="none" stroke="#8a867d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 102 V66 h26 v36 M186 102 V72 h22 v30"/>
      <g><animateTransform attributeName="transform" type="translate" values="0 0;-14 0;0 0" dur="22s" repeatCount="indefinite"/>
        <path d="M150 18 q7 -7 14 0 q8 -5 13 2"/></g>
    </svg>`,
    mid: `<svg viewBox="0 0 220 110" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="45" y="35" width="130" height="67"/><path d="M45 35 L110 12 L175 35"/>
      <path d="M110 12 V30"/>
      <g><animateTransform attributeName="transform" type="rotate" values="0 110 14; 5 110 14; -3 110 14; 0 110 14" dur="2.8s" repeatCount="indefinite"/>
        <path d="M110 14 l24 6 -24 7"/></g>
      <rect x="98" y="70" width="24" height="32"/>
      <rect class="win" x="60" y="50" width="16" height="14"/><rect class="win" x="144" y="50" width="16" height="14"/>
      <path d="M15 102 H205"/></svg>`,
    near: `<svg viewBox="0 0 220 110" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 108 Q110 93 212 108" stroke-dasharray="5 6"/>
      <path d="M186 102 v-8 h10 v8 M191 94 v-8 h10 v8" stroke-width="2"/>
      <path d="M22 102 v-6 M19 96 q3 -4 6 0 M18 102 q2 -5 4 0 M28 102 q2 -6 4 0"/>
    </svg>`,
  },
  square: {
    far: `<svg viewBox="0 0 220 110" fill="none" stroke="#8a867d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 102 V52 h20 v50 M30 102 V64 h14 v38 M172 102 V58 h20 v44 M196 102 V72 h16 v30"/>
      <path d="M18 52 V40"/>
      <path d="M126 46 h24 v13 h-24 z M138 59 V76" stroke-width="1.8"/>
    </svg>`,
    mid: `<svg viewBox="0 0 220 110" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M30 45 h90 l-8 14 h-74 z"/><path d="M40 59 v43 M110 59 v43 M40 70 h70 M40 82 h70"/>
      <path d="M75 45 V25"/>
      <g><animateTransform attributeName="transform" type="rotate" values="-3 75 25; 3 75 25; -3 75 25" dur="3.1s" repeatCount="indefinite"/>
        <path d="M75 25 h40 l-6 10 h-34"/></g>
      <g><animateTransform attributeName="transform" type="rotate" values="-1.6 160 102; 1.6 160 102; -1.6 160 102" dur="5.6s" repeatCount="indefinite"/>
        <circle cx="160" cy="80" r="12"/><path d="M160 92 v10 M152 102 h16"/></g>
      <path d="M10 102 H210"/></svg>`,
    near: `<svg viewBox="0 0 220 110" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 102 q2 -6 4 0 M20 102 q2 -8 4 0 M26 102 q2 -5 4 0"/>
      <path d="M184 94 h28 M188 94 v8 M208 94 v8"/>
      <g><animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="3.4s" repeatCount="indefinite"/>
        <circle cx="170" cy="50" r="6"/><path d="M170 56 q-2 8 1 14"/></g>
      <g><animateTransform attributeName="transform" type="rotate" values="0 92 102; 16 92 102; 0 92 102" dur="1.8s" repeatCount="indefinite"/>
        <path d="M88 102 q2 -6 6 -6 q4 0 4 5"/></g>
    </svg>`,
  },
  market: {
    far: `<svg viewBox="0 0 220 110" fill="none" stroke="#8a867d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 102 V68 h28 v34 M6 68 l4 -8 h20 l4 8 M186 102 V74 h26 v28 M186 74 l3 -6 h20 l3 6"/>
      <g><animateTransform attributeName="transform" type="translate" values="0 0;12 0;0 0" dur="26s" repeatCount="indefinite"/>
        <path d="M60 20 q7 -7 14 0 q8 -5 13 2"/></g>
    </svg>`,
    mid: `<svg viewBox="0 0 220 110" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <g><animateTransform attributeName="transform" type="rotate" values="-1.2 100 40; 1.2 100 40; -1.2 100 40" dur="4.4s" repeatCount="indefinite"/>
        <path d="M35 40 h120 l10 16 h-140 z"/><path d="M48 40 q6 -12 12 0 q6 -12 12 0 q6 -12 12 0 q6 -12 12 0 q6 -12 12 0 q6 -12 12 0 q6 -12 12 0 q6 -12 12 0 q6 -12 12 0 q6 -12 12 0 q6 -12 12 0 q6 -12 12 0"/></g>
      <rect x="48" y="56" width="94" height="46"/><circle cx="70" cy="76" r="7"/><circle cx="95" cy="78" r="8"/><circle cx="120" cy="75" r="6"/>
      <path d="M10 102 H210"/></svg>`,
    near: `<svg viewBox="0 0 220 110" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 92 h28 l-4 10 H16 z M14 92 q12 -8 24 0"/>
      <circle cx="22" cy="88" r="3"/><circle cx="30" cy="87" r="3.4"/>
      <path d="M182 94 h22 M185 94 v8 h16 v-8"/>
      <circle cx="190" cy="86" r="1.8"><animate attributeName="cy" values="88;76" dur="2.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.7;0" dur="2.2s" repeatCount="indefinite"/></circle>
      <circle cx="196" cy="86" r="1.4"><animate attributeName="cy" values="88;74" dur="2.2s" begin="-1.1s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.55;0" dur="2.2s" begin="-1.1s" repeatCount="indefinite"/></circle>
    </svg>`,
  },
  hospital: {
    far: `<svg viewBox="0 0 220 110" fill="none" stroke="#8a867d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 102 V62 h26 v40 M186 102 V70 h24 v32"/>
      <g><animateTransform attributeName="transform" type="translate" values="0 0;-12 0;0 0" dur="21s" repeatCount="indefinite"/>
        <path d="M140 20 q7 -7 14 0 q8 -5 13 2"/></g>
    </svg>`,
    mid: `<svg viewBox="0 0 220 110" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="60" y="28" width="100" height="74"/>
      <path class="keep-accent" d="M110 40 v24 M98 52 h24" stroke="#b3382c"><animate attributeName="opacity" values="1;.4;1" dur="1.8s" repeatCount="indefinite"/></path>
      <rect class="win" x="72" y="70" width="16" height="14"/><rect class="win" x="132" y="70" width="16" height="14"/>
      <path d="M50 28 h120" stroke-dasharray="4 5"/>
      <path d="M15 102 H205"/></svg>`,
    near: `<svg viewBox="0 0 220 110" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 94 h30 M18 94 v8 M40 94 v8"/>
      <path d="M192 102 V86 M192 86 q-8 -2 -10 -10 q8 0 10 4 q2 -4 10 -4 q-2 8 -10 10"/>
      <path d="M96 102 q2 -6 4 0 M102 102 q2 -7 4 0"/>
    </svg>`,
  },
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
      const lvl = (S.skills.钓鱼 || { lvl: 1 }).lvl;
      if (lvl >= 5 && chance(0.07)) {
        gainMoney(5);
        addLog('你钓上来一个锈铁盒，里面躺着几枚旧硬币。', 'event');
        remember('你钓上来一只锈铁盒，像钓上来一段别人的故事。');
        return;
      }
      gainNeed('娱乐', 14); gainSkill('钓鱼', 2);
      const roll = Math.random();
      if (roll < 0.3) addLog('钓上一团水草。你把它甩回了湖里。');
      else if (roll < 0.45) { gainMoney(1); addLog('钓上一只旧皮鞋，居然抖出一枚硬币。'); }
      else if (roll < 0.8) { gainNeed('饱食', 10); addLog('钓上一条小鱼！晚上可以加餐了。'); }
      else { gainSkill('钓鱼', 4); addLog('鱼没钓到，但你把「姜太公钓鱼」理解透了。'); }
    } },
  { id: 'watch', loc: 'park', label: '观察花鸟虫鱼', cond: () => S.age <= 9, run: () => {
      gain('智力', 0.4 * S.apt.学习); gainNeed('心情', 3);
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
      gainMoney(-8); gain('智力', 1.2);
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
  { id: 'chess', loc: 'square', label: '棋摊看棋', cond: () => S.age >= 6, run: () => { gain('智力', 0.4); gainNeed('娱乐', 6); addLog('你在棋摊边看了两盘，似懂非懂。'); } },
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

/* 幽灵条预览：行动 → 身心条上的"影子"（约值，只示意方向与幅度，不出数字） */
const ACT_HINTS = {
  meal: () => ({ 饱食: S.family.meal, 心情: 4 }),
  sleep: { 精力: 100, 清洁: -6 },
  wash: { 清洁: 42, 心情: 2 },
  play: { 娱乐: 26, 心情: 7 },
  study: { 娱乐: -6, 精力: -3 },
  exercise: { 精力: -9, 清洁: -4 },
  chore: { 心情: 3 },
  art: { 心情: 4 },
  cook: { 饱食: 42 },
  chat: { 心情: 9 },
  walk: { 心情: 7 },
  slide: { 娱乐: 24, 心情: 6 },
  fish: { 娱乐: 14 },
  watch: { 心情: 3 },
  class: { 精力: -8, 娱乐: -6, 心情: -3 },
  skip: { 娱乐: 10, 心情: 6 },
  club: { 娱乐: 10 },
  toy: { 娱乐: 32, 心情: 8 },
  snack: { 饱食: 26, 心情: 4 },
  artist: { 娱乐: 14, 心情: 4 },
  chess: { 娱乐: 6 },
  deli: { 饱食: 44, 心情: 3 },
  cure: { 健康: 38 },
  checkup: { 健康: 5 },
};

/* ============================================================
 * 渲染
 * ============================================================ */
function setBar(id, v) {
  const el = $(id);
  el.style.width = clamp(v, 0, 100) + '%';
  const dir = barFlash[id];
  if (dir && el.parentNode && el.parentNode.classList) {
    const bar = el.parentNode;
    bar.classList.remove('flash-up', 'flash-down');
    void bar.offsetWidth; // 重触发动画
    bar.classList.add('flash-' + dir);
    delete barFlash[id];
  }
}

function render() {
  if (!S) return;
  saveGame(); // 每次渲染即自动存档
  clearHints();
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
  // 心愿
  $('ui-dream').innerHTML = S.flags.dream
    ? `<span class="tag dream-tag" title="心愿：${DREAMS[S.flags.dream].name}">心愿 · ${DREAMS[S.flags.dream].name}</span>`
    : '<span class="dim">八岁那年，会有答案</span>';
  // 换了地点，小人回到默认站位
  if (render._loc !== S.location) { render._loc = S.location; actorGo(null); }
  // 小人精神状态
  const actor = $('actor');
  const weak = S.needs.精力 < 25 || S.needs.健康 < 30;
  if (weak) actor.classList.add('weak'); else actor.classList.remove('weak');
  if (!weak && S.needs.心情 >= 80) actor.classList.add('happy'); else actor.classList.remove('happy');
  // 随年龄长大
  const ageCls = S.age <= 6 ? 'age-s' : S.age <= 12 ? 'age-m' : 'age-l';
  ['age-s', 'age-m', 'age-l'].forEach((c) => actor.classList.remove(c));
  actor.classList.add(ageCls);
  const fx = $('actor-fx'); // 情绪气泡层同步缩放
  if (fx && fx.classList) {
    ['age-s', 'age-m', 'age-l'].forEach((c) => fx.classList.remove(c));
    fx.classList.add(ageCls);
  }
  // 情绪气泡
  if (S.needs.心情 < 25) actor.classList.add('moodlow'); else actor.classList.remove('moodlow');
  if (S.buffs.some((b) => b.name === '感冒')) actor.classList.add('sick'); else actor.classList.remove('sick');
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
  // 场景（三层：远 / 中 / 近，随鼠标视差）
  const art = ART[S.location];
  const midArt = typeof art.mid === 'function' ? art.mid() : art.mid;
  $('scene-art').innerHTML =
    `<div class="lyr lyr-far">${art.far}</div>` +
    `<div class="lyr lyr-mid">${midArt}</div>` +
    `<div class="lyr lyr-near">${art.near}</div>`;
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
      if (btn._lp) { btn._lp = false; return; }   // 长按预览后不触发行动
      Sound.play('pop');
      btn.classList.add('clicked');
      setTimeout(() => btn.classList.remove('clicked'), 320);
      doAction(a.run, ACT_ANIM[a.id] || 'stand', a.id);
    };
    // 幽灵条预览：悬停/聚焦时，身心条上浮现"会补到哪、会耗到哪"
    const hintSrc = ACT_HINTS[a.id];
    if (hintSrc && btn.addEventListener) {
      const show = () => showHint(typeof hintSrc === 'function' ? hintSrc() : hintSrc);
      btn.addEventListener('mouseenter', show);
      btn.addEventListener('mouseleave', clearHints);
      btn.addEventListener('focus', show);
      btn.addEventListener('blur', clearHints);
      // 触屏没有悬停：长按 0.32s 出预览，松手消失且不执行行动
      let lpTimer = null, lpFired = false;
      btn.addEventListener('touchstart', () => {
        lpFired = false;
        lpTimer = setTimeout(() => { lpFired = true; show(); }, 320);
      }, { passive: true });
      btn.addEventListener('touchend', () => {
        clearTimeout(lpTimer);
        if (lpFired) { btn._lp = true; setTimeout(() => { btn._lp = false; }, 600); }
        setTimeout(clearHints, 500);
      });
      btn.addEventListener('touchcancel', () => { clearTimeout(lpTimer); clearHints(); });
    }
    box.appendChild(btn);
  });
  // 日志
  $('log').innerHTML = S.log.map((l) =>
    `<p class="${l.cls || ''}">【${l.age}岁·${l.day}日】${l.text}</p>`).join('');
  // 移动端：最新一条日志做成字幕条（S.log 新的在前）
  const ticker = $('log-ticker');
  if (ticker) {
    const latest = S.log[0];
    ticker.textContent = latest ? latest.text : '';
    ticker.classList.remove('tick-in');
    void ticker.offsetWidth;
    ticker.classList.add('tick-in');
  }
  // 移动端：资质折叠摘要
  const atg = $('attrs-toggle');
  if (atg) atg.textContent = `资质 · 体 ${Math.round(S.attrs.体质)} · 智 ${Math.round(S.attrs.智力)} · 魅 ${Math.round(S.attrs.魅力)} ▾`;
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
  if (S.flags.dream) {
    const dn = DREAMS[S.flags.dream].name;
    lines.push(dreamFulfilled()
      ? `你八岁那年的愿望是「${dn}」。回头看，你已经把它攥在了手里。`
      : `你八岁那年的愿望是「${dn}」。这个愿望，就先轻轻放下吧。`);
  }
  const sks = Object.entries(S.skills);
  if (sks.length) lines.push(`这些年你学会了：${sks.map(([n, v]) => `${n}（${v.lvl}级）`).join('、')}。`);
  const MASTER_TAIL = {
    绘画: '你的毕业画作，还挂在少年宫的走廊里。',
    乐器: '毕业演出的压轴掌声，是给你的。',
    武术: '你是教练逢人便夸的那个徒弟。',
    编程: '学校机房的共享盘上，你的作品还在被一届届下载。',
    烹饪: '家里的年夜饭，从那一年起就归你掌勺了。',
    钓鱼: '你放流的那条大鱼，成了河边钓友间的传说。',
  };
  const masterTails = Object.keys(MASTER_TAIL).filter((n) => S.flags['master:' + n]).map((n) => MASTER_TAIL[n]);
  if (masterTails.length) lines.push(masterTails.join(''));
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

/* ============================================================
 * 存档系统：刷新 / 退出重进，这一世接着过
 * —— 人生仍无法读档重来，只是允许「中场休息」
 * ============================================================ */
function saveGame() {
  if (!S || !S.alive) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1,
      state: S,
      pendingEvent: eventLock ? currentEventId : null,
      queue: milestoneQueue.map((m) => m.id).filter(Boolean),
      savedAt: Date.now(),
    }));
  } catch (e) { /* 存储失败不打扰 */ }
}
function loadSave() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!d || d.v !== 1 || !d.state || !d.state.attrs || !d.state.needs || !d.state.flags) return null;
    return d;
  } catch (e) { return null; }
}
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 忽略 */ }
}
function findEventById(id) {
  if (!id) return null;
  return EVENTS.find((e) => e.id === id) || Object.values(MILESTONES).find((m) => m.id === id) || null;
}
function resumeLife() {
  const d = loadSave();
  if (!d) return false;
  S = d.state;
  eventLock = false;
  currentEventId = null;
  milestoneQueue = (d.queue || []).map(findEventById).filter(Boolean);
  Sound.play('page');
  $('screen-start').classList.add('hidden');
  $('screen-end').classList.add('hidden');
  $('screen-game').classList.remove('hidden');
  render();
  if (d.pendingEvent) {
    const ev = findEventById(d.pendingEvent);
    if (ev) { openEvent(ev, /^m\d+$/.test(ev.id)); return true; }
  }
  if (milestoneQueue.length) runMilestones();
  return true;
}

function endLife(cause) {
  if (!S || !S.alive) return;
  S.alive = false;
  eventLock = false;
  currentEventId = null;
  clearSave(); // 这一世落幕，存档随之消散
  Sound.play('bell');
  const verdict = buildVerdict(cause);
  const tags = computeTags(cause);
  saveMemorial({
    name: S.name, gender: S.gender, family: S.family.name,
    age: S.age, days: S.day, verdict: shortVerdict(), cause,
    dream: S.flags.dream ? DREAMS[S.flags.dream].name : null,
    tags,
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
    (S.exam ? `<span class="tag">${S.exam}</span>` : '') +
    tags.map((t) => `<span class="tag life-tag" title="${ALL_TAGS[t] || ''}">${t}</span>`).join('');
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
  clearSave(); // 新的一世，旧的存档让位
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
  const collected = new Set();
  list.forEach((m) => (m.tags || []).forEach((t) => collected.add(t)));
  const all = Object.keys(ALL_TAGS);
  let html = `<div class="codex"><h3>人生图鉴 · 已收集 ${collected.size}/${all.length}</h3><div class="codex-tags">` +
    all.map((t) => collected.has(t)
      ? `<span class="tag" title="${ALL_TAGS[t]}">${t}</span>`
      : `<span class="tag dim-tag" title="${ALL_TAGS[t]}">？？？</span>`).join('') +
    `</div></div>`;
  html += list.length
    ? list.map((m) => `<div class="mem-item"><span class="mem-name">${m.name}</span>（${m.gender} · ${m.family}）<br>
        ${m.cause === '夭' ? `${m.age} 岁早夭` : `平安长到 ${m.age} 岁`} · ${m.verdict} <span class="dim">${m.when}</span>` +
        (m.dream ? `<br><span class="dim">心愿：${m.dream}</span>` : '') +
        ((m.tags && m.tags.length) ? `<div class="mem-tags">${m.tags.map((t) => `<span class="tag" title="${ALL_TAGS[t] || ''}">${t}</span>`).join('')}</div>` : '') +
        `</div>`).join('')
    : '<div class="empty">往生录还是空白。<br>去活一世吧。</div>';
  $('memorial-list').innerHTML = html;
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

/* ---------------- 移动端长按解释气泡：复用元素的 title 文案 ---------------- */
function initTipPop() {
  const pop = $('tip-pop');
  if (!pop || !document.addEventListener) return;
  let timer = null, tx = 0, ty = 0;
  const hide = () => { clearTimeout(timer); timer = null; pop.classList.add('hidden'); };
  const show = (text) => {
    pop.textContent = text;
    pop.classList.remove('hidden');
    const w = pop.offsetWidth || 200, h = pop.offsetHeight || 40;
    let x = Math.min(Math.max(8, tx - w / 2), (window.innerWidth || 390) - w - 8);
    let y = ty - h - 14;
    if (y < 8) y = ty + 22;
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
  };
  document.addEventListener('touchstart', (e) => {
    const t = e.target && e.target.closest ? e.target.closest('[title]') : null;
    if (!t || !t.title || !e.touches || !e.touches.length) return;
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
    const text = t.title;
    timer = setTimeout(() => show(text), 500);
  }, { passive: true });
  ['touchend', 'touchcancel', 'touchmove'].forEach((ev) =>
    document.addEventListener(ev, hide, { passive: true }));
}

window.addEventListener('DOMContentLoaded', () => {
  Sound.init();
  // iOS 音频解锁：第一次手势（捕获阶段）里唤醒 AudioContext，之后所有音效才出得来
  const unlockAudio = () => Sound.unlock();
  ['touchstart', 'pointerdown', 'click'].forEach((ev) =>
    window.addEventListener(ev, unlockAudio, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) Sound.unlock(); });
  initTipPop();
  const sb = $('btn-sound');
  sb.textContent = Sound.muted ? '🔇' : '🔊';
  sb.onclick = () => {
    const m = Sound.toggle();
    sb.textContent = m ? '🔇' : '🔊';
    if (!m) Sound.play('pop');
  };
  $('btn-born').onclick = startLife;
  // 继续上一世
  const bc = $('btn-continue');
  const saved = loadSave();
  if (saved) {
    bc.classList.remove('hidden');
    bc.textContent = `📿 继续上一世 · ${saved.state.name}（${saved.state.age} 岁 · 第 ${saved.state.day} 天）`;
    bc.onclick = () => { resumeLife(); };
  }
  $('btn-reborn').onclick = startLife;
  $('btn-to-title').onclick = () => {
    $('screen-end').classList.add('hidden');
    $('screen-start').classList.remove('hidden');
  };
  $('btn-memorial').onclick = () => { renderMemorials(); $('modal-memorial').classList.remove('hidden'); };
  $('btn-memorial-close').onclick = () => $('modal-memorial').classList.add('hidden');
  // 戳一戳小人
  const actorEl = $('actor');
  if (actorEl && actorEl.addEventListener) {
    actorEl.addEventListener('click', () => {
      if (!S || !S.alive || eventLock) return;
      if ($('screen-game').classList.contains('hidden')) return;
      Sound.play('pop');
      actorAnim('startle');
      if (chance(0.35)) {
        addLog(pick(['你戳了戳自己。疼。', '你冲自己做了个鬼脸，把自己逗笑了。', '你原地蹦了一下，心情莫名好了点。']));
        render();
      }
    });
  }
  // 场景三层视差：远慢近快，跟着鼠标轻轻晃
  const stageEl = $('scene-stage');
  const finePointer = typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches;
  if (stageEl && stageEl.addEventListener && finePointer && typeof stageEl.getBoundingClientRect === 'function') {
    const PAR = [['.lyr-far', 6, 2], ['.lyr-mid', 12, 4], ['.lyr-near', 20, 7]];
    stageEl.addEventListener('mousemove', (e) => {
      const r = stageEl.getBoundingClientRect();
      if (!r || !r.width || !r.height) return;
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      PAR.forEach(([sel, fx2, fy2]) => {
        const el = stageEl.querySelector(sel);
        if (el && el.style) el.style.transform = `translate(${(-px * fx2).toFixed(1)}px, ${(-py * fy2).toFixed(1)}px)`;
      });
    });
    stageEl.addEventListener('mouseleave', () => {
      PAR.forEach(([sel]) => {
        const el = stageEl.querySelector(sel);
        if (el && el.style) el.style.transform = '';
      });
    });
  }
  // 触屏：场景上左右滑动切换地点（对齐桌面端 ← →）
  if (stageEl && stageEl.addEventListener) {
    let touchX = null;
    stageEl.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length) touchX = e.touches[0].clientX;
    }, { passive: true });
    stageEl.addEventListener('touchend', (e) => {
      if (touchX == null || !e.changedTouches || !e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) < 48) return;
      if (!S || !S.alive || eventLock) return;
      if (!$('modal-event').classList.contains('hidden')) return;
      cycleLoc(dx < 0 ? 1 : -1);
    }, { passive: true });
  }
  // 移动端：字幕条点开岁月底栏
  const tickerEl = $('log-ticker');
  if (tickerEl && tickerEl.addEventListener) {
    tickerEl.addEventListener('click', () => {
      const body = $('sheet-log-body');
      if (body) body.innerHTML = $('log').innerHTML;
      $('sheet-log').classList.remove('hidden');
    });
    const closeSheet = () => $('sheet-log').classList.add('hidden');
    $('sheet-log-close').addEventListener('click', closeSheet);
    $('sheet-log').addEventListener('click', (e) => { if (e.target === $('sheet-log')) closeSheet(); });
  }
  // 移动端：资质栏折叠开关
  const atgEl = $('attrs-toggle');
  if (atgEl && atgEl.addEventListener) {
    atgEl.addEventListener('click', () => {
      const pl = $('panel-left');
      if (pl && pl.classList && pl.classList.toggle) pl.classList.toggle('open');
    });
  }
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
  // 行走的小人（随年龄长大）
  const walkW = xOf(endAge) - 60;
  const dur = Math.max(2.5, Math.min(14, span * 0.9));
  const growId = 'walkGrow' + Math.floor(Math.random() * 1e6);
  const t1 = Math.max(8, Math.min(70, ((7 - startAge) / span) * 100));
  const t2 = Math.max(t1 + 10, Math.min(90, ((13 - startAge) / span) * 100));
  if (document.head && document.head.appendChild) {
    const st = document.createElement('style');
    st.textContent = `@keyframes ${growId}{0%,${t1}%{transform:scale(.72)}${Math.min(100, t1 + 6)}%,${t2}%{transform:scale(.9)}${Math.min(100, t2 + 6)}%,100%{transform:scale(1.12)}}`;
    document.head.appendChild(st);
  }
  html += `<div class="scroll-walker" style="--walk-w:${walkW}px;animation-duration:${dur}s">` +
    `<svg viewBox="0 0 60 80" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform-origin:50% 100%;animation:${growId} ${dur}s linear both">${ACTOR_INNER}</svg></div>`;
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
