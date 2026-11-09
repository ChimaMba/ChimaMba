import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { clamp, colors, ease } from "../brand";
import { Wordmark } from "../Wordmark";
import { FooterRow, Tagline, useLayout, WarmLight } from "../shared";

/** END CARD — master lockup, quick redraw, footer. */
export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { wordmarkWidth, u, landscape } = useLayout();
  const pad = (landscape ? 110 : 90) * u;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.cream, justifyContent: "center", alignItems: "center" }}>
      <WarmLight strength={0.6} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Wordmark
        width={wordmarkWidth}
        color={colors.ink}
        draw={[0, 1, 2, 3, 4, 5].map((i) =>
          interpolate(frame, [4 + i * 4, 28 + i * 4], [0, 1], { ...clamp, easing: ease.draw }),
        )}
        tracking={interpolate(frame, [0, 60], [1.08, 1], { ...clamp, easing: ease.settle })}
      />
      <Tagline
        text="THE COMFORT OF LIFE"
        start={30}
        fontSize={wordmarkWidth * 0.046}
        color={colors.muted}
        style={{ marginTop: wordmarkWidth * 0.045 + 6 * u }}
      />
      </div>
      <FooterRow
        start={50}
        color={colors.muted}
        fontSize={(landscape ? 26 : 32) * u}
        style={{ position: "absolute", left: pad, right: pad, bottom: pad }}
      />
    </AbsoluteFill>
  );
};
