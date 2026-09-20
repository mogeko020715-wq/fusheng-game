#!/usr/bin/env python3
"""P1 静态帧入库：sleep(横躺) / eat / sit / sick
缩放基准：与站立帧保持同一人物比例（头长一致），不是统一内容高——
  sick 站立弯腰 ≈ weak 同规格：内容高 1800
  sit/eat 坐姿 ≈ 2.3 头身：内容高 1020（1800 × 0.567）
  sleep 横躺：体长=站高，按内容宽 1650 缩，画布横版 2150×900（与站立同 canvas 比例基准）
"""
import glob
import shutil
import numpy as np
from PIL import Image
from scipy import ndimage

PAPER, INK = (251, 249, 243), (28, 28, 28)
DL = '/Users/maxine/Downloads/'
CFG = {
    'sick':  dict(src=glob.glob(DL + 'jimeng-2026-09-20-5116-*.png')[0], canvas=(900, 2150), mode='fit', target=1800),
    'sit':   dict(src=glob.glob(DL + 'jimeng-2026-09-20-2552-*.png')[0], canvas=(900, 2150), mode='h', target=1020),
    'eat':   dict(src=glob.glob(DL + 'jimeng-2026-09-20-2488-*.png')[0], canvas=(900, 2150), mode='h', target=1020),
    'sleep': dict(src=glob.glob(DL + 'jimeng-2026-09-20-3776-*.png')[0], canvas=(2150, 900), mode='w', target=1650),
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
    return Image.fromarray(img, 'RGBA')

for name, c in CFG.items():
    shutil.copy(c['src'], f'assets/actor/src/{name}.png')
    sp = sprite(load_clean(c['src']))
    if c['mode'] == 'h':
        s = c['target'] / sp.height
    elif c['mode'] == 'fit':  # 高优先但宽度不得超出画布内边距
        s = min(c['target'] / sp.height, (c['canvas'][0] - 40) / sp.width)
    else:
        s = c['target'] / sp.width
    sp = sp.resize((round(sp.width * s), round(sp.height * s)), Image.LANCZOS)
    CW, CH = c['canvas']
    cv = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    cv.alpha_composite(sp, ((CW - sp.width) // 2, CH - 20 - sp.height))
    cv.save(f'assets/actor/sprites/{name}.png')
    print(name, 'scale x%.3f' % s, 'content', sp.size, 'canvas', (CW, CH))
