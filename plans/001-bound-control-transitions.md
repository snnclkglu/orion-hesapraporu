# 001 — Bound control transitions

- **Status**: DONE
- **Commit**: cf467af
- **Severity**: HIGH
- **Category**: Performance, purpose & frequency
- **Estimated scope**: 4 files, 4 class-name edits

## Problem

Frequently used controls animate every CSS property. This makes unrelated layout or state changes eligible for animation and can move work to layout/paint instead of the compositor.

```tsx
// src/components/ui/button.tsx:8 — current
"... transition-all ... active:not-aria-[haspopup]:translate-y-px ..."

// src/components/ui/badge.tsx:10 — current
"... transition-all ..."

// src/components/ui/tabs.tsx:82 — current
"... transition-all ..."

// src/components/bolum-rayi.tsx:576 — current
"min-h-[2px] shrink transition-all"
```

The section rail is the highest-cost case: up to 117 tick marks may animate width and flex simultaneously whenever selection or hover changes.

## Target

- Buttons transition only color, background, border, opacity and transform, using the existing crisp ORION motion character: `120ms cubic-bezier(.2, 0, .2, 1)`.
- Badges transition only color/background/border.
- Tabs transition only color/background/border/box-shadow; the existing pseudo-element keeps its separate opacity transition.
- Section-rail ticks change geometry immediately. No transition is attached to width or flex.
- Preserve the existing one-pixel button press feedback.

## Repo conventions to follow

- `design-system/tokens/motion.css` defines `--dur-fast: 120ms` and `--ease-technical: cubic-bezier(.2,0,.2,1)`.
- Existing controls use Tailwind arbitrary transition-property utilities and semantic color tokens.
- Do not import a new motion runtime for CSS-level feedback.

## Steps

1. In `src/components/ui/button.tsx`, replace `transition-all` with an explicit transition-property list plus `duration-[120ms] ease-[cubic-bezier(.2,0,.2,1)]`.
2. In `src/components/ui/badge.tsx`, replace `transition-all` with `transition-colors duration-[120ms] ease-[cubic-bezier(.2,0,.2,1)]`.
3. In `src/components/ui/tabs.tsx`, replace `transition-all` with an explicit color/background/border/box-shadow list using the same duration and curve.
4. In `src/components/bolum-rayi.tsx`, remove `transition-all` from the rail ticks. Keep the geometry states and hover state unchanged.

## Boundaries

- Do not change component markup, variants, sizes, focus styles or touch targets.
- Do not change the section rail's three-width status language.
- Do not add dependencies.
- If the cited class strings have drifted, stop and re-audit before editing.

## Verification

- **Mechanical**: `npx tsc --noEmit`, targeted lint, and an exact search proving no `transition-all` remains in `src`.
- **Feel check**: verify button press feedback is immediate, tab changes do not animate layout, and rapidly sweeping the section rail does not produce lag.
- **Reduced motion**: the companion plan handles motion preference; this plan must not introduce new movement.
- **Done when**: all four unbounded transitions are removed and control behavior is otherwise unchanged.
