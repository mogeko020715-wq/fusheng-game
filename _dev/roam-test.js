/* 漫游模式定向补测：摇杆向量 / 镜头夹取 / 热点命中 */
const fs = require('fs');
const src = fs.readFileSync('roam.js', 'utf8');
const gameSrc = fs.readFileSync('game.js', 'utf8');
const driver = `
const GAME_SRC = ${JSON.stringify(gameSrc)};
;(function roamTest(){
  const R = {};
  const CFG = { joyR: 56, deadzone: 8 };

  // 1. 摇杆：死区内为零
  let v = roamJoyVec(3, 3, CFG.joyR, CFG.deadzone);
  R.deadzone = v.x === 0 && v.y === 0 && v.mag === 0;
  // 2. 满推右：x=1, run=true
  v = roamJoyVec(56, 0, CFG.joyR, CFG.deadzone);
  R.fullRight = Math.abs(v.x - 1) < 1e-9 && v.run === true;
  // 3. 超出半径被夹到 1
  v = roamJoyVec(200, 0, CFG.joyR, CFG.deadzone);
  R.clamped = Math.abs(v.mag - 1) < 1e-9;
  // 4. 半推不跑、方向归一
  v = roamJoyVec(0, 20, CFG.joyR, CFG.deadzone);
  R.halfDown = v.run === false && Math.abs(v.mag - 20 / 56) < 1e-9 && v.y > 0.3 && v.y < 0.4;
  // 5. 斜向归一化：模长不超 1
  v = roamJoyVec(40, 40, CFG.joyR, CFG.deadzone);
  R.diagNorm = Math.hypot(v.x, v.y) <= 1 + 1e-9;

  // 6. 镜头夹取：负值归零、超界取最大、中间原样
  R.camClamp = roamCamClamp(-50, 1000) === 0 && roamCamClamp(1200, 1000) === 1000 && roamCamClamp(300, 1000) === 300;

  // 7. 热点命中：范围内命中、范围外 null、y 轴也卡
  const s = roamSpotAt(700, 438);
  R.spotHit = s && s.id === 'tree';
  R.spotMissX = roamSpotAt(860, 438) === null;
  R.spotMissY = roamSpotAt(700, 438 + 120) === null;
  // 8. 四个热点互不重叠（两两 x 距离 > 2R）
  let overlap = false;
  for (let i = 0; i < ROAM_SPOTS.length; i++) for (let j = i + 1; j < ROAM_SPOTS.length; j++) {
    if (Math.abs(ROAM_SPOTS[i].x - ROAM_SPOTS[j].x) <= ROAM_CFG.spotR * 2) overlap = true;
  }
  R.spotNoOverlap = !overlap;
  // 9. 热点动作都存在于公园 ACTIONS 或能回退散步（浏览器上下文才有 ACTIONS，这里只校验 id 拼写）
  R.spotActs = ROAM_SPOTS.every((s2) => /^[a-z]+$/.test(s2.act) && s2.label.length >= 2);

  // 10. 跳跃抛物线：起止贴地、中点最高、左右对称
  const D = ROAM_CFG.jumpDur, H = ROAM_CFG.jumpH;
  R.jumpEnds = roamJumpY(0, D, H) === 0 && roamJumpY(D, D, H) === 0 && roamJumpY(-5, D, H) === 0 && roamJumpY(D + 5, D, H) === 0;
  R.jumpPeak = Math.abs(roamJumpY(D / 2, D, H) + H) < 1e-9;
  R.jumpSym = Math.abs(roamJumpY(D * 0.25, D, H) - roamJumpY(D * 0.75, D, H)) < 1e-9;
  // 11. 跳跃帧：五段均分，起跳 jump-1、顶点 jump-3、收尾 jump-5
  R.jumpFrames = roamJumpFrame(1, D) === 'jump-1' && roamJumpFrame(D / 2, D) === 'jump-3' && roamJumpFrame(D - 1, D) === 'jump-5';

  // 12. 十四期：八场景登记齐全
  const WANT = ['home', 'park', 'river', 'school', 'palace', 'square', 'market', 'hospital'];
  R.scenesAll = WANT.every((k) => ROAM_SCENES[k] && Array.isArray(ROAM_SCENES[k].spots) && ROAM_SCENES[k].spots.length >= 2);
  // 13. 每个场景的 act/fallback 拼写合法、label 非空，且存在于 game.js 的 ACTIONS
  const gsrc = GAME_SRC;
  R.spotActsExist = WANT.every((k) => ROAM_SCENES[k].spots.every((sp) =>
    /^[a-z]+$/.test(sp.act) && sp.label && sp.label.length >= 2 &&
    (!sp.fallback || /^[a-z]+$/.test(sp.fallback)) &&
    gsrc.includes("'" + sp.act + "'") && (!sp.fallback || gsrc.includes("'" + sp.fallback + "'"))));
  // 14. 同场景内热点两两不重叠（x 间距 > 2R）
  R.sceneNoOverlap = WANT.every((k) => {
    const sp = ROAM_SCENES[k].spots;
    for (let i = 0; i < sp.length; i++) for (let j = i + 1; j < sp.length; j++) {
      if (Math.abs(sp[i].x - sp[j].x) <= ROAM_CFG.spotR * 2) return false;
    }
    return true;
  });
  // 15. 热点 id 同场景内唯一
  R.spotIdUniq = WANT.every((k) => {
    const ids = ROAM_SCENES[k].spots.map((sp) => sp.id);
    return new Set(ids).size === ids.length;
  });

  console.log(JSON.stringify(R, null, 1));
  const pass = Object.values(R).every(Boolean);
  console.log(pass ? 'ROAM TEST PASSED' : 'ROAM TEST FAILED');
  if (!pass) process.exit(1);
})();
`;
eval(src + driver);
