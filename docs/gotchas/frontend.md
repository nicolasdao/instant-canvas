---
description: Browser-side gotchas — CSP surprises, ECharts constraints, and popover event traps discovered while building the UI.
tags: [gotchas, frontend, csp, echarts]
source:
  - .agents/skills/instant-canvas/scripts/web/app.js
  - .agents/skills/instant-canvas/scripts/web/styles.css
  - .agents/skills/instant-canvas/scripts/web/index.html
---

# Gotchas — Frontend

## CSP silently drops `style=""` attributes

`style-src 'self'` blocks inline style *attributes*, not just `<style>` tags — the browser ignores them without an error you'd notice. This shipped an invisible bug: fieldset grids rendered single-column because `style="grid-template-columns:…"` was discarded. All layout must be class-based (`.cols-2`, `.span-3`, utility classes); JS may still set `el.style.*` because CSSOM assignment is exempt from `unsafe-inline`. Same CSP also blocks inline `<script>`, which is why the token reaches the page via `__IC_TOKEN__` placeholder substitution in served HTML, not a script tag.

## ECharts cannot read CSS variables

`color: var(--c1)` inside an ECharts option resolves to nothing — the library paints to canvas and never consults your stylesheet. Two concrete theme objects (`ic-light`/`ic-dark`) duplicate the palette, and the theme toggle must **dispose and re-init** every chart; there is no live retheme.

## The `options` escape hatch must merge via a second `setOption`

A hand-rolled deep-merge treated arrays as scalars, so `"options": {"series": [{"smooth": true}]}` **replaced** the generated series — data and all — rendering an empty chart. ECharts' own `setOption` merges series by index, which is exactly what option-writers expect. Apply generated option first, then `chart.setOption(block.options)` second; never pre-merge arrays yourself.

## Re-rendering a popover detaches the clicked element

The date picker's arrows re-render its DOM. The click then bubbles to the document-level "close on outside click" listener with a **detached** target — `target.closest('.dp')` fails, and the picker closes itself. Any widget that re-renders on click inside a popover must `stopPropagation()` before re-rendering (date picker and select menu both do).

## `echarts.simple.min.js` is not a drop-in slimming

The simple build (~470 KB vs 1.03 MB) lacks the **legend and tooltip components**, which the UI requires everywhere. If bundle size matters, a custom ECharts build is the route — do not swap in the simple build.

## Native widget chrome ignores your dark theme

Number-input spinners, scrollbars, and picker internals render for the *browser's* color scheme, not your CSS variables — light spinners on dark inputs. Declare `color-scheme: light`/`dark` alongside each theme's variables; that one property is the fix.

## themeRiver needs real dates

Its single axis is time-typed: category-style x values like `"W1"` silently fail to plot. Use parseable date strings (`"2026-07-01"`). The schema example and docs say so — keep them that way.

## Constraint API quirks around custom widgets

`required` does not fire on readonly inputs, and hidden inputs are excluded from validation entirely. Hence: the custom select's display input is *typing-suppressed but not readonly* (so `required` works), while segmented buttons and pills run a manual required pre-check that writes into the inline error slots before `checkValidity()` runs.
