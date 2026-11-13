#!/usr/bin/env bash
# ZONA TELEFONA v6 — full render: audio + frames + MP4 (needs local assets/, see README)
set -euo pipefail
cd "$(dirname "$0")"
OUT=${OUT:-build}; WORKERS=${WORKERS:-3}
mkdir -p "$OUT"
[ -d node_modules ] || npm install
python3 audio.py "$OUT/audio.wav"
node render.mjs "$OUT/frames" 30 0 24 "$WORKERS"
ffmpeg -y -framerate 30 -i "$OUT/frames/%05d.jpg" -i "$OUT/audio.wav" -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 16 -profile:v high -pix_fmt yuv420p -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart \
  "$OUT/ZONA_TELEFONA_v6_1080x1920_30fps.mp4"
echo "Gotovo: $OUT/"
