#!/usr/bin/env python3
"""jump-4/5 最终定稿：统一 ×0.90（目检校准结论），重建帧条 + GIF"""
import numpy as np
from PIL import Image, ImageDraw

CW, CH = 900, 2150
PAPER = (251, 249, 243)

def crop_to_content(im):
    a = np.asarray(im.split()[3])
    ys, xs = np.where(a > 10)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

for name in ['jump-4', 'jump-5']:
    im = crop_to_content(Image.open(f'assets/actor/sprites/{name}.png'))
    im2 = im.resize((round(im.width * .9), round(im.height * .9)), Image.LANCZOS)
    cv = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    cv.alpha_composite(im2, ((CW - im2.width) // 2, CH - 20 - im2.height))
    cv.save(f'assets/actor/sprites/{name}.png')
    print(name, 'scaled x0.9 →', im2.size)

frames = [Image.open(f'assets/actor/sprites/jump-{i}.png') for i in range(1, 6)]
fh = 260
ims = [f.resize((round(f.width * fh / f.height), fh), Image.LANCZOS) for f in frames]
W = sum(i.width + 12 for i in ims) + 12
s = Image.new('RGB', (W, fh + 34), (255, 255, 255))
d = ImageDraw.Draw(s)
x = 12
for i, im in enumerate(ims):
    s.paste(im, (x, 6), im)
    d.text((x + 8, fh + 14), f'jump-{i + 1}', fill=(28, 28, 28))
    x += im.width + 12
s.save('assets/actor/qc-jump-strip.png')
gifs = []
for f in frames:
    im = f.resize((round(f.width * 70 / f.height), 70), Image.LANCZOS)
    bg = Image.new('RGBA', im.size, PAPER + (255,))
    bg.alpha_composite(im)
    gifs.append(bg.convert('P', palette=Image.ADAPTIVE))
gifs[0].save('assets/actor/preview-jump-70px.gif', save_all=True, append_images=gifs[1:], duration=190, loop=0)
print('rebuilt jump strip + gif')
