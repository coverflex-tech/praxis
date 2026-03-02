/**
 * Tool-to-directory mapping for init/update.
 * Single source of truth: which tool ids exist and which directory name each uses.
 * OpenCode is reserved for a later phase once its expected paths/layout are confirmed.
 */

export const TOOL_FLAGS = ["cursor", "claude", "opencode"];

/** @type {Record<string, string>} Maps tool id → target directory name (e.g. cursor → .cursor) */
export const TOOL_TO_DIR = {
  cursor: ".cursor",
  claude: ".claude",
  // opencode: reserved; do not add until layout is documented
};

/**
 * Supported tool ids that have an implemented directory layout (excludes opencode).
 * @type {readonly string[]}
 */
export const SUPPORTED_TOOLS = Object.keys(TOOL_TO_DIR);

/**
 * @param {string} flag
 * @returns {boolean}
 */
export function isValidToolFlag(flag) {
  return TOOL_FLAGS.includes(flag);
}

/**
 * @param {string} toolId
 * @returns {boolean}
 */
export function isSupportedTool(toolId) {
  return toolId in TOOL_TO_DIR;
}

/**
 * @param {string} toolId
 * @returns {string | null} Target dir name or null if not supported
 */
export function getToolDir(toolId) {
  return TOOL_TO_DIR[toolId] ?? null;
}
