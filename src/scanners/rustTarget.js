'use strict';

const path = require('path');
const BaseScanner = require('./baseScanner');
const { pathExists } = require('../utils/fileSystem');
const { formatBytes } = require('../utils/fileSize');

class RustTargetScanner extends BaseScanner {
    constructor(options = {}) {
        super('rust_target', options);
    }

    /**
     * Scan for Rust 'target' directories.
     * Validator: Parent must contain 'Cargo.toml'.
     */
    async scan(basePath, options = {}) {
        const targetDirs = await this.findDirectories(basePath, 'target', {
            onEnterDir: options.onEnterDir,
        });

        const items = [];

        for (const dir of targetDirs) {
            // Validation: Check for Cargo.toml in the parent directory
            const parentDir = path.dirname(dir);
            const cargoTomlPath = path.join(parentDir, 'Cargo.toml');

            if (await pathExists(cargoTomlPath)) {
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
            type: 'rust_target',
            items,
            totalSize,
            totalSizeFormatted: formatBytes(totalSize),
            count: items.length,
        };
    }
}

module.exports = RustTargetScanner;
