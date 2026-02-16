'use strict';

const { safeDelete } = require('./safeDelete');
const { formatBytes } = require('../utils/fileSize');
const logger = require('../utils/logger');

/**
 * Dedupe selections by path so we never delete the same path twice.
 * @param {Array<{ type: string, items: Array<{ path: string, size?: number }> }>} selections
 * @returns {Array<{ path: string, size: number }>}
 */
function flattenAndDedupe(selections) {
  const byPath = new Map();
  for (const sel of selections) {
    if (!sel.items) continue;
    for (const item of sel.items) {
      const p = item.path;
      if (!byPath.has(p)) {
        byPath.set(p, {
          path: p,
          size: item.size || 0,
          lastModifiedDays: item.lastModifiedDays,
        });
      }
    }
  }
  return Array.from(byPath.values());
}

/**
 * Perform cleanup: delete all selected paths (with optional dry-run).
 * @param {Array<{ type: string, items: object[] }>} selections - from promptForCleanup
 * @param {object} options - { dryRun: boolean }
 * @returns {Promise<{ totalFreed: number, results: object[], successCount: number, failCount: number }>}
 */
async function performCleanup(selections, options = {}) {
  const { dryRun = false } = options;

  const items = flattenAndDedupe(selections);
  let totalFreed = 0;
  const results = [];

  for (const item of items) {
    try {
      if (dryRun) {
        logger.info('[DRY RUN] Would delete: ' + item.path);
        totalFreed += item.size;
        results.push({ path: item.path, size: item.size, success: true });
      } else {
        await safeDelete(item.path, { dryRun: false });
        totalFreed += item.size;
        results.push({ path: item.path, size: item.size, success: true });
      }
    } catch (error) {
      logger.warn('Failed to delete ' + item.path + ': ' + error.message);
      results.push({
        path: item.path,
        success: false,
        error: error.message,
      });
    }
  }

  return {
    totalFreed,
    results,
    successCount: results.filter((r) => r.success).length,
    failCount: results.filter((r) => !r.success).length,
  };
}

/**
 * Print cleanup summary (space freed, list, errors).
 * @param {object} cleanupResult - return value of performCleanup
 */
function showCleanupSummary(cleanupResult) {
  const { totalFreed, results, successCount, failCount } = cleanupResult;
  console.log('\n💾 Total space freed: ' + formatBytes(totalFreed));
  console.log('   Moved to Trash: ' + successCount + ', Failed: ' + failCount);
  const failed = results.filter((r) => !r.success);
  if (failed.length > 0) {
    failed.forEach((r) => console.log('   Error: ' + r.path + ' - ' + (r.error || 'unknown')));
  }
}

module.exports = {
  performCleanup,
  showCleanupSummary,
  flattenAndDedupe,
};
