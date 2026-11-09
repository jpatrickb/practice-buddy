# ADR-0011: MVP scope and UX principles
- Status: Accepted
- Date: 2026-11-08
## In scope (MVP)
- Choir home: list of songs.
- Player: play/pause, scrubber with time, back/forward 10 s, **A–B loop**.
- Speed slider 0.5x–1.5x in 0.05 steps; snaps at 1.0x; reset.
- Mixer: per part on/off and volume (0–2, resting at the manifest defaultGain). **No solo button.** "Reset mix" restores defaults.
- **Part picker ("Which part do you sing?")**: a shortcut that *sets* the mixer. The mixer is always the truth.
  - Picking a voice part turns it on and **mutes** the other voices (not ducked).
  - A separate accompaniment switch, labelled from the data (e.g. "Organ"), is on by default.
  - Users may then turn other parts on themselves (e.g. Baritone adds Bass).
  - Optional "Everyone, my part louder": all parts play, with the others lowered relative to the chosen part.
- Each person's mix, speed and picked part remembered per song (localStorage). The repeat section is **not** remembered.
- Theme: light/dark/system + accent presets.
## Out of scope
Sheet music, MIDI notes, waveforms, accounts, downloads.
## Later
Per-part pan, offline/PWA, rehearsal markers, admin web upload, per-song links.
## UX principles
Mobile-first, large touch targets, plain words ("Your part", "Slower/Faster"), no audio jargon in the default view.

## Visual direction (2026-11-08, architect ruling)
**"Fusion"**: Now Playing's structure (large generated cover art with the title centered underneath, frosted-glass panels, song cards with cover thumbnails, two columns on desktop) with Studio's colors (dark base with a blue/violet glow, a distinct color per voice part on its chip, slider, on/off button and meter, a neutral color for accompaniment, and a violet gradient play button that pulses while playing).
- **No colored left borders or left tints on rows.** The architect rejected that pattern.
- Dark-only for MVP. A light variant may come later, using the same tokens with darker part colors for contrast.
- Reference mockup: `spikes/ui-styles/index.html` (Fusion direction).
