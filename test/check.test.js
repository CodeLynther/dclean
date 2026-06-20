'use strict';

const {
  getTotalReclaimable,
  getCheckAlerts,
  shouldNotify,
  getCleanupPaths,
  buildNotificationMessage,
} = require('../src/utils/check');

describe('check utils', () => {
  const gb = (n) => n * 1024 * 1024 * 1024;

  it('sums reclaimable categories', () => {
    const total = getTotalReclaimable({
      nodeModules: { totalSize: 100 },
      nvmVersions: { totalSize: 200 },
    });
    expect(total).toBe(300);
  });

  it('flags category alerts above 5 GB', () => {
    const alerts = getCheckAlerts({
      xcodeBuilds: { totalSize: gb(6) },
      nvmVersions: { totalSize: gb(1) },
      nodeModules: { totalSize: gb(1) },
    });
    expect(alerts).toEqual(['Xcode DerivedData']);
  });

  it('notifies when total exceeds 10 GB', () => {
    expect(shouldNotify(gb(11), [])).toBe(true);
    expect(shouldNotify(gb(3), [])).toBe(false);
  });

  it('returns top cleanup paths for alerted categories', () => {
    const paths = getCleanupPaths({
      nodeModules: {
        totalSize: gb(6),
        items: [
          { path: '/home/u/projects/big/node_modules', size: gb(4), sizeFormatted: '4 GB' },
          { path: '/home/u/projects/small/node_modules', size: gb(2), sizeFormatted: '2 GB' },
        ],
      },
    });
    expect(paths).toHaveLength(2);
    expect(paths[0].path).toContain('big');
  });

  it('includes folder paths in notification message', () => {
    const msg = buildNotificationMessage({
      totalReclaimable: gb(12),
      alerts: ['node_modules'],
      cleanupPaths: [
        { path: '/Users/adi/projects/foo', sizeFormatted: '4 GB' },
      ],
    });
    expect(msg).toMatch(/node_modules exceed 5 GB/);
    expect(msg).toMatch(/projects\/foo/);
    expect(msg).toMatch(/Run dclean/);
  });

  it('returns paths from all categories when only total threshold is exceeded', () => {
    const paths = getCleanupPaths(
      {
        pythonVenvs: {
          totalSize: gb(4),
          items: [{ path: '/home/u/proj/.venv', size: gb(4), sizeFormatted: '4 GB' }],
        },
        rustTargets: {
          totalSize: gb(7),
          items: [{ path: '/home/u/rust-app/target', size: gb(7), sizeFormatted: '7 GB' }],
        },
      },
      { max: 3 }
    );
    expect(paths).toHaveLength(2);
    expect(paths[0].path).toContain('rust-app');
  });

  it('sorts cleanup paths by size descending', () => {
    const paths = getCleanupPaths({
      nodeModules: {
        totalSize: gb(8),
        items: [
          { path: '/a/small/node_modules', size: gb(2), sizeFormatted: '2 GB' },
          { path: '/a/big/node_modules', size: gb(6), sizeFormatted: '6 GB' },
        ],
      },
    });
    expect(paths[0].path).toContain('big');
  });
});
