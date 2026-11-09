#!/usr/bin/env bash
# Encode real choir stems (.aif) to mono AAC-LC 96k .m4a files, all trimmed to
# the exact sample count of the shortest input (at SAMPLE_RATE).
#
# Usage: encode-real.sh SRC_DIR [OUT_DIR] [SAMPLE_RATE]
#   SRC_DIR      directory containing organ, soprano, alto, tenor, baritone, bass .aif
#   OUT_DIR      default: $SRC_DIR/encoded
#   SAMPLE_RATE  default: 44100
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 SRC_DIR [OUT_DIR] [SAMPLE_RATE]" >&2
  exit 2
fi

SRC_DIR="$1"
OUT_DIR="${2:-$SRC_DIR/encoded}"
RATE="${3:-44100}"
PARTS=(organ soprano alto tenor baritone bass)

# Real audio must never land inside a git work tree.
inside_worktree() {
  [ -e "$1" ] || return 1
  [ "$(git -C "$1" rev-parse --is-inside-work-tree 2>/dev/null || true)" = "true" ]
}
parent="$(dirname "$OUT_DIR")"
mkdir -p "$parent"
if inside_worktree "$parent" || inside_worktree "$OUT_DIR"; then
  echo "error: OUT_DIR '$OUT_DIR' is inside a git work tree; refusing to write real audio there" >&2
  exit 1
fi

for p in "${PARTS[@]}"; do
  if [ ! -f "$SRC_DIR/$p.aif" ]; then
    echo "error: missing input $SRC_DIR/$p.aif" >&2
    exit 1
  fi
done

# Native sample count and rate per input. Mono decode byte count / 4 = sample count.
pairs=()
declare -A NATIVE_N NATIVE_R
for p in "${PARTS[@]}"; do
  NATIVE_R[$p]="$(ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of csv=p=0 "$SRC_DIR/$p.aif")"
  bytes="$(ffmpeg -v error -i "$SRC_DIR/$p.aif" -map 0:a:0 -f f32le -ac 1 - | wc -c | tr -d ' ')"
  NATIVE_N[$p]=$((bytes / 4))
  pairs+=("${NATIVE_N[$p]}" "${NATIVE_R[$p]}")
done

# Shortest input duration in seconds is min(N_i / R_i); target = floor(min * RATE).
TARGET="$(python3 -c '
import sys
from fractions import Fraction
rate = int(sys.argv[1])
vals = sys.argv[2:]
durs = [Fraction(int(vals[i]), int(vals[i + 1])) for i in range(0, len(vals), 2)]
print((min(durs) * rate).__floor__())
' "$RATE" "${pairs[@]}")"

mkdir -p "$OUT_DIR"
echo "Target length: $TARGET samples at ${RATE} Hz (shortest input)"

for p in "${PARTS[@]}"; do
  out="$OUT_DIR/$p.m4a"
  echo "Encoding $p -> $out"
  ffmpeg -hide_banner -loglevel error -y \
    -i "$SRC_DIR/$p.aif" -map 0:a:0 -vn \
    -ac 1 -ar "$RATE" \
    -af "atrim=end_sample=${TARGET},apad=whole_len=${TARGET}" \
    -c:a aac -b:a 96k -movflags +faststart \
    "$out"
done

echo
printf '%-10s %-22s %s\n' "name" "decoded_samples" "target_samples"
for p in "${PARTS[@]}"; do
  bytes="$(ffmpeg -v error -i "$OUT_DIR/$p.m4a" -f f32le -ac 1 - | wc -c | tr -d ' ')"
  printf '%-10s %-22s %s\n' "$p" "$((bytes / 4))" "$TARGET"
done
echo "(decoded_samples is the decoder's output count, which may include AAC priming/padding)"
