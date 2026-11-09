# Practice Buddy

A private rehearsal-track player for choirs. Members open their choir's link, pick a song, choose which
parts to hear, set each part's volume, and slow it down (0.5x–1.5x) without changing pitch.
No accounts, works on phones, and songs are added as data, never as code.

- **Production:** https://practice.jpatrickbeal.com (needs a choir link)
- **Dev / PR previews:** https://practice-buddy-dev.jpatrickbeal.workers.dev

```
Browser ─► Cloudflare Worker ─┬─ static React SPA            (src/web)
                              ├─ /c/<choir>/<token>  redeem link → signed cookie
                              ├─ /api/*              list choirs, song manifests (Hono, src/worker)
                              └─ /audio/*  cookie check → stream from private R2: manifests/*.json, audio/…m4a
Browser: Web Audio + Signalsmith Stretch decode all parts and play them in sync (src/web/audio)
Admin:   `pnpm choir …` uploads songs / makes links from a Mac; GitHub Actions deploy; OpenTofu owns the buckets
```

## Quick start

Prerequisites: Node 22+, [pnpm](https://pnpm.io), and `ffmpeg` (`brew install ffmpeg`).

```sh
pnpm install
pnpm seed      # fake 3-part song + a dev choir into local storage (no real music)
pnpm dev       # http://localhost:5173
```

Open the link `pnpm seed` prints: http://localhost:5173/c/dev-choir/dev-token-dev-token-dev-token-0

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server running the SPA and the real Worker against local R2 |
| `pnpm build` / `pnpm preview` | Production build / serve the build |
| `pnpm seed` | Generate the fake song and dev choir into local R2 (needs ffmpeg) |
| `pnpm test:watch` | Vitest in watch mode (Workers pool) |
| `pnpm test` | Unit tests: Worker/shared in the Workers runtime, then CLI/web logic in Node |
| `pnpm test:e2e` | Playwright end-to-end tests (seeds, starts the dev server on port 5273) |
| `pnpm lint` · `pnpm format` · `pnpm format:check` · `pnpm typecheck` | ESLint · Prettier write/check · `tsc -b` |
| `pnpm choir <command>` | Upload songs, manage choirs and links: see [adding-songs.md](docs/adding-songs.md) |

## Where to go next

| I want to… | Read |
|---|---|
| Understand how it fits together, find the right file | [docs/architecture.md](docs/architecture.md) |
| Set up, test, branch, open a PR | [docs/development.md](docs/development.md) |
| Add or remove a song, make or revoke a choir link | [docs/adding-songs.md](docs/adding-songs.md) |
| Deploy, bootstrap Cloudflare, understand CI | [docs/deploy.md](docs/deploy.md) |
| Run my own copy on my own Cloudflare account | [docs/self-hosting.md](docs/self-hosting.md) |
| Roll back a bad release or handle an incident | [docs/deploy.md#rollback-and-incidents](docs/deploy.md#rollback-and-incidents) |
| See why a decision was made | [docs/adr/](docs/adr/README.md) |
| Work on the audio engine | [src/web/audio/README.md](src/web/audio/README.md) |
| See what is done and what is next | [docs/roadmap.md](docs/roadmap.md) |
| Contribute as an agent | [CLAUDE.md](CLAUDE.md) (roles and hard rules) |

## No music in this repo

This repository contains only code. **Never commit audio, GarageBand projects, real song manifests or choir
links** (`.gitignore` blocks the common formats). Test audio is generated with ffmpeg at test time.

License: [MIT](LICENSE)
