#!/usr/bin/env python3
"""jump-4/5 目检校准图 v2：统一全局缩小 0.55，保证完整可见且间距充足"""
import numpy as np
from PIL import Image, ImageDraw

K = 0.55          # 全局缩小（不影响相对比较）
H = 1250
def crop_to_content(im):
    a = np.asarray(im.split()[3])
    ys, xs = np.where(a > 10)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

j4 = crop_to_content(Image.open('assets/actor/sprites/jump-4.png'))
j5 = crop_to_content(Image.open('assets/actor/sprites/jump-5.png'))
w2 = crop_to_content(Image.open('assets/actor/sprites/walk-2.png'))
scales = [0.85, 0.90, 0.95, 1.00]

def sheet_for(im, tag, path):
    W = 3400
    s = Image.new('RGBA', (W, H), (251, 249, 243, 255))
    d = ImageDraw.Draw(s)
    anchor = H - 60
    x = 330
    for f in scales:
        c = im.resize((round(im.width * f * K), round(im.height * f * K)), Image.LANCZOS)
        s.alpha_composite(c, (x - c.width // 2, anchor - c.height))
        d.text((x - 45, anchor + 15), f'{tag} x{f}', fill=(28, 28, 28, 255))
        x += 640
    c = w2.resize((round(w2.width * K), round(w2.height * K)), Image.LANCZOS)
    s.alpha_composite(c, (x - c.width // 2, anchor - c.height))
    d.rectangle([x - c.width // 2 - 8, anchor - c.height - 8, x + c.width // 2 + 8, anchor + 4],
                outline=(179, 56, 44, 255), width=3)
    d.text((x - 55, anchor + 15), 'walk-2 基准', fill=(179, 56, 44, 255))
    s.convert('RGB').save(path)
    print('saved', path)

sheet_for(j5, 'j5', 'assets/actor/qc-calib-j5.png')
sheet_for(j4, 'j4', 'assets/actor/qc-calib-j4.png')
