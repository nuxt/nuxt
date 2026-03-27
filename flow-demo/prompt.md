# Add "system" theme option

## Context
The theme toggle currently supports only "light" and "dark". We need a third "system" option that follows the OS preference via `prefers-color-scheme`, defaulting to dark on the server (where OS preference is unknown).

## Files to modify

1. **`app/app.vue`** — Add CSS media query rule for system theme
2. **`app/components/ThemeToggle.vue`** — Cycle through 3 options; update emoji display
3. **`app/pages/preferences.vue`** — Replace toggle button with 3-option selector

## Implementation

### 1. `app/app.vue` — CSS

Add after `[data-theme="light"]` block:

```css
@media (prefers-color-scheme: light) {
  [data-theme="system"] {
    /* same vars as [data-theme="light"] */
  }
}
```

This way: server renders dark (`:root` default), client with light OS preference gets light vars via media query.

### 2. `app/components/ThemeToggle.vue`

- Cycle: dark → light → system → dark
- Emoji: dark=☀️, light=🌙, system=💻
- `useHead` still sets `data-theme` to cookie value (including "system")

### 3. `app/pages/preferences.vue`

- Replace single toggle button with 3 buttons (Light / Dark / System)
- Highlight the active option
- Remove `toggleTheme()` function, just set `theme.value` directly

## Verification

- Run dev server, visit /preferences
- Select each option; confirm theme changes
- Select "system", toggle OS dark mode → theme should follow
- Refresh page with "system" selected → SSR should render dark
