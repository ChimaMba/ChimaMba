import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { clamp, colors, ease, fontFamily } from "../brand";
import { MaskLine, TypeOn, useLayout } from "../shared";

const weights = [
  { label: "Thin", w: 200 },
  { label: "Light", w: 300 },
  { label: "Regular", w: 400 },
];

/** TYPOGRAPHY — Suisse Intl family, weight walk (brand board, page 6). */
export const Typography: React.FC = () => {
  const frame = useCurrentFrame();
  const { landscape, u, width } = useLayout();
  const pad = (landscape ? 140 : 90) * u;
  // weight steps: Thin → Light → Regular
  const active = frame < 50 ? 0 : frame < 80 ? 1 : 2;
  const layer = (i: number) =>
    interpolate(frame, [20 + i * 30, 32 + i * 30, 50 + i * 30, 62 + i * 30], [0, 1, 1, i === 2 ? 1 : 0], { ...clamp, easing: ease.glide });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.foggyGrey,
        color: colors.chocolate,
        fontFamily,
        padding: pad,
        flexDirection: landscape ? "row" : "column",
        justifyContent: "space-between",
        alignItems: landscape ? "center" : "flex-start",
      }}
    >
      <div>
        <MaskLine start={2} style={{ fontWeight: 300, fontSize: 104 * u, letterSpacing: "-0.01em" }}>
          Suisse Intl
        </MaskLine>
        <MaskLine start={10} style={{ fontWeight: 300, fontSize: 40 * u, opacity: 0.7, marginTop: 6 * u }}>
          Family Font
        </MaskLine>
        <div style={{ marginTop: 64 * u }}>
          {weights.map((wt, i) => (
            <div
              key={wt.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24 * u,
                fontSize: 40 * u,
                fontWeight: wt.w,
                height: 64 * u,
                opacity: interpolate(frame, [14 + i * 5, 34 + i * 5], [0, active === i ? 1 : 0.4], { ...clamp, easing: ease.settle }),
              }}
            >
              <span style={{ width: 70 * u }}>Aa</span>
              <div
                style={{
                  height: Math.max(1, 1.5 * u),
                  backgroundColor: colors.chocolate,
                  width: interpolate(frame, [18 + i * 5, 50 + i * 5], [0, 220 * u], { ...clamp, easing: ease.settle }),
                }}
              />
              <span style={{ fontSize: 30 * u, fontWeight: 400 }}>{wt.label}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 48 * u, fontSize: 30 * u, lineHeight: 1.6, fontWeight: 300, letterSpacing: "0.04em" }}>
          <TypeOn text="ABCDEFGHIJKLMNOPQRSTUVWXYZ" start={40} perChar={1} />
          <br />
          <TypeOn text="abcdefghijklmnopqrstuvwxyz" start={56} perChar={1} />
          <br />
          <TypeOn text="0123456789" start={72} perChar={1} />
        </div>
      </div>
      <div
        style={{
          position: "relative",
          fontSize: landscape ? 460 * u : width * 0.5,
          lineHeight: 1,
          alignSelf: landscape ? "center" : "flex-end",
          scale: interpolate(frame, [0, 140], [1.05, 1], { ...clamp, easing: ease.settle }),
        }}
      >
        <span style={{ visibility: "hidden", fontWeight: 400 }}>Aa</span>
        {weights.map((wt, i) => (
          <span key={wt.label} style={{ position: "absolute", left: 0, top: 0, fontWeight: wt.w, opacity: layer(i) }}>
            Aa
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
