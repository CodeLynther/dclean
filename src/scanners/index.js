const NodeModulesScanner = require('./nodeModules');
const PythonVenvScanner = require('./pythonVenv');
const NvmVersionsScanner = require('./nvmVersions');
const PodsScanner = require('./pods');
const RustTargetScanner = require('./rustTarget');
const GradleBuildScanner = require('./gradleBuild');
const CMakeBuildScanner = require('./cmakeBuild');
const FlutterBuildScanner = require('./flutterBuild');
const XcodeScanner = require('./xcodeDerivedData');
const AiDevToolsScanner = require('./aiDevTools');
const { formatBytes } = require('../utils/fileSize');
const logger = require('../utils/logger');

/**
 * Registry of all available scanner implementations.
 * Maps CLI flags to scanner classes and result properties.
 */
const SCANNER_REGISTRY = [
  { key: 'scanNodeModules', ScannerClass: NodeModulesScanner, property: 'nodeModules', isGlobal: false },
  { key: 'scanPython', ScannerClass: PythonVenvScanner, property: 'pythonVenvs', isGlobal: false },
  { key: 'scanNvm', ScannerClass: NvmVersionsScanner, property: 'nvmVersions', isGlobal: true },
  { key: 'scanPods', ScannerClass: PodsScanner, property: 'pods', isGlobal: false },
  { key: 'scanRust', ScannerClass: RustTargetScanner, property: 'rustTargets', isGlobal: false },
  { key: 'scanGradle', ScannerClass: GradleBuildScanner, property: 'gradleBuilds', isGlobal: false },
  { key: 'scanCMake', ScannerClass: CMakeBuildScanner, property: 'cmakeBuilds', isGlobal: false },
  { key: 'scanFlutter', ScannerClass: FlutterBuildScanner, property: 'flutterBuilds', isGlobal: false },
  { key: 'scanXcode', ScannerClass: XcodeScanner, property: 'xcodeBuilds', isGlobal: false },
  { key: 'scanAiDevTools', ScannerClass: AiDevToolsScanner, property: 'aiDevTools', isGlobal: true },
];

/**
 * Orchestrates the execution of all registered scanners over the provided paths.
 * Returns a consolidated payload of disk usage metrics and metadata.
 *
 * @param {string|string[]} basePathOrPaths - Directory path(s) to search for dev bloat
 * @param {object} [options={}] - Configuration flags (e.g., { scanNodeModules: true })
 * @param {Function} [options.progressCallback] - Optional hook for real-time progress updates
 * @returns {Promise<object>} Unified results object containing counts, sizes, and items
 */
async function runAllScans(basePathOrPaths, options = {}) {
  const paths = Array.isArray(basePathOrPaths) ? basePathOrPaths : [basePathOrPaths];
  const scanOpts = options.progressCallback ? { onEnterDir: options.progressCallback } : {};
  const results = {
    totalSize: 0,
    scannedAt: new Date().toISOString(),
    basePath: paths.length === 1 ? paths[0] : paths,
  };

  await Promise.all(
    SCANNER_REGISTRY.map(async ({ key, ScannerClass, property, isGlobal }) => {
      // If no scan flags are set, we scan nothing. If at least one is set, we scan only that.
      if (!options[key]) {
        results[property] = { items: [], totalSize: 0, totalSizeFormatted: '0 B', count: 0 };
        return;
      }

      const scanner = new ScannerClass();
      try {
        if (isGlobal) {
          results[property] = await scanner.scan();
        } else {
          const pathResults = await Promise.all(
            paths.map((p) =>
              scanner.scan(p, scanOpts).catch((err) => {
                logger.warn(`${scanner.name} scanner failed for ${p}:`, err.message);
                return { items: [], totalSize: 0, count: 0 };
              })
            )
          );
          results[property] = mergeResults(pathResults, scanner.name);
        }
        results.totalSize += results[property].totalSize || 0;
      } catch (err) {
        logger.error(`${property} scanner failed:`, err);
        results[property] = { items: [], totalSize: 0, totalSizeFormatted: '0 B', count: 0 };
      }
    })
  );

  return results;
}

function mergeResults(results, type) {
  const items = results.flatMap((r) => r.items || []);
  const totalSize = items.reduce((sum, i) => sum + (i.size || 0), 0);
  return {
    type,
    items,
    totalSize,
    totalSizeFormatted: formatBytes(totalSize),
    count: items.length,
  };
}

module.exports = {
  runAllScans,
  NodeModulesScanner,
  PythonVenvScanner,
  NvmVersionsScanner,
  PodsScanner,
};
