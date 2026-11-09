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

## Amendment: environments (2026-11-08, architect ruling)
| | dev | prod |
|---|---|---|
| Branch | `develop` | `main` |
| Worker | `practice-buddy-dev` (workers.dev) | `practice-buddy` (practice.jpatrickbeal.com) |
| Bucket | `practice-buddy-content-dev` | `practice-buddy-content` |
| Signing key | GitHub secret `COOKIE_SIGNING_KEY_DEV` | `COOKIE_SIGNING_KEY_PROD` |
- PRs: CI, then a preview *version* of the dev Worker (alias `pr-<n>`), with the URL commented on the PR.
- The architect's PR approval is the deploy approval. Branch protection on `develop` and `main` requires a PR, 1 approval and green CI. There are no GitHub Environment approval clicks.
- Every Cloudflare-touching job is gated on the repo variable `DEPLOY_ENABLED == 'true'`.
- Worker secrets are uploaded with each deploy via `wrangler deploy --secrets-file`.
- The custom domain is owned by wrangler only. OpenTofu owns the R2 buckets. The state bucket `practice-buddy-tfstate` is bootstrapped by hand.
