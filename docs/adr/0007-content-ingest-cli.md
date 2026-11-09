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

## As built (2026-11-08, PR #7)
- Commands: `init-song`, `add-song`, `add-choir`, `add-song-to-choir`, `remove-song-from-choir`, `new-link`, `revoke-link`, `list`. Envs are `--env local|dev|prod` (default dev; prod asks for confirmation).
- R2 access goes through **wrangler** with the architect's own `wrangler login` (no S3 token).
- `manifests/index.json` lists song and choir ids for the CLI (wrangler can't list objects). The Worker doesn't use it.
- Idempotent via deterministic ffmpeg output and content hashes. Re-running uploads nothing new.
- User guide: `docs/adding-songs.md`.
