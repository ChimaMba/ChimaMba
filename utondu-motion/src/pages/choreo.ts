/**
 * Page choreography — pure functions (no React), shared by the PageScene renderer
 * and by scripts/export-cues.ts, which turns the same timings into sound cues.
 *
 * Every element of a decomposed brand-board page gets a motion preset and a start
 * frame. Defaults follow the brand's motion rules (settle, never bounce); pages can
 * override order, delays and exclusions.
 */
import type { PageElement, PageManifest } from "./manifests";

export type Preset =
  | "bg" // full-bleed photo: slow push-out
  | "image" // photo / cut-out: wipes up and settles
  | "panel" // large colour block: wipes in from the edge it touches
  | "letter" // wordmark letter: rises into place
  | "line" // hairline: draws from the left
  | "pop" // small mark (dot, icon): scales up
  | "text"; // text line: rises out of its own mask

export type Placed = PageElement & { preset: Preset; start: number };

export type Cue = {
  /** frame within the scene */
  frame: number;
  kind: "swoosh" | "whoosh" | "pluck" | "tick" | "pop" | "swish" | "thud";
  /** -1 (left) … 1 (right), from the element's position on the page */
  pan: number;
  /** 0 … 1, relative weight (size of the element) */
  weight: number;
};

export type PageOptions = {
  /** element ids to leave out (e.g. replaced by a native layer) */
  exclude?: string[];
  /** first frame for each group */
  at?: Partial<Record<Preset, number>>;
  /** frames between siblings */
  stagger?: Partial<Record<Preset, number>>;
  /** explicit start frames per element id (wins over everything) */
  starts?: Record<string, number>;
  /** treat these element ids as a given preset */
  as?: Record<string, Preset>;
};

const DEFAULT_AT: Record<Preset, number> = { bg: 0, panel: 2, image: 6, letter: 12, line: 18, pop: 20, text: 18 };
const DEFAULT_STAGGER: Record<Preset, number> = { bg: 0, panel: 4, image: 6, letter: 2, line: 3, pop: 3, text: 2.5 };

export function classify(e: PageElement, m: PageManifest): Preset {
  const area = (e.w * e.h) / (m.width * m.height);
  if (e.kind === "image") return e.w >= m.width * 0.95 && e.h >= m.height * 0.95 ? "bg" : "image";
  if (area > 0.12) return "panel";
  if (e.kind === "text") return "text";
  if (e.h < 4 || e.w < 4) return "line";
  const letterLike = e.h > 30 && e.h < 110 && e.w > 35 && e.w < 110;
  if (letterLike) return "letter";
  return "pop";
}

export function choreograph(m: PageManifest, o: PageOptions = {}): Placed[] {
  const at = { ...DEFAULT_AT, ...(o.at ?? {}) };
  const stagger = { ...DEFAULT_STAGGER, ...(o.stagger ?? {}) };
  const els = m.elements.filter((e) => !(o.exclude ?? []).includes(e.id));
  const withPreset = els.map((e) => ({ ...e, preset: o.as?.[e.id] ?? classify(e, m) }));

  const order: Record<Preset, (a: PageElement, b: PageElement) => number> = {
    bg: (a, b) => a.z - b.z,
    panel: (a, b) => a.z - b.z,
    image: (a, b) => a.z - b.z,
    letter: (a, b) => a.y - b.y || a.x - b.x, // rows top to bottom, then left to right
    line: (a, b) => a.y - b.y || a.x - b.x,
    pop: (a, b) => a.y - b.y || a.x - b.x,
    text: (a, b) => a.y - b.y || a.x - b.x,
  };
  const placed: Placed[] = [];
  (Object.keys(order) as Preset[]).forEach((p) => {
    const group = withPreset.filter((e) => e.preset === p).sort(order[p]);
    if (p === "letter") {
      // wordmark letters: rows start 12 frames apart, letters stagger left to right
      const rows: PageElement[][] = [];
      for (const e of group) {
        const row = rows.find((r) => Math.abs(r[0].y - e.y) <= 20);
        if (row) row.push(e);
        else rows.push([e]);
      }
      rows.forEach((row, r) =>
        row
          .sort((a, b) => a.x - b.x)
          .forEach((e, i) => placed.push({ ...e, preset: p, start: o.starts?.[e.id] ?? Math.round(at.letter + r * 12 + i * stagger.letter) })),
      );
      return;
    }
    group.forEach((e, i) => placed.push({ ...e, start: o.starts?.[e.id] ?? Math.round(at[p] + i * stagger[p]) }));
  });
  // keep the PDF's stacking order for rendering
  return placed.sort((a, b) => a.z - b.z);
}

/** Sound cues for a choreographed page (frames relative to the scene). */
export function pageCues(m: PageManifest, placed: Placed[]): Cue[] {
  const cues: Cue[] = [];
  const pan = (e: PageElement) => Math.max(-1, Math.min(1, ((e.x + e.w / 2) / m.width) * 2 - 1));
  const weight = (e: PageElement) => Math.min(1, Math.sqrt((e.w * e.h) / (m.width * m.height)) * 1.6);
  for (const e of placed) {
    switch (e.preset) {
      case "bg":
        cues.push({ frame: e.start, kind: "whoosh", pan: 0, weight: 0.6 });
        break;
      case "image":
        cues.push({ frame: e.start + 4, kind: "swoosh", pan: pan(e), weight: weight(e) });
        cues.push({ frame: e.start + 22, kind: "thud", pan: pan(e), weight: weight(e) * 0.7 });
        break;
      case "panel":
        cues.push({ frame: e.start + 2, kind: "whoosh", pan: pan(e), weight: weight(e) });
        break;
      case "letter":
        cues.push({ frame: e.start, kind: "pluck", pan: pan(e), weight: 0.5 });
        break;
      case "line":
        cues.push({ frame: e.start, kind: "swish", pan: pan(e), weight: 0.3 });
        break;
      case "pop":
        cues.push({ frame: e.start + 2, kind: "pop", pan: pan(e), weight: 0.35 });
        break;
      case "text":
        cues.push({ frame: e.start + 2, kind: "tick", pan: pan(e), weight: Math.min(0.5, 0.15 + e.w / m.width) });
        break;
    }
  }
  return thin(cues);
}

/** Avoid machine-gun repeats: merge cues of the same kind closer than 2 frames. */
function thin(cues: Cue[]): Cue[] {
  const out: Cue[] = [];
  for (const c of cues.sort((a, b) => a.frame - b.frame)) {
    const prev = [...out].reverse().find((p) => p.kind === c.kind);
    if (prev && c.frame - prev.frame < 2 && c.kind !== "pluck") {
      prev.weight = Math.min(1, prev.weight + c.weight * 0.3);
      continue;
    }
    out.push({ ...c });
  }
  return out;
}
