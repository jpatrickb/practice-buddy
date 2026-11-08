# ADR-0009: Infrastructure as code and CI/CD
- Status: Accepted
- Date: 2026-11-08
## Decision
- `wrangler.jsonc`: Worker, routes, R2 bindings, `env.preview`.
- `infra/` **OpenTofu** with the Cloudflare provider: R2 buckets, custom domain/DNS record, and later Cloudflare Access. State is stored in an R2 bucket via the S3 backend.
- GitHub Actions:
  - PR: install → lint → typecheck → unit → build → Playwright (against generated fixtures) → deploy a preview version (Workers preview URL).
  - `main`: same checks → `tofu apply` (only if `infra/` changed) → `wrangler deploy`.
- Secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in GitHub; `COOKIE_SIGNING_KEY` as a Worker secret.
- Production deploys go only through Actions.
