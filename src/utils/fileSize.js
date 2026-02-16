'use strict';

const path = require('path');
const fs = require('fs').promises;

const sizeCache = new Map();

/**
 * Get total size of a directory in bytes.
 * @param {string} dirPath
 * @param {object} options - { useCache }
 * @returns {Promise<number>}
 */
async function getDirectorySize(dirPath, options = {}) {
  const useCache = options.useCache !== false;
  const resolved = path.resolve(dirPath);

  if (useCache && sizeCache.has(resolved)) {
    return sizeCache.get(resolved);
  }

  let totalSize = 0;

  async function walk(currentPath) {
    let stats;
    try {
      stats = await fs.lstat(currentPath);
    } catch (err) {
      if (err.code === 'EACCES' || err.code === 'ENOENT') return;
      throw err;
    }

    if (stats.isSymbolicLink()) return;

    if (stats.isFile()) {
      totalSize += stats.size;
      return;
    }

    if (!stats.isDirectory()) return;

    let entries;
    try {
      entries = await fs.readdir(currentPath);
    } catch (err) {
      if (err.code === 'EACCES' || err.code === 'ENOENT') return;
      throw err;
    }

    for (const entry of entries) {
      await walk(path.join(currentPath, entry));
    }
  }

  await walk(resolved);

  if (useCache) {
    sizeCache.set(resolved, totalSize);
  }

  return totalSize;
}

/**
 * Format bytes as human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Clear the size cache (e.g. between runs).
 */
function clearSizeCache() {
  sizeCache.clear();
}

module.exports = {
  getDirectorySize,
  formatBytes,
  clearSizeCache,
};
