import React, { useMemo } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors, ease } from "../brand";
import { manifests } from "../pages/manifests";
import { choreograph, framePage, PageOptions, Placed } from "../pages/choreo";

/**
 * A brand-board page brought to life from its decomposed layers
 * (public/pages/pNN, made by scripts/decompose_pages.py).
 *
 * Every element sits exactly where — and at exactly the size — it is on the board.
 * The page is fitted to the frame height and framed by framePage(): flat
 * backgrounds extend with their own edge colours, shapes touching a page edge
 * extend as solid colour, images that bleed off the page continue with their real
 * source content, and only full-bleed photos without spare content continue with
 * their own edge colours. Nothing inside the page is ever rescaled or re-cropped.
 */
export type PageSceneProps = PageOptions & { page: number; dur: number; children?: React.ReactNode; push?: number };

export const PageScene: React.FC<PageSceneProps> = ({ page, dur, children, push = 0.02, ...options }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const m = manifests[page];
  const placed = useMemo(() => choreograph(m, options), [m, options]);
  const f = framePage(m, width, height);
  const dir = `pages/p${String(page).padStart(2, "0")}/`;
  const { s, offX, offY } = f;
  const pw = m.width * s;
  const ph = m.height * s;
  const X = (pt: number) => offX + pt * s;
  const Y = (pt: number) => offY + pt * s;
  const e = (f0: number, f1: number, a: number, b: number, easing = ease.settle) =>
    interpolate(frame, [f0, f1], [a, b], { ...clamp, easing });

  const layer = (el: Placed) => {
    const touchL = el.x <= 1;
    const touchR = el.x + el.w >= m.width - 1;
    const st = el.start;
    // geometry: images use their extended layer when they have one; shapes that
    // touch a page edge get a solid extension to the frame edge
    const ext = el.kind === "image" && el.ext ? el.ext : null;
    const src = staticFile(dir + (ext ? ext.file : el.file));
    const bx = ext ? ext : el;
    let left = X(bx.x);
    let right = X(bx.x + bx.w);
    const top = Y(bx.y);
    const h = bx.h * s;
    const solid = el.kind !== "image" && el.colour ? el.colour : null;
    if (solid && f.mode === "contain") {
      if (touchL) left = Math.min(left, 0);
      if (touchR) right = Math.max(right, width);
    }
    const w = right - left;
    const inner = (
      <>
        <Img src={src} style={{ position: "absolute", left: X(bx.x) - left, top: 0, width: bx.w * s, height: h, display: "block" }} />
        {solid && touchL && left < X(el.x) ? (
          <div style={{ position: "absolute", left: 0, top: 0, width: X(el.x) - left + 3, height: "100%", backgroundColor: solid }} />
        ) : null}
        {solid && touchR && right > X(el.x + el.w) ? (
          <div style={{ position: "absolute", left: X(el.x + el.w) - left - 3, top: 0, right: 0, height: "100%", backgroundColor: solid }} />
        ) : null}
      </>
    );
    const box: React.CSSProperties = { position: "absolute", left, top, width: w, height: h };
    const fromL = touchL && !touchR;
    const fromR = touchR && !touchL;

    switch (el.preset) {
      case "bg":
        return (
          <div key={el.id} style={box}>
            {inner}
          </div>
        );
      case "image": {
        const p = e(st, st + 26, 0, 1, ease.glide);
        const r = (1 - p) * 100;
        const clip = fromL ? `inset(0 ${r}% 0 0)` : fromR ? `inset(0 0 0 ${r}%)` : `inset(${r}% 0 0 0)`;
        const slide = fromL ? `${e(st, st + 40, -40, 0)}px 0` : fromR ? `${e(st, st + 40, 40, 0)}px 0` : `0 ${e(st, st + 40, 24, 0)}px`;
        return (
          <div key={el.id} style={{ ...box, clipPath: clip }}>
            <div style={{ position: "absolute", inset: 0, translate: slide, scale: String(e(st, st + 46, 1.05, 1)) }}>{inner}</div>
          </div>
        );
      }
      case "product": {
        // placed down onto the page (or slid in from the edge it bleeds off), then settles
        const t = fromL ? `${e(st, st + 30, -70, 0)}px 0` : fromR ? `${e(st, st + 30, 70, 0)}px 0` : `0 ${e(st, st + 30, 46, 0)}px`;
        return (
          <div
            key={el.id}
            style={{
              ...box,
              opacity: e(st, st + 12, 0, 1),
              translate: t,
              scale: String(e(st, st + 34, fromL || fromR ? 1 : 1.035, 1)),
              transformOrigin: "50% 100%",
            }}
          >
            {inner}
          </div>
        );
      }
      case "panel": {
        const p = e(st, st + 22, 0, 1, ease.glide);
        const r = (1 - p) * 100;
        const touchT = el.y <= 1;
        const touchB = el.y + el.h >= m.height - 1;
        const clip = fromL
          ? `inset(0 ${r}% 0 0)`
          : fromR
            ? `inset(0 0 0 ${r}%)`
            : touchB && !touchT
              ? `inset(${r}% 0 0 0)`
              : touchT && !touchB
                ? `inset(0 0 ${r}% 0)`
                : `inset(${r}% 0 0 0)`;
        return (
          <div key={el.id} style={{ ...box, clipPath: clip }}>
            {inner}
          </div>
        );
      }
      case "letter":
      case "text":
        return (
          <div key={el.id} style={{ ...box, overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, translate: `0 ${e(st, st + (el.preset === "letter" ? 20 : 24), 110, 0)}%` }}>{inner}</div>
          </div>
        );
      case "line":
        return (
          <div key={el.id} style={{ ...box, scale: `${e(st, st + 22, 0, 1, ease.glide)} 1`, transformOrigin: "0 50%" }}>
            {inner}
          </div>
        );
      case "pop":
        return (
          <div key={el.id} style={{ ...box, scale: String(e(st, st + 18, 0, 1)), opacity: e(st, st + 8, 0, 1) }}>
            {inner}
          </div>
        );
    }
  };

  // edge continuation of a full-bleed photo, only where no real content exists
  // beyond the page: each margin row continues the photo's own edge colour (so
  // there is no seam), softened vertically, darkening gently toward the frame edge
  const bg = placed.find((p) => p.preset === "bg");
  const mirror = (side: "L" | "R") => {
    if (!bg || !f.mirror[side] || !bg.edges) return null;
    const cw = side === "L" ? offX : width - (offX + pw);
    if (cw <= 0) return null;
    return (
      <div
        key={`edge-${side}`}
        style={{ position: "absolute", left: side === "L" ? 0 : offX + pw - 3, top: offY, width: cw + 3, height: ph, overflow: "hidden" }}
      >
        <Img
          src={staticFile(`${dir}${bg.id}-edge-${side === "L" ? "l" : "r"}.png`)}
          style={{ position: "absolute", left: -40, top: -40, width: cw + 83, height: ph + 80, objectFit: "fill", filter: "blur(10px)" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(${side === "L" ? "270deg" : "90deg"}, rgba(20,12,9,0) 0%, rgba(20,12,9,0.18) 100%)`,
          }}
        />
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ backgroundColor: colors.whiteRock, overflow: "hidden" }}>
      <AbsoluteFill style={{ scale: String(interpolate(frame, [0, dur], [1, 1 + push], clamp)) }}>
        {/* page background, extended to the frame edges with its own edge colours */}
        <Img src={staticFile(dir + m.plate)} style={{ position: "absolute", left: offX, top: offY, width: pw, height: ph }} />
        {f.mode === "contain" && offX > 0 ? (
          <>
            {/* edge strips overlap the page by 3px, covering the plate's anti-aliased border */}
            <Img src={staticFile(dir + "edge-l.png")} style={{ position: "absolute", left: 0, top: offY, width: offX + 3, height: ph, objectFit: "fill" }} />
            <Img src={staticFile(dir + "edge-r.png")} style={{ position: "absolute", left: offX + pw - 3, top: offY, width: width - offX - pw + 3, height: ph, objectFit: "fill" }} />
          </>
        ) : null}
        {placed.map((p) => (p.preset === "bg" ? [layer(p), mirror("L"), mirror("R")] : layer(p)))}
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Frame-space geometry of a page, for native layers that sit on top of it. */
export const pageGeometry = (page: number, width: number, height: number) => {
  const f = framePage(manifests[page], width, height);
  return { s: f.s, offX: f.offX, offY: f.offY };
};
