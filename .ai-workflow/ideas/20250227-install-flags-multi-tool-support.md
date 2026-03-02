---
title: Install Praxis with flags for Cursor, OpenCode, and Claude
date: 2025-02-27
status: done
tags: [cli, developer-experience, distribution, install, portability, tooling]
---

# Install Praxis with flags for Cursor, OpenCode, and Claude

## Problem

Users who want Praxis to work natively in more than one AI coding tool (Cursor, Claude Code / Claude, OpenCode) today have to copy or symlink files manually into each tool’s expected directories (e.g. `.cursor/`, `.claude/`). That’s error-prone, drifts over time, and doesn’t feel “native” in any of the tools. There’s no single, clear way to say “install Praxis for Cursor and Claude” and get a zero-friction experience in both.

## Core Idea

Provide an install method (e.g. CLI or script) that accepts **explicit opt-in flags** (e.g. `--cursor`, `--claude`, `--opencode`). For each flag, the installer sets up the layout that tool expects so that Praxis feels native in that tool with **near-zero manual steps**. Prefer **portability** over clever deduplication: the solution must behave correctly on Windows, macOS, and Linux. When the environment can’t support the requested setup (e.g. symlinks not available or not reliable), **fail hard** with a clear, actionable error message instead of degrading silently.

## Key Insights

- **Explicit opt-in** — No “install everything” by default. Users pass flags for the tools they use; only those get configured.
- **Native feel, near-zero steps** — Success means: after install, the user opens that tool and Praxis is already there; no extra copy/paste or config.
- **Portability over deduplication** — Working reliably on all supported platforms is more important than minimizing disk usage (e.g. symlinks). If symlinks aren’t safe on a platform, use a portable alternative (e.g. copy) or fail hard with explanation.
- **Fail hard, explain properly** — If the installer can’t fulfill a request (missing permissions, unsupported OS, symlink not supported), exit with a non-zero code and print a clear message: what failed, why, and what the user can do (e.g. use a different flag, run as admin, or use a different OS).

## Open Questions

- Exact CLI surface: subcommand (`praxis install --cursor --claude`) vs single command with flags; naming of the binary/entrypoint.
- Where “single source of truth” lives during install (e.g. one canonical `.agents/`-style tree) and how each tool’s directory is populated (symlink vs copy) per platform.
- Whether OpenCode’s expected paths and layout are documented and stable enough to support.
- How to detect or configure “install location” (current repo vs global vs user-defined path) and whether multiple install targets are in scope for v1.

## Possible Directions

- **Symlink-first with portable fallback** — Use symlinks where they’re reliable (e.g. macOS/Linux); on Windows or when symlinks fail, either copy files or fail hard with instructions. Keeps one source of truth where symlinks work.
- **Copy-only** — Always copy the canonical Praxis tree into each tool’s directory. No symlink complexity; works everywhere; duplicates content per tool.
- **Single flag, one tool** — First version only supports one tool per run; multi-tool is multiple invocations. Simplifies UX and error messages.

## Related Documents

- .ai-workflow/plans/20250227-install-flags-multi-tool-support.md
- .ai-workflow/learnings/20250227-path-safety-when-using-manifest-or-readdir.md
- .ai-workflow/learnings/20250227-cli-errors-must-not-leak-internal-paths.md
- .ai-workflow/learnings/20250227-extend-existing-commands-over-new-ones.md
