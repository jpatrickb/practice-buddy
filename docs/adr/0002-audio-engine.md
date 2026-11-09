# ADR-0002: Audio engine — Web Audio with a single master-bus time-stretcher
- Status: Accepted (2026-11-08, after spike PR #3 and the architect's listening test)
- Date: 2026-11-08
## Context
Parts must stay sample-locked for minutes, and the speed range is 0.5x–1.5x with pitch preserved. Multiple `<audio>` elements drift apart.
## Decision
- Decode each part into an `AudioBuffer`. Start every `AudioBufferSourceNode` at the same `AudioContext` time.
- Graph: source(part) → GainNode(part volume/mute) → master bus → **one pitch-preserving time-stretcher** → destination.
  A single stretcher means parts cannot drift relative to each other.
- Stretcher candidates (the spike chooses): **Signalsmith Stretch** (MIT, WASM) or **SoundTouch** AudioWorklet (LGPL).
  Fallback if both fail: `<audio>` elements with `preservesPitch` plus a drift-correction loop.
- Seek = stop and recreate sources at the new offset.
## Spike pass criteria
1. Sounds acceptable for practice at 0.5x and 0.75x on the real piano-timbre stems (architect listens and decides).
2. No audible drift between parts across a full song, at any speed.
3. Peak memory under ~150 MB with 6 parts on an older iPhone (Safari). Mono buffers; consider a lower context sample rate or Int16 storage if needed.
4. Speed changes during playback are glitch-free (no restart).
5. iOS: plays with the silent switch on (`navigator.audioSession.type = 'playback'` where supported).
## Consequences
- Whole-file decode before playback: show a loading state and fetch parts in parallel.
- Lock-screen/background playback is not guaranteed on iOS. Documented as a known limitation.

## Outcome of the spike (2026-11-08)
- **Stretcher: Signalsmith Stretch** (MIT). SoundTouch was rejected: discontinuities on rate change, 10–20 ms transient wobble, ~100 ms latency.
- **AudioContext sample rate: 24 kHz, mono parts.** 6-part song ≈ 123 MB decoded (vs 226 MB at 44.1 kHz). The architect heard no quality difference.
- **Graph amendment:** Signalsmith stretches buffers held inside its worklet, so all N parts are loaded as N channels of ONE stretcher node, and per-part gains sit *after* it (ChannelSplitter → Gain_i → master). It is still one shared timing state, so there's no drift.
- AudioWorklet requires a secure context. The spike used `pnpm dev:https` (spikes/audio-engine); for the app, test phones on the dev site or PR previews (HTTPS), or note that localhost is a secure context. Production is HTTPS.
- Still to verify on real devices: iPhone peak memory, silent switch, CPU with 6 stretched channels.
