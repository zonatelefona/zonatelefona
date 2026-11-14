#!/usr/bin/env bash
# ZONA TELEFONA — „POV: UŠAO SI SAMO DA POGLEDAŠ…“  full build + QA.
# 1) assets from official press material (not in git): python3 tools/prep.py <refs_dir> assets
# 2) audio → frames (60 fps) → blend pairs into 30 fps (motion blur) → Reels MP4 (1080×1920, H.264 High, AAC 48 kHz, BT.709, −14 LUFS)
set -euo pipefail; cd "$(dirname "$0")"; OUT=${OUT:-build}; mkdir -p "$OUT"
[ -d node_modules ] || { echo "node_modules missing (symlink to ../reklama/node_modules)"; exit 1; }
python3 audio.py "$OUT/audio.wav"
node tools/qa_text.mjs          # exact copy, centring, safe zone → must end with ISSUES 0
node tools/flicker.mjs          # no letter jumps/flicker      → must end with JUMPS 0
END=$(python3 -c "import json;print(json.load(open('timeline.json'))['end'])")
node render.mjs "$OUT/frames" 60 0 "$END" "${WORKERS:-3}"
I=$(ffmpeg -hide_banner -nostats -i "$OUT/audio.wav" -af ebur128 -f null - 2>&1 | awk '/Summary/{s=1} s&&/ I:/{print $2; exit}')
GAIN=$(python3 -c "print(round(-14.0 - float('$I'), 2))")
ffmpeg -y -framerate 60 -i "$OUT/frames/%05d.jpg" -i "$OUT/audio.wav" -map 0:v -map 1:a \
  -vf "tmix=frames=2:weights='1 1',select='not(mod(n\,2))',setpts=N/(30*TB),format=yuv420p" -r 30 \
  -c:v libx264 -preset slow -crf 15 -profile:v high -level 4.1 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -af "volume=${GAIN}dB,alimiter=limit=0.891:level=false" -c:a aac -b:a 320k -ar 48000 -t "$END" -movflags +faststart \
  "$OUT/ZONA_TELEFONA_POV_1080x1920_30fps.mp4"
