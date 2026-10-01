#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT/assets/onboarding/kareta_logo_icon.png"
DEST="$ROOT/ios/KaretaIOS/Assets.xcassets/AppIcon.appiconset"

if [[ ! -f "$SOURCE" ]]; then
  echo "Canonical KARETA icon not found: $SOURCE" >&2
  exit 1
fi

mkdir -p "$DEST"

WIDTH="$(sips -g pixelWidth "$SOURCE" | awk '/pixelWidth:/ {print $2}')"
HEIGHT="$(sips -g pixelHeight "$SOURCE" | awk '/pixelHeight:/ {print $2}')"
ALPHA="$(sips -g hasAlpha "$SOURCE" 2>/dev/null | awk '/hasAlpha:/ {print $2}' || true)"

if [[ -z "$WIDTH" || -z "$HEIGHT" ]]; then
  echo "Unable to inspect canonical KARETA icon" >&2
  exit 1
fi

if [[ "$WIDTH" != "$HEIGHT" ]]; then
  echo "Canonical KARETA icon must be square, got ${WIDTH}x${HEIGHT}" >&2
  exit 1
fi

echo "Canonical KARETA icon: ${WIDTH}x${HEIGHT}, hasAlpha=${ALPHA:-unknown}"

resize() {
  local size="$1"
  local output="$2"
  sips -z "$size" "$size" "$SOURCE" --out "$DEST/$output" >/dev/null
}

resize 40 "AppIcon-20@2x.png"
resize 60 "AppIcon-20@3x.png"
resize 58 "AppIcon-29@2x.png"
resize 87 "AppIcon-29@3x.png"
resize 80 "AppIcon-40@2x.png"
resize 120 "AppIcon-40@3x.png"
resize 120 "AppIcon-60@2x.png"
resize 180 "AppIcon-60@3x.png"
resize 1024 "AppIcon-1024.png"

echo "Generated KARETA iPhone AppIcon set from canonical repository asset."
