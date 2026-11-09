import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { clamp, colors, ease, t } from "../brand";
import { Wordmark } from "../Wordmark";
import { Tagline, useLayout, WarmLight } from "../shared";

export type StingProps = { theme: "light" | "dark" };

/**
 * LOGO STING — "One module, turned."
 *  0:00  cream stillness
 *  0:10  letters draw on, left → right, while the spacing gathers in
 *  ~1:20 the 4th letter (drawn as a U) turns over into the "n"
 *  ~2:00 tagline settles in, tracking closes
 *  3:00→ hold on master lockup (clean out-point for editors)
 */
export const LogoSting: React.FC<StingProps> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { wordmarkWidth, u } = useLayout();
  const dark = theme === "dark";
  const bg = dark ? colors.chocolate : colors.cream;
  const ink = dark ? colors.whiteRock : colors.ink;
  const muted = dark ? "rgba(231,219,207,0.72)" : colors.muted;

  const drawStart = 10;
  const draw = [0, 1, 2, 3, 4, 5].map((i) =>
    interpolate(frame, [drawStart + i * 7, drawStart + i * 7 + t.slow], [0, 1], { ...clamp, easing: ease.draw }),
  );
  const turnStart = 64;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, justifyContent: "center", alignItems: "center" }}>
      <WarmLight color={dark ? "#5a463c" : "#ffffff"} strength={dark ? 0.5 : 0.6} />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          scale: interpolate(frame, [0, 150], [1.035, 1], { ...clamp, easing: ease.settle }),
        }}
      >
        <Wordmark
          width={wordmarkWidth}
          color={ink}
          draw={draw}
          turn={interpolate(frame, [turnStart, turnStart + t.turn], [0, 1], { ...clamp, easing: ease.glide })}
          tracking={interpolate(frame, [0, 100], [1.16, 1], { ...clamp, easing: ease.settle })}
        />
        <Tagline
          text="THE COMFORT OF LIFE"
          start={96}
          fontSize={wordmarkWidth * 0.046}
          color={muted}
          style={{ marginTop: wordmarkWidth * 0.045 + 6 * u }}
        />
      </div>
    </AbsoluteFill>
  );
};
