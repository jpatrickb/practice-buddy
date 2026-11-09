# ADR-0008: Frontend and Worker stack
- Status: Accepted
- Date: 2026-11-08
## Decision
- Single pnpm package. Vite + `@cloudflare/vite-plugin` builds the SPA and the Worker together.
- SPA: React + TypeScript (strict) + Tailwind v4 + **shadcn/ui** (Slider, Button, Toggle, Switch, Card, DropdownMenu, Sheet) + lucide-react icons.
- Routing: React Router (small). State: React state plus a small store (zustand) for the player.
- Theming: shadcn CSS variables; light/dark/system; 3–4 accent presets; choice saved in localStorage.
- Worker: Hono. Zod schemas shared from `src/shared/`.
- Not Next.js: there is no SSR need, and it brings extra runtime weight.

## Amendment (2026-11-08)
2026-11-08: MVP ships dark-only (Fusion); light mode and accent presets deferred to roadmap 'Later'; implementing them requires amending this ADR.
