'use strict';

const { exec } = require('child_process');
const logger = require('./logger');

/**
 * Sends a native macOS notification using osascript.
 * @param {string} title - The notification title.
 * @param {string} message - The notification body.
 * @returns {Promise<void>}
 */
async function sendNotification(title, message) {
  const platform = process.platform;

  if (platform === 'darwin') {
    // macOS: Use 'display alert' for persistence and to avoid opening Script Editor
    const escapedTitle = title.replace(/'/g, "\\'");
    const escapedMessage = message.replace(/'/g, "\\'");
    const script = `display alert "${escapedTitle}" message "${escapedMessage}" as informational buttons {"OK"} default button "OK"`;

    return new Promise((resolve) => {
      exec(`osascript -e '${script}'`, (error) => {
        if (error) logger.error('Failed to send macOS alert: ' + error.message);
        resolve();
      });
    });
  }

  if (platform === 'linux') {
    // Linux: Use notify-send (common in most desktop distros)
    // We use the --urgency=critical to encourage persistence, though it varies by desktop environment
    return new Promise((resolve) => {
      exec(`notify-send "${title}" "${message}" --urgency=critical --icon=drive-harddisk`, (error) => {
        if (error) {
          // If notify-send isn't found, we just log it
          logger.info(`[Alert] ${title}: ${message}`);
        }
        resolve();
      });
    });
  }

  // Fallback for other platforms (or headless Linux)
  logger.info(`[Alert] ${title}: ${message}`);
  return Promise.resolve();
}

module.exports = {
  sendNotification,
};
