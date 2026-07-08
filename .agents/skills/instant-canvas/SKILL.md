---
name: instant-canvas
description: Render agent-wrangled data as local interactive canvases (charts, tables, KPIs, markdown) and safely collect user input/secrets via local browser forms that write directly to files — values never enter the chat.
allowed-tools: Bash, Read, Write, Edit
---

# InstantCanvas

Render data visually (charts, tables, KPIs, markdown) and safely collect user input (forms, secrets, confirmations) in the user's local browser.

> Skill under construction — full agent-facing documentation lands in a later phase. The runtime contract lives in `scripts/` and is queryable via `node scripts/instantcanvas.js catalog`.

## Quick start

1. Write a canvas JSON file (top level must contain `"instantcanvas": 1`).
2. Validate it: `node scripts/instantcanvas.js validate <canvas.json>`.
3. Open it: `node scripts/instantcanvas.js open <canvas.json>` — display canvases return immediately; form/confirm canvases block until the human responds in the browser.
4. Parse the single JSON document printed on stdout.
