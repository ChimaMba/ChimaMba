import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { clamp, colors, ease, fontFamily } from "../brand";
import { H, TOTAL, Wordmark } from "../Wordmark";
import { useLayout } from "../shared";

const COPPER = "#C98463"; // clear-space markers on the brand board (page 2)

/**
 * CONSTRUCTION — the wordmark's clear-space system (brand board, page 2)
 * and the modular idea behind it: the n is a U, turned.
 */
export const Construction: React.FC = () => {
  const frame = useCurrentFrame();
  const { wordmarkWidth: wm, landscape, u } = useLayout();
  const hPx = (wm * H) / TOTAL;
  const cs = hPx * 0.5; // clear space = ½ cap height (36px @ 72px on the board)
  const boxW = wm + cs * 2;
  const boxH = hPx + cs * 2;

  const frameDraw = interpolate(frame, [4, 40], [0, 1], { ...clamp, easing: ease.draw });
  const squares = [0, 1, 2, 3].map((i) =>
    interpolate(frame, [24 + i * 4, 44 + i * 4], [0, 1], { ...clamp, easing: ease.settle }),
  );
  const focus = interpolate(frame, [52, 64, 128, 140], [0, 1, 1, 0], clamp);
  const turn = interpolate(frame, [62, 92, 104, 134], [1, 0, 0, 1], { ...clamp, easing: ease.glide });
  const dim = 1 - focus * 0.7;

  const corners = [
    [0, 0],
    [boxW - cs, 0],
    [0, boxH - cs],
    [boxW - cs, boxH - cs],
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "#140F0C", justifyContent: "center", alignItems: "center" }}>
      <div style={{ position: "relative", width: boxW, height: boxH }}>
        <svg width={boxW} height={boxH} style={{ position: "absolute", inset: 0 }} overflow="visible">
          {/* clear-space frame */}
          <rect
            x={0.5}
            y={0.5}
            width={boxW - 1}
            height={boxH - 1}
            fill={colors.chocolate}
            fillOpacity={0.9 * frameDraw}
            stroke={COPPER}
            strokeOpacity={0.6}
            strokeWidth={1.5}
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - frameDraw}
          />
          {/* inner wordmark bounds */}
          <rect
            x={cs}
            y={cs}
            width={wm}
            height={hPx}
            fill="none"
            stroke={colors.whiteRock}
            strokeOpacity={0.25 * frameDraw}
            strokeDasharray="6 6"
            strokeWidth={1}
          />
          {corners.map(([x, y], i) => (
            <g key={i} opacity={squares[i]}>
              <rect
                x={x + (cs * (1 - squares[i])) / 2}
                y={y + (cs * (1 - squares[i])) / 2}
                width={cs * squares[i]}
                height={cs * squares[i]}
                fill={COPPER}
              />
              <text
                x={x + cs / 2}
                y={y + cs / 2 + 5 * u}
                textAnchor="middle"
                fontFamily={fontFamily}
                fontSize={15 * u}
                fill={colors.chocolate}
              >
                ½H
              </text>
            </g>
          ))}
        </svg>
        <div style={{ position: "absolute", left: cs, top: cs }}>
          <Wordmark
            width={wm}
            color={colors.whiteRock}
            turn={turn}
            opacity={[dim, dim, dim, 1, dim, dim]}
          />
        </div>
        {/* annotation */}
        <div
          style={{
            position: "absolute",
            top: boxH + 48 * u,
            width: "100%",
            textAlign: "center",
            fontFamily,
            fontWeight: 300,
            fontSize: (landscape ? 34 : 40) * u,
            letterSpacing: "0.12em",
            color: COPPER,
            opacity: focus,
            translate: `0 ${interpolate(focus, [0, 1], [10, 0])}px`,
          }}
        >
          ONE MODULE · TURNED
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 110 * u,
          left: 0,
          right: 0,
          padding: `0 ${90 * u}px`,
          textAlign: "center",
          fontFamily,
          fontWeight: 300,
          fontSize: (landscape ? 30 : 29) * u,
          whiteSpace: "nowrap", // one line in every format — never an orphaned word
          lineHeight: 1.4,
          letterSpacing: "0.04em",
          color: colors.whiteRock,
          opacity: interpolate(frame, [30, 54], [0, 0.75], { ...clamp, easing: ease.settle }),
        }}
      >
        Geometric shapes · clean lines · rounded contours
      </div>
    </AbsoluteFill>
  );
};
