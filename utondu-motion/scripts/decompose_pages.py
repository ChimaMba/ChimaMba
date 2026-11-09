"""
Splits every page of the brand PDF into animatable layers.

For each page it writes public/pages/pNN/:
  plate.jpg        the page with every element removed (background colours only)
  e###.png         one transparent PNG per element (text line, graphic cluster, image)
  manifest.json    element boxes in PDF points, kind, text, colour, stacking order

How elements are isolated:
  * images  - every other image is deleted and all vector art redacted, so the
              image renders alone with its real transparency and clipping.
  * vectors - text in this PDF is drawn as vector outlines (the Type3 text is
              invisible), so text lines and graphics are both vector clusters.
              Each cluster is re-drawn alone on a blank transparent page from its
              path data, so the layer is exact whatever sits beneath it.
  * stacking - elements keep the PDF's drawing order; large shapes drawn over a
              photo become layers too, everything else large stays in the plate.

Usage: python3 -I scripts/decompose_pages.py ["Utondu Brand identify for motion.pdf"]
Needs PyMuPDF, numpy, Pillow.
"""
import json
import os
import sys

import numpy as np
import pymupdf
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
PDF = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "Utondu Brand identify for motion.pdf")
OUT = os.path.join(ROOT, "public", "pages")
PAGE_H_PX = 2160  # render so the page is 2160px tall (2x a 1080p frame)
BG_AREA = 0.22    # vector shapes larger than this share of the page stay in the plate


def render(page, alpha=False, zoom=1.0):
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=alpha)
    mode = "RGBA" if alpha else "RGB"
    return np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, 4 if alpha else 3).copy(), mode


def fresh(pno):
    d = pymupdf.open(PDF)
    d.select([pno])
    return d, d[0]


def redact(page, rects, images, graphics, text):
    for r in rects:
        page.add_redact_annot(r)
    page.apply_redactions(images=images, graphics=graphics, text=text)


def clusters_for(page):
    """Group vector drawings into elements: one per text line, plus clusters of
    nearby graphics with the same fill colour. Large shapes stay in the plate."""
    area = page.rect.width * page.rect.height
    lines = []
    for b in page.get_text("dict")["blocks"]:
        if b["type"] != 0:
            continue
        for l in b["lines"]:
            txt = "".join(s["text"] for s in l["spans"]).strip()
            if txt:
                lines.append(dict(rect=pymupdf.Rect(l["bbox"]), text=txt))
    loose = []
    log = page.get_bboxlog()
    images = [(k, pymupdf.Rect(bb)) for k, (kind, bb) in enumerate(log) if kind == "fill-image"]
    for i, dr in enumerate(page.get_drawings()):
        r = dr["rect"]
        if r.width == 0 and r.height == 0:
            continue
        seq = dr.get("seqno", i)
        over_image = any(k < seq and r.intersects(ir) for k, ir in images)
        if r.width * r.height > BG_AREA * area and not over_image:
            continue  # background shape: stays in the plate
        colour = dr.get("fill") or dr.get("color")
        if colour is None:
            continue
        loose.append(dict(i=i, rect=pymupdf.Rect(r), colour=tuple(round(c, 3) for c in colour), seq=dr.get("seqno", i)))
    # cluster loose graphics by colour + proximity (4pt)
    groups = []
    for g in loose:
        merged = None
        for grp in groups:
            if grp["colour"] == g["colour"] and (grp["rect"] + (-4, -4, 4, 4)).intersects(g["rect"]):
                grp["rect"] |= g["rect"]
                grp["draws"].append(g["i"])
                merged = grp
                break
        if merged is None:
            groups.append(dict(kind="graphic", rect=pymupdf.Rect(g["rect"]), draws=[g["i"]], colour=g["colour"], text=None, seq=g["seq"]))
    # second pass: merge groups that now overlap
    changed = True
    while changed:
        changed = False
        for a in groups:
            for b in groups:
                if a is not b and a["colour"] == b["colour"] and (a["rect"] + (-4, -4, 4, 4)).intersects(b["rect"]):
                    a["rect"] |= b["rect"]
                    a["draws"] += b["draws"]
                    a["seq"] = min(a["seq"], b["seq"])
                    groups.remove(b)
                    changed = True
                    break
            if changed:
                break
    return groups, lines


def unpremultiply(rgba):
    a = rgba[..., 3:4].astype(np.float32)
    rgb = rgba[..., :3].astype(np.float32) * 255 / np.maximum(a, 1)
    return np.dstack([np.clip(rgb, 0, 255), a]).astype(np.uint8)


def draw_alone(page, idxs, zoom):
    """Re-draw the given vector drawings on a blank transparent page: an exact,
    anti-aliased layer, independent of whatever sits underneath on the board."""
    drawings = page.get_drawings()
    doc = pymupdf.open()
    blank = doc.new_page(width=page.rect.width, height=page.rect.height)
    for i in sorted(idxs, key=lambda i: drawings[i].get("seqno", i)):
        dr = drawings[i]
        sh = blank.new_shape()
        for it in dr["items"]:
            op = it[0]
            if op == "l":
                sh.draw_line(it[1], it[2])
            elif op == "c":
                sh.draw_bezier(it[1], it[2], it[3], it[4])
            elif op == "re":
                sh.draw_rect(it[1])
            elif op == "qu":
                sh.draw_quad(it[1])
        sh.finish(fill=dr.get("fill"), color=dr.get("color"), width=dr.get("width") or 0,
                  even_odd=bool(dr.get("even_odd")), closePath=bool(dr.get("closePath")),
                  fill_opacity=dr.get("fill_opacity") if dr.get("fill_opacity") is not None else 1,
                  stroke_opacity=dr.get("stroke_opacity") if dr.get("stroke_opacity") is not None else 1,
                  lineCap=max(dr.get("lineCap") or (0,)) if isinstance(dr.get("lineCap"), (list, tuple)) else (dr.get("lineCap") or 0),
                  lineJoin=dr.get("lineJoin") or 0)
        sh.commit()
    pix = blank.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=True)
    rgba = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, 4).copy()
    return unpremultiply(rgba)


EXT = 320  # PDF points rendered beyond the left and right page edges for bleeding images


def unclipped_image(src_doc, page, xref, zoom):
    """Render one image unclipped, EXT points beyond the left/right page edges, from
    its source pixels and placement transform. Axis-aligned placements only (flips
    handled); returns (rgba, x0_pt) or None."""
    infos = [i for i in page.get_image_info(xrefs=True) if i["xref"] == xref]
    if len(infos) != 1:
        return None
    a, b_, c, d, e, f = infos[0]["transform"]
    if abs(b_) > 1e-3 or abs(c) > 1e-3:
        return None  # rotated placement: not extended
    base = pymupdf.Pixmap(src_doc, xref)
    smask = src_doc.extract_image(xref).get("smask") or 0
    if base.n - base.alpha > 3:  # CMYK etc. -> RGB
        base = pymupdf.Pixmap(pymupdf.csRGB, base)
    if smask:
        base = pymupdf.Pixmap(base, pymupdf.Pixmap(src_doc, smask))
    mode = "RGBA" if base.alpha else "RGB"
    img = Image.frombytes(mode, (base.width, base.height), base.samples).convert("RGBA")
    if a < 0:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    if d < 0:
        img = img.transpose(Image.FLIP_TOP_BOTTOM)
    x0, x1 = sorted((e, e + a))
    y0, y1 = sorted((f, f + d))
    W, H = page.rect.width, page.rect.height
    cw, ch = int(round((W + 2 * EXT) * zoom)), int(round(H * zoom))
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    tw, th = int(round((x1 - x0) * zoom)), int(round((y1 - y0) * zoom))
    placed = img.resize((max(tw, 1), max(th, 1)), Image.LANCZOS)
    px, py = int(round((x0 + EXT) * zoom)), int(round(y0 * zoom))
    # paste with clipping to the canvas
    sx0, sy0 = max(0, -px), max(0, -py)
    dx0, dy0 = max(0, px), max(0, py)
    w_ = min(placed.width - sx0, cw - dx0)
    h_ = min(placed.height - sy0, ch - dy0)
    if w_ <= 0 or h_ <= 0:
        return None
    canvas.alpha_composite(placed.crop((sx0, sy0, sx0 + w_, sy0 + h_)), (dx0, dy0))
    return np.asarray(canvas), -EXT


def process(pno):
    src = pymupdf.open(PDF)
    page = src[pno]
    W, H = page.rect.width, page.rect.height
    zoom = PAGE_H_PX / H
    out = os.path.join(OUT, f"p{pno + 1:02d}")
    os.makedirs(out, exist_ok=True)
    log = page.get_bboxlog()

    els, lines = clusters_for(page)
    d_plate, p_plate = fresh(pno)
    drawings = p_plate.get_drawings()
    # 4pt margin: "covered" is tested against true curve bounds, which can exceed the tight box
    rects = [drawings[i]["rect"] + (-4, -4, 4, 4) for e in els for i in e["draws"]]
    redact(p_plate, rects, pymupdf.PDF_REDACT_IMAGE_REMOVE, pymupdf.PDF_REDACT_LINE_ART_REMOVE_IF_COVERED, pymupdf.PDF_REDACT_TEXT_REMOVE)
    plate, _ = render(p_plate, zoom=zoom)
    Image.fromarray(plate).save(os.path.join(out, "plate.jpg"), quality=92)
    # 1px edge columns of the plate, used to extend the page's background to 16:9
    # sampled 4px in from the border: the outermost column is part-covered by the page edge
    Image.fromarray(np.repeat(plate[:, 4:5], 4, axis=1)).save(os.path.join(out, "edge-l.png"))
    Image.fromarray(np.repeat(plate[:, -5:-4], 4, axis=1)).save(os.path.join(out, "edge-r.png"))
    # the whole page flattened, for framed plates in the social cuts
    full, _ = render(page, zoom=zoom)
    Image.fromarray(full).save(os.path.join(out, "full.jpg"), quality=90)

    # Plate: for pages without gradient shadings, draw only the background shapes
    # (every drawing that is not part of an element) from their own path data onto
    # a white page, so no element residue is possible. Pages with shadings keep the
    # redacted plate, cleaned up below.
    has_shading = any(k == "fill-shade" for k, _ in log)
    if not has_shading:
        used = {i for e in els for i in e["draws"]}
        bg_idx = [i for i, dr in enumerate(page.get_drawings()) if i not in used and not (dr["rect"].width == 0 and dr["rect"].height == 0)]
        bg = draw_alone(page, bg_idx, zoom).astype(np.float32)
        a_ = bg[..., 3:4] / 255
        plate = (bg[..., :3] * a_ + 255 * (1 - a_)).astype(np.uint8)
        Image.fromarray(plate).save(os.path.join(out, "plate.jpg"), quality=92)
    footprints = []  # (x0, y0, alpha) of every vector layer, for plate clean-up
    manifest = dict(page=pno + 1, width=round(W, 2), height=round(H, 2), plate="plate.jpg", elements=[])
    n = 0
    # --- vector elements (text lines + graphics), matted against the plate-with-vectors
    for e in els:
        layer = draw_alone(page, e["draws"], zoom)
        r = (e["rect"] + (-1, -1, 1, 1)) & page.rect
        x0, y0, x1, y1 = [int(round(v * zoom)) for v in r]
        x1, y1 = min(x1, layer.shape[1]), min(y1, layer.shape[0])
        if x1 - x0 < 2 or y1 - y0 < 2:
            continue
        rgba = layer[y0:y1, x0:x1]
        if rgba[..., 3].max() < 8:
            continue
        footprints.append((x0, y0, rgba[..., 3].copy()))
        # text lines inside this cluster -> one strip per line (split at the gaps)
        inside = sorted([l for l in lines if e["rect"].contains(pymupdf.Point((l["rect"].x0 + l["rect"].x1) / 2, (l["rect"].y0 + l["rect"].y1) / 2))],
                        key=lambda l: l["rect"].y0)
        strips = []
        if inside:
            cuts = [y0] + [int(round(((inside[k]["rect"].y1 + inside[k + 1]["rect"].y0) / 2) * zoom)) for k in range(len(inside) - 1)] + [y1]
            for k, l in enumerate(inside):
                strips.append(("text", l["text"], max(cuts[k], y0), min(cuts[k + 1], y1)))
        else:
            strips.append((e["kind"], None, y0, y1))
        for kind, text, sy0, sy1 in strips:
            sub = rgba[sy0 - y0:sy1 - y0]
            if sub.shape[0] == 0:
                continue
            cols = np.where(sub[..., 3].max(axis=0) > 2)[0]
            if len(cols) == 0:
                continue
            sx0, sx1 = cols.min(), cols.max() + 1
            sub = sub[:, sx0:sx1]
            f = f"e{n:03d}.png"
            Image.fromarray(sub, "RGBA").save(os.path.join(out, f), optimize=True)
            manifest["elements"].append(dict(id=f"e{n:03d}", kind=kind, text=text, file=f,
                                              x=round((x0 + sx0) / zoom, 2), y=round(sy0 / zoom, 2), w=round((sx1 - sx0) / zoom, 2), h=round((sy1 - sy0) / zoom, 2),
                                              colour="#%02X%02X%02X" % tuple(int(c * 255) for c in e["colour"][:3]), z=e["seq"] + 0.001 * len(strips)))
            n += 1
    # --- images, each rendered alone
    infos = page.get_image_info(xrefs=True)
    xrefs = sorted({i["xref"] for i in infos if i["xref"]})
    for xref in xrefs:
        d_im, p_im = fresh(pno)
        redact(p_im, [p_im.rect], pymupdf.PDF_REDACT_IMAGE_NONE, pymupdf.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED, pymupdf.PDF_REDACT_TEXT_REMOVE)
        for other in xrefs:
            if other != xref:
                p_im.delete_image(other)
        rgba, _ = render(p_im, alpha=True, zoom=zoom)
        rgba = unpremultiply(rgba)
        ys, xs = np.where(rgba[..., 3] > 2)
        if len(xs) == 0:
            continue
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        f = f"e{n:03d}.png"
        Image.fromarray(rgba[y0:y1, x0:x1], "RGBA").save(os.path.join(out, f), optimize=True)
        bbs = [pymupdf.Rect(i["bbox"]) for i in infos if i["xref"] == xref]
        def iou(r1, r2):
            i = (r1 & r2)
            if i.is_empty:
                return 0.0
            return i.get_area() / ((r1 | r2).get_area() or 1)
        cands = [(max(iou(pymupdf.Rect(b), bb) for bb in bbs), k) for k, (kind, b) in enumerate(log) if kind == "fill-image"]
        z = max(cands)[1] if cands else 0
        crop_a = rgba[y0:y1, x0:x1, 3]
        cutout = bool((crop_a < 128).mean() > 0.12)  # product cut-out vs rectangular photo
        el = dict(id=f"e{n:03d}", kind="image", text=None, file=f, cutout=cutout,
                  x=round(x0 / zoom, 2), y=round(y0 / zoom, 2), w=round((x1 - x0) / zoom, 2), h=round((y1 - y0) / zoom, 2),
                  colour=None, z=z)
        # bleeding off the left/right page edge? render the real content beyond it
        touches = x0 <= 2 or x1 >= rgba.shape[1] - 2
        if touches:
            ext = unclipped_image(src, page, xref, zoom)
            if ext is not None:
                ea, ex_pt = ext
                ea = ea.astype(np.float32)
                off = int(round(-ex_pt * zoom))  # canvas px where the page starts
                Wpx = int(round(W * zoom))
                # the clipped element, placed on the same canvas
                clip_c = np.zeros_like(ea)  # (rgba is this image's full-page render)
                hh = min(rgba.shape[0], ea.shape[0])
                ww = min(rgba.shape[1], ea.shape[1] - off)
                clip_c[:hh, off:off + ww] = rgba[:hh, :ww]
                m_ = clip_c[..., 3] > 200
                # colour-match the raw source to MuPDF's colour-managed render
                if m_.sum() > 100:
                    for ch in range(3):
                        A = np.vstack([ea[..., ch][m_], np.ones(m_.sum())]).T
                        g, o = np.linalg.lstsq(A, clip_c[..., ch][m_], rcond=None)[0]
                        ea[..., ch] = np.clip(ea[..., ch] * g + o, 0, 255)
                    diff = float(np.abs(ea[..., :3] - clip_c[..., :3]).max(axis=2)[m_].mean())
                    cov = float((ea[..., 3] > 200)[m_].mean())
                else:
                    diff, cov = 999.0, 0.0
                # seam continuity: in a 20px strip just inside each bleeding edge, the
                # extension's own pixels against the exact pixels at the same place.
                # The mean colour bias there is exactly the step a viewer would see.
                Wr = rgba.shape[1]
                seam = 0.0
                for side, c0, c1 in (("L", off, off + 20), ("R", off + Wr - 20, off + Wr)):
                    if (side == "L" and x0 <= 2) or (side == "R" and x1 >= Wr - 2):
                        both = (clip_c[:, c0:c1, 3] > 200) & (ea[:, c0:c1, 3] > 200)
                        if both.sum() > 50:
                            bias = np.abs(ea[:, c0:c1, :3][both].mean(axis=0) - clip_c[:, c0:c1, :3][both].mean(axis=0)).max()
                            seam = max(seam, float(bias))
                if diff < 14 and cov > 0.98 and seam < 4:
                    # inside the page: exactly the clipped render; beyond it: real
                    # source content, only on the side(s) the element bleeds from
                    final = clip_c.copy()
                    if x0 <= 2:
                        final[:, :off] = ea[:, :off]
                    if x1 >= Wr - 2:
                        final[:, off + Wr:] = ea[:, off + Wr:]
                    final = final.astype(np.uint8)
                    ys2, xs2 = np.where(final[..., 3] > 2)
                    ex0, ex1, ey0, ey1 = xs2.min(), xs2.max() + 1, ys2.min(), ys2.max() + 1
                    fe = f"e{n:03d}x.png"
                    Image.fromarray(final[ey0:ey1, ex0:ex1], "RGBA").save(os.path.join(out, fe), optimize=True)
                    el["ext"] = dict(file=fe, x=round((ex0 - off) / zoom, 2), y=round(ey0 / zoom, 2),
                                     w=round((ex1 - ex0) / zoom, 2), h=round((ey1 - ey0) / zoom, 2))
                el["ext_check"] = dict(diff=round(float(diff), 2), coverage=round(float(cov), 4), seam=round(seam, 2))
        # full-page photos: keep their edge columns (4px in) to extend them into side margins
        if el["w"] >= W * 0.95 and el["h"] >= H * 0.95:
            core = rgba[y0:y1, x0:x1]
            Image.fromarray(np.repeat(core[:, 4:5, :3], 4, axis=1)).save(os.path.join(out, f"e{n:03d}-edge-l.png"))
            Image.fromarray(np.repeat(core[:, -5:-4, :3], 4, axis=1)).save(os.path.join(out, f"e{n:03d}-edge-r.png"))
            el["edges"] = True
        manifest["elements"].append(el)
        n += 1
    # Plate clean-up: vectors inside form XObjects survive redaction, so paint the
    # background back in under every vector layer (median of a ring around it).
    plate = np.asarray(Image.open(os.path.join(out, "plate.jpg")).convert("RGB")).copy()
    H_, W_ = plate.shape[:2]
    if not has_shading:
        footprints = []
    # two passes: the second samples edges the first pass has already cleaned
    for x0, y0, a in footprints + footprints:
        h_, w_ = a.shape
        # whole box (fills letter counters too), each row interpolated between the
        # pixels just outside its left and right edges: exact on flat grounds,
        # smooth across horizontal gradients
        bx0, by0 = max(x0 - 8, 0), max(y0 - 8, 0)
        bx1, by1 = min(x0 + w_ + 8, W_ - 1), min(y0 + h_ + 8, H_ - 1)
        lx, rx = max(bx0 - 3, 0), min(bx1 + 3, W_ - 1)
        left = plate[by0:by1, lx].astype(np.float32)
        right = plate[by0:by1, rx].astype(np.float32)
        t = np.linspace(0, 1, bx1 - bx0)[None, :, None]
        plate[by0:by1, bx0:bx1] = (left[:, None, :] * (1 - t) + right[:, None, :] * t).astype(np.uint8)
    Image.fromarray(plate).save(os.path.join(out, "plate.jpg"), quality=92)
    Image.fromarray(np.repeat(plate[:, 4:5], 4, axis=1)).save(os.path.join(out, "edge-l.png"))
    Image.fromarray(np.repeat(plate[:, -5:-4], 4, axis=1)).save(os.path.join(out, "edge-r.png"))
    manifest["elements"].sort(key=lambda e: e["z"])
    with open(os.path.join(out, "manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=1)
    return manifest


def write_ts_index():
    """src/pages/manifests.ts: every page's manifest, typed, for the PageScene."""
    folders = sorted(f for f in os.listdir(OUT) if f.startswith("p") and os.path.isdir(os.path.join(OUT, f)))
    data = {}
    for f in folders:
        m = json.load(open(os.path.join(OUT, f, "manifest.json")))
        for e in m["elements"]:
            e.pop("ext_check", None)  # QA numbers stay in manifest.json only
        data[m["page"]] = m
    os.makedirs(os.path.join(ROOT, "src", "pages"), exist_ok=True)
    with open(os.path.join(ROOT, "src", "pages", "manifests.ts"), "w") as fh:
        fh.write("// Generated by scripts/decompose_pages.py from the brand PDF. Do not edit by hand.\n")
        fh.write("export type PageElement = { id: string; kind: \"text\" | \"graphic\" | \"image\"; text: string | null; file: string; x: number; y: number; w: number; h: number; colour: string | null; z: number; cutout?: boolean; edges?: boolean; ext?: { file: string; x: number; y: number; w: number; h: number } };\n")
        fh.write("export type PageManifest = { page: number; width: number; height: number; plate: string; elements: PageElement[] };\n")
        fh.write("export const manifests: Record<number, PageManifest> = " + json.dumps(data) + ";\n")


if __name__ == "__main__":
    pages = [int(a) - 1 for a in sys.argv[2:]] or range(pymupdf.open(PDF).page_count)
    for pno in pages:
        m = process(pno)
        kinds = {}
        for e in m["elements"]:
            kinds[e["kind"]] = kinds.get(e["kind"], 0) + 1
        print(f"page {pno + 1:2d}: {kinds}")
    write_ts_index()
