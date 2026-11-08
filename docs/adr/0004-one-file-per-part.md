# ADR-0004: One audio file per part
- Status: Accepted
- Date: 2026-11-08
## Decision
A "part" is exactly one audio file. Multi-track parts (e.g. an organ split across several GarageBand tracks) are mixed down at export time.
## Consequences
The player has no special cases. Any part combination (Organ+SATBB, Piano+2 parts, …) is just N files.
