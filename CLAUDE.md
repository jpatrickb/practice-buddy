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

## Hard rules
1. **No music in the repo, ever.** No audio files, no `.band` projects, no real song
   manifests or choir tokens. Test audio is generated at test time (ffmpeg sine/click
   tracks) — see `.gitignore`.
2. The R2 bucket is **never public**. Audio is only served by the Worker after an access check.
3. Songs, parts, and choirs are **data, not code**. Adding a song or choir must never
   require a code change or deploy.
4. Part labels are free-form. Never hard-code SATB, "organ", "piano", or part counts.
5. Stay on Cloudflare free tier. Anything that would incur cost needs architect approval.
6. Deploys happen via GitHub Actions only. No manual `wrangler deploy` to production.

## Architecture (see ADRs)
```
Browser ──> Cloudflare Worker (practice.jpatrickbeal.com)
              ├─ static assets: React SPA (Vite)
              ├─ /api/*   Hono: redeem choir link -> signed cookie; list songs
              └─ /audio/* check cookie grant -> stream from R2 binding
                              └─ R2 (private): manifests/*.json, audio/<song>/<part>.<hash>.m4a
```

## Layout
| Path | What |
|---|---|
| `src/web/` | React + TS + Tailwind v4 + shadcn/ui SPA |
| `src/worker/` | Hono Worker (auth, manifests, audio proxy) |
| `src/shared/` | Zod schemas for manifests, shared types |
| `tools/cli/` | `choir` CLI: ingest/encode/align/upload songs, manage choirs & links |
| `spikes/` | Throwaway prototypes; not production code |
| `infra/` | OpenTofu (R2 buckets, DNS/custom domain, Access) |
| `docs/adr/` | Architecture Decision Records — read before changing anything structural |

## Conventions
- pnpm; TypeScript strict; Vitest for unit tests; Playwright for e2e.
- Validate every manifest read with the Zod schema in `src/shared/`.
- Mobile-first UI; most users are on phones. Non-technical copy (see ADR-0011).

## Commits and PRs
- Branch from `develop`; open PRs into `develop`. `develop` → `main` releases go through a PR too. The architect's approval is the deploy approval.
- Commit trailers name the model that actually wrote the commit (e.g. `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`).
