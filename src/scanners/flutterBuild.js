'use strict';

const path = require('path');
const BaseScanner = require('./baseScanner');
const { pathExists } = require('../utils/fileSystem');
const { formatBytes } = require('../utils/fileSize');

class FlutterBuildScanner extends BaseScanner {
    constructor(options = {}) {
        super('flutter_build', options);
    }

    async scan(basePath, options = {}) {
        const buildDirs = await this.findDirectories(basePath, 'build', {
            onEnterDir: options.onEnterDir,
        });
        const dartToolDirs = await this.findDirectories(basePath, '.dart_tool', {
            onEnterDir: options.onEnterDir,
        });

        const uniqueDirs = new Set([...buildDirs, ...dartToolDirs]);
        const items = [];

        for (const dir of uniqueDirs) {
            const parentDir = path.dirname(dir);
            const pubspecPath = path.join(parentDir, 'pubspec.yaml');

            if (await pathExists(pubspecPath)) {
                // We could parse pubspec.yaml to check for 'sdk: flutter', but existence is a strong enough indicator
                // combined with the folder names.
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
            type: 'flutter_build',
            items,
            totalSize,
            totalSizeFormatted: formatBytes(totalSize),
            count: items.length,
        };
    }
}

module.exports = FlutterBuildScanner;
