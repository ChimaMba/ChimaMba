# UTONDU — Motion Identity

Motion design for the UTONDU brand identity ("The Comfort of Life"), built in [Remotion](https://remotion.dev) so every frame is editable code driven by the brand's own geometry, colours and timing tokens.

## Deliverables (`renders/`)

| File | Format | Length | Notes |
|---|---|---|---|
| `UTONDU_LogoSting.mp4` | 1920×1080 · 30fps | 7s | Cream ground, chocolate wordmark |
| `UTONDU_LogoStingDark.mp4` | 1920×1080 · 30fps | 7s | Chocolate ground, White Rock wordmark |
| `UTONDU_Sizzle.mp4` | 1920×1080 · 30fps | 29s | Sting → Statement → Construction → Colour → Type → Product → End card |
| `UTONDU_SocialVertical.mp4` | 1080×1920 · 30fps | 18s | Reels / TikTok / Stories cutdown |
| `UTONDU_SocialSquare.mp4` | 1080×1080 · 30fps | 18s | Feed / LinkedIn cutdown |

Motion guidelines: `motion-guidelines.html` (open in a browser — live demos of the build, easing curves and transitions).

All videos are silent so they can be cut to any track. Stings end on a ≥ 2s hold of the master lockup for a clean out-point.

## Creative direction

**"One module, turned."** The UTONDU wordmark is a constructed monoline: the *n* is the *U* turned upside-down. The sting draws every letter as a single stroke, left to right, with the fourth letter drawn as a U and then turned over into the n — the brand's construction becomes its signature moment.

Motion follows the brand line *The Comfort of Life*: a confident start that eases into a long, soft settle. No bounce, no overshoot, no hard cuts. Transitions borrow the O's rounded geometry (**O-iris**) or rise like an upholstered panel (**Lift**).

## Brand source

Pulled from the UTONDU brand board in Figma (page *UTONDU*):

- Wordmark rebuilt from the master artwork: letter 1.29:1, stroke 0.135H, outer radius 0.41H, flat stroke ends, square left corners on the D, clear space ½H (`src/Wordmark.tsx`).
- Colours: Chocolate Brown `#372922`, White Rock `#E7DBCF`, Foggy Grey `#E4E0DA`, cover cream `#F2EDE7` (`src/brand.ts`).
- Copy: "THE COMFORT OF LIFE", "YOUR SPACE, YOUR STORY.", "WARMTH · BALANCE · AND TIMELESS LIVING", "CRAFTED FOR LIVING", "SPACES SHAPED FOR COMFORT", "COMFORT · LIVING · DESIGN".

### Before final delivery

1. **Typeface** — the brand face is Suisse Intl (commercial). Inter is used as a stand-in. Put licensed Suisse Intl Thin/Light/Regular `.woff2` files in `public/fonts/` and update `fontFiles` in `src/fonts.ts`.
2. **Product photography** — `public/images/sofa.png` is cut from the cover page preview and is lower resolution than ideal for 1080p. Replace it with the high-res cover sofa on a `#F2EDE7` ground (same filename).
3. **Wordmark master** — the wordmark is reconstructed to the board's measurements. Overlay it against an SVG export of the master artwork once to sign it off.

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
| `src/Wordmark.tsx` | Stroke-built wordmark with per-letter draw, turn and tracking |
| `src/transitions.tsx` | O-iris and Lift scene transitions |
| `src/scenes/*` | LogoSting, Statement, Construction, Palette, Typography, Product, EndCard |
| `src/Sizzle.tsx`, `src/Social.tsx` | Edits — scene order and durations |
