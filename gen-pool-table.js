/* 生成当前事件池完整对照表 → /tmp/pool-table.md */
const fs = require('fs');
const src = fs.readFileSync('events.js', 'utf8') + '\n' + fs.readFileSync('game.js', 'utf8');
function el() { return { style: {}, innerHTML: '', textContent: '', className: '', title: '', disabled: false, children: [], classList: { add() {}, remove() {}, contains() { return false } }, appendChild(c) { this.children.push(c) }, set onclick(f) { this._onclick = f }, get onclick() { return this._onclick } }; }
const reg = {}; global.document = { getElementById: id => (reg[id] = reg[id] || el()), createElement: () => el() };
global.window = { addEventListener() {} }; global.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null }, setItem(k, v) { this._s[k] = v } };

const driver = `
;(function(){
function catOf(e){
  if(/^poor-|^mid-|^rich-/.test(e.id)) return '家境三线';
  if(/^bond-/.test(e.id)) return '一生羁绊';
  if(/^crush-/.test(e.id)) return '年少欢喜';
  if(/^spec-|^guohua|^manhua|^piano|^guitar|^aosa|^game-|^sanda|^taiji/.test(e.id)) return '专精分岔·支线';
  if(/^combo-/.test(e.id)) return '组合技';
  if(/^master-/.test(e.id)) return '出师礼';
  return '默认日常';
}
function repOf(e){
  if(e.maxLife) return '限'+e.maxLife+'次';
  const c=e.cond?e.cond.toString():'';
  if(c.indexOf('seen:')>=0) return '一生一次';
  return '可重复';
}
function condOf(e){
  if(!e.cond) return '—';
  var c=e.cond.toString().replace(/\\s+/g,' ');
  return c.length>56?c.slice(0,53)+'…':c;
}
var out='| 分类 | id | 标题 | 年龄 | 重复 | 附加条件 |\\n|---|---|---|---|---|---|\\n';
EVENTS.forEach(function(e){
  out+='| '+catOf(e)+' | '+e.id+' | '+e.title+' | '+e.min+'–'+e.max+' | '+repOf(e)+' | '+condOf(e)+' |\\n';
});
Object.keys(MILESTONES).forEach(function(a){
  var m=MILESTONES[a];
  out+='| 里程碑 | '+m.id+' | '+m.title+' | '+a+' | 每世一次 | 生日自动 |\\n';
});
require('fs').writeFileSync('/tmp/pool-table.md', out);
console.log('rows:', EVENTS.length + Object.keys(MILESTONES).length);
})();
`;
eval(src + driver);
