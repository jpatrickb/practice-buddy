# Audio engine (`src/web/audio`)

Production engine from ADR-0002 (Signalsmith Stretch at a 24 kHz context). The UI depends only on `PracticeEngine`.

```ts
import { createEngine } from './audio';

const engine = createEngine();
engine.on('error', (e) => show((e as EngineError).userMessage)); // friendly text, safe to display
await engine.load(
  song.parts.map((p) => ({ id: p.id, url: `/${p.file}`, defaultGain: p.defaultGain })),
  (loaded, total) => setProgress(loaded / total), // total = 2 × parts (one step per fetch, one per decode)
  { durationSamples: song.durationSamples, sampleRate: song.sampleRate, durationSec: song.durationSec },
);
engine.play(); // call from a click/tap handler (iOS needs a gesture)
```

## API (see `engine-api.ts`)

`load` · `play` · `pause` · `seek(sec)` · `duration` · `currentTime()` · `playing` · `setRate(0.5..1.5)` ·
`setPartGain(id, 0..2)` · `setLoop({start,end} | null)` · `on('ended' | 'statechange' | 'error', cb)` · `dispose()`.

Only change from the spike contract: `load` takes an optional third argument `LoadOptions` with the manifest's
`durationSamples` (+ `sampleRate`, + `durationSec` fallback). Without it the length is the shortest decoded part.

- **Song length** is the manifest value, never the decoded buffer length. WebKit leaves extra AAC tail samples (ADR-0003 amendment).
  Parts are trimmed or zero-padded at the tail only, so alignment is never shifted.
- **Stereo parts** (`channels: 2` in the manifest) are downmixed to mono at decode, (L+R)/2. Per-part stereo playback is out of scope for the MVP.
- `setLoop` while the playhead is already past `end` jumps to `start`.
- `statechange` fires on load, play, pause, seek-while-paused and end. Poll `currentTime()` (e.g. via rAF) for the scrubber.
- `error` and a rejected `load()` carry an `EngineError` (`code`, `userMessage`).
- `dispose()` stops playback, releases the audio held in the worklet, and closes the context. The instance is unusable afterwards.

## Graph

```
 N parts (mono, decoded @ 24 kHz)
        │  (N channels of ONE input timeline)
 ┌──────▼──────────────┐
 │ Signalsmith Stretch │  one worklet node, one timing state → parts cannot drift
 └──────┬──────────────┘
 ChannelSplitter ─► Gain_0 ─┐
                 ─► Gain_1 ─┤
                 ─►  …     ─┼─► master Gain ─► DynamicsCompressor (soft limiter) ─► destination
                 ─► Gain_n ─┘
```

Fetches run in parallel, decoding is sequential (low peak memory), and each decoded buffer is copied into one
Float32Array per part and transferred (not copied) into the worklet. A 6-part, 213 s song holds about 123 MB.
Position is computed from the AudioContext clock (`timeline.ts`, unit-tested), not read from the audio thread, so
the UI time can be off by up to ~30 ms during a speed change.

## iOS and other limitations

- `navigator.audioSession.type = 'playback'` is set on `play()` where supported (Safari 16.4+). On older iOS a
  looping silent `<audio>` is started instead. Both are untested on a real device so far.
- The context is resumed on the first pointer/touch/key event and after an interruption (call, Siri).
- Lock-screen / background playback is not guaranteed on iOS.
- AudioWorklet needs a secure context: https in production, `localhost` in dev, `pnpm dev:https` for phones on the LAN.
- Whole-song decode before playback; nothing streams.

## Tests

- `pnpm test`: `timeline.test.ts` (position/rate/loop/length logic).
- `pnpm test:e2e`: Playwright. Runs `pnpm seed` + `pnpm dev` on port 5273, redeems the dev link, and drives the engine
  through `e2e/harness/audio.html` (test-only, not referenced by `index.html`, so not in the production bundle).
  Needs ffmpeg and `npx playwright install chromium`. It is not part of CI yet.
