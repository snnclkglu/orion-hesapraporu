# 003 — Remove layout-bound motion

- **Status**: DONE
- **Commit**: cf467af
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 5 files, 6 focused edits

## Problem

Five progress fills animate `width`, forcing layout/paint on every progress update. The desktop sidebar also transitions width even though `width`, `minWidth`, and `maxWidth` change together, creating avoidable layout work and an inconsistent transition.

```tsx
// src/components/app-shell.tsx:452-455 — current
style={{ width: sidebarW, minWidth: sidebarW, maxWidth: sidebarW }}
ready && "transition-[width] duration-200 ease-out"

// src/app/(app)/drawings/new/folder-picker.tsx:432 — current
className="h-full bg-primary transition-[width] duration-200"
style={{ width: `${asama === "yukleme" ? yuzde : 100}%` }}

// src/app/(app)/drawings/new/upload-indicator.tsx:87 — current
className="h-full bg-primary transition-[width] duration-200"
style={{ width: `${asama === "yukleme" || asama === "imza" ? yuzde : 100}%` }}

// src/app/(app)/projects/[id]/revisions/[revId]/revision-editor.tsx:3980,4009 — current
className="h-full bg-primary transition-[width] duration-300"
style={{ width: `${progressPct}%` }}

// src/app/(app)/projects/[id]/drawing-plan-card.tsx:133 — current
className="h-full rounded-full bg-primary transition-[width] duration-300"
style={{ width: `${Math.max(percent, percent > 0 ? 2 : 0)}%` }}
```

## Target

- Sidebar width changes immediately. It is a high-frequency workspace preference and the section rail already documents the same no-width-transition rule.
- Progress fills keep `width: 100%` and animate only `transform: scaleX(progress / 100)` from `transform-origin: left`.
- Progress interpolation is `200ms linear`; reduced-motion mode disables the interpolation but still shows the current value.

## Repo conventions to follow

- The section rail explicitly treats width-state changes as discrete, not narrative motion (`src/components/bolum-rayi.tsx:500-505`).
- Existing progress bars use the semantic `bg-primary` token and a 200ms update cadence.
- No new animation library is needed for predetermined progress motion.

## Steps

1. Remove the conditional width transition from `src/components/app-shell.tsx`; remove the now-unused `ready` state only if it has no other consumer.
2. In the two upload progress bars and three project/revision progress fills, replace transition-width with `origin-left transition-transform duration-200 ease-linear motion-reduce:transition-none`.
3. Replace inline width percentage with `transform: scaleX(value / 100)` and clamp the fraction to `[0, 1]`. Preserve the drawing-plan bar's 2% minimum visible fill for non-zero values.

## Boundaries

- Do not change sidebar dimensions, persistence or responsive behavior.
- Do not change upload state, displayed percentages or API calls.
- Do not change progress-bar markup beyond the fill styling.
- Do not add dependencies.

## Verification

- **Mechanical**: `npx tsc --noEmit`, targeted lint, and a search proving no `transition-[width]` remains in these paths.
- **Feel check**: trigger upload progress and confirm the fill advances left-to-right without changing container geometry. Toggle the sidebar repeatedly and confirm content snaps cleanly with no intermediate squeeze.
- **Reduced motion**: with the preference enabled, progress updates jump to the correct value without interpolation.
- **Done when**: neither sidebar nor progress updates animate layout properties.
