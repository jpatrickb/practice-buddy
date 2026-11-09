#!/usr/bin/env bash
# Generate sample-exact mono test fixtures (click, click2, sine220, sine330)
# as .wav (pcm_s16le) and .m4a (AAC-LC 96k).
#
# Usage: make-fixtures.sh [OUT_DIR]   (default: ./fixtures)
set -euo pipefail

OUT_DIR="${1:-./fixtures}"

RATE=44100
SAMPLES=9404805          # exact target length in samples
GEN_SECONDS=214          # generate longer than needed, then trim to SAMPLES
CLICK_PERIOD=88200       # 2.0 s at 44100 Hz
CLICK_OFFSET=44100       # first click at sample 44100 (phase shift so m==0 there)
BURST_LEN=88             # ~2 ms decaying burst after the impulse

# Click track: 1-sample full-scale impulse at each click, then a decaying burst.
# m = (n + CLICK_OFFSET) mod CLICK_PERIOD; m == 0 is the impulse.
mkclick() { local off="$1"; echo "if(eq(mod(n+${off}\\,${CLICK_PERIOD})\\,0)\\,1\\,if(lt(mod(n+${off}\\,${CLICK_PERIOD})\\,${BURST_LEN})\\,0.8*exp(-mod(n+${off}\\,${CLICK_PERIOD})/12)*sin(2*PI*3000*n)\\,0))"; }
CLICK_EXPR="$(mkclick $CLICK_OFFSET)"      # odd seconds (1,3,5..)
CLICK2_EXPR="$(mkclick 0)"                  # even seconds (2,4,6..): interleaved with click so parts are separable in a mixed output

mkdir -p "$OUT_DIR"

# gen NAME AEVALSRC_EXPR
gen() {
  local name="$1" expr="$2"
  local src="aevalsrc=exprs=${expr}:s=${RATE}:d=${GEN_SECONDS},atrim=end_sample=${SAMPLES},apad=whole_len=${SAMPLES}"

  echo "Generating ${name}.wav"
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "$src" \
    -ac 1 -ar "$RATE" -c:a pcm_s16le \
    "$OUT_DIR/${name}.wav"

  echo "Generating ${name}.m4a"
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "$src" \
    -ac 1 -ar "$RATE" -c:a aac -b:a 96k -movflags +faststart \
    "$OUT_DIR/${name}.m4a"
}

gen click  "$CLICK_EXPR"
gen click2 "$CLICK2_EXPR"
gen sine220 "0.2*sin(2*PI*220*t)"
gen sine330 "0.2*sin(2*PI*330*t)"

echo
echo "Sample counts (ffprobe duration_ts in time_base units; expect ${SAMPLES} at 1/${RATE} for WAV):"
for f in click click2 sine220 sine330; do
  for ext in wav m4a; do
    file="$OUT_DIR/${f}.${ext}"
    info="$(ffprobe -v error -select_streams a:0 -count_frames \
      -show_entries stream=sample_rate,channels,time_base,duration_ts,nb_read_frames \
      -of default=nw=1 "$file")"
    ts="$(printf '%s\n' "$info" | sed -n 's/^duration_ts=//p')"
    tb="$(printf '%s\n' "$info" | sed -n 's/^time_base=//p')"
    printf '  %-16s duration_ts=%s time_base=%s\n' "$file" "$ts" "$tb"
  done
done
