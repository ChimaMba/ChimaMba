import React from "react";

/**
 * UTONDU wordmark, rebuilt as monoline strokes from the brand board.
 * Measurements (from the master artwork, letter cap-height H = 72 units):
 *   letter width 93 · pitch 104.67 · stroke 0.135H · outer corner radius 0.41H
 *   flat (butt) stroke ends · square left corners on the D.
 * The "n" is the U turned 180° — the mark is built from a single module.
 */
export const H = 72;
export const W = 93;
export const PITCH = 104.67;
export const STROKE = 9.7;
export const TOTAL = PITCH * 5 + W; // ≈ 616.4

const a = STROKE / 2;
const c = W - a;
const b = H - a;
const r = 0.41 * H - a; // centerline radius

export const paths = {
  U: `M ${a} 0 V ${b - r} A ${r} ${r} 0 0 0 ${a + r} ${b} H ${c - r} A ${r} ${r} 0 0 0 ${c} ${b - r} V 0`,
  Tbar: `M 0 ${a} H ${W}`,
  Tstem: `M ${W / 2} ${a} V ${H}`,
  O: `M ${W / 2} ${a} H ${c - r} A ${r} ${r} 0 0 1 ${c} ${a + r} V ${b - r} A ${r} ${r} 0 0 1 ${c - r} ${b} H ${a + r} A ${r} ${r} 0 0 1 ${a} ${b - r} V ${a + r} A ${r} ${r} 0 0 1 ${a + r} ${a} Z`,
  D: `M ${a} ${a} H ${c - r} A ${r} ${r} 0 0 1 ${c} ${a + r} V ${b - r} A ${r} ${r} 0 0 1 ${c - r} ${b} H ${a} Z`,
};

const sub = (p: number, from: number, to: number) =>
  Math.min(1, Math.max(0, (p - from) / (to - from)));

/** Stroke-trim helper: reveals `p` (0..1) of a path's length. */
const trim = (p: number): React.SVGProps<SVGPathElement> => {
  if (p >= 1) return {};
  if (p <= 0) return { opacity: 0 };
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
  /** Per-letter vertical offset in letter units (H = 72). */
  lift?: number[];
  style?: React.CSSProperties;
};

export const Wordmark: React.FC<WordmarkProps> = ({
  width,
  color,
  draw = [1, 1, 1, 1, 1, 1],
  turn = 1,
  tracking = 1,
  opacity = [1, 1, 1, 1, 1, 1],
  lift = [0, 0, 0, 0, 0, 0],
  style,
}) => {
  const scale = width / TOTAL;
  const x = (i: number) => TOTAL / 2 + (i - 2.5) * PITCH * tracking - W / 2;
  const common = {
    fill: "none",
    stroke: color,
    strokeWidth: STROKE,
    strokeLinecap: "butt" as const,
    strokeLinejoin: "miter" as const,
  };
  const letter = (i: number, children: React.ReactNode, rotate = 0) => (
    <g
      key={i}
      opacity={opacity[i]}
      transform={`translate(${x(i)} ${lift[i]}) rotate(${rotate} ${W / 2} ${H / 2})`}
    >
      {children}
    </g>
  );
  return (
    <svg
      width={width}
      height={H * scale}
      viewBox={`0 0 ${TOTAL} ${H}`}
      overflow="visible"
      style={style}
    >
      {letter(0, <path d={paths.U} {...common} {...trim(draw[0])} />)}
      {letter(
        1,
        <>
          <path d={paths.Tbar} {...common} {...trim(sub(draw[1], 0, 0.55))} />
          <path d={paths.Tstem} {...common} {...trim(sub(draw[1], 0.45, 1))} />
        </>,
      )}
      {letter(2, <path d={paths.O} {...common} {...trim(draw[2])} />)}
      {letter(3, <path d={paths.U} {...common} {...trim(draw[3])} />, 180 * turn)}
      {letter(4, <path d={paths.D} {...common} {...trim(draw[4])} />)}
      {letter(5, <path d={paths.U} {...common} {...trim(draw[5])} />)}
    </svg>
  );
};
