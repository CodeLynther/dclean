'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const chalk = require('chalk');
const Table = require('cli-table3');
const { formatBytes } = require('./fileSize');
const { getConfigPath } = require('./config');

// We derive history path from config path directory
// If config is ~/.dclean/config.json, history is ~/.dclean/history.json
function getHistoryPath() {
    const configDir = path.dirname(getConfigPath());
    return path.join(configDir, 'history.json');
}

/**
 * Load history entries.
 * @returns {Array<{ date: string, freedBytes: number, itemsDeleted: number, scanTypes: string[] }>}
 */
function getHistory() {
    const p = getHistoryPath();
    try {
        const raw = fs.readFileSync(p, 'utf8');
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

/**
 * Append a cleanup event to history.
 * @param {object} stats - { freedBytes, itemsDeleted, scanTypes }
 */
function logCleanup(stats) {
    const entry = {
        date: new Date().toISOString(),
        freedBytes: stats.freedBytes || 0,
        itemsDeleted: stats.itemsDeleted || 0,
        scanTypes: stats.scanTypes || [],
    };

    const history = getHistory();
    history.push(entry);

    // Keep last 50 entries
    if (history.length > 50) {
        history.shift();
    }

    const p = getHistoryPath();
    // Ensure dir exists (it should, from config loading)
    try {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, JSON.stringify(history, null, 2), 'utf8');
    } catch (err) {
        // silently fail logging if FS error
    }
}

/**
 * Display deletion history in a table.
 */
function printHistory() {
    const history = getHistory();
    if (history.length === 0) {
        console.log(chalk.gray('No history yet.'));
        return;
    }

    const table = new Table({
        head: [chalk.white('Date'), chalk.white('Freed'), chalk.white('Items'), chalk.white('Types')],
        style: { compact: true },
    });

    // Show recent last
    const recent = history.slice(-20);

    recent.forEach((h) => {
        const dateStr = new Date(h.date).toLocaleDateString() + ' ' + new Date(h.date).toLocaleTimeString();
        table.push([
            dateStr,
            formatBytes(h.freedBytes),
            h.itemsDeleted,
            (h.scanTypes || []).join(', ').slice(0, 30),
        ]);
    });

    console.log(chalk.bold('\n📜 Cleanup History (Last 20 runs)'));
    console.log(table.toString());

    const totalFreed = history.reduce((sum, h) => sum + (h.freedBytes || 0), 0);
    console.log(chalk.cyan(`\nTotal space reclaimed all-time: ${formatBytes(totalFreed)}\n`));
}

module.exports = {
    logCleanup,
    getHistory,
    printHistory,
};
