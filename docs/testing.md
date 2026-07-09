---
description: The zero-dependency node:test suite — layout, isolation patterns, security regressions, and the CDP-driven browser verification used during development.
tags: [testing, node-test, cdp, verification]
source:
  - .agents/skills/instant-canvas/scripts/test/**
---

# Testing

Everything runs on `node:test` with zero dependencies:

```bash
cd .agents/skills/instant-canvas
node --test scripts/test/
```

83 tests at last count. `scripts/test/index.js` exists because `node --test <dir>` does not expand a directory on the pinned Node version — the directory resolves to `index.js`, which requires every `*.test.js` (see [gotchas/testing.md](gotchas/testing.md)).

## Suite layout

| File | Covers |
|---|---|
| `paths.test.js` | Root normalization, workspace keys, `insideRoot` traversal/symlink defense (including not-yet-existing targets). |
| `fsatomic.test.js` / `envfile.test.js` | Atomic writes, modes; parse-preserving env merge (comments, order, quoting, replace, dry-run). |
| `redact.test.js` | Every redaction pattern plus registered exact values. |
| `registry.test.js` | Health-ping liveness, stale-entry cleanup, spawn-lock contention and stale-lock breaking. |
| `validate.test.js` / `catalog.test.js` | Every validator error code; per-kind chart rules; fieldset/ui/span rules; lean-vs-full catalog; the registry-tweak drift test. |
| `scan.test.js` | Marker discrimination, 2-level depth, ordering; session lifecycle. |
| `kernel.test.js` | A real spawned kernel: healthz, 403s (token, Host), asset traversal, tree, WS round-trip, sessions, collection delete, shutdown. |
| `cli.test.js` | Usage/exit codes, validate/catalog output, the full open lifecycle including kill -9 recovery and `--result`. |
| `forms.test.js` | Blocking `open` + HTTP submit: `.env` round-trip with redaction sweep, overwrite/outside-root 409 handshakes, confirm/timeout/cancel, json destinations, url-protocol and patternMessage rules. |
| `hardening.test.js` | Source scans (loopback literal, no third-party requires, timing-safe compare, no CORS, no `console.log` server-side) and runtime error codes (`WRITE_FAILED`, `SESSION_TIMEOUT`, `KERNEL_UNREACHABLE`). |

## Isolation patterns

- **State dir**: every test file that touches the registry sets `INSTANTCANVAS_STATE_DIR` with `||=` *before requiring* `lib/registry` — first loader wins, so the whole single-process suite shares one temp state dir instead of fighting over it (the plain-assignment version caused cross-file kernel misses).
- **Kernel tests are before-hook + top-level tests, never subtests** — on the pinned Node 24.0.x, sockets opened inside a `t.test()` subtest cannot reach servers created in the parent test's async context (see [gotchas/testing.md](gotchas/testing.md)).
- Timing knobs for slow paths: `INSTANTCANVAS_LOCK_WAIT_MS` makes the `KERNEL_UNREACHABLE` test fast.

## Security regressions

`hardening.test.js` pins the security posture in source scans, so a regression fails before it ships: the server must bind the literal `127.0.0.1` (the wildcard address is asserted absent — the assertion builds the string dynamically so the test file passes its own scan), token comparison must use `crypto.timingSafeEqual`, no `Access-Control-Allow` headers, only `node:` builtins and relative requires anywhere, and the `SECRET_RETURN_BLOCKED` / `BROWSER_OPEN_FAILED` guards must exist. `forms.test.js` additionally greps every output channel for planted secret values.

## Browser verification (development practice, not in the suite)

The suite covers everything up to HTTP/WS. Actual rendering and widget interaction were verified during development by driving headless Chrome over the **DevTools protocol with a hand-rolled CDP client** (the repo's own masked-WebSocket knowledge reused): click the real buttons, read the real DOM, capture screenshots. This caught bugs static tests could not — the date-picker's self-closing arrows, the CSP-dropped grid styles, the chart `options` series wipe-out. Pattern to reuse: launch Chrome with `--headless=new --remote-debugging-port`, fetch `/json/list`, speak `Runtime.evaluate` / `Page.captureScreenshot` over its WebSocket.
