#!/usr/bin/env node

'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const { Command } = require('commander');
const chalk = require('chalk');
const { createSpinner } = require('../src/utils/spinner');
const { runAllScans } = require('../src/scanners');
const { displayResults } = require('../src/ui/display');
const { promptForScanPaths, promptForCleanup, confirmCleanup } = require('../src/ui/prompts');
const { performCleanup, showCleanupSummary } = require('../src/cleaner');
const { logCleanup, printHistory } = require('../src/utils/history');
const { formatBytes } = require('../src/utils/fileSize');
const { loadConfig, getConfigPath, saveConfig } = require('../src/utils/config');
const logger = require('../src/utils/logger');

const pkg = require('../package.json');
const home = process.env.HOME || process.env.USERPROFILE || os.homedir() || '';

const EXIT_SUCCESS = 0;
const EXIT_ERROR = 1;
const EXIT_CANCELLED = 130;

function showBanner() {
  console.log(chalk.cyan.bold('\n🧹 D Clean v' + pkg.version + '\n'));
}

function toLabel(p) {
  if (!p || !home) return p;
  if (p === home) return '~';
  if (p.startsWith(home + path.sep)) return '~' + p.slice(home.length);
  return p;
}

function resolvePath(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const expanded = trimmed.startsWith('~') ? path.join(home, trimmed.slice(1)) : trimmed;
  return path.resolve(expanded);
}

/** Returns true if path exists and is a readable directory. */
function isReadableDir(dirPath) {
  try {
    const stat = fs.statSync(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/** Validate and resolve scan paths: resolve, dedupe, filter to existing dirs. Returns { paths, missing, invalid }. */
function resolveAndValidateScanPaths(rawPaths) {
  const seen = new Set();
  const paths = [];
  const missing = [];
  const invalid = [];

  for (const raw of rawPaths || []) {
    const resolved = resolvePath(typeof raw === 'string' ? raw : String(raw));
    if (!resolved) {
      invalid.push(raw);
      continue;
    }
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (isReadableDir(resolved)) {
      paths.push(resolved);
    } else {
      missing.push(resolved);
    }
  }
  return { paths, missing, invalid };
}

function listImmediateSubdirs(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

async function main() {
  const program = new Command();

  program
    .name('dclean')
    .description('Clean up development environment bloat - node_modules, Python venvs, NVM versions, CocoaPods')
    .version(pkg.version, '-v, --version', 'Show version')
    .option('--dry-run', 'Show what would be deleted without deleting')
    .option('--path <path>', 'Scan specific directory (overrides config). Supports ~.')
    .option('--no-interactive', 'Only run scan and display results, no cleanup prompts')
    .option('--yes', 'Auto-confirm move to Trash (use with caution)')
    .option('--verbose', 'Show debug output and full stack on errors')
    .option('--init', 'Interactively choose scan paths and save to ~/.devclean.json')
    .option('--node-modules', 'Scan node_modules (in your path)')
    .option('--python', 'Scan Python venvs (in your path)')
    .option('--nvm', 'Scan NVM versions (~/.nvm)')
    .option('--pods', 'Scan CocoaPods Pods (in your path)')
    .option('--rust', 'Scan Rust target directories (in your path)')
    .option('--gradle', 'Scan Gradle/Android build directories (in your path)')
    .option('--cmake', 'Scan CMake build directories (in your path)')
    .option('--flutter', 'Scan Flutter build directories (in your path)')
    .option('--xcode', 'Scan Xcode DerivedData and build directories')
    .option('--ai-dev-tools', 'Scan AI dev tool data (Cursor, Claude, Antigravity, etc.)')
    .option('--history', 'Show cleanup history and exit')
    .parse();

  const options = program.opts();
  if (options.verbose) logger.setVerbose(true);

  if (!home) {
    console.error(chalk.red('Error: Could not determine home directory. Set HOME or USERPROFILE.\n'));
    process.exit(EXIT_ERROR);
  }

  if (options.history) {
    showBanner();
    printHistory();
    process.exit(EXIT_SUCCESS);
  }

  const anyScanType =
    options.nodeModules === true ||
    options.python === true ||
    options.nvm === true ||
    options.pods === true ||
    options.rust === true ||
    options.gradle === true ||
    options.cmake === true ||
    options.flutter === true ||
    options.xcode === true ||
    options.aiDevTools === true;
  if (!anyScanType) {
    const config = loadConfig();
    const rawPaths = config.scanPaths || [];

    // START INTERACTIVE MODE
    // Use the shared getInquirer because inquirer is ESM-only.
    const { getInquirer } = require('../src/ui/prompts');
    const inquirer = await getInquirer();

    // If no config, prioritize asking to setup
    if (rawPaths.length === 0 && !options.init) {
      console.log(chalk.cyan('Welcome to D Clean! 🧹'));
      console.log(chalk.gray('It looks like you haven\'t configured any scan paths yet.'));

      try {
        const { shouldInit } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'shouldInit',
            message: 'Would you like to run setup now to choose folders to scan?',
            default: true
          }
        ]);

        if (shouldInit) {
          options.init = true;
        } else {
          console.log(chalk.yellow('Okay. Run "dclean --init" when you are ready, or use "--help" to see options.\n'));
          process.exit(EXIT_SUCCESS);
        }
      } catch (e) {
        process.exit(EXIT_CANCELLED);
      }
    } else if (!options.init) {
      // Config exists, but no flags. Ask what to scan.
      try {
        const { scanners } = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'scanners',
            message: 'What would you like to scan?',
            pageSize: 10,
            choices: [
              { name: 'Node Modules', value: 'nodeModules' },
              { name: 'NVM Versions', value: 'nvm' },
              { name: 'Python Venvs', value: 'python' },
              { name: 'Xcode DerivedData & Build', value: 'xcode' },
              { name: 'CocoaPods', value: 'pods' },
              { name: 'Rust Targets', value: 'rust' },
              { name: 'Gradle Builds', value: 'gradle' },
              { name: 'CMake Builds', value: 'cmake' },
              { name: 'Flutter Builds', value: 'flutter' },
              { name: 'AI Dev Tools (Cursor, etc.)', value: 'aiDevTools' },
            ]
          }
        ]);

        if (scanners.length === 0) {
          console.log(chalk.yellow('Nothing selected. Bye!\n'));
          process.exit(EXIT_SUCCESS);
        }

        scanners.forEach(s => options[s] = true);

      } catch (e) {
        console.log('\nCancelled.');
        process.exit(EXIT_CANCELLED);
      }
    }
  }

  const onlyAiDevTools =
    options.aiDevTools === true &&
    !options.nodeModules &&
    !options.python &&
    !options.nvm &&
    !options.nvm &&
    !options.pods &&
    !options.rust &&
    !options.gradle &&
    !options.cmake &&
    !options.flutter &&
    !options.xcode;

  const onlyGlobalScans =
    (options.nvm === true || options.aiDevTools === true) &&
    !options.nodeModules &&
    !options.python &&
    !options.pods &&
    !options.rust &&
    !options.gradle &&
    !options.cmake &&
    !options.flutter &&
    !options.xcode;

  if (options.init) {
    showBanner();
    console.log(chalk.gray('Choose directories to scan. Your selection will be saved to ' + getConfigPath() + '\n'));
    try {
      const { paths: chosenPaths } = await promptForScanPaths(home, { skipSavePrompt: true });
      if (!chosenPaths || chosenPaths.length === 0) {
        console.log(chalk.yellow('No paths selected. Config not changed.\n'));
        process.exit(EXIT_SUCCESS);
      }
      const saved = saveConfig(chosenPaths, home);
      if (saved) {
        console.log(chalk.green('Saved ' + chosenPaths.length + ' path(s) to ' + getConfigPath()));
        console.log(chalk.gray('Paths: ' + chosenPaths.map((p) => toLabel(p)).join(', ')));
        console.log(chalk.gray('Run dclean with a scan type to start, e.g. dclean --node-modules\n'));
      } else {
        console.log(chalk.red('Could not write config file. Check permissions for ' + getConfigPath() + '\n'));
        process.exit(EXIT_ERROR);
      }
    } catch (err) {
      if (err.message && (err.message.includes('User force closed') || err.message.includes('cancel'))) {
        console.log(chalk.yellow('\nCancelled.\n'));
        process.exit(EXIT_CANCELLED);
      }
      console.error(chalk.red('Error:'), err.message);
      if (options.verbose && err.stack) console.error(chalk.gray(err.stack));
      process.exit(EXIT_ERROR);
    }
    return;
  }

  let scanPaths;
  if (options.path) {
    const resolved = resolvePath(options.path);
    if (!resolved) {
      console.error(chalk.red('Error: Invalid --path. Provide an existing directory (e.g. ~/projects or /full/path).\n'));
      process.exit(EXIT_ERROR);
    }
    if (!isReadableDir(resolved)) {
      console.error(chalk.red('Error: Path is not a readable directory: ' + resolved + '\n'));
      process.exit(EXIT_ERROR);
    }
    scanPaths = [resolved];
  } else {
    const config = loadConfig();
    const rawPaths = config.scanPaths || [];
    if (rawPaths.length === 0) {
      if (onlyGlobalScans) {
        scanPaths = [home]; // Default to home for global scans if no config
      } else if (options.interactive === false) {
        showBanner();
        console.log(chalk.yellow('No scan paths configured. Use --init to set paths, or --path <dir> to scan one directory.\n'));
        process.exit(EXIT_SUCCESS);
      } else {
        showBanner();
        console.log(chalk.gray('No scan paths set yet. Choose directories to scan (saved to config for next time).\n'));
        try {
          const { paths: chosenPaths, saveToConfig } = await promptForScanPaths(home);
          if (!chosenPaths || chosenPaths.length === 0) {
            console.log(chalk.yellow('No paths selected. Exiting.\n'));
            process.exit(EXIT_SUCCESS);
          }
          if (saveToConfig) {
            const saved = saveConfig(chosenPaths, home);
            if (saved) console.log(chalk.green('Saved to ' + getConfigPath() + '\n'));
          }
          scanPaths = chosenPaths;
        } catch (err) {
          if (err.message && (err.message.includes('User force closed') || err.message.includes('cancel'))) {
            console.log(chalk.yellow('\nCancelled.\n'));
            process.exit(EXIT_CANCELLED);
          }
          console.error(chalk.red('Error:'), err.message);
          if (options.verbose && err.stack) console.error(chalk.gray(err.stack));
          process.exit(EXIT_ERROR);
        }
      }
    } else {
      const { paths: valid, missing } = resolveAndValidateScanPaths(rawPaths);
      if (missing.length > 0) {
        logger.warn('Skipping non-existent or unreadable path(s): ' + missing.map(toLabel).join(', '));
      }
      if (valid.length === 0) {
        showBanner();
        console.log(chalk.yellow('None of the configured scan paths exist or are readable. Use --init to update config or --path <dir>.\n'));
        process.exit(EXIT_ERROR);
      }
      scanPaths = valid;
    }
  }



  const handleCancel = () => {
    console.log(chalk.yellow('\nCancelled.'));
    process.exit(EXIT_CANCELLED);
  };
  process.on('SIGINT', handleCancel);

  try {
    showBanner();

    if (onlyGlobalScans) {
      console.log(chalk.gray('Scanning global locations (skipping project paths).'));
    } else {
      if (options.xcode) {
        console.log(chalk.gray('Global scan: ~/Library/Developer/Xcode/DerivedData'));
      }
      const scanPathLabel = scanPaths.length === 1 ? toLabel(scanPaths[0]) : scanPaths.map(toLabel).join(', ');
      console.log(chalk.gray('Scan path: ' + scanPathLabel));
      for (const scanPath of scanPaths) {
        const subdirs = listImmediateSubdirs(scanPath);
        if (subdirs.length > 0) {
          const maxShow = 30;
          const shown = subdirs.slice(0, maxShow);
          const rest = subdirs.length - maxShow;
          console.log(chalk.gray('  Folders to scan (' + subdirs.length + '): ' + shown.join(', ') + (rest > 0 ? ' ... +' + rest + ' more' : '')));
        } else {
          console.log(chalk.gray('  (no subfolders or unreadable)'));
        }
      }
    }
    console.log('');

    const spinner = createSpinner('Scanning...').start();
    const progressCallback = (dirPath) => {
      const name = path.basename(dirPath);
      const short = name.length > 35 ? name.slice(0, 32) + '…' : name;
      spinner.text = 'Scanning ' + short + '...';
    };
    const scanOpts = {
      progressCallback,
      scanNodeModules: options.nodeModules === true,
      scanPython: options.python === true,
      scanNvm: options.nvm === true,
      scanPods: options.pods === true,
      scanRust: options.rust === true,
      scanGradle: options.gradle === true,
      scanCMake: options.cmake === true,
      scanFlutter: options.flutter === true,
      scanXcode: options.xcode === true,
      scanAiDevTools: options.aiDevTools === true,
    };
    const scanResults = await runAllScans(scanPaths, scanOpts);
    scanResults.basePathLabel = onlyGlobalScans ? '—' : (scanPaths.length === 1 ? toLabel(scanPaths[0]) : scanPaths.map(toLabel).join(', '));
    spinner.succeed('Scan complete!');

    const hasAnything =
      (scanResults.nodeModules && scanResults.nodeModules.count > 0) ||
      (scanResults.pythonVenvs && scanResults.pythonVenvs.count > 0) ||
      (scanResults.nvmVersions && scanResults.nvmVersions.count > 0) ||
      (scanResults.pods && scanResults.pods.count > 0) ||
      (scanResults.rustTargets && scanResults.rustTargets.count > 0) ||
      (scanResults.gradleBuilds && scanResults.gradleBuilds.count > 0) ||
      (scanResults.cmakeBuilds && scanResults.cmakeBuilds.count > 0) ||
      (scanResults.flutterBuilds && scanResults.flutterBuilds.count > 0) ||
      (scanResults.xcodeBuilds && scanResults.xcodeBuilds.count > 0) ||
      (scanResults.aiDevTools && scanResults.aiDevTools.count > 0);

    if (!hasAnything) {
      console.log(chalk.green('Nothing to clean. Your dev environment looks lean.\n'));
      process.exit(EXIT_SUCCESS);
    }

    displayResults(scanResults);

    const hasDeletable =
      (scanResults.nodeModules && scanResults.nodeModules.count > 0) ||
      (scanResults.pythonVenvs && scanResults.pythonVenvs.count > 0) ||
      (scanResults.nvmVersions && scanResults.nvmVersions.count > 0) ||
      (scanResults.pods && scanResults.pods.count > 0) ||
      (scanResults.rustTargets && scanResults.rustTargets.count > 0) ||
      (scanResults.gradleBuilds && scanResults.gradleBuilds.count > 0) ||
      (scanResults.cmakeBuilds && scanResults.cmakeBuilds.count > 0) ||
      (scanResults.flutterBuilds && scanResults.flutterBuilds.count > 0) ||
      (scanResults.xcodeBuilds && scanResults.xcodeBuilds.count > 0);
    if ((options.aiDevTools === true || options.nvm === true) && !hasDeletable && !onlyGlobalScans) {
      // logic for mixed scan with no deletable items, but if it is onlyGlobalScans we might want to exit differently?
      // Actually original logic was: if onlyAiDevTools and !hasDeletable => exit.
      // Now if onlyGlobalScans (NVM+AI), NVM is deletable. AI is not.
      // So we check hasDeletable. If hasDeletable is true (NVM found), we proceed.
      // If hasDeletable is false (only AI found, or NVM empty), and it was ONLY global scans...
      // We should exit if there's nothing to delete.
    }

    if (onlyGlobalScans && !hasDeletable) {
      // If only global scans (like NVM) were requested and nothing found, we should probably exit or just show the "Nothing to clean" message which handled above?
      // The check !hasAnything at line 326 handles empty results.
      // The check !hasDeletable means we found stuff but it's not deletable.
      // For NVM, items ARE deletable. So !hasDeletable means we found nothing deletable.
      // If onlyAiDevTools, we found only AI items (not deletable).
      if (onlyAiDevTools) {
        console.log(chalk.gray('No deletable items (AI dev tools are for review only).\n'));
        process.exit(EXIT_SUCCESS);
      }
    }

    if (options.interactive === false) {
      console.log(chalk.gray('Run without --no-interactive to choose what to clean.\n'));
      process.exit(EXIT_SUCCESS);
    }

    let selections;
    try {
      selections = await promptForCleanup(scanResults);
    } catch (err) {
      if (err.message && (err.message.includes('User force closed') || err.message.includes('cancel'))) {
        console.log(chalk.yellow('\nCancelled.\n'));
        process.exit(EXIT_CANCELLED);
      }
      throw err;
    }
    if (!selections || selections.length === 0) {
      console.log(chalk.yellow('Nothing selected. Exiting.\n'));
      process.exit(EXIT_SUCCESS);
    }

    let confirmed = false;
    try {
      confirmed = options.yes === true || (await confirmCleanup(selections));
    } catch (err) {
      if (err.message && (err.message.includes('User force closed') || err.message.includes('cancel'))) {
        console.log(chalk.yellow('\nCancelled.\n'));
        process.exit(EXIT_CANCELLED);
      }
      throw err;
    }
    if (!confirmed) {
      console.log(chalk.yellow('Cancelled.\n'));
      process.exit(EXIT_SUCCESS);
    }

    const dryRun = options.dryRun === true;
    if (dryRun) {
      console.log(chalk.gray('\n[DRY RUN] No files will be moved to Trash.\n'));
    }
    const cleanupResult = await performCleanup(selections, { dryRun });
    showCleanupSummary(cleanupResult);

    if (cleanupResult.successCount > 0 && !dryRun) {
      logCleanup({
        freedBytes: cleanupResult.totalFreed,
        itemsDeleted: cleanupResult.successCount,
        scanTypes: Object.keys(options).filter(k => options[k] === true && k !== 'yes' && k !== 'verbose' && k !== 'interactive' && k !== 'dryRun')
      });

      console.log(chalk.green('\nItems moved to Trash. 🗑️'));
      console.log(chalk.cyan('💡 Tip: To reclaim disk space, remember to Empty your Trash!'));

      console.log(
        chalk.green(
          '\n✨ Share your win: "Just freed ' +
          formatBytes(cleanupResult.totalFreed) +
          ' with D Clean!"\n'
        )
      );
    }
    process.exit(EXIT_SUCCESS);
  } catch (err) {
    console.error(chalk.red('Error:'), err.message);
    if (options.verbose && err.stack) console.error(chalk.gray(err.stack));
    process.exit(EXIT_ERROR);
  }
}

main();
