'use strict';

const path = require('path');
const os = require('os');
const { safeDelete, validatePathForDeletion, getProtectedPaths } = require('../src/cleaner/safeDelete');

describe('safeDelete', () => {
  const home = path.resolve('/home/testuser');
  let trashMock;

  beforeAll(() => {
    jest.spyOn(os, 'homedir').mockReturnValue(home);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    trashMock = jest.fn();
  });

  describe('getProtectedPaths', () => {
    it('returns home and protected folder paths', () => {
      const protectedPaths = getProtectedPaths();
      expect(protectedPaths).toContain(home);
      expect(protectedPaths).toContain(path.join(home, 'Desktop'));
      expect(protectedPaths).toContain(path.join(home, 'Documents'));
      expect(protectedPaths).toContain(path.join(home, '.ssh'));
      expect(protectedPaths).toContain(path.join(home, 'Library'));
    });
  });

  describe('validatePathForDeletion', () => {
    it('throws for empty string', () => {
      expect(() => validatePathForDeletion('')).toThrow('Invalid path for deletion');
    });

    it('throws for root path', () => {
      expect(() => validatePathForDeletion('/')).toThrow('Invalid path for deletion');
    });

    it('throws for path outside home', () => {
      expect(() => validatePathForDeletion('/etc/foo')).toThrow('Can only delete within home directory');
      expect(() => validatePathForDeletion('/usr/local')).toThrow('Can only delete within home directory');
    });

    it('throws for home directory itself', () => {
      expect(() => validatePathForDeletion(home)).toThrow('Can only delete within home directory');
    });

    it('throws for protected directories', () => {
      expect(() => validatePathForDeletion(path.join(home, 'Desktop'))).toThrow(
        'Cannot delete protected directory'
      );
      expect(() => validatePathForDeletion(path.join(home, 'Documents'))).toThrow(
        'Cannot delete protected directory'
      );
      expect(() => validatePathForDeletion(path.join(home, '.ssh'))).toThrow(
        'Cannot delete protected directory'
      );
    });

    it('allows path under home that is not protected', () => {
      expect(() => validatePathForDeletion(path.join(home, 'projects', 'myapp', 'node_modules'))).not.toThrow();
      expect(() => validatePathForDeletion(path.join(home, 'Desktop', 'work', 'proj', 'venv'))).not.toThrow();
    });
  });

  describe('safeDelete', () => {
    const validPath = path.join(home, 'projects', 'app', 'node_modules');

    it('does not call trash when dryRun is true', async () => {
      await safeDelete(validPath, { dryRun: true, trashFn: trashMock });
      expect(trashMock).not.toHaveBeenCalled();
    });

    it('calls trash with resolved path when dryRun is false', async () => {
      trashMock.mockResolvedValueOnce(undefined);
      await safeDelete(validPath, { dryRun: false, trashFn: trashMock });
      expect(trashMock).toHaveBeenCalledTimes(1);
      expect(trashMock).toHaveBeenCalledWith([path.resolve(validPath)], { glob: false });
    });

    it('throws Permission denied when trash throws EACCES', async () => {
      trashMock.mockRejectedValueOnce(Object.assign(new Error('access denied'), { code: 'EACCES' }));
      await expect(safeDelete(validPath, { dryRun: false, trashFn: trashMock })).rejects.toThrow(
        'Permission denied'
      );
    });

    it('returns without throwing when trash throws ENOENT', async () => {
      trashMock.mockRejectedValueOnce(Object.assign(new Error('not found'), { code: 'ENOENT' }));
      await expect(safeDelete(validPath, { dryRun: false, trashFn: trashMock })).resolves.toBeUndefined();
    });

    it('rethrows other errors from trash', async () => {
      trashMock.mockRejectedValueOnce(new Error('unknown error'));
      await expect(safeDelete(validPath, { dryRun: false, trashFn: trashMock })).rejects.toThrow(
        'unknown error'
      );
    });

    it('throws on validation failure before calling trash', async () => {
      await expect(safeDelete('/', { dryRun: false, trashFn: trashMock })).rejects.toThrow(
        'Invalid path for deletion'
      );
      expect(trashMock).not.toHaveBeenCalled();
    });
  });
});
