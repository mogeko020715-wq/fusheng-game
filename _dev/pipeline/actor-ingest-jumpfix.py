#!/usr/bin/env python3
"""jump 五帧重入库（修 P0 截边）：手臂高举帧在 900 画布被切手/头顶色块接缝。
改用 P2 自适应宽度画布（内容宽+40，高 2150，底锚 20，水平居中），
序列仍按中位高度归一到 1800（与 walk/stand 同一人物比例）。
输出到 stage-jump/，后续：fill → retouch → slim → quantize(64) → 替换 sprites/jump-*.png
用法：python3 _dev/pipeline/actor-ingest-jumpfix.py（在仓库根目录跑）"""
import os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

SRC = '_dev/src-art/src'
STAGE = 'stage-jump'
PAPER, INK = (251, 249, 243), (28, 28, 28)
CH = 2150
NAMES = [f'jump-{i}' for i in range(1, 6)]

os.makedirs(STAGE, exist_ok=True)

def load_clean(path):
    g = np.array(Image.open(path).convert('L'), dtype=np.uint8)
    dark = g < 130
    lab, n = ndimage.label(dark)
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        h, w = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1
        if w > 4 * h and w > 60:           # 横长条 → 阴影线/划痕（jump-4/5 有）
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
    return Image.fromarray(img, 'RGBA')

sprites = {n: sprite(load_clean(f'{SRC}/{n}.png')) for n in NAMES}
ref = int(np.median([sp.height for sp in sprites.values()]))
s = 1800 / ref
print('jump median raw h:', ref, 'scale x%.3f' % s)

for n in NAMES:
    sp = sprites[n]
    sp = sp.resize((round(sp.width * s), round(sp.height * s)), Image.LANCZOS)
    cw = sp.width + 40
    cv = Image.new('RGBA', (cw, CH), (0, 0, 0, 0))
    cv.alpha_composite(sp, ((cw - sp.width) // 2, CH - 20 - sp.height))
    cv.save(f'{STAGE}/{n}.png')
    print(f'{n}: content {sp.size} canvas {(cw, CH)}')

# QC 帧条
fh = 260
ims = [Image.open(f'{STAGE}/{n}.png').resize((round((sprites[n].width * s + 40) * fh / CH), fh), Image.LANCZOS) for n in NAMES]
W = sum(i.width + 12 for i in ims) + 12
sheet = Image.new('RGB', (W, fh + 34), (255, 255, 255))
d = ImageDraw.Draw(sheet)
x = 12
for im, lb in zip(ims, NAMES):
    sheet.paste(im, (x, 6), im)
    d.text((x + 8, fh + 14), lb, fill=(200, 0, 0))
    x += im.width + 12
sheet.save(f'{STAGE}/qc-strip.png')
print('saved', f'{STAGE}/qc-strip.png')
