import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { clamp, colors, ease, fontFamily } from "../brand";
import { FooterRow, MaskLine, useLayout } from "../shared";

/**
 * BRAND STATEMENT — "Your space, your story." (brand board, page 16).
 * The chair rises into the gap between the words.
 */
export const Statement: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, landscape, u } = useLayout();
  const size = landscape ? 150 * u : width * 0.15;
  const pad = landscape ? 70 * u : 80 * u;
  const chairH = landscape ? height * 0.6 : height * 0.38;

  const chair = (
    <Img
      src={staticFile("images/chair.png")}
      style={{
        height: chairH,
        opacity: interpolate(frame, [6, 30], [0, 1], { ...clamp, easing: ease.settle }),
        translate: `0 ${interpolate(frame, [6, 44], [80 * u, 0], { ...clamp, easing: ease.settle })}px`,
        rotate: `${interpolate(frame, [6, 60], [-4, 0], { ...clamp, easing: ease.settle })}deg`,
      }}
    />
  );
  const label = (
    <div
      style={{
        fontFamily,
        fontWeight: 400,
        fontSize: 20 * u,
        letterSpacing: "0.1em",
        lineHeight: 1.3,
        color: colors.chocolate,
        opacity: interpolate(frame, [36, 56], [0, 0.8], { ...clamp, easing: ease.settle }),
      }}
    >
      THE ART
      <br />
      OF COMFORT
    </div>
  );
  const word = { fontFamily, fontWeight: 400, fontSize: size, lineHeight: 1.05, color: colors.chocolate, letterSpacing: "-0.01em" } as const;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.whiteRock }}>
      <FooterRow
        words={["WARMTH", "BALANCE", "AND", "TIMELESS"]}
        start={20}
        color={colors.chocolate}
        fontSize={(landscape ? 22 : 30) * u}
        style={{ position: "absolute", top: pad, left: pad, right: pad }}
      />
      {landscape ? (
        <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 30 * u }}>
          <div style={word}>
            <MaskLine start={10}>YOUR</MaskLine>
            <MaskLine start={18}>YOUR</MaskLine>
          </div>
          <div style={{ position: "relative" }}>
            {chair}
            <div style={{ position: "absolute", left: "58%", bottom: "100%", marginBottom: -60 * u }}>{label}</div>
          </div>
          <div style={word}>
            <MaskLine start={14}>SPACE,</MaskLine>
            <MaskLine start={22}>STORY.</MaskLine>
          </div>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ padding: pad, justifyContent: "center", gap: 30 * u }}>
          <div style={word}>
            {["YOUR SPACE,", "YOUR STORY."].map((w, i) => (
              <MaskLine key={i} start={10 + i * 6}>
                {w}
              </MaskLine>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {label}
            {chair}
          </div>
        </AbsoluteFill>
      )}
      <FooterRow
        words={["UTONDU", "LIVING"]}
        start={36}
        color={colors.chocolate}
        fontSize={(landscape ? 22 : 30) * u}
        style={{ position: "absolute", bottom: pad, left: pad, right: pad }}
      />
    </AbsoluteFill>
  );
};
