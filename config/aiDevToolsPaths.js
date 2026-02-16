'use strict';

/**
 * AI dev tool data paths (relative to homedir).
 * Used for --ai-dev-tools scan only; we do not offer deletion for these.
 *
 * DO NOT UPDATE UNLESS NEEDED.
 * Add or change entries only when a tool's canonical path is confirmed.
 *
 * name: label in UI
 * relPath: path under ~ (e.g. '.cursor' => ~/.cursor)
 */
module.exports = [
  { name: 'Cursor', relPath: '.cursor' },
  { name: 'Claude', relPath: '.claude' },
  { name: 'Antigravity (Google)', relPath: 'Library/Application Support/Antigravity' },
];
