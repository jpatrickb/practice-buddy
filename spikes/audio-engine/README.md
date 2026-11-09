# Spike WS-A: audio engine (validates ADR-0002 / ADR-0003)

Throwaway prototype. Standalone Vite + TypeScript page, no React. **No audio is in this repo**: real stems are
served from outside the repo (`AUDIO_DIR`), and test fixtures are generated into a gitignored `fixtures/` folder.

## TL;DR

| Question | Result |
|---|---|
| Recommended stretcher | **Signalsmith Stretch** (MIT). Sample-accurate and clean in every automated test. SoundTouch is measurably worse. The final call on sound quality at 0.5x/0.75x is the architect's (see "Listening test"). |
| Drift across the full song (213 s) | Signalsmith: ≤ 0.04 ms/min, inter-part skew ≤ 0.16 ms at 0.5/0.75/1/1.25/1.5x. SoundTouch: ≤ 0.8 ms/min, skew ≤ 1.3 ms. Both pass (no audible drift). |
| Speed change while playing | Signalsmith: 0 gaps, 0 discontinuities, pitch steady. SoundTouch: 27 sample discontinuities in a 20 s run (see below). |
| Memory, 6 mono parts | 226 MB at 44.1 kHz (fails ~150 MB). **113 MB at 22.05 kHz, 123 MB at 24 kHz (passes).** Recommend a 24 kHz context. iPhone peak still unmeasured (needs the architect's phone). |
| AAC alignment (ADR-0003) | Chromium and Firefox decode the m4a to exactly the source length with clicks on the exact sample. WebKit trims the start correctly but returns 635 extra samples at the tail (see "Findings"). |
| Mono vs stereo, sampleRate | Mono parts (as ADR-0003). Context `sampleRate: 24000` for the Signalsmith path. |

## What is here

```
src/engine-api.ts       the contract (PartSource, PracticeEngine), exactly as specified
src/engines/base.ts     shared: fetch+decode, timeline model, loop, events, iOS silent-switch handling
src/engines/signalsmith.ts   candidate A
src/engines/soundtouch.ts    candidate B
src/engines/media.ts         fallback: <audio preservesPitch> + drift-correction loop
src/engines/index.ts    createEngine({ stretcher: 'signalsmith'|'soundtouch'|'media', sampleRate? })
src/main.ts, index.html the test page (engine A/B toggle, mixer, speed, A-B loop, diagnostics, offline tests)
src/measure.ts          offline drift / rate-change / decode-offset measurements
scripts/make-fixtures.sh   ffmpeg click + sine fixtures (exact 9,404,805 samples)
scripts/encode-real.sh     real AIFF -> mono AAC-LC 96 kbps m4a, written OUTSIDE the repo
scripts/measure.mjs        Playwright runner (probe | drift | rate | mem)
scripts/smoke.mjs          real-time smoke test of all three engines
```

### Graphs

- **SoundTouch** (literal ADR-0002): `source_i -> Gain_i -> master -> ONE SoundTouchNode -> destination`. Each
  source's `playbackRate` is set to the speed at the same context time, and the single SoundTouch node restores the
  pitch (this is the mode its README recommends; its own tempo mode underruns at 128-sample blocks). The node is
  recreated on every start/seek to flush its FIFO.
- **Signalsmith** (small deviation): the stretcher only takes its input from sample buffers inside its worklet, and a
  live-input node ignores `rate`. So all N parts are loaded as **N channels of one node**, stretched together by one
  instance (one timing state -> no drift), then `ChannelSplitter -> Gain_i -> master -> destination`. Gains are
  therefore applied *after* the stretcher. Decoded AudioBuffers are dropped once their samples are transferred
  (no copy) into the worklet.
- **Media fallback**: one `<audio>` per part routed through `MediaElementSource` + Gain, with a ±3% rate nudge /
  hard re-sync loop. Not sample-locked and it cannot start at a scheduled time.

Seek = stop and recreate / reschedule from the new offset. Position is a computed timeline (anchor + elapsed ×
rate, wrapping inside the loop), not read from the stretcher.

iOS: `navigator.audioSession.type = 'playback'` is set on `play()` when present; otherwise on iOS a looping silent
`<audio>` is started so the silent switch does not mute Web Audio (unverified, needs a real iPhone).

## Run it

```bash
cd spikes/audio-engine
pnpm install
pnpm fixtures                                   # generates ./fixtures (gitignored)
pnpm dev                                        # http://localhost:5173
# real stems, served from outside the repo:
bash scripts/encode-real.sh ~/Music/GarageBand/ward-choir/candelight-carol   # -> .../encoded/*.m4a
AUDIO_DIR=~/Music/GarageBand/ward-choir/candelight-carol/encoded pnpm dev
```

Page: pick the engine and context rate first, then click "Generated fixtures", "Dev-server /audio", or pick/drop files.

Measurements (need Playwright browsers once: `npx playwright install chromium webkit firefox`):

```bash
node scripts/measure.mjs chromium probe                    # decode offset / length, per browser
node scripts/measure.mjs chromium drift signalsmith        # optional 4th arg: rates e.g. 0.5,1.5
node scripts/measure.mjs chromium rate soundtouch          # rate changes while playing
AUDIO_DIR=... node scripts/measure.mjs chromium mem signalsmith 24000
node scripts/smoke.mjs
```

## Measurements

Environment: macOS, Chromium (Playwright 1.65), 213.26 s, 9,404,805-sample fixtures. Drift tests render the full
song **offline** through the real engine (OfflineAudioContext), with two click parts at interleaved odd/even
seconds, then locate each click in the output. "Drift" is the slope of (detected − ideal) in ms per minute of song;
"skew" is the median offset difference between the two parts.

### Drift over the full song

| Stretcher | Speed | Drift ms/min (A / B) | Max deviation from fit (ms) | Inter-part skew (ms) | Fixed latency (ms) |
|---|---|---|---|---|---|
| Signalsmith | 0.5 | −0.005 / 0.014 | 1.3 / 1.6 | 0.05 | 1 |
| | 0.75 | 0.004 / −0.040 | 1.5 / 1.6 | 0.16 | 1 |
| | 1.0 | 0.033 / −0.020 | 1.6 / 1.5 | 0.09 | 1 |
| | 1.5 | 0.030 / −0.037 | 1.5 / 1.5 | −0.05 | 1 |
| SoundTouch | 0.5 | 0.094 / −0.370 | 14 / 20 | −0.48 | 102 |
| | 0.75 | −0.774 / 0.377 | 16 / 10 | 1.27 | 120 |
| | 1.0 | 0 / 0 | 0 | 0 | 133 |
| | 1.5 | −0.078 / −0.085 | 17 / 16 | 0.84 | 129 |

Both pass ADR-0002 criterion 2 by a wide margin (a few ms ≈ imperceptible; the by-construction guarantee holds).
Differences that matter:
- SoundTouch's click positions wobble by 10-20 ms (WSOLA seams) and **at 1.5x only 78 of 106 clicks survived above
  the detection threshold**, i.e. transients are partially dropped/smeared. Piano-timbre attacks are exactly this case.
- SoundTouch adds ~100-130 ms uncompensated latency, so the displayed time leads what is heard by that much.
  Signalsmith compensates (≈1 ms).

### Speed change while playing (sine 220 Hz; 1x → 0.5x@3s → 1.5x@8s → 0.75x@12s → 1x@16s)

| Stretcher | Gaps (20 ms windows <50% RMS) | Sample jumps >3× sine slope | Pitch |
|---|---|---|---|
| Signalsmith | 0 | 0 (max step 0.0078) | 200-250 Hz window estimates = 220 Hz (20 ms zero-crossing resolution) |
| SoundTouch | 0 | 27 across t = 3.1, 3.2, 3.6, 5.6, 8.0, 8.1, 8.2, 8.9, 11.4, 12.1, 12.4, 12.7, 16.2 s (max step 0.20 = 30× the sine slope) | 50-350 Hz estimates, i.e. glitches both at the rate changes and in steady state |

Signalsmith meets criterion 4 (glitch-free, no restart). SoundTouch does not on this test (audible ticks likely, to be confirmed by ear).
`smoke.mjs` (real-time context) confirms play / `setRate` / `seek` / loop / pause behave on all three engines; the
position model advanced by the expected amounts.

### Memory (6 real stems, mono AAC, decoded and retained as Float32)

| Context sampleRate | Retained audio | Engine heap view |
|---|---|---|
| 44.1 kHz | **226 MB** | over budget |
| 24 kHz | **123 MB** | under 150 MB |
| 22.05 kHz | **113 MB** | under 150 MB |

The decoder resamples to the context rate, so a lower `sampleRate` is the whole fix: no Int16 path is needed
(and Web Audio `AudioBuffer` cannot hold Int16 anyway; Int16 would only work in a custom-worklet design).
24 kHz keeps content to 12 kHz, enough for voices/organ/piano practice tracks, and is a more standard rate than 22.05.
**Not measured: iPhone Safari peak.** The 123 MB figure is the steady state; decode transiently holds compressed data
plus decoded buffers (Signalsmith also briefly has a copy while building its channel arrays). The architect should check
this on the oldest available phone (steps below). If it fails, fallback options: 22.05 kHz, or decode the song in two halves.

Decode time for 6 parts (sequential): ~0.6 s at 44.1 kHz, ~0.8 s at 24 kHz on desktop Chromium. Phones will be several times slower.

### Cross-browser AAC alignment (ADR-0003)

`click.m4a` (AAC-LC 96 kbps mono) vs `click.wav`, decoded with `decodeAudioData` in the Playwright builds:

| Browser | m4a decoded length (WAV = 9,404,805) | First clicks (expected 44100, 132300, 220500) |
|---|---|---|
| Chromium | 9,404,805 | exact |
| Firefox | 9,404,805 | exact |
| WebKit | 9,405,440 (+635 at the tail) | exact |

Start alignment is identical across all three (the encoder priming is correctly removed from the
front). WebKit leaves ~635 samples of encoder padding at the **end**, so m4a length can differ between browsers.
Consequences: take `duration` from the manifest (or the shortest part), never from the decoded buffer, and never pad/trim
parts independently. Tail padding is equal for all parts so it cannot desync them. Real Safari on iOS should be rechecked
(it is the same engine but not the same build): the page's decode diagnostics show the length.

## Findings / deviations from the ADRs (for the tech lead)

1. **Signalsmith gain order** (gains after the stretcher, N-channel node) differs from ADR-0002's drawing, same guarantee. CPU scales with N (6 channels stretched), not measured on a phone.
2. **Memory** passes only with a reduced context sampleRate (24 kHz recommended). ADR-0002 already allows this; Int16 storage is not applicable to AudioBuffer.
3. **AAC tail padding in WebKit** (above). ADR-0003's "exact equal sample count" holds at the file level but the decoded length differs per browser. Proposal: the manifest carries `durationSamples` and the engine uses it.
4. **AudioWorklet needs a secure context.** `vite --host` over plain http on a phone gives no `audioWorklet` (both stretchers fail). Use `pnpm dev:https` (self-signed) for the phone; production on Cloudflare is https so this is dev-only. Worth a line in ADR-0002.
5. **Licenses**: `signalsmith-stretch` 1.3.2 is **MIT** (JS/WASM, official). `@soundtouchjs/audio-worklet` 2.1.1 is **MPL-2.0** (the ADR expects LGPL; the underlying `soundtouchjs` is LGPL-2.1). Either is compatible with a free choir app; MPL is file-level copyleft and satisfied by shipping unmodified.
6. Lock-screen / background playback was not tested.

## Known limitations

- Position clock is a model, not read from the audio thread; during a rate change the UI time can be off by ≤ 30 ms.
- Loop wrap on SoundTouch uses native source looping (sample-exact); on Signalsmith the node's loop. The loop seam has not been listened to.
- `setPartGain` is smoothed (10 ms time constant) to avoid zipper noise.
- Media fallback: clicks/ticks at re-sync, cannot start together precisely, `preservesPitch` quality differs per browser, and gain > 1 is via a Web Audio gain.
- Results are from desktop Chromium/Firefox/WebKit under Playwright, not from real phones.

## Listening test for the architect (real stems)

1. On the Mac: `cd spikes/audio-engine && pnpm install`, then
   `bash scripts/encode-real.sh ~/Music/GarageBand/ward-choir/candelight-carol` (writes `encoded/` outside the repo).
2. Start HTTPS dev server so the phone can use AudioWorklet:
   `AUDIO_DIR=~/Music/GarageBand/ward-choir/candelight-carol/encoded pnpm dev:https`.
   It prints a `https://192.168.x.x:5173/` Network URL. The iPhone must be on the same Wi-Fi.
3. On the iPhone open that URL, accept the self-signed certificate warning (Show Details → visit this website).
4. Set Engine = **Signalsmith**, rate = **24 kHz**, tap **Dev-server /audio**; wait for "Loaded 6 parts". Note the
   diagnostics (decode ms, retained MB).
5. Press Play, then listen with the switch on silent (audio should still play).
6. Drag Speed to **0.75x**, then **0.5x**. Judge on the piano-like parts: Are attacks smeared or "phasey"? Is the
   pitch right? Try soprano alone, organ alone, and all six.
7. Move the speed slider while playing: any click, dropout, or restart?
8. Set A and B (A–B), confirm the loop repeats without a hiccup; seek with the scrubber and ±10 s.
9. Toggle parts on/off and move gains while playing.
10. Reload, choose **SoundTouch**, load again and repeat steps 5-9 at the same speeds. Then, optionally, the
    `<audio>` fallback. Say which stretcher sounds best at 0.5x/0.75x and at 1.25-1.5x.
11. Memory: on a Mac, connect the iPhone, Safari → Develop → [iPhone] → the page → Timelines/Memory, load with 24 kHz and
    note the peak; repeat with "device rate" to see the difference. Report model + iOS version.
12. Optional: switch the silent switch on and off during playback; play for ~4 minutes at 0.75x and check
    the parts still sound together (they should).
