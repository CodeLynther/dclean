'use strict';

const path = require('path');
const os = require('os');
const BaseScanner = require('./baseScanner');
const { pathExists, walkDirectory } = require('../utils/fileSystem');
const { formatBytes } = require('../utils/fileSize');

class XcodeScanner extends BaseScanner {
    constructor(options = {}) {
        super('xcode_build', options);
        this.globalScanned = false;
        this.homeDir = options.homeDir || os.homedir();
    }

    async scan(basePath, options = {}) {
        const items = [];
        const home = this.homeDir;

        // 1. DerivedData (Global location)
        // Only verify this if the basePath includes the Library folder OR is the home dir
        // But typically DerivedData is a fixed location: ~/Library/Developer/Xcode/DerivedData
        const derivedDataPath = path.join(home, 'Library/Developer/Xcode/DerivedData');

        // Check if we should scan this global derived data
        // Logic: Always scan global DerivedData exactly once per runner instance,
        // regardless of which specific 'basePath' the user pointed to.

        if (!this.globalScanned && await pathExists(derivedDataPath)) {
            this.globalScanned = true;
            // We might want to list individual project folders inside DerivedData?
            // For now, let's treat DerivedData as one big item, OR scan its children.
            // Scanning children is better so users can select specific projects to clean.
            // Using BaseScanner helper or manual readdir
            try {
                const fs = require('fs');
                const entries = fs.readdirSync(derivedDataPath, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const projectDDPath = path.join(derivedDataPath, entry.name);
                        const size = await this.calculateSize(projectDDPath);
                        const { lastModified, lastModifiedDays } = await this.getMetadata(projectDDPath);
                        items.push({
                            path: projectDDPath,
                            size,
                            sizeFormatted: formatBytes(size),
                            lastModified: lastModified ? lastModified.toISOString().slice(0, 10) : null,
                            lastModifiedDays,
                            isDerivedData: true
                        });
                    }
                }
            } catch (e) {
                // ignore access errors
            }
        }

        // 2. Project-local 'build' folders (iOS typical)
        // Look for 'build' directories where parent has .xcodeproj or .xcworkspace
        const buildDirs = await this.findDirectories(basePath, 'build', {
            onEnterDir: options.onEnterDir,
        });

        for (const dir of buildDirs) {
            const parentDir = path.dirname(dir);
            // Exclude if inside DerivedData (already covered)
            if (dir.startsWith(derivedDataPath)) continue;

            // Scan parent for .xcodeproj or .xcworkspace
            // We don't have a direct "exists with extension" helper, so we might need to read dir
            // Optimisation: check specific names? No, names are variable.
            // We need to list parent dir.

            let isXcodeProject = false;
            try {
                const fs = require('fs');
                const parentFiles = fs.readdirSync(parentDir);
                isXcodeProject = parentFiles.some(f => f.endsWith('.xcodeproj') || f.endsWith('.xcworkspace'));
            } catch (e) { }

            if (isXcodeProject) {
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
            type: 'xcode_build',
            items,
            totalSize,
            totalSizeFormatted: formatBytes(totalSize),
            count: items.length,
        };
    }
}

module.exports = XcodeScanner;
