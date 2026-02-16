'use strict';

const path = require('path');
const BaseScanner = require('./baseScanner');
const constants = require('../utils/constants');
const { pathExists } = require('../utils/fileSystem');
const { formatBytes } = require('../utils/fileSize');

/**
 * Find parent project name (directory containing package.json above this node_modules).
 */
async function findParentProject(nodeModulesPath) {
  const parentDir = path.dirname(nodeModulesPath);
  const packagePath = path.join(parentDir, 'package.json');
  if (await pathExists(packagePath)) {
    return path.basename(parentDir);
  }
  return path.basename(parentDir) || 'unknown';
}

class NodeModulesScanner extends BaseScanner {
  constructor(options = {}) {
    super('node_modules', { ...options, maxDepth: constants.MAX_SCAN_DEPTH });
  }

  /**
   * Find all node_modules directories, excluding nested ones (only top-level per project).
   * @param {string} basePath
   * @param {{ onEnterDir?: (dirPath: string) => void }} options - onEnterDir called for each direct subdir (for progress)
   */
  async scan(basePath = process.env.HOME, options = {}) {
    const nodeModulesDirs = await this.findDirectories(basePath, constants.NODE_MODULES, {
      onEnterDir: options.onEnterDir,
    });

    // Exclude nested node_modules (e.g. project/node_modules/foo/node_modules)
    const topLevelOnly = nodeModulesDirs.filter((dir) => {
      const parentDir = path.dirname(dir);
      return !parentDir.split(path.sep).includes('node_modules');
    });

    const items = await Promise.all(
      topLevelOnly.map(async (dir) => {
        const size = await this.calculateSize(dir);
        const { lastModified, lastModifiedDays } = await this.getMetadata(dir);
        const parentProject = await findParentProject(dir);
        const parentDir = path.dirname(dir);
        const packageJsonPath = path.join(parentDir, 'package.json');

        return {
          path: dir,
          size,
          sizeFormatted: formatBytes(size),
          lastModified: lastModified ? lastModified.toISOString().slice(0, 10) : null,
          lastModifiedDays,
          parentProject,
          packageJsonPath,
        };
      })
    );

    const totalSize = items.reduce((sum, item) => sum + item.size, 0);

    return {
      type: 'node_modules',
      items,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      count: items.length,
    };
  }
}

module.exports = NodeModulesScanner;
