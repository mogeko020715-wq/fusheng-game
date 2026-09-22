#!/usr/bin/env python3
"""70px 可读性强化对比：原样 vs 加粗线+提对比"""
import numpy as np
from PIL import Image
from scipy import ndimage

PAPER = (251, 249, 243)
INK = (28, 28, 28)

g = np.asarray(Image.open('portrait-happy-src.png').convert('L'), dtype=np.uint8)
dark = g < 120
rows, cols = np.where(dark)
l, t, r, b = cols.min(), rows.min(), cols.max(), rows.max()
g = g[max(0, t - 8):b + 5, max(0, l - 8):r + 9]

mask = ndimage.binary_closing(g < 210, structure=np.ones((9, 9)))
mask = ndimage.binary_fill_holes(mask)

def sprite(lines_src):
    lines = np.clip((235 - lines_src.astype(int)) * 3, 0, 255).astype(np.uint8)
    h, w = mask.shape
    img = np.zeros((h, w, 4), dtype=np.uint8)
    img[..., 0], img[..., 1], img[..., 2] = PAPER
    img[..., 3] = np.where(mask, 255, 0).astype(np.uint8)
    la = lines.astype(float) / 255.0
    for c, v in enumerate(INK):
        img[..., c] = (img[..., c] * (1 - la) + v * la).astype(np.uint8)
    img[..., 3] = np.maximum(img[..., 3], lines)
    return Image.fromarray(img, 'RGBA')

def paste(sp, height, x_ratio, out_path, boost=False):
    base = Image.open('preview-base-day.png').convert('RGBA')
    bw, bh = base.size
    c = sp.resize((round(sp.width * height / sp.height), height), Image.LANCZOS)
    if boost:  # 缩小后提 alpha 对比：灰线压黑、弱线显形
        a = np.asarray(c).copy()
        alpha = a[..., 3].astype(float)
        a[..., 3] = np.clip((alpha - 55) * 1.9, 0, 255).astype(np.uint8)
        c = Image.fromarray(a, 'RGBA')
    x = round(bw * x_ratio - c.width / 2)
    base.alpha_composite(c, (x, bh - 6 - c.height))
    base.convert('RGB').save(out_path)
    print('saved', out_path)

plain = sprite(g)
bold = sprite(ndimage.grey_erosion(g, size=(13, 13)))  # 深色区域外扩 ≈ 线加粗
paste(plain, 70, 0.35, 'preview-day-70px-A-plain.png')
paste(bold, 70, 0.35, 'preview-day-70px-B-bold.png', boost=True)
# 中方案：85px + 加粗
paste(bold, 85, 0.35, 'preview-day-85px-B-bold.png', boost=True)
