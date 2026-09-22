#!/usr/bin/env python3
"""穿模修复：立绘剪影内部未填纸色的区域（如头发）补上纸色
原理：alpha 掩膜闭运算封口 → 填充孔洞 → 新增区域填纸色、alpha 拉满
直接改 sprites/（原版已入 git 1671f47，可回退）"""
import os
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = sys.argv[1] if len(sys.argv) > 1 else 'assets/actor/sprites'
PAPER = (251, 249, 243)

for n in sorted(os.listdir(SRC)):
    if not n.endswith('.png'):
        continue
    p = os.path.join(SRC, n)
    a = np.asarray(Image.open(p).convert('RGBA')).copy()
    mask = a[..., 3] > 128
    closed = ndimage.binary_closing(mask, structure=np.ones((15, 15)))
    filled = ndimage.binary_fill_holes(closed)
    add = filled & (a[..., 3] < 128)
    a[..., 3] = np.where(filled, 255, a[..., 3])
    for c in range(3):
        a[..., c] = np.where(add, PAPER[c], a[..., c])
    Image.fromarray(a, 'RGBA').save(p)
    print('filled', n, 'added px', int(add.sum()))
