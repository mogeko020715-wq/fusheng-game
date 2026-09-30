#!/usr/bin/env python3
"""第五批 CG 入库：梦境小径 12 张（9 心结 + 3 梦底门 boss）
原稿归档 _dev/src-art/src/，量化产物进 assets/cg/（800x533, 64 色）"""
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
SRC_DIR = Path('/Users/maxine/Downloads/编组 10')
ARCHIVE = ROOT / '_dev/src-art/src'
OUT = ROOT / 'assets/cg'

MAPPING = {
    'cg-dream-needle': '基于中性短头发的幼年小娃，画一张3_2横幅插画：小娃微微缩着肩膀站着，对面巨大化.png',
    'cg-dream-dog': '基于中性短头发的幼年小娃，画一张3_2横幅插画：窄巷子中间，小娃贴着一侧砖墙不敢.png',
    'cg-dream-thunder': '基于中性短头发的幼年小娃，画一张3_2横幅插画：低角度平视小床，小娃缩在被子里只.png',
    'cg-dream-dark': '基于中性短头发的幼年小娃，画一张3_2横幅插画：关灯后的儿童房，小娃从被窝里只露.png',
    'cg-dream-exam59': '基于中性短头发的小娃，画一张3_2横幅插画：一张被放到巨大的试卷纸占满画面中央，.png',
    'cg-dream-bully': '基于中性短头发的小娃，画一张3_2横幅插画：稍微侧一点的放学路视角，小娃站在路的.png',
    'cg-dream-alone': '基于中性短头发的小娃，画一张3_2横幅插画：平视空客厅，小娃坐在沙发边缘，脚轻轻.png',
    'cg-dream-rank': '基于中性短头发的少年版小娃，画一张3_2横幅插画：少年仰头站在一面向上无限延伸的.png',
    'cg-dream-farewell': '基于中性短头发的少年版小娃，画一张3_2横幅插画：空荡荡的教室门口，少年站在门里.png',
    'cg-dream-firstnight': '基于中性短头发的幼年小娃，画一张3_2横幅插画：一张对小娃来说有点太大的单人床，.png',
    'cg-dream-finalexam': '基于中性短头发的小娃，画一张3_2横幅插画：顺着课桌的纵深透视看过去，小娃坐在画.png',
    'cg-dream-future-self': '基于中性短头发的少年版小娃，画一张3_2横幅插画：两个人面对面站在绝对空白的画面.png',
}

ARCHIVE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

for name, src_name in MAPPING.items():
    src = SRC_DIR / src_name
    assert src.exists(), f'缺源图: {src}'
    # 原稿归档
    archived = ARCHIVE / f'{name}.png'
    shutil.copy2(src, archived)
    # 量化入库
    img = Image.open(src).convert('RGB').resize((800, 533), Image.LANCZOS)
    img = img.quantize(colors=64, method=2, dither=0)
    img.save(OUT / f'{name}.png', optimize=True)
    kb = (OUT / f'{name}.png').stat().st_size // 1024
    print(f'{name}: {kb} KB')

print('DONE', len(MAPPING), '张')
