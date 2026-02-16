'use strict';

const path = require('path');
const BaseScanner = require('./baseScanner');
const { pathExists } = require('../utils/fileSystem');
const { formatBytes } = require('../utils/fileSize');

class GradleBuildScanner extends BaseScanner {
    constructor(options = {}) {
        super('gradle_build', options);
    }

    async scan(basePath, options = {}) {
        // Scan for both 'build' and '.gradle'
        const buildDirs = await this.findDirectories(basePath, 'build', {
            onEnterDir: options.onEnterDir,
        });
        const dotGradleDirs = await this.findDirectories(basePath, '.gradle', {
            onEnterDir: options.onEnterDir,
        });

        const uniqueDirs = new Set([...buildDirs, ...dotGradleDirs]);
        const items = [];

        for (const dir of uniqueDirs) {
            const parentDir = path.dirname(dir);
            const hasBuildGradle = await pathExists(path.join(parentDir, 'build.gradle'));
            const hasBuildGradleKts = await pathExists(path.join(parentDir, 'build.gradle.kts'));
            const hasSettingsGradle = await pathExists(path.join(parentDir, 'settings.gradle'));

            if (hasBuildGradle || hasBuildGradleKts || hasSettingsGradle) {
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
            type: 'gradle_build',
            items,
            totalSize,
            totalSizeFormatted: formatBytes(totalSize),
            count: items.length,
        };
    }
}

module.exports = GradleBuildScanner;
