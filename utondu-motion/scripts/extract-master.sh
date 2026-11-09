#!/usr/bin/env bash
# Regenerates src/masterArtwork.ts from page 2 (master lockup) of the brand PDF.
# Needs poppler-utils (pdftocairo) and python3.
set -euo pipefail
cd "$(dirname "$0")/.."
PDF="${1:-Utondu Brand identify for motion.pdf}"
TMP="$(mktemp -d)"
pdftocairo -svg -f 2 -l 2 "$PDF" "$TMP/page2.svg"
python3 -I scripts/extract_outlines.py "$TMP/page2.svg" > "$TMP/outlines.json"
python3 -I scripts/gen_master_artwork.py "$TMP/outlines.json" > src/masterArtwork.ts
rm -rf "$TMP"
echo "Wrote src/masterArtwork.ts"
