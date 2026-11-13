#!/usr/bin/env bash
set -euo pipefail; cd "$(dirname "$0")"; OUT=${OUT:-build}; mkdir -p "$OUT"
[ -d node_modules ] || npm install
python3 audio.py "$OUT/audio.wav"
node render.mjs "$OUT/frames" 60 0 18 "${WORKERS:-3}"
ffmpeg -y -framerate 60 -i "$OUT/frames/%05d.jpg" -i "$OUT/audio.wav" -map 0:v -map 1:a -c:v libx264 -preset slow -crf 16 -profile:v high -pix_fmt yuv420p -r 60 \
  -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart "$OUT/ZONA_TELEFONA_motion_1080x1920_60fps.mp4"
