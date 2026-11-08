# UI spike (WS-B): clickable prototype, fake audio

Throwaway prototype for the architect to pick a visual direction. **No audio**: a timer-driven `MockEngine`
implements the `PracticeEngine` interface so the real engine (WS-A) can drop in later.
Stack per ADR-0008: Vite, React, TS strict, Tailwind v4, shadcn/ui, lucide-react. No music in the repo.

## Run it
```sh
cd spikes/ui
pnpm install
pnpm dev            # = vite --host
```
- Computer: http://localhost:5173
- **iPhone on the same Wi-Fi:** open the `Network:` URL Vite prints (like `http://192.168.x.x:5173`) in Safari.
  If it won't load, check the Mac firewall allows incoming connections for Node, and that Wi-Fi "client isolation" is off.
- Pill at the bottom (dev builds only) switches **A / B / C**. `?d=a|b|c` in the URL also works. The choice is remembered.
- The palette icon (top right) sets Light / Dark / Match my phone and 4 colors.
- `pnpm test` runs Vitest (mixer logic, engine). `pnpm shots` (dev server running) writes screenshots to `screenshots/` (gitignored).

## The three directions (same data and logic; only layout/composition differs)
| | A · Cards | B · Console | C · Simple |
|---|---|---|---|
| Idea | One big card per part: on/off switch, "Only" button, labelled volume slider | One compact line per part, all parts visible without scrolling | "Which part do you sing?" + giant Play. Mixer is tucked into a bottom sheet |
| Best for | Clarity, learning the app | Quick tweaks, power users | First-time/older users, "just let me practice" |
| Cost | Long scroll with 6 parts (about 2.5 screens) | Denser, slightly more to parse; small slider tracks | Mixing is one tap deeper; loop is inside the sheet |

## Trade-offs and recommendation
**Recommend C as the default, with B's rows as the content of its sheet** (that's already how C works).
Most singers only need: pick my part, play, maybe slower. C puts exactly that first, and the full mixer
is one tap away. A is the safest fallback if testers don't discover the sheet; it scales worst with many parts.
Because rows are data-driven, a song with 3 or 11 parts works in all three.

## Notes
- Mixer maths is a pure function: `src/lib/mixer.ts` (off, solo, focus, volume → effective gain 0..2). Tested.
- Solo wins over Focus (a soloed part is heard alone). "Focus" boosts your part ×1.5 and lowers the others ×0.35. Placeholder values to tune by ear once real audio exists.
- Per-song memory (`pb.song.<id>`): mix, speed, chosen part/focus. Theme in `pb.theme.*`. Every access is try/catch.
- Plain wording: "Your part", "Slower / Faster", "Normal", "Reset mix", "Repeat section: Start here / End here / Clear". Solo is labelled "Only" ("Hear only Alto" for screen readers).
- Touch targets are at least 44 px; sliders have large thumbs. Slider labels are on the thumb (role=slider) for screen readers.
- Mock manifests in `src/data/songs.ts` use the ADR-0005 shape; parts and "your part" choices come from `parts[]` and `kind`.
