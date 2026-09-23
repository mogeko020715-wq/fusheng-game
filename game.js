/* ============================================================
 * 浮生 · 众生一梦
 * 黑白简笔 · 童年物语 · 一切随机，无法重来
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
  volume: 1,       // 音效音量 0-1，设置页滑条控制
  pending: null,   // iOS 解锁前被吞掉的最近一声，解锁后补播
  init() {
    try { this.muted = localStorage.getItem('fusheng_muted') === '1'; } catch (e) { this.muted = false; }
    try { const v = parseFloat(localStorage.getItem('fusheng_sfx_vol')); if (!isNaN(v)) this.volume = v; } catch (e) { /* 忽略 */ }
  },
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    try { localStorage.setItem('fusheng_sfx_vol', String(this.volume)); } catch (e) { /* 忽略 */ }
  },
  ensure() {
    if (this.ctx || typeof window === 'undefined') return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { /* 无音频环境 */ }
  },
  _asleep() {
    // suspended 是通用锁定态；interrupted 是 iOS Safari 被系统打断后的专属态
    return this.ctx && (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted');
  },
  // iOS 解锁：必须在用户手势调用栈里 resume，并真实播放一帧静音
  unlock() {
    this.ensure();
    if (!this.ctx) return;
    try {
      // iOS 静音拨片会屏蔽 Web Audio（ambient 会话）：抬到 playback 通道
      if (typeof navigator !== 'undefined' && navigator.audioSession) {
        try { if (navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) { /* iOS <17 无此 API */ }
      }
      // 老 iOS 兜底：循环一段近无声的 HTML 音频，把音频会话顶到媒体通道
      // 小工具模式（FUSHENG_NO_BGM）：容器 CSP 禁 data: 媒体，跳过此兜底
      const minitoolMode = typeof window !== 'undefined' && !!window.FUSHENG_NO_BGM;
      if (!this._duck && typeof Audio !== 'undefined' && !minitoolMode) {
        try {
          const a = new Audio('data:audio/wav;base64,UklGRuwAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YcgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==');
          a.loop = true;
          a.volume = 0.02;
          const pr = a.play();
          if (pr && typeof pr.catch === 'function') pr.catch(() => {});
          this._duck = a;
        } catch (e) { /* 忽略 */ }
      }
      if (this._asleep()) {
        const p = this.ctx.resume();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            // 解锁成功：补播刚被吞掉的那一声（比如出生时的钟声）
            const pend = this.pending;
            this.pending = null;
            if (pend && !this.muted) this.play(pend);
            Bgm.resync(); // 背景音乐跟上
          }).catch(() => {});
        }
      }
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
    gainV = gainV * this.volume;
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
    gainV = gainV * this.volume;
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
      if (this._asleep()) {
        // 未解锁：记下这一声，等 unlock() 的 resume 落地后补播
        this.pending = name;
        const p = this.ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(() => {});
        return;
      }
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

/* ---------------- 背景音乐：八音盒琶音循环 ----------------
 * Web Audio 程序合成，零素材、零联网，离线可用。
 * 与音效共用同一个已解锁的 AudioContext，锁定态自动等待。 */
const Bgm = {
  enabled: true,
  volume: 1,       // 音乐音量 0-1，设置页滑条控制；file 模式乘在 audio.volume 上，synth 模式乘在音符力度上
  timer: null,
  idx: 0,          // 下一个待调度事件
  loopStart: 0,    // 本轮循环在 ctx 时间轴上的起点
  UNIT: 0.14,      // 十六分音符时长（秒），流动的琶音速度
  FILE: 'assets/audio/bgm-bwv1007-guitar.mp3', // 可选音频文件（网页版专属）
  audio: null,
  mode: 'synth',   // 'file'（音频文件）优先，加载失败自动回退 'synth'（八音盒）
  _fileReady: false,
  // 前八小节琶音（每小节两组八分解，每组 8 音）：
  // C | Dm7/C | G7/B | C | Am | D7/C | G/B | C
  MELODY: [
    [60, 1], [64, 1], [67, 1], [72, 1], [76, 1], [67, 1], [72, 1], [76, 1],
    [60, 1], [64, 1], [67, 1], [72, 1], [76, 1], [67, 1], [72, 1], [76, 1],
    [60, 1], [62, 1], [69, 1], [74, 1], [77, 1], [69, 1], [74, 1], [77, 1],
    [60, 1], [62, 1], [69, 1], [74, 1], [77, 1], [69, 1], [74, 1], [77, 1],
    [59, 1], [62, 1], [67, 1], [74, 1], [77, 1], [67, 1], [74, 1], [77, 1],
    [59, 1], [62, 1], [67, 1], [74, 1], [77, 1], [67, 1], [74, 1], [77, 1],
    [60, 1], [64, 1], [67, 1], [72, 1], [76, 1], [67, 1], [72, 1], [76, 1],
    [60, 1], [64, 1], [67, 1], [72, 1], [76, 1], [67, 1], [72, 1], [76, 1],
    [60, 1], [64, 1], [69, 1], [76, 1], [81, 1], [69, 1], [76, 1], [81, 1],
    [60, 1], [64, 1], [69, 1], [76, 1], [81, 1], [69, 1], [76, 1], [81, 1],
    [60, 1], [62, 1], [66, 1], [69, 1], [74, 1], [66, 1], [69, 1], [74, 1],
    [60, 1], [62, 1], [66, 1], [69, 1], [74, 1], [66, 1], [69, 1], [74, 1],
    [59, 1], [62, 1], [67, 1], [74, 1], [79, 1], [67, 1], [74, 1], [79, 1],
    [59, 1], [62, 1], [67, 1], [74, 1], [79, 1], [67, 1], [74, 1], [79, 1],
    [60, 1], [64, 1], [67, 1], [72, 1], [76, 1], [67, 1], [72, 1], [76, 1],
    [60, 1], [64, 1], [67, 1], [72, 1], [76, 1], [67, 1], [72, 1], [76, 1],
  ],
  BASS: {}, // 琶音自带低音，无需额外铺底
  events: [],
  loopUnits: 0,
  init() {
    // 容器无音频文件白名单的构建（小红书小工具）：整体关闭背景音乐并隐藏设置项
    this.noBgm = typeof window !== 'undefined' && !!window.FUSHENG_NO_BGM;
    if (this.noBgm) { this.enabled = false; return; }
    try { this.enabled = localStorage.getItem('fusheng_bgm') !== '0'; } catch (e) { this.enabled = true; }
    try { const v = parseFloat(localStorage.getItem('fusheng_bgm_vol')); if (!isNaN(v)) this.volume = v; } catch (e) { /* 忽略 */ }
    // 展开成按时间排序的事件表；每组琶音的首音略重，像指尖落在拍点上
    let t = 0;
    this.MELODY.forEach(([m, u], i) => {
      if (this.BASS[t] !== undefined) this.events.push({ t, midi: this.BASS[t], vel: 0.035 });
      if (m) this.events.push({ t, midi: m, vel: i % 8 === 0 ? 0.06 : 0.045 });
      t += u;
    });
    this.loopUnits = t;
    // 网页版：预载音频文件，就绪后接替八音盒
    if (typeof Audio !== 'undefined') {
      try {
        const a = new Audio(this.FILE);
        a.loop = true;
        a.volume = 0.42 * this.volume;
        a.preload = 'auto';
        // 用 canplay 而非 canplaythrough：后者要等几乎整首缓存完（5MB 弱网下延迟几十秒），
        // canplay 缓冲几秒即可流式起播，边播边缓冲
        a.addEventListener('canplay', () => {
          this._fileReady = true;
          this._tryStartFile();
        });
        a.addEventListener('error', () => {
          // 音频文件缺席（如小红书离线包）：留在八音盒模式
          this._fileReady = false;
          this.audio = null;
          this.mode = 'synth';
        });
        this.audio = a;
        if (a.load) a.load();
      } catch (e) { /* 无 Audio 环境则留在合成模式 */ }
    }
    this.start();
  },
  _startFile() {
    if (!this.audio) return;
    this.mode = 'file';
    if (this.audio.paused) {
      try {
        const p = this.audio.play();
        if (p && typeof p.catch === 'function') p.catch(() => { this.mode = 'synth'; });
      } catch (e) { this.mode = 'synth'; }
    }
  },
  _tryStartFile() {
    if (!this._fileReady || !this.enabled || this.mode === 'file') return;
    // 已经解锁过（用户摸过屏幕）就立刻起播，否则等下一次手势
    if (Sound.ctx && !Sound._asleep()) this._startFile();
  },
  unlock() {
    // 在用户手势调用栈里：音频就绪则起播/切换
    if (this._fileReady && this.enabled) this._startFile();
  },
  start() {
    if (this.timer || typeof setInterval !== 'function') return;
    this.timer = setInterval(() => this.tick(), 120);
  },
  resync() { this.loopStart = 0; this.idx = 0; }, // 解锁/回来后对齐时间轴
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.audio) { try { this.audio.volume = 0.42 * this.volume; } catch (e) { /* 忽略 */ } }
    try { localStorage.setItem('fusheng_bgm_vol', String(this.volume)); } catch (e) { /* 忽略 */ }
  },
  toggle() {
    if (this.noBgm) return false; // 无背景音乐构建：开关不存在
    this.enabled = !this.enabled;
    try { localStorage.setItem('fusheng_bgm', this.enabled ? '1' : '0'); } catch (e) { /* 忽略 */ }
    if (this.enabled) {
      Sound.ensure(); this.resync(); this.start();
      this._tryStartFile();
    } else if (this.audio && !this.audio.paused) {
      try { this.audio.pause(); } catch (e) { /* 忽略 */ }
    }
    return this.enabled;
  },
  // 八音盒音色：基音正弦 + 高八度泛音一闪，指数衰减像钢片琴
  _mb(midi, t, vel) {
    const c = Sound.ctx;
    vel = vel * this.volume;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    [[1, vel, 1.6], [4, vel * 0.22, 0.3]].forEach(([mult, v, dec]) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * mult;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + dec + 0.05);
    });
  },
  // 前瞻调度：每次把未来 0.5s 内的音符排上时间轴
  tick() {
    const c = Sound.ctx;
    if (!this.enabled || !c || !this.events.length || this.mode === 'file') return;
    try {
      if (Sound._asleep()) return; // iOS 未解锁：等 unlock() 的 resync
      if (!this.loopStart || this.loopStart < c.currentTime - 0.3) {
        this.loopStart = c.currentTime + 0.08;
        this.idx = 0;
      }
      const horizon = c.currentTime + 0.5;
      while (this.idx < this.events.length) {
        const ev = this.events[this.idx];
        const at = this.loopStart + ev.t * this.UNIT;
        if (at >= horizon) break;
        this._mb(ev.midi, at, ev.vel);
        this.idx += 1;
        if (this.idx >= this.events.length) {
          this.idx = 0;
          this.loopStart += this.loopUnits * this.UNIT;
        }
      }
    } catch (e) { /* 音乐失败不影响游戏 */ }
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
  meal: 'eat', sleep: 'sleep', wash: 'wash', play: 'jump', study: 'sit',
  exercise: 'jump', chore: 'walk', art: 'sit', cook: 'cook', chat: 'chat',
  walk: 'walk', slide: 'jump', fish: 'fish', watch: 'sit',
  class: 'run', skip: 'run', club: 'sit',
  book: 'walk', toy: 'jump', snack: 'eat', artist: 'stand', chess: 'chess',
  veg: 'walk', deli: 'eat', carry: 'walk', cure: 'stand', checkup: 'stand',
};
const ANIM_CLASSES = ['anim-walk', 'anim-run', 'anim-jump', 'anim-stand', 'anim-sit', 'anim-eat', 'anim-sleep', 'anim-startle', 'anim-celebrate', 'anim-trip', 'anim-chat', 'anim-fish', 'anim-chess', 'anim-wash', 'anim-cook'];
const PROP_CLASSES = ['p-rod', 'p-book', 'p-notes', 'p-easel', 'p-steam', 'p-bubble'];
function actorAnim(name, prop) {
  const a = $('actor');
  if (!a || !a.classList) return;
  a.classList.remove('ps-sit', 'ps-lie');
  ANIM_CLASSES.forEach((c) => a.classList.remove(c));
  PROP_CLASSES.forEach((c) => a.classList.remove(c));
  // 立绘已启用：帧序列动作直接播帧（跑/走各自序列，跳跃用 jump 五帧）
  if (spriteSt.ready) {
    if (name === 'walk') { spritePlay('walk', 150, [0, -2, 0, 0, -2, 0]); return; }
    if (name === 'run') { spritePlay('run', 95, [0, -3, 0, -3]); return; }
    if (name === 'jump') { spritePlay('jump', 190, [0, -8, -26, -4, 0]); return; }
    if (name === 'sleep') { spriteSleep(); } // 不 return：class 流程要落 anim-sleep 驱动小床/Zzz 入场
    else if (name === 'eat') spriteHold('eat', 1600);  // 静态帧 + class 流程的微动叠加
    else if (name === 'sit') spriteHold('sit', 1600);
    else if (name === 'celebrate') spriteHold('celebrate', 1600); // 专属欢呼帧，class 流程叠加跳星 fx
    else if (name === 'trip') spriteHold('trip', 1200);
    else if (name === 'startle') spriteHold('startle', 900);
    else if (name === 'chat' || name === 'fish' || name === 'chess') spriteHold(name, 1600);
    else if (name === 'wash' || name === 'cook') spriteHold(name, 1400);
    else if (spriteSt.busy) spriteStop(); // 其它动作打断帧播放，交给 CSS 表演
  }
  if (name === 'sit' || name === 'eat' || name === 'chat' || name === 'fish' || name === 'chess') a.classList.add('ps-sit'); // SVG 简笔姿态（仅回退模式可见）
  if (name === 'sleep') a.classList.add('ps-lie');
  a.classList.add('anim-' + name);
  if (prop) a.classList.add('p-' + prop);
  clearTimeout(actorAnim._t);
  actorAnim._t = setTimeout(() => {
    a.classList.remove('anim-' + name);
    a.classList.remove('ps-sit', 'ps-lie');
    PROP_CLASSES.forEach((c) => a.classList.remove(c));
  }, name === 'sleep' ? 2750 : 950);
}

/* ---------------- 立绘模式：线稿 sprite 接管简笔小人 ----------------
 * 15 张静态帧全部落定后启用（给 svg#actor 加 spr-off，CSS 兄弟选择器显示立绘层）；
 * 动作帧后台慢加载，缺席的帧播放时自动回退站姿；stand 都加载不到就保持 SVG 简笔小人。
 * 每张图最多 4 次尝试（递增间隔 + 缓存穿透），整体失败会在 startLife 时重试——
 * 针对弱网/移动网络：30 帧全量一次性加载的 all-or-nothing 太容易整组阵亡 */
const SPRITE_DIR = 'assets/actor/sprites/';
const SPRITE_SETS = {
  walk: ['walk-1', 'walk-2', 'walk-3', 'walk-4', 'walk-5', 'walk-6'],
  jump: ['jump-1', 'jump-2', 'jump-3', 'jump-4', 'jump-5'],
  run: ['run-1', 'run-2', 'run-3', 'run-4'],
};
const SPRITE_STATIC = ['stand', 'happy', 'weak', 'sick', 'sit', 'eat', 'sleep', 'celebrate', 'trip', 'startle', 'chat', 'fish', 'chess', 'wash', 'cook'];
const spriteSt = { ready: false, busy: false, timer: null, loading: false };
const spriteCache = {};

function spriteLoadOne(n, done) {
  const im = new Image();
  let tries = 0;
  const attempt = () => { im.src = SPRITE_DIR + n + '.png' + (tries ? '?r' + tries : ''); };
  im.onload = () => done(true);
  im.onerror = () => {
    if (tries < 3) { tries++; setTimeout(attempt, 700 * tries * tries); } // 0.7s / 2.8s / 6.3s
    else done(false);
  };
  attempt();
  spriteCache[n] = im;
}
function spritePreload() {
  if (spriteSt.loading || spriteSt.ready) return;
  if (typeof Image === 'undefined') return; // 非浏览器环境（测试桩）直接跳过
  spriteSt.loading = true;
  let left = SPRITE_STATIC.length;
  SPRITE_STATIC.forEach((n) => spriteLoadOne(n, () => {
    if (--left > 0) return;
    spriteSt.loading = false;
    if (spriteCache.stand && spriteCache.stand.naturalWidth > 0) spriteEnable();
    // stand 也没到手：保持 SVG 简笔小人，等 startLife 再试
  }));
  SPRITE_SETS.walk.concat(SPRITE_SETS.jump, SPRITE_SETS.run).forEach((n) => spriteLoadOne(n, () => {}));
}
function spriteEnable() {
  spriteSt.ready = true;
  const a = $('actor');
  if (a && a.classList) a.classList.add('spr-off');
  updateSpriteMood();
}
function spriteSet(name) {
  const el = $('actor-sprite');
  if (!el) return;
  let im = spriteCache[name];
  if (!im || !im.naturalWidth) { name = 'stand'; im = spriteCache.stand; } // 缺席帧回退站姿
  if (!im || !im.naturalWidth) return;
  if (el.dataset.cur !== name) {
    el.dataset.cur = name;
    el.src = im.src;
  }
}
/* 情绪 → 静态帧：感冒 sick、虚弱/低落 weak，心情≥80 用 happy，其余 stand */
function updateSpriteMood() {
  if (!spriteSt.ready || spriteSt.busy) return;
  if (!S) { spriteSet('stand'); return; }
  if (S.buffs.some((b) => b.name === '感冒')) { spriteSet('sick'); return; }
  const down = S.needs.精力 < 25 || S.needs.健康 < 30 || S.needs.心情 < 25;
  spriteSet(down ? 'weak' : S.needs.心情 >= 80 ? 'happy' : 'stand');
}
/* 静态动作帧：换图保持 dur 毫秒后恢复情绪帧（与 CSS class 表演可叠加） */
function spriteHold(name, dur) {
  const el = $('actor-sprite');
  if (!spriteSt.ready || !el || !spriteCache[name]) return;
  spriteClearTimers();
  el.classList.remove('f-sleep');
  spriteSt.busy = true;
  spriteSet(name);
  spriteSt.holdT = setTimeout(() => {
    spriteSt.busy = false;
    updateSpriteMood();
  }, dur);
}
/* 睡觉：蹲身 → 换横躺帧躺定 → 换回站姿起身（横版帧用 f-sleep 类切宽度基准） */
/* ---------------- 睡觉 v2（A+B：床淡入 + 交叉淡化 + Zzz）----------------
 * 时间轴：蹲身侧倒淡出 → 换横躺帧淡入（床与 Zzz 由 anim-sleep class 驱动 CSS 入场）
 *        → 躺定 → 淡出换站姿淡入 → 归位。全程无硬切。 */
function spriteSleep() {
  const el = $('actor-sprite');
  if (!spriteSt.ready || !el || !spriteCache.sleep) return;
  spriteClearTimers();
  spriteSt.busy = true;
  el.style.translate = '0px 7px';           // 蹲身
  el.style.rotate = '6deg';                 // 顺势侧倒
  spriteSt.s1 = setTimeout(() => { el.style.opacity = '.15'; }, 300);
  spriteSt.s2 = setTimeout(() => {          // 交叉淡化：换横躺帧淡入
    spriteSet('sleep');
    el.classList.add('f-sleep');
    el.style.rotate = '0deg';
    el.style.translate = '0px 0px';
    el.style.opacity = '1';
  }, 620);
  spriteSt.s3 = setTimeout(() => { el.style.opacity = '.15'; }, 2050); // 起身前淡出
  spriteSt.s4 = setTimeout(() => {
    el.classList.remove('f-sleep');
    spriteSet('stand');
    el.style.translate = '0px 7px';
    el.style.opacity = '1';
  }, 2350);
  spriteSt.s5 = setTimeout(() => {
    el.style.translate = '0px 0px';
    spriteSt.busy = false;
    updateSpriteMood();
  }, 2650);
}
/* 帧播放器：换 img.src 播帧，Y 位移走 translate 属性（与 CSS transform 动画互不干扰） */
function spriteClearTimers() {
  clearInterval(spriteSt.timer);
  clearTimeout(spriteSt.holdT);
  ['s1', 's2', 's3', 's4', 's5'].forEach((k) => clearTimeout(spriteSt[k]));
  // 睡觉被打断时可能停在淡出/侧倒中态，统一复位
  const el = typeof $ === 'function' ? $('actor-sprite') : null;
  if (el) { el.style.opacity = '1'; el.style.rotate = '0deg'; }
}
function spritePlay(kind, interval, dy) {
  const el = $('actor-sprite');
  if (!spriteSt.ready || !el) return;
  spriteClearTimers();
  el.classList.remove('f-sleep'); // 若打断了睡觉，先退出横版帧规格
  const frames = SPRITE_SETS[kind];
  let i = 0;
  spriteSt.busy = true;
  const step = () => {
    if (i >= frames.length) { spriteStop(); return; }
    spriteSet(frames[i]);
    el.style.translate = '0px ' + (dy && dy[i] ? dy[i] : 0) + 'px';
    i += 1;
  };
  step();
  spriteSt.timer = setInterval(step, interval);
}
function spriteStop() {
  spriteClearTimers();
  spriteSt.timer = null;
  spriteSt.busy = false;
  const el = $('actor-sprite');
  if (el) {
    el.style.translate = '0px 0px';
    el.classList.remove('f-sleep');
  }
  updateSpriteMood();
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
  ['actor', 'actor-fx', 'actor-sprite-wrap'].forEach((id) => {
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
const SAVE_KEY = 'fusheng_save_v1';     // 这一程活着就一直在，落幕即清除

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

/* 技艺等级水平描述：长按/悬停技能标签时展示（1-5 级） */
const SKILL_LVL_DESC = {
  绘画: ['刚会握笔涂鸦，线条歪歪扭扭。', '能画出像样的形状了，最爱画小人。', '技法小成，渐渐有了自己的风格。', '功底扎实，画作常被称赞。', '炉火纯青，落笔有神。'],
  乐器: ['刚入门，音符还找不准。', '能磕磕绊绊奏完一整首曲子。', '演奏流畅，渐渐有了感情。', '技艺纯熟，登台也不怯场。', '人琴合一，余音绕梁。'],
  编程: ['刚认识代码，照着书敲 hello world。', '能写点小玩意，bug 是家常便饭。', '思路清晰，独立做个小项目没问题。', '功力深厚，难题到你手里迎刃而解。', '代码如臂使指，作品已见锋芒。'],
  武术: ['刚学扎马步，腿肚子直打哆嗦。', '套路打得有模有样。', '拳脚小成，身手矫健。', '功底扎实，寻常三五人近不了身。', '臻至化境，出手自有一派气象。'],
  烹饪: ['刚会打下手，择菜洗碗。', '能做几道家常小菜了。', '手艺见长，全家点名要你掌勺。', '煎炒烹炸，样样拿手。', '一勺在手，百味随心。'],
  钓鱼: ['刚学甩竿，鱼线总缠成一团。', '能钓上小鱼了，不再空手而归。', '看漂识鱼，收获渐丰。', '老手风范，在哪儿下竿心里有数。', '钓意不在鱼，山水自在心间。'],
};
const SKILL_LVL_GENERIC = ['初窥门径。', '渐渐上手。', '小有所成。', '技艺纯熟。', '炉火纯青。'];
function skillDesc(name, lvl) {
  const t = SKILL_LVL_DESC[name] || SKILL_LVL_GENERIC;
  return t[Math.min(Math.max(lvl, 1), 5) - 1];
}

/* ---------------- 心愿 ---------------- */
const DREAMS = {
  science: { name: '科学家', attr: '智力' },
  sports:  { name: '运动员', attr: '体质' },
  art:     { name: '艺术家', attr: '魅力' },
  food:    { name: '美食家', skill: '烹饪' },
  money:   { name: '有钱人' },
};

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

/* ---------------- 故事图鉴（结局标签） ---------------- */
const ALL_TAGS = {
  '未竟之年': '在成年之前止步',
  '金榜题名': '中考考上重点高中',
  '按部就班': '考上普通高中，平稳落地',
  '另辟蹊径': '走进职业高中，换一条赛道',
  '心想事成': '实现八岁那年许下的心愿',
  '寒门贵子': '贫寒之家走出重点高中生',
  '无忧无虑': '富贵之家，幸福均值 65 以上',
  '快乐童年': '幸福均值 70 以上',
  '心事重重': '幸福均值不足 55',
  '身怀绝技': '任一技艺练到 5 级',
  '文武双全': '体质与智力都达到 75',
  '小有积蓄': '成年时攒下 120 元',
  '知寒知暖': '贫寒之家暗线：焐热过妈妈的手，也读懂了它',
  '灯火可亲': '小康之家暗线：看懂了饭桌规矩与自行车后座的爱',
  '锦衣知暖': '富贵之家暗线：等到了那顿推掉应酬的生日饭',
  '莫逆之交': '走完一程的羁绊约定',
  '少年知己': '把那段并肩的友谊，走成了约定',
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
  if (cause === 'early') tags.push('未竟之年');
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
  if (S.flags.crushDone) tags.push('少年知己');
  Object.keys(SPEC_TAGS).forEach((n) => {
    const dir = S.flags['spec_' + n];
    if (dir && SPEC_TAGS[n][dir]) tags.push(SPEC_TAGS[n][dir]);
  });
  return tags;
}

/* ---------------- 状态 ---------------- */
let S = null;          // 当前这一程
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
  addLog(`父母给你取名「${name}」。往后的日子，请多保重。`, 'sys');
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
  if (S.needs.健康 <= 0 && S.alive) endLife('early');
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
  addLog(pick(['你睡着了，做了一个短短的梦。', '你沾到枕头就睡着了。', '你抱着被子滚了两圈，沉沉睡去。']));
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
  addLog(pick([`你在${schoolName()}上了一天课。`, `${schoolName()}的一天，从早读坐到放学。`, `你在${schoolName()}的教室里坐了一天，笔记记了半本。`]) + (tired ? '太累了，听课直打瞌睡。' : ''));
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

/* ---------------- 事件池与里程碑：见 events.js（先于本文件加载） ---------------- */

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
    { age: b === 'pang' ? 7 : 6, id: `bond-${b}-1` }, // 小胖第一幕是开学同桌，对齐 7 岁入学
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

/* ---------------- 少年知己保底调度 ---------------- */
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
  // 加权随机：weight 真正决定出场率（暗线/分岔重头戏高频，日常降权）
  let total = 0;
  pool.forEach((e) => { total += effWeight(e); });
  let r = Math.random() * total;
  for (const e of pool) {
    r -= effWeight(e);
    if (r <= 0) return e;
  }
  return pool[pool.length - 1];
}

/* 有效权重 = 基础 weight × 年龄带贴合度 × 近期冷却
 * 年龄带：事件越靠近自己年龄段的「主场」，出场率越高（最边缘 -35%）
 * 冷却：见过的事件 8 天内压到 12%，20 天内 45%，之后恢复——长局尾段不再反复撞同一事件 */
function effWeight(e) {
  let w = e.weight || 1;
  const span = Math.max((e.max - e.min) / 2, 1);
  const dist = Math.abs(S.age - (e.min + e.max) / 2) / span; // 0=正中 1=边缘
  w *= 1 - 0.35 * Math.min(dist, 1);
  const seenDay = S.flags.evSeenDay && S.flags.evSeenDay[e.id];
  if (seenDay != null) {
    const since = S.day - seenDay;
    if (since < 8) w *= 0.12;
    else if (since < 20) w *= 0.45;
  }
  return w;
}

function openEvent(ev, isMilestone = false) {
  eventLock = true;
  currentEventId = ev && ev.id ? ev.id : null;
  if (ev && ev.id) {
    S.flags['seen:' + ev.id] = true;
    S.flags.evCount = S.flags.evCount || {};
    S.flags.evCount[ev.id] = (S.flags.evCount[ev.id] || 0) + 1;
    S.flags.evSeenDay = S.flags.evSeenDay || {};
    S.flags.evSeenDay[ev.id] = S.day; // 冷却计时：近期见过的事件降权
    if (!isMilestone) codexCollectEvent(ev.id); // 事件图鉴：见过即收集
  }
  if (isMilestone) Sound.play('chime');
  const cgImg = $('event-cg');
  if (ev.cg) { cgImg.src = 'assets/cg/' + ev.cg + '.png'; cgImg.classList.remove('hidden'); }
  else { cgImg.classList.add('hidden'); cgImg.removeAttribute('src'); }
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
  const effRaw = pass ? c.ok : (c.fail || {});
  const eff = typeof effRaw === 'function' ? effRaw(S) : effRaw; // 支持动态奖励（按当前状态决定给哪门技艺）
  applyEffects(eff);
  pendingAnim = pass ? (eff && eff.mem ? 'celebrate' : null) : (c.fail ? 'trip' : null);
  let txt = pass ? (c.okTxt || (eff && eff.mem ? '……' : '')) : (c.failTxt || '');
  if (typeof txt === 'function') txt = txt(S); // 支持动态文案（如抽奖每次现掷结果）
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

/* ---------------- 无所事事：收益近零的散文按钮，低概率「小发现」挂进记忆 ---------------- */
function idleRun(pool, finds) {
  return () => {
    gainNeed('心情', 2);
    if (finds && chance(0.12)) {
      const f = pick(finds);
      gainNeed('心情', 5);
      if (f.mem) remember(f.mem);
      addLog(f.txt, 'event');
    } else {
      addLog(pick(pool));
    }
  };
}
const IDLE_HOME = [
  '你盯着天花板发呆，什么也想，什么也没想。',
  '你趴在桌上，看灰尘在阳光里慢慢飘。',
  '你数了一会儿自己的呼吸，数到第几忘了。',
  '你盯着墙上的裂纹，看出了一张地图的形状。',
  '你歪在椅子里，听冰箱嗡嗡地响。',
  '你对着镜子里的自己眨了眨眼，他也眨了眨。',
  '你盘腿坐着，思绪像风筝一样飘远了。',
  '你把下巴搁在膝盖上，时间就这样漏过去了。',
  '你望着窗外，云走得很慢，你也走得很慢。',
  '你发了半天呆，回过神来，嘴角是翘着的。',
];
const IDLE_HOME_FINDS = [
  { txt: '你在沙发缝里摸到一颗玻璃珠，对着光看了一下午。', mem: '沙发缝里藏着一颗玻璃珠，像藏着一个小小的宇宙。' },
  { txt: '你翻旧课本，抖出一张夹了三年的糖纸，还亮晶晶的。', mem: '旧课本里夹着一张糖纸，甜味早就没了，颜色还在。' },
  { txt: '窗台上落着一只迷路的瓢虫，你把它送回了花盆里。', mem: '你把一只迷路的瓢虫送回了家。它背上刚好七颗星。' },
];
const IDLE_PARK = [
  '你躺在草地上，看一朵云从猫变成船。',
  '云走得很慢，你看得也很慢。',
  '你给每朵云都起了名字，转头就忘了。',
  '一只鸟横穿过去，打散了你看的那朵云。',
  '你眯着眼，看云的影子从草地上爬过去。',
  '风把云吹成一条长长的河，你在河里找鱼。',
  '你看云看到脖子酸，翻了个身接着看。',
  '那朵云像一床被子，你有点想钻进去。',
  '天空很高很高，你很小很小，这样挺好。',
  '你数着云，一朵，两朵……数着数着就忘了数。',
];
const IDLE_PARK_FINDS = [
  { txt: '你在草丛里捡到一颗花纹特别的玻璃珠，蓝得像一小块湖。', mem: '草丛里有一颗蓝色的玻璃珠，像谁不小心掉的湖。' },
  { txt: '你在树根下发现一队搬家的蚂蚁，蹲着护送它们走了很远。', mem: '你护送一队蚂蚁搬了家，觉得自己像个巨人国的骑士。' },
  { txt: '一片云长得太像鲸鱼了，你盯着它游过了整个天空。', mem: '有一朵像鲸鱼的云，游过了你整个下午的天空。' },
];

const ACTIONS = [
  /* ---- 家 ---- */
  { id: 'meal', loc: 'home', label: '吃饭', cond: () => MEAL_SLOTS.includes(S.slot), run: eatMeal },
  { id: 'sleep', loc: 'home', label: '睡觉', cond: () => true, run: sleep },
  { id: 'wash', loc: 'home', label: '洗漱', cond: () => true, run: () => { gainNeed('清洁', 42); gainNeed('心情', 2); addLog(pick(['你把自己洗得干干净净。', '水龙头哗哗响，你对着镜子做了个鬼脸。', '洗完浑身清爽，像换了一层皮。'])); } },
  { id: 'play', loc: 'home', label: '玩耍', cond: () => true, run: () => {
      const bonus = S.familyKey === 'rich' ? 6 : 0;
      gainNeed('娱乐', 26 + bonus); gainNeed('心情', 7);
      if (S.familyKey === 'rich') addLog(pick(['你在堆成山的玩具里玩了个痛快。', '新到的玩具套装，你拆了一下午。', '你把玩具摆了一地，自导自演了一出大戏。']));
      else if (S.age <= 6) addLog(pick(['一个旧皮球，你也能玩出百般花样。', '你搭了一座积木城堡，又亲手推倒，咯咯直笑。', '你抱着布偶说了一下午悄悄话。']));
      else if (S.age <= 12) addLog(pick(['玻璃弹珠在地上滚来滚去，你赢了隔壁小孩三颗。', '一副纸牌，你和自己对战了一下午。', '跳皮筋、丢沙包、翻花绳，一样都没落下。']));
      else addLog(pick(['你约同学打了场球，汗出透了，痛快。', '你窝在角落打游戏，一关又一关。', '你翻出旧漫画重看，还是笑得前仰后合。']));
    } },
  { id: 'study', loc: 'home', label: '看书学习', cond: () => true, run: () => {
      let g = 1.2 * S.apt.学习;
      if (S.needs.娱乐 < 20) { g *= 0.5; addLog('一直学习有点无聊，效率不高。', 'sys'); }
      const chess = S.flags.chessThink === S.day; // 联动：棋摊看棋 → 当日读书有思路
      if (chess) g += 0.4;
      gain('智力', g); gainNeed('娱乐', -6); gainNeed('精力', -3);
      const hasBook = S.buffs.some((b) => b.name === '灵感迸发'); // 联动：新书 buff 专用文案
      addLog(chess ? '大爷的残局，你想了一路，落在纸上成了思路。'
        : hasBook ? '新书在手里，字都像在发光。'
        : pick(['你伏案看了一会儿书。', '你翻开课本，一页一页啃了下去。', '窗外再吵，把头埋进书里，世界就静了。']));
    } },
  { id: 'exercise', loc: 'home', label: '运动锻炼', cond: () => true, run: () => {
      gain('体质', 1.2 * S.apt.运动); gainNeed('精力', -9); gainNeed('清洁', -4);
      addLog(pick(['你活动筋骨，跑得满头大汗。', '你绕着院子跑了三圈，气喘吁吁。', '俯卧撑、仰卧起坐，你一个没落。']));
    } },
  { id: 'chore', loc: 'home', label: '帮忙家务', cond: () => true, run: () => {
      gainNeed('心情', 3); gain('魅力', 0.4);
      if (S.familyKey === 'poor' && chance(0.5)) { gainMoney(1); addLog('你帮家里干活，大人塞给你一块钱。'); }
      else addLog(pick(['你帮忙扫了地、叠了被子。', '你擦了桌子，把碗筷摆得整整齐齐。', '你倒垃圾、收衣服，大人直夸懂事。']));
    } },
  { id: 'art', loc: 'home', label: () => (S.flags.art ? '练习' + S.flags.art : '画画弹琴'), cond: () => !!S.flags.art, run: () => {
      gain('魅力', 1.0 * S.apt.艺术); gainSkill(S.flags.art, 3); gainNeed('心情', 4);
      const insp = S.flags.inspireArt === S.day; // 联动：白天观察花鸟虫鱼 → 练习有灵感
      addLog(insp ? pick([`白天看到的蜻蜓和飞鸟，落进了${S.flags.art}里。`, `你想着白天在公园看到的东西练${S.flags.art}，格外有感觉。`])
        : pick([`你练习${S.flags.art}，渐入佳境。`, `你沉下心练了一阵${S.flags.art}，比上次顺了些。`, `练${S.flags.art}的时候，时间过得飞快。`]));
    } },
  { id: 'cook', loc: 'home', label: () => '动手做饭（食材×' + (S.flags.ingredients || 0) + '）', cond: () => (S.flags.ingredients || 0) > 0, run: () => {
      S.flags.ingredients--;
      gainNeed('饱食', 42); gainSkill('烹饪', 3);
      if ((S.skills.烹饪 || { lvl: 1 }).lvl >= 2 && chance(0.6)) { gainNeed('心情', 6); addLog(`你做了顿饭，全家都吃得很香。「咱家孩子手艺真好。」`); }
      else addLog(pick(['你照着印象做了顿饭，能吃，甚至有点香。', '你掂了掂锅铲，炒出一盘像样的菜。', '厨房叮叮当当一阵，你端出了一桌子热气。']));
    } },
  { id: 'daydream', loc: 'home', label: '发会儿呆', cond: () => true, run: idleRun(IDLE_HOME, IDLE_HOME_FINDS) },
  { id: 'chat', loc: 'home', label: '和家人聊天', cond: () => true, run: () => {
      gainNeed('心情', 9);
      if (chance(0.15)) { addBuff('被爱环绕', '家人的话熨帖了心。', 5); addLog('和家人聊了很久，心里暖烘烘的。'); }
      else addLog(pick(['你们随口聊着天，鸡毛蒜皮，也挺好。', '家人讲了个笑话，饭桌上一片笑声。', '你说起今天的事，大人听得很认真。']));
    } },
  /* ---- 公园 ---- */
  { id: 'walk', loc: 'park', label: '散步', cond: () => true, run: () => {
      gainNeed('心情', 7); gain('体质', 0.3);
      const views = [
        ['晨光透过树叶洒了一地，你踩着光斑慢慢走。', '清晨的公园笼着薄雾，鸟比人醒得早。'],
        ['上午的风正好，你沿着林荫道慢慢走。', '阳光不烫，影子不长，正是散步的好时候。'],
        ['正午的树荫下凉快，你躲着日头慢慢踱。', '中午的公园没什么人，安静得能听见蝉。'],
        ['你在林荫道上慢慢走，影子被太阳拉得老长。', '下午的湖面亮闪闪的，你看得有点出神。'],
        ['晚霞把天烧红了半边，你走得很慢，想多看一会儿。', '傍晚的风凉下来，散步的人渐渐多了。'],
        ['路灯一盏一盏亮起来，你踩着灯影往家走。', '夜里的公园很静，只有虫鸣和你的脚步。'],
      ];
      addLog(pick(views[S.slot] || views[3]));
    } },
  { id: 'slide', loc: 'park', label: '滑梯秋千', cond: () => S.age <= 9, run: () => { gainNeed('娱乐', 24); gainNeed('心情', 6); addLog(pick(['滑梯、秋千、跷跷板，你玩了个遍。', '你从滑梯上冲下来，风在耳边呼呼响。'])); } },
  { id: 'cloudgaze', loc: 'park', label: '看云', cond: () => true, run: idleRun(IDLE_PARK, IDLE_PARK_FINDS) },
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
      if (roll < 0.3) addLog(pick(['钓上一团水草。你把它甩回了湖里。', '鱼漂动了半天，拉上来一截烂树枝。']));
      else if (roll < 0.45) { gainMoney(1); addLog('钓上一只旧皮鞋，居然抖出一枚硬币。'); }
      else if (roll < 0.8) { S.flags.ingredients = (S.flags.ingredients || 0) + 1; addLog('钓上一条小鱼！拎回家，晚上可以加餐了。'); }
      else { gainSkill('钓鱼', 4); addLog('鱼没钓到，但你把「姜太公钓鱼」理解透了。'); }
    } },
  { id: 'watch', loc: 'park', label: '观察花鸟虫鱼', cond: () => S.age <= 9, run: () => {
      gain('智力', 0.4 * S.apt.学习); gainNeed('心情', 3);
      S.flags.inspireArt = S.day; // 联动：当日练习技艺有灵感
      addLog(pick(['你看蚂蚁搬家、看蜻蜓点水，一看就是半天。', '你蹲在花坛边，看一只蜗牛爬完整片叶子。']));
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
      addLog(pick(['你在旧书店淘到一本好书，如获至宝。', '书页泛黄，但故事是新的。你把书抱得紧紧的。']));
    } },
  { id: 'toy', loc: 'square', label: '玩具摊', cost: 12, cond: () => S.money >= 12, run: () => {
      gainMoney(-12); gainNeed('娱乐', 32); gainNeed('心情', 8);
      addLog(pick(['你买了个新玩具，一路都是蹦着回家的。', '新玩具攥在手里，你一路舍不得放下。']));
    } },
  { id: 'snack', loc: 'square', label: '小吃摊', cost: 4, cond: () => S.money >= 4, run: () => {
      gainMoney(-4); gainNeed('饱食', 26); gainNeed('心情', 4);
      if (chance(0.25)) { // 联动：尝到手艺 → 揣回食材灵感
        S.flags.ingredients = (S.flags.ingredients || 0) + 1;
        addLog('你尝了摊主的手艺，回家也想试试——揣回了一份灵感（食材+1）。');
      } else addLog(pick(['一串糖葫芦下肚，甜到了心里。', '刚出锅的糖炒栗子，烫得你直哈气。', '一碗豆腐脑，咸香滑嫩，你吃得干干净净。']));
    } },
  { id: 'artist', loc: 'square', label: '看街头艺人', cond: () => true, run: () => { gainNeed('娱乐', 14); gainNeed('心情', 4); addLog(pick(['街头艺人翻着跟头，你看得津津有味。', '拉二胡的老爷爷闭着眼，你听入了迷。'])); } },
  { id: 'chess', loc: 'square', label: '棋摊看棋', cond: () => S.age >= 6, run: () => {
      gain('智力', 0.4); gainNeed('娱乐', 6);
      S.flags.chessThink = S.day; // 联动：当日看书学习有思路
      addLog(pick(['你在棋摊边看了两盘，似懂非懂。', '老大爷们的棋杀得难解难分，你大气都不敢出。']));
    } },
  /* ---- 菜市场 ---- */
  { id: 'veg', loc: 'market', label: '买菜', cost: 3, cond: () => S.money >= 3, run: () => {
      gainMoney(-3); S.flags.ingredients = (S.flags.ingredients || 0) + 1;
      gainSkill('烹饪', 1);
      addLog('你买了些菜，掂在手里沉甸甸的。回家可以做饭了。');
    } },
  { id: 'deli', loc: 'market', label: '熟食铺', cost: 6, cond: () => S.money >= 6, run: () => {
      gainMoney(-6); gainNeed('饱食', 44); gainNeed('心情', 3);
      addLog(pick(['错过了饭点，熟食铺的烧鸡救了你一命。', '半只酱鸭、二两卤味，今天的晚饭有着落了。']));
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
  daydream: { 心情: 2 },
  cloudgaze: { 心情: 2 },
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
    ? sk.map(([n, v]) => `<span class="tag" title="${n} ${v.lvl} 级 · ${skillDesc(n, v.lvl)}（经验 ${v.xp}/${v.lvl * 10}）">${n} ${'★'.repeat(v.lvl)}</span>`).join('')
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
  const sprW = $('actor-sprite-wrap'); // 立绘层同步缩放 + 情绪切图
  if (sprW && sprW.classList) {
    ['age-s', 'age-m', 'age-l'].forEach((c) => sprW.classList.remove(c));
    sprW.classList.add(ageCls);
  }
  updateSpriteMood();
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
 * 结局与回忆册
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
  if (cause === 'early') {
    return `${S.name}，${S.family.name}的孩子。\n${S.age} 岁那年，这段旅程提前画上了句号。\n日子像一盒没吃完就化掉的巧克力。\n\n——愿往后的每个日子，都被温柔以待。`;
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
  lines.push(`这一程攒下了 ${S.memories.length} 件忘不了的事。`);
  lines.push('\n日子是一盒巧克力，你永远不知道下一颗什么味道。');
  lines.push('这一颗，你尝过了。');
  return lines.join('\n');
}

function loadMemorials() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(MEMORIAL_KEY)) || []; } catch (e) { return []; }
  // 旧版存档兼容：提前落幕标记与旧标签名迁移（源码不落旧字面量，用转写比对）
  const LEGACY_CAUSE = '\u592d', LEGACY_TAG = '\u5929\u4e0d\u5047\u5e74';
  list.forEach((m) => {
    if (m.cause === LEGACY_CAUSE) m.cause = 'early';
    if (m.tags) m.tags = m.tags.map((t) => (t === LEGACY_TAG ? '未竟之年' : t));
  });
  return list;
}
function saveMemorial(entry) {
  const list = loadMemorials();
  list.unshift(entry);
  try { localStorage.setItem(MEMORIAL_KEY, JSON.stringify(list.slice(0, 30))); } catch (e) { /* 忽略 */ }
}

/* ---------------- 图鉴三期：事件 / 技能 / 成就（跨世收集） ---------------- */
const CODEX_EV_KEY = 'fusheng_codex_events';
const CODEX_SK_KEY = 'fusheng_codex_skills';
const COMBO_NAMES = { 'combo-feast': '全鱼宴', 'combo-minigame': '自己的小游戏', 'combo-lion': '庙会舞狮' };
const CODEX_SKILLS = ['绘画', '乐器', '编程', '武术', '烹饪', '钓鱼'];

function loadJson(key, fb) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fb : v; } catch (e) { return fb; }
}
function saveJson(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* 忽略 */ }
}
/* 事件图鉴：见过即收集（里程碑节拍不计，专精/组合技在技能图鉴盖章） */
function codexCollectEvent(id) {
  const set = new Set(loadJson(CODEX_EV_KEY, []));
  if (!set.has(id)) { set.add(id); saveJson(CODEX_EV_KEY, [...set]); }
}
/* 技能图鉴：一世落幕时沉淀——历史最高等级 / 解锁过的专精方向 / 出师礼 / 组合技 */
function codexMergeLife() {
  const rec = loadJson(CODEX_SK_KEY, { skills: {}, combos: [] });
  Object.entries(S.skills).forEach(([n, v]) => {
    const r = rec.skills[n] = rec.skills[n] || { best: 0, specs: [], master: false };
    if (v.lvl > r.best) r.best = v.lvl;
  });
  CODEX_SKILLS.forEach((n) => {
    const dir = S.flags['spec_' + n];
    const r = rec.skills[n] = rec.skills[n] || { best: 0, specs: [], master: false };
    if (dir && !r.specs.includes(dir)) r.specs.push(dir);
    if (S.flags['master:' + n]) r.master = true;
  });
  Object.keys(COMBO_NAMES).forEach((id) => {
    if (S.flags['seen:' + id] && !rec.combos.includes(id)) rec.combos.push(id);
  });
  saveJson(CODEX_SK_KEY, rec);
}

/* ============================================================
 * 存档系统：刷新 / 退出重进，这一程接着走
 * —— 这一程仍无法读档重来，只是允许「中场休息」
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
  if (!S.flags.tapHint) addLog('试着点点场景里的东西。', 'sys'); // 场景点触一次性提示
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
  clearSave(); // 这一程落幕，存档随之清空
  Sound.play('bell');
  const verdict = buildVerdict(cause);
  const tags = computeTags(cause);
  codexMergeLife(); // 技能图鉴：这一程的技艺沉淀进跨程档案
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
  $('end-title').textContent = cause === 'early' ? '提 前 谢 幕' : '落 幕 · 成 年';
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
    : '<p class="dim">平平淡淡，也很好。</p>');
}

/* ============================================================
 * 界面流程
 * ============================================================ */
function startLife() {
  newLife();
  spritePreload(); // 首屏预载若失败，开新一程时再试一次
  clearSave(); // 新的一程，旧的存档让位
  milestoneQueue = [];
  checkMilestones();
  Sound.play('page');
  $('screen-start').classList.add('hidden');
  $('screen-end').classList.add('hidden');
  $('screen-game').classList.remove('hidden');
  render();
  if (!S.flags.tapHint) addLog('试着点点场景里的东西。', 'sys'); // 场景点触一次性提示
  runMilestones();
}

function renderMemorials() {
  const list = loadMemorials();
  const collected = new Set();
  list.forEach((m) => (m.tags || []).forEach((t) => collected.add(t)));
  const all = Object.keys(ALL_TAGS);

  /* 事件图鉴：见过即收集，按年龄段分组；低权重/一生一次的叙事事件加「珍」 */
  const evSeen = new Set(loadJson(CODEX_EV_KEY, []));
  const isRare = (e) => (e.weight || 1) <= 0.5 || e.maxLife === 1;
  const bands = [
    ['童年 · 3-7 岁', (e) => e.min <= 7],
    ['少年 · 8-12 岁', (e) => e.min >= 8 && e.min <= 12],
    ['青春 · 13-17 岁', (e) => e.min >= 13],
  ];
  let evTotal = 0, evGot = 0;
  const evHtml = bands.map(([name, f]) => {
    const evs = EVENTS.filter(f);
    evTotal += evs.length;
    evGot += evs.filter((e) => evSeen.has(e.id)).length;
    return `<div class="codex-band"><h4>${name}</h4><div class="codex-tags">` +
      evs.map((e) => evSeen.has(e.id)
        ? `<span class="tag${isRare(e) ? ' rare-tag' : ''}" title="${e.title}">${isRare(e) ? '珍 · ' : ''}${e.title}</span>`
        : '<span class="tag dim-tag">？？？</span>').join('') +
      '</div></div>';
  }).join('');

  /* 技艺图鉴：历史最高等级 / 专精方向 / 出师印 / 组合技 */
  const skRec = loadJson(CODEX_SK_KEY, { skills: {}, combos: [] });
  const skHtml = CODEX_SKILLS.map((n) => {
    const r = skRec.skills[n] || { best: 0, specs: [], master: false };
    const b = Math.min(r.best, 5);
    const stars = '★'.repeat(b) + '☆'.repeat(5 - b);
    const bits = [];
    if (SPEC_TAGS[n]) {
      bits.push('专精 ' + Object.keys(SPEC_TAGS[n]).map((d) => (r.specs.includes(d) ? d : '？？')).join(' / '));
    }
    if (r.master) bits.push('已出师');
    return `<div class="codex-skill"><b>${n}</b> <span class="codex-stars">${stars}</span>` +
      (bits.length ? ` <span class="dim">${bits.join(' · ')}</span>` : '') + '</div>';
  }).join('');
  const comboHtml = Object.entries(COMBO_NAMES).map(([id, name]) =>
    skRec.combos.includes(id)
      ? `<span class="tag rare-tag">${name}</span>`
      : '<span class="tag dim-tag">？？？</span>').join('');

  /* 成就图鉴（结局标签） */
  const tagHtml = `<div class="codex-tags">` +
    all.map((t) => collected.has(t)
      ? `<span class="tag" title="${ALL_TAGS[t]}">${t}</span>`
      : `<span class="tag dim-tag" title="${ALL_TAGS[t]}">？？？</span>`).join('') +
    `</div>`;

  let html =
    `<div class="codex"><h3>事件图鉴 · 已收集 ${evGot}/${evTotal}</h3>${evHtml}</div>` +
    `<div class="codex"><h3>技艺图鉴</h3>${skHtml}<h4 class="codex-sub">组合技</h4><div class="codex-tags">${comboHtml}</div></div>` +
    `<div class="codex"><h3>成就图鉴 · 已收集 ${collected.size}/${all.length}</h3>${tagHtml}</div>`;
  html += list.length
    ? list.map((m) => `<div class="mem-item"><span class="mem-name">${m.name}</span>（${m.gender} · ${m.family}）<br>
        ${m.cause === 'early' ? `${m.age} 岁止步` : `平安长到 ${m.age} 岁`} · ${m.verdict} <span class="dim">${m.when}</span>` +
        (m.dream ? `<br><span class="dim">心愿：${m.dream}</span>` : '') +
        ((m.tags && m.tags.length) ? `<div class="mem-tags">${m.tags.map((t) => `<span class="tag" title="${ALL_TAGS[t] || ''}">${t}</span>`).join('')}</div>` : '') +
        `</div>`).join('')
    : '<div class="empty">回忆册还是空白。<br>去开启第一段故事吧。</div>';
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

/* ---------------- flex gap 支持检测（WebView 基线 Chrome 61） ----------------
   支持时给 <html> 加 .supports-flex-gap，CSS 据此在 margin 基线与 gap 间切换 */
function detectFlexGap() {
  try {
    if (!document.documentElement || !document.createElement) return;
    const flex = document.createElement('div');
    flex.style.display = 'flex';
    flex.style.flexDirection = 'column';
    flex.style.rowGap = '1px';
    flex.style.position = 'absolute';
    flex.style.visibility = 'hidden';
    flex.appendChild(document.createElement('div'));
    flex.appendChild(document.createElement('div'));
    (document.body || document.documentElement).appendChild(flex);
    const supported = flex.scrollHeight === 1;
    if (flex.parentNode) flex.parentNode.removeChild(flex);
    if (supported && document.documentElement.classList) {
      document.documentElement.classList.add('supports-flex-gap');
    }
  } catch (e) { /* 检测失败则保持 margin 基线布局 */ }
}

/* ---------------- 场景点触：点场景物件浮现一句闲话（不占数值、不入岁月） ---------------- */
const TAP_LINES = {
  home: ['窗台上的绿植又长了一片新叶。', '厨房的钟，走得比学校的慢。', '门垫有点歪，你顺手摆正了。', '挂钟滴答滴答，家里很安心。', '米缸盖子没盖严，你按了一下。'],
  park: ['你摸了摸老槐树粗糙的皮。', '湖面被风撩起一层细纹。', '长椅上落着一片很圆的叶子。', '远处有人放风筝，线绷得笔直。', '石凳被太阳晒得暖烘烘的。'],
  school: ['黑板上还留着上节课的板书。', '窗台上的粉笔灰积了薄薄一层。', '操场的国旗被风吹得猎猎响。', '教室后排的绿萝爬上了窗框。', '广播里传来眼保健操的前奏。'],
  square: ['糖炒栗子的香味飘了半条街。', '杂货铺的风铃叮当作响。', '电线杆上贴满了花花绿绿的广告。', '卖气球的老伯打了个盹。', '石板路被鞋底磨得发亮。'],
  market: ['鱼摊的水花溅了一地。', '豆腐摊冒着白白的热气。', '秤砣碰着秤盘，当啷一声。', '青菜叶上还挂着早上的露水。', '拐角的花椒麻了半条巷子。'],
  hospital: ['走廊尽头的窗外有一棵梧桐。', '消毒水味里混着一点饭香。', '护士站的呼叫灯闪了一下。', '长椅上的爷爷在给人让座位。', '宣传栏贴着洗手七步法。'],
};
function initSceneTaps() {
  const box = $('scene-taps');
  if (!box) return;
  for (let i = 0; i < 3; i++) {
    const t = document.createElement('div');
    t.className = 'scene-tap';
    t.addEventListener('click', () => {
      if (!S || !S.alive || eventLock) return;
      const lineEl = $('scene-tap-line');
      const pool = TAP_LINES[S.location] || [];
      if (!lineEl || !pool.length) return;
      lineEl.textContent = pick(pool);
      lineEl.classList.remove('hidden');
      lineEl.style.animation = 'none';
      void lineEl.offsetWidth; // 重触淡入淡出
      lineEl.style.animation = '';
      clearTimeout(initSceneTaps._t);
      initSceneTaps._t = setTimeout(() => lineEl.classList.add('hidden'), 2600);
      S.flags.tapHint = true;
    });
    box.appendChild(t);
  }
}

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
  detectFlexGap();
  Sound.init();
  Bgm.init();
  spritePreload();
  // iOS 音频解锁：第一次手势（捕获阶段）里唤醒 AudioContext，之后所有音效才出得来
  const unlockAudio = () => { Sound.unlock(); Bgm.unlock(); };
  ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'click'].forEach((ev) =>
    window.addEventListener(ev, unlockAudio, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { Sound.unlock(); Bgm.resync(); }
  });
  initTipPop();
  initSceneTaps();
  const sb = $('btn-sound');
  const syncSndBtn = () => { sb.textContent = Sound.muted ? '🔇' : '🔊'; };
  syncSndBtn();
  sb.onclick = () => {
    const m = Sound.toggle();
    syncSndBtn();
    if (!m) Sound.play('pop');
  };
  // 设置页：音效 / 背景音乐 两个开关
  const settingsModal = $('modal-settings');
  const renderSettings = () => {
    const sfxBtn = $('set-sfx'), bgmBtn = $('set-bgm');
    if (!sfxBtn || !bgmBtn) return;
    sfxBtn.textContent = Sound.muted ? '音效：关' : '音效：开';
    bgmBtn.textContent = Bgm.enabled ? '背景音乐：开' : '背景音乐：关';
    sfxBtn.classList.toggle('on', !Sound.muted);
    bgmBtn.classList.toggle('on', Bgm.enabled);
    // 无背景音乐构建（小红书小工具）：隐藏音乐开关与音乐音量条
    if (Bgm.noBgm) {
      bgmBtn.classList.add('hidden');
      const bv = $('set-bgm-vol');
      if (bv && bv.parentNode) bv.parentNode.classList.add('hidden');
    }
  };
  const openSettings = () => { renderSettings(); settingsModal.classList.remove('hidden'); };
  $('btn-settings').onclick = openSettings;
  $('btn-settings-game').onclick = openSettings;
  $('btn-settings-close').onclick = () => settingsModal.classList.add('hidden');
  $('set-sfx').onclick = () => {
    const m = Sound.toggle();
    syncSndBtn();
    if (!m) Sound.play('pop');
    renderSettings();
  };
  $('set-bgm').onclick = () => {
    const on = Bgm.toggle();
    if (on) Sound.play('pop');
    renderSettings();
  };
  // 音量滑条：实时生效并持久化
  const sfxVol = $('set-sfx-vol'), bgmVol = $('set-bgm-vol');
  if (sfxVol) {
    sfxVol.value = Math.round(Sound.volume * 100);
    sfxVol.addEventListener('input', () => Sound.setVolume(sfxVol.value / 100));
    sfxVol.addEventListener('change', () => Sound.play('pop')); // 松手试音
  }
  if (bgmVol) {
    bgmVol.value = Math.round(Bgm.volume * 100);
    bgmVol.addEventListener('input', () => Bgm.setVolume(bgmVol.value / 100));
  }
  $('btn-born').onclick = startLife;
  // 继续上次的旅程
  const bc = $('btn-continue');
  const saved = loadSave();
  if (saved) {
    bc.classList.remove('hidden');
    bc.textContent = `🌱 继续上次的旅程 · ${saved.state.name}（${saved.state.age} 岁 · 第 ${saved.state.day} 天）`;
    bc.onclick = () => { resumeLife(); };
  }
  $('btn-reborn').onclick = startLife;
  $('btn-to-title').onclick = () => {
    $('screen-end').classList.add('hidden');
    $('screen-start').classList.remove('hidden');
  };
  $('btn-memorial').onclick = () => { renderMemorials(); $('modal-memorial').classList.remove('hidden'); };
  $('btn-memorial-close').onclick = () => $('modal-memorial').classList.add('hidden');
  // 戳一戳小人（简笔 svg 与立绘层都挂：立绘模式下 svg 隐藏点不到）
  const poke = () => {
    if (!S || !S.alive || eventLock) return;
    if ($('screen-game').classList.contains('hidden')) return;
    Sound.play('pop');
    actorAnim('startle');
    if (chance(0.35)) {
      addLog(pick(['你戳了戳自己。疼。', '你冲自己做了个鬼脸，把自己逗笑了。', '你原地蹦了一下，心情莫名好了点。']));
      render();
    }
  };
  ['actor', 'actor-sprite-wrap'].forEach((id) => {
    const el = $(id);
    if (el && el.addEventListener) el.addEventListener('click', poke);
  });
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
 * 结局 · 岁月长卷：小人从 3 岁走到谢幕，沿途挂满记忆
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
  // 终点：成年旗 / 纪念花
  html += `<div class="scroll-flag${cause === 'early' ? ' die' : ''}" style="left:${xOf(endAge)}px">${cause === 'early' ? '✿' : '⚑'}</div>`;
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
  if (cause === 'early') {
    setTimeout(() => {
      const w = box.querySelector ? box.querySelector('.scroll-walker') : null;
      if (w) w.classList.add('fallen');
    }, dur * 1000 + 200);
  }
}
