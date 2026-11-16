#!/usr/bin/env bash
# ZONA TELEFONA — BLACK FRIDAY IS COMING. Full build: audio → frames at 120 fps → blend pairs into 60 fps (real motion blur)
# → 1080×1920 H.264 High, AAC 48 kHz, BT.709, −14 LUFS (true-peak limited).
set -euo pipefail; cd "$(dirname "$0")"; OUT=${OUT:-build}; mkdir -p "$OUT"
[ -d node_modules ] || { echo "node_modules missing (symlink to ../reklama/node_modules)"; exit 1; }
python3 audio.py "$OUT/audio.wav"
END=$(python3 -c "import json;print(json.load(open('timeline.json'))['end'])")
node render.mjs "$OUT/frames" 120 0 "$END" "${WORKERS:-3}"
I=$(ffmpeg -hide_banner -nostats -i "$OUT/audio.wav" -af ebur128 -f null - 2>&1 | awk '/Summary/{s=1} s&&/ I:/{print $2; exit}')
GAIN=$(python3 -c "print(round(-14.0 - float('$I'), 2))")
ffmpeg -y -framerate 120 -i "$OUT/frames/%05d.jpg" -i "$OUT/audio.wav" -map 0:v -map 1:a \
  -vf "tmix=frames=2:weights='1 1',select='not(mod(n\,2))',setpts=N/(60*TB),format=yuv420p" -r 60 \
  -c:v libx264 -preset slow -crf 14 -profile:v high -level 4.2 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -af "volume=${GAIN}dB,alimiter=limit=0.891:attack=2:release=60:level=false" -c:a aac -b:a 320k -ar 48000 -t "$END" -movflags +faststart \
  "$OUT/ZONA_TELEFONA_BLACK_FRIDAY_1080x1920_60fps.mp4"
