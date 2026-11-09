import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { clamp, colors, ease, fontFamily } from "../brand";
import { FooterRow, MaskLine, useLayout } from "../shared";

// statement chair cut-out: 454 × 705 px
const CHAIR_RATIO = 454 / 705;

/**
 * BRAND STATEMENT — "Your space, your story." (brand board, page 16).
 * Each format has its own composition with explicit zones, so the words, the
 * chair and the two word rows can never collide:
 *  16:9  YOUR | chair | SPACE,  (the board's layout)
 *  1:1   the same row, scaled to fit the square
 *  9:16  four stacked lines, chair below, label beside the chair
 */
export const Statement: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, landscape, portrait, u } = useLayout();
  const e = (f0: number, f1: number, a: number, b: number) =>
    interpolate(frame, [f0, f1], [a, b], { ...clamp, easing: ease.settle });

  const pad = (landscape ? 70 : 80) * u;
  const rowSize = (landscape ? 22 : portrait ? 30 : 24) * u;
  const word = (size: number) =>
    ({
      fontFamily,
      fontWeight: 400,
      fontSize: size,
      lineHeight: 1.05,
      color: colors.chocolate,
      letterSpacing: "-0.01em",
      whiteSpace: "nowrap",
    }) as const;

  const chair = (h: number) => (
    <Img
      src={staticFile("images/chair.png")}
      style={{
        height: h,
        width: h * CHAIR_RATIO,
        display: "block",
        opacity: e(6, 30, 0, 1),
        translate: `0 ${e(6, 44, 80 * u, 0)}px`,
        rotate: `${e(6, 60, -4, 0)}deg`,
      }}
    />
  );
  const label = (size: number) => (
    <div
      style={{
        fontFamily,
        fontWeight: 400,
        fontSize: size,
        letterSpacing: "0.1em",
        lineHeight: 1.3,
        color: colors.chocolate,
        opacity: e(36, 56, 0, 0.8),
        whiteSpace: "nowrap",
      }}
    >
      THE ART
      <br />
      OF COMFORT
    </div>
  );

  let body: React.ReactNode;
  if (portrait) {
    // zones: text block from 11% to ~49%, chair from 52% to 88%
    const size = width * 0.15;
    const chairH = height * 0.36;
    body = (
      <>
        <div
          style={{
            position: "absolute",
            left: pad,
            top: height * 0.11,
            ...word(size),
          }}
        >
          {["YOUR", "SPACE,", "YOUR", "STORY."].map((w, i) => (
            <MaskLine key={i} start={10 + i * 5}>
              {w}
            </MaskLine>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            left: (width - chairH * CHAIR_RATIO) / 2 + 60 * u,
            top: height * 0.52,
          }}
        >
          {chair(chairH)}
        </div>
        <div style={{ position: "absolute", left: pad, top: height * 0.56 }}>
          {label(22 * u)}
        </div>
      </>
    );
  } else {
    // 16:9 and 1:1 share the board's row; the square version is scaled to fit
    const size = landscape ? 150 * u : width * 0.092;
    const chairH = landscape ? height * 0.6 : height * 0.42;
    body = (
      <AbsoluteFill
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: (landscape ? 30 : 18) * u,
        }}
      >
        <div style={word(size)}>
          <MaskLine start={10}>YOUR</MaskLine>
          <MaskLine start={18}>YOUR</MaskLine>
        </div>
        <div style={{ position: "relative" }}>
          {chair(chairH)}
          <div
            style={{
              position: "absolute",
              left: "58%",
              bottom: "100%",
              marginBottom: -60 * u,
            }}
          >
            {label((landscape ? 20 : 16) * u)}
          </div>
        </div>
        <div style={word(size)}>
          <MaskLine start={14}>SPACE,</MaskLine>
          <MaskLine start={22}>STORY.</MaskLine>
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: colors.whiteRock }}>
      <FooterRow
        words={["WARMTH", "BALANCE", "AND", "TIMELESS"]}
        start={20}
        color={colors.chocolate}
        fontSize={rowSize}
        style={{ position: "absolute", top: pad, left: pad, right: pad }}
      />
      {body}
      <FooterRow
        words={["UTONDU", "LIVING"]}
        start={36}
        color={colors.chocolate}
        fontSize={rowSize}
        style={{ position: "absolute", bottom: pad, left: pad, right: pad }}
      />
    </AbsoluteFill>
  );
};
