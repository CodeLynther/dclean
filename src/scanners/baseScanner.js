'use strict';

const path = require('path');
const { walkDirectory, getLastModified } = require('../utils/fileSystem');
const { getDirectorySize } = require('../utils/fileSize');
const constants = require('../utils/constants');
const logger = require('../utils/logger');

class BaseScanner {
  /**
   * @param {string} name - Unique identifier for the scanner (e.g., 'node_modules')
   * @param {object} [options={}] - Scanner configuration
   * @param {number} [options.maxDepth] - Recursion limit for directory traversal
   * @param {string[]} [options.ignorePatterns] - Directory names to skip entirely
   */
  constructor(name, options = {}) {
    this.name = name;
    this.maxDepth = options.maxDepth ?? constants.MAX_SCAN_DEPTH;
    this.ignorePatterns = options.ignorePatterns ?? constants.IGNORE_DIRS;
  }

  /**
   * Find all directories with the given name under startPath.
   * Leverages the centralized walkDirectory utility with scanner-specific constraints.
   *
   * @param {string} startPath - Root directory for the search
   * @param {string} targetName - Basename of the directory to find (e.g. 'venv')
   * @param {object} [opts={}] - Navigation options
   * @param {string[]} [opts.skipDescendingInto] - Optimization: do not recurse into found matches
   * @param {Function} [opts.onEnterDir] - Telemetry: hook called when entering sub-directories
   * @returns {Promise<string[]>} Array of absolute paths to discovered directories
   */
  async findDirectories(startPath, targetName, opts = {}) {
    const found = [];
    const skipDescendingInto = opts.skipDescendingInto ?? [targetName];
    const onEnterDir = opts.onEnterDir;
    await walkDirectory(
      startPath,
      (filePath, stats) => {
        if (stats.isDirectory() && path.basename(filePath) === targetName) {
          found.push(filePath);
        }
      },
      {
        maxDepth: this.maxDepth,
        ignoreDirs: this.ignorePatterns,
        skipDescendingInto,
        onEnterDir,
      }
    );
    return found;
  }

  /**
   * Calculate total size of a directory in bytes.
   * Gracefully handles permission issues and ephemeral I/O errors.
   *
   * @param {string} dirPath - Absolute path to the directory
   * @returns {Promise<number>} Size in bytes; returns 0 on complete failure
   */
  async calculateSize(dirPath) {
    try {
      return await getDirectorySize(dirPath);
    } catch (err) {
      if (err.code === 'EACCES') {
        logger.warn(`Permission denied measuring size (partial scan only): ${dirPath}`);
      } else {
        logger.debug(`Size calculation failed for ${dirPath}:`, err.message);
      }
      return 0;
    }
  }

  /**
   * Capture file system metadata (mtime) and derive age metrics.
   *
   * @param {string} dirPath - Absolute path to the directory
   * @returns {Promise<{ lastModified: Date|null, lastModifiedDays: number }>} Metadata payload
   */
  async getMetadata(dirPath) {
    const mtime = await getLastModified(dirPath);
    if (!mtime) {
      return { lastModified: null, lastModifiedDays: Infinity };
    }
    const days = Math.floor((Date.now() - mtime.getTime()) / (24 * 60 * 60 * 1000));
    return {
      lastModified: mtime,
      lastModifiedDays: days,
    };
  }
}

module.exports = BaseScanner;
