'use strict';

const { execFile } = require('child_process');
const logger = require('./logger');

/**
 * Sends a native system notification.
 * @param {string} title - The notification title.
 * @param {string} message - The notification body.
 * @returns {Promise<void>}
 */
async function sendNotification(title, message) {
  const platform = process.platform;

  if (platform === 'darwin') {
    const escapedTitle = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const escapedMessage = message.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = `display notification "${escapedMessage}" with title "${escapedTitle}"`;

    return new Promise((resolve) => {
      execFile('osascript', ['-e', script], (error) => {
        if (error) logger.error('Failed to send macOS notification: ' + error.message);
        resolve();
      });
    });
  }

  if (platform === 'linux') {
    const { exec } = require('child_process');
    return new Promise((resolve) => {
      exec(`notify-send "${title}" "${message}" --urgency=critical --icon=drive-harddisk`, (error) => {
        if (error) {
          logger.info(`[Alert] ${title}: ${message}`);
        }
        resolve();
      });
    });
  }

  logger.info(`[Alert] ${title}: ${message}`);
  return Promise.resolve();
}

module.exports = {
  sendNotification,
};
