# Deploying practice-buddy

Everything deploys from GitHub Actions (CLAUDE.md rule 6). Until the one-time steps below are
done, `deploy.yml` and `preview.yml` **skip cleanly** (green, with a notice), so `main` stays green.

## Who owns what

| Thing | Owner | Where |
|---|---|---|
| R2 buckets `practice-buddy-content`, `practice-buddy-content-preview` | OpenTofu | `infra/main.tf` |
| OpenTofu state bucket `practice-buddy-tfstate` | You, once, by hand | step 1 below |
| Worker `practice-buddy` (prod), `practice-buddy-preview` (previews), R2 bindings | wrangler | `wrangler.jsonc` |
| Custom domain `practice.jpatrickbeal.com` (and its DNS record + certificate) | **wrangler** (`routes` with `custom_domain`) | `wrangler.jsonc` |
| Worker secret `COOKIE_SIGNING_KEY` | You, once | step 4 below |

The custom domain has exactly one owner: wrangler. OpenTofu deliberately does not manage it
(two owners would fight over the DNS record). `zone_id` exists as a tofu variable only for future
DNS/Access resources and is unused today.

## One-time bootstrap

You need: the Cloudflare account ID, `gh` logged in with admin access to the repo, and `pnpm install` run.

### 1. Create the OpenTofu state bucket (chicken-and-egg: tofu cannot create its own state store)

```sh
# Create the bucket (any wrangler login that can edit R2, or use the dashboard: R2 -> Create bucket)
pnpm exec wrangler r2 bucket create practice-buddy-tfstate
```

Then in the dashboard: **R2 → Manage R2 API Tokens → Create API token**, permission
**Object Read & Write**, scoped to the bucket `practice-buddy-tfstate` only. Copy the
*Access Key ID* and *Secret Access Key* (these are S3-style credentials, separate from the
Cloudflare API token in step 2).

### 2. Create the Cloudflare API token

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

### 3. Add the GitHub secrets

```sh
gh secret set CLOUDFLARE_API_TOKEN          # the token from step 2
gh secret set CLOUDFLARE_ACCOUNT_ID         # your account id
gh secret set TF_STATE_ACCESS_KEY_ID        # from step 1
gh secret set TF_STATE_SECRET_ACCESS_KEY    # from step 1
```

### 4. Set the cookie signing key (Worker secret)

`COOKIE_SIGNING_KEY` signs the access cookies (ADR-0006). Use a long random value; rotating it
logs everyone out (they just re-open their choir link). The Worker refuses to run (HTTP 500)
if it is missing or shorter than 32 characters.

A Worker must exist before it can hold a secret, so do this **after the first merge to `main`**
has deployed (the Worker will answer 500 until the secret is set):

```sh
KEY=$(openssl rand -hex 32)
echo "$KEY" | pnpm exec wrangler secret put COOKIE_SIGNING_KEY                    # production
echo "$KEY" | pnpm exec wrangler secret put COOKIE_SIGNING_KEY --env preview      # previews
```

Prefer a *different* key for preview so preview cookies are worthless against production.

### 5. First deploy

Merge to `main`. `deploy.yml` runs CI, then `tofu apply` (because `infra/` changed in that push),
then `wrangler deploy` for production and for the preview worker. If you created
`practice-buddy-content` by hand earlier, import it first:
`tofu import cloudflare_r2_bucket.content <ACCOUNT_ID>/practice-buddy-content/default`
(run from `infra/` after `tofu init -backend-config=backend.hcl`; see `infra/backend.hcl.example`).

## What the workflows do

- `ci.yml` (PRs; also reused by `deploy.yml`): install → lint → prettier → typecheck → unit tests
  (Workers runtime via Miniflare) → build; and `tofu fmt -check` + `tofu validate` (no credentials needed).
- `deploy.yml` (push to `main`): CI → `tofu apply` only if `infra/` changed in the push →
  `pnpm build` → `wrangler deploy` (production) → rebuild with `CLOUDFLARE_ENV=preview` →
  `wrangler deploy` (the preview worker, so previews have something to attach to).
- `preview.yml` (PRs): `CLOUDFLARE_ENV=preview pnpm build` then
  `wrangler versions upload --preview-alias pr-<N>`, and comments the URL on the PR.
  Previews run as worker `practice-buddy-preview` against `practice-buddy-content-preview`;
  they cannot touch production content.

## API token permissions: what needs what

| Permission | Needed for |
|---|---|
| Account · Workers Scripts · Edit | `wrangler deploy`, `wrangler versions upload`, `wrangler secret put` |
| Account · Workers R2 Storage · Edit | `tofu apply` creating/updating the R2 buckets; wrangler R2 bindings on deploy |
| Account · Account Settings · Read | wrangler resolving the account / workers.dev subdomain |
| Zone · Workers Routes · Edit | attaching the custom domain `practice.jpatrickbeal.com` on deploy |
| Zone · DNS · Edit | wrangler creating the custom-domain DNS record |
| Zone · Zone · Read | wrangler looking up the zone for the custom domain |
| User · User Details · Read, Memberships · Read | wrangler's account lookup (`whoami`) when only a token is provided |

Not needed by the token: the OpenTofu state bucket (uses the separate R2 S3 credentials), and the
data in the content bucket (the Worker reads it through its binding).

> These permissions were derived from Cloudflare's documented requirements and the resources this
> repo manages; they could not be exercised against the real account yet. If the first deploy fails
> with a 403, the error names the missing permission. Add it and re-run the workflow.

## Credentials needed later (not by this PR)

The `choir` CLI (ADR-0007) uploads audio to R2 through the S3 API from the architect's Mac. That
needs a *separate* R2 S3 token (Object Read & Write on the two content buckets), kept locally and
never put in GitHub.

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
