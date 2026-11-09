# ADR-0010: Domain
- Status: Accepted
- Date: 2026-11-08
## Decision
Production: `practice.jpatrickbeal.com` (Worker custom domain; the zone is already on Cloudflare DNS).
Dev: `practice-buddy-dev` on `*.workers.dev`; PR previews are preview versions of the dev Worker (see ADR-0009).
