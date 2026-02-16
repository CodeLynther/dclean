'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

// Old config: ~/.devclean.json
// New config: ~/.dclean/config.json
const LEGACY_CONFIG_FILENAME = '.devclean.json';
const CONFIG_DIR_NAME = '.dclean';
const CONFIG_FILENAME = 'config.json';

/**
 * Path to user config file (~/.dclean/config.json).
 * Ensure directory exists.
 * @returns {string}
 */
function getConfigPath() {
  const home = os.homedir();
  const dir = path.join(home, CONFIG_DIR_NAME);
  return path.join(dir, CONFIG_FILENAME);
}

/**
 * Check for legacy config and migrate if needed.
 */
function migrateLegacyConfig() {
  const home = os.homedir();
  const legacyPath = path.join(home, LEGACY_CONFIG_FILENAME);
  const newPath = getConfigPath();
  const newDir = path.dirname(newPath);

  try {
    if (fs.existsSync(legacyPath) && !fs.existsSync(newPath)) {
      // Migrate
      fs.mkdirSync(newDir, { recursive: true });
      fs.renameSync(legacyPath, newPath);
    }
  } catch (err) {
    // Ignore migration errors, start fresh
  }
}

/**
 * Load config. Returns { scanPaths: string[] }. Resolves ~ in paths.
 * If no file or invalid JSON: returns { scanPaths: [] }.
 * @returns {{ scanPaths: string[] }}
 */
function loadConfig() {
  migrateLegacyConfig();

  const configPath = getConfigPath();
  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { scanPaths: [] };
    return { scanPaths: [] };
  }
  try {
    const data = JSON.parse(raw);
    const list = Array.isArray(data.scanPaths) ? data.scanPaths : [];
    const scanPaths = list
      .map((p) => (typeof p === 'string' ? p.trim() : ''))
      .filter(Boolean)
      .map((p) => (p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : path.resolve(p)));
    return { scanPaths };
  } catch {
    try {
      const logger = require('./logger');
      logger.warn('Invalid config at ' + configPath + ', using no paths. Fix or delete the file.');
    } catch { }
    return { scanPaths: [] };
  }
}

/**
 * Convert absolute path to storage form (~/... if under home, else absolute).
 * @param {string} absolutePath
 * @param {string} homeDir
 * @returns {string}
 */
function toStoredPath(absolutePath, homeDir) {
  const normalized = path.normalize(absolutePath);
  if (homeDir && normalized.startsWith(path.normalize(homeDir + path.sep))) {
    return '~' + normalized.slice(path.normalize(homeDir).length);
  }
  return normalized;
}

/**
 * Save scan paths to config file. Paths can be absolute; stored as ~/ when under home.
 * @param {string[]} absolutePaths - Resolved paths to save
 * @param {string} homeDir - os.homedir()
 * @returns {boolean} true if written
 */
function saveConfig(absolutePaths, homeDir) {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);

  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) { }

  const stored = (absolutePaths || []).map((p) => toStoredPath(p, homeDir)).filter(Boolean);
  const data = { scanPaths: stored };
  try {
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a default config file with example scan paths if it doesn't exist.
 * @returns {boolean} true if file was created
 */
function createDefaultConfig() {
  const configPath = getConfigPath();
  try {
    fs.accessSync(configPath);
    return false;
  } catch {
    // File doesn't exist
  }
  const example = {
    scanPaths: [
      '~/projects',
      '~/dev',
      '~/Desktop',
    ],
    _comment: 'Add directories to scan for node_modules and Python venvs. Paths are relative to home (~) or absolute.',
  };

  const dir = path.dirname(configPath);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(example, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  getConfigPath,
  loadConfig,
  saveConfig,
  toStoredPath,
  createDefaultConfig,
  CONFIG_FILENAME,
};
