# ADR-0011: MVP scope and UX principles
- Status: Accepted
- Date: 2026-11-08
## In scope (MVP)
- Choir home: list of songs.
- Player: play/pause, scrubber with time, back/forward 10 s, **A–B loop**.
- Speed slider 0.5x–1.5x in 0.05 steps; snaps at 1.0x; reset.
- Mixer: per part on/off, volume, solo; "Reset mix"; **"Focus my part"** (boost the chosen part, lower the others).
- Each person's mix/speed remembered per song (localStorage).
- Theme: light/dark/system + accent presets.
## Out of scope
Sheet music, MIDI notes, waveforms, accounts, downloads.
## Later
Per-part pan, offline/PWA, rehearsal markers, admin web upload, per-song links.
## UX principles
Mobile-first, large touch targets, plain words ("Your part", "Slower/Faster"), no audio jargon in the default view.
