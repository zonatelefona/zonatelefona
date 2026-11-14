#!/usr/bin/env bash
# Full build: audio → 2520 frames at 120 fps → blend pairs into 60 fps (real motion blur) → MP4 with AAC.
set -euo pipefail; cd "$(dirname "$0")"; OUT=${OUT:-build}; mkdir -p "$OUT"
[ -d node_modules ] || { echo "node_modules missing (symlink to ../reklama/node_modules)"; exit 1; }
python3 audio.py "$OUT/audio.wav"
END=$(python3 -c "import json;print(json.load(open('timeline.json'))['end'])")
node render.mjs "$OUT/frames" 120 0 "$END" "${WORKERS:-3}"
ffmpeg -y -framerate 120 -i "$OUT/frames/%05d.jpg" -i "$OUT/audio.wav" -map 0:v -map 1:a \
  -vf "tmix=frames=2:weights='1 1',select='not(mod(n\,2))',setpts=N/(60*TB),format=yuv420p" -r 60 \
  -c:v libx264 -preset slow -crf 16 -profile:v high -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart \
  "$OUT/ZONA_TELEFONA_v8_loop_1080x1920_60fps.mp4"
