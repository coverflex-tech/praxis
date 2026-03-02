/**
 * Portable symlink-or-copy for populating tool dirs from .agents/.
 * Tries symlink first (junction on Windows for dirs; not used for our file-only mirror).
 * For files: try symlink, then copy. Fails hard with stderr message on final failure.
 */

import { copyFile, mkdir, symlink } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync } from "node:fs";

const isWindows = process.platform === "win32";

/**
 * Write an error to stderr and exit. Call when symlink and copy both failed.
 * @param {string} message
 * @param {number} code
 */
function fail(message, code = 1) {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(code);
}

/**
 * Ensure the directory for destPath exists.
 * @param {string} destPath
 */
async function ensureParentDir(destPath) {
  const dir = dirname(destPath);
  await mkdir(dir, { recursive: true });
}

/**
 * Create destPath as a symlink to sourcePath, or copy the file on failure.
 * Does not overwrite existing symlinks/files; caller must remove first for refresh.
 * Fails hard (stderr + exit 1) if both symlink and copy fail.
 *
 * @param {string} sourcePath - Absolute path to source file
 * @param {string} destPath - Absolute path to destination file
 */
export async function symlinkOrCopyFile(sourcePath, destPath) {
  await ensureParentDir(destPath);

  if (existsSync(destPath)) {
    return; // Already present; caller is responsible for --force/refresh (remove first)
  }

  const symlinkType = isWindows ? "file" : undefined;

  try {
    await symlink(sourcePath, destPath, symlinkType);
    return;
  } catch {
    // Symlink failed (e.g. permission on Windows); try copy
  }

  try {
    await copyFile(sourcePath, destPath);
  } catch {
    fail(
      "Could not create or copy file. Check permissions and disk space.",
      1
    );
  }
}
