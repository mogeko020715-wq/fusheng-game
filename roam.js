/* ============================================================
 * 漫游模式（十三期原型 → 十四期全场景）
 * 全屏摇杆漫游：场景即空间，热点即按钮，边缘过街连通八场景。
 * 纯视图层——所有行动仍走 doAction / ACTIONS，游戏状态单一来源仍是 S。
 * ============================================================ */
const ROAM_CFG = {
  sceneW: 2400, sceneH: 600,   // 场景坐标系（单位 = 世界像素，渲染时按高度缩放）
  bandTop: 392, bandBot: 468,  // 地面带：小人 y 可走范围（伪纵深）
  walkSpd: 120, runSpd: 240,   // 单位/秒
  runThresh: 0.85,             // 摇杆力度阈值：推到底切跑
  jumpDur: 650, jumpH: 72,     // 跳跃时长 ms / 高度（场景单位）
  joyR: 56, deadzone: 8,       // 摇杆半径 / 死区（屏幕 px）
  camLerp: 0.14,               // 镜头跟随平滑系数
  spotR: 130, spotDY: 60,      // 热点触发半径（x / y）
  edgeX: 110,                  // 距边缘多近亮出「去别处」
  farK: 0.3, frontK: 1.08,     // 视差系数
};

/* ---------------- 纯函数（可单测） ---------------- */
/* 摇杆偏移 → 归一化向量；死区内视为 0 */
function roamJoyVec(dx, dy, R, dead) {
  const d = Math.hypot(dx, dy);
  if (d < dead) return { x: 0, y: 0, mag: 0, run: false };
  const cl = Math.min(d, R);
  const mag = cl / R;
  return { x: (dx / d) * mag, y: (dy / d) * mag, mag, run: mag >= ROAM_CFG.runThresh };
}
/* 镜头目标值夹取 */
function roamCamClamp(target, camMax) { return Math.max(0, Math.min(camMax, target)); }
/* 热点命中判定（spots 缺省 = 公园，供单测直调） */
function roamSpotAt(x, y, spots) {
  for (const s of (spots || ROAM_SPOTS)) {
    if (Math.abs(x - s.x) <= ROAM_CFG.spotR && Math.abs(y - s.y) <= ROAM_CFG.spotDY) return s;
  }
  return null;
}
/* 跳跃抛物线：t∈[0,dur] → 离地高度（负值=向上）；起止都贴地 */
function roamJumpY(t, dur, h) {
  if (t <= 0 || t >= dur) return 0;
  return -Math.sin(Math.PI * t / dur) * h;
}
/* 跳跃帧：五帧按进度均分 */
function roamJumpFrame(t, dur) {
  const i = Math.min(4, Math.floor(t / dur * 5));
  return 'jump-' + (i + 1);
}

/* ---------------- 场景线稿（2400×600，黑白手绘） ---------------- */
/* 共用地面 */
const ROAM_GROUND = '<path d="M0 474 Q300 464 620 470 T1240 468 T1860 472 T2400 468"/><path d="M0 476 H2400" stroke-width="2"/>';
const ROAM_GRASS = '<g stroke-width="1.8">' +
  '<path d="M96 476 q2 -8 4 0 M104 476 q2 -11 4 0 M112 476 q2 -7 4 0"/>' +
  '<path d="M470 476 q2 -8 4 0 M478 476 q2 -11 4 0 M486 476 q2 -7 4 0"/>' +
  '<path d="M960 476 q2 -8 4 0 M968 476 q2 -11 4 0 M976 476 q2 -7 4 0"/>' +
  '<path d="M1560 476 q2 -8 4 0 M1568 476 q2 -11 4 0 M1576 476 q2 -7 4 0"/>' +
  '<path d="M2180 476 q2 -8 4 0 M2188 476 q2 -11 4 0 M2196 476 q2 -7 4 0"/></g>';
/* 共用远景：山线 + 云 */
function roamFar(extra) {
  return `<svg width="3000" height="600" viewBox="0 0 3000 600" fill="none" stroke="#8a867d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M0 430 Q200 380 420 412 T860 400 T1300 416 T1740 402 T2180 414 T2620 404 T3000 412"/>
  <g><animateTransform attributeName="transform" type="translate" values="0 0;60 0;0 0" dur="34s" repeatCount="indefinite"/>
    <path d="M420 150 q14 -14 28 0 q16 -10 26 4"/><path d="M1750 110 q14 -14 28 0 q16 -10 26 4"/></g>
  <g><animateTransform attributeName="transform" type="translate" values="0 0;-46 4;0 0" dur="27s" repeatCount="indefinite"/>
    <path d="M1080 130 q12 -12 24 0 q14 -9 23 3"/></g>
  ${extra || ''}
</svg>`;
}
/* 共用前景：草叶 + 飘的蒲公英 */
const ROAM_SVG_FRONT = `<svg width="2700" height="600" viewBox="0 0 2700 600" fill="none" stroke="#1c1c1c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <g stroke-width="1.8">
    <path d="M140 600 q3 -14 6 0 M152 600 q3 -18 6 0 M164 600 q3 -12 6 0"/>
    <path d="M840 600 q3 -14 6 0 M852 600 q3 -18 6 0 M864 600 q3 -12 6 0"/>
    <path d="M1540 600 q3 -14 6 0 M1552 600 q3 -18 6 0 M1564 600 q3 -12 6 0"/>
    <path d="M2240 600 q3 -14 6 0 M2252 600 q3 -18 6 0 M2264 600 q3 -12 6 0"/>
    <path d="M2620 600 q3 -14 6 0 M2632 600 q3 -18 6 0"/>
  </g>
  <g stroke-width="1.6"><animateTransform attributeName="transform" type="translate" values="0 0;90 -34;180 0;90 20;0 0" dur="13s" repeatCount="indefinite"/>
    <path d="M520 480 l3 -8 M520 480 l-6 -6 M520 480 l7 -2"/><circle cx="520" cy="480" r="1.6"/></g>
  <g stroke-width="1.6"><animateTransform attributeName="transform" type="translate" values="0 0;-70 -26;-140 0;-70 16;0 0" dur="17s" repeatCount="indefinite"/>
    <path d="M1720 500 l3 -8 M1720 500 l-6 -6 M1720 500 l7 -2"/><circle cx="1720" cy="500" r="1.6"/></g>
  <g stroke-width="1.6"><animateTransform attributeName="transform" type="translate" values="0 0;60 -40;120 -6;60 14;0 0" dur="15s" repeatCount="indefinite"/>
    <path d="M2380 470 l3 -8 M2380 470 l-6 -6 M2380 470 l7 -2"/><circle cx="2380" cy="470" r="1.6"/></g>
</svg>`;
function roamMid(inner) {
  return `<svg width="2400" height="600" viewBox="0 0 2400 600" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${ROAM_GROUND}${inner}</svg>`;
}

/* 公园（十三期原型场景） */
const ROAM_SPOTS = [
  { id: 'bench', x: 300,  y: 446, act: 'cloudgaze', label: '长椅上坐坐' },
  { id: 'tree',  x: 700,  y: 438, act: 'watch',     label: '蹲下来看看', fallback: 'walk' },
  { id: 'pond',  x: 1300, y: 452, act: 'fish',      label: '湖边垂钓',   fallback: 'walk' },
  { id: 'slide', x: 1950, y: 436, act: 'slide',     label: '滑梯秋千',   fallback: 'walk' },
];
const ROAM_SVG_FAR_PARK = roamFar(`
  <g><animateTransform attributeName="transform" type="translate" values="0 0;34 -20;0 0;-26 -10;0 0" dur="16s" repeatCount="indefinite"/>
    <path d="M640 120 l20 26 -20 26 -20 -26 z"/><path d="M640 172 q6 16 -6 28 q-10 12 -3 26" stroke-dasharray="3 4"/></g>
  <g><animateTransform attributeName="transform" type="translate" values="0 0;24 -14;0 0" dur="19s" repeatCount="indefinite"/>
    <path d="M2150 90 l16 21 -16 21 -16 -21 z"/><path d="M2150 132 q5 13 -5 23" stroke-dasharray="3 4"/></g>`);
const ROAM_SVG_MID_PARK = roamMid(`${ROAM_GRASS}
  <g><path d="M254 430 h92 M258 430 v-26 h84 v26 M272 430 v42 M328 430 v42 M262 416 h76" /></g>
  <g><animateTransform attributeName="transform" type="rotate" values="-1.2 700 470; 1.2 700 470; -1.2 700 470" dur="6.4s" repeatCount="indefinite"/>
    <path d="M700 470 V372 M700 400 q-22 -6 -30 -26 M700 392 q20 -8 26 -26"/>
    <circle cx="700" cy="330" r="46"/><circle cx="664" cy="348" r="26" stroke-width="2"/><circle cx="738" cy="344" r="28" stroke-width="2"/></g>
  <g><path d="M980 474 q-6 -26 14 -26 q2 -14 16 -12 q12 -8 20 2 q14 0 12 14 q12 4 4 22" stroke-width="2"/></g>
  <g stroke-width="2"><path d="M140 474 q-4 -18 10 -18 q2 -10 12 -8 q9 -6 14 2 q10 0 9 10 q9 3 3 16"/>
  <path d="M2310 474 q-4 -18 10 -18 q2 -10 12 -8 q9 -6 14 2 q10 0 9 10 q9 3 3 16"/></g>
  <g><animateTransform attributeName="transform" type="rotate" values="1.4 1500 472; -1.4 1500 472; 1.4 1500 472" dur="5.6s" repeatCount="indefinite"/>
    <path d="M1500 472 V408"/><circle cx="1500" cy="392" r="26"/></g>
  <g><ellipse cx="1300" cy="508" rx="128" ry="24"/>
    <g stroke-width="1.8" stroke-dasharray="12 10">
      <path d="M1210 500 H1390"><animate attributeName="stroke-dashoffset" values="0;-44" dur="4.2s" repeatCount="indefinite"/></path>
      <path d="M1236 510 H1364"><animate attributeName="stroke-dashoffset" values="0;-44" dur="5.1s" repeatCount="indefinite"/></path>
    </g>
    <path d="M1180 474 q3 -4 6 0 M1380 496 q3 -4 6 0" stroke-width="1.8"/></g>
  <g><path d="M1620 472 V384 q0 -10 12 -10"/><circle cx="1635" cy="377" r="4" stroke-width="1.8"/></g>
  <g><path d="M1896 470 V348 h44 M1896 382 h44 M1896 416 h44"/>
    <path d="M1940 348 L2062 470"/><path d="M1940 362 L2044 470" stroke-width="1.8"/>
    <path d="M1896 348 q-8 -8 4 -10 h30"/></g>
  <g><path d="M2280 474 V396"/>
    <g><animateTransform attributeName="transform" type="rotate" values="0 2280 388; 360 2280 388" dur="7s" repeatCount="indefinite"/>
      <path d="M2280 388 l14 -14 M2280 388 l14 14 M2280 388 l-14 14 M2280 388 l-14 -14" stroke-width="2"/></g></g>`);

/* 八场景登记表 */
const ROAM_SCENES = {
  home: {
    far: roamFar(''),
    mid: roamMid(`
  <g><rect x="270" y="416" width="150" height="58" rx="6"/><path d="M270 416 v-22 h40 v22" stroke-width="2"/><path d="M282 404 h22" stroke-width="2"/><path d="M270 444 h150" stroke-width="1.8"/></g>
  <g><path d="M860 474 v-58 h120 v58 M860 440 h120 M884 474 v-34 M1056 474 v-34"/><path d="M920 416 l10 -16 10 16" stroke-width="2"/><rect x="940" y="404" width="26" height="12" stroke-width="1.8"/></g>
  <g><rect x="1440" y="400" width="120" height="74" rx="4"/><path d="M1440 430 h120 M1494 400 v74" stroke-width="1.8"/>
    <g><animate attributeName="opacity" values="1;.4;1" dur="1.6s" repeatCount="indefinite"/><path d="M1520 388 q4 -8 0 -14 M1530 388 q4 -8 0 -14" stroke-width="1.8"/></g></g>
  <g><path d="M1930 474 v-34 q0 -14 14 -14 h112 q14 0 14 14 v34 M1930 452 h140 M1958 474 v-22 M2042 474 v-22"/></g>
  <g><rect x="1150" y="330" width="90" height="70" stroke-width="2"/><path d="M1150 365 h90 M1195 330 v70" stroke-width="1.8"/>
    <g><animateTransform attributeName="transform" type="rotate" values="-2 1150 330; 2 1150 330; -2 1150 330" dur="5s" repeatCount="indefinite"/><path d="M1150 330 q-14 34 0 70" stroke-width="1.8"/></g>
    <g><animateTransform attributeName="transform" type="rotate" values="2 1240 330; -2 1240 330; 2 1240 330" dur="5.6s" repeatCount="indefinite"/><path d="M1240 330 q14 34 0 70" stroke-width="1.8"/></g></g>
  <g><circle cx="620" cy="350" r="22" stroke-width="2"/><path d="M500 380 h60 v-44 h-60 z M510 336 h40" stroke-width="1.8"/></g>`),
    front: '',
    spots: [
      { id: 'bed',   x: 350,  y: 446, act: 'sleep', label: '躺下睡会儿' },
      { id: 'desk',  x: 920,  y: 446, act: 'study', label: '看会儿书' },
      { id: 'stove', x: 1500, y: 446, act: 'cook',  label: '去厨房看看', fallback: 'wash' },
      { id: 'sofa',  x: 2000, y: 446, act: 'chat',  label: '和家人聊天' },
    ],
  },
  park: { far: ROAM_SVG_FAR_PARK, mid: ROAM_SVG_MID_PARK, front: ROAM_SVG_FRONT, spots: ROAM_SPOTS },
  river: {
    far: roamFar(`<path d="M1350 432 q60 -34 110 0 M1366 430 v-14 M1444 430 v-14" stroke-width="1.8"/>`),
    mid: roamMid(`${ROAM_GRASS}
  <g><path d="M0 500 Q400 488 800 496 T1600 494 T2400 498" stroke-width="2.2"/>
    <g stroke-width="1.6" stroke-dasharray="14 12">
      <path d="M60 522 H2340"><animate attributeName="stroke-dashoffset" values="0;-52" dur="4.6s" repeatCount="indefinite"/></path>
      <path d="M160 546 H2240"><animate attributeName="stroke-dashoffset" values="0;-52" dur="5.8s" repeatCount="indefinite"/></path>
    </g></g>
  <g stroke-width="2"><path d="M470 486 q3 -16 6 0 M482 486 q3 -22 6 0 M494 486 q3 -13 6 0"/><ellipse cx="500" cy="492" rx="40" ry="7" stroke-width="1.8"/></g>
  <g><ellipse cx="1290" cy="480" rx="34" ry="9"/><ellipse cx="1330" cy="484" rx="26" ry="7" stroke-width="2"/></g>
  <g><animateTransform attributeName="transform" type="rotate" values="-1.6 2020 476; 1.6 2020 476; -1.6 2020 476" dur="6s" repeatCount="indefinite"/>
    <path d="M2020 476 V380 M2020 380 q-30 4 -38 40 M2020 380 q26 6 32 42 M2020 392 q-18 10 -22 34 M2020 392 q16 12 18 36"/>
    <circle cx="2020" cy="368" r="18" stroke-width="2"/></g>
  <g><animateTransform attributeName="transform" type="translate" values="0 0;26 -8;52 0;26 6;0 0" dur="9s" repeatCount="indefinite"/>
    <path d="M1050 440 q3 -3 6 0 q-3 3 -6 0 z M1053 437 v-4 M1053 443 v4" stroke-width="1.6"/></g>`),
    front: ROAM_SVG_FRONT,
    spots: [
      { id: 'shore',  x: 500,  y: 452, act: 'tadpole', label: '捉蝌蚪', fallback: 'boat' },
      { id: 'pier',   x: 1300, y: 452, act: 'skim',    label: '打水漂', fallback: 'boat' },
      { id: 'willow', x: 2000, y: 446, act: 'boat',    label: '放纸船' },
    ],
  },
  school: {
    far: roamFar(''),
    mid: roamMid(`${ROAM_GRASS}
  <g><rect x="560" y="330" width="280" height="144"/><path d="M560 330 L700 276 L840 330"/><path d="M700 276 V252 M700 252 l26 7 -26 8" stroke-width="2"/>
    <g stroke-width="1.8"><rect x="596" y="356" width="26" height="20"/><rect x="660" y="356" width="26" height="20"/><rect x="724" y="356" width="26" height="20"/><rect x="596" y="402" width="26" height="20"/><rect x="724" y="402" width="26" height="20"/></g>
    <path d="M676 474 v-44 h48 v44"/></g>
  <g><rect x="1520" y="360" width="180" height="114"/><path d="M1520 360 L1610 322 L1700 360"/>
    <g stroke-width="1.8"><rect x="1552" y="384" width="22" height="18"/><rect x="1608" y="384" width="22" height="18"/><rect x="1664" y="384" width="22" height="18"/></g>
    <path d="M1596 474 v-34 h28 v34"/></g>
  <g><path d="M2130 474 V396 M2230 474 V396 M2130 396 h100 M2158 396 v-14 h44 v14" stroke-width="2.2"/></g>
  <g stroke-width="1.6" stroke-dasharray="8 8"><path d="M120 500 H560"/><path d="M120 524 H560"/></g>`),
    front: ROAM_SVG_FRONT,
    spots: [
      { id: 'building', x: 700,  y: 446, act: 'class', label: '去上课' },
      { id: 'clubroom', x: 1600, y: 446, act: 'club',  label: '去社团转转' },
      { id: 'gate',     x: 2180, y: 446, act: 'skip',  label: '溜出校门' },
    ],
  },
  palace: {
    far: roamFar(''),
    mid: roamMid(`${ROAM_GRASS}
  <g><rect x="480" y="320" width="240" height="154"/><path d="M480 320 L600 282 L720 320"/>
    <g stroke-width="1.8"><rect x="512" y="346" width="24" height="20"/><rect x="566" y="346" width="24" height="20"/><rect x="620" y="346" width="24" height="20"/><rect x="674" y="346" width="24" height="20"/><rect x="512" y="392" width="24" height="20"/><rect x="620" y="392" width="24" height="20"/></g>
    <path d="M566 474 v-40 h48 v44"/>
    <g><animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="3s" repeatCount="indefinite"/><text x="586" y="318" font-size="16" stroke="none" fill="#1c1c1c">♪</text></g></g>
  <g><rect x="1210" y="368" width="190" height="106"/><g stroke-width="1.8"><rect x="1236" y="392" width="44" height="34"/><rect x="1308" y="392" width="44" height="20" height="32"/><path d="M1236 410 h44 M1330 392 v32"/></g><path d="M1210 368 h190" stroke-width="3"/></g>
  <g><path d="M1900 474 h200 v-26 h-200 z M1900 448 h200"/>
    <g><animateTransform attributeName="transform" type="rotate" values="-2 2000 396; 2 2000 396; -2 2000 396" dur="5.4s" repeatCount="indefinite"/><path d="M1960 448 v-52 q20 -12 40 0 q20 -12 40 0 v52" stroke-width="1.8"/></g></g>
  <g><path d="M2220 474 V420 h14 v54 M2227 420 v-30 M2227 390 l16 5 -16 6" stroke-width="2"/></g>`),
    front: ROAM_SVG_FRONT,
    spots: [
      { id: 'classroom', x: 600,  y: 446, act: 'lesson',  label: '进教室看看', fallback: 'watchclass' },
      { id: 'gallery',   x: 1300, y: 446, act: 'exhibit', label: '看展览' },
      { id: 'stage',     x: 2000, y: 446, act: 'recital', label: '小舞台',     fallback: 'exhibit' },
    ],
  },
  square: {
    far: roamFar(`<path d="M220 430 V370 h20 v60 M340 430 V384 h16 v46 M2300 430 V368 h20 v62 M2420 430 V386 h14 v44" stroke-width="1.8"/>`),
    mid: roamMid(`${ROAM_GRASS}
  <g><rect x="320" y="392" width="160" height="82"/><path d="M310 392 h180 l-12 -22 h-156 z"/>
    <path d="M340 474 v-46 h50 v46" stroke-width="2"/><g stroke-width="1.8"><rect x="412" y="420" width="52" height="26"/><path d="M412 433 h52"/></g></g>
  <g><rect x="930" y="400" width="150" height="74"/><path d="M930 400 L1005 372 L1080 400"/>
    <g stroke-width="1.8"><path d="M956 474 v-30 h40 M1000 444 h56 M1000 452 h56 M1000 460 h56"/></g></g>
  <g><path d="M1540 474 v-64 h130 v74 M1540 400 h130"/><ellipse cx="1605" cy="392" rx="26" ry="8" stroke-width="2"/>
    <g><animate attributeName="opacity" values="1;.35;1" dur="1.9s" repeatCount="indefinite"/><path d="M1598 374 q4 -9 0 -16 M1610 374 q4 -9 0 -16" stroke-width="1.8"/></g>
    <path d="M1540 428 h130" stroke-width="1.8"/></g>
  <g><rect x="2040" y="428" width="120" height="12" stroke-width="2"/><path d="M2060 440 v34 M2140 440 v34 M2040 422 h120" stroke-width="2"/>
    <circle cx="2076" cy="416" r="7" stroke-width="1.8"/><circle cx="2120" cy="416" r="7" stroke-width="1.8"/><circle cx="2146" cy="418" r="6" stroke-width="1.8"/></g>`),
    front: ROAM_SVG_FRONT,
    spots: [
      { id: 'store',  x: 400,  y: 446, act: 'store', label: '小卖部' },
      { id: 'book',   x: 1000, y: 446, act: 'book',  label: '旧书店',  fallback: 'artist' },
      { id: 'snack',  x: 1600, y: 446, act: 'snack', label: '小吃摊',  fallback: 'artist' },
      { id: 'chess',  x: 2100, y: 446, act: 'chess', label: '棋摊看棋', fallback: 'artist' },
    ],
  },
  market: {
    far: roamFar(`<path d="M180 430 V376 h22 v54 M1500 430 V380 h18 v50 M2360 430 V372 h20 v58" stroke-width="1.8"/>`),
    mid: roamMid(`${ROAM_GRASS}
  <g><path d="M420 474 v-56 h170 v56 M420 418 h170" /><g stroke-width="1.8"><path d="M440 452 h40 M440 460 h40 M496 452 h52 M496 460 h52"/><circle cx="460" cy="444" r="6"/><circle cx="520" cy="444" r="6"/><circle cx="536" cy="444" r="6"/></g>
    <path d="M410 418 h190 l-14 -20 h-162 z"/></g>
  <g><rect x="1130" y="400" width="150" height="74"/><path d="M1130 400 h150 l-10 -18 h-130 z"/>
    <g stroke-width="1.8"><path d="M1160 428 q10 10 20 0 q10 10 20 0"/><path d="M1170 428 v14 M1190 428 v14"/></g></g>
  <g><circle cx="1900" cy="458" r="16"/><path d="M1840 442 h120 l-10 -18 h-100 z M1860 474 v-16 M1940 474 v-16" stroke-width="2.2"/>
    <g stroke-width="1.8"><path d="M1862 424 h20 M1888 424 h20 M1914 424 h20"/></g></g>
  <g><path d="M2260 474 v-40 h60 v40 M2260 446 h60" stroke-width="2"/></g>`),
    front: ROAM_SVG_FRONT,
    spots: [
      { id: 'veg',  x: 500,  y: 446, act: 'veg',   label: '菜摊买菜' },
      { id: 'deli', x: 1200, y: 446, act: 'deli',  label: '熟食铺' },
      { id: 'cart', x: 1900, y: 446, act: 'carry', label: '帮把手' },
    ],
  },
  hospital: {
    far: roamFar(''),
    mid: roamMid(`${ROAM_GRASS}
  <g><rect x="620" y="330" width="280" height="144"/><path d="M620 330 h280" stroke-width="3"/>
    <path d="M742 350 h20 v-14 h16 v14 h20 v16 h-20 v14 h-16 v-14 h-20 z" stroke-width="2"/>
    <g stroke-width="1.8"><rect x="660" y="400" width="24" height="20"/><rect x="724" y="400" width="24" height="20"/><rect x="788" y="400" width="24" height="20"/></g>
    <path d="M736 474 v-30 h48 v30"/></g>
  <g><rect x="1500" y="380" width="170" height="94"/><path d="M1500 380 L1585 348 L1670 380"/>
    <g stroke-width="1.8"><rect x="1530" y="404" width="22" height="18"/><rect x="1618" y="404" width="22" height="18"/></g>
    <path d="M1572 474 v-30 h26 v30"/></g>
  <g><path d="M2150 444 h120 M2158 444 v30 M2254 444 v30 M2158 444 v-18 h96 v18" stroke-width="2"/></g>
  <g><animateTransform attributeName="transform" type="rotate" values="1.4 300 472; -1.4 300 472; 1.4 300 472" dur="5.2s" repeatCount="indefinite"/>
    <path d="M300 472 V410"/><circle cx="300" cy="394" r="24"/></g>`),
    front: ROAM_SVG_FRONT,
    spots: [
      { id: 'clinic',  x: 760,  y: 446, act: 'cure',    label: '诊室看病' },
      { id: 'checkup', x: 1580, y: 446, act: 'checkup', label: '体检处' },
    ],
  },
};

/* ---------------- 运行时状态 ---------------- */
const ROAM_FRAME = {
  walk: ['walk-1', 'walk-2', 'walk-3', 'walk-4', 'walk-5', 'walk-6'],
  run: ['run-1', 'run-2', 'run-3', 'run-4'],
  jump: ['jump-1', 'jump-2', 'jump-3', 'jump-4', 'jump-5'],
};
const ROAM_SPRITE_DIR = 'assets/actor/sprites/';
const roamCache = {};
let roam = null;

function roamOn() { return !!(roam && roam.on); }
function roamScene() { return (typeof S !== 'undefined' && S && ROAM_SCENES[S.location]) || ROAM_SCENES.park; }

function roamPreload() {
  if (typeof Image === 'undefined') return;
  ROAM_FRAME.walk.concat(ROAM_FRAME.run, ROAM_FRAME.jump, ['stand', 'happy', 'weak', 'sick']).forEach((n) => {
    if (roamCache[n]) return;
    const im = new Image();
    im.src = ROAM_SPRITE_DIR + n + '.png';
    roamCache[n] = im;
  });
}
/* 待机帧：复用主界面的情绪逻辑（感冒/虚弱/开心/平常） */
function roamIdleFrame() {
  if (!S) return 'stand';
  if (S.buffs.some((b) => b.name === '感冒')) return 'sick';
  const down = S.needs.精力 < 25 || S.needs.健康 < 30 || S.needs.心情 < 25;
  return down ? 'weak' : S.needs.心情 >= 80 ? 'happy' : 'stand';
}
function roamSetFrame(name) {
  const img = document.getElementById('roam-actor-img');
  const im = roamCache[name] || roamCache.stand;
  if (!img || !im || !im.src) return;
  if (roam.frame !== name) { roam.frame = name; img.src = im.src; }
}
/* 弹窗开着 / 事件锁定时暂停行走 */
function roamBusy() {
  const open = (id) => { const m = document.getElementById(id); return m && m.classList && !m.classList.contains('hidden'); };
  return (typeof eventLock !== 'undefined' && eventLock) ||
    open('modal-event') || open('modal-dream') || open('modal-map') || open('modal-shop') || open('screen-end');
}
/* 热点 → 当前可执行的动作（cond 不满足走 fallback，都没有返回 null → 只亮圈不亮按钮） */
function roamSpotAction(s) {
  if (typeof ACTIONS === 'undefined' || !S) return null;
  let a = ACTIONS.find((x) => x.loc === S.location && x.id === s.act && (!x.cond || x.cond()));
  if (!a && s.fallback) a = ACTIONS.find((x) => x.loc === S.location && x.id === s.fallback && (!x.cond || x.cond()));
  return a || null;
}

/* ---------------- 场景装配 ---------------- */
function roamBuildScene() {
  const sc = roamScene();
  document.getElementById('roam-far').innerHTML = sc.far;
  document.getElementById('roam-mid').innerHTML = sc.mid;
  document.getElementById('roam-front').innerHTML = sc.front || '';
  const box = document.getElementById('roam-spots');
  if (!box) return;
  box.innerHTML = '';
  sc.spots.forEach((s) => {
    const mark = document.createElement('div');
    mark.className = 'roam-mark';
    mark.style.left = s.x + 'px';
    mark.style.top = (s.y + 18) + 'px';
    box.appendChild(mark);
    const b = document.createElement('button');
    b.className = 'roam-spot hidden';
    b.id = 'roam-spot-' + s.id;
    b.style.left = s.x + 'px';
    b.style.top = (s.y - 200) + 'px';
    b.textContent = s.label;
    b.addEventListener('click', () => roamDoSpot(s));
    box.appendChild(b);
  });
  if (roam && typeof S !== 'undefined' && S) roam.builtLoc = S.location;
}

/* 时间表 + 天色：帧率无关，变了才写 */
function roamHudSync() {
  if (typeof S === 'undefined' || !S) return;
  const root = document.getElementById('roam');
  const t = document.getElementById('roam-time');
  const txt = S.age + ' 岁 · 第 ' + S.day + ' 天 · ' +
    (typeof SLOTS !== 'undefined' ? SLOTS[S.slot] : '') +
    (typeof MEAL_SLOTS !== 'undefined' && MEAL_SLOTS.indexOf(S.slot) >= 0 ? ' · 饭点' : '');
  if (t && roam.lastHud !== txt) { roam.lastHud = txt; t.textContent = txt; }
  if (root && roam.lastSlot !== S.slot) {
    roam.lastSlot = S.slot;
    root.classList.remove('slot-0', 'slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5');
    root.classList.add('slot-' + S.slot);
  }
}

/* ---------------- 进入 / 退出 / 过街 ---------------- */
function enterRoam() {
  if (typeof S === 'undefined' || !S || !S.alive) return;
  if (!ROAM_SCENES[S.location]) return;
  const root = document.getElementById('roam');
  if (!root) return;
  roamPreload();
  roam = {
    on: true,
    x: 480, y: 440, dir: 1, cam: 0,
    ix: 0, iy: 0, run: false,
    joyId: null, joyCX: 0, joyCY: 0, joyDX: 0, joyDY: 0,
    keys: {}, frame: '', frameT: 0, frameI: 0,
    jumpT: -1, // -1 = 不在跳；>=0 为已起跳毫秒数
    spot: null, edge: 0, lastLog: '', logTimer: 0, lastT: 0,
  };
  roamBuildScene();
  root.classList.remove('hidden');
  if (document.body && document.body.classList) document.body.classList.add('roam-lock');
  if (typeof Sound !== 'undefined') Sound.play('page');
  roamSetFrame(roamIdleFrame());
  roam.lastT = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  roamLoop(roam.lastT);
}
function exitRoam() {
  const root = document.getElementById('roam');
  if (root) root.classList.add('hidden');
  if (document.body && document.body.classList) document.body.classList.remove('roam-lock');
  const joy = document.getElementById('roam-joy');
  if (joy) joy.classList.add('hidden');
  roam = null;
}
/* 走到边缘 → 沿街换场景（复用 cycleLoc 的顺序与年龄门控），落在对面边缘 */
function roamEdgeGo(dir) {
  if (typeof SCENES === 'undefined' || !S) return;
  if (roamBusy()) return;
  const ids = Object.keys(SCENES).filter((k) => S.age >= SCENES[k].min && ROAM_SCENES[k]);
  if (ids.length < 2) return;
  const i = ids.indexOf(S.location);
  const target = ids[(i + dir + ids.length) % ids.length];
  if (!target || target === S.location) return;
  roam.spot = null;
  roam.x = dir > 0 ? 150 : ROAM_CFG.sceneW - 150;
  roam.dir = dir;
  if (typeof Sound !== 'undefined') Sound.play('page');
  // switchLocation 有 280ms 过场动画，场景重建与镜头落位等它完成
  if (typeof switchLocation === 'function') {
    switchLocation(target);
    setTimeout(() => {
      if (!roam || !roam.on || S.location !== target) return;
      roamBuildScene();
      const root = document.getElementById('roam');
      const k = (root.clientHeight || 700) / ROAM_CFG.sceneH;
      const viewW = (root.clientWidth || 390) / k;
      roam.cam = roamCamClamp(roam.x - viewW / 2, Math.max(0, ROAM_CFG.sceneW - viewW));
    }, 300);
  } else {
    S.location = target;
    roamBuildScene();
  }
}

/* 热点点击 = 调现有动作（含 fallback） */
function roamDoSpot(s) {
  if (typeof doAction !== 'function') return;
  const a = roamSpotAction(s);
  if (!a) return;
  if (typeof Sound !== 'undefined') Sound.play('pop');
  doAction(a.run, (typeof ACT_ANIM !== 'undefined' && ACT_ANIM[a.id]) || 'stand', a.id);
}

/* 起跳：空中不二段跳，弹窗时不跳 */
function roamJump() {
  if (!roam || !roam.on || roam.jumpT >= 0 || roamBusy()) return;
  roam.jumpT = 0;
  if (typeof Sound !== 'undefined') Sound.play('scratch');
}

/* ---------------- 主循环 ---------------- */
function roamLoop(now) {
  if (!roam || !roam.on) return;
  const raf = (typeof requestAnimationFrame !== 'undefined')
    ? requestAnimationFrame : (fn) => setTimeout(() => fn(Date.now()), 16);
  raf(roamLoop);
  const dt = Math.min(50, Math.max(1, now - roam.lastT)) / 1000;
  roam.lastT = now;

  const root = document.getElementById('roam');
  if (!root) return;
  const stageW = root.clientWidth || 390, stageH = root.clientHeight || 700;
  const k = stageH / ROAM_CFG.sceneH;
  const viewW = stageW / k;

  // 输入：摇杆优先，键盘其次
  let vx = roam.joyDX, vy = roam.joyDY, running = roam.run;
  const kk = roam.keys;
  const kx = (kk.ArrowRight || kk.d ? 1 : 0) - (kk.ArrowLeft || kk.a ? 1 : 0);
  const ky = (kk.ArrowDown || kk.s ? 1 : 0) - (kk.ArrowUp || kk.w ? 1 : 0);
  if (kx || ky) {
    const m = Math.hypot(kx, ky);
    vx = kx / m; vy = ky / m; running = !!(kk.Shift);
  }
  if (roamBusy() || !S || !S.alive) { vx = 0; vy = 0; }

  // 位移 + 边界
  const spd = running ? ROAM_CFG.runSpd : ROAM_CFG.walkSpd;
  roam.x = Math.max(60, Math.min(ROAM_CFG.sceneW - 60, roam.x + vx * spd * dt));
  roam.y = Math.max(ROAM_CFG.bandTop, Math.min(ROAM_CFG.bandBot, roam.y + vy * spd * 0.55 * dt));
  if (vx > 0.05) roam.dir = 1; else if (vx < -0.05) roam.dir = -1;

  // 跳跃推进（空中不影响移动）
  let jumpY = 0;
  if (roam.jumpT >= 0) {
    roam.jumpT += dt * 1000;
    if (roam.jumpT >= ROAM_CFG.jumpDur) { roam.jumpT = -1; }
    else jumpY = roamJumpY(roam.jumpT, ROAM_CFG.jumpDur, ROAM_CFG.jumpH);
  }

  // 镜头跟随（lerp）
  const camMax = Math.max(0, ROAM_CFG.sceneW - viewW);
  const target = roamCamClamp(roam.x - viewW / 2, camMax);
  roam.cam += (target - roam.cam) * Math.min(1, ROAM_CFG.camLerp * dt * 60);

  // 应用变换
  const world = document.getElementById('roam-world');
  if (world) world.style.transform = `translateX(${-roam.cam * k}px) scale(${k})`;
  const far = document.getElementById('roam-far');
  if (far) far.style.transform = `translateX(${-roam.cam * ROAM_CFG.farK * k}px) scale(${k})`;
  const front = document.getElementById('roam-front');
  if (front) front.style.transform = `translateX(${-roam.cam * ROAM_CFG.frontK * k}px) scale(${k})`;

  // 小人：锚点底中，伪纵深缩放 + 朝向翻转
  const depth = (roam.y - ROAM_CFG.bandTop) / (ROAM_CFG.bandBot - ROAM_CFG.bandTop);
  const scale = 0.85 + 0.3 * depth;
  const actor = document.getElementById('roam-actor');
  if (actor) {
    actor.style.transform =
      `translate(${roam.x}px, ${roam.y + jumpY}px) translate(-50%, -100%) scale(${scale}) scaleX(${roam.dir})`;
  }

  // 帧动画：跳跃 > 走跑 > 待机
  const moving = Math.hypot(vx, vy) > 0.05;
  roam.frameT += dt * 1000;
  if (roam.jumpT >= 0) {
    roamSetFrame(roamJumpFrame(roam.jumpT, ROAM_CFG.jumpDur));
  } else if (moving) {
    const set = running ? ROAM_FRAME.run : ROAM_FRAME.walk;
    const interval = running ? 95 : 150;
    if (roam.frameT >= interval) {
      roam.frameT = 0;
      roam.frameI = (roam.frameI + 1) % set.length;
    }
    roamSetFrame(set[roam.frameI % set.length]);
  } else {
    roam.frameI = 0;
    roamSetFrame(roamIdleFrame());
  }

  // 位置守望：地图跳转 / 边缘过街落地后重建场景（roamBuildScene 内置幂等标记）
  if (S && roam.builtLoc !== S.location) roamBuildScene();

  // 时间表与天色
  roamHudSync();

  // 热点：走近且有可执行动作才亮按钮
  const rawSpot = roamBusy() ? null : roamSpotAt(roam.x, roam.y, roamScene().spots);
  const spot = rawSpot && roamSpotAction(rawSpot) ? rawSpot : null;
  if (spot !== roam.spot) {
    if (roam.spot) {
      const ob = document.getElementById('roam-spot-' + roam.spot.id);
      if (ob) ob.classList.add('hidden');
    }
    roam.spot = spot;
    if (spot) {
      const nb = document.getElementById('roam-spot-' + spot.id);
      if (nb) nb.classList.remove('hidden');
      if (typeof Sound !== 'undefined') Sound.play('scratch');
    }
  }

  // 边缘过街按钮
  const busy = roamBusy();
  const prev = document.getElementById('roam-prev');
  const next = document.getElementById('roam-next');
  if (prev) prev.classList.toggle('hidden', busy || roam.x > ROAM_CFG.edgeX + 40);
  if (next) next.classList.toggle('hidden', busy || roam.x < ROAM_CFG.sceneW - ROAM_CFG.edgeX - 40);

  // 日志镜像：主界面 log-ticker 的最新一句
  roam.logTimer += dt * 1000;
  if (roam.logTimer > 350) {
    roam.logTimer = 0;
    const t = document.getElementById('log-ticker');
    const txt = t ? t.textContent : '';
    if (txt && txt !== roam.lastLog) {
      roam.lastLog = txt;
      const rl = document.getElementById('roam-log');
      if (rl) {
        rl.textContent = txt;
        rl.classList.add('show');
        clearTimeout(roam._logHide);
        roam._logHide = setTimeout(() => rl.classList.remove('show'), 4200);
      }
    }
  }
}

/* ---------------- 摇杆（dynamic：落点即中心）与键盘 ---------------- */
function roamBind() {
  const root = document.getElementById('roam');
  if (!root || !root.addEventListener) return;

  const joyEl = document.getElementById('roam-joy');
  const knob = document.getElementById('roam-joy-knob');
  const setKnob = (dx, dy) => {
    if (knob) knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  };
  const joyStart = (cx, cy, id) => {
    if (!roam || roam.joyId !== null) return;
    roam.joyId = id; roam.joyCX = cx; roam.joyCY = cy; roam.joyDX = 0; roam.joyDY = 0;
    if (joyEl) {
      joyEl.style.left = cx + 'px'; joyEl.style.top = cy + 'px';
      joyEl.classList.remove('hidden');
    }
    setKnob(0, 0);
  };
  const joyMove = (cx, cy) => {
    if (!roam || roam.joyId === null) return;
    const v = roamJoyVec(cx - roam.joyCX, cy - roam.joyCY, ROAM_CFG.joyR, ROAM_CFG.deadzone);
    roam.joyDX = v.x; roam.joyDY = v.y; roam.run = v.run;
    const d = Math.min(Math.hypot(cx - roam.joyCX, cy - roam.joyCY), ROAM_CFG.joyR);
    const ang = Math.atan2(cy - roam.joyCY, cx - roam.joyCX);
    setKnob(Math.cos(ang) * d, Math.sin(ang) * d);
  };
  const joyEnd = () => {
    if (!roam) return;
    roam.joyId = null; roam.joyDX = 0; roam.joyDY = 0; roam.run = false;
    if (joyEl) joyEl.classList.add('hidden');
    setKnob(0, 0);
  };
  const inZone = (x, y, t) => {
    const w = root.clientWidth || 390;
    if (t && t.closest && (t.closest('.roam-spot') || t.closest('#roam-back') || t.closest('.roam-edge') || t.closest('#roam-hud'))) return false;
    return x < w * 0.62; // 左 62% 屏幕为摇杆区，右侧留给跳跃点按与按钮
  };

  root.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    if (inZone(t.clientX, t.clientY, e.target)) { e.preventDefault(); joyStart(t.clientX, t.clientY, t.identifier); }
    else if (e.target && e.target.closest && !e.target.closest('.roam-spot') && !e.target.closest('#roam-back') && !e.target.closest('.roam-edge') && !e.target.closest('#roam-hud')) {
      e.preventDefault(); roamJump(); // 右半屏点按 = 跳
    }
  }, { passive: false });
  root.addEventListener('touchmove', (e) => {
    if (!roam || roam.joyId === null) return;
    for (const t of e.changedTouches) {
      if (t.identifier === roam.joyId) { e.preventDefault(); joyMove(t.clientX, t.clientY); }
    }
  }, { passive: false });
  root.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) if (roam && t.identifier === roam.joyId) joyEnd();
  });
  root.addEventListener('touchcancel', joyEnd);

  // 桌面鼠标同款：左区摇杆，右区点按跳
  root.addEventListener('mousedown', (e) => {
    if (inZone(e.clientX, e.clientY, e.target)) { e.preventDefault(); joyStart(e.clientX, e.clientY, 'mouse'); }
    else if (e.target && e.target.closest && !e.target.closest('.roam-spot') && !e.target.closest('#roam-back') && !e.target.closest('.roam-edge') && !e.target.closest('#roam-hud')) {
      roamJump();
    }
  });
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('mousemove', (e) => { if (roam && roam.joyId === 'mouse') joyMove(e.clientX, e.clientY); });
    window.addEventListener('mouseup', () => { if (roam && roam.joyId === 'mouse') joyEnd(); });
    window.addEventListener('keydown', (e) => {
      if (!roamOn()) return;
      const k2 = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd', 'Shift'].indexOf(k2) >= 0) {
        roam.keys[k2] = true;
        if (k2.indexOf('Arrow') === 0) e.preventDefault();
      } else if (e.key === ' ') { e.preventDefault(); roamJump(); }
      else if (e.key === 'Escape') { exitRoam(); }
    });
    window.addEventListener('keyup', (e) => {
      if (!roam) return;
      const k2 = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      delete roam.keys[k2];
    });
  }

  const back = document.getElementById('roam-back');
  if (back) back.addEventListener('click', () => { if (typeof Sound !== 'undefined') Sound.play('page'); exitRoam(); });
  const prevB = document.getElementById('roam-prev');
  if (prevB) prevB.addEventListener('click', () => roamEdgeGo(-1));
  const nextB = document.getElementById('roam-next');
  if (nextB) nextB.addEventListener('click', () => roamEdgeGo(1));
  const mapB = document.getElementById('roam-map');
  if (mapB) {
    if (typeof MAP_ICON !== 'undefined') {
      mapB.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + MAP_ICON + '</svg>';
    }
    mapB.addEventListener('click', () => { if (typeof openMap === 'function') openMap(); });
  }
  const enterBtn = document.getElementById('btn-roam');
  if (enterBtn) enterBtn.addEventListener('click', enterRoam);
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', roamBind);
  if (document.readyState && document.readyState !== 'loading') roamBind();
}
