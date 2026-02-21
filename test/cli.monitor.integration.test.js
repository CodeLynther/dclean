'use strict';

const { exec } = require('child_process');
const path = require('path');

describe('CLI Monitor Mode Integration', () => {
    jest.setTimeout(30000);

    it('runs silently and exits 0 when under threshold', (done) => {
        const cliPath = path.join(__dirname, '../bin/cli.js');
        // Using --path with an empty temp directory or just the test dir 
        // to ensure it scans quickly and stays well under the 10GB threshold.
        // We add --node-modules to prevent `--monitor` from auto-enabling all global scanners.
        exec(`node ${cliPath} --monitor --silent --node-modules --path ${__dirname}`, (err, stdout, stderr) => {
            expect(err).toBeNull();
            expect(stdout.trim()).toBe('');
            expect(stderr.trim()).toBe('');
            done();
        });
    });
});
