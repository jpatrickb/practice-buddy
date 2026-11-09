output "content_bucket" {
  value = cloudflare_r2_bucket.content.name
}

output "dev_bucket" {
  value = cloudflare_r2_bucket.content_dev.name
}
