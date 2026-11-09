# Architecture Decision Records

ADRs are **binding**. Read the relevant one before changing anything structural.

| # | Title | Status | Decision in one line |
|---|---|---|---|
| [0001](0001-platform-cloudflare-workers-r2.md) | Host on Cloudflare Workers + R2 | Accepted | One Worker serves the SPA and API; private R2 buckets; free tier, $0 egress. |
| [0002](0002-audio-engine.md) | Audio engine | Accepted | Web Audio, all parts through one Signalsmith Stretch node at 24 kHz so parts can't drift. |
| [0003](0003-audio-format-and-alignment.md) | Delivery format and alignment | Accepted | Lossless masters in; mono AAC-LC `.m4a` out, same sample count, content-hashed names; `durationSamples` in the manifest. |
| [0004](0004-one-file-per-part.md) | One audio file per part | Accepted | A part is exactly one file; multi-track parts are mixed down at export. |
| [0005](0005-content-model-manifests-in-r2.md) | Content model | Accepted | JSON manifests + audio in R2, no database; adding content is a data write, not a deploy. |
| [0006](0006-access-control.md) | Access control | Accepted | Secret link per choir (only its sha256 stored) → signed cookie of grants; re-checked every request; 404 when denied. |
| [0007](0007-content-ingest-cli.md) | Song ingest CLI | Accepted | `pnpm choir …` encodes and uploads via the architect's wrangler login. |
| [0008](0008-frontend-stack.md) | Frontend and Worker stack | Accepted | Vite + React + Tailwind v4 + shadcn/Radix, Hono Worker, shared Zod schemas, one package. |
| [0009](0009-iac-and-cicd.md) | IaC and CI/CD | Accepted | OpenTofu for buckets, wrangler for Workers, GitHub Actions only; dev (`develop`) and prod (`main`). |
| [0010](0010-domain.md) | Domain | Accepted | Prod `practice.jpatrickbeal.com`; dev and PR previews on `*.workers.dev`. |
| [0011](0011-mvp-scope.md) | MVP scope and UX principles | Accepted | Choir home + player (loop, speed, mixer, focus my part); no sheet music/waveforms/accounts. |
| [0012](0012-configurable-deployment.md) | Configurable deployment for self-hosting | **Accepted** | One `deployment.json` (domain, dev URL) replaces hardcoded names; a fork changes config, not code; a CI guard keeps it so. |

## Adding or amending an ADR

1. Copy [`0000-template.md`](0000-template.md) to the next number, e.g. `0013-short-title.md`
   (Status, Date, Context, Decision, Consequences).
2. To change an accepted decision, either write a new ADR that says "Supersedes ADR-00NN" and mark the old one
   `Superseded by ADR-00MM`, or, for small clarifications, append a dated `## Amendment` section to the old ADR.
3. Add a row to the table above in the same PR.
4. Only the architect accepts an ADR. Propose it in a PR and say what changes in practice; don't change code
   that contradicts an accepted ADR before it is approved.
