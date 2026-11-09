import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";
import { fontFamily } from "./brand";

// Swap these for Suisse Intl Thin / Light / Regular when the licensed files are available.
const fontFiles = [
  { weight: "200", file: "fonts/inter-latin-200-normal.woff2" },
  { weight: "300", file: "fonts/inter-latin-300-normal.woff2" },
  { weight: "400", file: "fonts/inter-latin-400-normal.woff2" },
];

export const fontsLoaded = Promise.all(
  fontFiles.map((f) =>
    loadFont({ family: fontFamily, url: staticFile(f.file), weight: f.weight }),
  ),
);
