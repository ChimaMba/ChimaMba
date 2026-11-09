"""
Fidelity check: every page scene in the brand film, on its settled last frame,
compared with the brand-board PDF itself.

For each page scene it renders the last frame with the camera push off (qa mode),
crops the page area using the renderer's own framing (src/pages/choreo.ts →
framePage), and measures it against the PDF page. Writes side-by-sides to
renders/qa/ and prints PSNR per page.

Usage: npx remotion bundle && python3 -I scripts/check_fidelity.py
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
QA = os.path.join(ROOT, "renders", "qa")
BROWSER = os.environ.get("REMOTION_BROWSER", "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell")


def node_json(code):
    out = subprocess.run(["npx", "tsx", "-e", code], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def main():
    os.makedirs(QA, exist_ok=True)
    film = node_json(
        'import { FILM } from "./src/timeline"; import { manifests } from "./src/pages/manifests";'
        'import { framePage } from "./src/pages/choreo";'
        "console.log(JSON.stringify(FILM.map((s, i) => ({ i, kind: s.kind, page: s.kind === 'cover' ? 1 : s.page ?? null, dur: s.dur,"
        " frame: (s.kind === 'page' || s.kind === 'cover') ? framePage(manifests[s.kind === 'cover' ? 1 : s.page!], 1920, 1080) : null }))));"
    )
    comps = subprocess.run(["npx", "remotion", "compositions", "build", f"--browser-executable={BROWSER}"], cwd=ROOT,
                           capture_output=True, text=True).stdout.split()
    ids = [c for c in comps if c.startswith("S") and c[1:3].isdigit()]
    rows = []
    for sc in film:
        if sc["frame"] is None:
            continue
        cid = next(c for c in ids if c.startswith(f"S{sc['i'] + 1:02d}-"))
        out = os.path.join(QA, f"{cid}.png")
        subprocess.run(["npx", "remotion", "still", "build", cid, out, f"--frame={sc['dur'] - 1}",
                        f"--props={json.dumps({'index': sc['i'], 'qa': True})}", f"--browser-executable={BROWSER}", "--log=error"],
                       cwd=ROOT, check=True)
        fr = sc["frame"]
        img = np.asarray(Image.open(out).convert("RGB")).astype(np.float32)
        m = json.load(open(os.path.join(ROOT, "public", "pages", f"p{sc['page']:02d}", "manifest.json")))
        pw, ph = m["width"] * fr["s"], m["height"] * fr["s"]
        x0, y0 = fr["offX"], fr["offY"]
        ref = Image.open(os.path.join(ROOT, "public", "pages", f"p{sc['page']:02d}", "full.jpg")).convert("RGB")
        if fr["mode"] == "cover":
            # the frame shows the centre of the page
            refr = np.asarray(ref.resize((round(pw), round(ph)), Image.LANCZOS)).astype(np.float32)
            cx, cy = round(-x0), round(-y0)
            refc = refr[cy:cy + 1080, cx:cx + 1920]
            crop = img[: refc.shape[0], : refc.shape[1]]
        else:
            X0, Y0, X1, Y1 = round(x0), round(y0), round(x0 + pw), round(y0 + ph)
            crop = img[Y0:Y1, X0:X1]
            refc = np.asarray(ref.resize((crop.shape[1], crop.shape[0]), Image.LANCZOS)).astype(np.float32)
        mse = ((crop - refc) ** 2).mean()
        psnr = 10 * np.log10(255 ** 2 / max(mse, 1e-9))
        side = np.concatenate([crop, refc], axis=1).clip(0, 255).astype(np.uint8)
        Image.fromarray(side).resize((side.shape[1] // 3, side.shape[0] // 3)).save(os.path.join(QA, f"{cid}_vs_pdf.png"))
        rows.append((cid, sc["page"], psnr))
        print(f"{cid:42s} page {sc['page']:2d}  PSNR {psnr:5.1f} dB  ({fr['mode']}, page at x {x0:.0f})")
    worst = min(r[2] for r in rows)
    print(f"worst: {worst:.1f} dB")
    sys.exit(0 if worst > 28 else 1)


if __name__ == "__main__":
    main()
