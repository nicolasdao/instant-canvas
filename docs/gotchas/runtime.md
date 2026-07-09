---
description: Kernel and CLI gotchas — process lifecycle, sockets, stdout, and state-dir traps learned while building the runtime.
tags: [gotchas, kernel, cli]
source:
  - .agents/skills/instant-canvas/scripts/kernel.js
  - .agents/skills/instant-canvas/scripts/instantcanvas.js
  - .agents/skills/instant-canvas/scripts/lib/registry.js
---

# Gotchas — Runtime (kernel & CLI)

## `process.exit` truncates large stdout

Writing a big JSON document (the catalog is tens of KB) and then calling `process.exit` truncates piped output, because stdout to a pipe flushes asynchronously. The CLI's `out()` therefore exits inside the `process.stdout.write` callback and throws a `__exit` sentinel to stop the caller's control flow. If you add a new output path, route it through `out()` — never `console.log` + `process.exit`.

## A single failed session poll is not a dead kernel

The CLI polls interactive sessions every second. With Node's default keep-alive agent, a pooled socket occasionally gets reused at the exact moment the kernel's HTTP server closes it (default ~5 s `keepAliveTimeout`), yielding one `ECONNRESET` — after ~8 minutes of polling this *will* happen. Treating one blip as fatal produced false `KERNEL_UNREACHABLE` deaths while the kernel was healthy. Fix in place: `agent: false` (fresh connection per request) plus a tolerance loop that only gives up after 3 consecutive failures *confirmed* by a failed registry health ping. Keep both if you touch the polling code.

## Same-version code changes do not restart a running kernel

The CLI's version handshake only restarts a kernel whose `/healthz` version differs. During development the version rarely changes, so a long-lived kernel keeps serving **old validator/kernel code** — symptoms like "the CLI validates this canvas but the kernel rejects it" mean exactly this. Run `stop` (or bump the version) after changing kernel-side code. Web assets are exempt: they are read from disk per request, so a browser refresh is enough.

## Liveness must be health-ping, never PID

A PID can be recycled, and a live PID says nothing about *which* server owns the port. `readAlive()` requires a 200 from `/healthz` **and** `name: "instantcanvas"` **and** a matching normalized workspace; anything less deletes the registry entry. This is also what makes `kill -9` recovery work — do not "optimize" it to `process.kill(pid, 0)`.

## macOS `/tmp` is a symlink

`/tmp` → `/private/tmp`, so a workspace identified by the path the user typed and the path the kernel realpaths can differ, splitting one workspace into two registry keys. The CLI realpaths its workspace root and `readAlive` accepts either form. Any new path that participates in workspace identity must be realpath'd the same way.

## Background `open` outliving its shell

An interactive `open` backgrounded with `&` dies when its shell is cleaned up, but the **kernel and the session live on** — the browser form still works; only the stdout consumer is gone. Conversely, stopping a kernel kills every blocked `open` against it with `KERNEL_UNREACHABLE` (exit 2). When testing interactive flows from scripts, hold the CLI process handle rather than shell-backgrounding it.

## Deleting collections is not `rm -rf`

`POST /api/collection/delete` removes only marker-verified canvas files directly inside a depth-1 folder, keeps everything else, and removes the folder only if it ends up empty. `(root)`, dot-names, and traversal names are refused outright. Preserve those semantics if you extend deletion — the sidebar maps to a real folder the user may keep unrelated files in.
