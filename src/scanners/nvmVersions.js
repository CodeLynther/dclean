'use strict';

const path = require('path');
const fs = require('fs').promises;
const BaseScanner = require('./baseScanner');
const constants = require('../utils/constants');
const { pathExists } = require('../utils/fileSystem');
const { formatBytes } = require('../utils/fileSize');

/**
 * Get currently active Node version from nvm (from .nvmrc or default alias).
 */
async function getCurrentNvmVersion() {
  try {
    const nvmDir = constants.NVM_DIR;
    const defaultAliasPath = path.join(nvmDir, 'alias', 'default');
    if (await pathExists(defaultAliasPath)) {
      const content = await fs.readFile(defaultAliasPath, 'utf8');
      return content.trim();
    }
  } catch {
    // ignore
  }
  return null;
}

class NvmVersionsScanner extends BaseScanner {
  constructor(options = {}) {
    super('nvm', options);
  }

  async scan() {
    const nvmVersionsDir = constants.NVM_VERSIONS_DIR;

    if (!(await pathExists(nvmVersionsDir))) {
      return {
        type: 'nvm',
        items: [],
        totalSize: 0,
        totalSizeFormatted: '0 B',
        count: 0,
        currentVersion: null,
      };
    }

    const currentVersion = await getCurrentNvmVersion();
    let versionDirs = [];
    try {
      versionDirs = await fs.readdir(nvmVersionsDir);
    } catch {
      return {
        type: 'nvm',
        items: [],
        totalSize: 0,
        totalSizeFormatted: '0 B',
        count: 0,
        currentVersion: null,
      };
    }

    const items = await Promise.all(
      versionDirs.map(async (version) => {
        const versionPath = path.join(nvmVersionsDir, version);
        let size = 0;
        try {
          size = await this.calculateSize(versionPath);
        } catch {
          // skip
        }
        const { lastModified, lastModifiedDays } = await this.getMetadata(versionPath);

        return {
          path: versionPath,
          version,
          size,
          sizeFormatted: formatBytes(size),
          lastModified: lastModified ? lastModified.toISOString().slice(0, 10) : null,
          lastModifiedDays,
          isCurrent: version === currentVersion,
        };
      })
    );

    const totalSize = items.reduce((sum, item) => sum + item.size, 0);

    return {
      type: 'nvm',
      items,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      count: items.length,
      currentVersion,
    };
  }
}

module.exports = NvmVersionsScanner;
