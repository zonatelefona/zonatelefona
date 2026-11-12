#!/usr/bin/env bash
# ZONA TELEFONA — reklama: kompletan render (kadrovi + zvuk + MP4) jednom komandom.
# Potrebno: Node 18+, Python 3 + numpy, ffmpeg, Playwright (Chromium).
set -euo pipefail
cd "$(dirname "$0")"
OUT=${OUT:-build}
WORKERS=${WORKERS:-4}
mkdir -p "$OUT"
[ -d node_modules ] || npm install
python3 audio.py "$OUT/audio.wav"
node render.mjs "$OUT/frames" 60 0 26 "$WORKERS"

# 30 fps sa prirodnim motion blur-om (blend 2 podkadra od 60 fps)
ffmpeg -y -framerate 60 -i "$OUT/frames/%05d.jpg" -i "$OUT/audio.wav" \
  -filter_complex "[0:v]tmix=frames=2:weights='1 1',select='not(mod(n\,2))',setpts=N/(30*TB),format=yuv420p[v]" \
  -map "[v]" -map 1:a -r 30 -c:v libx264 -preset slow -crf 14 -profile:v high -pix_fmt yuv420p \
  -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart "$OUT/ZONA_TELEFONA_reklama_1080x1920_30fps.mp4"

# 60 fps verzija
ffmpeg -y -framerate 60 -i "$OUT/frames/%05d.jpg" -i "$OUT/audio.wav" \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 14 -profile:v high -pix_fmt yuv420p \
  -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart "$OUT/ZONA_TELEFONA_reklama_1080x1920_60fps.mp4"
echo "Gotovo: $OUT/"
