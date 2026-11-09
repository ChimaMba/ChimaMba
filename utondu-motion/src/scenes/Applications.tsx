import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { clamp, colors, ease } from "../brand";
import { Wordmark } from "../Wordmark";
import { FooterRow, useLayout } from "../shared";

const shots = [
  "images/mockup-tote.jpg",
  "images/mockup-cards.jpg",
  "images/mockup-billboard.jpg",
  "images/mockup-lightbox.jpg",
];
/** One shot every two beats at 90 BPM (20 frames per beat). */
export const SHOT = 40;
const WIPE = 10; // half-length of the wipe; each wipe is centred on its beat

/**
 * APPLICATIONS — the identity in the world (brand board pages 13–18).
 * 16:9: full-bleed mockups. 9:16 / 1:1: the mockups sit as rounded 4:3 plates
 * (nothing is cropped away), framed by the master wordmark and the footer row.
 */
export const Applications: React.FC = () => {
  const frame = useCurrentFrame();
  const { landscape, portrait, u, width, height } = useLayout();
  const pad = 70 * u;
  const plateW = width - pad * 2;
  const plateH = (plateW * 3) / 4;

  const plates = shots.map((src, i) => {
    const start = i * SHOT;
    return (
      <Img
        key={src}
        src={staticFile(src)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          clipPath:
            i === 0
              ? undefined
              : `inset(${interpolate(frame, [start - WIPE, start + WIPE], [100, 0], { ...clamp, easing: ease.glide })}% 0 0 0)`,
          scale: String(interpolate(frame, [start - WIPE, start + SHOT + 20], [1.08, 1.0], { ...clamp, easing: ease.settle })),
        }}
      />
    );
  });

  if (landscape) {
    return <AbsoluteFill style={{ backgroundColor: colors.chocolate }}>{plates}</AbsoluteFill>;
  }

  // Portrait and square: plate centred, brand furniture above and below.
  const plateTop = (height - plateH) / 2;
  const wmW = width * (portrait ? 0.42 : 0.3);
  return (
    <AbsoluteFill style={{ backgroundColor: colors.chocolate }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: portrait ? plateTop * 0.5 : plateTop * 0.5,
          translate: "0 -50%",
          display: "flex",
          justifyContent: "center",
          opacity: interpolate(frame, [0, 20], [0, 1], { ...clamp, easing: ease.settle }),
        }}
      >
        <Wordmark width={wmW} color={colors.whiteRock} />
      </div>
      <div
        style={{
          position: "absolute",
          left: pad,
          top: plateTop,
          width: plateW,
          height: plateH,
          borderRadius: 36 * u,
          overflow: "hidden",
          translate: `0 ${interpolate(frame, [0, 24], [30 * u, 0], { ...clamp, easing: ease.settle })}px`,
        }}
      >
        {plates}
      </div>
      <FooterRow
        start={10}
        color={colors.whiteRock}
        fontSize={(portrait ? 30 : 24) * u}
        style={{
          position: "absolute",
          left: pad,
          right: pad,
          top: plateTop + plateH + (height - plateTop - plateH) / 2,
          translate: "0 -50%",
          opacity: 0.8,
        }}
      />
    </AbsoluteFill>
  );
};
