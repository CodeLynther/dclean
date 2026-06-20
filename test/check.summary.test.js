'use strict';

const { printCheckSummary } = require('../src/utils/check');

describe('printCheckSummary', () => {
  let logs;

  beforeEach(() => {
    logs = [];
    jest.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prints cleanup folder paths when notified', () => {
    printCheckSummary({
      totalReclaimable: 12 * 1024 ** 3,
      alerts: ['node_modules'],
      notified: true,
      cleanupPaths: [
        { path: '/Users/me/projects/huge', sizeFormatted: '6 GB', category: 'node_modules' },
      ],
    });

    const output = logs.join('\n');
    expect(output).toMatch(/Check complete/);
    expect(output).toMatch(/Notification sent/);
    expect(output).toMatch(/Largest folders to clean up/);
    expect(output).toMatch(/projects\/huge/);
    expect(output).toMatch(/6 GB/);
  });

  it('prints below-threshold message without folder list when not notified', () => {
    printCheckSummary({
      totalReclaimable: 100,
      alerts: [],
      notified: false,
      cleanupPaths: [],
    });

    const output = logs.join('\n');
    expect(output).toMatch(/No notification sent/);
    expect(output).not.toMatch(/Largest folders to clean up/);
  });
});
