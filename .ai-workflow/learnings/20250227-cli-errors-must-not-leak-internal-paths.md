---
title: CLI error messages must not leak internal paths or exception details
date: 2025-02-27
category: anti-pattern
plans:
  - .ai-workflow/plans/20250227-install-flags-multi-tool-support.md
tags: [cli, developer-experience, security, tooling]
---

# CLI error messages must not leak internal paths or exception details

## Context

The install-flags implementation failed hard with a stderr message when symlink or copy failed. The initial message included `err.message` from the caught exception.

## Insight

User-facing error output (e.g. stderr) should not include raw exception messages or filesystem paths. `copyFile`/`symlink` errors often contain full paths (e.g. `ENOENT: ... open '/home/user/project/.agents/...'`), which leak internal layout and can aid attackers (OWASP A10 — mishandling exceptional conditions).

## Evidence

The security reviewer flagged that the failure message `Could not create or copy file: ${err.message}` could expose paths on stderr. We changed it to a generic message: "Could not create or copy file. Check permissions and disk space." with no reference to `err.message`.

## Recommendation

When writing errors to stderr in a CLI, use a short, actionable message only. Do not interpolate `err.message`, stack traces, or resolved paths. Log full details only to a debug stream or omit them from user-facing output.
