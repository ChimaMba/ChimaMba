import sys
from PIL import Image
I = sys.argv[1]; OUT = sys.argv[2]
K = 3  # output pixels per page point
def rgba(img, mask):
    im = Image.open(f"{I}/im-{img}.jpg").convert("RGB")
    m = Image.open(f"{I}/im-{mask}.png").convert("L").resize(im.size)
    im.putalpha(m); return im
cards = {
    # name: (card x, card y, layers [(img, mask, x, y, scale)])
    "sofa":   (71.949, 243.012, [("008-014", "008-015", -38.972, 201.041, 0.43469), ("008-020", "008-021", 71.949, 256.001, 0.233167)]),
    "chair":  (421.699, 243.012, [("008-022", "008-023", 421.700, 247.008, 0.380164)]),
    "tables": (771.449, 243.012, [("008-016", "008-017", 687.510, 212.033, 0.43469), ("008-018", "008-019-clean", 779.118, 181.751, 0.364408)]),
}
W = H = 279.8
for name, (cx, cy, layers) in cards.items():
    canvas = Image.new("RGBA", (round(W * K), round(H * K)), (0, 0, 0, 0))
    for img, mask, x, y, s in layers:
        im = rgba(img, mask)
        w, h = round(im.width * s * K), round(im.height * s * K)
        im = im.resize((w, h), Image.LANCZOS)
        canvas.alpha_composite(im, (round((x - cx) * K), round((y - cy) * K))) if x >= cx and y >= cy else canvas.alpha_composite(
            im.crop((max(0, round((cx - x) * K)), max(0, round((cy - y) * K)), w, h)),
            (max(0, round((x - cx) * K)), max(0, round((y - cy) * K))))
    canvas.save(f"{OUT}/palette-{name}.png", optimize=True)
    print(name, canvas.size)
