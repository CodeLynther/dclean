'use strict';

const path = require('path');
const os = require('os');

module.exports = {
  // Directories to ignore during scan
  IGNORE_DIRS: [
    '.Trash',
    'Library',
    'System',
    '.git',
    '.cache',
    'node_modules/node_modules',
  ],

  // Max scan depth to prevent infinite loops
  MAX_SCAN_DEPTH: 5,

  // Age thresholds (in days) for cleanup options
  AGE_3_MONTHS_DAYS: 90,
  AGE_6_MONTHS_DAYS: 180,
  AGE_1_YEAR_DAYS: 365,
  // Size thresholds (bytes) for cleanup options
  SIZE_500_MB: 500 * 1024 * 1024,
  SIZE_1_GB: 1024 * 1024 * 1024,
  // Legacy aliases
  OLD_THRESHOLD_DAYS: 90,
  VERY_OLD_THRESHOLD_DAYS: 180,

  // NVM config
  NVM_DIR: path.join(os.homedir(), '.nvm'),
  NVM_VERSIONS_DIR: path.join(os.homedir(), '.nvm/versions/node'),

  // Python venv names
  VENV_NAMES: ['venv', '.venv', 'env', 'virtualenv'],

  // Target folder names
  NODE_MODULES: 'node_modules',
  PODS: 'Pods',
};
