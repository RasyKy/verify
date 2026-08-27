# Verify - Design System

The single source of truth for UI decisions. Tokens live in
`frontend/app/assets/css/design-tokens.css`. This file explains how to use them
and what is not allowed.

The audit that produced these rules found 26 font sizes, every integer from 1px
to 10px in use as a `gap`, 37 container widths, and 6 independent
implementations of the status pill. Every rule below exists to prevent a
specific one of those.

---

## The one rule

**Scoped `<style>` blocks are where consistency goes to die.** Almost every
inconsistency in this codebase originated in a `<style>` block, because writing
`font-size: 13.5px` is easier than finding the right token.

Default to utility classes. Reach for `<style>` only when the styling genuinely
cannot be expressed as utilities (keyframes, complex gradients, `::-webkit-*`
pseudo-elements, container queries). When you do, use `var(--token)` and never a
raw value.

---

## Typography

Seven sizes. Three weights. No exceptions.

| Class | Size | Use for |
|---|---|---|
| `text-xs` | 12px | Metadata, table column labels, chips, timestamps |
| `text-sm` | 13px | Secondary body, table cells, form help text |
| `text-base` | 15px | Body text (default, rarely needs stating) |
| `text-lg` | 18px | Card titles, lead paragraphs |
| `text-xl` | 22px | Section headings |
| `text-2xl` | 28px | Page titles, stat numerals |
| `text-3xl` | 40px | Hero and display only. Landing page, not portals. |

Weights: `font-medium` (500) for UI labels and buttons, `font-semibold` (600)
for headings and card titles, `font-bold` (700) for display and stat numerals.
Body text takes no weight class.

**Display face.** Bricolage Grotesque is opt-in via the `font-display` class.
It is not applied automatically to `h1`-`h4`. Use it on page titles, section
headings, stat numerals, and the landing page. Do not use it for body text,
table cells, form labels, or button labels.

**Banned:** any `font-size` in a `<style>` block. Any `text-[14px]` arbitrary
value. Any weight other than 500/600/700.

---

## Color

**Brand.** `brand-600` is the primary action color, `brand-700` is
hover/pressed, `brand-50` is the light wash.

Reserve it for **one job per screen**: the primary action. A screen with an
accented button, an accented icon, an accented badge, and an accented link has
no emphasis at all, because emphasis is relative.

Specifically:
- Primary buttons, active nav item, focus rings, links: **brand**
- Card icons, decorative marks, secondary buttons: **gray**
- Toggles: gray when off, brand when on

**Neutrals.** Use `gray-*` utilities. The scale is warm-tuned to match the ink
color, so `text-gray-800` and `var(--text-primary)` are now the same value.
Prefer the utility.

Ink hierarchy: `text-gray-800` primary, `text-gray-500` secondary,
`text-gray-400` tertiary. Three levels, not five.

**Status colors** belong to `StatusChip` and nothing else. Do not use
`text-green-600` or `bg-red-50` to indicate certificate state.

**Banned:** hex or `rgba()` literals in `<style>` blocks. The audit found 50 hex
and 58 rgba literals. Exceptions, which must be commented as such: third-party
brand marks (the Google "G" SVG paths) and chart.js dataset config, which cannot
read CSS variables.

---

## Spacing

Tailwind's scale only: `1`=4px, `2`=8px, `3`=12px, `4`=16px, `6`=24px,
`8`=32px, `12`=48px, `16`=64px.

Use proximity to signal grouping. This is what makes a layout read as
considered rather than assembled:

| Relationship | Value |
|---|---|
| Label to its value | `gap-1` (4px) |
| Items within a group | `gap-2` / `gap-3` |
| Between groups in a card | `gap-4` |
| Card internal padding | `p-5` |
| Between sections | `mb-8` / `mb-12` |
| Page top and bottom | `py-12` (portal), `py-16` (public) |

**Banned:** `gap: 7px`, `padding: 22px 18px 18px`, and every other raw value.
If a design needs a value not on the scale, the design is wrong, not the scale.

---

## Layout

Three container widths. Nothing else.

| Class | Width | Use for |
|---|---|---|
| `max-w-prose` | 704px | Legal pages, auth forms, single-column forms |
| `max-w-content` | 960px | Portal pages, certificate and verify pages |
| `max-w-wide` | 1120px | Landing page, public holder profile |

**Alignment.** Content is left-aligned within its container. Centering is
reserved for: auth pages, single-purpose entry pages (`/verify`), and empty
states.

Do not center a heading above left-aligned content, and do not center a profile
header above a left-aligned list. Mixed alignment within one page is the single
most visible tell of an unpolished UI, and it is currently present on
`/recipient` and `/p/[holderId]`.

All three certificate-facing pages (`/cert/[certId]`, `/verify/[certId]`,
`/verify`) must share `max-w-content`. A user experiences them as one surface.

---

## Components

**Never hand-roll something Nuxt UI provides.** Use `UButton`, `UModal`,
`UInput`, `USelect`, `UTable`, `USwitch`, `UFormField`. A raw `<button>` in a
`.vue` file needs a comment explaining why `UButton` could not work.

**One implementation per concept.** Before creating a component, search for an
existing one. The audit found duplicate certificate cards, duplicate stat
cards, duplicate detail modals, duplicate confirm dialogs, and six status pills.

Shared components live in `components/ui/` and take variants via props. They do
not get forked per portal. If the admin version needs a different numeral size
than the issuer version, that is a bug in one of them, not a reason to fork.

**Naming.** A prop named `color` takes Nuxt UI semantic values (`primary`,
`neutral`, `error`, `warning`). If a custom prop takes a different vocabulary,
give it a different name.

---

## Interaction and quality floor

Non-negotiable on every component:

- Keyboard focus is visible (handled globally, do not remove `outline`)
- Every interactive element has a hover state
- Loading states use skeletons matching final layout dimensions, not spinners
  that cause layout shift
- Destructive actions confirm through the shared confirm dialog
- Empty states say what to do next, not just "no data"
- Error states say what went wrong and how to fix it, and do not apologize
- Works down to 375px width
- `prefers-reduced-motion` respected (handled globally)

---

## Copy

Sentence case everywhere. No Title Case buttons, headings, or labels.

Label controls by what happens: "Issue certificate", not "Submit". Keep the same
verb through the flow, so a button reading "Revoke" produces a toast reading
"Revoked".

Never expose implementation vocabulary to holders or verifiers. They see
"certificate", "verified", "issued by". They do not see "hash", "transaction",
"on-chain", or "token" unless they open a details panel that is explicitly about
the blockchain record.
