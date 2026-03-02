---
title: Validate path containment when building paths from manifest or deleting dir contents
date: 2025-02-27
category: anti-pattern
plans:
  - .ai-workflow/plans/20250227-install-flags-multi-tool-support.md
tags: [cli, install, security, tooling]
---

# Validate path containment when building paths from manifest or deleting dir contents

## Context

During the install-flags implementation, we populated tool dirs (e.g. `.cursor/`) from `.agents/` using paths taken from `.praxis-manifest.json` and, when `--force` was set, deleted existing contents via `readdir` + `rm` on each entry.

## Insight

Paths built from manifest keys or from `readdir` must be validated before use. A tampered manifest can contain keys like `".agents/../../evil"`; joining them with `projectRoot` can produce paths outside the project. When deleting directory contents, `readdir` returns `"."` and `".."` — and `join(fullToolDir, "..")` is the parent directory, so `rm` could delete the project root.

## Evidence

The security reviewer found two critical issues: (1) path traversal — `destPath = join(projectRoot, toolDir, underTool)` with a malicious manifest key could write outside the project; (2) force-rm — iterating `readdir` entries and calling `rm(join(fullToolDir, e.name))` without skipping `"."`/`".."` could remove the project directory. Both were fixed by adding an `isUnderRoot(resolvedPath, rootDir)` check using `path.resolve` and `path.relative`, and by skipping `"."` and `".."` and validating each entry path before `rm`.

## Recommendation

In plans or implementation checklists for code that does file operations from config/manifest or recursive deletes: (1) Normalize all paths with `path.resolve` and require that they stay under the intended root (e.g. `path.relative(root, resolved)` must not start with `".."`). (2) When deleting directory contents from `readdir`, skip entries whose `name` is `"."` or `".."`, and only call `rm` on paths that pass the same under-root check.
