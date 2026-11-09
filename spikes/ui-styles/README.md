# UI styles spike

One self-contained file, `index.html`: no build step, no audio, no images. Open it directly in a browser, or publish it as a static page.
It shows the same screens (choir home and player) in three visual directions, switched from the pill at the top.
Deep links: `index.html#studio`, `#now/0`, `#playlist/1` (a song index opens that player).

- **Studio** (dark only): stem-mixer feel. Each part has its own color, a colored-fill slider, a level meter and a glowing play button.
- **Now Playing** (light and dark): generated cover art, a blurred backdrop taken from the cover's colors, frosted-glass panels. Two columns on desktop.
- **Playlist** (light and dark): huge type, numbered track list, a persistent mini-player, and a full player that slides up from it.

The mixer rules match the React prototype: picking your part turns the other voices off, an accompaniment switch, "Everyone, my part louder", volume 0–2 resting at 1.0, Reset mix.
Fonts load from Google Fonts. Everything else is inline.

`node shots.mjs` writes screenshots to `screenshots/` (gitignored). It reuses Playwright from `../ui/node_modules`.
