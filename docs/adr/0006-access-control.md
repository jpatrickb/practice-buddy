# ADR-0006: Access — secret link per choir, then a signed cookie
- Status: Accepted
- Date: 2026-11-08
## Context
Copyrighted arrangements (e.g. Rutter/OUP). Access is for choir members only. Users are non-technical, so logins are not acceptable. Scale is 1–2 choirs of about 12 people.
## Decision
- Link format: `https://practice.jpatrickbeal.com/c/<choirId>/<token>`. The token is 128-bit random, base64url.
  Only `sha256(token)` is stored in the choir manifest. Multiple active tokens are allowed, for rotation.
- Redeeming the link: the Worker verifies it and sets an HttpOnly, Secure, SameSite=Lax cookie holding HMAC-signed grants
  `[{choirId, tokenHashPrefix, exp}]` (365 days). The browser then redirects to `/` so the token leaves the address bar.
  One browser can hold grants for several choirs.
- Every API/audio request checks the signature, checks that the grant's token is still active in the choir manifest (revocation), and checks that the song is in a granted choir.
- Audio responses: `Cache-Control: private, max-age=31536000, immutable` (URLs are content-hashed).
- Hygiene: `X-Robots-Tag: noindex`, no directory listing, a copyright notice in the UI, and no download button.
- Optional later: per-song links, using the same mechanism with `{songId}` grants.
## Consequences
- Anyone who has the link has access. Mitigated by rotating the link (a CLI command).
- Not legal advice: members should own the printed music. Rehearsal tracks are for private practice.
- If we ever need identity checks (more choirs or conductors), add Cloudflare Access email OTP (free up to 50 users).

## Implementation notes (2026-11-08, PR #2)
- Cookie name `__Host-pb_grants` (the `__Host-` prefix blocks cookie injection from subdomains).
- Unauthorised audio requests return **404** (not 403). Only files named in a granted song's manifest are served. The API returns 401 `no_access`.
- Manifests are cached **in memory for 60 s** per isolate rather than via the Cache API. Revocation can take up to ~60 s.
- Links do not expire automatically; the architect rotates them by hand. Grants last 365 days.
