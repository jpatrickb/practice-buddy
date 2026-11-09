# ADR-0012: Configurable deployment for self-hosting
- Status: Proposed
- Date: 2026-11-09

## Context
The repo was built for one deployment, and its names were baked into code and workflows: the production domain in
`wrangler.jsonc`, the dev workers.dev URL in the CLI, the owner's GitHub repo in docs and commands. The architect
wants other choirs or organisations to run their own copy on their own Cloudflare account by forking, ideally
without editing code (which would make every upstream update a merge conflict).

## Decision
- **One config file, `deployment.json`, at the repo root**, validated by Zod (`tools/deployment.ts`):
  `prod.domain` (custom domain, optional), `prod.workersDevUrl` (fallback link host), `dev.workersDevUrl`
  (the account-specific `*.workers.dev` address, known after the first dev deploy).
- It is read by: `vite.config.ts` (adds the production custom domain to the Worker config at build time, for
  production builds only, never for `CLOUDFLARE_ENV=dev`); the `choir` CLI (hosts for printed links); and the
  hardcoding guard.
- `wrangler.jsonc` no longer contains a domain. With an empty `prod.domain`, production is served on workers.dev only.
- Fixed, non-secret names stay in code: Worker names `practice-buddy` / `practice-buddy-dev`, bucket names, R2 key
  layout. They only need to be unique per Cloudflare account, so forks don't change them.
- Secrets and account identifiers stay in GitHub secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
  `COOKIE_SIGNING_KEY_DEV/PROD`). `DEPLOY_ENABLED` stays a repo variable.
- **Guard:** `pnpm check:hardcoding` (run in `ci / checks`) fails if the owner's name or any host configured in
  `deployment.json` appears in tracked files other than `deployment.json`, Markdown/docs and `spikes/`.
- A fork edits `deployment.json` (and docs if it wants) and sets its own secrets; see `docs/self-hosting.md`.

## Consequences
- A fork deploys with configuration only. Upstream updates merge cleanly except possibly `deployment.json`, where the
  fork keeps its own values.
- Our own deployment is unchanged: `deployment.json` carries our domain and dev URL.
- Links printed by the CLI depend on `deployment.json` being filled in; if a host is empty the CLI prints only the
  path and says so.
- Hosting on a custom domain still requires that domain to be a zone on the same Cloudflare account.
- Not covered: renaming Workers/buckets, multiple deployments from one fork, non-Cloudflare hosting.
