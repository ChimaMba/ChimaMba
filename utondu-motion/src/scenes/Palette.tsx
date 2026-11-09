import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { clamp, colors, ease, fontFamily } from "../brand";
import { useLayout } from "../shared";

/**
 * UTONDU COLOURS — brand board page 8, set in motion.
 * Built in page space (1123.2 × 796.8 pt, the PDF's own coordinates) so every
 * card, product, label and footer word sits exactly where the board puts it.
 */
const PAGE_W = 1123.2;
const PAGE_H = 796.8;
const CARD = { w: 279.8, top: 279.8, band: 107.9 };

const cards = [
  { x: 71.95, img: "images/palette-sofa.png", top: "#E0D3C3", band: "#372922", ink: colors.whiteRock, name: "White Rock", code: "E7DBCF" },
  { x: 421.7, img: "images/palette-chair.png", top: "#4C352D", band: "#E0D3C3", ink: colors.chocolate, name: "Chocolate Brown", code: "372922" },
  { x: 771.45, img: "images/palette-tables.png", top: "#E4E0DA", band: "#372922", ink: colors.whiteRock, name: "Foggy Grey", code: "E4E0DA" },
];
const CARD_Y = 243.01;

export const Palette: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, landscape } = useLayout();
  // Fit the board's content area (title → footer, cards edge to edge) to the frame.
  const content = { x0: 60, x1: 1063, y0: 130, y1: 750 };
  const s = Math.min(
    (width * (landscape ? 0.86 : 0.94)) / (content.x1 - content.x0),
    (height * 0.9) / (content.y1 - content.y0),
  );
  const left = width / 2 - ((content.x0 + content.x1) / 2) * s;
  const top = height / 2 - ((content.y0 + content.y1) / 2) * s;

  const e = (f0: number, f1: number, a: number, b: number, easing = ease.settle) =>
    interpolate(frame, [f0, f1], [a, b], { ...clamp, easing });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.whiteRock }}>
      <div
        style={{
          position: "absolute",
          left,
          top,
          width: PAGE_W,
          height: PAGE_H,
          scale: String(s),
          transformOrigin: "0 0",
          fontFamily,
        }}
      >
        {/* Title */}
        <div style={{ position: "absolute", left: 75, top: 137, fontSize: 27, lineHeight: "32px", fontWeight: 500, color: colors.chocolate, letterSpacing: "0.01em" }}>
          {["UTONDU", "COLOURS"].map((w, i) => (
            <div key={w} style={{ overflow: "hidden" }}>
              <div style={{ translate: `0 ${e(2 + i * 5, 30 + i * 5, 105, 0)}%` }}>{w}</div>
            </div>
          ))}
        </div>

        {cards.map((c, i) => {
          const st = 10 + i * 10; // cards enter on eighth notes
          // continuous push-in on the product after it lands
          const push = interpolate(frame, [st + 30, 150], [1, 1.035], clamp);
          return (
            <div key={c.name} style={{ position: "absolute", left: c.x, top: CARD_Y, width: CARD.w, height: CARD.top + CARD.band }}>
              {/* colour block — wipes up */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  bottom: CARD.band,
                  backgroundColor: c.top,
                  overflow: "hidden",
                  clipPath: `inset(${e(st, st + 28, 100, 0, ease.glide)}% 0 0 0)`,
                }}
              >
                <Img
                  src={staticFile(c.img)}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    opacity: e(st + 10, st + 30, 0, 1),
                    translate: `0 ${e(st + 8, st + 46, 26, 0)}px`,
                    scale: String(e(st + 8, st + 46, 1.06, 1) * push),
                  }}
                />
              </div>
              {/* label band — unfolds downward */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: CARD.top,
                  height: CARD.band,
                  backgroundColor: c.band,
                  clipPath: `inset(0 0 ${e(st + 16, st + 40, 100, 0, ease.glide)}% 0)`,
                  color: c.ink,
                }}
              >
                {[
                  { k: "Colour:", v: c.name, y: 33 },
                  { k: "Code:", v: c.code, y: 56 },
                ].map((row, r) => (
                  <div
                    key={row.k}
                    style={{
                      position: "absolute",
                      left: 21,
                      top: row.y,
                      display: "flex",
                      alignItems: "baseline",
                      opacity: e(st + 30 + r * 4, st + 46 + r * 4, 0, 1),
                      translate: `0 ${e(st + 30 + r * 4, st + 50 + r * 4, 6, 0)}px`,
                    }}
                  >
                    <span style={{ width: 47, fontSize: 9.5, fontWeight: 400, opacity: 0.75 }}>{row.k}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 300, letterSpacing: "0.01em" }}>
                      {r === 1 ? row.v.slice(0, Math.max(0, Math.min(row.v.length, Math.floor((frame - st - 36) / 1.5)))) : row.v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Footer: COMFORT · LIVING · ENJOY */}
        {[
          { w: "COMFORT", x: 106 },
          { w: "LIVING", x: 530 },
          { w: "ENJOY", x: 958 },
        ].map((f, i) => (
          <div
            key={f.w}
            style={{
              position: "absolute",
              left: f.x,
              top: 721,
              fontSize: 19,
              fontWeight: 300,
              letterSpacing: "0.04em",
              color: colors.chocolate,
              opacity: e(50 + i * 6, 70 + i * 6, 0, 1),
              translate: `0 ${e(50 + i * 6, 74 + i * 6, 10, 0)}px`,
            }}
          >
            {f.w}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
