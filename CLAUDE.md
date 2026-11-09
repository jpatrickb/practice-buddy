# practice-buddy — agent guide

Web app for church/ward choir members to practice their parts: pick any combination
of parts (e.g. Organ + SATBB, or Piano + Part 1/2), mix per-part volume, and change
speed 0.5x–1.5x with pitch preserved. **No sheet music, MIDI display, or waveforms.**

## Roles
- **Architect: the repo owner.** Rules on every decision. ADRs in `docs/adr/` are binding;
  changing one requires a new/amended ADR approved by the architect.
- **Tech lead (Opus):** writes ADRs, slices issues, reviews PRs against ADRs.
- **Engineers (Sonnet, medium effort):** own one workstream/issue each; delegate tests,
  fixtures, and boilerplate to Haiku subagents.

Humans: the Hard rules, Conventions, and Commits/PRs sections apply to you too; the role split above describes the AI team.

## Hard rules
1. **No music in the repo, ever.** No audio files, no `.band` projects, no real song
   manifests or choir tokens. Test audio is generated at test time (ffmpeg sine/click
   tracks) — see `.gitignore`.
2. The R2 bucket is **never public**. Audio is only served by the Worker after an access check.
3. Songs, parts, and choirs are **data, not code**. Adding a song or choir must never
   require a code change or deploy.
4. Part labels are free-form. Never hard-code SATB, "organ", "piano", or part counts.
5. Stay on Cloudflare free tier. Anything that would incur cost needs architect approval.
6. Deploys happen via GitHub Actions only. No manual `wrangler deploy` to production. Sole exception: an emergency rollback in the Cloudflare dashboard with the architect's explicit OK, followed by a revert PR (docs/deploy.md → Rollback and incidents).

## Architecture (see ADRs)
```
Browser ──> Cloudflare Worker (practice.jpatrickbeal.com)
              ├─ static assets: React SPA (Vite)
              ├─ /c/:choirId/:token   redeem choir link -> signed cookie, redirect to /
              ├─ /api/*   Hono: list granted choirs and song manifests
              └─ /audio/* check cookie grant -> stream from R2 binding
                              └─ R2 (private): manifests/*.json, audio/<song>/<part>.<hash>.m4a
```

## Layout
| Path | What |
|---|---|
| `src/web/` | React + TS + Tailwind v4 + shadcn/ui SPA: `pages/`, `components/`, `player/` (state), `lib/` (`mixer`, `saved` prefs, `storage`, `partColors`, `cover`, `format`), `api/`, `engine/` (real vs mock) |
| `src/web/audio/` | Production audio engine (Signalsmith Stretch, 24 kHz); has its own README |
| `src/worker/` | Hono Worker (link redemption, signed-cookie grants, manifests, audio proxy) |
| `src/shared/` | Zod schemas for manifests and API responses, R2 key helpers |
| `tools/cli/` | `choir` CLI: encode/upload songs, manage choirs & links, delete songs |
| `scripts/` | `seed-local.ts`: fake content for local dev and e2e |
| `test/` | Worker tests (run in the Workers runtime); unit tests also sit next to their code as `*.test.ts` |
| `e2e/` | Playwright tests (+ `harness/`, a test-only engine page) |
| `public/` | Static files copied as-is (`robots.txt`, `_headers`) |
| `infra/` | OpenTofu (R2 buckets; the custom domain is owned by wrangler, not tofu) |
| `.github/workflows/` | `ci.yml` (reusable), `pr.yml`, `deploy.yml`, `bootstrap.yml` |
| `spikes/` | Reference prototypes (engine comparison, UI styles). Not built, not production code |
| `docs/` | `architecture.md`, `development.md`, `deploy.md`, `adding-songs.md`, `roadmap.md`, `adr/` (binding decisions: read before changing anything structural) |

New here? Read `README.md`, then `docs/architecture.md` and `docs/development.md`.

## Environments
- Prod: https://practice.jpatrickbeal.com (`main`). Dev and PR previews: https://practice-buddy-dev.jpatrickbeal.workers.dev (`develop`).

## Conventions
- pnpm; TypeScript strict; Vitest for unit tests; Playwright for e2e. Workflow, tests and PR rules: `docs/development.md`.
- Validate every manifest read with the Zod schema in `src/shared/`.
- Mobile-first UI; most users are on phones. Non-technical copy (see ADR-0011).

- Agent shells: `ls` may be aliased and hang; use `command ls`, `find` or `stat`.

## Commits and PRs
- Branch from `develop`; open PRs into `develop`. `develop` → `main` releases go through a PR too. The architect's approval is the deploy approval.
- Commit trailers name the model that actually wrote the commit (e.g. `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`).
