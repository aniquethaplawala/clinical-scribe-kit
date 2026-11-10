# Design reference (from the user's style file)

Serene clinic on warm parchment: a quiet, editorial healthcare look. 98% achromatic, with two accents used as punctuation.

## Colors

| Token | Value | Use |
|---|---|---|
| `--color-ink-black` | `#28262a` | Headings, body text, heaviest borders |
| `--color-graphite` | `#4a4a4c` | Secondary text, icon strokes |
| `--color-paper-white` | `#ffffff` | Page canvas, cards |
| `--color-parchment-cream` | `#f3f1eb` | Second surface: sidebars, stages, panels behind white cards |
| `--color-fog-border` | `#dddcdd` | Hairlines, badge fills |
| `--color-silver` | `#cbcbcb` | Mid dividers |
| `--color-sky-highlight` | `#97cde5` | One highlighted word inside a heading, soft icon accents. Never backgrounds or body text |
| `--color-sage-action` | `#c8dfaa` | Primary button fill only |

Status colors are not in the palette. For errors use Ink Black text with a Fog Border pill and an icon; do not add red fills.

## Type

- UI font: **Inter** (substitute for Stk Bureau Sans), weights 400/500/600, negative tracking: -0.02em at 16px, -0.03em at 40px, -0.04em at 56px; +0.02em on 12px badges.
- Display font: **Source Serif 4** (substitute for Stk Bureau Serif), 40px and up only, for page openers. Never in buttons, nav, forms or badges.
- Scale: 12 caption / 14 body-sm / 16 body / 18 subheading / 24 heading-sm / 32 heading / 48 heading-lg / 56 display.
- Clinical note text and JSON: a monospace font is fine for JSON/code panels only.

## Shape and space

- 8px base. Spacing 8, 16, 24, 32, 40, 48, 64, 80.
- Radius: cards 16px, images/frames 24px, badges 30px, buttons 100px (always pill), small UI 4px.
- Card: white, 16px radius, 1px `#dddcdd` border or none, 40px padding (24px in dense app panels is fine).
- **No box-shadows.** Elevation = white cards on cream, cream on white.
- Max content width 1200px.

## Components

- **Primary button**: sage fill, ink text, 100px radius, 12px/20px padding, 16px/500, no border, no shadow.
- **Secondary button**: white fill, 1px fog border, ink text, pill.
- **Ghost link**: no background, ink text 14-16px/400, active weight 500.
- **Pill badge**: fog fill (or sky fill for accent), 12px/500, +0.24px tracking, 8px/16px padding.
- **Top bar**: white, logo left (wordmark 18px/500), links right with 32px gaps, primary pill on the right. No border, no shadow.
- **Icons**: mono-stroke, 1.5px, ink color (lucide-react with strokeWidth 1.5 works).

## Do / don't

- Do keep color to the two accents; highlight single words in headings with sky blue.
- Do separate layers with white vs cream, not shadows.
- Don't add new accent colors, gradients as backgrounds, or shadows.
- Don't use serif for UI chrome.
- Don't use the source brand's name or logo; this is a style reference only.
