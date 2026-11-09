variable "account_id" {
  description = "Cloudflare account ID (set via TF_VAR_account_id or a gitignored *.tfvars file)."
  type        = string
}

variable "zone_id" {
  description = "Zone ID of your domain (only if you use a custom domain). Not used by any resource yet: the Worker custom domain is owned by wrangler (see deployment.json). Reserved for DNS/Cloudflare Access later."
  type        = string
  default     = null
}

variable "r2_location" {
  description = "R2 location hint for the content buckets (wnam, enam, weur, eeur, apac, oc)."
  type        = string
  default     = "wnam"
}
