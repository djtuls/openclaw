# Tulsbot — Brand Identity Standard

> **Status:** Approved (2026-02-17)
> **Visual Reference:** `ui/brand-identity.html` — open in browser for the full interactive guide

---

## Logo System

### Assets

| Variant  | Icon (200×200)                 | Wide (400×120)                 |
| -------- | ------------------------------ | ------------------------------ |
| Gradient | `ui/tulsbot-icon-gradient.svg` | `ui/tulsbot-logo-gradient.svg` |
| Black    | `ui/tulsbot-icon-black.svg`    | `ui/tulsbot-logo-black.svg`    |
| White    | `ui/tulsbot-icon-white.svg`    | `ui/tulsbot-logo-white.svg`    |

- **Default variant:** Gradient (use for most contexts)
- **Black:** High contrast / print / light backgrounds
- **White:** On dark backgrounds, dark UI surfaces
- Icon format: Square with `rx=40` rounded corners
- Wide format: `rx=32` rounded corners
- Robot icon + "Tulsbot" wordmark, Inter 600

### Usage Rules

- Minimum size: 32px for icon, 120px wide for logo
- Maintain clear space equal to the icon's ear width on all sides
- Never stretch, rotate, or recolor the logo
- Never place the gradient logo on a busy or gradient background

---

## Color System

### Brand Colors

| Token              | Hex                           | Usage                         |
| ------------------ | ----------------------------- | ----------------------------- |
| `--brand-gradient` | `#1a1a2e → #16213e → #0f3460` | Primary brand surface, 135deg |
| `--brand-dark`     | `#0D0D0D`                     | Black variant, text           |
| `--brand-white`    | `#FFFFFF`                     | White variant, backgrounds    |

### Primary Palette

| Token           | Hex       |
| --------------- | --------- |
| `--primary-50`  | `#e8edf5` |
| `--primary-100` | `#c5d0e6` |
| `--primary-200` | `#9eb2d5` |
| `--primary-300` | `#7794c4` |
| `--primary-400` | `#597eb8` |
| `--primary-500` | `#0f3460` |
| `--primary-600` | `#0d2d55` |
| `--primary-700` | `#0a2347` |
| `--primary-800` | `#071a38` |
| `--primary-900` | `#04112a` |

### Gray Scale

| Token        | Hex       |
| ------------ | --------- |
| `--gray-50`  | `#F9FAFB` |
| `--gray-100` | `#F3F4F6` |
| `--gray-200` | `#E5E7EB` |
| `--gray-300` | `#D1D5DB` |
| `--gray-400` | `#9CA3AF` |
| `--gray-500` | `#6B7280` |
| `--gray-600` | `#4B5563` |
| `--gray-700` | `#374151` |
| `--gray-800` | `#1F2937` |
| `--gray-900` | `#111827` |
| `--gray-950` | `#0D0D0D` |

### Semantic Colors

| Purpose | Default   | Light     | Dark      |
| ------- | --------- | --------- | --------- |
| Success | `#059669` | `#D1FAE5` | `#065F46` |
| Warning | `#D97706` | `#FEF3C7` | `#92400E` |
| Error   | `#DC2626` | `#FEE2E2` | `#991B1B` |
| Info    | `#2563EB` | `#DBEAFE` | `#1E40AF` |

### Accent Colors

| Token             | Hex       |
| ----------------- | --------- |
| `--accent-cyan`   | `#06B6D4` |
| `--accent-purple` | `#8B5CF6` |
| `--accent-orange` | `#F97316` |
| `--accent-pink`   | `#EC4899` |

---

## Typography

### Font Stack

| Role    | Family         | Fallback                                  |
| ------- | -------------- | ----------------------------------------- |
| Display | Inter          | -apple-system, Segoe UI, Helvetica, Arial |
| Body    | Inter          | -apple-system, Segoe UI, Helvetica, Arial |
| Code    | JetBrains Mono | SF Mono, Fira Code, Consolas, monospace   |

### Type Scale (Major Third — 1.250)

| Token         | Size     | Typical Use        |
| ------------- | -------- | ------------------ |
| `--text-5xl`  | 3.052rem | Hero headings      |
| `--text-4xl`  | 2.441rem | Page titles        |
| `--text-3xl`  | 1.953rem | Section headings   |
| `--text-2xl`  | 1.563rem | Card titles        |
| `--text-xl`   | 1.25rem  | Subheadings        |
| `--text-lg`   | 1.125rem | Lead paragraphs    |
| `--text-base` | 1rem     | Body text          |
| `--text-sm`   | 0.875rem | Captions, metadata |
| `--text-xs`   | 0.75rem  | Labels, badges     |

### Font Weights

| Token               | Value |
| ------------------- | ----- |
| `--weight-light`    | 300   |
| `--weight-regular`  | 400   |
| `--weight-medium`   | 500   |
| `--weight-semibold` | 600   |
| `--weight-bold`     | 700   |
| `--weight-black`    | 800   |

### Line Heights

| Token               | Value |
| ------------------- | ----- |
| `--leading-tight`   | 1.2   |
| `--leading-snug`    | 1.375 |
| `--leading-normal`  | 1.5   |
| `--leading-relaxed` | 1.625 |

---

## Spacing & Layout

### Spacing Scale (4px base unit)

| Token        | rem  | px  |
| ------------ | ---- | --- |
| `--space-1`  | 0.25 | 4   |
| `--space-2`  | 0.5  | 8   |
| `--space-3`  | 0.75 | 12  |
| `--space-4`  | 1    | 16  |
| `--space-5`  | 1.25 | 20  |
| `--space-6`  | 1.5  | 24  |
| `--space-8`  | 2    | 32  |
| `--space-10` | 2.5  | 40  |
| `--space-12` | 3    | 48  |
| `--space-16` | 4    | 64  |
| `--space-20` | 5    | 80  |
| `--space-24` | 6    | 96  |

### Border Radius

| Token           | Value  |
| --------------- | ------ |
| `--radius-sm`   | 6px    |
| `--radius-md`   | 10px   |
| `--radius-lg`   | 16px   |
| `--radius-xl`   | 24px   |
| `--radius-2xl`  | 32px   |
| `--radius-full` | 9999px |

### Shadows

| Token           | Usage                          |
| --------------- | ------------------------------ |
| `--shadow-sm`   | Subtle depth (inputs, badges)  |
| `--shadow-md`   | Cards, dropdowns               |
| `--shadow-lg`   | Modals, popovers               |
| `--shadow-xl`   | Hero sections, floating panels |
| `--shadow-glow` | Brand accent glow              |

### Transitions

| Token                 | Duration | Usage              |
| --------------------- | -------- | ------------------ |
| `--transition-fast`   | 150ms    | Hovers, toggles    |
| `--transition-normal` | 250ms    | General UI changes |
| `--transition-slow`   | 350ms    | Page transitions   |

### Layout

| Token             | Value  |
| ----------------- | ------ |
| `--content-width` | 1120px |
| `--sidebar-width` | 220px  |

---

## Component Patterns

### Buttons

- **Primary:** Gradient background, white text, `--radius-md`, `--shadow-md` on hover
- **Secondary:** White background, primary-500 border, primary-600 text
- **Ghost:** Transparent, gray-600 text, gray-100 bg on hover
- **Danger:** error background, white text
- **Sizes:** `sm` (text-sm, space-2/space-3), `md` (default), `lg` (text-lg, space-3/space-6)

### Badges

- Types: default (gray), primary, success, warning, error
- Dot variant: small colored circle before text
- Font: `--text-xs`, `--weight-semibold`, `--radius-full`

### Alerts

- Types: info, success, warning, error
- Pattern: colored left border (3px), light background, dark text
- Padding: `--space-4`, radius: `--radius-md`

### Cards

- White background, `--radius-lg`, `--shadow-sm`
- Hover: `--shadow-md`, slight translateY(-2px)
- Padding: `--space-6`

### Dark Mode

- Background: `--gray-900`
- Surface: `--gray-800`
- Border: `--gray-700`
- Text: `--gray-100` (primary), `--gray-400` (secondary)

---

## Quick Start — Using Tokens in CSS

```css
/* Import the token system */
:root {
  --brand-gradient: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  --primary-500: #0f3460;
  --gray-900: #111827;
  /* ... copy full token block from brand-identity.html :root {} */
}

/* Usage */
.header {
  background: var(--brand-gradient);
  font-family: var(--font-display);
  padding: var(--space-4) var(--space-6);
  border-radius: var(--radius-lg);
}

.card {
  background: var(--brand-white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--space-6);
  transition: box-shadow var(--transition-normal);
}

.card:hover {
  box-shadow: var(--shadow-md);
}
```

---

## File Reference

| File                           | Purpose                                |
| ------------------------------ | -------------------------------------- |
| `ui/brand-identity.html`       | Full interactive visual identity guide |
| `ui/logo-mockups.html`         | Logo mockup contexts                   |
| `ui/tulsbot-icon-gradient.svg` | Default icon (square)                  |
| `ui/tulsbot-logo-gradient.svg` | Default logo (wide)                    |
| `ui/tulsbot-icon-black.svg`    | Black icon variant                     |
| `ui/tulsbot-logo-black.svg`    | Black logo variant                     |
| `ui/tulsbot-icon-white.svg`    | White icon variant                     |
| `ui/tulsbot-logo-white.svg`    | White logo variant                     |
| `docs/BRAND-IDENTITY.md`       | This document (quick reference)        |
