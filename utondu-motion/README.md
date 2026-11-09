# UTONDU — Motion Identity

Motion design for the UTONDU brand identity ("The Comfort of Life"), built in [Remotion](https://remotion.dev). Every frame is driven by the brand board itself (`Utondu Brand identify for motion.pdf`): its master artwork, its colours, its layouts and its photography.

## Deliverables (`renders/`)

| File | Format | Length | What it is |
|---|---|---|---|
| `UTONDU_BrandFilm.mp4` | 1920×1080 · 30fps | 70.7s | All 18 pages of the brand board, in order, with score and motion sound |
| `UTONDU_LogoSting.mp4` | 1920×1080 · 30fps | 7s | Logo build on the light ground |
| `UTONDU_LogoStingDark.mp4` | 1920×1080 · 30fps | 7s | Logo build on the dark ground (Chocolate Brown, White Rock wordmark) |
| `UTONDU_SocialVertical.mp4` | 1080×1920 · 30fps | 24.7s | Reels / TikTok / Stories cut |
| `UTONDU_SocialSquare.mp4` | 1080×1080 · 30fps | 24.7s | Feed / LinkedIn cut |
| `audio/UTONDU_*_music.wav`, `audio/UTONDU_*_sfx.wav` | 48 kHz WAV | | Music and motion-sound stems; music + sfx = the final mix |

Mixes are at −16 LUFS integrated, peaks below −1.5 dBFS, AAC 320 kbps in the MP4s. Motion guidelines: `motion-guidelines.html`.

### The brand film, scene by scene

| # | Board page | Scene |
|---|---|---|
| 1 | — | Logo sting: the master wordmark draws on letter by letter; the 4th letter, drawn as a U, turns into the n |
| 2 | p1 Cover | One continuous shot from the sting: the lockup glides to its page-1 position as the sofa rises in |
| 3 | p2 Clear space | ½H clear-space system; the n turns back into a U and over again |
| 4 | p3 Light and dark | The lockup draws on the light ground, the dark panel rises, the White Rock lockup draws on it |
| 5 | p4 The UTONDU Experience | Page layers animate in |
| 6 | p5 Wordmark | Page layers animate in |
| 7 | p6 Typography | Page layers animate in |
| 8 | p8 Colours | Three cards wipe up with their products, label bands unfold, codes type on |
| 9 | p7 Crafted for living | Page layers animate in |
| 10 | p9 Designed for the way you live | Page layers animate in |
| 11 | p10 → p11 Lifestyle | The big master U draws in over panel and photo, then holds while the panel glides across |
| 12 | p12 Vertical lockup | Page layers animate in |
| 13 | p16 Your space, your story | Chair rises between the words |
| 14–18 | p13, p14, p15, p17, p18 | Tote, business cards, brochure, billboard, lightbox |
| 19 | — | End card |

## How it works

### Brand board → animatable layers
`scripts/decompose_pages.py` splits every PDF page into `public/pages/pNN/`: a background **plate**, and one transparent PNG per **element** (each text line, each wordmark letter, each panel, line, dot and photo), plus a manifest in PDF coordinates and stacking order.

- Text in this PDF is drawn as vector outlines, so text lines and graphics are re-drawn alone from their own path data, which gives exact, anti-aliased layers in the board's real typeface.
- Each photo is rendered alone (all other images deleted), keeping its own transparency and clipping.
- Plates are drawn from the background shapes only, so no element can leave a trace.
- `scripts/verify_pages.py` rebuilds every page from its layers and compares it with the PDF: 42–60 dB PSNR on every page used in the film.
- Third-party marks in source photos stay hidden: the "RSAKA" mark on the cover photo under the board's own cream patch, the "BC" lettering erased from the coffee-table photo, the monogram on the page-12 photo under its panel.

`src/pages/choreo.ts` gives every element a motion preset (photos wipe up and settle, panels wipe from the edge they touch, wordmark letters rise left to right, lines draw, dots pop, text lines rise out of their own masks) and a start frame; `src/scenes/PageScene.tsx` renders it, fitted to 16:9 with the page background extended to the frame edges.

### One timeline for picture and sound
`src/timeline.ts` is the single source of truth: every edit (film, social, sting), every scene length and transition, and the sound cue for every animated element.

- 90 BPM at 30 fps: one beat is exactly 20 frames, which is also one transition. Every scene length is a whole number of beats, so every cut lands on the beat.
- `scripts/export-cues.ts` exports each edit's scenes, transitions and cues to `public/audio/timeline-*.json`.
- `scripts/score.py` composes against those files, so the sound cannot drift from the picture.

### Music and motion sound
Original, composed in code; nothing to license.

- **Music** (key of D): intro under the logo; the groove from the first page; a second progression (Gmaj9 · A6 · F#m7 · Bm9) with a nylon-guitar melody through the identity system; the drums drop out at the lifestyle scene and return with the panel glide; a riser into the applications finale; a resolve to Dmaj9 with bells on the end card. Level automation shapes the arc (about −19 LUFS under the sting, −16 through the acts, −14.5 in the finale).
- **Motion sound**: paper ticks for text lines, tuned nylon plucks climbing the scale for wordmark letters, air swooshes for photos, felt "cushion" thuds as furniture lands, pops for dots, pen swishes for drawn lines, shimmers and tonal sweeps for the signature U moves, and a matched sound for each transition type. The music ducks up to 3 dB under busy motion sound.

## Working on it

```bash
npm i
npm run dev                          # Remotion Studio: every scene on its own timeline
```

After changing the edit or any animation timing:

```bash
npx tsx scripts/export-cues.ts       # picture timeline -> cue files
python3 -I scripts/score.py          # music + motion sound + stems (numpy, scipy, ffmpeg)
npx remotion render BrandFilm renders/UTONDU_BrandFilm.mp4 --codec=h264 --crf=18 --audio-bitrate=320k
```

After changing the brand board PDF:

```bash
python3 -I scripts/decompose_pages.py   # page layers (PyMuPDF, numpy, Pillow)
python3 -I scripts/verify_pages.py      # proves the layers rebuild the pages
./scripts/extract-master.sh             # master wordmark, tagline, big U, colour-page cut-outs
```

| Path | What |
|---|---|
| `src/timeline.ts` | The edits, scene lengths, transitions and sound cues |
| `src/Film.tsx` | Renders an edit (brand film, social) with its score |
| `src/pages/` | Page manifests (generated) and the choreography engine |
| `src/scenes/` | PageScene plus native scenes: sting, cover, clear space, light/dark, colours, lifestyle, statement, applications, end card |
| `src/Wordmark.tsx`, `src/masterArtwork.ts`, `src/bigU.ts` | Master wordmark, tagline and big-U artwork from the PDF |
| `scripts/` | PDF decomposition and verification, cue export, score |

### Before final delivery
- **Typeface**: text from the board renders in the board's own Suisse Intl outlines. Text the motion system adds (a few native scene labels) uses Inter as a stand-in; put licensed Suisse Intl `.woff2` files in `public/fonts/` and update `src/fonts.ts`.
