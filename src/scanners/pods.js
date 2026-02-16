'use strict';

const path = require('path');
const BaseScanner = require('./baseScanner');
const constants = require('../utils/constants');
const { formatBytes } = require('../utils/fileSize');

class PodsScanner extends BaseScanner {
  constructor(options = {}) {
    super('Pods', { ...options, maxDepth: constants.MAX_SCAN_DEPTH });
  }

  /**
   * Find all Pods directories (CocoaPods), excluding nested ones (only top-level per project).
   * @param {string} basePath
   * @param {{ onEnterDir?: (dirPath: string) => void }} options
   */
  async scan(basePath = process.env.HOME, options = {}) {
    const podsDirs = await this.findDirectories(basePath, constants.PODS, {
      onEnterDir: options.onEnterDir,
    });

    const suffix = path.sep + constants.PODS;
    const topLevelOnly = podsDirs.filter((dir) => {
      if (!dir.endsWith(suffix)) return true;
      const withoutName = dir.slice(0, -suffix.length);
      return !withoutName.includes(constants.PODS);
    });

    const items = await Promise.all(
      topLevelOnly.map(async (dir) => {
        const size = await this.calculateSize(dir);
        const { lastModified, lastModifiedDays } = await this.getMetadata(dir);
        const parentDir = path.dirname(dir);

        return {
          path: dir,
          size,
          sizeFormatted: formatBytes(size),
          lastModified: lastModified ? lastModified.toISOString().slice(0, 10) : null,
          lastModifiedDays,
          parentDir,
        };
      })
    );

    const totalSize = items.reduce((sum, item) => sum + item.size, 0);

    return {
      type: 'pods',
      items,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      count: items.length,
    };
  }
}

module.exports = PodsScanner;
