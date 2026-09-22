#!/usr/bin/env python3
"""立绘合成预览 v2：剪影填充不透明纸色（身体不再透背景），夜晚用整图反色模拟 CSS invert"""
import numpy as np
from PIL import Image
from scipy import ndimage

PAPER = (251, 249, 243)   # 场景纸色 #fbf9f3
INK = (28, 28, 28)        # #1c1c1c

def extract(path):
    """白底线稿 → (剪影mask, 线条alpha)；按深色像素定边界去浅灰阴影"""
    g = np.asarray(Image.open(path).convert('L'), dtype=np.uint8)
    dark = g < 120
    rows, cols = np.where(dark)
    l, t, r, b = cols.min(), rows.min(), cols.max(), rows.max()
    g = g[max(0, t - 8):b + 5, max(0, l - 8):r + 9]
    # 剪影：浅线也算进 mask，闭运算补缝后填洞
    mask = g < 210
    mask = ndimage.binary_closing(mask, structure=np.ones((9, 9)))
    mask = ndimage.binary_fill_holes(mask)
    lines = np.clip((235 - g.astype(int)) * 3, 0, 255).astype(np.uint8)  # 线条 alpha
    return mask, lines

def build_sprite(mask, lines, paper, ink):
    h, w = mask.shape
    img = np.zeros((h, w, 4), dtype=np.uint8)
    img[..., 0], img[..., 1], img[..., 2] = paper
    img[..., 3] = np.where(mask, 255, 0).astype(np.uint8)   # 纸色剪影打底
    la = lines.astype(float) / 255.0                          # 线条叠加
    for c, v in enumerate(ink):
        img[..., c] = (img[..., c] * (1 - la) + v * la).astype(np.uint8)
    img[..., 3] = np.maximum(img[..., 3], lines)
    return Image.fromarray(img, 'RGBA')

def paste(base_path, sprite, height, x_ratio, out_path):
    base = Image.open(base_path).convert('RGBA')
    bw, bh = base.size
    scale = height / sprite.height
    c = sprite.resize((round(sprite.width * scale), height), Image.LANCZOS)
    x = round(bw * x_ratio - c.width / 2)
    y = bh - 6 - c.height
    base.alpha_composite(c, (x, y))
    base.convert('RGB').save(out_path)
    print('saved', out_path)

def invert_sprite(sprite):
    """模拟 CSS filter: invert() —— 夜晚反白的零素材方案"""
    a = np.asarray(sprite).copy()
    a[..., :3] = 255 - a[..., :3]
    return Image.fromarray(a, 'RGBA')

hm, hl = extract('portrait-happy-src.png')
sm, sl = extract('portrait-sad-src.png')
happy = build_sprite(hm, hl, PAPER, INK)
sad = build_sprite(sm, sl, PAPER, INK)
happy.save('preview-sprite-happy.png')

paste('preview-base-day.png', happy, 70, 0.50, 'preview-day-70px.png')
paste('preview-base-day.png', happy, 120, 0.50, 'preview-day-120px.png')
paste('preview-base-day.png', sad, 120, 0.30, 'preview-day-sad-120px.png')
paste('preview-base-night.png', invert_sprite(happy), 120, 0.50, 'preview-night-120px.png')
