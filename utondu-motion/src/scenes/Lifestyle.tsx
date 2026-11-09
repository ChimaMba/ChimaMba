import React, { useId } from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { clamp, colors, ease, fontFamily } from "../brand";
import { bigU } from "../bigU";
import { useLayout } from "../shared";

/**
 * LIFESTYLE — brand board pages 10 → 11 as one continuous move.
 *
 * The oversized master U (white, 10% opacity, from the PDF) is the anchor: it
 * sits centred on the split, overlapping both the panel and the photograph,
 * exactly as on the board. It draws itself in, then holds still while the
 * panel glides across — page 10 becomes page 11 underneath it.
 */
const PANEL = "#4C352D"; // panel brown on pages 10–11 (from the PDF)
const SPLIT_PAGE = 561.2; // page-10 split line, PDF points
const U_SHIFT_P11 = -7.4; // the U sits 7.4pt further left on page 11

const beats = [
  {
    img: "images/life-lounge.jpg",
    pos: "50% 50%",
    lines: [
      "CRAFTED FOR",
      "MODERN LIVING WITH",
      "TIMELESS ELEGANCE AND",
      "COMFORT.",
    ],
  },
  {
    img: "images/life-shelf.jpg",
    pos: "50% 40%",
    lines: [
      "WHERE THOUGHTFUL",
      "DESIGN MEETS DISTINCTIVE",
      "CHARACTER AND",
      "PURPOSE",
    ],
  },
];
const SWAP = 86; // frame the panel starts to move
const SWAP_LEN = 28;

// Centerline of the big U, used to reveal it with a stroke mask (page coords).
const leg = 98.27; // stroke width of the big U
const lx = bigU.x0 + leg / 2;
const rx = bigU.x1 - leg / 2;
const by = bigU.y1 - leg / 2;
const r = 266;
const U_GUIDE = `M ${lx} ${bigU.y0 - 4} V ${by - r} A ${r} ${r} 0 0 0 ${lx + r} ${by} H ${rx - r} A ${r} ${r} 0 0 0 ${rx} ${by - r} V ${bigU.y0 - 4}`;

export const Lifestyle: React.FC = () => {
  const frame = useCurrentFrame();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { width, height, landscape, u } = useLayout();
  const e = (
    f0: number,
    f1: number,
    a: number,
    b: number,
    easing = ease.settle,
  ) => interpolate(frame, [f0, f1], [a, b], { ...clamp, easing });

  const swap = e(SWAP, SWAP + SWAP_LEN, 0, 1, ease.glide);

  // --- geometry -------------------------------------------------------------
  // 16:9 is wider than the A4 board: scale the U 11% past height-fit so it spans
  // the same share of the panel + photo as on the board (bottom curve at ~80%).
  const s = landscape
    ? (height / bigU.page.height) * 1.11
    : (width * 1.15) / (bigU.x1 - bigU.x0);
  const ts = landscape ? height / bigU.page.height : s; // type scale stays height-fit
  const uLeft = landscape
    ? width / 2 + (bigU.x0 - SPLIT_PAGE) * s + U_SHIFT_P11 * s * swap
    : width / 2 - ((bigU.x0 + bigU.x1) / 2) * s;
  const uTop = e(0, 180, 0, -14 * u, ease.glide); // slow parallax drift

  const panelSize = landscape
    ? { w: width / 2, h: height }
    : { w: width, h: height * 0.46 };
  const panelPos = landscape
    ? { x: swap * (width / 2), y: 0 }
    : { x: 0, y: (1 - swap) * (height - panelSize.h) };
  const photoA = landscape
    ? { x: width / 2, y: 0, w: width / 2, h: height }
    : { x: 0, y: 0, w: width, h: height - panelSize.h };
  const photoB = landscape
    ? { x: 0, y: 0, w: width / 2, h: height }
    : { x: 0, y: panelSize.h, w: width, h: height - panelSize.h };

  const textSize = landscape ? Math.max(31 * ts, 44 * u) : 50 * u;

  return (
    <AbsoluteFill style={{ backgroundColor: PANEL }}>
      {/* photographs */}
      {/* photo B is drawn first so photo A always sits on top of it until the panel uncovers B */}
      {[photoB, photoA].map((p, j) => {
        const i = 1 - j;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: p.w,
              height: p.h,
              overflow: "hidden",
            }}
          >
            <Img
              src={staticFile(beats[i].img)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: beats[i].pos,
                scale: String(
                  i === 0 ? e(0, 110, 1.08, 1) : e(SWAP - 6, 180, 1.12, 1),
                ),
              }}
            />
          </div>
        );
      })}

      {/* panel */}
      <div
        style={{
          position: "absolute",
          left: panelPos.x,
          top: panelPos.y,
          width: panelSize.w,
          height: panelSize.h,
          backgroundColor: PANEL,
          fontFamily,
          color: colors.whiteRock,
          boxShadow: `0 0 ${60 * u}px rgba(20,12,9,${0.35 * Math.sin(Math.PI * swap)})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: landscape ? 69 * ts : 56 * u,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: landscape ? Math.max(13 * ts, 18 * u) : 24 * u,
            fontWeight: 500,
            lineHeight: 1.15,
            letterSpacing: "0.02em",
            opacity: e(14, 34, 0, 1),
          }}
        >
          UTONDU
          <br />
          LIVING
        </div>
        {beats.map((b, bi) => {
          const st = bi === 0 ? 8 : SWAP + SWAP_LEN - 6;
          const out = bi === 0 ? e(SWAP - 8, SWAP + 8, 1, 0, ease.exit) : 1;
          return (
            <div
              key={bi}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: landscape ? "54%" : "52%",
                translate: "0 -50%",
                textAlign: "center",
                fontSize: textSize,
                fontWeight: 300,
                lineHeight: 1.3,
                letterSpacing: "0.035em",
                opacity: out,
              }}
            >
              {b.lines.map((l, i) => (
                <div
                  key={i}
                  style={{ overflow: "hidden", paddingBottom: "0.06em" }}
                >
                  <div
                    style={{
                      translate: `0 ${e(st + i * 4, st + i * 4 + 30, 110, 0)}%`,
                    }}
                  >
                    {l}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* the big master U — over everything, as on the board */}
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        overflow="visible"
      >
        <defs>
          <mask
            id={`u-${uid}`}
            maskUnits="userSpaceOnUse"
            x={-2000}
            y={-2000}
            width={6000}
            height={6000}
          >
            <path
              d={U_GUIDE}
              fill="none"
              stroke="white"
              strokeWidth={leg * 1.7}
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - e(4, 56, 0, 1, ease.draw)}
            />
          </mask>
        </defs>
        <g
          transform={`translate(${uLeft - bigU.x0 * s} ${uTop}) scale(${s})`}
          mask={`url(#u-${uid})`}
        >
          <path d={bigU.fill} fill="#ffffff" fillOpacity={bigU.opacity} />
          <path
            d={bigU.fill}
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.14}
            strokeWidth={1.1 / Math.max(s, 0.5)}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
