import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors, ease } from "../brand";
import { master } from "../masterArtwork";
import { TaglineArt, TOTAL, Wordmark } from "../Wordmark";
import { PageScene, pageGeometry } from "./PageScene";
import { useLayout } from "../shared";
import { manifests } from "../pages/manifests";

/**
 * COVER — brand board page 1, continuing the logo sting in one shot.
 * Frame 0 is identical to the sting's last frame (lockup centred, same size);
 * the lockup then glides up and scales to its exact page-1 position while the
 * sofa rises in underneath. The page's own wordmark/tagline layers are replaced
 * by the native lockup; everything else (sofa, the cream patch that hides the
 * photo's third-party mark, the two rules) comes from the PDF layers.
 */
// page 1's own wordmark + tagline layers (dark brown, between y 220 and 350pt):
// replaced by the native lockup. Selected by position and colour, not by id, so a
// re-run of the decomposer cannot break it.
export const COVER_EXCLUDE = manifests[1].elements
  .filter((e) => e.kind !== "image" && e.colour === "#4B352C" && e.y >= 215 && e.y + e.h <= 350)
  .map((e) => e.id);

export const Cover: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { wordmarkWidth: wm0 } = useLayout();
  const g = pageGeometry(1, width, height);

  // start pose: the sting's centred lockup
  const sc0 = wm0 / TOTAL;
  const colH = master.H * sc0 + master.tagline.gap * sc0 + master.tagline.height * sc0;
  const x0 = (width - wm0) / 2;
  const y0 = (height - colH) / 2;
  // end pose: the wordmark on page 1 (first U at x 276.6, cap top y 229 in PDF points, 572.8 wide)
  const wm1 = 572.8 * g.s;
  const x1 = 276.6 * g.s + g.offX;
  const y1 = 229 * g.s + g.offY;
  const p = interpolate(frame, [4, 40], [0, 1], { ...clamp, easing: ease.glide });

  return (
    <PageScene
      page={1}
      dur={dur}
      exclude={COVER_EXCLUDE}
      at={{ image: 16, line: 40 }}
      push={0.015}
    >
      {/* the sting's warm light, fading as the page arrives */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.6 * (1 - p),
          background: "radial-gradient(60% 80% at 75% 40%, #ffffff 0%, transparent 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: wm0,
          transformOrigin: "0 0",
          translate: `${x0 + (x1 - x0) * p}px ${y0 + (y1 - y0) * p}px`,
          scale: String(1 + (wm1 / wm0 - 1) * p),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Wordmark width={wm0} color={colors.ink} />
        <TaglineArt width={wm0} start={-200} color={colors.muted} />
      </div>
    </PageScene>
  );
};
