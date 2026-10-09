/* 小红书小工具构建：容器白名单不含音频文件类型，且 CSP 禁止 data: 媒体。
 * 背景音乐整体关闭（设置页对应项自动隐藏）；音效走 Web Audio 程序合成，不受影响。 */
window.FUSHENG_NO_BGM = true;
