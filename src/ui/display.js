'use strict';

const path = require('path');
const os = require('os');
const Table = require('cli-table3');
const chalk = require('chalk');
const { formatBytes } = require('../utils/fileSize');

function toShortLabel(fullPath) {
  const home = os.homedir();
  if (!home || !fullPath) return fullPath;
  const normalized = path.normalize(fullPath);
  const homeNorm = path.normalize(home);
  if (normalized === homeNorm) return '~';
  if (normalized.startsWith(homeNorm + path.sep)) return '~' + normalized.slice(homeNorm.length);
  return fullPath.length > 38 ? '...' + fullPath.slice(-35) : fullPath;
}

/** Path relative to first scan root that contains it, or short label. */
function pathUnderRoot(fullPath, scanRoots) {
  const normalized = path.normalize(fullPath);
  for (const root of scanRoots) {
    const rootNorm = path.normalize(root);
    if (normalized === rootNorm) return path.basename(normalized) || '.';
    if (normalized.startsWith(rootNorm + path.sep)) {
      const rel = normalized.slice(rootNorm.length + path.sep.length);
      return rel || path.basename(normalized);
    }
  }
  return toShortLabel(fullPath);
}

/**
 * Format days ago as human string (e.g. "3 months ago", "2 days").
 * @param {number} days
 * @returns {string}
 */
function formatDaysAgo(days) {
  if (days < 0 || days === Infinity) return 'unknown';
  if (days === 0) return 'today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  if (days < 60) return '2 months';
  if (days < 90) return '3 months';
  if (days < 180) return '6 months';
  if (days < 365) return '1 year';
  const years = Math.floor(days / 365);
  return years === 1 ? '1 year' : `${years} years`;
}

/**
 * Color size string: red for large (>500MB), yellow for medium, green for small.
 * @param {string} sizeStr
 * @param {number} bytes
 * @returns {string}
 */
function colorSize(sizeStr, bytes) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 500) return chalk.red(sizeStr);
  if (mb >= 100) return chalk.yellow(sizeStr);
  return chalk.green(sizeStr);
}

function sortBySizeDesc(items) {
  return [...items].sort((a, b) => (b.size || 0) - (a.size || 0));
}

/**
 * Display full scan results (tables + summary). Items sorted by size (largest first).
 * @param {object} scanResults - from runAllScans(); may include basePathLabel, basePath
 */
function displayResults(scanResults) {
  const basePath = scanResults.basePath;
  const scanRoots = Array.isArray(basePath) ? basePath : basePath ? [basePath] : [];
  const pathLabel = scanResults.basePathLabel || (scanRoots[0] ? toShortLabel(scanRoots[0]) : '—');

  const { nodeModules, pythonVenvs, nvmVersions, pods, aiDevTools, totalSize } = scanResults;
  const hasDeletable =
    (nodeModules?.count > 0) ||
    (pythonVenvs?.count > 0) ||
    (nvmVersions?.count > 0) ||
    (pods?.count > 0);
  const onlyAiDevToolsResults = aiDevTools?.count > 0 && !hasDeletable;

  console.log(chalk.bold('\n🔍 Scan Results'));
  if (!onlyAiDevToolsResults) {
    if (pathLabel && pathLabel !== '—') console.log(chalk.gray('Path: ' + pathLabel));
    console.log(chalk.gray('Sorted by size (largest first). Pick what to delete below.'));
  }
  console.log(chalk.gray('━'.repeat(52)));

  const tableOpts = { style: { compact: true }, colWidths: [48, 14, 12] };

  if (nodeModules && nodeModules.count > 0) {
    const sorted = sortBySizeDesc(nodeModules.items);
    console.log(chalk.cyan('\n📦 node_modules (' + nodeModules.count + ')'));
    const table = new Table({
      head: [chalk.white('Folder'), chalk.white('Size'), chalk.white('Last used')],
      ...tableOpts,
    });
    sorted.slice(0, 25).forEach((item) => {
      const parentDir = path.dirname(item.path);
      const displayPath = scanRoots.length > 0 ? pathUnderRoot(parentDir, scanRoots) : toShortLabel(parentDir);
      table.push([
        displayPath,
        colorSize(item.sizeFormatted, item.size),
        formatDaysAgo(item.lastModifiedDays),
      ]);
    });
    if (sorted.length > 25) {
      table.push([chalk.gray('... +' + (sorted.length - 25) + ' more'), '', '']);
    }
    console.log(table.toString());
    console.log(chalk.gray('Subtotal: ' + nodeModules.totalSizeFormatted));
  }

  if (pythonVenvs && pythonVenvs.count > 0) {
    const sorted = sortBySizeDesc(pythonVenvs.items);
    console.log(chalk.cyan('\n🐍 Python venvs (' + pythonVenvs.count + ')'));
    const table = new Table({
      head: [chalk.white('Folder'), chalk.white('Size'), chalk.white('Last used')],
      ...tableOpts,
    });
    sorted.slice(0, 25).forEach((item) => {
      const parentDir = path.dirname(item.path);
      const displayPath = scanRoots.length > 0 ? pathUnderRoot(parentDir, scanRoots) : toShortLabel(parentDir);
      table.push([
        displayPath,
        colorSize(item.sizeFormatted, item.size),
        formatDaysAgo(item.lastModifiedDays),
      ]);
    });
    if (sorted.length > 25) {
      table.push([chalk.gray('... +' + (sorted.length - 25) + ' more'), '', '']);
    }
    console.log(table.toString());
    console.log(chalk.gray('Subtotal: ' + pythonVenvs.totalSizeFormatted));
  }

  if (pods && pods.count > 0) {
    const sorted = sortBySizeDesc(pods.items);
    console.log(chalk.cyan('\n🍎 Pods (' + pods.count + ')'));
    const table = new Table({
      head: [chalk.white('Folder'), chalk.white('Size'), chalk.white('Last used')],
      ...tableOpts,
    });
    sorted.slice(0, 25).forEach((item) => {
      const parentDir = path.dirname(item.path);
      const displayPath = scanRoots.length > 0 ? pathUnderRoot(parentDir, scanRoots) : toShortLabel(parentDir);
      table.push([
        displayPath,
        colorSize(item.sizeFormatted, item.size),
        formatDaysAgo(item.lastModifiedDays),
      ]);
    });
    if (sorted.length > 25) {
      table.push([chalk.gray('... +' + (sorted.length - 25) + ' more'), '', '']);
    }
    console.log(table.toString());
    console.log(chalk.gray('Subtotal: ' + pods.totalSizeFormatted));
  }

  if (nvmVersions && nvmVersions.count > 0) {
    const sorted = sortBySizeDesc(nvmVersions.items);
    console.log(chalk.cyan('\n📗 NVM versions (' + nvmVersions.count + ')'));
    const table = new Table({
      head: [chalk.white('Version'), chalk.white('Size'), chalk.white('Last Modified')],
      style: { compact: true },
      colWidths: [14, 14, 18],
    });
    sorted.forEach((item) => {
      let status = item.isCurrent ? chalk.green('current') : formatDaysAgo(item.lastModifiedDays);
      table.push([item.version, colorSize(item.sizeFormatted, item.size), status]);
    });
    console.log(table.toString());
    console.log(chalk.gray('Subtotal: ' + nvmVersions.totalSizeFormatted));
  }

  if (aiDevTools && aiDevTools.count > 0) {
    const sorted = sortBySizeDesc(aiDevTools.items);
    console.log(chalk.cyan('\n🤖 AI dev tools (' + aiDevTools.count + ') — for review only'));
    console.log(chalk.yellow('   ⚠  We do not offer deletion for these. Review and delete at your own risk (e.g. from your file manager) if needed.'));
    const table = new Table({
      head: [chalk.white('Tool / path'), chalk.white('Size'), chalk.white('Last used')],
      ...tableOpts,
    });
    sorted.slice(0, 25).forEach((item) => {
      const displayPath = item.name || toShortLabel(item.path);
      table.push([
        displayPath,
        colorSize(item.sizeFormatted, item.size),
        formatDaysAgo(item.lastModifiedDays),
      ]);
    });
    if (sorted.length > 25) {
      table.push([chalk.gray('... +' + (sorted.length - 25) + ' more'), '', '']);
    }
    console.log(table.toString());
    console.log(chalk.gray('Subtotal: ' + aiDevTools.totalSizeFormatted));
  }

  if (!onlyAiDevToolsResults) {
    const reclaimableSize = (totalSize || 0) - (aiDevTools && aiDevTools.count > 0 ? aiDevTools.totalSize || 0 : 0);
    console.log(chalk.gray('\n' + '━'.repeat(52)));
    console.log(chalk.bold('💾 Total reclaimable: ' + formatBytes(reclaimableSize)));
    console.log(chalk.gray('━'.repeat(52)));
    console.log(chalk.gray('\nCheck the options you want to delete, then press Enter. Skip = exit without deleting.\n'));
  }
}

module.exports = {
  displayResults,
  formatDaysAgo,
  colorSize,
};
