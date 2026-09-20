#!/usr/bin/env python3
"""静态立绘入库：stand(4342) / weak-moodlow(8722) / happy(3563) —— 与走路同一基准（内容高 1800、脚底锚点）"""
import shutil
import numpy as np
from PIL import Image
from scipy import ndimage

CW, CH = 900, 2150
PAPER, INK = (251, 249, 243), (28, 28, 28)
TARGET_H = 1800

SRCS = {
    'stand': '/Users/maxine/Downloads/jimeng-2026-09-20-4342-单张全人物立绘，基于@图片1，只保留最左侧最小的4头身幼年中性小娃，完全沿用他的....png',
    'weak': '/Users/maxine/Downloads/jimeng-2026-09-19-8722-单张全人物立绘，基于@图片1，保持完全一致的黑白极简墨水线稿风格，只保留左侧幼年....png',
    'happy': 'portrait-happy-src.png',
}

def load_clean(path):
    g = np.array(Image.open(path).convert('L'), dtype=np.uint8)
    dark = g < 130
    lab, n = ndimage.label(dark)
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        h, w = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1
        if w > 4 * h and w > 60:
            g[lab == i] = 255
    return g

def sprite(g):
    dark = g < 120
    rows, cols = np.where(dark)
    l, t, r, b = cols.min(), rows.min(), cols.max(), rows.max()
    g = g[max(0, t - 8):b + 5, max(0, l - 8):r + 9]
    mask = ndimage.binary_closing(g < 210, structure=np.ones((9, 9)))
    mask = ndimage.binary_fill_holes(mask)
    lines = np.clip((235 - g.astype(int)) * 3, 0, 255).astype(np.uint8)
    h, w = mask.shape
    img = np.zeros((h, w, 4), dtype=np.uint8)
    img[..., 0], img[..., 1], img[..., 2] = PAPER
    img[..., 3] = np.where(mask, 255, 0).astype(np.uint8)
    la = lines.astype(float) / 255.0
    for c, v in enumerate(INK):
        img[..., c] = (img[..., c] * (1 - la) + v * la).astype(np.uint8)
    img[..., 3] = np.maximum(img[..., 3], lines)
    return Image.fromarray(img, 'RGBA'), h

for name, src in SRCS.items():
    shutil.copy(src, f'assets/actor/src/{name}.png')
    sp, h = sprite(load_clean(src))
    s = TARGET_H / h
    sp = sp.resize((round(sp.width * s), TARGET_H), Image.LANCZOS)
    cv = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    cv.alpha_composite(sp, ((CW - sp.width) // 2, CH - 20 - sp.height))
    cv.save(f'assets/actor/sprites/{name}.png')
    print(name, 'bbox', h, '→ x%.3f' % s, sp.size)
