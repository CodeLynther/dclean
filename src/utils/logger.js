const chalk = require('chalk');

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  SUCCESS: 2,
  WARN: 3,
  ERROR: 4,
};

let currentLogLevel = LOG_LEVELS.INFO;

function setVerbose(isVerbose) {
  currentLogLevel = isVerbose ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;
}

function log(level, icon, color, message, ...args) {
  if (level >= currentLogLevel) {
    console.log(color(icon), message, ...args);
  }
}

const logger = {
  setVerbose,
  debug: (msg, ...args) => log(LOG_LEVELS.DEBUG, '·', chalk.gray, msg, ...args),
  info: (msg, ...args) => log(LOG_LEVELS.INFO, 'ℹ', chalk.blue, msg, ...args),
  success: (msg, ...args) => log(LOG_LEVELS.SUCCESS, '✔', chalk.green, msg, ...args),
  warn: (msg, ...args) => log(LOG_LEVELS.WARN, '⚠', chalk.yellow, msg, ...args),
  error: (msg, ...args) => {
    if (msg instanceof Error) {
      console.error(chalk.red('✖'), msg.message);
      if (currentLogLevel === LOG_LEVELS.DEBUG) {
        console.error(chalk.gray(msg.stack));
      }
    } else {
      console.error(chalk.red('✖'), msg, ...args);
    }
  },
};

module.exports = logger;
