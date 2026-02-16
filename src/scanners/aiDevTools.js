const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const BaseScanner = require('./baseScanner');
const aiDevToolsPaths = require('../../config/aiDevToolsPaths');
const { pathExists } = require('../utils/fileSystem');
const { formatBytes } = require('../utils/fileSize');

class AiDevToolsScanner extends BaseScanner {
  constructor(options = {}) {
    super('ai_dev_tools', options);
  }

  /**
   * Scan fixed AI/dev-tool data paths under home. No directory walk.
   * @returns {Promise<{ type: string, items: object[], totalSize: number, totalSizeFormatted: string, count: number }>}
   */
  async scan() {
    const home = path.resolve(os.homedir());
    const items = [];

    for (const { name, relPath } of aiDevToolsPaths) {
      const dirPath = path.join(home, relPath);
      try {
        const exists = await pathExists(dirPath);
        if (!exists) continue;
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) continue;
      } catch {
        continue;
      }

      const size = await this.calculateSize(dirPath);
      const { lastModified, lastModifiedDays } = await this.getMetadata(dirPath);

      items.push({
        path: dirPath,
        name,
        size,
        sizeFormatted: formatBytes(size),
        lastModified: lastModified ? lastModified.toISOString().slice(0, 10) : null,
        lastModifiedDays,
      });
    }

    const totalSize = items.reduce((sum, i) => sum + i.size, 0);
    return {
      type: 'ai_dev_tools',
      items,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      count: items.length,
    };
  }
}

module.exports = AiDevToolsScanner;
