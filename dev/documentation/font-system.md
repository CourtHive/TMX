# Font System — TMX

> **Status:** Implemented
> **Scope:** TMX application (configurable), courthive-components & courthive-public (inherit fix)

---

## Table of Contents

- [Font System — TMX](#font-system--tmx)
  - [Table of Contents](#table-of-contents)
  - [1. Overview](#1-overview)
    - [Background](#background)
  - [2. Architecture](#2-architecture)
  - [3. How It Works](#3-how-it-works)
    - [Startup](#startup)
    - [User Changes Font](#user-changes-font)
    - [display=swap](#displayswap)
  - [4. Adding a New Font](#4-adding-a-new-font)
    - [System font (no download needed)](#system-font-no-download-needed)
    - [Google Font (on-demand download)](#google-font-on-demand-download)
    - [That's it](#thats-it)
  - [5. Key Files](#5-key-files)
  - [6. Cross-Repo: font-family Inheritance Fix](#6-cross-repo-font-family-inheritance-fix)

---

## 1. Overview

TMX uses a configurable font system built on a CSS custom property (`--tmx-font-family`) with on-demand Google Fonts loading. Users can select their preferred font from the Settings tab; the choice persists in `localStorage` and loads instantly on subsequent visits.

The default is a system font stack (matching what Bulma previously provided), so no external fonts are loaded unless the user opts in.

### Background

When Bulma was removed and replaced with custom CSS, the global `font-family` that Bulma applied to all elements (including form controls) was lost. This caused buttons, inputs, selects, and dropdown items to fall back to the browser's default font. The fix had two parts:

1. **`font-family: inherit`** on `button`, `input`, `select`, `textarea` (all three repos)
2. **CSS variable + settings UI** for font selection (TMX only)

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│  theme.css                                          │
│  :root { --tmx-font-family: <system stack>; }       │
└──────────────────────┬──────────────────────────────┘
                       │ default value
                       ▼
┌─────────────────────────────────────────────────────┐
│  tmx.css                                            │
│  * { font-family: var(--tmx-font-family, sans-serif); } │
└──────────────────────┬──────────────────────────────┘
                       │ consumed by all elements
                       ▼
┌─────────────────────────────────────────────────────┐
│  forms.css                                          │
│  button, input, select, textarea {                  │
│    font-family: inherit;                            │
│  }                                                  │
└─────────────────────────────────────────────────────┘
  ↑ ensures form controls pick up the variable too


┌─────────────────────────────────────────────────────┐
│  themeService.ts                                    │
│  ┌───────────────┐  ┌──────────────┐               │
│  │ FONT_OPTIONS  │  │ loadGoogle   │               │
│  │ (registry)    │→ │ Font()       │→ <link> tag   │
│  └───────┬───────┘  └──────────────┘               │
│          │                                          │
│  applyFont(key)                                     │
│    1. loadGoogleFont(option)  — inject <link> if    │
│       web font, skip if system/already loaded       │
│    2. setProperty('--tmx-font-family', value)       │
│    3. persist to localStorage                       │
│                                                     │
│  initTheme()                                        │
│    — reads saved fontFamily from localStorage       │
│    — calls loadGoogleFont + setProperty on startup  │
└─────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────┐
│  settingsGrid.ts                                    │
│  Font panel — <select> dropdown built from          │
│  FONT_OPTIONS. onChange calls applyFont(key).       │
└─────────────────────────────────────────────────────┘
```

---

## 3. How It Works

### Startup

1. `initTheme()` (called from `setupTMX()`) reads `fontFamily` from `localStorage`
2. If the saved font has a `googleFont` entry, a `<link>` tag is injected into `<head>` pointing to `fonts.googleapis.com/css2?family=...&display=swap`
3. `--tmx-font-family` is set on `:root` via `style.setProperty()`
4. All elements pick up the font via `var(--tmx-font-family)` in `tmx.css`

### User Changes Font

1. User selects a font from the Settings tab dropdown
2. `applyFont(key)` is called
3. If the font is a web font and hasn't been loaded yet, a `<link>` is injected
4. `--tmx-font-family` is updated — the change is instant (no page reload)
5. The choice is persisted to `localStorage` under the `tmx_settings` key

### display=swap

All Google Fonts are loaded with `display=swap`, which means:

- Text renders immediately in the fallback system font
- Once the web font downloads, it swaps in seamlessly
- No invisible/blank text (FOIT) during loading

---

## 4. Adding a New Font

### System font (no download needed)

Add an entry to `FONT_OPTIONS` in `src/services/theme/themeService.ts`:

```typescript
'my-font': {
  label: 'My Font',
  value: "'My Font', sans-serif",
},
```

### Google Font (on-demand download)

Add an entry with a `googleFont` field:

```typescript
'montserrat': {
  label: 'Montserrat',
  value: "'Montserrat', sans-serif",
  googleFont: 'Montserrat:wght@400;500;600;700',
},
```

The `googleFont` value is the `family` parameter for the [Google Fonts CSS2 API](https://developers.google.com/fonts/docs/css2). Format: `Font+Name:wght@weight1;weight2;...`

- Use `+` for spaces in the font name
- Include weights actually used in the app (400 regular, 500 medium, 600 semibold, 700 bold)
- The settings dropdown, persistence, and loading all key off `FONT_OPTIONS` automatically — no other files need changes

### That's it

No other files need to be modified. The settings dropdown is built dynamically from `FONT_OPTIONS`, and the loading/persistence infrastructure handles everything.

---

## 5. Key Files

| File                                                    | Role                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `src/services/theme/themeService.ts`                    | `FONT_OPTIONS` registry, `applyFont()`, `loadGoogleFont()`, `initTheme()` |
| `src/services/settings/settingsStorage.ts`              | `TMXSettings.fontFamily` type definition                                  |
| `src/pages/tournament/tabs/settingsTab/settingsGrid.ts` | Font dropdown in Settings UI                                              |
| `src/styles/theme.css`                                  | `--tmx-font-family` CSS variable (default value)                          |
| `src/styles/tmx.css`                                    | `* { font-family: var(--tmx-font-family); }`                              |
| `src/styles/components/forms.css`                       | `button, input, select, textarea { font-family: inherit; }`               |

---

## 6. Cross-Repo: font-family Inheritance Fix

When Bulma was removed, all three repos lost the global `font-family: inherit` rule that Bulma applied to form controls. Without it, `<button>`, `<input>`, `<select>`, and `<textarea>` use the browser's default font instead of inheriting from their parent.

The fix was added to each repo's form/base CSS:

```css
button,
input,
select,
textarea {
  font-family: inherit;
}
```

| Repo                     | File                              |
| ------------------------ | --------------------------------- |
| **TMX**                  | `src/styles/components/forms.css` |
| **courthive-components** | `src/styles/components/forms.css` |
| **courthive-public**     | `src/styles/default.css`          |

This ensures all form elements inherit the font from their parent element, which ultimately resolves to whatever font stack the application sets (via `--tmx-font-family` in TMX, or the `:root` declaration in courthive-public).
