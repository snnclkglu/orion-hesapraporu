# ORION UI quality audit — 2026-09-10

## Outcome

The existing ORION brand system remains intact. Impeccable and the selected Emil Kowalski skills were used as project-scoped review and implementation guardrails, not as a replacement design system. The completed changes tighten motion behavior, add an accessible reduced-motion fallback, formalize the UI library policy, and clarify the existing Sonner notification contract.

## Motion review

| Severity | Location | Finding | Standard | Resolution |
| --- | --- | --- | --- | --- |
| HIGH | `src/components/ui/button.tsx`, `badge.tsx`, `tabs.tsx` | `transition-all` made unrelated properties eligible for animation. | Animate only the properties that communicate state. | Replaced with bounded color, border, shadow, opacity and transform transitions using the technical 120 ms curve. |
| HIGH | `src/components/bolum-rayi.tsx` | Dense rail ticks animated width/flex through `transition-all`. | Avoid layout animation on frequent, repeated elements. | Removed the transition; geometry updates immediately. |
| HIGH | `src/components/app-shell.tsx` | Sidebar width transition forced layout work across the shell. | Prefer compositor properties; avoid width animation for large layout containers. | Removed width animation and its hydration-only readiness state. |
| HIGH | Upload and revision progress fills | Progress used animated `width`. | Use transform-based progress for frequent updates. | Converted five fills to clamped `scaleX`, 200 ms linear, with reduced-motion opt-out. |
| MEDIUM | `src/app/globals.css` | Radix surfaces and spinners lacked a project-level reduced-motion policy. | Respect `prefers-reduced-motion`. | Added opacity-only 80 ms surface transitions and slowed continuous spinners to 1.5 s. |

**Verdict:** The audited motion is now purposeful, bounded and accessibility-aware. No `transition-all` or `transition-[width]` remains under `src`.

## Sonner review

- A single root toaster remains in `src/app/layout.tsx`.
- Existing calls use typed variants; no plain ambiguous `toast(...)` calls were found.
- Loading flows already update a stable toast id instead of creating duplicate notifications.
- Long error messages already remain dismissible with an explicit close control.
- The toaster now exposes the Turkish container label `Bildirimler`.
- A dead wrapper class was removed; visual styling remains owned by the established toaster configuration.

**Verdict:** Keep Sonner. Its current use is consistent with the app's notification needs and does not justify a library change.

## UI library policy

The current stack is internally consistent: Radix/shadcn primitives, cmdk, Sonner, dnd-kit, CVA/clsx and next-themes each have a clear role. Motion, React Virtuoso, Recharts or NumberFlow should be added only when a concrete feature demonstrates a need that the current stack cannot meet. This policy is recorded in `docs/agent/ui-library-policy.md`.

## Visual verification

The signed-in production application was inspected read-only to validate the incumbent visual system and responsive behavior. No production record was created, edited, saved, published or deleted.

| Surface | Desktop | Mobile 390 px | Observation |
| --- | --- | --- | --- |
| Dashboard / shell | Checked | Existing compact shell checked | Brand, navigation hierarchy and dense control-room character remain coherent. |
| Jobs | Checked | Checked | Table becomes a compact three-column card/table hybrid; no page-level horizontal overflow. |
| Projects and project detail | Checked | Project flow checked through editor | Hierarchy and primary actions remain legible. |
| Revision editor | Checked | Checked | Section rail becomes a section picker; form collapses to one column; no page-level horizontal overflow. |
| Technical drawings | Checked | Checked | Dense table converts to stacked records; no page-level horizontal overflow. |
| Purchasing | Checked | Not included in the final mobile sample | Desktop information density remains controlled and consistent. |

The production site does not yet contain the local motion changes; it was used to verify the existing brand and responsive structure. The local production build verifies the changed source.

### Low-priority follow-up

On the mobile Jobs view, some title links have a roughly 15 px intrinsic text box even though the surrounding row is spacious. Enlarging the title link's own hit area would improve touch ergonomics. This was not changed because it is outside the approved motion/notification/library scope.

## Verification record

| Check | Result |
| --- | --- |
| TypeScript | Passed. |
| Targeted ESLint for changed TypeScript/TSX | Passed. |
| Full ESLint | 0 errors; 136 warnings, dominated by installed skill tooling and existing warnings. |
| Impeccable detector on changed UI files | Passed with 0 blocking findings. Intentional technical grouping stripes are documented through a scoped ignore. |
| Production build | Passed, including TypeScript and generation of 116 static pages. |
| Full Vitest suite | One unrelated coverage failure remains: `mainDutyCyclePct` exists in the electrical type but not in the offer-report transfer mapping. |
| Previously timed-out PDF test | Passed when rerun alone (1 passed, 40 skipped). |

## Documentation and guardrails

- `PRODUCT.md` captures the approved product context and North Star: **Mühendislik Kontrol Masası**.
- `DESIGN.md` and `.impeccable/design.json` capture the existing tokens and compact typography roles.
- `.impeccable/config.json` records the intentional side-tab exception only for `src/app/globals.css`.
- `plans/001` through `plans/003` are complete.
