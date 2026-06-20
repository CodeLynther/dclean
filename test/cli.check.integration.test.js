'use strict';

const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('CLI Check Mode Integration', () => {
  jest.setTimeout(30000);

  const cliPath = path.join(__dirname, '../bin/cli.js');

  it('runs silently and exits 0 when under threshold', (done) => {
    exec(`node ${cliPath} --check --silent --node-modules --path ${__dirname}`, (err, stdout, stderr) => {
      expect(err).toBeNull();
      expect(stdout.trim()).toBe('');
      expect(stderr.trim()).toBe('');
      done();
    });
  });

  it('exits 1 silently when check has no scan paths configured', (done) => {
    const emptyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dclean-check-'));
    exec(`node ${cliPath} --check --silent`, { env: { ...process.env, HOME: emptyHome } }, (err, stdout, stderr) => {
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

  it('prints an error when check has no scan paths and is not silent', (done) => {
    const emptyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dclean-check-'));
    exec(`node ${cliPath} --check`, { env: { ...process.env, HOME: emptyHome } }, (err, stdout, stderr) => {
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

  it('prints check summary when not silent', (done) => {
    exec(`node ${cliPath} --check --node-modules --path ${__dirname}`, (err, stdout) => {
      expect(err).toBeNull();
      expect(stdout).toMatch(/Check complete/);
      expect(stdout).toMatch(/Schedule automatic checks with cron/);
      done();
    });
  });
});
