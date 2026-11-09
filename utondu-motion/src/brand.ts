import { Easing } from "remotion";

/**
 * UTONDU brand tokens — taken from the UTONDU brand identity board (Figma).
 * Colours: "UTONDU COLOURS" page. Cream is the cover-page background.
 */
export const colors = {
  chocolate: "#372922", // Chocolate Brown — primary
  whiteRock: "#E7DBCF", // White Rock
  foggyGrey: "#E4E0DA", // Foggy Grey
  cream: "#F2EDE7", // Cover page background
  ink: "#4A3A33", // wordmark brown as it renders on the cover
  muted: "#8C807A", // tagline grey-brown on light grounds
} as const;

/**
 * Brand typeface is Suisse Intl (commercial). Inter is used as a stand-in so the
 * project renders anywhere. Drop Suisse Intl .woff2 files into public/fonts and
 * change `fontFiles` in fonts.ts to swap it in — nothing else needs to change.
 */
export const fontFamily = "UtonduSans";

/**
 * Motion language — "The Comfort of Life".
 * Nothing snaps, nothing bounces. Movement settles like sinking into a cushion:
 * a quick, confident start that eases into a long, soft landing.
 */
export const ease = {
  /** Default for anything entering: long, soft settle. */
  settle: Easing.bezier(0.16, 1, 0.3, 1),
  /** Two-way moves (turns, slides between states). */
  glide: Easing.bezier(0.65, 0, 0.35, 1),
  /** Line drawing — constant-ish speed with a gentle landing. */
  draw: Easing.bezier(0.45, 0, 0.2, 1),
  /** Exits — leave quietly, never faster than they arrived. */
  exit: Easing.bezier(0.7, 0, 0.84, 0),
};

/** Timing tokens in frames @ 30fps. */
export const t = {
  beat: 6, // stagger between sibling elements
  quick: 12, // small UI-level moves
  base: 24, // standard entrance
  slow: 36, // hero entrances / line draws
  turn: 30, // the "U → n" turn
  transition: 20, // scene-to-scene
};

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const FPS = 30;
