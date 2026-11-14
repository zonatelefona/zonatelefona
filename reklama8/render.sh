#!/usr/bin/env bash
# Full build: audio → frames at 120 fps → blend pairs into 60 fps (real motion blur) → Reels-ready MP4.
# Reels delivery: 1080×1920, H.264 High, 60 fps, BT.709 tags, yuv420p, faststart, AAC 48 kHz, −14 LUFS (static gain, no squashing).
set -euo pipefail; cd "$(dirname "$0")"; OUT=${OUT:-build}; mkdir -p "$OUT"
[ -d node_modules ] || { echo "node_modules missing (symlink to ../reklama/node_modules)"; exit 1; }
python3 audio.py "$OUT/audio.wav"
END=$(python3 -c "import json;print(json.load(open('timeline.json'))['end'])")
node render.mjs "$OUT/frames" 120 0 "$END" "${WORKERS:-3}"
python3 tools/qa.py "$OUT/frames" timeline.json      # centring check: must end with ISSUES 0
I=$(ffmpeg -hide_banner -nostats -i "$OUT/audio.wav" -af ebur128 -f null - 2>&1 | awk '/Summary/{s=1} s&&/ I:/{print $2; exit}')
GAIN=$(python3 -c "print(round(-14.0 - float('$I'), 2))")
ffmpeg -y -framerate 120 -i "$OUT/frames/%05d.jpg" -i "$OUT/audio.wav" -map 0:v -map 1:a \
  -vf "tmix=frames=2:weights='1 1',select='not(mod(n\,2))',setpts=N/(60*TB),format=yuv420p" -r 60 \
  -c:v libx264 -preset slow -crf 16 -profile:v high -level 4.2 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -af "volume=${GAIN}dB" -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart \
  "$OUT/ZONA_TELEFONA_FINAL_reels_1080x1920_60fps.mp4"
# cover image for the Reels grid (the ringing phone)
ffmpeg -y -ss 1.0 -i "$OUT/ZONA_TELEFONA_FINAL_reels_1080x1920_60fps.mp4" -frames:v 1 -q:v 2 "$OUT/ZONA_TELEFONA_FINAL_cover.jpg"
