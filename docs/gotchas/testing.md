---
description: node:test runner traps on Node 24 — subtest socket isolation, directory entries, and shared-state-dir coordination.
tags: [gotchas, testing, node24]
source:
  - .agents/skills/instant-canvas/scripts/test/**
---

# Gotchas — Testing

## Subtests cannot reach parent-context servers (Node 24.0.x)

Sockets opened inside a `t.test()` subtest get `ECONNRESET`/`ECONNREFUSED` against TCP/HTTP servers created in the parent test's async context — while `lsof` shows the listener alive and healthy. Reproduced with a minimal in-process `http.createServer`; it is not the sandbox and not the kernel. Structure integration tests as **`test.before` hook + sequential top-level `test()` calls** (that crossing works); never exercise a shared server from subtests. `kernel.test.js` carries the header comment explaining this.

## `node --test <dir>` does not expand the directory

On the pinned Node version, passing a directory to `--test` tries to *require* it as a module and fails. `scripts/test/index.js` makes the directory itself a valid test entry by requiring every sibling `*.test.js` — keep it updated-free (it globs) and don't delete it, or the documented `node --test scripts/test/` invocation breaks.

## Set the state dir with `||=`, before requiring the registry

Via `index.js` the whole suite runs in **one process**, so every test file's module-level `process.env.INSTANTCANVAS_STATE_DIR = mkdtemp()` overwrites the previous file's. The symptom was maddening: the kernel test's spawned kernel registered into one state dir while the test polled another, so the kernel "never came up." Rule: `process.env.INSTANTCANVAS_STATE_DIR = process.env.INSTANTCANVAS_STATE_DIR || mkdtemp()` — first loader wins — and always set it *before* `require('../lib/registry')`.

## A security scan can trip over its own test file

The hardening test asserts the wildcard bind address appears nowhere in the source tree — and the test file itself is part of that tree. Build the forbidden string dynamically (`['0','0','0','0'].join('.')`) so the scan passes its own file. Any future "string X must not appear" scan needs the same trick.

## Fake registry entries in shared state dirs look like leaks

`registry.test.js` writes entries with dead ports and dummy tokens into the shared state dir; after a full-suite run those files linger and look like orphaned kernels. Check `token: "t"` / `startedAt: "now"` before chasing a "leaked kernel" — it is test debris, cleaned by the OS temp reaper.
