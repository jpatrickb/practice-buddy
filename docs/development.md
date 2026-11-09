# Development guide

Start with the [README](../README.md) quick start and [architecture](architecture.md). This page is the workflow.

## Local setup

```sh
brew install ffmpeg            # needed by seed, CLI and tests
pnpm install                   # Node 22+
pnpm seed                      # fake song + dev choir into local R2 (.wrangler/state); creates .dev.vars
pnpm dev                       # http://localhost:5173 , real Worker + SPA, hot reload
```

- Local link (printed by `pnpm seed`): `http://localhost:5173/c/dev-choir/dev-token-dev-token-dev-token-0`.
  The token is public and only exists in your local storage.
- `.dev.vars` (gitignored) holds a random `COOKIE_SIGNING_KEY`; see `.dev.vars.example`.
- Silent fake player for UI work without audio: `VITE_MOCK_ENGINE=1 pnpm dev` (`src/web/engine/mock.ts`).
- `pnpm choir <cmd> --env local` writes into the same local R2 that `pnpm dev` reads (see [adding-songs](adding-songs.md)).
- Nothing local touches the real Cloudflare account.

## Tests

| Command | Runs | Where |
|---|---|---|
| `pnpm test` | **Two Vitest pools**: (1) `vitest.config.ts`: `src/**/*.test.ts` and `test/**` inside the Workers runtime (Miniflare) via `@cloudflare/vitest-plugin`, so Worker tests use a real R2 binding; (2) `vitest.cli.config.ts`: `tools/**` in plain Node (needs ffmpeg for fixtures) | CI `ci / checks` |
| `pnpm test:e2e` | Playwright (Chromium; phone 390×844 and desktop 1280×800). Starts `pnpm seed && pnpm dev --port 5273`, redeems the dev link, drives the real player and engine. Reports go to `e2e-results/`, screenshots to `e2e-screenshots/` (both gitignored) | CI `ci / e2e` |
| `pnpm lint` · `pnpm format:check` · `pnpm typecheck` | ESLint, Prettier, `tsc -b` | CI `ci / checks` |

First e2e run: `pnpm exec playwright install chromium`. `e2e/harness/` is a test-only page that exercises the
engine directly; it is not in the production bundle. Add `pnpm exec prettier --write <files>` before committing:
CI fails on formatting.

## Branches, PRs and releases

- `develop` is the default branch. Branch from it (`ws-x/short-name`) and open PRs **into `develop`**.
- Releases: a PR `develop` → `main`. Merging to `main` deploys production; merging to `develop` deploys dev.
- Branch protection on both: PR required, **`ci / checks`, `ci / infra`, `ci / e2e`** must pass, branch must be
  up to date (strict). **0 required approvals**, because every PR is authored under the architect's GitHub
  account and GitHub does not let you approve your own PR. The architect approves in chat; the tech lead merges.
- Every PR gets CI plus a **preview**: the workflow uploads a `pr-<n>` version of the dev Worker and comments the
  URL on the PR (it uses the dev bucket and dev choirs). Previews and deploys run only when the repo variable
  `DEPLOY_ENABLED` is `true`, and previews only for same-repo PRs. Details: [deploy.md](deploy.md).
- ADRs are binding. Don't change one in passing: propose an amendment (see [adr/README.md](adr/README.md)).

## Commits

Small, logical commits. End each with a trailer naming the model that actually wrote it:

```
Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

## Adding a feature safely

1. Read the relevant ADR and the [code map](architecture.md#code-map). Check the [hard rules](../CLAUDE.md).
2. Data shape changes start in `src/shared/schemas.ts` (Zod) and must stay backward compatible with what is
   already in R2; update the CLI and any fixtures in the same PR.
3. Tests to add:
   - **Worker/auth/audio change** → `test/worker.test.ts` (valid, invalid, revoked, tampered; denied cases matter most).
   - **Pure logic** (mixer, timeline, CLI alignment, choir ops) → a `*.test.ts` next to the file.
   - **CLI command** → `tools/cli/*.test.ts` with `MemoryStorage` (no network, ffmpeg-generated fixtures).
   - **User-visible flow** → a case in `e2e/player.spec.ts`; keep it phone-first (no horizontal scroll).
4. `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build` before pushing.
5. Copy for people is plain language, mobile-first ([ADR-0011](adr/0011-mvp-scope.md)).

## Common pitfalls

- **Never commit audio**, GarageBand projects, real manifests or links. Generate fixtures at test time.
- **AudioWorklet needs a secure context**: `localhost` or https. A phone on your LAN over plain `http://<ip>:5173`
  will not play. Test on phones with a PR preview or the dev site (both https). (`pnpm dev:https`, mentioned in
  older notes, does not exist.)
- Browsers only start audio from a tap/click; call `play()` from a user gesture (iOS especially).
- **`ls` may hang in agent shells** (shell alias). Use `command ls`, `find` or `stat`.
- Don't hard-code SATB or part counts; labels and `kind` come from the manifest.
- Never `wrangler deploy` to production by hand; deploys are Actions only. `pnpm choir ... --env prod` changes
  live content and asks for confirmation.
- A dev-server `vite` left running on a port breaks `pnpm test:e2e` locally (it reuses 5273 if present).
