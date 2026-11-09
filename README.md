# Practice Buddy

A simple, private rehearsal-track player for choirs. Members open their choir's link,
pick a song, choose which parts to hear, set each part's volume, and slow it down
(0.5x–1.5x) without changing pitch.

- No accounts: each choir gets a private link.
- Works on phones.
- Songs are added as data. The app never needs a code change to add a song.

This repository contains only code. No music is stored here.

See [`docs/adr/`](docs/adr/) for design decisions and [`CLAUDE.md`](CLAUDE.md) for contributor rules.

License: MIT

## Adding songs and links

See [`docs/adding-songs.md`](docs/adding-songs.md) (`pnpm choir ...`).

## Development

```sh
pnpm install && pnpm seed && pnpm dev   # see docs/deploy.md for the local link and for deployment
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
