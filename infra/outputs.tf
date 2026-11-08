output "content_bucket" {
  value = cloudflare_r2_bucket.content.name
}

output "preview_bucket" {
  value = cloudflare_r2_bucket.content_preview.name
}
