#!/usr/bin/env python3
"""P2 入库：celebrate/trip/startle + chat/fish/chess + wash/cook + run×4
比例基准与 P0/P1 一致（同一人物头长）：站立内容高 1800、坐姿 1020、run 序列按中位高度归一。
画布宽度自适应（内容宽+40，高 2150，底部锚点 20，水平居中）——
跑步/摔倒/下棋等宽姿态不再被 900 画布限制而缩小人物。
startle 特殊：头顶三根惊讶线不参与缩放基准（以最大连通体=身体高度定 1800）。
输出到 assets/actor/stage/，走 fill → retouch → slim 后再移入 sprites/。
"""
import os
import shutil
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

SRC = 'inbox-p2'
OUT = 'assets/actor'
STAGE = f'{OUT}/stage'
PAPER, INK = (251, 249, 243), (28, 28, 28)
CH = 2150

# 帧顺序已逐张目检确认（qc-runframes.png）
FILES = {
    'celebrate': ('08', 'stand'),   # 双臂高举踮脚大笑
    'startle':   ('07', 'startle'), # 后仰双臂张开+惊讶线
    'wash':      ('05', 'stand'),   # 站立刷牙
    'cook':      ('04', 'stand'),   # 站立锅铲
    'trip':      ('09', 'sit'),     # 摔倒坐地腿前伸揉眼
    'chat':      ('10', 'sit'),     # 盘腿手比划抬头笑
    'fish':      ('11', 'sit'),     # 盘腿持竿前伸
    'chess':     ('12', 'sit'),     # 盘腿落子+地面棋盘
    'run-1':     ('06', 'run'),     # 右脚跟着地
    'run-2':     ('01', 'run'),     # 右脚支撑、左腿回收前摆
    'run-3':     ('02', 'run'),     # 左脚跟着地
    'run-4':     ('03', 'run'),     # 腾空、右腿前摆
}

os.makedirs(f'{OUT}/src', exist_ok=True)
os.makedirs(STAGE, exist_ok=True)

def load_clean(path):
    g = np.array(Image.open(path).convert('L'), dtype=np.uint8)
    dark = g < 130
    lab, n = ndimage.label(dark)
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        h, w = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1
        if w > 4 * h and w > 60:           # 横长条 → 阴影线/划痕
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

def body_height(g):
    """最大连通体（身体）的高度：排除头顶惊讶线等独立小件"""
    dark = g < 120
    lab, n = ndimage.label(dark)
    sizes = ndimage.sum(dark, lab, range(1, n + 1))
    big = int(np.argmax(sizes)) + 1
    ys, _ = np.where(lab == big)
    return ys.max() - ys.min() + 1

# ---- 提取 + 定缩放 ----
sprites, scales = {}, {}
run_raw_h = []
for name, (num, kind) in FILES.items():
    src = f'{SRC}/{num}.png'
    shutil.copy(src, f'{OUT}/src/{name}.png')
    g = load_clean(src)
    sp = sprite(g)
    sprites[name] = sp
    if kind == 'stand':
        scales[name] = 1800 / sp.height
    elif kind == 'sit':
        scales[name] = 1020 / sp.height
    elif kind == 'startle':
        scales[name] = 1800 / body_height(g)
    else:
        run_raw_h.append(sp.height)
ref = int(np.median(run_raw_h))
for name, (_, kind) in FILES.items():
    if kind == 'run':
        scales[name] = 1800 / ref
print('run median raw h:', ref)

# ---- 上画布（宽度自适应，底部锚点 20，水平居中）----
for name, (_, kind) in FILES.items():
    sp = sprites[name]
    s = scales[name]
    sp = sp.resize((round(sp.width * s), round(sp.height * s)), Image.LANCZOS)
    cw = sp.width + 40
    cv = Image.new('RGBA', (cw, CH), (0, 0, 0, 0))
    cv.alpha_composite(sp, ((cw - sp.width) // 2, CH - 20 - sp.height))
    cv.save(f'{STAGE}/{name}.png')
    print(f'{name:10s} x{s:.3f} content {sp.size} canvas {(cw, CH)}')

# ---- QC 帧条 + run GIF 预览 ----
def strip(names, path, fh=260):
    ims = []
    for n in names:
        f = Image.open(f'{STAGE}/{n}.png')
        ims.append(f.resize((round(f.width * fh / f.height), fh), Image.LANCZOS))
    W = sum(i.width + 12 for i in ims) + 12
    s = Image.new('RGB', (W, fh + 34), (255, 255, 255))
    d = ImageDraw.Draw(s)
    x = 12
    for im, lb in zip(ims, names):
        s.paste(im, (x, 6), im)
        d.text((x + 8, fh + 14), lb, fill=(28, 28, 28))
        x += im.width + 12
    s.save(path)
    print('saved', path)

strip([n for n in FILES if not n.startswith('run')], f'{OUT}/qc-p2-static-strip.png')
strip([f'run-{i}' for i in range(1, 5)], f'{OUT}/qc-p2-run-strip.png')

ims = []
for i in range(1, 5):
    f = Image.open(f'{STAGE}/run-{i}.png')
    im = f.resize((round(f.width * 70 / f.height), 70), Image.LANCZOS)
    bg = Image.new('RGBA', im.size, PAPER + (255,))
    bg.alpha_composite(im)
    ims.append(bg.convert('P', palette=Image.ADAPTIVE))
ims[0].save(f'{OUT}/preview-run-70px.gif', save_all=True, append_images=ims[1:], duration=110, loop=0)
print('saved', f'{OUT}/preview-run-70px.gif')
