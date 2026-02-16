'use strict';

const path = require('path');
// Inquirer v9+ is ESM only. We must use dynamic import().
let inquirer;

async function getInquirer() {
  if (inquirer) return inquirer;
  const m = await import('inquirer');
  inquirer = m.default || m;
  return inquirer;
}

const chalk = require('chalk');
const { formatBytes } = require('../utils/fileSize');
const constants = require('../utils/constants');
const { flattenAndDedupe } = require('../cleaner');
const { formatDaysAgo } = require('./display');

const CUSTOM_PATH_VALUE = '__custom__';

/**
 * Prompt user to choose scan paths: common directories + option to enter custom path.
 * Optionally prompt to save to config (skipped when opts.saveToConfig is true, e.g. --init).
 * @param {string} homeDir - os.homedir()
 * @param {{ skipSavePrompt?: boolean }} opts - skipSavePrompt: true to skip "Save to config?" (e.g. for --init)
 * @returns {Promise<{ paths: string[], saveToConfig: boolean }>}
 */
async function promptForScanPaths(homeDir, opts = {}) {
  const common = [
    { name: 'Desktop', dir: 'Desktop' },
    { name: 'Documents', dir: 'Documents' },
    { name: 'projects', dir: 'projects' },
    { name: 'dev', dir: 'dev' },
    { name: 'code', dir: 'code' },
    { name: 'work', dir: 'work' },
    { name: 'src', dir: 'src' },
    { name: 'repos', dir: 'repos' },
  ];
  const choices = common.map(({ dir }) => ({
    name: '~/' + dir,
    value: path.join(homeDir, dir),
  }));
  choices.push({ type: 'separator', separator: '─────────────' });
  choices.push({ name: '➕ Enter custom path...', value: CUSTOM_PATH_VALUE });

  const inq = await getInquirer();
  const { selected } = await inq.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: 'Which directories should D Clean scan? (space to toggle, enter to confirm)',
      choices,
      pageSize: 14,
    },
  ]);

  let paths = (selected || []).filter((v) => v !== CUSTOM_PATH_VALUE);

  if ((selected || []).includes(CUSTOM_PATH_VALUE)) {
    const { customPath } = await inq.prompt([
      {
        type: 'input',
        name: 'customPath',
        message: 'Enter path to scan (e.g. ~/my-projects or /full/path). Press Enter to skip:',
        default: '',
        validate: (input) => {
          const trimmed = (input || '').trim();
          if (!trimmed) return true;
          const p = resolvePath(trimmed, homeDir);
          return p ? true : 'Please enter a valid path.';
        },
      },
    ]);
    const trimmed = (customPath || '').trim();
    const resolved = trimmed ? resolvePath(trimmed, homeDir) : '';
    if (resolved) paths.push(resolved);
  }

  if (paths.length === 0) {
    return { paths: [], saveToConfig: false };
  }

  if (opts.skipSavePrompt) {
    return { paths, saveToConfig: true };
  }

  const { saveToConfig } = await inq.prompt([
    {
      type: 'confirm',
      name: 'saveToConfig',
      message: 'Save these paths to ~/.devclean.json for next time?',
      default: true,
    },
  ]);

  return { paths, saveToConfig };
}

function resolvePath(input, homeDir) {
  if (!input) return '';
  const expanded = input.startsWith('~') ? path.join(homeDir, input.slice(1)) : input;
  return path.resolve(expanded);
}

/**
 * Build checkbox choices from scan results with smart defaults.
 * Returns list of { name, value: { type, items }, checked }.
 * @param {object} scanResults
 * @returns {Promise<Array<{ type: string, items: object[] }>>} selected groups only
 */
function isSkip(val) {
  return val === '__skip__' || (val && typeof val === 'object' && val.value === '__skip__');
}

const AGE_BUCKETS = [
  { days: constants.AGE_3_MONTHS_DAYS, label: '3 months' },
  { days: constants.AGE_6_MONTHS_DAYS, label: '6 months' },
  { days: constants.AGE_1_YEAR_DAYS, label: '1 year' },
];
const SIZE_BUCKETS = [
  { bytes: constants.SIZE_500_MB, label: '500 MB' },
  { bytes: constants.SIZE_1_GB, label: '1 GB' },
];

/**
 * Build dynamic cleanup choices for a category: age-based and size-based options
 * only appear when the filtered set is non-empty.
 * @param {object[]} items - list of { path, size, lastModifiedDays }
 * @param {string} type - 'node_modules' | 'python_venv' | 'nvm'
 * @param {string} emoji - e.g. '📦'
 * @param {string} categoryLabel - e.g. 'node_modules' or 'Python venvs'
 */
const MAX_VISIBLE_ITEMS = 20;

function buildCategoryChoices(items, type, emoji, categoryLabel) {
  const choices = [];
  const totalAll = items.reduce((s, i) => s + i.size, 0);

  for (const { days, label } of AGE_BUCKETS) {
    const subset = items.filter((i) => (i.lastModifiedDays ?? 0) > days);
    if (subset.length === 0) continue;
    const total = subset.reduce((s, i) => s + i.size, 0);
    choices.push({
      name: `${emoji} ${categoryLabel} older than ${label} (${subset.length}, ${formatBytes(total)})`,
      value: { type, items: subset },
      checked: false,
    });
  }
  for (const { bytes, label } of SIZE_BUCKETS) {
    const subset = items.filter((i) => (i.size ?? 0) >= bytes);
    if (subset.length === 0) continue;
    const total = subset.reduce((s, i) => s + i.size, 0);
    choices.push({
      name: `${emoji} ${categoryLabel} larger than ${label} (${subset.length}, ${formatBytes(total)})`,
      value: { type, items: subset },
      checked: false,
    });
  }

  // Bulk option
  choices.push({
    name: `${emoji} ALL ${categoryLabel} (${items.length}, ${formatBytes(totalAll)})`,
    value: { type, items },
    checked: false,
  });

  // Granular option
  choices.push({
    name: `  ↳ 🔍 Select specific ${categoryLabel}...`,
    value: { type: 'custom_select', categoryType: type, allItems: items, label: categoryLabel },
    checked: false,
  });

  return choices;
}

async function promptForSpecificItems(categoryLabel, allItems) {
  const inq = await getInquirer();

  // Sort by size desc
  const sorted = [...allItems].sort((a, b) => (b.size || 0) - (a.size || 0));

  const choices = sorted.map(item => {
    const sizeStr = item.size ? formatBytes(item.size) : '';
    const dateStr = item.lastModified ? item.lastModified : (item.lastModifiedDays ? formatDaysAgo(item.lastModifiedDays) : '');
    return {
      name: `${item.path} ${chalk.gray(sizeStr)} ${chalk.gray(dateStr)}`,
      value: item,
      checked: false
    };
  });

  const { selected } = await inq.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: `Select specific ${categoryLabel} to delete:`,
      choices,
      pageSize: 20,
    },
  ]);

  return selected || [];
}

async function promptForCleanup(scanResults) {
  const choices = [];

  choices.push({
    name: '⏭ Skip — do not delete anything (exit)',
    value: '__skip__',
    checked: false,
  });
  choices.push({ type: 'separator', separator: '─────────────' });

  if (scanResults.nodeModules && scanResults.nodeModules.count > 0) {
    choices.push(
      ...buildCategoryChoices(
        scanResults.nodeModules.items,
        'node_modules',
        '📦',
        'node_modules'
      )
    );
  }

  if (scanResults.pythonVenvs && scanResults.pythonVenvs.count > 0) {
    choices.push(
      ...buildCategoryChoices(
        scanResults.pythonVenvs.items,
        'python_venv',
        '🐍',
        'Python venvs'
      )
    );
  }

  if (scanResults.pods && scanResults.pods.count > 0) {
    choices.push(
      ...buildCategoryChoices(
        scanResults.pods.items,
        'pods',
        '🍎',
        'Pods'
      )
    );
  }

  if (scanResults.rustTargets && scanResults.rustTargets.count > 0) {
    choices.push(
      ...buildCategoryChoices(
        scanResults.rustTargets.items,
        'rust_target',
        '🦀',
        'Rust target'
      )
    );
  }

  if (scanResults.gradleBuilds && scanResults.gradleBuilds.count > 0) {
    choices.push(
      ...buildCategoryChoices(
        scanResults.gradleBuilds.items,
        'gradle_build',
        '🐘',
        'Gradle build'
      )
    );
  }

  if (scanResults.cmakeBuilds && scanResults.cmakeBuilds.count > 0) {
    choices.push(
      ...buildCategoryChoices(
        scanResults.cmakeBuilds.items,
        'cmake_build',
        '⚙️ ',
        'CMake build'
      )
    );
  }

  if (scanResults.flutterBuilds && scanResults.flutterBuilds.count > 0) {
    choices.push(
      ...buildCategoryChoices(
        scanResults.flutterBuilds.items,
        'flutter_build',
        '💙',
        'Flutter build'
      )
    );
  }

  if (scanResults.xcodeBuilds && scanResults.xcodeBuilds.count > 0) {
    choices.push(
      ...buildCategoryChoices(
        scanResults.xcodeBuilds.items,
        'xcode_build',
        '🛠️ ',
        'Xcode build'
      )
    );
  }

  if (scanResults.nvmVersions && scanResults.nvmVersions.count > 0) {
    choices.push(
      ...buildCategoryChoices(
        scanResults.nvmVersions.items.filter(i => !i.isCurrent),
        'nvm',
        '📗',
        'NVM versions'
      )
    );
  }

  const inq = await getInquirer();
  const answers = await inq.prompt([
    {
      type: 'checkbox',
      name: 'selections',
      message: 'Check what to delete (space=check/uncheck, enter=confirm). Nothing deleted unless checked; Skip=exit.',
      choices,
      pageSize: 18,
    },
  ]);

  const raw = answers.selections || [];
  if (raw.some(isSkip)) {
    return [];
  }

  const finalSelections = [];

  for (const sel of raw) {
    if (sel.type === 'custom_select') {
      // Prompt for specific items
      const specificItems = await promptForSpecificItems(sel.label, sel.allItems);
      if (specificItems.length > 0) {
        finalSelections.push({
          type: sel.categoryType,
          items: specificItems
        });
      }
    } else {
      finalSelections.push(sel);
    }
  }

  return finalSelections;
}

/**
 * Confirm before performing deletion: show folder paths that will be deleted, then double-confirm.
 * @param {Array<{ type: string, items: object[] }>} selections
 * @returns {Promise<boolean>}
 */
async function confirmCleanup(selections) {
  if (!selections || selections.length === 0) return false;

  const toDelete = flattenAndDedupe(selections);
  const totalSize = toDelete.reduce((sum, i) => sum + (i.size || 0), 0);

  console.log(chalk.yellow('\n⚠️  The following will be moved to Trash (recoverable):\n'));
  toDelete.forEach((item, idx) => {
    const sizeStr = item.size ? `  ${formatBytes(item.size)}` : '';
    const lastMod =
      item.lastModifiedDays != null ? '  ' + chalk.gray(formatDaysAgo(item.lastModifiedDays)) : '';
    console.log(chalk.gray('  ' + (idx + 1) + '.') + ' ' + item.path + (sizeStr ? chalk.cyan(sizeStr) : '') + lastMod);
  });
  console.log(chalk.yellow('\n  Total: ' + toDelete.length + ' item(s), ' + formatBytes(totalSize) + '\n'));

  const inq = await getInquirer();
  const { confirmed } = await inq.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Move these to Trash? You can restore them from Trash if needed.',
      default: false,
    },
  ]);

  return confirmed;
}

module.exports = {
  getInquirer,
  promptForScanPaths,
  promptForCleanup,
  confirmCleanup,
};
