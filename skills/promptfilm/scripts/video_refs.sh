#!/bin/sh
# Reference frames from a video — a film or game scene, an ad, a product demo, a launch keynote, a nature clip:
#   sh video_refs.sh <url-or-file> <out-dir> [every-seconds (default 2)] [key times in seconds …]
# Downloads a small copy with yt-dlp (≤ 720p; when YouTube answers 403 it retries with other player clients and format 18),
# then writes contact sheets of 16 frames each (4 × 4, left → right, top → bottom) and full-size frames at the key times.
# Sheet k, cell i (0–15) shows second ((k − 1) × 16 + i) × every-seconds. (No timestamps are drawn: many ffmpeg builds lack drawtext.)
# Read every sheet first (the order of events), then ask for key frames where something important happens.
# The frames are evidence for shape, colour, order and motion only: keep them in research/refs, never put them into the film.
SRC=$1; OUT=$2; STEP=${3:-2}
[ -n "$SRC" ] && [ -n "$OUT" ] || { echo "usage: sh video_refs.sh <url-or-file> <out-dir> [every-seconds] [key times …]"; exit 2; }
if [ $# -ge 3 ]; then shift 3; else shift $#; fi
mkdir -p "$OUT" || exit 1
FF=${FFMPEG:-$(node "$(dirname "$0")/tools.mjs" ffmpeg 2>/dev/null || echo ffmpeg)}     # on PATH, else the skill's local copy (setup.sh)
if [ -f "$SRC" ]; then V=$SRC; else
  command -v yt-dlp >/dev/null 2>&1 || { echo "yt-dlp is needed to download a video (macOS: brew install yt-dlp · else: pipx install yt-dlp), or pass a local file"; exit 1; }
  V="$OUT/source.mp4"
  yt-dlp --no-update -q --no-warnings -f "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]" --merge-output-format mp4 -o "$V" "$SRC" 2>/dev/null \
  || { rm -f "$V" "$V".part; yt-dlp --no-update -q --no-warnings -f "18/b[height<=480]" --extractor-args "youtube:player_client=web_safari,mweb,tv" -o "$V" "$SRC"; } \
  || { echo "download failed (login, region or a newer site change): ask for the file, or find another upload"; exit 1; }
fi
DUR=$("$FF" -hide_banner -i "$V" 2>&1 | sed -n 's/.*Duration: \([0-9]*\):\([0-9]*\):\([0-9.]*\).*/\1 \2 \3/p' | awk '{printf "%.0f", $1*3600+$2*60+$3}')
"$FF" -v error -y -i "$V" -vf "fps=1/$STEP,scale=400:-2,tile=4x4" "$OUT/sheet_%02d.jpg" || exit 1
for t in "$@"; do "$FF" -v error -y -ss "$t" -i "$V" -frames:v 1 "$OUT/frame_${t}s.jpg"; done
echo "video: $V (${DUR:-?} s) · sheets: $(ls "$OUT"/sheet_*.jpg | wc -l | tr -d ' ') (each 16 frames, one per $STEP s) · key frames: $#"
