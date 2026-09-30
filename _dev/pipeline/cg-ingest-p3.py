#!/usr/bin/env python3
# CG 第三批：原图归档 + 800x533 64 色量化入库 assets/cg/
import shutil
from pathlib import Path
from PIL import Image

SRC_DIR = Path('/Users/maxine/Downloads')
ROOT = Path('/Users/maxine/Documents/Kimi/Workspaces/Investigate/zhongsheng')
ARCHIVE = ROOT / '_dev/src-art/src'
OUT = ROOT / 'assets/cg'

MAPPING = {
    'cg-rich-finale': '基于图片1的小娃长大的少年，画3_2横版横幅插画：傍晚家里普通居家餐桌旁，妈妈系着.png',
    'cg-crush-date':  '基于图片1的小娃长大的少年，画3_2横版横幅插画：夏天的教室窗边，两张并排的课桌，.png',
    'cg-dream-form':  '基于图片1的小娃长大的少年，画3_2横版横幅插画：夜晚家里的书桌前，一本厚得像砖的.png',
}

for cid, fname in MAPPING.items():
    src = SRC_DIR / fname
    assert src.exists(), f'缺原图: {fname}'
    shutil.copy2(src, ARCHIVE / f'{cid}.png')
    im = Image.open(src).convert('RGB')
    im = im.resize((800, 533), Image.LANCZOS)
    q = im.quantize(colors=64, method=2, dither=0)
    q.save(OUT / f'{cid}.png', optimize=True)
    print(cid, '->', (OUT / f'{cid}.png').stat().st_size // 1024, 'KB')
print('done')
