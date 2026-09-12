# Animation plans

These plans record the ORION motion baseline before source edits. Execute them in order because the first removes unbounded transitions, the second establishes the accessibility fallback, and the third removes remaining layout-bound motion.

| # | Plan | Severity | Status | Dependency |
| --- | --- | --- | --- | --- |
| 001 | Bound control transitions | HIGH | DONE | — |
| 002 | Honor reduced motion | MEDIUM | DONE | 001 |
| 003 | Remove layout-bound motion | HIGH | DONE | 001, 002 |

## Recommended order

1. `001-bound-control-transitions.md`
2. `002-honor-reduced-motion.md`
3. `003-remove-layout-motion.md`

After implementation, run the motion review against the diff, the Impeccable detector against changed UI files, and the repository's type/lint checks. Mark a plan `DONE` only after both mechanical and visual verification pass.

- [009 — Çizim İşleme / yerel AutoCAD](009-cizim-isleme-autocad.md) — kontrollü entegrasyon ve kabul aşamaları.
