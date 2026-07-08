#!/usr/bin/env node
'use strict'

const USAGE = `InstantCanvas — local canvas runtime for coding agents

Usage: node scripts/instantcanvas.js <command> [args]

Commands:
  open <canvas.json> [--workspace <dir>] [--no-open] [--timeout <s>] [--result <file>]
      Render a canvas in the browser. Display canvases return immediately;
      interactive canvases (form/confirm) block until the human responds.
  validate <canvas.json>       Validate a canvas file, print JSON verdict.
  catalog [name]               Print the machine-readable block/field contract.
  status [--workspace <dir>]   Report the workspace kernel state.
  stop [--workspace <dir>]     Stop the workspace kernel.

stdout carries exactly one JSON document; logs go to stderr.
`

function main() {
	process.stderr.write(USAGE)
	process.exit(1)
}

main()
