import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { clamp, colors, ease, fontFamily } from "../brand";
import { Wordmark } from "../Wordmark";
import { FooterRow, MaskLine, useLayout } from "../shared";

/**
 * PRODUCT — "Crafted for living / Spaces shaped for comfort" (brand board, page 7).
 * Image: sofa from the cover page. Swap public/images/sofa.png for a high-res
 * product shot on a #F2EDE7 ground for final delivery.
 */
export const Product: React.FC = () => {
  const frame = useCurrentFrame();
  const { landscape, u, width } = useLayout();
  const pad = (landscape ? 110 : 80) * u;
  const sofaW = landscape ? width * 0.56 : width * 0.92;
  const side = {
    fontFamily,
    fontWeight: 300,
    fontSize: (landscape ? 32 : 40) * u,
    letterSpacing: "0.1em",
    lineHeight: 1.45,
    color: colors.chocolate,
  } as const;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.cream }}>
      {/* three-dot motif from the board */}
      <div style={{ position: "absolute", top: pad, left: pad, right: pad, display: "flex", justifyContent: "space-between" }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 20 * u,
              height: 20 * u,
              borderRadius: "50%",
              backgroundColor: colors.chocolate,
              scale: interpolate(frame, [6 + i * 6, 26 + i * 6], [0, 1], { ...clamp, easing: ease.settle }),
            }}
          />
        ))}
      </div>

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 48 * u }}>
        <Wordmark
          width={landscape ? 380 * u : 520 * u}
          color={colors.chocolate}
          draw={[0, 1, 2, 3, 4, 5].map((i) =>
            interpolate(frame, [8 + i * 4, 32 + i * 4], [0, 1], { ...clamp, easing: ease.draw }),
          )}
        />
        <Img
          src={staticFile("images/sofa.png")}
          style={{
            width: sofaW,
            opacity: interpolate(frame, [10, 40], [0, 1], { ...clamp, easing: ease.settle }),
            translate: `0 ${interpolate(frame, [10, 50], [50 * u, 0], { ...clamp, easing: ease.settle })}px`,
            scale: interpolate(frame, [10, 150], [1.06, 1.0], { ...clamp, easing: ease.settle }),
            maskImage: "radial-gradient(75% 90% at 50% 50%, #000 70%, transparent 100%)",
          }}
        />
      </AbsoluteFill>

      {landscape ? (
        <>
          <div style={{ position: "absolute", left: pad, top: "47%", ...side }}>
            <MaskLine start={30}>CRAFTED</MaskLine>
            <MaskLine start={34}>FOR LIVING</MaskLine>
          </div>
          <div style={{ position: "absolute", right: pad, top: "47%", textAlign: "right", ...side }}>
            <MaskLine start={36}>SPACES SHAPED</MaskLine>
            <MaskLine start={40}>FOR COMFORT</MaskLine>
          </div>
        </>
      ) : (
        <div style={{ position: "absolute", left: pad, right: pad, bottom: pad + 120 * u, textAlign: "center", ...side }}>
          <MaskLine start={30}>CRAFTED FOR LIVING</MaskLine>
          <MaskLine start={36}>SPACES SHAPED FOR COMFORT</MaskLine>
        </div>
      )}

      <FooterRow
        start={44}
        color={colors.chocolate}
        fontSize={(landscape ? 30 : 36) * u}
        style={{ position: "absolute", left: pad, right: pad, bottom: pad }}
      />
    </AbsoluteFill>
  );
};
