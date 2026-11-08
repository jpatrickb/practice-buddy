# ADR-0001: Host on Cloudflare Workers + R2
- Status: Accepted
- Date: 2026-11-08
## Context
Must be free, serverless, and lightweight. Audio needs object storage, and egress costs must not matter.
## Decision
- One **Cloudflare Worker** serves the SPA (Workers static assets) and the API/audio proxy.
- One private **R2** bucket per environment (`practice-buddy-content`, `practice-buddy-content-preview`).
- Not S3: R2 has a permanent free tier (10 GB-month storage, 1M Class A, 10M Class B ops/month) and $0 egress.
## Consequences
- Budget: ~17 MB per 6-part, 4-minute song, so hundreds of songs fit in the free tier.
- Worker free plan: 100k dynamic requests/day, 10 ms CPU per request. Audio is streamed from the R2 binding (no buffering in the Worker), so CPU stays low.
