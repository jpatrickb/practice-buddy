# ADR-0005: Content model — JSON manifests in R2, no database
- Status: Accepted
- Date: 2026-11-08
## Decision
R2 layout:
```
manifests/songs/<songId>.json
manifests/choirs/<choirId>.json
audio/<songId>/<partId>.<hash>.m4a
```
Songs are a shared library; choirs reference songs by id (no duplicated audio).

Song manifest (validated by Zod in `src/shared/`):
```json
{
  "schemaVersion": 1,
  "id": "candlelight-carol",
  "title": "Candlelight Carol",
  "credits": "John Rutter",
  "durationSec": 213.3,
  "sampleRate": 44100,
  "parts": [
    { "id": "organ", "label": "Organ", "file": "audio/candlelight-carol/organ.ab12cd34ef56.m4a",
      "defaultGain": 1.0, "channels": 1, "order": 0, "kind": "accompaniment" },
    { "id": "soprano", "label": "Soprano", "file": "…", "defaultGain": 1.0, "channels": 1, "order": 1, "kind": "voice" }
  ]
}
```
Choir manifest:
```json
{
  "schemaVersion": 1,
  "id": "oak-hills-3rd",
  "name": "Oak Hills 3rd Ward Choir",
  "songs": ["candlelight-carol"],
  "accessTokens": [{ "sha256": "…", "label": "2026 link", "createdAt": "2026-11-08" }]
}
```
## Consequences
- Adding a song or choir is an R2 write. No deploy needed.
- The Worker caches manifests briefly (Cache API, ~60 s), so edits show up within a minute.
- Part labels and `kind` are free-form or small enums. Nothing assumes SATB.
