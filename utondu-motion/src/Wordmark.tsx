import React, { useId } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { clamp, ease } from "./brand";
import { master } from "./masterArtwork";

/**
 * UTONDU wordmark — the approved master artwork (from the brand PDF), revealed
 * by animated stroke masks. Every finished frame is the master artwork exactly;
 * the masks only control *how much* of each letter is visible while it draws.
 *
 * Master metrics (PDF points): cap height 72.2 · letter 92.9 wide · pitch 104.6
 * stroke ≈ 10.3 · the "n" is the "U" turned 180°.
 */
export const H = master.H;
export const W = master.LETTER_W;
export const PITCH = master.PITCH;
export const TOTAL = master.TOTAL;

// --- Reveal guides: centerlines that follow each letter's construction ---
const a = 5.17; // half the master stroke
const c = W - a;
const top = 0.39;
const b = 72.03 - a;
const r = 28; // centerline corner radius (outer radius ≈ 0.46H on the master)
const MASK_STROKE = 20; // wide enough to cover the master fill, narrow enough to keep a crisp draw head

const guides = {
  U: [`M ${a} ${top} V ${b - r} A ${r} ${r} 0 0 0 ${a + r} ${b} H ${c - r} A ${r} ${r} 0 0 0 ${c} ${b - r} V ${top}`],
  T: [`M -4 ${top + a} H ${W + 4}`, `M ${W / 2} ${top + a} V ${H + 2}`],
  // the n-slot reuses the U guide (it is drawn in U-space, then turned)
  O: [`M ${W / 2} ${top + a} H ${c - r} A ${r} ${r} 0 0 1 ${c} ${top + a + r} V ${b - r} A ${r} ${r} 0 0 1 ${c - r} ${b} H ${a + r} A ${r} ${r} 0 0 1 ${a} ${b - r} V ${top + a + r} A ${r} ${r} 0 0 1 ${a + r} ${top + a} Z`],
  D: [`M ${a} ${top + a} H ${c - r} A ${r} ${r} 0 0 1 ${c} ${top + a + r} V ${b - r} A ${r} ${r} 0 0 1 ${c - r} ${b} H ${a} Z`],
};
const guideFor = ["U", "T", "O", "U", "D", "U"] as const;

const sub = (p: number, from: number, to: number) =>
  Math.min(1, Math.max(0, (p - from) / (to - from)));

const trim = (p: number): React.SVGProps<SVGPathElement> => {
  if (p >= 1) return {};
  return { pathLength: 1, strokeDasharray: "1 1", strokeDashoffset: 1 - p };
};

export type WordmarkProps = {
  /** Rendered width in px of the wordmark at tracking = 1. */
  width: number;
  color: string;
  /** Draw progress per letter, U T O n D U. Defaults to fully drawn. */
  draw?: number[];
  /** 0 = the 4th letter is an upright U, 1 = turned into the "n". */
  turn?: number;
  /** Letter-spacing multiplier, 1 = master artwork spacing. */
  tracking?: number;
  /** Per-letter opacity, U T O n D U. */
  opacity?: number[];
  style?: React.CSSProperties;
};

export const Wordmark: React.FC<WordmarkProps> = ({
  width,
  color,
  draw = [1, 1, 1, 1, 1, 1],
  turn = 1,
  tracking = 1,
  opacity = [1, 1, 1, 1, 1, 1],
  style,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const scale = width / TOTAL;
  const x = (i: number) => TOTAL / 2 + (i - 2.5) * PITCH * tracking - W / 2;

  const letter = (i: number) => {
    const p = draw[i];
    if (p <= 0) return null;
    // The n-slot works in U-space: the master U turns 180°, and over the last
    // 10% of the turn the master n (which is the U turned, ±1px) crossfades in.
    const isN = i === 3;
    const k = isN ? sub(turn, 0.9, 1) : 1;
    const maskId = `wm-${uid}-${i}`;
    const parts = guides[guideFor[i]];
    const layers = isN ? (
      <>
        {k < 1 ? <path d={master.letters[0].d} fillRule={master.letters[0].rule} fill={color} opacity={1 - k} /> : null}
        {k > 0 ? (
          <path
            d={master.letters[3].d}
            fillRule={master.letters[3].rule}
            fill={color}
            opacity={k}
            transform={`rotate(180 ${W / 2} ${H / 2})`}
          />
        ) : null}
      </>
    ) : (
      <path d={master.letters[i].d} fillRule={master.letters[i].rule} fill={color} />
    );
    return (
      <g
        key={i}
        opacity={opacity[i]}
        transform={`translate(${x(i)} 0) rotate(${isN ? 180 * turn : 0} ${W / 2} ${H / 2})`}
      >
        {p < 1 ? (
          <mask id={maskId} maskUnits="userSpaceOnUse" x={-20} y={-20} width={W + 40} height={H + 40}>
            {parts.map((d, j) => {
              const pp = parts.length === 1 ? p : j === 0 ? sub(p, 0, 0.55) : sub(p, 0.45, 1);
              return pp > 0 ? (
                <path
                  key={j}
                  d={d}
                  fill="none"
                  stroke="white"
                  strokeWidth={MASK_STROKE}
                  strokeLinecap="butt"
                  strokeLinejoin="miter"
                  {...trim(pp)}
                />
              ) : null;
            })}
          </mask>
        ) : null}
        <g mask={p < 1 ? `url(#${maskId})` : undefined}>{layers}</g>
      </g>
    );
  };

  return (
    <svg
      width={width}
      height={H * scale}
      viewBox={`0 0 ${TOTAL} ${H}`}
      overflow="visible"
      style={style}
    >
      {[0, 1, 2, 3, 4, 5].map(letter)}
    </svg>
  );
};

/**
 * "THE COMFORT OF LIFE" — the outlined master tagline (Suisse Intl, from the PDF),
 * set in the exact lockup position under the wordmark. Glyphs rise in one by one
 * while the tracking closes to the master spacing.
 */
export const TaglineArt: React.FC<{
  /** Same width as the Wordmark it sits under. */
  width: number;
  color: string;
  start: number;
  stagger?: number;
  /** Extra space between glyphs at the start, in master units. */
  trackingFrom?: number;
  style?: React.CSSProperties;
}> = ({ width, color, start, stagger = 1.2, trackingFrom = 9, style }) => {
  const frame = useCurrentFrame();
  const t = master.tagline;
  const scale = width / TOTAL;
  const n = t.glyphs.length;
  const extra = interpolate(frame, [start, start + 48], [trackingFrom, 0], { ...clamp, easing: ease.settle });
  return (
    <svg
      width={width}
      height={t.height * scale}
      viewBox={`0 0 ${TOTAL} ${t.height}`}
      overflow="visible"
      style={{ marginTop: t.gap * scale, ...style }}
    >
      {t.glyphs.map((g, i) => {
        const s = start + i * stagger;
        return (
          <path
            key={i}
            d={g.d}
            fill={color}
            opacity={interpolate(frame, [s, s + 18], [0, 1], { ...clamp, easing: ease.settle })}
            transform={`translate(${g.x + (i - (n - 1) / 2) * extra} ${interpolate(frame, [s, s + 24], [t.height * 0.5, 0], { ...clamp, easing: ease.settle })})`}
          />
        );
      })}
    </svg>
  );
};
