import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { clamp, colors, ease, fontFamily } from "../brand";
import { TypeOn, useLayout } from "../shared";

const swatches = [
  { name: "White Rock", hex: "#E7DBCF", bg: colors.whiteRock, fg: colors.chocolate },
  { name: "Chocolate Brown", hex: "#372922", bg: colors.chocolate, fg: colors.whiteRock },
  { name: "Foggy Grey", hex: "#E4E0DA", bg: colors.foggyGrey, fg: colors.chocolate },
];

/** COLOUR — three panels rise in sequence (brand board, page 8). */
export const Palette: React.FC = () => {
  const frame = useCurrentFrame();
  const { landscape, u } = useLayout();
  const pad = (landscape ? 72 : 80) * u;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.cream, flexDirection: landscape ? "row" : "column" }}>
      {swatches.map((s, i) => {
        const start = i * 6;
        const p = interpolate(frame, [start, start + 34], [0, 1], { ...clamp, easing: ease.settle });
        return (
          <div
            key={s.name}
            style={{
              flexBasis: 0,
              position: "relative",
              backgroundColor: s.bg,
              translate: landscape ? `0 ${(1 - p) * 100}%` : `${(1 - p) * 100}% 0`,
              // slow breathing of the active panel width
              flexGrow: interpolate(frame, [70 + i * 14, 92 + i * 14, 110 + i * 14], [1, 1.18, 1], { ...clamp, easing: ease.glide }),
              color: s.fg,
              fontFamily,
              overflow: "hidden",
            }}
          >
            {i === 0 ? (
              <div
                style={{
                  position: "absolute",
                  top: pad,
                  left: pad,
                  fontWeight: 400,
                  fontSize: 40 * u,
                  lineHeight: 1.1,
                  letterSpacing: "0.02em",
                  opacity: interpolate(frame, [24, 44], [0, 1], { ...clamp, easing: ease.settle }),
                }}
              >
                UTONDU
                <br />
                COLOURS
              </div>
            ) : null}
            <div style={{ position: "absolute", left: pad, bottom: pad }}>
              <div
                style={{
                  fontWeight: 300,
                  fontSize: (landscape ? 52 : 56) * u,
                  opacity: interpolate(frame, [start + 18, start + 38], [0, 1], { ...clamp, easing: ease.settle }),
                  translate: `0 ${interpolate(frame, [start + 18, start + 42], [20, 0], { ...clamp, easing: ease.settle })}px`,
                }}
              >
                {s.name}
              </div>
              <TypeOn
                text={s.hex}
                start={start + 30}
                perChar={2}
                style={{ fontWeight: 200, fontSize: (landscape ? 40 : 44) * u, letterSpacing: "0.1em", opacity: 0.8 }}
              />
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
