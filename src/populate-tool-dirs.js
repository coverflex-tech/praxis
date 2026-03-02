/**
 * Populate tool directories (.cursor, .claude, etc.) from .agents/ using symlink or copy.
 * Fails hard with stderr message and exit 1 on any runtime error.
 */

import { existsSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { getToolDir, isSupportedTool } from "./tools.js";
import { symlinkOrCopyFile } from "./symlink-or-copy.js";

const AGENTS_PREFIX = ".agents/";

function fail(message, code = 1) {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(code);
}

/**
 * Ensure path is under root (no path traversal). Uses resolve + relative for cross-platform safety.
 * @param {string} absolutePath
 * @param {string} rootDir - Must be resolved (e.g. resolve(projectRoot, dir))
 * @returns {boolean}
 */
function isUnderRoot(absolutePath, rootDir) {
  const resolved = resolve(absolutePath);
  const root = resolve(rootDir);
  const rel = relative(root, resolved);
  return (rel === "" || (!rel.startsWith("..") && !rel.includes("..")));
}

/**
 * Get relative paths under .agents/ from manifest files. Rejects paths that
 * traverse outside .agents/ (e.g. ".agents/../../evil").
 * @param {string} projectRoot
 * @param {Record<string, { hash: string }>} manifestFiles
 * @returns {string[]}
 */
function getAgentsRelativePaths(projectRoot, manifestFiles) {
  const agentsRoot = resolve(projectRoot, ".agents");
  return Object.keys(manifestFiles).filter((p) => {
    if (!p.startsWith(AGENTS_PREFIX)) return false;
    const full = resolve(projectRoot, p);
    return isUnderRoot(full, agentsRoot);
  });
}

/**
 * Check if tool dir already has any Praxis content (any of the agents paths).
 * @param {string} projectRoot
 * @param {string} toolDir
 * @param {string[]} agentsPaths
 * @returns {Promise<boolean>}
 */
async function toolDirHasContent(projectRoot, toolDir, agentsPaths) {
  const fullDir = join(projectRoot, toolDir);
  if (!existsSync(fullDir)) return false;
  for (const rel of agentsPaths) {
    const underTool = rel.slice(AGENTS_PREFIX.length);
    const destPath = join(projectRoot, toolDir, underTool);
    if (existsSync(destPath)) return true;
  }
  return false;
}

/**
 * Populate one or more tool directories from .agents/.
 * Requires .agents/ to exist. Fails hard on missing .agents/, permission, or copy failure.
 *
 * @param {string} projectRoot
 * @param {string[]} toolIds - e.g. ['cursor', 'claude']
 * @param {{ files: Record<string, { hash: string }> }} manifest - Current manifest (must have files)
 * @param {{ force?: boolean }} options - If force, overwrite existing tool dir content
 * @returns {Promise<string[]>} List of tool ids that were successfully populated
 */
export async function populateToolDirs(projectRoot, toolIds, manifest, options = {}) {
  const { force = false } = options;

  if (!manifest?.files || typeof manifest.files !== "object") {
    fail("Invalid manifest: missing files. Run praxis init first.", 1);
  }

  const agentsPaths = getAgentsRelativePaths(projectRoot, manifest.files);

  if (agentsPaths.length === 0) {
    fail("No .agents/ files in manifest. Run praxis init first.", 1);
  }

  const agentsDir = resolve(projectRoot, ".agents");
  if (!existsSync(agentsDir)) {
    fail("Run praxis init first in this project.", 1);
  }

  const populated = [];
  const seenTools = new Set();

  for (const toolId of toolIds) {
    if (!isSupportedTool(toolId) || seenTools.has(toolId)) continue;
    seenTools.add(toolId);

    const toolDir = getToolDir(toolId);
    const fullToolDir = resolve(projectRoot, toolDir);

    const hasContent = await toolDirHasContent(projectRoot, toolDir, agentsPaths);
    if (hasContent && !force) {
      fail(
        `Tool dir ${toolDir} already present; use praxis update to refresh or remove the directory first.`,
        1
      );
    }

    if (hasContent && force) {
      const entries = await readdir(fullToolDir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name === "." || e.name === "..") continue;
        const entryPath = join(fullToolDir, e.name);
        if (!isUnderRoot(entryPath, fullToolDir)) continue;
        await rm(entryPath, { recursive: true, force: true });
      }
    }

    let wroteAny = false;
    for (const relPath of agentsPaths) {
      const sourcePath = resolve(projectRoot, relPath);
      if (!isUnderRoot(sourcePath, agentsDir)) continue;
      const underTool = relPath.slice(AGENTS_PREFIX.length);
      const destPath = resolve(projectRoot, toolDir, underTool);
      const destRoot = resolve(projectRoot, toolDir);
      if (!isUnderRoot(destPath, destRoot)) continue;
      if (!existsSync(sourcePath)) continue;
      await symlinkOrCopyFile(sourcePath, destPath);
      wroteAny = true;
    }

    if (wroteAny) populated.push(toolId);
  }

  return populated;
}
