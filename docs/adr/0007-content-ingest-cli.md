# ADR-0007: Song ingest via local CLI
- Status: Accepted
- Date: 2026-11-08
## Context
The architect is the only content author for now. Audio starts on their Mac.
## Decision
`pnpm choir <command>` (TypeScript, run with tsx; needs ffmpeg/ffprobe):
- `add-song <folder>`: reads `song.yaml` + lossless masters, validates/aligns/encodes (ADR-0003), uploads to R2 via the S3 API, writes the song manifest. Idempotent (content hashes).
- `add-choir`, `choir-add-song`, `new-link` (prints the URL once), `revoke-link`, `list`.
- `--env preview|production`.

`song.yaml` example:
```yaml
id: candlelight-carol
title: Candlelight Carol
credits: John Rutter
parts:
  - { id: organ, label: Organ, file: organ.aiff, kind: accompaniment, channels: 2 }
  - { id: soprano, label: Soprano, file: soprano.aiff }
```
## Consequences
- Phase 2 option: an admin web page behind Cloudflare Access, for other conductors.
