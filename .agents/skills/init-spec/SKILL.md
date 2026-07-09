---
name: init-spec
description: SpecKit — Generate a SPEC.md from session context, or move existing specs to specs/-DONE or specs/-ARCHIVED. Use when asked to create, archive, or mark a spec as done. Not for code docs (init-doc) or session loading (init-context).
arguments: goal
argument-hint: goal
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

# init-spec — Generate a one-shot-ready SPEC.md, or move specs through their lifecycle

## Purpose

This skill has **two modes**:

1. **Authoring** (default) — capture everything the **current session** has produced (research, decisions, file:line findings, complaints, constraints) into a single self-contained `SPEC.md` under `specs/YYMMDD-NN-<slug>/` that a **fresh, context-free LLM session** can execute reliably without re-doing discovery work. See [The 8-step authoring workflow](#the-8-step-authoring-workflow).
2. **Lifecycle** — move an existing spec folder into `specs/-DONE` (mark as done) or `specs/-ARCHIVED` (archive). See [Lifecycle workflow](#lifecycle-workflow-archive--mark-done).

The skill's argument `$goal` is a short statement of what the spec is for in authoring mode. In lifecycle mode it can be empty — the user's message provides the target spec and destination.

## When the skill fires

### Authoring mode

**Auto-invoke** when the user asks any of (imperative, present-tense intent):
- "create a spec for X" / "write a specification for X" / "generate a spec on X"
- "spec this out" / "let's spec this" / "produce a spec"
- "save this as a spec" / "turn this into a spec"
- Variants: "specification document", "implementation spec", "build a spec".

**Do NOT auto-invoke** on speculative or future-tense mentions:
- "should we spec this?" / "we might want a spec for this later" / "would a spec help here?"
- "what would a spec for this look like?"
- For these, reply with a one-line confirmation question ("Want me to generate the spec now?") and only fire on explicit yes.

### Lifecycle mode

**Auto-invoke** when the user asks any of (imperative, present-tense intent, naming a spec):
- "archive spec X" / "archive the X spec" / "move spec X to archive"
- "mark spec X as done" / "mark X spec as done" / "spec X is done"
- "move spec X to done" / "X spec is complete"

**Do NOT auto-invoke** on:
- Speculative phrasing: "should we archive that old spec?" — reply with a confirmation question first.
- Verbs without a spec object: "archive this branch" / "mark this PR done" / "we're done with this issue" — these aren't about specs.
- Code documentation lifecycle — route appropriately.

### Never auto-invoke for

- Code documentation requests → route to `init-doc` / `update-doc`.
- Mission/vision documents → route to `init-mission`.
- Project memory hydration → route to `init-context`.

## The 8-step authoring workflow

### Step 1 — Confirm the goal and read session context

Echo `$goal` back to the user in one sentence so they can correct it if wrong. **Do not** ask broad open-ended questions yet — first internally inventory what the session already contains. Build a mental scratchpad like this (do not show it to the user — it's working state):

```
Goal: <one-line restatement of $goal>
Investigation done: <bullets — what was researched, by whom, with which tools>
Decisions reached: <bullets — explicit calls the user signed off on>
File:line findings: <list of "symbol in path:line" citations from the conversation>
Hedged findings: <list of sub-agent quotes that included uncertainty — these will become §6 of the spec>
Stakeholder context: <chat logs, customer names, complaints, deadlines, dates>
Supporting artifacts: <other specs, audits, reports referenced — paths only>
Ambiguities: <things the session never resolved — candidates for the clarifying-question pass in Step 2>
```

If the session is **thin** (just the user's request, no investigation), warn the user: "There's limited context in this session — the spec will be high-level. Want to investigate first, or write a sparse spec now?" Use AskUserQuestion.

If a sub-agent in this session hedged on any finding (e.g. "may not be at this exact line", "likely originates from a parent component"), copy the hedge verbatim into the scratchpad. It must appear verbatim in the spec's known-uncertainties section — never paraphrased into false confidence.

### Step 2 — Run a brief clarifying-questions pass

Use **one** `AskUserQuestion` tool call with **3–4 questions** (the tool's hard limit is 4 per call). Each question is a single-select with 2–4 concrete options. The questions exist to close gaps that would otherwise force the implementer to guess. Choose from this menu based on what's missing:

- **Scope boundary** — "What's in scope and what isn't?" (options: include X, exclude X, both)
- **Verification method** — "How should the implementer verify success?" (curl / npm test / browser DevTools / manual check)
- **Branch / commit convention** — "How should the work be committed?" (one PR / one commit per fix / per-tier branches)
- **Implementer authority** — "What can the implementer do without asking?" (refactor adjacent code / dep changes / new files / none)
- **Server-side coordination** — "Are there parts that need backend changes?" (yes — list separately / no / unknown)
- **Existing-asset reuse** — "Should existing audits / sub-reports be linked or summarized?" (link only / inline summary / both)
- **Sensitive paths** — "Any files or paths the implementer must not touch?" (list / none)

Skip this step **only** if every question above is already unambiguously answered by the session. Default is to ask.

### Step 3 — Decide the slug

The naming convention is `YYMMDD-NN-<kebab-slug>` (chronologically sortable). Resolve it:

```bash
# Get today's date in YYMMDD
DATE=$(date +%y%m%d)

# Find the next NN for today by listing existing specs
ls specs/ 2>/dev/null | grep "^${DATE}-" | sort -r | head -1
```

- If no spec exists for today, `NN=01`.
- If `${DATE}-01-*` exists, use `02`, and so on.
- The `<kebab-slug>` is 2–5 words derived from `$goal`. Keep it terse and grep-friendly (e.g. `webapp-perf-fixes`, `auth-token-rotation`, `farm-search-debounce`).
- Examples from this repo: `specs/250526-01-slow-website/`, `specs/260526-01-webapp-perf-fixes/`.

Confirm the chosen slug with the user via AskUserQuestion if you're unsure. Otherwise proceed.

### Step 4 — Decide single-file vs sibling BACKGROUND.md

**Default: single `SPEC.md`.** Anti-bloat is a primary goal — a fresh session loading the spec burns tokens before reading the first instruction.

Create a sibling `BACKGROUND.md` **only** if all three are true:
- The supporting context (verbatim chat logs, prior audit findings, raw data tables) exceeds ~3 KB.
- The implementer **does not need it** to do the work — it's there for "if curious" reference.
- Linking out preserves the SPEC.md as a tight executable document.

If you create `BACKGROUND.md`, the SPEC.md must explicitly say "Read BACKGROUND.md only if you need historical context — it is not required to do the work."

### Step 5 — Write the SPEC.md

Use the template in [references/spec-template.md](references/spec-template.md). The template is canonical — match its section order and headings unless a section is genuinely not applicable (e.g. no domain vocabulary → omit the glossary section, but state that you omitted it and why).

**Hard constraints on what you write:**

- **Symbol anchors, not just line numbers.** Every cited location includes the grep-able symbol *and* the file:line. Example: `getSitesForFarms in src/app/sites/duck/siteService.js:174-177`.
- **Acceptance criteria are verifiable finish lines.** Every fix in the SPEC must end with "Done when:" followed by something a fresh session can check with a command, a curl, a DevTools observation, or a file diff. No "looks right" criteria.
- **Non-goals explicit.** Anything tempting that the implementer must not do gets a line in §"Non-goals".
- **Known uncertainties surfaced.** If discovery work in this session hedged ("the loop may not be at this exact line"), the SPEC must say so, plus a "safe behavior" for the implementer.
- **DO/DON'T lists are concrete.** Replace "be careful" with "do not edit files X, Y, Z; do not run command Q; do not introduce new abstractions."
- **No new files unless explicitly listed.** The SPEC enumerates which files the implementer is allowed to create.
- **Stop conditions.** For every uncertainty, the SPEC says "if you find X, stop and ask the user" — not "handle X intelligently."
- **One fix per commit, conventional commit format** — if the repo uses conventional commits (check `README.md`), the SPEC enforces it.

**Anti-bloat discipline:**

- Target SPEC.md length: **300–700 lines**. Above 700 lines, audit for repetition and consider splitting background into `BACKGROUND.md`.
- For each line, ask: *Would removing this cause a fresh session to make a mistake?* If not, cut it. (This is Anthropic's CLAUDE.md guidance applied to spec writing.)
- Do not paste full audit reports — link to them.
- Do not paste verbatim chat unless the customer's wording is itself load-bearing (e.g. quoted symptoms).

### Step 6 — Self-review against the rubric

Before reporting back, internally check the SPEC.md against this rubric. Fix anything that fails before showing the user.

| # | Check | Pass if… |
|---|---|---|
| 1 | Fresh-session preamble exists | §0 "How to use this spec" tells the reader to NOT re-explore and NOT re-audit |
| 2 | Every file:line has a symbol anchor too | Grep would still find it after line drift |
| 3 | Every "fix" has a verifiable Done-when | A fresh session can run the check |
| 4 | Non-goals section present | At least one item, even if it's "no new dependencies" |
| 5 | Known uncertainties section present | If discovery hedged, the spec says so |
| 6 | Anti-hallucination guardrails are concrete | DON'Ts name files, commands, or behaviors — not abstractions |
| 7 | Glossary present if domain terms used | Or explicit note that no glossary is needed |
| 8 | Verification commands embedded | curl / npm / test invocations are ready to copy-paste |
| 9 | Reproduction instructions exist | How to run the app, log in, capture HAR, etc. |
| 10 | "Do not push/commit without confirmation" | Stated in §0 or DON'Ts |
| 11 | Length under 700 lines | Or background split into sibling file |
| 12 | References section lists prior artifacts | Audits, chat logs, related specs |

If any check fails, **fix the SPEC before reporting**, not in a follow-up turn.

### Step 7 — Report back

Reply with exactly this template (substitute `<slug>` and `<line-count>`):

```
Spec created: specs/<slug>/SPEC.md (<line-count> lines)

Ready-to-paste prompt for a fresh Claude session:
> Read specs/<slug>/SPEC.md end-to-end, then implement Tier 1 (or §4 if untiered), one fix per commit. Do not re-explore the codebase — the spec has the file:line anchors. Ask me before pushing or opening a PR.

After implementation, review the diff in ANOTHER fresh session via the code-review skill. Fresh context = unbiased review (Anthropic best practice). Do not let the session that wrote the code also review it.
```

If you created `BACKGROUND.md`, append one line: `Optional: BACKGROUND.md has historical context — skip on first pass.`

Do not add chatter beyond this block. The user wants the path and the next prompt, not a recap of what's in the spec.

### Step 8 — Don't drift

Do not:
- Edit other files in the repo.
- Start implementing the spec yourself.
- Re-run audits or re-discover things the session already established.
- Commit, push, or open PRs.

The skill's job ends at "Spec created." Implementation is a separate session by design.

---

## Lifecycle workflow (archive / mark-done)

Use this path when the user asks to archive a spec or mark a spec as done. The workflow is short — four steps — and never edits spec contents.

### Step L1 — Identify the target spec

Inspect the user's message for a slug or distinctive keyword (e.g. "slow-endpoints", "api-test-regressions") and list `specs/`:

```bash
ls specs/ 2>/dev/null
```

- **Exactly one match** (substring against the slug portion of the folder name, or full folder name): use it. Do NOT ask.
- **Multiple matches**: AskUserQuestion with each candidate as an option (folder name as label, brief context as description).
- **Zero matches**: tell the user `No spec under specs/ matches "<keyword>"` and stop. Do not guess. Do not list every spec at them — they can re-issue with a better name.
- **Already in `specs/-DONE/` or `specs/-ARCHIVED/`**: tell the user the spec is already in that destination and stop. Do not re-move.

The key principle: **only ask if the user's message is genuinely ambiguous.** A clear, unambiguous reference proceeds silently.

### Step L2 — Identify the destination

Map the user's verb to a destination:

- "archive" / "archived" / "to archive" / "move to archive" → `specs/-ARCHIVED`
- "done" / "mark done" / "mark as done" / "complete" / "completed" / "finished" / "wrap up" → `specs/-DONE`

If the verb is **clear**, proceed silently. If the user said only "move spec X" (no destination word) or used both verbs in the same breath, AskUserQuestion with two options:
- "Mark as done (`specs/-DONE`)"
- "Archive (`specs/-ARCHIVED`)"

Do NOT ask if the destination is unambiguous from the message.

### Step L3 — Move the folder

Create the destination folder if it does not exist, then move:

```bash
DEST=specs/-DONE   # or specs/-ARCHIVED based on Step L2
SLUG=<the folder name from Step L1>

mkdir -p "$DEST"

# Prefer git mv if the folder is tracked (preserves history); otherwise plain mv
if git ls-files --error-unmatch "specs/$SLUG" >/dev/null 2>&1; then
  git mv "specs/$SLUG" "$DEST/"
else
  mv "specs/$SLUG" "$DEST/"
fi
```

Report back the new path in one line: `Moved specs/<slug> → specs/-DONE/<slug>` (or `-ARCHIVED`).

### Step L4 — Don't drift

Do not:
- Edit any files inside the spec folder (SPEC.md, BACKGROUND.md, etc.).
- Run the 8-step authoring workflow.
- Move any other specs the user did not ask about.
- Commit, push, or open PRs — the user commits when ready.

The skill's job ends at the one-line "Moved" report.

---

## Anti-patterns this skill exists to prevent

These are the failure modes the SPEC must defend against. The skill itself must avoid them too.

1. **Confident citation of unverified locations.** If a session sub-agent hedged ("the loop may not be exactly here"), the SPEC inherits that hedge — verbatim, in the known-uncertainties section.
2. **Implicit scope = unbounded scope.** Every "while you're at it" temptation must be explicitly forbidden in non-goals.
3. **Trust-then-verify gap.** Plausible code with no verification step is worse than no code. The Done-when criteria are non-optional.
4. **Context rot.** A bloated spec degrades attention. Cap length, separate background, ruthlessly cut filler.
5. **Pattern imposition.** Specs for legacy codebases must say "don't introduce modern patterns" explicitly. Specs for class components must say "keep them as class components."
6. **Stuck loops.** Every uncertainty must have a "stop and ask" clause, not "handle intelligently."
7. **Implicit auth/setup.** Specs that assume the reader knows how to log in / run the app / hit the API force discovery the spec was supposed to obviate. Embed setup commands and credentials-location pointers.
8. **Same-session implementation.** Specs are written to be executed in a fresh session. The report-back message reinforces this.

## Constraints (non-negotiable)

### Apply to both modes

- **No code changes.** This skill writes/moves markdown files. It does not touch source code.
- **No commits.** The skill never runs `git commit` or `git push`. The user commits when ready.
- **No publishing.** The skill never invokes `npx happyskills`, `npm`, or any deployment command.

### Authoring mode

- **One argument.** The skill takes exactly `$goal` (the user's intent). All other context comes from the session.
- **One SPEC.md.** Single file by default. Sibling `BACKGROUND.md` allowed only under the conditions in Step 4.
- **Under `specs/YYMMDD-NN-<slug>/`.** Match the existing naming convention (chronologically sortable). Do not invent variations.
- **Self-audit before reporting.** The 12-point rubric in Step 6 is non-optional.

### Lifecycle mode

- **Destinations are `specs/-DONE` and `specs/-ARCHIVED` only.** Do not invent other destination folders.
- **Never edit spec contents.** Lifecycle is a folder move — SPEC.md / BACKGROUND.md are read-only.
- **Only ask on genuine ambiguity.** If the user's message names the spec and the destination unambiguously, proceed silently. The AskUserQuestion call exists for ambiguity resolution, not as a confirmation gate.
- **Never move more than one spec per invocation.** If the user asks to move several, do them one at a time and confirm each.

## Reference

For the full SPEC.md template (section order, headings, example content, anti-bloat patterns), read [references/spec-template.md](references/spec-template.md).
