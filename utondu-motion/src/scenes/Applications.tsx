import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { clamp, colors, ease, fontFamily } from "../brand";
import { useLayout } from "../shared";

const shots = [
  { img: "images/mockup-tote.jpg", label: "TOTE BAG" },
  { img: "images/mockup-cards.jpg", label: "BUSINESS CARDS" },
  { img: "images/mockup-billboard.jpg", label: "BILLBOARD" },
  { img: "images/mockup-lightbox.jpg", label: "LIGHTBOX SIGN" },
];
const SHOT = 45;

/**
 * APPLICATIONS — the identity in the world (brand board pages 13–18).
 * Landscape: full-bleed mockups. Portrait/square: framed 4:3 plates with
 * the O's rounded corners, so nothing in the mockup gets cropped away.
 */
export const Applications: React.FC = () => {
  const frame = useCurrentFrame();
  const { landscape, u, width } = useLayout();
  const pad = (landscape ? 90 : 70) * u;
  const plateW = width - pad * 2;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.chocolate, justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          position: "relative",
          width: landscape ? "100%" : plateW,
          height: landscape ? "100%" : (plateW * 3) / 4,
          borderRadius: landscape ? 0 : 36 * u,
          overflow: "hidden",
        }}
      >
        {shots.map((s, i) => {
          const start = i * SHOT;
          return (
            <Img
              key={s.img}
              src={staticFile(s.img)}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                clipPath:
                  i === 0
                    ? undefined
                    : `inset(${interpolate(frame, [start - 6, start + 14], [100, 0], { ...clamp, easing: ease.glide })}% 0 0 0)`,
                scale: interpolate(frame, [start - 6, start + SHOT + 12], [1.08, 1.0], { ...clamp, easing: ease.settle }),
              }}
            />
          );
        })}
        {landscape ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, transparent 70%, rgba(35,26,22,0.55) 100%)",
            }}
          />
        ) : null}
      </div>
      {/* label */}
      <div
        style={{
          position: "absolute",
          left: pad,
          right: pad,
          bottom: landscape ? 70 * u : 220 * u,
          display: "flex",
          justifyContent: "space-between",
          fontFamily,
          fontWeight: 300,
          fontSize: (landscape ? 28 : 36) * u,
          letterSpacing: "0.14em",
          color: colors.whiteRock,
        }}
      >
        {shots.map((s, i) => {
          const start = i * SHOT;
          const vis = interpolate(
            frame,
            [start + 4, start + 18, start + SHOT - 4, start + SHOT + 6],
            [0, 1, 1, i === shots.length - 1 ? 1 : 0],
            { ...clamp, easing: ease.settle },
          );
          return (
            <div key={s.label} style={{ position: "absolute", left: 0, right: 0, display: "flex", justifyContent: "space-between", opacity: vis }}>
              <span>{s.label}</span>
              <span style={{ opacity: 0.7 }}>{`0${i + 1} / 0${shots.length}`}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
