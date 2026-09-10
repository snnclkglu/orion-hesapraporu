# 002 — Honor reduced motion

- **Status**: DONE
- **Commit**: cf467af
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file, one scoped media query and two keyframes

## Problem

`src/app/globals.css` has no `prefers-reduced-motion` policy. Radix/shadcn popovers, selects, menus and dialogs use `tw-animate-css` movement, while loading icons use continuous spin. Users who request reduced motion still receive the same position movement and rotation.

Representative current code:

```tsx
// src/components/ui/popover.tsx:86
"... data-[side=bottom]:slide-in-from-top-2 ... data-open:animate-in ..."

// src/components/ui/sonner.tsx:29
<Loader2Icon className="size-4 animate-spin" />
```

## Target

- When `prefers-reduced-motion: reduce` is active, transient Radix surfaces use an opacity-only 80ms entry/exit; their positioning transform remains intact.
- Continuous spinners slow to `1.5s` linear rotation rather than disappearing, so loading state remains legible.
- Ordinary color and opacity feedback is preserved.
- Normal-motion behavior is unchanged.

## Repo conventions to follow

- `design-system/tokens/motion.css` defines `--dur-instant: 80ms`.
- UI primitives expose stable `data-slot` and Radix `data-state` attributes.
- `src/app/globals.css` is the runtime source for global responsive/accessibility behavior.

## Steps

1. Add `oc-reduced-fade-in` and `oc-reduced-fade-out` keyframes that only change opacity.
2. Add a `@media (prefers-reduced-motion: reduce)` block targeting `popover-content`, `select-content`, `dropdown-menu-content`, `dropdown-menu-sub-content`, `dialog-overlay`, and `dialog-content` by `data-slot` and `data-state`.
3. Override only `animation-name` and `animation-duration` for those surfaces; never clear `transform`, because dialog centering depends on it.
4. Within the same media query, set `.animate-spin` to a gentler `1.5s` duration.

## Boundaries

- Do not globally set every animation or transition to zero.
- Do not alter loading semantics or remove progress feedback.
- Do not change normal-motion timing.
- Do not add dependencies.

## Verification

- **Mechanical**: targeted lint/typecheck and exact search confirming the media query exists.
- **Feel check**: with reduced motion enabled, open a select, popover, dropdown and dialog; each should fade without sliding while staying correctly positioned. Confirm a loading spinner remains visible and slower.
- **Normal mode**: repeat with reduced motion disabled and confirm the existing trigger-origin movement remains.
- **Done when**: all listed transient surfaces and spinners honor the preference without losing state feedback.
