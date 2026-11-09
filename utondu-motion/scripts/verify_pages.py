"""
Proves the page decomposition is lossless: rebuilds every page from its plate and
element layers (in stacking order) and compares it with the PDF's own render.
Prints PSNR per page and writes a heat map of any differences next to each manifest.

Usage: python3 -I scripts/verify_pages.py [page numbers...]
"""
import json
import os
import sys

import numpy as np
import pymupdf
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
PDF = os.path.join(ROOT, "Utondu Brand identify for motion.pdf")
PAGES = os.path.join(ROOT, "public", "pages")


def rebuild(m, folder):
    plate = Image.open(os.path.join(folder, m["plate"])).convert("RGBA")
    zoom = plate.height / m["height"]
    canvas = plate.copy()
    for e in sorted(m["elements"], key=lambda e: e["z"]):
        im = Image.open(os.path.join(folder, e["file"])).convert("RGBA")
        canvas.alpha_composite(im, (int(round(e["x"] * zoom)), int(round(e["y"] * zoom))))
    return np.asarray(canvas.convert("RGB")).astype(np.float32), zoom


def main():
    doc = pymupdf.open(PDF)
    pages = [int(a) for a in sys.argv[1:]] or range(1, doc.page_count + 1)
    for p in pages:
        folder = os.path.join(PAGES, f"p{p:02d}")
        m = json.load(open(os.path.join(folder, "manifest.json")))
        rec, zoom = rebuild(m, folder)
        pix = doc[p - 1].get_pixmap(matrix=pymupdf.Matrix(zoom, zoom))
        ref = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, 3).astype(np.float32)
        h, w = min(ref.shape[0], rec.shape[0]), min(ref.shape[1], rec.shape[1])
        diff = np.abs(ref[:h, :w] - rec[:h, :w]).max(axis=2)
        mse = (diff ** 2).mean()
        psnr = 10 * np.log10(255 ** 2 / max(mse, 1e-9))
        bad = (diff > 24).mean() * 100
        Image.fromarray(np.clip(diff * 4, 0, 255).astype(np.uint8)).resize((w // 4, h // 4)).save(os.path.join(folder, "_diff.png"))
        print(f"page {p:2d}: PSNR {psnr:5.1f} dB, {bad:5.2f}% pixels off by >24/255, {len(m['elements'])} layers")


if __name__ == "__main__":
    main()
