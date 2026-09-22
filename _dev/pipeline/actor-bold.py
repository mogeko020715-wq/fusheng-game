#!/usr/bin/env python3
"""立绘去糊：线加粗（grey_erosion）+ 预下采样到 360x860 + alpha 对比提升
输出到 sprites-bold/ 供对比，确认后再替换 sprites/"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = 'assets/actor/sprites'
DST = 'assets/actor/sprites-bold'
PAPER = np.array([251, 249, 243], dtype=float)
INK = np.array([28, 28, 28], dtype=float)
OUT_W, OUT_H = 360, 860  # 等比 900x2150 -> 360x860，锚点比例不变

os.makedirs(DST, exist_ok=True)

def process(name):
    im = Image.open(os.path.join(SRC, name)).convert('RGBA')
    a = np.asarray(im).astype(float)
    alpha = a[..., 3]
    lum = a[..., :3].mean(2)
    # 墨线强度场：纸色≈0，墨色≈255，透明区强制 0
    d = np.clip((250.0 - lum) * 2.2, 0, 255)
    d[alpha < 10] = 0
    # 线加粗：darkness 场上取局部最大（=灰度图上的 grey_erosion），深色线外扩 +4~6px
    d1 = ndimage.grey_dilation(d, size=(13, 13))
    alpha1 = np.maximum(alpha, d1)
    t = (d1 / 255.0)[..., None]
    rgb = PAPER[None, None, :] * (1 - t) + INK[None, None, :] * t
    out = np.dstack([rgb, alpha1]).astype(np.uint8)
    im2 = Image.fromarray(out, 'RGBA').resize((OUT_W, OUT_H), Image.LANCZOS)
    # 下采样后 alpha 对比提升：灰边压黑、弱线显形
    b = np.asarray(im2).copy()
    b[..., 3] = np.clip((b[..., 3].astype(float) - 40) * 1.6, 0, 255).astype(np.uint8)
    Image.fromarray(b, 'RGBA').save(os.path.join(DST, name))
    print('bold:', name)

names = sorted(os.listdir(SRC))
for n in names:
    if n.endswith('.png'):
        process(n)

# ---- 对比预览：场景底图上 60px 实贴，左原右粗，附 x3 放大细节 ----
base = Image.open('preview-base-day.png').convert('RGBA')
bw, bh = base.size

def load_content(path):
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im)
    ys, xs = (a[..., 3] > 20).nonzero()
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

def paste(dst, sp, height, x_ratio):
    c = sp.resize((round(sp.width * height / sp.height), height), Image.LANCZOS)
    x = round(bw * x_ratio - c.width / 2)
    dst.alpha_composite(c, (x, bh - 6 - c.height))

cur = load_content(os.path.join(SRC, 'stand.png'))
bold = load_content(os.path.join(DST, 'stand.png'))
paste(base, cur, 60, 0.30)
paste(base, bold, 60, 0.60)

# x3 放大对比条（贴在下方面板区外，单独存一张细节图）
det = Image.new('RGBA', (640, 260), (251, 249, 243, 255))
h = 180
for i, sp in enumerate([cur, bold]):
    c = sp.resize((round(sp.width * h / sp.height), h), Image.LANCZOS)
    det.alpha_composite(c, (80 + i * 320 - c.width // 2, 240 - c.height))
det.convert('RGB').save('preview-crisp-detail.png')
base.convert('RGB').save('preview-crisp-compare.png')
print('saved preview-crisp-compare.png / preview-crisp-detail.png')
