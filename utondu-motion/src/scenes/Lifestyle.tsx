import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { clamp, colors, ease, fontFamily } from "../brand";
import { master } from "../masterArtwork";
import { H, W } from "../Wordmark";
import { MaskLine, useLayout } from "../shared";

const beats = [
  {
    img: "images/life-lounge.jpg",
    lines: ["CRAFTED FOR", "MODERN LIVING WITH", "TIMELESS ELEGANCE", "AND COMFORT."],
  },
  {
    img: "images/life-shelf.jpg",
    lines: ["WHERE THOUGHTFUL", "DESIGN MEETS", "DISTINCTIVE CHARACTER", "AND PURPOSE"],
  },
];
const BEAT = 75;

/**
 * LIFESTYLE — brand board pages 10 & 11. A chocolate text panel beside
 * interior photography, with a giant outline of the master U behind the copy.
 */
export const Lifestyle: React.FC = () => {
  const frame = useCurrentFrame();
  const { landscape, u, width, height } = useLayout();
  const panel = landscape ? { width: width / 2, height } : { width, height: height * 0.46 };
  const photo = landscape ? { width: width / 2, height } : { width, height: height * 0.54 };
  const bigU = Math.min(panel.width, panel.height) * 1.25;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.chocolate, flexDirection: landscape ? "row" : "column-reverse" }}>
      {/* text panel */}
      <div style={{ position: "relative", ...panel, overflow: "hidden" }}>
        <svg
          width={bigU}
          height={(bigU * H) / W}
          viewBox={`-6 -6 ${W + 12} ${H + 12}`}
          style={{ position: "absolute", left: (panel.width - bigU) / 2, top: -bigU * 0.12 }}
        >
          <path
            d={master.letters[0].d}
            fill="none"
            stroke={colors.whiteRock}
            strokeOpacity={0.14}
            strokeWidth={0.35}
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={interpolate(frame, [0, 70], [1, 0], { ...clamp, easing: ease.draw })}
          />
        </svg>
        {beats.map((b, bi) => {
          const s = bi * BEAT;
          const out = bi === 0 ? interpolate(frame, [BEAT - 8, BEAT + 6], [1, 0], { ...clamp, easing: ease.exit }) : 1;
          return (
            <AbsoluteFill
              key={bi}
              style={{
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
                fontFamily,
                fontWeight: 300,
                fontSize: (landscape ? 46 : 52) * u,
                lineHeight: 1.3,
                letterSpacing: "0.04em",
                color: colors.whiteRock,
                opacity: out,
              }}
            >
              {b.lines.map((l, i) => (
                <MaskLine key={i} start={s + 6 + i * 4}>
                  {l}
                </MaskLine>
              ))}
            </AbsoluteFill>
          );
        })}
      </div>
      {/* photo panel: second photo wipes up over the first */}
      <div style={{ position: "relative", ...photo, overflow: "hidden" }}>
        {beats.map((b, bi) => {
          const s = bi * BEAT;
          return (
            <Img
              key={bi}
              src={staticFile(b.img)}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                clipPath:
                  bi === 0
                    ? undefined
                    : `inset(${interpolate(frame, [s - 4, s + 18], [100, 0], { ...clamp, easing: ease.glide })}% 0 0 0)`,
                scale: interpolate(frame, [s - 4, s + BEAT + 10], [1.1, 1.0], { ...clamp, easing: ease.settle }),
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
