#!/usr/bin/env bash
#
# build-images.sh — image pipeline for the YUDYTSKA site.
#
# Takes the original photos from new/ (HEIC, oversized JPEG, PNG) and produces
# web-ready derivatives in assets/img/:
#
#   <slug>-640.jpg   <slug>-640.webp
#   <slug>-1280.jpg  <slug>-1280.webp
#   <slug>-1920.jpg  <slug>-1920.webp
#
# It also prints a base64 LQIP (24px blur placeholder) for every image so the
# values can be pasted into assets/js/config.js.
#
# Requires: sips (macOS built-in), cwebp (brew install webp).
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/new"
OUT="$ROOT/assets/img"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

WIDTHS=(640 1280 1920)
JPEG_QUALITY=72
WEBP_QUALITY=78

command -v sips  >/dev/null || { echo "sips not found (macOS only)" >&2; exit 1; }
command -v cwebp >/dev/null || { echo "cwebp not found — run: brew install webp" >&2; exit 1; }

mkdir -p "$OUT"

# Original filename -> slug used across the site.
# Keeping this map explicit means the markup never references IMG_1234.HEIC.
declare -a MAP=(
  "IMG_4344.PNG|hero-velvet"          # blue velvet, gold mic — main hero
  "IMG_6657.JPG|cover-idealni-vony"   # official single artwork, 3000x3000
  "IMG_7592.JPEG|duo-black-gold"      # sax duo, black + gold
  "IMG_4815.JPG|duo-daylight"
  "IMG_4803.PNG|duo-hall"
  "IMG_5870.JPG|portrait-close"       # about hero
  "IMG_4529.JPG|editorial-leather"
  "IMG_6262.JPG|editorial-street"
  "IMG_7310.JPG|live-terrace"
  "IMG_7182.JPG|live-pink"
  "IMG_7570.JPG|live-rooftop"
  "IMG_6762.JPG|live-gold-dress"
  "IMG_6204.JPG|live-piano"
  "IMG_5528.PNG|bts-metro"
  "IMG_5529.PNG|bts-monitor"
  "IMG_5553.JPG|bts-crew"
  "IMG_5383.JPG|bts-camera"
)

lqip_file="$ROOT/assets/img/lqip.txt"
: > "$lqip_file"

for entry in "${MAP[@]}"; do
  file="${entry%%|*}"
  slug="${entry##*|}"
  src="$SRC/$file"

  # The source directory mixes extensions and letter cases; resolve loosely.
  if [[ ! -f "$src" ]]; then
    src="$(find "$SRC" -maxdepth 1 -iname "${file%.*}.*" | head -1 || true)"
  fi
  if [[ -z "$src" || ! -f "$src" ]]; then
    echo "  ! missing source for $file — skipped" >&2
    continue
  fi

  echo "→ $slug"

  # Normalise to a full-size JPEG first: this is what unwraps HEIC.
  base="$TMP/$slug.jpg"
  sips -s format jpeg -s formatOptions 95 "$src" --out "$base" >/dev/null

  for w in "${WIDTHS[@]}"; do
    jpg="$OUT/$slug-$w.jpg"
    sips -Z "$w" -s format jpeg -s formatOptions "$JPEG_QUALITY" "$base" --out "$jpg" >/dev/null
    cwebp -quiet -q "$WEBP_QUALITY" "$jpg" -o "$OUT/$slug-$w.webp"
  done

  # 24px blur placeholder, inlined as a data URI.
  tiny="$TMP/$slug-tiny.jpg"
  sips -Z 24 -s format jpeg -s formatOptions 40 "$base" --out "$tiny" >/dev/null
  printf '%s: data:image/jpeg;base64,%s\n' "$slug" "$(base64 -i "$tiny" | tr -d '\n')" >> "$lqip_file"
done

echo
echo "Done. Derivatives in assets/img/, LQIP strings in assets/img/lqip.txt"
du -sh "$OUT"
