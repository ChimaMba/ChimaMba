/**
 * Exports each edit's timeline for the score: scene starts, transitions and every
 * animation cue (absolute frames), from the same code that renders the picture.
 * Run: npx tsx scripts/export-cues.ts   → public/audio/timeline-{film,social,sting}.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { EDITS, sceneCues, startsOf, TRANSITION } from "../src/timeline";

const out = join(__dirname, "..", "public", "audio");
mkdirSync(out, { recursive: true });

for (const [name, edit] of Object.entries(EDITS)) {
  const { starts, total } = startsOf(edit);
  const scenes = edit.map((s, i) => ({ kind: s.kind, label: s.label, page: s.page ?? null, start: starts[i], dur: s.dur, out: s.out ?? null }));
  const transitions = edit.slice(0, -1).map((s, i) => ({ frame: starts[i + 1], type: s.out ?? "lift", from: s.kind, to: edit[i + 1].kind }));
  const cues = edit
    .flatMap((s, i) => sceneCues(s).map((c) => ({ ...c, frame: starts[i] + c.frame, scene: i })))
    .filter((c) => c.frame >= 0 && c.frame < total)
    .sort((a, b) => a.frame - b.frame);
  writeFileSync(join(out, `timeline-${name}.json`), JSON.stringify({ fps: 30, transition: TRANSITION, total, scenes, transitions, cues }, null, 1));
  console.log(`${name}: ${total} frames, ${scenes.length} scenes, ${cues.length} cues`);
}
