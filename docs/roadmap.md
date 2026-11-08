# Roadmap

## Phase 0: Foundations (tech lead) ✅ in progress
- Repo, CLAUDE.md, ADRs 0001–0011, roadmap.
- Architect: re-export Candlelight Carol masters as **AIFF 16-bit, same cycle region** (ADR-0003).

## Phase 1: Three parallel prototypes (one Sonnet engineer each, Haiku subagents for tests/fixtures)

### WS-A: Audio engine spike (`spikes/audio-engine/`) — validates ADR-0002
- A1. Fixture generator: ffmpeg click track + sine stems, N parts, identical length (no music in repo).
- A2. Standalone Vite page: load N local files, play in sync, per-part gain, speed slider.
- A3. Implement both stretchers (Signalsmith Stretch, SoundTouch worklet) behind one interface; A/B toggle.
- A4. Measurements: drift test (click alignment after 5 min), memory on iPhone Safari, cross-browser alignment of AAC.
- Deliverable: a short report and recommendation; the architect listens with the real stems and rules.

### WS-B: UI prototype (`spikes/ui/`) — fake audio engine
- B1. shadcn/Tailwind v4 setup, theme tokens, light/dark/system, accent presets.
- B2. Song list screen + player screen (mobile-first): transport, scrubber, A–B loop, speed, mixer, Focus my part, Reset.
- B3. 2–3 visual directions for the mixer, switchable in one page; the architect picks one.

### WS-C: Platform skeleton
- C1. Vite + `@cloudflare/vite-plugin` + Hono Worker; Zod manifest schemas in `src/shared/`.
- C2. Link redemption → signed cookie grants; `/api/choir`, `/api/songs/:id`; `/audio/*` proxy from R2 with grant checks (ADR-0006). Unit tests.
- C3. OpenTofu: R2 buckets (prod/preview), state backend, custom domain `practice.jpatrickbeal.com`.
- C4. GitHub Actions: PR checks + preview deploy; main → deploy.

## Phase 2: MVP integration
- Engine from WS-A + UI from WS-B on top of the WS-C platform.
- `choir` CLI (ADR-0007): add-song, add-choir, new-link, revoke-link.
- Ingest Candlelight Carol to production; first choir link; Playwright e2e on fixtures.

## Phase 3: Later
Per-part pan, offline/PWA, rehearsal markers, admin upload page (Cloudflare Access), per-song links.
