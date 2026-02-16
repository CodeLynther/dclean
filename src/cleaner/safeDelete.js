'use strict';

const path = require('path');
const os = require('os');

function getProtectedPaths() {
  const home = os.homedir();
  return [
    home,
    path.join(home, 'Desktop'),
    path.join(home, 'Documents'),
    path.join(home, 'Downloads'),
    path.join(home, '.ssh'),
    path.join(home, 'Library'),
  ].map((p) => path.resolve(p));
}

/**
 * Validate path is safe to delete: under home, not protected.
 * @param {string} dirPath
 * @throws {Error} if invalid or protected
 */
function validatePathForDeletion(dirPath) {
  if (!dirPath || dirPath === '/' || dirPath === '') {
    throw new Error('Invalid path for deletion');
  }

  const resolved = path.resolve(dirPath);
  const home = path.resolve(os.homedir());

  if (!resolved.startsWith(home) || resolved === home) {
    throw new Error('Can only delete within home directory');
  }

  // Only block deleting the protected folders themselves, not their contents
  const protectedPaths = getProtectedPaths().filter((p) => p !== home);
  if (protectedPaths.some((p) => resolved === p)) {
    throw new Error('Cannot delete protected directory: ' + dirPath);
  }
}

/**
 * Delete a directory after safety checks. Supports dry-run.
 * @param {string} dirPath - Absolute or relative path
 * @param {object} options - { dryRun: boolean, trashFn?: (paths: string[], opts: object) => Promise<void> } (trashFn for tests)
 * @throws {Error} on validation failure or fs failure
 */
async function safeDelete(dirPath, options = {}) {
  const { dryRun = false, trashFn } = options;
  validatePathForDeletion(dirPath);

  const resolved = path.resolve(dirPath);

  if (dryRun) {
    return;
  }

  const trash = trashFn || (await import('trash')).default;
  try {
    await trash([resolved], { glob: false });
  } catch (err) {
    if (err.code === 'EACCES') {
      throw new Error('Permission denied: ' + dirPath);
    }
    if (err.code === 'ENOENT') {
      return;
    }
    throw err;
  }
}

module.exports = {
  safeDelete,
  validatePathForDeletion,
  getProtectedPaths,
};
