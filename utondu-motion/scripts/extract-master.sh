#!/usr/bin/env bash
# Regenerates everything taken from the brand PDF:
#   src/masterArtwork.ts       wordmark + tagline outlines (page 2, master lockup)
#   src/bigU.ts                oversized U overlay (page 10)
#   public/images/palette-*.png  page 8 product cut-outs with their shadows
# Needs poppler-utils (pdftocairo, pdfimages), python3 with Pillow and numpy.
set -euo pipefail
cd "$(dirname "$0")/.."
PDF="${1:-Utondu Brand identify for motion.pdf}"
TMP="$(mktemp -d)"
pdftocairo -svg -f 2 -l 2 "$PDF" "$TMP/page2.svg"
python3 -I scripts/extract_outlines.py "$TMP/page2.svg" > "$TMP/outlines.json"
python3 -I scripts/gen_master_artwork.py "$TMP/outlines.json" > src/masterArtwork.ts
pdftocairo -svg -f 10 -l 10 "$PDF" "$TMP/page10.svg"
python3 -I scripts/gen_big_u.py "$TMP/page10.svg" > src/bigU.ts
mkdir -p "$TMP/img"
# whole document, so image numbers match the names the scripts expect
pdfimages -png -j -p "$PDF" "$TMP/img/im"
python3 -I scripts/clean_tables_photo.py "$TMP/img"
python3 -I scripts/build_palette_cards.py "$TMP/img" public/images
rm -rf "$TMP"
echo "Regenerated master artwork, big U and palette cards"
