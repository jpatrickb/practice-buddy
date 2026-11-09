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

## Visual direction (2026-11-08)
The structure follows prototype A/B (part rows visible). The default shadcn look was rejected as too plain: the app should feel like a real music service. Three styled directions are under review; this ADR will record the pick.
