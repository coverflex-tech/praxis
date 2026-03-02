---
title: Install Praxis with flags for Cursor, Claude, and OpenCode (phase 1)
date: 2025-02-27
status: done
ideas:
  - .ai-workflow/ideas/20250227-install-flags-multi-tool-support.md
group: install-flags-multi-tool-support
phase: 1
tags: [cli, developer-experience, install, portability, tooling]
---

# Install Praxis with flags for Cursor, Claude, and OpenCode (phase 1)

## Goal

After this plan is executed, users can run the existing `init` command with optional opt-in flags (e.g. `praxis init --cursor --claude`) and get Praxis wired into each selected tool’s expected directory so it feels native there with no manual steps. The implementation extends the current `init` (and `update`, where init delegates) rather than adding a new command. Behavior remains portable (Windows, macOS, Linux), uses symlinks where safe and a defined fallback otherwise, and fails hard with a clear, actionable error message when something cannot be done.

## Background

Idea: [.ai-workflow/ideas/20250227-install-flags-multi-tool-support.md](.ai-workflow/ideas/20250227-install-flags-multi-tool-support.md). Core constraints: explicit opt-in flags only, native feel with near-zero steps, portability over deduplication, fail hard with proper explanation. In this CLI, **init is the install entrypoint**: it fetches and writes `.agents/`, `.ai-workflow/`, and the manifest. Today it does not create tool-specific dirs (`.cursor/`, `.claude/`). This plan extends init (and update when init delegates) so that install can target those tools via flags—no separate install command.

## Research Summary

- **Codebase:** Canonical source is `.agents/`. No code touches `.cursor` or `.claude`. Extending `init` (and `update`) with optional tool flags, plus a mapping from tool id to target dir and manifest changes, lets `update` refresh tool dirs without introducing a new command.
- **Learnings:** Verify symlink/copy and platform behavior before locking the plan; include automated tests in the plan; plan for parallel reviewers after implementation.
- **External:** Pass backend flags after `--` when using npx. Prefer symlink → on Windows try junction for dirs → then copy; use stderr for all errors; exit 0 only on full success, 1 for runtime errors, 2 for usage; one clear error line (what failed + what to do). No exit 0 when any requested backend fails.

## Steps

1. **Define tool-to-directory mapping** — Introduce a single source of truth (e.g. a small config module or table in code) that maps tool ids to target directory names: `cursor` → `.cursor`, `claude` → `.claude`. Reserve `opencode` for a later phase (do not implement OpenCode layout in this plan). Document that OpenCode will be added once its expected paths/layout are confirmed; if `--opencode` is accepted as a flag, init must exit with a clear, non-zero code and a stderr message such as "OpenCode is not yet supported; see <link> for status" rather than creating partial or incorrect layout.

2. **Extend `init` with optional tool flags** — Add optional flags to the existing `init` command: `--cursor`, `--claude`, and (if desired) `--opencode`. No flag is required; without any of these, `init` behaves exactly as today (fetch templates, write `.agents/`, `.ai-workflow/`, manifest). When one or more flags are passed, after the normal init work (writing `.agents/`), populate each requested tool’s directory from `.agents/` (see step 4) and record them in the manifest. When `init` detects an already-initialized project and delegates to `update`, pass the tool flags through to `update` so that tool dirs are still added or refreshed. Reuse the same CLI parsing and help so that `init`’s usage shows these options; when invoked via npx, flags must be passed after `--` (e.g. `npx praxis init -- --cursor --claude`). Invalid flags must exit with code 2 and a single stderr message listing valid options.

3. **Implement portable symlink/copy strategy** — Implement a small helper (or use a well-maintained dependency such as `symlink-or-copy`) that, for each file or directory to place under a tool’s target dir: on Unix, try `fs.symlink` first, then fall back to recursive copy if symlink fails (e.g. permission or filesystem); on Windows, try `fs.symlink` with appropriate type, then for directories try `fs.symlink(..., 'junction')`, then fall back to copy. If the chosen strategy fails (e.g. copy fails due to permission), do not retry another strategy silently; fail hard with exit code 1 and a stderr message stating what failed and what the user can do (e.g. run with different permissions or use a different path). Verify behavior on at least macOS, Linux, and Windows (or document known limitations) before considering this step done.

4. **Populate tool directories from `.agents/`** — For each requested and supported tool (cursor, claude): (a) Use the same project root as `init`/`update`. (b) When this logic runs from `init`, `.agents/` has just been written, so it exists. When it runs from `update` (see step 7), `.agents/` already exists. If at any point we need to populate a tool dir and `.agents/` is missing, exit with code 1 and a clear stderr message (e.g. "Run `praxis init` first in this project."). (c) For the tool’s target directory (e.g. `.cursor/`), if it already exists and contains any of the expected Praxis entries, either exit with code 1 and a message like "Tool dir already present; use `praxis update` to refresh or remove the directory first," or support an explicit `--force` flag that overwrites; the plan recommends failing if the target tool dir already has content unless `--force` is set. (d) Create the full directory structure under the tool dir mirroring `.agents/` (skills, agents, conventions, reviewer-output-format, etc.) using the symlink/copy helper from step 3 so that the tool sees the same layout as `.agents/`.

5. **Standardize fail-hard error reporting** — All error and warning output must go to stderr. On any fatal error: write exactly one message to stderr with a consistent prefix (e.g. "Error: ") followed by a short description of what failed and one actionable suggestion (e.g. "Run `praxis init` first." or "Valid tool flags are --cursor, --claude."). Then call `process.exit(1)` for runtime failures (missing `.agents/`, permission, disk, symlink/copy failure) or `process.exit(2)` for usage failures (invalid flags). Do not exit with code 0 if any requested tool dir failed to populate; if one tool fails, the whole run fails.

6. **Extend `.praxis-manifest.json` with tools populated by init** — Add a field to the manifest (e.g. `tools: ["cursor", "claude"]`) that records which tool dirs init (or update, when it runs the same logic) successfully populated. When init completes the tool-step successfully, write or update this field so that subsequent `update` runs know which tool dirs to refresh. Do not add tool names for which population failed or was skipped.

7. **Make `update` refresh tool dirs (and optionally accept tool flags)** — When `praxis update` runs, after updating `.agents/` from the remote source, if the manifest contains a non-empty `tools` list, refresh each listed tool’s directory from the local `.agents/` tree using the same symlink/copy strategy as init (so that updated skills and agents are reflected in `.cursor/` and `.claude/`). Optionally, allow `update` to accept the same tool flags as init (e.g. `praxis update --cursor`); when a flag is passed, ensure that tool’s dir is created or refreshed and add it to `manifest.tools` if not already present, so users can add another tool to an already-initialized project without running init again. If refreshing or creating any tool dir fails, fail the whole update with a clear stderr message and exit code 1.

8. **Add automated tests** — Add tests that cover: (a) `init --cursor` creates `.cursor/` with the expected structure and content derived from `.agents/`. (b) `init --claude` creates `.claude/` similarly. (c) `init` with no tool flags leaves no `.cursor`/`.claude` and behaves as today. (d) `init` with invalid tool flags exits with code 2 and the expected stderr message. (e) When the target tool dir already exists and has content, init/update fails the tool step with code 1 (and with `--force` succeeds, if that option is implemented). (f) Manifest contains the correct `tools` array after a successful init with tool flags. (g) `update` refreshes manifest-listed tool dirs from `.agents/` after updating templates. (h) On a platform or environment where symlink/copy behavior can be tested or mocked, the chosen strategy is exercised and failures produce the required exit code and stderr. Prefer adding tests as each step is implemented rather than only at the end.

9. **Document usage and exit codes** — In the README (and in CLI `--help` if available): document that `init` accepts optional tool flags (--cursor, --claude) and that flags must appear after `--` when using npx (e.g. `npx praxis init -- --cursor --claude`); note OpenCode as not yet supported if the flag exists; document that `update` refreshes tool dirs listed in the manifest and can accept the same flags to add a new tool to an existing project; document exit codes (0 success, 1 runtime error, 2 usage error) and point to stderr for error messages. Optionally add a short "Troubleshooting" or "Failures" section that explains common errors (e.g. "Run praxis init first", "OpenCode not yet supported").

## Acceptance Criteria

- [x] User can run `praxis init --cursor` (or `npx praxis init -- --cursor`) and get a working `.cursor/` layout derived from `.agents/` with no manual steps.
- [x] User can run `praxis init --claude` and get a working `.claude/` layout similarly.
- [x] User can run `praxis init --cursor --claude` and get both directories populated in one run.
- [x] `init` with no tool flags behaves exactly as today (no new command; no change to default flow).
- [x] If an invalid tool flag is passed to `init`, the process exits with code 2 and a single, clear stderr message.
- [x] If the tool-population step cannot create the required layout (e.g. permission or unsupported filesystem), the process exits with code 1 and a stderr message explaining what failed and what to do.
- [x] On success when tool flags were used, `.praxis-manifest.json` includes a `tools` array listing the populated tool(s).
- [x] Running `praxis update` refreshes the listed tool dirs from `.agents/` so they stay in sync.
- [x] Automated tests cover the cases above; at least one test or CI run validates behavior on more than one OS where feasible.
- [x] README and help document `init`’s optional tool flags, use of `--` with npx, and exit codes.

## Dependencies

- Node and the existing CLI (init/update/status) are the runtime environment; no new commands or runtime stack are introduced. When tool flags are used, `.agents/` is created by `init` in the same run before populating tool dirs, or already exists when `update` runs.

## Related Documents

- .ai-workflow/ideas/20250227-install-flags-multi-tool-support.md
- .ai-workflow/learnings/20250227-path-safety-when-using-manifest-or-readdir.md
- .ai-workflow/learnings/20250227-cli-errors-must-not-leak-internal-paths.md
- .ai-workflow/learnings/20250227-extend-existing-commands-over-new-ones.md
