'use strict';

const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('CLI Monitor Mode Integration', () => {
  jest.setTimeout(30000);

  const cliPath = path.join(__dirname, '../bin/cli.js');

  it('runs silently and exits 0 when under threshold', (done) => {
    exec(`node ${cliPath} --monitor --silent --node-modules --path ${__dirname}`, (err, stdout, stderr) => {
      expect(err).toBeNull();
      expect(stdout.trim()).toBe('');
      expect(stderr.trim()).toBe('');
      done();
    });
  });

  it('exits 1 silently when monitor has no scan paths configured', (done) => {
    const emptyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dclean-monitor-'));
    exec(`node ${cliPath} --monitor --silent`, { env: { ...process.env, HOME: emptyHome } }, (err, stdout, stderr) => {
      try {
        fs.rmSync(emptyHome, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
      expect(err).not.toBeNull();
      expect(err.code).toBe(1);
      expect(stdout.trim()).toBe('');
      expect(stderr.trim()).toBe('');
      done();
    });
  });

  it('prints an error when monitor has no scan paths and is not silent', (done) => {
    const emptyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dclean-monitor-'));
    exec(`node ${cliPath} --monitor`, { env: { ...process.env, HOME: emptyHome } }, (err, stdout, stderr) => {
      try {
        fs.rmSync(emptyHome, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
      expect(err).not.toBeNull();
      expect(err.code).toBe(1);
      expect(stderr).toMatch(/No scan paths configured/);
      done();
    });
  });
});
