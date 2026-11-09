import React, { useMemo } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors, ease } from "../brand";
import { manifests } from "../pages/manifests";
import { choreograph, PageOptions, Placed } from "../pages/choreo";

/**
 * A brand-board page brought to life from its decomposed layers
 * (public/pages/pNN, made by scripts/decompose_pages.py).
 *
 * The page is fitted to the frame height; its background is extended to the frame
 * edges from the plate's own edge colours, full-bleed photos fill the frame, and
 * elements touching a page edge extend to the frame edge. Each element animates
 * with its preset (see src/pages/choreo.ts); the whole page gets a slow push.
 */
export type PageSceneProps = PageOptions & { page: number; dur: number; children?: React.ReactNode; push?: number };

export const PageScene: React.FC<PageSceneProps> = ({ page, dur, children, push = 0.02, ...options }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const m = manifests[page];
  const placed = useMemo(() => choreograph(m, options), [m, options]);
  const dir = `pages/p${String(page).padStart(2, "0")}/`;

  const s = Math.min(height / m.height, width / m.width);
  const pw = m.width * s;
  const ph = m.height * s;
  const offX = (width - pw) / 2;
  const offY = (height - ph) / 2;
  const e = (f0: number, f1: number, a: number, b: number, easing = ease.settle) =>
    interpolate(frame, [f0, f1], [a, b], { ...clamp, easing });

  const layer = (el: Placed) => {
    let left = el.x * s + offX;
    let top = el.y * s + offY;
    let w = el.w * s;
    let h = el.h * s;
    const touchL = el.x <= 1;
    const touchR = el.x + el.w >= m.width - 1;
    const touchT = el.y <= 1;
    const touchB = el.y + el.h >= m.height - 1;
    let fit: "fill" | "cover" = "fill";
    let pos = "center";
    if (el.preset === "bg") {
      left = 0;
      top = 0;
      w = width;
      h = height;
      fit = "cover";
    } else {
      if (touchL && offX > 0) {
        w += left;
        left = 0;
        fit = "cover";
        pos = touchR ? "center" : "right center";
      }
      if (touchR && offX > 0) {
        w = width - left;
        fit = "cover";
        pos = touchL ? "center" : "left center";
      }
      if (touchT && offY > 0) {
        h += top;
        top = 0;
        fit = "cover";
      }
      if (touchB && offY > 0) {
        h = height - top;
        fit = "cover";
      }
    }
    const st = el.start;
    const img = (style: React.CSSProperties = {}) => (
      <Img
        src={staticFile(dir + el.file)}
        style={{ width: "100%", height: "100%", objectFit: fit, objectPosition: pos, display: "block", ...style }}
      />
    );
    const box: React.CSSProperties = { position: "absolute", left, top, width: w, height: h };

    switch (el.preset) {
      case "bg":
        return (
          <div key={el.id} style={{ ...box, overflow: "hidden" }}>
            {img({ scale: String(e(0, dur, 1.08, 1.0)) })}
          </div>
        );
      case "image": {
        const p = e(st, st + 24, 0, 1, ease.glide);
        return (
          <div key={el.id} style={{ ...box, clipPath: `inset(${(1 - p) * 100}% 0 0 0)`, opacity: e(st, st + 10, 0, 1) }}>
            {img({ scale: String(e(st, st + 44, 1.07, 1)), transformOrigin: "50% 100%" })}
          </div>
        );
      }
      case "panel": {
        const p = e(st, st + 22, 0, 1, ease.glide);
        const r = (1 - p) * 100;
        const clip = touchL && !touchR
          ? `inset(0 ${r}% 0 0)`
          : touchR && !touchL
            ? `inset(0 0 0 ${r}%)`
            : touchB && !touchT
              ? `inset(${r}% 0 0 0)`
              : touchT && !touchB
                ? `inset(0 0 ${r}% 0)`
                : `inset(${r}% 0 0 0)`;
        return (
          <div key={el.id} style={{ ...box, clipPath: clip }}>
            {img()}
          </div>
        );
      }
      case "letter":
      case "text":
        return (
          <div key={el.id} style={{ ...box, overflow: "hidden" }}>
            <div style={{ width: "100%", height: "100%", translate: `0 ${e(st, st + (el.preset === "letter" ? 20 : 24), 110, 0)}%` }}>{img()}</div>
          </div>
        );
      case "line":
        return (
          <div key={el.id} style={{ ...box, scale: `${e(st, st + 22, 0, 1, ease.glide)} 1`, transformOrigin: "0 50%" }}>
            {img()}
          </div>
        );
      case "pop":
        return (
          <div key={el.id} style={{ ...box, scale: String(e(st, st + 18, 0, 1)), opacity: e(st, st + 8, 0, 1) }}>
            {img()}
          </div>
        );
    }
  };

  return (
    <AbsoluteFill style={{ backgroundColor: colors.whiteRock, overflow: "hidden" }}>
      <AbsoluteFill style={{ scale: String(interpolate(frame, [0, dur], [1, 1 + push], clamp)) }}>
        {/* page background, extended to the frame edges with its own edge colours */}
        {offX > 0 ? (
          <>
            <Img src={staticFile(dir + "edge-l.png")} style={{ position: "absolute", left: 0, top: offY, width: offX + 2, height: ph, objectFit: "fill" }} />
            <Img src={staticFile(dir + "edge-r.png")} style={{ position: "absolute", left: offX + pw - 2, top: offY, width: offX + 2, height: ph, objectFit: "fill" }} />
          </>
        ) : null}
        <Img src={staticFile(dir + m.plate)} style={{ position: "absolute", left: offX, top: offY, width: pw, height: ph }} />
        {placed.map(layer)}
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Frame-space geometry of a page, for native layers that sit on top of it. */
export const pageGeometry = (page: number, width: number, height: number) => {
  const m = manifests[page];
  const s = Math.min(height / m.height, width / m.width);
  return { s, offX: (width - m.width * s) / 2, offY: (height - m.height * s) / 2 };
};
