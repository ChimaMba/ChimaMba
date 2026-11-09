"""Removes the third-party lettering ("BC") baked into the coffee-table photo's
alpha mask (page 8), so it never appears in UTONDU footage.
Usage: python3 -I scripts/clean_tables_photo.py <dir with pdfimages output>"""
import sys
from collections import deque
from PIL import Image, ImageFilter
import numpy as np

I = sys.argv[1]
im = np.array(Image.open(f"{I}/im-008-018.jpg").convert("RGB")).astype(int)
m = np.array(Image.open(f"{I}/im-008-019.png").convert("L"))
h, w = m.shape
cand = (m > 10) & (im.mean(-1) > 120)
seen = np.zeros_like(cand)
kill = np.zeros_like(cand)
for y in range(h):
    for x in range(w):
        if cand[y, x] and not seen[y, x]:
            q = deque([(y, x)]); seen[y, x] = True; pts = []
            while q:
                cy, cx = q.popleft(); pts.append((cy, cx))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; q.append((ny, nx))
            # lettering lives in the lower-right, clear of the furniture
            if min(p[1] for p in pts) >= 470 and min(p[0] for p in pts) >= 560 and len(pts) > 30:
                for p in pts:
                    kill[p] = True
k = np.array(Image.fromarray((kill * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0
k[:, :465] = False
m2 = m.copy(); m2[k] = 0
Image.fromarray(m2).save(f"{I}/im-008-019-clean.png")
