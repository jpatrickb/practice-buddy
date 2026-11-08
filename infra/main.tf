provider "cloudflare" {
  # Auth: CLOUDFLARE_API_TOKEN environment variable.
}

# Private content buckets. Never made public (CLAUDE.md rule 2): the Worker is the only reader.
resource "cloudflare_r2_bucket" "content" {
  account_id = var.account_id
  name       = "practice-buddy-content"
  location   = var.r2_location

  lifecycle {
    prevent_destroy = true # holds the real (copyrighted) rehearsal tracks
  }
}

resource "cloudflare_r2_bucket" "content_preview" {
  account_id = var.account_id
  name       = "practice-buddy-content-preview"
  location   = var.r2_location
}

# NOT managed here, on purpose:
#  - Worker custom domain practice.jpatrickbeal.com  -> wrangler.jsonc `routes` (single owner)
#  - Worker script and its secrets                   -> wrangler / GitHub Actions
#  - practice-buddy-tfstate bucket                   -> bootstrapped once by hand (chicken and egg)
