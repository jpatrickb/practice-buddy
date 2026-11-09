terraform {
  required_version = ">= 1.8.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.28.0"
    }
  }

  # State lives in the R2 bucket `practice-buddy-tfstate` (bootstrapped once by hand; see docs/deploy.md).
  # The account-specific endpoint and credentials are NOT committed; supply them at init time:
  #   tofu init -backend-config=backend.hcl            (local; copy backend.hcl.example)
  #   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY        (R2 S3 API token, env vars)
  backend "s3" {
    bucket = "practice-buddy-tfstate"
    key    = "practice-buddy/terraform.tfstate"
    region = "auto"

    # R2 is S3-compatible but is not AWS.
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
    use_path_style              = true
  }
}
