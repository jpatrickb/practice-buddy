# Roadmap

**1.0 was released on 2026-11-09 (UTC)** (PR #13, `develop` → `main`): https://practice.jpatrickbeal.com

## Phase 0: Foundations ✅ (2026-11-08)
- Repo, CLAUDE.md, ADRs 0001–0011, roadmap.
- Architect re-exported the Candlelight Carol masters as AIFF 16-bit with a shared cycle region (ADR-0003).

## Phase 1: Three parallel prototypes ✅ (merged 2026-11-09)
- **WS-A audio engine spike** (`spikes/audio-engine/`, PR #3): Signalsmith Stretch chosen over SoundTouch; 24 kHz context; `durationSamples` for WebKit's AAC tail. Rulings recorded in ADR-0002/0003 (PR #4).
- **WS-B UI prototype** (`spikes/ui/`, PR #1): three mixer directions; the architect picked **Fusion** (ADR-0011, PR #8).
- **WS-C platform skeleton** (PR #2): Vite + Hono Worker, Zod manifests, signed-cookie grants, `/audio` proxy, OpenTofu, GitHub Actions; dev/prod environments (ADR-0009).

## Phase 2: MVP integration ✅ (merged 2026-11-09)
- Bootstrap and deploy automation: PRs #5, #6.
- `choir` CLI (ADR-0007): add-song, choirs, links, list (PR #7); `delete-song` (PR #14).
- Production audio engine (PR #9) and real player UI in the Fusion look (PR #10).
- Playwright e2e in CI as `ci / e2e` (PRs #11, #12).
- Candlelight Carol ingested, first choir link, **1.0 released** (PR #13).

## Phase 3: Later (unordered)
- Light mode (Fusion is dark-only today).
- Per-part pan.
- Offline / PWA.
- Rehearsal markers.
- Admin upload page behind Cloudflare Access (so other conductors need no CLI).
- Per-song links.
- A real-device performance pass on older iPhones (peak memory, silent switch, CPU with 6 stretched channels).
- Orphan-audio cleanup for uploads made before PR #14 (none exist today; `add-song` and `delete-song` now remove old files).
- A bot GitHub account, so PRs can have formal approvals (all PRs are authored under the architect's account today).
