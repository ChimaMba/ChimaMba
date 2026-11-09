# UTONDU — Motion Identity

Motion design for the UTONDU brand identity ("The Comfort of Life"), built in [Remotion](https://remotion.dev) so every frame is editable code driven by the brand's own geometry, colours and timing tokens.

## Deliverables (`renders/`)

| File | Format | Length | Notes |
|---|---|---|---|
| `UTONDU_LogoSting.mp4` | 1920×1080 · 30fps | 7s | Cream ground, chocolate wordmark |
| `UTONDU_LogoStingDark.mp4` | 1920×1080 · 30fps | 7s | Chocolate ground, White Rock wordmark |
| `UTONDU_Sizzle.mp4` | 1920×1080 · 30fps | 38s | Sting → Statement → Construction → Colour → Type → Lifestyle → Product → Applications → End card |
| `UTONDU_SocialVertical.mp4` | 1080×1920 · 30fps | 20s | Reels / TikTok / Stories cutdown |
| `UTONDU_SocialSquare.mp4` | 1080×1080 · 30fps | 20s | Feed / LinkedIn cutdown |

Motion guidelines: `motion-guidelines.html` (open in a browser — live demos of the build, easing curves and transitions).

All videos are silent so they can be cut to any track. Stings end on a ≥ 2s hold of the master lockup for a clean out-point.

## Creative direction

**"One module, turned."** The UTONDU wordmark is a constructed monoline: the *n* is the *U* turned upside-down. The sting draws every letter as a single stroke, left to right, with the fourth letter drawn as a U and then turned over into the n — the brand's construction becomes its signature moment.

Motion follows the brand line *The Comfort of Life*: a confident start that eases into a long, soft settle. No bounce, no overshoot, no hard cuts. Transitions borrow the O's rounded geometry (**O-iris**) or rise like an upholstered panel (**Lift**).

## Brand source

Everything comes from `Utondu Brand identify for motion.pdf` (the brand board, exported from Figma):

- **Wordmark and tagline are the master artwork.** The outlines are extracted from page 2 of the PDF into `src/masterArtwork.ts`. `./scripts/extract-master.sh` regenerates every PDF-derived asset (wordmark, tagline, big U, palette cards) byte for byte. Animated stroke masks reveal the artwork, so every finished frame is the approved master exactly. The *n* is the master *U* turned 180°; the master *n* crossfades in over the last 10% of the turn.
- Colours: Chocolate Brown `#372922`, White Rock `#E7DBCF`, Foggy Grey `#E4E0DA`, cover cream `#F2EDE7` (`src/brand.ts`).
- **Colour page (page 8)** is rebuilt in the PDF's own coordinates: the three cards with their products and shadows (`public/images/palette-*.png`, composited from the PDF's image layers), label bands, title and COMFORT · LIVING · ENJOY footer.
- **Big U (pages 10–11)** is the PDF's oversized master U at 10% white (`src/bigU.ts`), overlaying panel and photo. It draws itself in, then stays fixed while the panel glides across, so page 10 becomes page 11 underneath it.
- Imagery (`public/images/`): cover sofa, statement chair, interior photography (pages 10–11) and the tote, business-card, billboard and lightbox mockups (pages 13–18).
- Copy: "THE COMFORT OF LIFE", "YOUR SPACE, YOUR STORY.", "WARMTH · BALANCE · AND TIMELESS", "CRAFTED FOR MODERN LIVING WITH TIMELESS ELEGANCE AND COMFORT.", "WHERE THOUGHTFUL DESIGN MEETS DISTINCTIVE CHARACTER AND PURPOSE", "COMFORT · LIVING · DESIGN".

Third-party marks in the source photos are removed: the "RSAKA" text on the cover photo is cropped out, the "BC" lettering in the coffee-table photo is erased from its alpha mask (`scripts/clean_tables_photo.py`), and the "Redefining Comfort" image is not used.

### Before final delivery

1. **Typeface** — supporting type uses Inter as a stand-in for Suisse Intl (commercial). The wordmark and tagline are already the real artwork. Put licensed Suisse Intl Thin/Light/Regular `.woff2` files in `public/fonts/` and update `fontFiles` in `src/fonts.ts`.

## Working on it

```bash
npm i
npm run dev            # Remotion Studio — scrub, tweak timings, preview every composition
npx remotion render Sizzle renders/UTONDU_Sizzle.mp4 --codec=h264 --crf=18
```

Compositions: `Deliverables/` (LogoSting, LogoStingDark, Sizzle, SocialVertical, SocialSquare) and `Scenes/` (each sizzle scene on its own timeline). Scenes re-flow automatically for 16:9, 9:16 and 1:1.

| Path | What |
|---|---|
| `src/brand.ts` | Colour, easing and timing tokens |
| `src/Wordmark.tsx` | Master wordmark + tagline with per-letter draw, turn and tracking |
| `src/masterArtwork.ts`, `src/bigU.ts` | Wordmark, tagline and big-U outlines extracted from the brand PDF |
| `scripts/` | PDF extraction pipeline (`extract-master.sh`) |
| `src/transitions.tsx` | O-iris and Lift scene transitions |
| `src/scenes/*` | LogoSting, Statement, Construction, Palette, Typography, Lifestyle, Product, Applications, EndCard |
| `src/Sizzle.tsx`, `src/Social.tsx` | Edits — scene order and durations |
