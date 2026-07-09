# Gotchas

Lessons learned the hard way so we don't repeat them.

- [Runtime (kernel & CLI)](gotchas/runtime.md) — stdout flush truncation, keep-alive poll races, same-version kernel staleness, health-ping liveness, `/tmp` symlinks, safe collection deletion.
- [Frontend](gotchas/frontend.md) — CSP silently dropping inline styles, ECharts vs CSS variables, the `options` merge trap, popover self-closing clicks, dark-mode widget chrome, themeRiver dates.
- [Testing](gotchas/testing.md) — Node 24 subtest socket isolation, `node --test` directory entries, shared state-dir coordination, self-tripping security scans.
- [Skill packaging](gotchas/packaging.md) — HappySkills bundle cap vs vendored ECharts, description validators, mandatory `init` scaffolding, the `.claude/` mirror path.
