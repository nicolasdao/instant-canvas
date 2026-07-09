# InstantCanvas

Death to the admin panel: a local, schema-driven canvas runtime that lets coding agents render data visually (charts, tables, KPIs, markdown) and safely collect user input — forms, secrets, confirmations — in the user's browser, with values written straight to local files and **never entering the chat**.

## Table of Contents

<!-- BEGIN toc -->
- [Overview](#overview)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
<!-- END toc -->

## Overview

InstantCanvas is a [HappySkills](https://happyskills.dev)-authored skill for coding agents. The paradigm is a strict separation of concerns: **the LLM wrangles data into a JSON contract; the skill owns all rendering.** An agent writes a `*.canvas.json` file, runs `open`, and a persistent per-workspace localhost kernel renders it in the default browser with hot reload. Display canvases return immediately; form and confirm canvases block until the human responds in the browser — and the agent receives redacted metadata only (field names, never values).

Instead of maintaining an answers *warehouse* (pre-built admin panels), agents deliver answers *on the fly* — disposable, data-driven views generated the moment a question is asked. See [docs/mission.md](docs/mission.md) for the full framing.

Two design commitments run through everything:

- **Progressive disclosure.** The skill is large (17 chart kinds, 16 field types, a full form-layout system), but agents never load it wholesale: `catalog` returns a ~4 KB lean index; `catalog <name>` returns exactly one schema; the deterministic validator turns mistakes into self-explanatory fixes.
- **Zero dependencies.** Plain Node ≥ 20, built-in `http`, a hand-rolled WebSocket server, two vendored browser files (ECharts, markdown-it). No build step, no npm install.

## Getting Started

Prerequisites: Node ≥ 20, a desktop browser. All commands run from the skill root:

```bash
cd .agents/skills/instant-canvas

# explore the contract (lean index → one schema at a time)
node scripts/instantcanvas.js catalog
node scripts/instantcanvas.js catalog sankey

# render a canvas (spawns/reuses the workspace kernel, opens the browser)
node scripts/instantcanvas.js open examples/report.canvas.json

# the agentic loop
node scripts/instantcanvas.js validate my.canvas.json   # exit 1 → fix from errors[] → repeat
node scripts/instantcanvas.js open my.canvas.json       # one JSON result on stdout

# lifecycle
node scripts/instantcanvas.js status
node scripts/instantcanvas.js stop

# tests (83, zero deps)
node --test scripts/test/
```

`examples/` contains four ready canvases (visual report, secrets → `.env` form, danger confirm, mixed); `demos/` at the repo root holds larger showcases (all 17 chart kinds, the form kitchen sink).

## Project Structure

```
.agents/skills/instant-canvas/   The skill itself
  SKILL.md                       Agent-facing contract (progressive-disclosure entry point)
  skill.json                     HappySkills metadata
  examples/                      Four validated example canvases
  scripts/
    instantcanvas.js             CLI: open | validate | catalog | status | stop
    kernel.js                    Per-workspace localhost server (HTTP + hand-rolled WS)
    lib/                         schema/validate/catalog, registry, redact, envfile, …
    web/                         Browser app (no framework) + vendored ECharts/markdown-it
    test/                        node:test suite + fixtures
demos/                           Showcase canvases (chart gallery, form kitchen sink, …)
prototype/index.html             Original user-approved UI reference (read-only)
specs/                           The implementation spec that built the MVP (user-owned)
docs/                            This documentation
```

## Documentation

Start with the mission — it is the decision-making compass for this project, at two levels. **Proactive**: when a bug fix or feature request comes in, the mission is the lens for interpreting it, steering implementations toward the project's actual goals. **Reactive**: when multiple valid approaches exist, the mission usually decides without asking the user — escalate only on genuine conflicts it cannot resolve.

<!-- BEGIN doc-index -->
- [Architecture](docs/architecture.md) — How the CLI, per-workspace kernel, and browser fit together — process model, registry, sessions, hot reload, and the security perimeter.
- [Canvas Schema, Validator, and Catalog](docs/canvas-schema.md) — The canvas JSON contract — envelope, six block types, 17 chart kinds, 16 field types, fieldset layout, validation rules, and the progressive-disclosure catalog.
- [CLI](docs/cli.md) — The instantcanvas CLI — commands, flags, exit codes, stdout discipline, the result contract, and the agent workflow it enables.
- [Frontend](docs/frontend.md) — The browser app — shell, block renderers, bespoke form widgets, chart mapping, theming, icons, and the CSP constraints that shape the code.
- [Gotchas](docs/gotchas.md)
- [InstantCanvas — Mission](docs/mission.md)
- [Security Model](docs/security.md) — The secret-handling model — what InstantCanvas guarantees, how redaction and workspace confinement work, and what it deliberately does not protect against.
- [Testing](docs/testing.md) — The zero-dependency node:test suite — layout, isolation patterns, security regressions, and the CDP-driven browser verification used during development.
<!-- END doc-index -->

Gotchas are indexed in [docs/gotchas.md](docs/gotchas.md) — read the relevant domain file before touching a subsystem.
