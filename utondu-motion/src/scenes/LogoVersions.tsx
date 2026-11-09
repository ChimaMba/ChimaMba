import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { clamp, colors, ease } from "../brand";
import { TaglineArt, Wordmark } from "../Wordmark";
import { useLayout } from "../shared";

/**
 * LOGO VERSIONS — brand board page 3: the master lockup on the light ground and
 * the reversed (White Rock) lockup on the dark ground.
 * The light lockup draws on; the dark panel rises; the reversed lockup draws on it.
 */
const LIGHT = "#E5DBCF"; // page 3 top ground (from the PDF)
const DARK = "#4B342E"; // page 3 lower panel (from the PDF)
const SPLIT = 0.535; // panel top, share of the page height

export const VERSIONS_TIMING = { lightDraw: 4, panel: 40, darkDraw: 62, stagger: 4, draw: 26 };

export const LogoVersions: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, landscape } = useLayout();
  const T = VERSIONS_TIMING;
  const pageW = landscape ? Math.min(width, height * 1.41) : width;
  const wm = pageW * (landscape ? 445 / 1123 : 0.62);

  const lockup = (start: number, ink: string, tag: string) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Wordmark
        width={wm}
        color={ink}
        draw={[0, 1, 2, 3, 4, 5].map((i) =>
          interpolate(frame, [start + i * T.stagger, start + i * T.stagger + T.draw], [0, 1], { ...clamp, easing: ease.draw }),
        )}
        turn={interpolate(frame, [start + 28, start + 50], [0, 1], { ...clamp, easing: ease.glide })}
        tracking={interpolate(frame, [start, start + 60], [1.1, 1], { ...clamp, easing: ease.settle })}
      />
      <TaglineArt width={wm} start={start + 40} color={tag} />
    </div>
  );

  const panelTop = interpolate(frame, [T.panel, T.panel + 26], [height, height * SPLIT], { ...clamp, easing: ease.glide });

  return (
    <AbsoluteFill style={{ backgroundColor: LIGHT }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: height * SPLIT, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {lockup(T.lightDraw, colors.ink, colors.muted)}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: panelTop, height: height * (1 - SPLIT), backgroundColor: DARK, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {lockup(T.darkDraw, colors.whiteRock, "rgba(231,219,207,0.8)")}
        </div>
      </div>
    </AbsoluteFill>
  );
};
