# Deploying practice-buddy

Everything deploys from GitHub Actions (CLAUDE.md rule 6). Two environments:

| | dev | prod |
|---|---|---|
| Branch | `develop` | `main` |
| Worker | `practice-buddy-dev` (workers.dev, no custom domain) | `practice-buddy` at `practice.jpatrickbeal.com` |
| R2 bucket | `practice-buddy-content-dev` | `practice-buddy-content` |
| wrangler | `CLOUDFLARE_ENV=dev` (`env.dev`) | default config |

PRs (same-repo) run CI, then upload a preview *version* of the dev Worker with alias `pr-<n>`
(URL commented on the PR). The architect's PR approval is the approval; there is no separate
deploy-approval click. Until the one-time steps below are done and `DEPLOY_ENABLED` is set
(step 5), `deploy.yml` and the preview job **skip**, so branches stay green.

## Who owns what

| Thing | Owner | Where |
|---|---|---|
| R2 buckets `practice-buddy-content`, `practice-buddy-content-dev` | OpenTofu | `infra/main.tf` |
| OpenTofu state bucket `practice-buddy-tfstate` | `bootstrap.yml` (run once) | step 3 below |
| Workers `practice-buddy` (prod), `practice-buddy-dev` (dev + PR previews), R2 bindings | wrangler | `wrangler.jsonc` |
| Custom domain `practice.jpatrickbeal.com` (and its DNS record + certificate) | **wrangler** (`routes` with `custom_domain`) | `wrangler.jsonc` |
| Worker secret `COOKIE_SIGNING_KEY` (both Workers) | deploy.yml, from GitHub secrets `COOKIE_SIGNING_KEY_DEV` / `_PROD` | step 2 below |

The custom domain has exactly one owner: wrangler. OpenTofu deliberately does not manage it
(two owners would fight over the DNS record). `zone_id` exists as a tofu variable only for future
DNS/Access resources and is unused today.

## One-time bootstrap

You need: the Cloudflare account ID, `gh` logged in with admin access to the repo, and `pnpm install` run.

### 1. Create the Cloudflare API token

Dashboard → My Profile → API Tokens → Create Custom Token. Permissions (see the table below
for why each is needed):

- Account · **Workers Scripts** · Edit
- Account · **Workers R2 Storage** · Edit
- Account · **Account Settings** · Read
- Zone (`jpatrickbeal.com` only) · **Workers Routes** · Edit
- Zone (`jpatrickbeal.com` only) · **DNS** · Edit
- Zone (`jpatrickbeal.com` only) · **Zone** · Read
- User · **User Details** · Read
- User · **Memberships** · Read

Scope the account permissions to this one account and the zone permissions to the one zone.

This one token is also the OpenTofu **state credential**. R2's S3 API accepts API-token-derived
credentials (Access Key ID = the token's id, Secret Access Key = SHA-256 hex of the token value;
[Cloudflare R2 docs](https://developers.cloudflare.com/r2/api/tokens/)), and `deploy.yml` derives and
masks them at run time, so there are no separate state secrets. This requires R2 *admin* access on the
token (Workers R2 Storage: Edit). If `tofu init` reports `AccessDenied`, also add the permission
*Workers R2 Storage Bucket Item Write*.

### 2. Add the GitHub secrets

```sh
gh secret set CLOUDFLARE_API_TOKEN          # the token from step 1
gh secret set CLOUDFLARE_ACCOUNT_ID         # your account id

# Cookie signing keys (ADR-0006): one per environment, different values, >= 32 chars.
# deploy.yml uploads the matching one with each deploy; the deploy fails loudly if it is missing.
openssl rand -hex 32 | gh secret set COOKIE_SIGNING_KEY_DEV  -R jpatrickb/practice-buddy
openssl rand -hex 32 | gh secret set COOKIE_SIGNING_KEY_PROD -R jpatrickb/practice-buddy
```

### 3. Run the bootstrap workflow (once; idempotent, safe to re-run)

```sh
gh workflow run bootstrap.yml -R jpatrickb/practice-buddy --ref develop
gh run watch -R jpatrickb/practice-buddy
```

`bootstrap.yml` is manual-only (not gated on `DEPLOY_ENABLED`). It creates the OpenTofu state bucket
`practice-buddy-tfstate` if missing, and deletes the stray `practice-buddy-preview` Worker from the
earlier preview experiment if it exists.

### 4. Branch protection (recommended; not applied by this repo)

Require a PR and passing CI on both branches. Approvals are set to 0 because the architect is the only
human and all PRs are authored under their account (GitHub does not let you approve your own PR); the
architect's approval is given to the tech lead, who merges.

```sh
REPO=jpatrickb/practice-buddy
for BRANCH in develop main; do
  gh api -X PUT repos/$REPO/branches/$BRANCH/protection --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["ci / checks", "ci / infra"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null
}
JSON
done
```

(Check the exact check names under a PR's "Checks" tab; they are `<caller job> / <called job>`.)
Anyone with write access can still edit workflows in a PR, which run with the repo secrets. Protection
plus review by the tech lead is the control for that; a preview-only token is the stronger fix.

### 5. Turn deployments on, then bring up each environment

Every job that touches Cloudflare (the `deploy` job in `deploy.yml`: tofu + wrangler; the `preview`
job in `pr.yml`) is gated on the repository **variable** `DEPLOY_ENABLED` and is skipped until it is
`true`. Set it only after steps 1-4 are done:

```sh
gh variable set DEPLOY_ENABLED --body true      # `gh variable delete DEPLOY_ENABLED` stops all deploys
```

A Worker must exist before it can hold a secret or receive preview versions, so bring up dev first:

**Dev**

1. Push/merge to `develop`. `deploy.yml` runs CI, `tofu apply` (creates both R2 content buckets because
   `infra/` changed) and deploys `practice-buddy-dev`. If you created a bucket by hand earlier, import it
   first (from `infra/` after `tofu init -backend-config=backend.hcl`; see `infra/backend.hcl.example`):
   `tofu import cloudflare_r2_bucket.content_dev <ACCOUNT_ID>/practice-buddy-content-dev/default`
   (and `.content` / `practice-buddy-content` for prod).
2. The cookie signing key (ADR-0006) is deployed by the workflow from the GitHub secret
   `COOKIE_SIGNING_KEY_DEV` (set in step 2), so there is nothing to do here. Rotating it logs
   everyone out (they just re-open their link). The Worker answers HTTP 500 without a key of at least 32 chars.
   PR preview versions are uploaded to the dev Worker and inherit its secrets (secrets are Worker-level
   and carry over to new versions; not verified against the real account yet).
3. Create the first dev choir and link (until the `choir` CLI exists). You need a song manifest and audio
   in the dev bucket too; for a smoke test use `pnpm seed`-style fake content, or just an empty choir:
   ```sh
   TOKEN=$(openssl rand -base64 24 | tr '+/' '-_' | tr -d '=')     # 32 chars, base64url
   HASH=$(printf %s "$TOKEN" | shasum -a 256 | cut -d' ' -f1)
   cat > /tmp/dev-choir.json <<JSON
   {"schemaVersion":1,"id":"dev-choir","name":"Dev Choir","songs":[],
    "accessTokens":[{"sha256":"$HASH","label":"first dev link","createdAt":"$(date +%F)"}]}
   JSON
   pnpm exec wrangler r2 object put practice-buddy-content-dev/manifests/choirs/dev-choir.json \
     --remote --file /tmp/dev-choir.json --content-type application/json
   echo "https://practice-buddy-dev.<your-subdomain>.workers.dev/c/dev-choir/$TOKEN"
   ```
   Open that link: you should land on the song list. Revoke a link by removing its entry from
   `accessTokens` (effective within ~60 s).

**Prod**

4. Merge `develop` → `main` (PR + approval). `deploy.yml` deploys `practice-buddy` to
   `practice.jpatrickbeal.com`.
5. The key comes from `COOKIE_SIGNING_KEY_PROD`. Repeat the choir step above against
   `practice-buddy-content` (id/label of your choice).

## What the workflows do

- `ci.yml` (reusable; called by `pr.yml` and `deploy.yml`): install → lint → prettier → typecheck →
  unit tests (Workers runtime via Miniflare) → build; and `tofu fmt -check` + `tofu validate` (no credentials).
- `pr.yml` (pull requests): CI, then, for same-repo PRs and only if `DEPLOY_ENABLED`:
  `CLOUDFLARE_ENV=dev pnpm build` and `wrangler versions upload --name practice-buddy-dev --preview-alias pr-<N>`,
  and a PR comment with the preview URL. The version is uploaded, not deployed: it is reachable only at its
  preview URL and uses the dev bucket. (The dev Worker must already exist: see "Dev" above.)
- `deploy.yml` (push to `develop` or `main`, serialised): CI → `tofu apply` only if `infra/` changed in the
  push → build → `wrangler deploy`. `develop` builds with `CLOUDFLARE_ENV=dev`; `main` uses the default config.

## API token permissions: what needs what

| Permission | Needed for |
|---|---|
| Account · Workers Scripts · Edit | `wrangler deploy` (incl. `--secrets-file`), `wrangler versions upload` |
| Account · Workers R2 Storage · Edit | `tofu apply` creating/updating the R2 buckets; wrangler R2 bindings on deploy |
| Account · Account Settings · Read | wrangler resolving the account / workers.dev subdomain |
| Zone · Workers Routes · Edit | attaching the custom domain `practice.jpatrickbeal.com` on deploy |
| Zone · DNS · Edit | wrangler creating the custom-domain DNS record |
| Zone · Zone · Read | wrangler looking up the zone for the custom domain |
| User · User Details · Read, Memberships · Read | wrangler's account lookup (`whoami`) when only a token is provided |

Not needed by the token: the data in the content bucket (the Worker reads it through its binding).

> These permissions were derived from Cloudflare's documented requirements and the resources this
> repo manages; they could not be exercised against the real account yet. If the first deploy fails
> with a 403, the error names the missing permission. Add it and re-run the workflow.

## Credentials needed later (not by this PR)

The `choir` CLI (ADR-0007) uploads audio to R2 through the S3 API from the architect's Mac. That
needs a *separate* R2 S3 token (Object Read & Write on the two content buckets), kept locally and
never put in GitHub. It should have an `--env dev|production` choice (ADR-0007), matching the two buckets.

## Local development

```sh
pnpm install
pnpm seed      # fake 3-part song + dev choir into local R2 (.wrangler/state); needs ffmpeg
pnpm dev       # http://localhost:5173
# then open the link `pnpm seed` printed:
#   http://localhost:5173/c/dev-choir/dev-token-dev-token-dev-token-0
```

`pnpm seed` creates `.dev.vars` (gitignored) with a random `COOKIE_SIGNING_KEY` if you have none;
see `.dev.vars.example`. Nothing local touches the real Cloudflare account.
