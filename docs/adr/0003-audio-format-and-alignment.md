# ADR-0003: Delivery format and sample alignment
- Status: Accepted
- Date: 2026-11-08
## Context
Parts must line up to the sample. Lossy encoders add priming/padding: AAC ≈ 2112 samples, and MP3 varies by encoder and tag. Mixed source formats cannot be aligned reliably.
## Decision
- **Masters must be lossless** (AIFF/WAV), exported with the same cycle region so every part has the same length.
- The CLI decodes the masters, verifies that all parts have the same sample rate and length (pads or trims the tail to the exact same sample count), downmixes to mono (unless the part says `channels: 2`), and encodes **AAC-LC 96 kbps (mono) / 128 kbps (stereo) in .m4a** with ffmpeg.
- Filenames are content-hashed: `audio/<songId>/<partId>.<sha256-12>.m4a`.
- The spike verifies that decoded AAC lines up the same way in Chrome, Safari, and Firefox (using a generated click-track fixture).
## Consequences
- Lossy masters are rejected by the CLI, or accepted only with `--allow-lossy` plus a warning.
