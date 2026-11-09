import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { clamp, colors, ease, fontFamily } from "../brand";
import { FooterRow, MaskLine, useLayout, WarmLight } from "../shared";

/** BRAND STATEMENT — "Your space, your story." (brand board, page 16) */
export const Statement: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, landscape, u } = useLayout();
  const size = landscape ? 168 * u : width * 0.135;
  const pad = landscape ? 140 * u : 90 * u;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.chocolate }}>
      <WarmLight color="#5a463c" strength={0.6} />
      <AbsoluteFill
        style={{
          padding: pad,
          justifyContent: "center",
          fontFamily,
          fontWeight: 200,
          color: colors.whiteRock,
          fontSize: size,
          lineHeight: 1.02,
          letterSpacing: "-0.01em",
        }}
      >
        {landscape ? (
          <>
            <MaskLine start={4}>YOUR SPACE,</MaskLine>
            <MaskLine start={14} style={{ paddingLeft: size * 1.6 }}>
              YOUR STORY.
            </MaskLine>
          </>
        ) : (
          ["YOUR", "SPACE,", "YOUR", "STORY."].map((w, i) => (
            <MaskLine key={i} start={4 + i * 5}>
              {w}
            </MaskLine>
          ))
        )}
        <div
          style={{
            height: Math.max(1, 2 * u),
            backgroundColor: colors.whiteRock,
            opacity: 0.35,
            marginTop: 56 * u,
            width: `${interpolate(frame, [30, 70], [0, 100], { ...clamp, easing: ease.settle })}%`,
          }}
        />
        <FooterRow
          words={["WARMTH", "BALANCE", "AND TIMELESS LIVING"]}
          start={40}
          color={colors.whiteRock}
          fontSize={(landscape ? 30 : 34) * u}
          style={{ marginTop: 28 * u, opacity: 0.8 }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
