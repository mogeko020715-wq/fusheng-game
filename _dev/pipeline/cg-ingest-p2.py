#!/usr/bin/env python3
# CG 第二批：原图归档 + 800x533 64 色量化入库 assets/cg/
import shutil
from pathlib import Path
from PIL import Image

SRC_DIR = Path('/Users/maxine/Downloads/fusheng/事件cg')
ROOT = Path('/Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng')
ARCHIVE = ROOT / '_dev/src-art/src'
OUT = ROOT / 'assets/cg'

MAPPING = {
    'cg-bond-capsule': '基于图片1，完全保留原画面所有核心内容：第一人称低头俯视视角、土坑小铁皮盒、盒.png',
    'cg-bond-chess':   '基于图片1的小娃长大的少年，画3_2横版横幅插画：广场角落的棋摊，一张小方桌，我们.png',
    'cg-mid-finale':   '基于图片1的小娃长大的少年，画3_2横版横幅插画：家楼下的空地，爸爸蹲在地上修一辆.png',
    'cg-poor-finale':  '基于图片1的小娃长大的少年，画3_2横版横幅插画：校门口，妈妈穿着一件略显正式的旧.png',
    'cg-m15':          '基于图片1的小娃长大的少年，画3_2横版横幅插画：学校布告栏前，我们的主角（齐耳软.png',
    'cg-stargaze':     '基于图片1的幼年小娃，画3_2横版横幅插画：停电的夏夜，小娃躺在院子里的竹躺椅上，.png',
}

for cid, fname in MAPPING.items():
    src = SRC_DIR / fname
    assert src.exists(), f'缺原图: {fname}'
    # 1. 原稿归档
    shutil.copy2(src, ARCHIVE / f'{cid}.png')
    # 2. 量化入库
    im = Image.open(src).convert('RGB')
    im = im.resize((800, 533), Image.LANCZOS)
    q = im.quantize(colors=64, method=2, dither=0)
    q.save(OUT / f'{cid}.png', optimize=True)
    print(cid, '->', (OUT / f'{cid}.png').stat().st_size // 1024, 'KB')
print('done')
