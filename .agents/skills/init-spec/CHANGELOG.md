# Changelog

## [0.2.0] - 2026-05-28

### Added

- **Lifecycle mode** — the skill now auto-invokes on phrases like "archive spec X", "mark spec X as done", and "move spec X to done", and moves the named folder into `specs/-DONE` or `specs/-ARCHIVED` (creating the destination if absent). The move uses `git mv` when the folder is tracked, plain `mv` otherwise. The skill does not edit spec contents, does not commit, and does not run the 8-step authoring workflow when in lifecycle mode.
- Disambiguation discipline — AskUserQuestion fires only when the target spec or destination is genuinely ambiguous. Unambiguous requests execute silently.

### Changed

- Description updated to advertise both modes (authoring + lifecycle) while staying under the 250-char soft cap.
- Top-level Purpose section reorganized to distinguish the two modes up front.
- Constraints section split into "applies to both modes" / "authoring mode" / "lifecycle mode" subsections.

## [0.1.1] - 2026-05-28

### Fixed

- Folder naming convention switched from `DDMMYY-NN-slug` to `YYMMDD-NN-slug` so that `ls specs/` lists specs in chronological order. The previous `date +%d%m%y` placed the day first, breaking sort order across days/months. Updated the bash snippet in Step 3 to `date +%y%m%d` and refreshed the example slugs.

## [0.1.0] - 2026-05-27

### Added

- Initial release of `init-spec`.
- Generates a one-shot-ready `SPEC.md` under `specs/DDMMYY-NN-<slug>/` from the current session's context, taking a single `$goal` argument.
- Auto-invocation triggers on phrases like "create a spec", "write a specification", "generate a spec", with explicit guards against speculative or future-tense mentions.
- 8-step workflow: confirm goal + session inventory, brief clarifying-questions pass (AskUserQuestion, max 4), slug resolution following the `DDMMYY-NN-slug` convention, single-file-vs-`BACKGROUND.md` decision, spec authoring against the canonical template, 12-point self-audit rubric, report-back with a ready-to-paste fresh-session prompt, and a no-drift constraint set.
- Canonical SPEC.md template (`references/spec-template.md`) with required sections: fresh-session preamble, goal, context, verifiable acceptance criteria, fixes (with symbol anchors, mandatory pre-edit verification steps, and stop conditions), non-goals, known uncertainties, anti-hallucination guardrails, verification commands, domain glossary, references.
- Anti-bloat discipline: 700-line cap, sibling `BACKGROUND.md` only when supporting context can be deferred to "if curious" reading.
- Bakes in two Anthropic best practices: fresh-session execution (the report-back format) and writer/reviewer split (separate fresh session for code review).
