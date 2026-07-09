---
description: The browser app — shell, block renderers, bespoke form widgets, chart mapping, theming, icons, and the CSP constraints that shape the code.
tags: [frontend, ui, echarts, widgets, theming]
source:
  - .agents/skills/instant-canvas/scripts/web/index.html
  - .agents/skills/instant-canvas/scripts/web/app.js
  - .agents/skills/instant-canvas/scripts/web/styles.css
  - .agents/skills/instant-canvas/scripts/web/vendor/VENDORED.md
---

# Frontend

A single static shell (`index.html` + `styles.css` + `app.js`) served by the kernel — no framework, no build step. The visual language descends from `prototype/index.html` (the original user-approved reference) and has since evolved under user direction: Lucide icons, bespoke form widgets, fieldset grids.

## Shell

- The token comes from `?token=` (held in memory, never localStorage); asset URLs carry it as a query. `__IC_TOKEN__` placeholders are substituted server-side because CSP forbids inline scripts.
- Hash routing: `#/c/<encoded-rel-path>`. The sidebar is the workspace scan — the `(root)` group displays the workspace folder's real name with a house icon; subfolders are collections with hover-revealed delete. The header shows the workspace path, filling available space and trimming from the *start* (measured fitting + ResizeObserver) so the tail stays visible.
- Hot-reload client: WebSocket with exponential backoff; `workspace` refetches the tree, `canvas` re-renders the open canvas (full re-render, state loss accepted), `navigate` routes, `session` refreshes form state. The footer pulse reflects connection health.

## Display renderers

- **markdown** via vendored markdown-it (`html: false, linkify: true`); `src` content arrives pre-inlined by the kernel.
- **kpi** cards: delta arrow from the value's sign, color green iff sign matches `positiveIs`, near-zero renders flat/muted.
- **table**: per-column `format`, numeric columns right-aligned with tabular numerals.
- **chart**: `chartOption()` maps each of the 17 kinds' friendly `data`+`encoding` to an ECharts option (bubble scaling, visualMap heatmaps, derived sankey/graph nodes with degree sizing, hierarchical key remapping for treemap/sunburst, parallel axes, time-based themeRiver). Charts mount at 320 px with a ResizeObserver; the raw `options` escape hatch is applied as a **second `setOption`** so ECharts merges it natively (series by index) instead of replacing generated series.

## Bespoke form widgets

Everything the user touches is custom — native browser chrome never appears mid-form:

- **date / datetime picker**: calendar popover with month/year quick-select grids (12-year paging), Today/Now/Clear; datetime adds an hh:mm section and a Done button (day-pick keeps it open). The input stays typable ISO, so native `required`/`pattern` validation still applies.
- **select**: styled menu popover, check on the current option, Lucide chevron aligned with the other input icons; the display input is a keyboard-openable trigger (Enter/Space/↓) whose typing is suppressed.
- **radio / checkbox / range**: `appearance: none` rebuilds — accent dot, SVG-check box (data-URI, allowed by `img-src data:`), slider with accent progress fill (`--fill` custom property set from JS).
- **`ui: "buttons"`** segmented control and **`ui: "pills"`** token multi-select (filter input, removable ×) — both store values in hidden inputs so `collectValues()` reads them uniformly.
- **Validation UX**: live on-blur checks (`clientFieldError()` mirrors the kernel's rules — email, URL + protocol whitelist, pattern with `patternMessage`, ranges, dates) render into inline error slots and clear on input. The kernel re-validates on submit regardless; 422 responses render field-level errors, 409 responses drive the overwrite/outside-root confirmation dialogs.

## Layout

Fieldsets render as bordered groups (`--fset-border` token) with 1–3-column grids. **CSP blocks `style=""` attributes**, so all geometry is class-based: `.cols-2/.cols-3` on the grid, `.span-2/.span-3` on fields, utility classes elsewhere. JS may set `el.style.*` (CSSOM is allowed); markup may not carry style attributes.

## Theming

Two mechanisms, deliberately separate:

- CSS custom properties per theme (`:root`, `[data-theme="dark"]`, and the `prefers-color-scheme` fallback), including input tokens (`--inp-*`), fieldset border, and `color-scheme: light/dark` so native widget internals (number spinners, scrollbars) follow the theme.
- **ECharts cannot read CSS variables**, so two concrete theme objects (`ic-light`/`ic-dark`, palette `#6366f1 #10b981 #f59e0b #ec4899 #06b6d4` and dark variants) are registered; the theme toggle disposes and re-inits every chart.

## Icons and vendored assets

All icons are Lucide (ISC) — only the ~20 used SVG paths are inlined (the `LUCIDE` map in `app.js` plus the static topbar), not the library. Provenance for everything third-party lives in `scripts/web/vendor/VENDORED.md`: ECharts 5.6.0 and markdown-it 14.3.0 UMD builds (pinned versions, URLs, SHA-256) — served to the browser, never `require`d by Node.
