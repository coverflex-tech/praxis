---
title: Extend existing commands over adding new ones when behavior is a variant
date: 2025-02-27
category: pattern
plans:
  - .ai-workflow/plans/20250227-install-flags-multi-tool-support.md
tags: [cli, developer-experience, install, tooling]
---

# Extend existing commands over adding new ones when behavior is a variant

## Context

The idea was to "install Praxis with support for Cursor, OpenCode and Claude" via flags. The first plan draft introduced a new `install` command; the user asked to prioritize improving existing things, so we switched to extending `init` (and `update`) with optional tool flags instead.

## Insight

When the desired behavior is a variant of an existing flow (e.g. "install, but also for these tools"), extending the existing entrypoint with optional flags keeps the CLI surface small and avoids duplication. If the product already has a clear "install" entrypoint (here, `init`), adding flags to it is easier to document and to maintain than a separate command that shares most of the same logic.

## Evidence

Extending `init` with `--cursor`/`--claude` and `update` with the same flags meant one code path for "write .agents/, then optionally populate tool dirs." Init delegates to update when already initialized, so tool flags are passed through and a single flow handles both first-time and add-tool cases. No new command name to document or remember.

## Recommendation

Before adding a new CLI command, ask whether the behavior could be an optional mode of an existing command (flags or sub-options). Prefer extending the existing entrypoint when it keeps the mental model simple and reduces duplicate code.
