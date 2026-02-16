'use strict';

const path = require('path');
const BaseScanner = require('./baseScanner');
const { pathExists } = require('../utils/fileSystem');
const { formatBytes } = require('../utils/fileSize');

class CMakeBuildScanner extends BaseScanner {
    constructor(options = {}) {
        super('cmake_build', options);
    }

    async scan(basePath, options = {}) {
        const buildDirs = await this.findDirectories(basePath, 'cmake-build-debug', {
            onEnterDir: options.onEnterDir,
        });

        const items = [];

        for (const dir of buildDirs) {
            const parentDir = path.dirname(dir);
            const cmakeListsPath = path.join(parentDir, 'CMakeLists.txt');

            if (await pathExists(cmakeListsPath)) {
                const size = await this.calculateSize(dir);
                const { lastModified, lastModifiedDays } = await this.getMetadata(dir);

                items.push({
                    path: dir,
                    size,
                    sizeFormatted: formatBytes(size),
                    lastModified: lastModified ? lastModified.toISOString().slice(0, 10) : null,
                    lastModifiedDays,
                });
            }
        }

        const totalSize = items.reduce((sum, item) => sum + item.size, 0);

        return {
            type: 'cmake_build',
            items,
            totalSize,
            totalSizeFormatted: formatBytes(totalSize),
            count: items.length,
        };
    }
}

module.exports = CMakeBuildScanner;
