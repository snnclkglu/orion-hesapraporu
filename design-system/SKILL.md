---
name: orion-cranes-design
description: Use this skill to generate well-branded interfaces and assets for Orion Cranes (Orion Vinç Mühendislik), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for protoyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Orientation

- `readme.md` — the design guide: sources, content fundamentals, visual foundations, iconography, intentional additions.
- `styles.css` → `tokens/*.css` — link this one file and every token is available as a CSS custom property.
- `assets/logo/` — approved marks (lockup, stacked, monogram, wordmark × red/ink/paper, plus `currentColor` versions).
- `assets/icons/` — the eight brand icons (24×24, 1.5 stroke, `currentColor`).
- `components/<group>/` — React primitives with `.d.ts` props and `.prompt.md` usage notes.
- `guidelines/` — specimen cards for colors, type, spacing, brand devices.
- `ui_kits/brand-applications/` — recreations of the printed/physical applications (stationery, rating plate, signage, workwear, social, correspondence).
- `ui_kits/website/` — the brand on screen: home, 11 product families, services, datasheet, RFQ. `SiteData.jsx` holds all catalog data.
- `templates/product-datasheet/`, `templates/presentation/` — A4 crane datasheet and 16:9 deck starting points.

## Non-negotiables

1. **Zero border radius.** Cards, buttons, inputs, badges — all square. Only social avatars and physical rivets are round.
2. **Red is an accent.** Ratio 60 paper / 22 charcoal / 12 red / 6 secondary. Red spine, red rule, red kicker, one red button.
3. **The red spine sits on the left of every surface** — 8mm print, 14px screen. Nothing crosses it.
4. **Archivo for language, IBM Plex Mono for every number, code, label and kicker.** No exceptions.
5. **Turkish first, English gloss in mono.** No emoji, ever.
6. **No blur, no glow, no gradient** (beyond the documented paper and steel-plate gradients and the red duotone). Screen UI is flat; shadow belongs to printed objects.
7. **Never redraw the logo or the icons.** Copy the SVGs from `assets/`.
8. **No photography exists.** Use the 135° stripe placeholder with a bracketed label instead of substituting stock imagery or illustration.
9. **Orion manufactures complete cranes** — overhead travelling, process, gantry, jib, monorail, transfer cars, coil tongs, lifting beams, components, electrical panels, automation. Operator cabins are an *option on a crane*, not a product. The uploaded brand book says otherwise; the readme's "Scope correction" explains why the book is wrong on content and right on visuals.
10. **Crane specs read capacity → span → hook path → duty class**, in mono. Every number in this system is placeholder data — never present it as real.
