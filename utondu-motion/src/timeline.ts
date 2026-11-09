/**
 * The edit — single source of truth for picture AND sound.
 *
 * Film.tsx / Social.tsx render these lists; scripts/export-cues.ts turns them
 * (scene starts, transitions and every element's animation cue) into
 * public/audio/timeline-*.json, which scripts/score.py composes against.
 * Pure TypeScript: no React, no Remotion imports.
 *
 * 90 BPM at 30 fps: one beat = 20 frames = one transition. Every scene length is
 * a whole number of beats, so every cut lands on the beat.
 */
import { manifests } from "./pages/manifests";
import { choreograph, Cue, PageOptions, pageCues } from "./pages/choreo";

export const TRANSITION = 20;

export type SceneKind =
  | "sting"
  | "cover"
  | "construction"
  | "versions"
  | "page"
  | "palette"
  | "lifestyle"
  | "statement"
  | "plates"
  | "endcard";

export type Out = "lift" | "iris" | "fade" | "cut";

export type SceneSpec = {
  kind: SceneKind;
  dur: number;
  /** how this scene hands over to the next one */
  out?: Out;
  page?: number;
  opts?: PageOptions;
  label: string;
};

// ---- per-page choreography tweaks (page scenes) ----------------------------
export const PAGE_OPTS: Record<number, PageOptions> = {
  4: { at: { image: 4, text: 22 }, stagger: { text: 3 } },
  5: { at: { image: 6, text: 16 } },
  6: {
    at: { letter: 4, text: 22, image: 14, line: 30 },
    // the "Aa" specimen card (outline + fill) moves like an image
    as: Object.fromEntries(manifests[6].elements.filter((e) => e.colour === "#AB897D" || e.colour === "#F6EADE").map((e) => [e.id, "image" as const])),
  },
  7: { at: { letter: 26, pop: 14, text: 40 } },
  9: { at: { letter: 4, image: 18, text: 30 } },
  12: { at: { panel: 0, letter: 16, image: 6, text: 30 } },
  13: { at: { image: 8, text: 30, pop: 24 } },
  14: { at: { image: 4, text: 30, panel: 40 } },
  15: { at: { image: 6, text: 28 } },
  17: {},
  18: {},
};

const page = (p: number, dur: number, out: Out, label: string): SceneSpec => ({ kind: "page", page: p, dur, out, opts: PAGE_OPTS[p], label });

// ---- the brand film: every page of the board, in order ----------------------
export const FILM: SceneSpec[] = [
  { kind: "sting", dur: 160, out: "cut", label: "Logo sting" },
  { kind: "cover", dur: 140, out: "lift", label: "p1 Cover" },
  { kind: "construction", dur: 160, out: "iris", label: "p2 Clear space" },
  { kind: "versions", dur: 140, out: "lift", label: "p3 Logo on light and dark" },
  page(4, 160, "lift", "p4 The UTONDU Experience"),
  page(5, 140, "iris", "p5 Wordmark"),
  page(6, 140, "lift", "p6 Typography"),
  { kind: "palette", dur: 160, out: "iris", label: "p8 Colours" },
  page(7, 140, "lift", "p7 Crafted for living"),
  page(9, 140, "lift", "p9 Designed for the way you live"),
  { kind: "lifestyle", dur: 180, out: "iris", label: "p10–11 Lifestyle" },
  page(12, 140, "lift", "p12 Vertical lockup"),
  { kind: "statement", dur: 120, out: "iris", label: "p16 Your space, your story" },
  page(13, 80, "lift", "p13 Tote"),
  page(14, 100, "lift", "p14 Business cards"),
  page(15, 80, "lift", "p15 Brochure"),
  page(17, 80, "lift", "p17 Billboard"),
  page(18, 80, "fade", "p18 Lightbox"),
  { kind: "endcard", dur: 120, label: "End card" },
];

// ---- social cut (9:16 and 1:1) ---------------------------------------------
export const SOCIAL: SceneSpec[] = [
  { kind: "sting", dur: 140, out: "lift", label: "Logo sting" },
  { kind: "versions", dur: 120, out: "lift", label: "p3 Logo on light and dark" },
  { kind: "statement", dur: 100, out: "iris", label: "p16 Your space, your story" },
  { kind: "lifestyle", dur: 180, out: "lift", label: "p10–11 Lifestyle" },
  { kind: "plates", dur: 200, out: "fade", label: "Applications" },
  { kind: "endcard", dur: 100, label: "End card" },
];

export const STING: SceneSpec[] = [{ kind: "sting", dur: 210, label: "Logo sting" }];

export const EDITS = { film: FILM, social: SOCIAL, sting: STING };

// ---- timing --------------------------------------------------------------------
export const startsOf = (edit: SceneSpec[]) => {
  const starts: number[] = [];
  let pos = 0;
  edit.forEach((s, i) => {
    starts.push(pos);
    pos += s.dur - (i < edit.length - 1 && s.out !== "cut" ? TRANSITION : 0);
  });
  return { starts, total: pos };
};

export const durationOf = (edit: SceneSpec[]) => startsOf(edit).total;

// ---- sound cues for native scenes (frames relative to the scene) --------------
// Each list mirrors the animation timings in the matching scene component.
const letters = (start: number, step: number): Cue[] =>
  [0, 1, 2, 3, 4, 5].map((i) => ({ frame: start + i * step, kind: "pluck", pan: -0.5 + i * 0.2, weight: 0.5 }));
const ticks = (frames: number[], pan = 0, weight = 0.25): Cue[] => frames.map((f) => ({ frame: f, kind: "tick", pan, weight }));

type ExtraCue = Omit<Cue, "kind"> & { kind: Cue["kind"] | "bell" | "shimmer" | "sweep" };

export const nativeCues = (s: SceneSpec): ExtraCue[] => {
  switch (s.kind) {
    case "sting":
      return [...letters(10, 5), { frame: 60, kind: "shimmer", pan: 0, weight: 0.6 }, { frame: 90, kind: "bell", pan: 0, weight: 0.7 }, { frame: 100, kind: "shimmer", pan: 0, weight: 0.25 }];
    case "cover":
      return [{ frame: 4, kind: "whoosh", pan: 0, weight: 0.45 }, { frame: 20, kind: "swoosh", pan: 0, weight: 0.8 }, { frame: 40, kind: "thud", pan: 0, weight: 0.7 }, { frame: 40, kind: "swish", pan: -0.5, weight: 0.3 }, { frame: 43, kind: "swish", pan: -0.5, weight: 0.25 }];
    case "construction":
      return [{ frame: 4, kind: "sweep", pan: 0, weight: 0.5 }, ...[0, 1, 2, 3].map((i) => ({ frame: 26 + i * 4, kind: "pop" as const, pan: i % 2 ? 0.6 : -0.6, weight: 0.4 })), { frame: 32, kind: "tick", pan: 0, weight: 0.3 }, { frame: 92, kind: "bell", pan: 0.1, weight: 0.45 }, { frame: 134, kind: "bell", pan: 0.1, weight: 0.45 }];
    case "versions":
      return [...letters(4, 4), { frame: 50, kind: "bell", pan: 0, weight: 0.4 }, { frame: 40, kind: "whoosh", pan: 0, weight: 0.7 }, { frame: 66, kind: "thud", pan: 0, weight: 0.6 }, ...letters(62, 4), { frame: 112, kind: "bell", pan: 0, weight: 0.55 }];
    case "palette":
      return [0, 1, 2].flatMap((i): ExtraCue[] => {
        const st = 10 + i * 10;
        const pan = -0.7 + i * 0.7;
        return [
          { frame: st + 4, kind: "swoosh" as const, pan, weight: 0.6 },
          { frame: st + 30, kind: "thud" as const, pan, weight: 0.45 },
          { frame: st + 18, kind: "tick" as const, pan, weight: 0.25 },
          ...[0, 1, 2, 3, 4, 5].map((k) => ({ frame: st + 37 + Math.round(k * 1.5), kind: "tick" as const, pan, weight: 0.12 })),
        ];
      }).concat(ticks([50, 56, 62], 0, 0.2) as ExtraCue[]);
    case "lifestyle":
      return [{ frame: 4, kind: "sweep", pan: -0.3, weight: 0.8 }, ...ticks([8, 12, 16, 20], -0.4, 0.22), { frame: 80, kind: "whoosh", pan: 0, weight: 0.9 }, { frame: 108, kind: "thud", pan: 0.4, weight: 0.6 }, ...ticks([102, 106, 110, 114], 0.4, 0.22)];
    case "statement":
      return [{ frame: 8, kind: "swoosh", pan: 0, weight: 0.6 }, { frame: 42, kind: "thud", pan: 0, weight: 0.55 }, ...ticks([10, 14, 18, 22], 0, 0.35), ...ticks([20, 26, 32, 38, 36, 42], 0, 0.15)];
    case "plates":
      return [{ frame: 2, kind: "whoosh", pan: 0, weight: 0.5 }, ...[1, 2, 3, 4].flatMap((k) => [{ frame: k * 40 - 8, kind: "swoosh" as const, pan: 0, weight: 0.55 }, { frame: k * 40 + 6, kind: "thud" as const, pan: 0, weight: 0.45 }]), ...ticks([10, 16, 22], 0, 0.15)];
    case "endcard":
      return [...letters(4, 4), ...ticks([30, 34, 38], 0, 0.15), ...ticks([50, 56, 62], 0, 0.15)];
    default:
      return [];
  }
};

export const sceneCues = (s: SceneSpec): ExtraCue[] => {
  if (s.kind === "page" && s.page) {
    const m = manifests[s.page];
    return pageCues(m, choreograph(m, s.opts ?? {}));
  }
  return nativeCues(s);
};
