#!/usr/bin/env python3
"""P0 素材入库与质检：
1) 复制原图到 assets/actor/src 并规范命名  2) 去脚下阴影横线  3) 序列内尺寸归一 + 脚底锚点
4) 拼 QC 帧条  5) 生成 70px GIF 循环预览  6) 合成进场景底图
"""
import shutil, glob, os
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = '/Users/maxine/Downloads/jimeng-2026-09-20-9399'
OUT = 'assets/actor'
PAPER, INK = (251, 249, 243), (28, 28, 28)

# 帧顺序（已逐张目检确认）
FILES = {
    'walk-1': 'jimeng-2026-09-19-7772*',  # 右脚前触地
    'walk-2': 'jimeng-2026-09-19-7185*',  # 重心前移
    'walk-3': 'jimeng-2026-09-19-3032*',  # 过渡（单腿支撑）
    'walk-4': 'jimeng-2026-09-19-2250*',  # 左脚前触地
    'walk-5': 'jimeng-2026-09-20-8404*',  # 重心下沉（镜像）
    'walk-6': 'jimeng-2026-09-20-4597*',  # 过渡（镜像）
    'jump-1': 'jimeng-2026-09-20-8782*',  # 下蹲蓄力
    'jump-2': 'jimeng-2026-09-20-9271*',  # 蹬地起跳
    'jump-3': 'jimeng-2026-09-20-4899*',  # 腾空顶点
    'jump-4': 'jimeng-2026-09-20-5095*',  # 落地缓冲（带阴影线）
    'jump-5': 'jimeng-2026-09-20-4071*',  # 回弹站稳（带地面划痕）
}

os.makedirs(f'{OUT}/src', exist_ok=True)
os.makedirs(f'{OUT}/sprites', exist_ok=True)

def find(pat):
    hits = glob.glob(os.path.join(SRC, pat + '.png')) or glob.glob(os.path.join(SRC, pat))
    assert hits, pat
    return hits[0]

def load_clean(path):
    """灰度图 + 去除宽而扁的阴影/划痕组件"""
    g = np.array(Image.open(path).convert('L'), dtype=np.uint8)
    dark = g < 130
    lab, n = ndimage.label(dark)
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        h, w = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1
        if w > 4 * h and w > 60:           # 横长条 → 阴影线/划痕
            g[lab == i] = 255
    return g

def crop_and_sprite(g):
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

# ---- 入库 + 初切 ----
sprites, heights = {}, {}
for name, pat in FILES.items():
    src = find(pat)
    shutil.copy(src, f'{OUT}/src/{name}.png')
    sp, h = crop_and_sprite(load_clean(src))
    sprites[name], heights[name] = sp, h
print('bbox heights:', heights)

# ---- 序列内归一：以各自序列的中位高度为基准缩放 ----
def normalize(seq, target=1800):
    ref = int(np.median([heights[n] for n in seq]))
    out = {}
    for n in seq:
        sp = sprites[n]
        s = target / ref          # 序列统一比例：中位帧 → target
        out[n] = sp.resize((round(sp.width * s), round(sp.height * s)), Image.LANCZOS)
    return out

walk = normalize([n for n in FILES if n.startswith('walk')])
jump = normalize([n for n in FILES if n.startswith('jump')])

# ---- 放到统一画布（脚底锚点 y=H-20，水平居中）----
CW, CH = 900, 2150
def on_canvas(seq_dict, order):
    frames = []
    for n in order:
        sp = seq_dict[n]
        cv = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
        cv.alpha_composite(sp, ((CW - sp.width) // 2, CH - 20 - sp.height))
        frames.append(cv)
    return frames

walk_f = on_canvas(walk, [f'walk-{i}' for i in range(1, 7)])
jump_f = on_canvas(jump, [f'jump-{i}' for i in range(1, 6)])

# ---- QC 帧条（每帧高 260px，白底标签）----
def strip(frames, labels, path, fh=260):
    ims = [f.resize((round(f.width * fh / f.height), fh), Image.LANCZOS) for f in frames]
    W = sum(i.width + 12 for i in ims) + 12
    s = Image.new('RGB', (W, fh + 34), (255, 255, 255))
    x = 12
    from PIL import ImageDraw
    d = ImageDraw.Draw(s)
    for im, lb in zip(ims, labels):
        s.paste(im, (x, 6), im)
        d.text((x + 8, fh + 14), lb, fill=(28, 28, 28))
        x += im.width + 12
    s.save(path)
    print('saved', path)

strip(walk_f, [f'walk-{i}' for i in range(1, 7)], f'{OUT}/qc-walk-strip.png')
strip(jump_f, [f'jump-{i}' for i in range(1, 6)], f'{OUT}/qc-jump-strip.png')

# ---- 70px GIF 循环预览（带纸色底）----
def gif(frames, path, dur):
    ims = []
    for f in frames:
        im = f.resize((round(f.width * 70 / f.height), 70), Image.LANCZOS)
        bg = Image.new('RGBA', im.size, PAPER + (255,))
        bg.alpha_composite(im)
        ims.append(bg.convert('P', palette=Image.ADAPTIVE))
    ims[0].save(path, save_all=True, append_images=ims[1:], duration=dur, loop=0)
    print('saved', path)

gif(walk_f, f'{OUT}/preview-walk-70px.gif', 150)
gif(jump_f, f'{OUT}/preview-jump-70px.gif', 190)

# ---- 存最终精灵图（透明底单帧，供代码接入用）----
for f, n in zip(walk_f, [f'walk-{i}' for i in range(1, 7)]):
    f.save(f'{OUT}/sprites/{n}.png')
for f, n in zip(jump_f, [f'jump-{i}' for i in range(1, 6)]):
    f.save(f'{OUT}/sprites/{n}.png')

# ---- 合成进场景：walk-1 白天 70px ----
base = Image.open('preview-base-day.png').convert('RGBA')
c = walk_f[0].resize((round(walk_f[0].width * 70 / walk_f[0].height), 70), Image.LANCZOS)
base.alpha_composite(c, (round(base.width * .5 - c.width / 2), base.height - 6 - c.height))
base.convert('RGB').save(f'{OUT}/preview-scene-walk1.png')
print('saved', f'{OUT}/preview-scene-walk1.png')
