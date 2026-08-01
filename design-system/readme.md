# Orion Cranes — Design System

**ORİON VİNÇ MÜHENDİSLİK / Orion Cranes** is a crane manufacturer. 25 years in lifting and conveying equipment, serving from a 6.000 m² plant in Ankara Başkent Organize Sanayi Bölgesi. The company designs, manufactures, installs and maintains complete crane systems — plus the electrical panels and industrial automation that run them. Positioning, in its own words: *Yüksek Performanslı Endüstriyel Çözümler* — high-performance industrial solutions that optimise customers' industrial processes. Honesty, customer satisfaction and quality are stated as non-negotiable priorities.

**Product families (11)** — Gezer Köprülü Tavan Vinçleri (overhead travelling cranes, the flagship) · Proses Vinçler (process cranes) · Portal Vinç (gantry) · Pergel Vinç (jib) · Monoraylar (monorails) · Transfer Arabaları (transfer cars) · Bobin Tongları (coil tongs) · Kaldırma Kirişleri (lifting beams) · Vinç Komponentleri (crane components) · Elektrik Pano İmalatları ve Montajları (electrical panels) · Endüstriyel Otomasyon Sistemleri (industrial automation).

**Services (3)** — Yedek Parça Tedariği (spare parts) · Montaj (installation) · Periyodik Bakım ve Muayene (periodic maintenance & inspection).

**Corporate pages on the live site** — Hakkımızda, Tanıtım Filmi, Misyon & Vizyon, Üretim Politikamız, Kalite Politikamız, Referanslar, Blog, İletişim.

**Contact** — `+90 546 906 09 68` · `+90 312 511 48 06` · `info@orioncranes.com` · `orioncranes.com` · Başkent Organize Sanayi Bölgesi 1. Cadde No:20, 06909 Malıköy-Temelli-Sincan / Ankara.

## Source material

| Source | What it is | Notes |
|---|---|---|
| `uploads/Orion Cranes Marka Kimligi.dc.html` | The **Marka Kimliği Kılavuzu** (Brand Identity Guidelines), REV 01 · 2026 — 26 A4 sheets: 3 cover directions, contents, brand essence, logo system (anatomy, construction grid, clear space, variations, color placement, misuse), color palette, typography, type scale, graphic language, iconography, grid & layout, photography direction, and 10 applications (business card, stationery, machine decal & rating plate, signage, workwear & PPE, vehicle livery, drawing title block, social & digital, email signature, contact/colophon). | **The visual source of truth.** Logo vectors and the 8-icon set were extracted programmatically from it into `assets/`. |
| [orioncranes.com](https://orioncranes.com/) | The live company site — read for the real product portfolio, services, positioning copy, strengths list and contact details. | **The content source of truth.** All product, service and contact copy in this system comes from here. |
| Company description (chat) | Turkish company profile: 25 years, 6.000 m² Başkent OSB plant, values, objectives. | Voice and plant figures. |

No codebase, Figma file or design export was provided, and no site code was read — only the published page content. Where this system extends the brand onto screens (the website UI kit, the presentation template, motion tokens, form controls) that extrapolation is labelled — see *Intentional additions*.

> ⚠️ **Scope correction (important).** The uploaded brand book was written as if Orion made **operator cabins, control consoles and electrical rooms** for other people's cranes. That is wrong: Orion manufactures **complete cranes**. Operator cabins are not a product family at all — a cabin is an option on a crane. Everything in this system now describes the real portfolio; only the brand book's *visual* rules (logo, color, type, grid, graphic language, icon construction) were kept, because those are correct and unaffected. Two knock-on effects to be aware of:
> - The brand book's candidate taglines ("Operatörün merkezi." / "Tek elden vinç kabinleri." / "Zorlu sahaya sağlam kabin.") are cabin-era and should be retired or rewritten. This system instead uses the site's own lines: *Yüksek performanslı endüstriyel çözümler* and *Gezer köprülü vinçlerle verimliliği yükseltin*.
> - The eight brand icons are cabin/console-oriented (cabin, hook, console, seat, panel, bolt, safety, gauge). Only **hook, bolt, panel, safety, gauge** carry over cleanly to crane manufacturing. **Crane-type icons do not exist** — see *Iconography*.
>
> Also corrected against the live site: the phone number `+90 544 774 01 01` printed in the brand book is not current (`+90 546 906 09 68` is), and the plant is in **Başkent OSB** (Malıköy-Temelli-Sincan), not Ostim as the book's stationery sheets print.

## Index

**Foundations (root)**
- `styles.css` — the single entry point consumers link. `@import` list only.
- `tokens/` — `fonts.css` · `colors.css` · `typography.css` · `spacing.css` · `layout.css` · `elevation.css` · `motion.css` · `base.css`
- `assets/logo/` — lockup / stacked / monogram / wordmark, each in red · ink · paper, plus `currentColor` versions for inline use
- `assets/icons/` — the 8 brand icons as standalone SVGs (`currentColor`, 24×24)
- `thumbnail.html` — project tile

**Components** (`components/<group>/`, each with `.jsx`, `.d.ts`, `.prompt.md`, and one `@dsCard` per folder)
- **brand** — `Logo` · `BrandIcon` · `Kicker` · `SectionHeading` · `SpineFrame` · `StripeFill`
- **core** — `Button` · `IconButton` · `Card` · `Badge` · `Tag`
- **forms** — `Input` · `Textarea` · `Select` · `Checkbox` · `Radio` · `Switch`
- **data** — `SpecTable` · `SquareList` · `StatBlock`
- **navigation** — `Tabs` · `Breadcrumbs`
- **feedback** — `Dialog` · `Toast` · `Tooltip`

**Specimen cards** (`guidelines/`) — 24 cards in the Design System tab, grouped *Colors*, *Type*, *Spacing*, *Brand*.

**UI kits** (`ui_kits/`)
- `brand-applications/` — faithful recreations of the printed/physical applications the guide defines, with crane content
- `website/` — orioncranes.com rebuilt on the brand system: home, products (11 families), services, datasheet, RFQ

**Templates** (`templates/`)
- `product-datasheet/` — A4 product/quote sheet on the guide's exact page anatomy
- `presentation/` — 16:9 deck built from the print grid

**Other**
- `SKILL.md` — Agent-Skills wrapper so this folder works as a Claude Code skill

---

## Content fundamentals

**Bilingual by default, Turkish first.** Nearly every label in the guide is `Türkçe · ENGLISH`: `MARKA KİMLİĞİ KILAVUZU`, then `Brand Identity Guidelines`; `KORUMA ALANI · CLEAR SPACE`; `Kabin` over `CABIN`. Turkish carries the meaning; English rides along in mono, smaller, in gray — a translation gloss, never a duplicate paragraph. Body copy often pairs a full Turkish sentence with a shortened English one:

> Orion Vinç Mühendislik; gezer köprülü tavan vinçlerinden monoraylara, portal ve pergel vinçlerden proses vinçlere kadar geniş bir ürün yelpazesiyle kaldırma ve iletme ihtiyaçlarınızı karşılar.
> *Overhead travelling cranes, monorails, gantry and jib cranes, process cranes — plus the panels and automation that run them.*

**Voice: third person about the company, direct imperative to the reader.** The company is "Orion Cranes" or "biz" implied — never "I". Rules are stated as flat facts or imperatives with no hedging: *"Omurga her zaman solda."* (The spine is always on the left.) *"Logonun bütünlüğünü koruyun."* (Preserve the integrity of the mark.) *"Yeniden dizilmez — yalnızca onaylı vektör kullanılır."* (Never re-typeset — only the approved vector.) No "we believe", no "try to", no exclamation marks.

**Claims are backed by a number or not made at all.** The first brand pillar: *"Her sistem ölçülebilir bir spesifikasyondan doğar; iddia değil, veri."* — every system starts from a measurable specification; data, not claims. So: `20.000 kg`, `16,5 m açıklık`, `FEM 2m · ISO M5`, `380 VAC · 3F · 50 Hz`, `6.000 m²`, `25 yıl`, `≥ 8 mm`. Crane specs always carry capacity, span, hook path and duty class — in that order. Turkish decimal comma (`1,55`), thousands dot (`6.000`), space before units.

**Casing.** Section titles and display lines are UPPERCASE. Mono kickers and labels are UPPERCASE with wide tracking. Sentence case for body and for card titles. Product codes keep engineering casing: `ORC-GKV`, `ORC-GKV 20-16`, `ORC-GKV-A-014`, `FEM 2m`.

**Taglines** (candidates, from the guide): "Operatörün merkezi." / *The operator's command center.* · "Tek elden vinç kabinleri." / *Crane cabins from a single source.* · "Zorlu sahaya sağlam kabin." / *Rugged cabins for demanding sites.*

**Brand pillars** — Mühendislik önce (*Engineering-led*) · Sahaya dayanıklı (*Built for the field*) · Tek elden (*Single source*) · Sürekli destek (*Continuous support* — replaces the book's cabin-era "Operatör merkezli").

**Strengths, verbatim from the site** — Geniş Ürün Yelpazesi · Yüksek Kalite ve Güvenlik · Müşteri Odaklı Çözümler · Hızlı ve Zamanında Teslimat · Sürekli Destek ve Bakım · Profesyonel Hizmet Anlayışı · Teknolojik İnovasyon · Güvenilirlik ve Deneyim · Kapsamlı Destek ve Bakım Hizmetleri · Güçlü Tedarikçi İlişkileri. Title Case, noun phrases, no verbs — use them as a strengths band, not as sentences.

**Punctuation is part of the look.** The middot `·` separates everything (`ANKARA · TÜRKİYE`, `REV 01 · 2026`, `S. 02–07`). En dashes for ranges. Curly quotes around taglines. `≈` for approximations, `→` for direction, `✕` for prohibition, `✓` inside a state. **No emoji, anywhere** — not in UI, not in social copy. Unicode is used as iconography only in these four glyphs.

**Documents identify themselves.** Every sheet carries a footer: `ORION CRANES · MARKA KİMLİĞİ KILAVUZU · REV 01 · 2026` with a folio `07 / 25`, and a doc code where relevant (`ORC-BRAND-01`, `ORC-HC50-A-014`). Reproduce this habit on anything printable.

---

## Visual foundations

### Color
Two primaries do all the work: **Orion Kırmızısı #A41E1E** (P 1805 C · RAL 3003 · CMYK 22/95/95/13) and **Kömür #262626** (Neutral Black C · RAL 9011). Secondary accents are cabin-paint colors: **Çelik Mavisi #1F5C7A** (RAL 5009, LC series) and **Arduvaz #37474F** (RAL 7031, HC series). **Mercan #E8736F** is digital-only and used almost exclusively as the kicker color on charcoal. The neutral ramp is warm, not gray-blue: `#FAF8F7 → #F4F1EF → #E7E4E2 → #DCD9D7 → #B8B2AE → #8A8480 → #6B6663 → #48433F`.

The ratio is fixed: **60 paper · 22 charcoal · 12 red · 6 accent**. Red is an accent — a spine, a rule, a kicker, one button. Large red fields exist (cover direction 1c, directional signage, social posts) but are deliberate events, not defaults. Never red on red: the ghost monogram on a red ground is `#B4322F`, and meta text on red is `#F1C9C7`.

Approved text pairs only: charcoal on paper (AAA), red on paper (AA), paper on red (AA), paper on charcoal (AAA). Success/positive is `#1F8A5B`; there is no amber — warnings ride on red.

### Type
**Archivo** (Google Fonts, 400–900) for everything visible; **IBM Plex Mono** (400–600) for everything technical. The split is absolute: if a string is a measurement, code, page number, revision, label or kicker, it is mono. Prose and headlines are Archivo.

Print roles: Display 900/54px/lh 1/−.02em · Heading 800/26px/lh 1 · Subhead 700/17px · Body 400/12px/lh 1.6 · Caption 500/10px · Mono kicker 600/10px/.22em uppercase · Mono data 500/11px/.06em · Mono micro 400/7.5px/.08em. Screen ladder (`--web-*`) is the same system ×1.35: 72 / 44 / 34 / 22 / 16 / 13 / 11px.

Headings set solid (1.0–1.05) with negative tracking; body 1.5–1.65. Left-aligned as the rule; centering only on covers and mark blocks; right alignment only for mono colophon meta. Measure caps at ~150mm on A4. The wordmark itself is Archivo-derived but is a drawn asset — never re-typeset it.

### Layout
The **red spine** is the structural signature: 8mm on A4, 14px on screen, 10px on cards, pinned to the left edge, and nothing crosses into it. Beside it: 6 columns with 4mm gutters, 16mm top/outer margins, 14mm inner, 11mm foot. Each sheet is header (kicker + uppercase title + right mono meta, closed by a 2px charcoal rule) → 6-column content → footer (doc line + folio). Section headers on charcoal flip the rule to red.

Everything is a rectangle in an orthogonal grid. Cards butt against each other in tight 12px-gap grids; content is aligned to hairlines rather than floated in space. Fixed elements: the spine, the header rule, the footer line.

### Borders, radii, cards
Four border weights: 1px hairline `#DCD9D7`, 1.5px heavy (charcoal, on controls and plates), 2px rule (charcoal, under section titles), 3px accent (red or charcoal, over spec blocks). **Radius is zero everywhere.** The only exceptions in the entire source are social avatars and the rating plate's rivets — both physical/platform constraints, not style choices.

A card is: 1px hairline border, white or `#F4F1EF` ground, square corners, no shadow on screen; content area on top, a hairline, then a mono caption strip below (`Yatay Kilit` / `PRIMARY · HORIZONTAL`). Optional 3px red or charcoal rule across the top marks a spec or rule block. Charcoal "rule boxes" (`KURAL · RULE` in coral over paper text) carry the hard constraints.

### Shadow, transparency, blur
Shadows are neutral black and reserved for objects that physically exist: `0 6px 18px /.14` letterheads and plates, `0 8px 22px /.28` business cards and decals, `0 12px 30px /.32` facade signs, `0 10px 44px /.45` an A4 sheet on a desk. Screen UI is flat. **No blur, no frosted glass, no glow anywhere in the source.** Transparency appears three times only: the modal-style scrim over photography (`rgba(0,0,0,.35)`), a 7% red tint marking grid columns, and the red→charcoal duotone overlay. Gradients are effectively absent — the two present are a subtle paper gradient (`160deg, #F1EEEC → #E5E1DE`) behind mockups and a brushed-steel gradient on the rating plate (`135deg #4A5158 → #37474F → #2C363C`). **No purple/blue gradients, ever.**

### Imagery
Product shots: 3/4 perspective, grounded shadow, high resolution, clean ground. Site shots: real working environments — ports, steel mills, open yards. Color is neutral and contrast is clean: no filters, no grain, no warm/cool grade. Interior shots go tight on the console. The one stylised treatment is the **red duotone** (`linear-gradient(135deg, rgba(164,30,30,.9), rgba(38,38,38,.9))`) for covers and hero emphasis. Don'ts, verbatim: heavy filters, tilted horizon, busy background, low resolution. Where photography does not exist yet, use the **135° diagonal stripe field** with a bracketed label (`[ ÜRÜN · 3/4 PERSPEKTİF ]`) — that is the guide's own placeholder, and `StripeFill` implements it. Never substitute an illustration.

### Graphic language
Six devices carry the brand beyond the logo: the red spine · the mono kicker over a 44×5px red rule · the charcoal section tag (big letter + label + page range) · the 7px red square bullet · the 135° diagonal stripe field · corner registration ticks (9px, 1.5px, `#B8B2AE`) with `≈ 1800 mm`-style dimension marks. All are sharp-cornered and technical. Blueprint grids (20px `#EDEAE8` lines on white) back logo-construction and specimen areas.

### Motion, hover and press
The printed guide specifies **no motion**, so the interactive layer is deliberately minimal and documented as an addition: 120ms for control feedback, 180ms for surfaces, `cubic-bezier(.2,0,.2,1)` — linear-ish with no overshoot. **No bounce, no spring, no scale on press, no shadow lift.** Hover = a color step, nothing else: red darkens to `#7D1717` (the source's own link-hover value), charcoal lifts to `#3A3633`, outline buttons fill charcoal and flip their label to paper, ghost text darkens. Focus is a 2px solid red outline at 2px offset — never a soft ring. Press is the hover color held; state change is instant. Disabled = `#E7E4E2` ground, `#8A8480` label, `#DCD9D7` border.

---

## Iconography

There is **no icon font and no third-party icon set** in the source. The guide draws its own eight-icon set and states the construction rules: 24×24 unit grid, 2 units of internal padding, **1.5 stroke, square caps, round joins, sharp corners, no fill**, charcoal `#262626` as default with red for emphasis, minimum 16px with the stroke scaling proportionally.

The eight icons — extracted verbatim into `assets/icons/` and shipped as `<BrandIcon>` — are **Kabin (cabin) · Kanca (hook) · Kumanda (console) · Koltuk (seat) · Elektrik Panosu (panel) · Bağlantı (bolt) · Emniyet (safety) · Gösterge (gauge)**. They are product concepts, not UI glyphs — and they were drawn for the cabin-era brief. **Only `hook`, `bolt`, `panel`, `safety` and `gauge` transfer cleanly to crane manufacturing;** `cabin`, `console` and `seat` now describe options on a crane rather than products. There is **no icon for a köprülü, portal, pergel, monoray or proses crane**, so this system does not fake one: product cards identify themselves with the mono product code and a category badge instead. If you want crane-type icons, they should be drawn on the same 24-unit / 1.5-stroke / square-cap rules and added to `assets/icons/` + `BrandIcon` — do not substitute a third-party set.

For UI affordances the source uses **unicode characters, not icons**: `→` on directional signage and CTAs, `✕` on misuse plates and close controls, `◄ ►` as annotation pointers, `·` as separator, `≈` for approximation. Follow that: use the four glyphs above rather than importing a chevron/close/arrow icon set. `Select` uses `▾` as the one addition (documented below).

**No emoji.** If a new product concept needs an icon, draw it on the same 24/1.5/square-cap rules; do not mix in Lucide, Heroicons or Material — their stroke ends and corner radii are wrong for this brand. No CDN icon library is linked anywhere in this system.

---

## Intentional additions

Things this system contains that the source does not define, and why:

1. **Form controls** (`Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`) — the guide has no screen UI, but consumers need a quote/RFQ form. Built strictly from existing rules: square boxes, 1.5px borders, mono uppercase labels, red focus. **`Radio` is circular** — the deliberate third radius exception, for affordance. **`Select` uses `▾`**, the only glyph added to the unicode set.
2. **Motion tokens** — the source is silent on animation; see the Motion section for the constraints chosen.
3. **`--web-*` type ladder** — the print roles ×1.35, so 12px body copy does not land on a website.
4. **Screen semantic colors** — `--oc-success #1F8A5B` is taken from the guide's contrast badges; there is no amber in the palette, so warning aliases to red.
5. **`ui_kits/website/`** and **`templates/presentation/`** — extrapolations. Every value in them comes from the guide, but the layouts have no counterpart in the source. Treat them as proposals, not as documented standards.

## Not in the source (do not invent)

No photography, no product renders, no plant or site imagery, no illustrations, no video, no favicon, no app. The live site's photography was **not** copied into this system — every image area uses the guide's 135° stripe placeholder, so real shots must be dropped in.

**Every technical value in this system is placeholder engineering data.** Product codes (`ORC-GKV`, `ORC-PRS`, …), capacities, spans, hook paths, duty classes, IP ratings, option codes and people (`Ahmet Yılmaz`, `M. Demir`) were written to look right, not to be right. The 11 product **names and categories** are real (from orioncranes.com); the numbers are not. Replace them from the real catalog before anything is published, printed or sent to a customer.
