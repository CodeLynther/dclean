'use strict';

/**
 * Minimal CLI spinner: start(), .text = '...', succeed(msg).
 * No dependency on ora.
 */
function createSpinner(initialText = 'Loading...') {
  let interval = null;
  let message = initialText;

  const spinner = {
    start() {
      if (interval) clearInterval(interval);
      const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
      let i = 0;
      interval = setInterval(() => {
        const frame = frames[(i += 1) % frames.length];
        process.stdout.write(`\r  ${frame} ${message}\x1b[K`);
      }, 80);
      return spinner;
    },
    get text() {
      return message;
    },
    set text(val) {
      message = val;
    },
    succeed(msg) {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      process.stdout.write('\r');
      const check = '\u2713'; // ✓
      console.log(`  ${check} ${msg || message}`);
    },
    fail(msg) {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      process.stdout.write('\r');
      console.log(`  \u2717 ${msg || message}`);
    },
  };
  return spinner;
}

module.exports = { createSpinner };
