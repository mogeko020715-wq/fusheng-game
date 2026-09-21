#!/usr/bin/env python3
"""立绘修饰（对 sprites/ 成品统一后处理）：
1) 头发透明：头部区（内容顶部 35%）加大闭运算封口后填纸色——走路后半段发型轮廓缺口大，15x15 封不住
2) 嘴部浅线：darkness > 4 的线像素统一提到 >=145（墨色 floor），颜色不再不统一
3) 弱 alpha 线（weak/sick 的嘴与颤抖线）：alpha 提升 (a-10)*1.5
直接改 sprites/（git 已存档，可回退）"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = 'assets/actor/sprites'
PAPER = np.array([251, 249, 243], dtype=float)
INK = np.array([28, 28, 28], dtype=float)
PAPER_LUM = PAPER.mean()
DARK_FLOOR = 145.0   # 可见线的最低深度
HEAD_RATIO = 0.35    # 内容顶部 35% 视为头部区

for n in sorted(os.listdir(SRC)):
    if not n.endswith('.png'):
        continue
    p = os.path.join(SRC, n)
    a = np.asarray(Image.open(p).convert('RGBA')).astype(float)
    alpha = a[..., 3]
    ys, xs = (alpha > 20).nonzero()
    t, b = ys.min(), ys.max()
    head_bottom = t + int((b - t) * HEAD_RATIO)

    # --- 1) 头部区填纸色 ---
    zone = np.zeros(alpha.shape, dtype=bool)
    zone[t:head_bottom] = alpha[t:head_bottom] > 128
    closed = ndimage.binary_closing(zone, structure=np.ones((35, 35)))
    filled = ndimage.binary_fill_holes(closed)
    add = filled & (alpha < 128)
    added = int(add.sum())
    alpha = np.where(filled, 255, alpha)
    for c in range(3):
        a[..., c] = np.where(add, PAPER[c], a[..., c])

    # --- 2)+3) 线深度 floor + 弱 alpha 提升 ---
    lum = a[..., :3].mean(2)
    d = PAPER_LUM - lum
    lineish = (alpha > 15) & (d > 4)
    d_new = np.where(lineish, np.maximum(d, DARK_FLOOR), d)
    ratio = np.clip(d_new, 0, 249) / 249.0
    for c in range(3):
        a[..., c] = np.where(alpha > 15, PAPER[c] * (1 - ratio) + INK[c] * ratio, a[..., c])
    alpha = np.clip((alpha - 10) * 1.5, 0, 255)
    alpha[alpha < 15] = 0

    a[..., 3] = alpha
    Image.fromarray(a.astype(np.uint8), 'RGBA').save(p)
    print(n, 'head filled px:', added)
