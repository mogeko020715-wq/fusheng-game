#!/usr/bin/env python3
"""立绘瘦身（入库流程最后一步）：画布 900×2150 → 180×430（横版 2150×900 → 430×180）
等比 0.2x，锚点比例不变（底边距 20px → 4px），LANCZOS + PNG 优化。
幂等：已是 180×430 / 430×180 的帧自动跳过，可重复运行。
固定流程：actor-ingest*.py → actor-fill.py → actor-retouch.py → actor-slim.py
用法：python3 actor-slim.py [目录，默认 assets/actor/sprites]"""
import os
import sys
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else 'assets/actor/sprites'
SCALE = 0.2
FULL = {(900, 2150), (2150, 900)}

for n in sorted(os.listdir(SRC)):
    if not n.endswith('.png'):
        continue
    p = os.path.join(SRC, n)
    im = Image.open(p).convert('RGBA')
    if im.size not in FULL:
        print('skip', n, im.size)
        continue
    w, h = im.size
    im2 = im.resize((round(w * SCALE), round(h * SCALE)), Image.LANCZOS)
    im2.save(p, optimize=True)
    print('slim', n, im.size, '→', im2.size)
