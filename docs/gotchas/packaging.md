---
description: HappySkills packaging constraints — bundle caps, description validators, and scaffolding rules that shaped the skill's metadata.
tags: [gotchas, happyskills, packaging]
source:
  - .agents/skills/instant-canvas/skill.json
  - .agents/skills/instant-canvas/SKILL.md
---

# Gotchas — Skill Packaging (HappySkills)

## The 1 MB bundle cap vs vendored ECharts

`npx happyskills validate` enforces a 1 MB total bundle size; the full `echarts.min.js` alone is 1.03 MB, so the bundle check fails (~1.3 MB total) while every other check passes. This is accepted: the full build is required (the simple build lacks legend/tooltip — see [frontend.md](frontend.md)), and the cap only matters if the skill is ever **published**. Revisit with a custom ECharts build before publishing; do not "fix" it by swapping builds.

## Description validators are strict and double-layered

SKILL.md frontmatter descriptions have an 80–180-char target, a 250-char soft cap (over it, tooling nags about mega-skill decomposition), and a hard list of forbidden YAML characters — `;` `:` `#` quotes, brackets, `!` `&` `*` `%` `|` `>` — enforced *even inside quoted strings*. Use em-dashes instead of colons. `skill.json`'s description has its own separate ~200-char recommendation. Trimming to fit cost this skill its "Use when" clause; the trigger vocabulary must live inside the one description sentence.

## Never scaffold a skill by hand

`npx happyskills init <name> --json` (run from the project root) is mandatory for new skills — hand-made folders are unmanaged and break `validate`/`list`/`publish`/`sync`. In this repo the CLI is configured to create skills under `.agents/skills/`, not the default `.claude/skills/`.

## The skill loads from a mirror path

At runtime the Skill tool may report the base directory as `.claude/skills/instant-canvas` (an agent-linked mirror) while the real, edited source lives in `.agents/skills/instant-canvas`. Edit and commit under `.agents/`; treat the `.claude/` path as read-only plumbing.
