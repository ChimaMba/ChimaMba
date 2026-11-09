import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors, ease, fontFamily } from "./brand";

/** Layout helper — every scene adapts to 16:9, 9:16 and 1:1. */
export const useLayout = () => {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  /** tall formats (9:16) stack content; 4:5 and 1:1 use row layouts */
  const tall = height / width > 1.5;
  const square = width === height;
  const landscape = !portrait && !square;
  const u = Math.min(width, height) / 1080; // 1 at 1080p short side
  const wordmarkWidth = landscape ? width * 0.47 : width * 0.72;
  return { width, height, portrait, tall, square, landscape, u, wordmarkWidth };
};

/** Tagline / caps line with per-character stagger and a tracking settle. */
export const Tagline: React.FC<{
  text: string;
  start: number;
  fontSize: number;
  color: string;
  weight?: number;
  stagger?: number;
  trackingFrom?: number;
  trackingTo?: number;
  style?: React.CSSProperties;
}> = ({
  text,
  start,
  fontSize,
  color,
  weight = 300,
  stagger = 1.2,
  trackingFrom = 0.45,
  trackingTo = 0.08,
  style,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily,
        fontWeight: weight,
        fontSize,
        color,
        whiteSpace: "pre",
        letterSpacing: `${interpolate(frame, [start, start + 48], [trackingFrom, trackingTo], { ...clamp, easing: ease.settle })}em`,
        ...style,
      }}
    >
      {text.split("").map((ch, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            opacity: interpolate(frame, [start + i * stagger, start + i * stagger + 18], [0, 1], { ...clamp, easing: ease.settle }),
            translate: `0 ${interpolate(frame, [start + i * stagger, start + i * stagger + 24], [0.5, 0], { ...clamp, easing: ease.settle })}em`,
          }}
        >
          {ch}
        </span>
      ))}
    </div>
  );
};

/** A line of text that rises out of a mask. */
export const MaskLine: React.FC<{
  start: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  duration?: number;
}> = ({ start, children, style, duration = 30 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ overflow: "hidden", paddingBottom: "0.08em", ...style }}>
      <div
        style={{
          translate: `0 ${interpolate(frame, [start, start + duration], [110, 0], { ...clamp, easing: ease.settle })}%`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** Soft warm light drifting across the frame — adds depth without noise. */
export const WarmLight: React.FC<{ color?: string; strength?: number }> = ({
  color = "#ffffff",
  strength = 0.35,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity: strength,
        background: `radial-gradient(60% 80% at ${interpolate(frame, [0, durationInFrames], [25, 75])}% 40%, ${color} 0%, transparent 70%)`,
      }}
    />
  );
};

/** Type-on text (used for hex codes, alphabet lines). */
export const TypeOn: React.FC<{
  text: string;
  start: number;
  perChar?: number;
  style?: React.CSSProperties;
}> = ({ text, start, perChar = 1, style }) => {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.min(text.length, Math.floor((frame - start) / perChar)));
  return (
    <span style={{ fontFamily, whiteSpace: "pre", ...style }}>
      {text.slice(0, n)}
      <span style={{ opacity: 0 }}>{text.slice(n)}</span>
    </span>
  );
};

/** COMFORT · LIVING · DESIGN footer row from the brand board. */
export const FooterRow: React.FC<{
  words?: string[];
  start: number;
  color: string;
  fontSize: number;
  style?: React.CSSProperties;
}> = ({ words = ["COMFORT", "LIVING", "DESIGN"], start, color, fontSize, style }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontFamily,
        fontWeight: 300,
        fontSize,
        letterSpacing: "0.12em",
        color,
        ...style,
      }}
    >
      {words.map((w, i) => (
        <span
          key={w}
          style={{
            opacity: interpolate(frame, [start + i * 6, start + i * 6 + 20], [0, 1], { ...clamp, easing: ease.settle }),
            translate: `0 ${interpolate(frame, [start + i * 6, start + i * 6 + 24], [12, 0], { ...clamp, easing: ease.settle })}px`,
          }}
        >
          {w}
        </span>
      ))}
    </div>
  );
};

export { colors };
