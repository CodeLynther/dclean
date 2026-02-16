'use strict';

const path = require('path');
const BaseScanner = require('./baseScanner');
const constants = require('../utils/constants');
const { pathExists } = require('../utils/fileSystem');
const { formatBytes } = require('../utils/fileSize');

async function isPythonVenv(dirPath) {
  const indicators = [
    path.join(dirPath, 'bin/python'),
    path.join(dirPath, 'Scripts/python.exe'),
    path.join(dirPath, 'pyvenv.cfg'),
  ];
  for (const indicator of indicators) {
    if (await pathExists(indicator)) {
      return true;
    }
  }
  return false;
}

class PythonVenvScanner extends BaseScanner {
  constructor(options = {}) {
    super('python_venv', { ...options, maxDepth: constants.MAX_SCAN_DEPTH });
  }

  async scan(basePath = process.env.HOME, options = {}) {
    const allCandidates = [];
    for (const venvName of constants.VENV_NAMES) {
      const dirs = await this.findDirectories(basePath, venvName, {
        skipDescendingInto: constants.VENV_NAMES,
        onEnterDir: options.onEnterDir,
      });
      allCandidates.push(...dirs);
    }

    const venvDirs = [];
    for (const dir of allCandidates) {
      if (await isPythonVenv(dir)) {
        venvDirs.push(dir);
      }
    }

    const items = await Promise.all(
      venvDirs.map(async (dir) => {
        const size = await this.calculateSize(dir);
        const { lastModified, lastModifiedDays } = await this.getMetadata(dir);
        const parentDir = path.basename(path.dirname(dir));

        return {
          path: dir,
          size,
          sizeFormatted: formatBytes(size),
          lastModified: lastModified ? lastModified.toISOString().slice(0, 10) : null,
          lastModifiedDays,
          parentProject: parentDir,
        };
      })
    );

    const totalSize = items.reduce((sum, item) => sum + item.size, 0);

    return {
      type: 'python_venv',
      items,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      count: items.length,
    };
  }
}

module.exports = PythonVenvScanner;
