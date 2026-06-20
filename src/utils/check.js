'use strict';

const path = require('path');
const os = require('os');
const chalk = require('chalk');
const { formatBytes } = require('./fileSize');

const THRESHOLD_PER_CATEGORY = 5 * 1024 * 1024 * 1024; // 5 GB
const THRESHOLD_TOTAL = 10 * 1024 * 1024 * 1024; // 10 GB

const CATEGORY_SCANNERS = [
  { key: 'nodeModules', alertLabel: 'node_modules', pathFn: (item) => path.dirname(item.path) },
  { key: 'nvmVersions', alertLabel: 'NVM Versions', pathFn: (item) => item.path },
  { key: 'xcodeBuilds', alertLabel: 'Xcode DerivedData', pathFn: (item) => item.path },
  { key: 'pythonVenvs', alertLabel: 'Python venvs', pathFn: (item) => path.dirname(item.path) },
  { key: 'pods', alertLabel: 'CocoaPods', pathFn: (item) => path.dirname(item.path) },
  { key: 'rustTargets', alertLabel: 'Rust target', pathFn: (item) => path.dirname(item.path) },
  { key: 'gradleBuilds', alertLabel: 'Gradle', pathFn: (item) => item.path },
  { key: 'cmakeBuilds', alertLabel: 'CMake', pathFn: (item) => item.path },
  { key: 'flutterBuilds', alertLabel: 'Flutter', pathFn: (item) => item.path },
];

function toShortLabel(fullPath) {
  const home = os.homedir();
  if (!home || !fullPath) return fullPath;
  const normalized = path.normalize(fullPath);
  const homeNorm = path.normalize(home);
  if (normalized === homeNorm) return '~';
  if (normalized.startsWith(homeNorm + path.sep)) return '~' + normalized.slice(homeNorm.length);
  return fullPath.length > 48 ? '...' + fullPath.slice(-45) : fullPath;
}

function getTotalReclaimable(scanResults) {
  return CATEGORY_SCANNERS.reduce((sum, { key }) => sum + (scanResults[key]?.totalSize || 0), 0);
}

function getCheckAlerts(scanResults) {
  const alerts = [];
  if (scanResults.xcodeBuilds?.totalSize > THRESHOLD_PER_CATEGORY) alerts.push('Xcode DerivedData');
  if (scanResults.nvmVersions?.totalSize > THRESHOLD_PER_CATEGORY) alerts.push('NVM Versions');
  if (scanResults.nodeModules?.totalSize > THRESHOLD_PER_CATEGORY) alerts.push('node_modules');
  return alerts;
}

function shouldNotify(totalReclaimable, alerts) {
  return totalReclaimable > THRESHOLD_TOTAL || alerts.length > 0;
}

function getCleanupPaths(scanResults, { max = 5 } = {}) {
  const alertKeys = new Set();
  if (scanResults.xcodeBuilds?.totalSize > THRESHOLD_PER_CATEGORY) alertKeys.add('xcodeBuilds');
  if (scanResults.nvmVersions?.totalSize > THRESHOLD_PER_CATEGORY) alertKeys.add('nvmVersions');
  if (scanResults.nodeModules?.totalSize > THRESHOLD_PER_CATEGORY) alertKeys.add('nodeModules');

  const total = getTotalReclaimable(scanResults);
  const useAllCategories = alertKeys.size === 0 && total > THRESHOLD_TOTAL;
  const keysToInclude = useAllCategories
    ? CATEGORY_SCANNERS.map((c) => c.key)
    : CATEGORY_SCANNERS.filter((c) => alertKeys.has(c.key)).map((c) => c.key);

  const items = [];
  for (const cat of CATEGORY_SCANNERS) {
    if (!keysToInclude.includes(cat.key)) continue;
    const section = scanResults[cat.key];
    if (!section?.items?.length) continue;
    for (const item of section.items) {
      items.push({
        path: cat.pathFn(item),
        size: item.size || 0,
        sizeFormatted: item.sizeFormatted || formatBytes(item.size || 0),
        category: cat.alertLabel,
      });
    }
  }

  items.sort((a, b) => b.size - a.size);
  return items.slice(0, max);
}

function formatPathLine(entry) {
  return `${toShortLabel(entry.path)} (${entry.sizeFormatted})`;
}

function buildNotificationMessage({ totalReclaimable, alerts, cleanupPaths }) {
  const parts = [];
  if (alerts.length > 0) {
    parts.push(`${alerts.join(', ')} exceed 5 GB.`);
  }
  parts.push(`${formatBytes(totalReclaimable)} reclaimable.`);
  if (cleanupPaths.length > 0) {
    const shown = cleanupPaths.slice(0, 3).map(formatPathLine).join(', ');
    const extra = cleanupPaths.length > 3 ? ` +${cleanupPaths.length - 3} more` : '';
    parts.push(`Clean up: ${shown}${extra}.`);
  }
  parts.push('Run dclean to reclaim space.');
  return parts.join(' ');
}

/** True when check mode should show progress and a post-scan summary (terminal, not cron). */
function isCheckInteractive(options) {
  return options.check === true && (!options.silent || process.stderr.isTTY === true);
}

function printCheckSummary({ totalReclaimable, alerts, notified, cleanupPaths }) {
  console.log('');
  console.log(chalk.cyan.bold('Check complete'));
  console.log(chalk.gray('Reclaimable: ' + formatBytes(totalReclaimable)));

  if (notified) {
    const reason =
      alerts.length > 0
        ? alerts.join(', ') + ' exceed 5 GB'
        : 'total reclaimable exceeds 10 GB';
    console.log(chalk.yellow('Notification sent: ' + reason));
  } else {
    console.log(chalk.green('No notification sent (below thresholds).'));
  }

  if (cleanupPaths.length > 0) {
    console.log('');
    console.log(chalk.gray('Largest folders to clean up:'));
    for (const entry of cleanupPaths) {
      console.log(chalk.white('  • ' + formatPathLine(entry) + chalk.gray(' — ' + entry.category)));
    }
  }

  console.log('');
  console.log(chalk.gray('Check mode scans your paths and sends a system alert when:'));
  console.log(chalk.gray('  • Xcode, NVM, or node_modules exceed 5 GB each'));
  console.log(chalk.gray('  • Total reclaimable space exceeds 10 GB'));
  console.log(chalk.gray('Check mode never deletes files. Run dclean to review and clean.'));
  console.log('');
  console.log(chalk.gray('Schedule automatic checks with cron, for example weekly (Sunday 6 PM):'));
  console.log(chalk.white('  0 18 * * 0 $(which node) $(which dclean) --check --silent'));
  console.log(chalk.gray('Cron does not load nvm. Use absolute paths from which node and which dclean.'));
  console.log('');
}

module.exports = {
  THRESHOLD_PER_CATEGORY,
  THRESHOLD_TOTAL,
  getTotalReclaimable,
  getCheckAlerts,
  shouldNotify,
  getCleanupPaths,
  buildNotificationMessage,
  isCheckInteractive,
  printCheckSummary,
  toShortLabel,
};
