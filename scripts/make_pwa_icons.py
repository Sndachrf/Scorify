#!/usr/bin/env python3
"""Ikon PWA Scorify untuk manifest web.

- icon-192.png / icon-512.png   : logo transparan (purpose: any)
- icon-maskable-512.png         : latar putih, logo ~68% di tengah (purpose: maskable,
                                  aman untuk zona aman ikon Android)
Sumber: logo transparan yang sudah dibuat make_scorify_assets.py (src/assets).
"""
from PIL import Image

SRC = "/home/z/my-project/src/assets/scorify-logo.png"
OUT = "/home/z/my-project/public/icons"

import os
os.makedirs(OUT, exist_ok=True)

logo = Image.open(SRC).convert("RGBA")

# purpose "any": transparan
logo.resize((192, 192), Image.LANCZOS).save(f"{OUT}/icon-192.png")
logo.resize((512, 512), Image.LANCZOS).save(f"{OUT}/icon-512.png")

# purpose "maskable": latar penuh, konten di dalam zona aman (lingkaran 80%)
side = 512
canvas = Image.new("RGBA", (side, side), (255, 255, 255, 255))
inner = int(side * 0.68)
scaled = logo.resize((inner, inner), Image.LANCZOS)
canvas.alpha_composite(scaled, ((side - inner) // 2, (side - inner) // 2))
canvas.convert("RGB").save(f"{OUT}/icon-maskable-512.png")

print("OK:", os.listdir(OUT))
