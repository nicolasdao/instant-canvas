# Vendored browser assets

These files are served to the browser by the kernel (`/assets/vendor/...`).
They are **never** `require()`d by Node. Do not edit them.

| File | Package | Version | Source URL | SHA-256 | Vendored |
|---|---|---|---|---|---|
| `echarts.min.js` | Apache ECharts (UMD, minified) | 5.6.0 | https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js | `bf4a223524e40b77c304bec67e1222cf551f14880cf42c69dc046558e11c07b1` | 2026-07-08 |
| `markdown-it.min.js` | markdown-it (UMD, minified) | 14.3.0 | https://cdn.jsdelivr.net/npm/markdown-it@14.3.0/dist/markdown-it.min.js | `70fe17bd06c7fa819f03a1ed10957904318103624198845dc893b309bf495e28` | 2026-07-08 |

Licenses: ECharts — Apache-2.0; markdown-it — MIT.

## Inlined icon data

The UI icons are [Lucide](https://lucide.dev) (ISC license). The SVG path data
for the 14 icons used is inlined in `../app.js` (`LUCIDE` map) and `../index.html`
(topbar), extracted from `lucide-static@1.23.0` via
`https://cdn.jsdelivr.net/npm/lucide-static@1.23.0/icons/<name>.svg` on 2026-07-08.
No icon library file is vendored — only the per-icon path data.
