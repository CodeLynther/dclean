'use strict';

const path = require('path');
const fs = require('fs').promises;
const { IGNORE_DIRS, MAX_SCAN_DEPTH } = require('./constants');

/**
 * Walk a directory recursively, calling callback for each file/dir.
 * @param {string} dirPath - Root path to walk
 * @param {function(string, import('fs').Stats): void|Promise<void>} callback - (fullPath, stats)
 * @param {object} options - { maxDepth, ignoreDirs, skipDescendingInto, onEnterDir }
 *   skipDescendingInto: do not recurse into dirs with these basenames (e.g. ['node_modules']) for performance
 *   onEnterDir: (currentPath, depth) => {} called when entering a directory; depth 1 = direct child of root
 * @returns {Promise<void>}
 */
async function walkDirectory(dirPath, callback, options = {}) {
  const maxDepth = options.maxDepth ?? MAX_SCAN_DEPTH;
  const ignoreDirs = options.ignoreDirs ?? IGNORE_DIRS;
  const skipDescendingInto = options.skipDescendingInto ?? [];
  const onEnterDir = options.onEnterDir;

  async function walk(currentPath, depth) {
    if (depth > maxDepth) return;

    let stats;
    try {
      stats = await fs.lstat(currentPath);
    } catch (err) {
      if (err.code === 'EACCES' || err.code === 'ENOENT') return;
      throw err;
    }

    if (stats.isSymbolicLink()) return;

    if (stats.isFile()) {
      await Promise.resolve(callback(currentPath, stats));
      return;
    }

    if (!stats.isDirectory()) return;

    const basename = path.basename(currentPath);
    if (ignoreDirs.some((ignore) => basename === ignore || currentPath.endsWith(ignore))) {
      return;
    }

    if (onEnterDir && depth === 1) {
      try {
        onEnterDir(currentPath, depth);
      } catch {}
    }

    await Promise.resolve(callback(currentPath, stats));

    if (skipDescendingInto.includes(basename)) return;

    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: false });
    } catch (err) {
      if (err.code === 'EACCES' || err.code === 'ENOENT') return;
      throw err;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry);
      await walk(fullPath, depth + 1);
    }
  }

  await walk(dirPath, 0);
}

/**
 * Get last modified time of a path.
 * @param {string} filePath
 * @returns {Promise<Date|null>} mtime or null if not found
 */
async function getLastModified(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.mtime;
  } catch {
    return null;
  }
}

/**
 * Check if path exists.
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure path is under home and not a protected directory.
 * @param {string} filePath - Resolved absolute path
 * @param {string} homeDir
 * @returns {boolean}
 */
function isPathSafeForScan(filePath, homeDir) {
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(homeDir)) return false;
  if (normalized === homeDir) return false;
  return true;
}

module.exports = {
  walkDirectory,
  getLastModified,
  pathExists,
  isPathSafeForScan,
};
