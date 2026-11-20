#!/usr/bin/env python3
"""Buat aset logo Scorify dari gambar upload.

- Buang latar putih di sekitar kotak logo (flood-fill dari tepi, bukan centang
  putih di tengah yang memang bagian logo).
- Hasilkan:
  - src/assets/scorify-logo.png  (512px, transparan) -> sidebar via static import
  - src/app/icon.png             (512px, transparan) -> favicon Next.js
  - src/app/apple-icon.png       (180px, latar putih) -> ikon iOS
"""
from PIL import Image
from collections import deque

SRC = "/home/z/my-project/upload/pasted_image_1795147180380.png"

im = Image.open(SRC).convert("RGBA")
w, h = im.size
px = im.load()


def is_whiteish(p):
    r, g, b, _ = p
    return r >= 235 and g >= 235 and b >= 235


# Flood fill dari semua piksel tepi yang putih -> tandai jadi transparan
seen = [[False] * w for _ in range(h)]
q = deque()
for x in range(w):
    for y in (0, h - 1):
        if is_whiteish(px[x, y]) and not seen[y][x]:
            seen[y][x] = True
            q.append((x, y))
for y in range(h):
    for x in (0, w - 1):
        if is_whiteish(px[x, y]) and not seen[y][x]:
            seen[y][x] = True
            q.append((x, y))

while q:
    x, y = q.popleft()
    px[x, y] = (255, 255, 255, 0)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and is_whiteish(px[nx, ny]):
            seen[ny][nx] = True
            q.append((nx, ny))

# Potong ke bounding box konten + margin kecil, lalu kanvas persegi
bbox = im.getbbox()
pad = 6
x0, y0, x1, y1 = bbox
x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
x1, y1 = min(w, x1 + pad), min(h, y1 + pad)
im = im.crop((x0, y0, x1, y1))

side = max(im.size)
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2))


def save_square(img, path, size, bg=None):
    out = img.resize((size, size), Image.LANCZOS)
    if bg is not None:
        base = Image.new("RGBA", (size, size), bg)
        base.alpha_composite(out)
        out = base
    out.save(path)
    print("saved:", path, out.size)


save_square(canvas, "/home/z/my-project/src/assets/scorify-logo.png", 512)
save_square(canvas, "/home/z/my-project/src/app/icon.png", 512)
# Apple touch icon: iOS menutup transparansi dengan hitam -> beri latar putih
save_square(canvas, "/home/z/my-project/src/app/apple-icon.png", 180, bg=(255, 255, 255, 255))
print("OK")
