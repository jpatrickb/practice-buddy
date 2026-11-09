# Self-hosting Practice Buddy

Run your own copy for your choir on your own Cloudflare account. You fork the repo, change **one config file**
(`deployment.json`), add some secrets, and GitHub Actions does the rest. No code edits. Background:
[ADR-0012](adr/0012-configurable-deployment.md). This guide wraps the detailed steps in [deploy.md](deploy.md).

## What you get and what it costs

Your own site where choir members open a private link and practice with any mix of parts, at any speed.
It runs on free tiers:

| Service | Free allowance | What it means for a choir |
|---|---|---|
| Cloudflare R2 (storage) | 10 GB, 1M writes + 10M reads / month, free downloads | A 6-part, 4-minute song is about 17 MB, so **roughly 500+ songs** |
| Cloudflare Workers | 100,000 requests / day | A dozen singers opening songs a few times a day use a tiny fraction (audio is cached in the browser) |
| GitHub (fork, Actions) | Free for public repos; generous minutes for private ones | CI takes a few minutes per change |
| Domain (optional) | You pay your registrar | Without one you use a free `*.workers.dev` address |

Cloudflare may ask for a payment method for some features; none used here should cost money. Check current limits
on Cloudflare's pricing pages, and keep an eye on usage if your choir is large.

## Prerequisites

- A Cloudflare account (free). A domain on Cloudflare DNS is **optional**.
- A GitHub account.
- A Mac or Linux computer with Node 22+, [pnpm](https://pnpm.io), `ffmpeg`, `git`, the GitHub CLI (`gh`) and `openssl`.
  (`brew install node pnpm ffmpeg gh`.)
- Comfort with a terminal and copy-pasting commands.

## Steps

### 1. Fork and clone

```sh
gh repo fork jpatrickb/practice-buddy --clone    # creates <you>/practice-buddy and clones it
cd practice-buddy && pnpm install
export REPO=<you>/practice-buddy                 # used by the commands below
```

On your fork's **Actions** tab, click "I understand my workflows, go ahead and enable them". `develop` is the
default branch.

### 2. Configure your deployment

Edit `deployment.json` (in the fork, directly on GitHub is fine):

```json
{
  "prod": { "domain": "practice.example.org", "workersDevUrl": "" },
  "dev": { "workersDevUrl": "" }
}
```

- `prod.domain`: a hostname on a domain in **your** Cloudflare account, or `""` to use only workers.dev.
- The two `workersDevUrl` values depend on your account's workers.dev subdomain, which you only learn after the first
  deploy. Leave them empty for now; step 8 fills them in.

### 3. Create the Cloudflare API token

Cloudflare dashboard → My Profile → API Tokens → **Create Custom Token**. Permissions:

- Account · **Workers Scripts** · Edit
- Account · **Workers R2 Storage** · Edit
- Account · **Account Settings** · Read
- User · **User Details** · Read, **Memberships** · Read
- **Only if you use a custom domain**, for that one zone: **Workers Routes** · Edit, **DNS** · Edit, **Zone** · Read

Also copy your **Account ID** (dashboard home → right column, or Workers & Pages overview).

### 4. Add GitHub secrets

```sh
gh secret set CLOUDFLARE_API_TOKEN  -R "$REPO"      # paste the token
gh secret set CLOUDFLARE_ACCOUNT_ID -R "$REPO"      # paste the account id
openssl rand -hex 32 | gh secret set COOKIE_SIGNING_KEY_DEV  -R "$REPO"
openssl rand -hex 32 | gh secret set COOKIE_SIGNING_KEY_PROD -R "$REPO"
```

The signing keys protect the access cookies; use different ones for dev and prod. There are no repo variables to
set except `DEPLOY_ENABLED` in step 6.

### 5. Bootstrap (once)

```sh
gh workflow run bootstrap.yml -R "$REPO" --ref develop
gh run watch -R "$REPO"
```

This creates the bucket that stores OpenTofu's state. (It also tries to delete a leftover Worker named
`practice-buddy-preview`, which doesn't exist on a fresh account; that is fine.)

### 6. Turn on deploys and create dev

```sh
gh variable set DEPLOY_ENABLED --body true -R "$REPO"
gh workflow run deploy.yml -R "$REPO" --ref develop -f apply_infra=true
gh run watch -R "$REPO"
```

`apply_infra=true` makes the first run create the R2 buckets with OpenTofu. Afterwards, every push to `develop`
redeploys dev and every push to `main` redeploys production.

### 7. Verify dev

Find your dev address in the deploy log ("Deployed practice-buddy-dev … https://practice-buddy-dev.**<subdomain>**.workers.dev")
or Cloudflare dashboard → Workers & Pages → `practice-buddy-dev`. Then:

```sh
curl -s -o /dev/null -w "%{http_code}\n" https://practice-buddy-dev.<subdomain>.workers.dev/api/choirs   # expect 401
```

A 401 means the Worker is up and correctly refusing visitors without a link. A 500 means a signing key is missing.

### 8. Put your addresses in `deployment.json`

Set `dev.workersDevUrl` to that address (`https://practice-buddy-dev.<subdomain>.workers.dev`, no trailing slash). If
you have no custom domain, also set `prod.workersDevUrl` to `https://practice-buddy.<subdomain>.workers.dev`.
Commit it on a branch and open a PR into `develop` (or commit to `develop` directly if you haven't turned on branch
protection). The CLI uses these to print correct links.

### 9. Add your first song, choir and link

Follow [adding-songs.md](adding-songs.md): `pnpm exec wrangler login` once, then
`pnpm choir add-song`, `add-choir`, `add-song-to-choir`, `new-link` with `--env dev`. Open the link on your phone.

### 10. Release to production

Open a pull request from `develop` into `main` and merge it. The deploy workflow publishes the production Worker
(and attaches your custom domain, if configured; a certificate can take a few minutes). Upload your content to
production with `--env prod` (it asks for confirmation) and create the production choir link.

### 11. Branch protection (optional, recommended)

```sh
for BRANCH in develop main; do
  gh api -X PUT "repos/$REPO/branches/$BRANCH/protection" --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["ci / checks", "ci / infra", "ci / e2e"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null
}
JSON
done
```

Set `required_approving_review_count` to 1 if someone other than the PR author can approve. Anyone who can push a
branch can edit workflows, which run with your secrets, so keep write access to people you trust.

## Staying up to date

```sh
git remote add upstream https://github.com/jpatrickb/practice-buddy.git     # once
git fetch upstream && git checkout develop && git merge upstream/develop
```

(or use GitHub's "Sync fork"). Resolve a conflict in `deployment.json` by keeping **your** values. Before merging,
skim new files in `docs/adr/` and anything marked **Proposed**/**Superseded**: they describe behaviour changes.
Changes under `infra/` are applied automatically by the next deploy. Test on `develop` (dev) before releasing to `main`.
`pnpm check:hardcoding` runs in CI and tells you if upstream-sourced code re-introduced an upstream name.

## Troubleshooting

| You see | Likely cause and fix |
|---|---|
| Deploy fails with **403** / "Authentication error" | The API token lacks a permission. The error names it; add it in the dashboard (token edit), re-run the workflow |
| Site returns **500** | `COOKIE_SIGNING_KEY_DEV`/`_PROD` secret missing or shorter than 32 characters; set it and re-run the deploy |
| Custom domain doesn't resolve | The domain must be a zone on the *same* Cloudflare account; token needs the three zone permissions; wait a few minutes for the certificate; check `prod.domain` is a bare hostname |
| `tofu apply` says a bucket **already exists** | You created it earlier by hand. Import it: from `infra/`, `tofu init -backend-config=backend.hcl` then `tofu import cloudflare_r2_bucket.content <ACCOUNT_ID>/practice-buddy-content/default` (and `.content_dev` / `practice-buddy-content-dev`) |
| Workflow runs but nothing deploys | `DEPLOY_ENABLED` isn't `true`, or Actions are disabled on the fork |
| PR preview job fails | The dev Worker doesn't exist yet: run step 6 first |
| `choir` links print only `/c/...` | `deployment.json` has no address for that environment yet (step 8) |
| `Not logged in to Cloudflare` | `pnpm exec wrangler login` |
| `check:hardcoding` fails in CI | Move the named value into `deployment.json` |

More in [deploy.md](deploy.md) and [adding-songs.md](adding-songs.md).

## Your responsibilities as the operator

- **Copyright.** Rehearsal tracks of copyrighted music are for your choir's private practice. Make sure you are
  allowed to make and share them (members should own the printed music). The site is access-controlled and not
  indexed, but anyone with a link can listen, so share links only with choir members and revoke ones that leak.
- **Privacy.** The app has no accounts and collects no personal data; it stores a signed cookie in each member's
  browser. Cloudflare and GitHub log requests under their own policies. Don't put members' personal details in
  song or choir names.
- **Security.** Guard your Cloudflare token and signing keys, rotate links when people leave, and keep your fork updated.

This is not legal advice.
