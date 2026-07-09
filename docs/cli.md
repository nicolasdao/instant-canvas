---
description: The instantcanvas CLI — commands, flags, exit codes, stdout discipline, the result contract, and the agent workflow it enables.
tags: [cli, commands, agent-workflow]
source:
  - .agents/skills/instant-canvas/scripts/instantcanvas.js
---

# CLI

Entry point: `node scripts/instantcanvas.js <command>` from the skill root (`.agents/skills/instant-canvas/`). Node ≥ 20 is enforced first (exit 2 otherwise).

## Output discipline

**stdout carries exactly one JSON document per run; every log or progress line goes to stderr**, routed through `lib/redact.js`. The one stdout document is flushed before exit — `process.exit` alone truncates piped output, so `out()` exits in the write callback and stops the caller with a sentinel throw. Exit codes: **0** clean outcome (including `cancelled` and `timeout` — respect the user's choice), **1** spec error, **2** internal error.

## Commands

```
open <canvas.json> [--workspace <dir>] [--no-open] [--timeout <s>] [--result <file>]
validate <canvas.json>
catalog [name] [--full]
status [--workspace <dir>]
stop [--workspace <dir>]
```

### open

1. Workspace root = `--workspace` else cwd (realpath'd). The canvas must resolve inside it — otherwise exit 1 `PATH_OUTSIDE_WORKSPACE` with a message telling the agent to pass `--workspace`.
2. **Validate locally first.** An invalid canvas never launches the UI; the CLI exits 1 with the full `errors[]` array.
3. Ensure a kernel: reuse via registry health ping, else spawn under the spawn lock (detached — survives the CLI exiting) and poll `/healthz` up to 10 s (`KERNEL_UNREACHABLE`, exit 2, includes the kernel log path). A version mismatch restarts an idle kernel.
4. `POST /api/open`, then open the browser (unless `--no-open`; a failed browser launch is a stderr warning `BROWSER_OPEN_FAILED` with the URL, never an error).
5. **Display canvas** → print `{"status": "opened", "url", ...}`, exit 0 immediately. **Interactive canvas** → block, polling the session every second until the human resolves it. Polling tolerates transient socket blips: fresh connection per request (`agent: false`) and up to 3 consecutive failures cross-checked against the registry health ping before declaring the kernel lost.
6. `--result <file>` mirrors the stdout JSON to a file. `--timeout <s>` overrides the session expiry (default 600).

### validate / catalog / status / stop

- `validate` prints the validator verdict (`{ok, errorCount, errors, warnings}`), exit 0/1, with a compact human rendering on stderr.
- `catalog` is the progressive-disclosure surface — lean index bare, one schema by name, `--full` for everything (see [canvas-schema.md](canvas-schema.md)).
- `status` reports `{running, root, port, pid, startedAt, version}`.
- `stop` shuts the kernel down and is idempotent.

## Result contract (stdout of `open`)

| Case | JSON |
|---|---|
| display | `{"status":"opened","url","canvas","workspace","timestamp"}` |
| form → file | `{"status":"saved","destination":{"kind","path"},"fields":[names],"overwritten":[names],"redacted":true,"timestamp"}` |
| form, no file destination | `{"status":"submitted","fields":[...],"values":{non-secret only}?,"timestamp"}` |
| cancelled / expired | `{"status":"cancelled"\|"timeout",...}` — exit 0 |
| confirm | `{"status":"confirmed"\|"cancelled","confirmed":bool,"timestamp"}` |
| error | `{"status":"error","error":{"code","message","errors"?},"timestamp"}` |

Secret values appear in **no** variant — see [security.md](security.md).

## The agent workflow

1. `catalog` → lean index → pick components.
2. `catalog <name>` → exact schema + example for each pick.
3. Write `<name>.canvas.json` inside the workspace.
4. `validate` → fix from `errors[]` → repeat until `{"ok": true}`.
5. `open` → parse the one-line result → continue from metadata only.

Convention: use the project root as the workspace for a whole session and subfolders as sidebar sections; separate workspaces only when the user genuinely wants isolation.
