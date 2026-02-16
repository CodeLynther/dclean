'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const NodeModulesScanner = require('../src/scanners/nodeModules');
const PythonVenvScanner = require('../src/scanners/pythonVenv');
const PodsScanner = require('../src/scanners/pods');

function mkdirpSync(dir) {
  if (fs.existsSync(dir)) return;
  const parent = path.dirname(dir);
  if (parent !== dir) mkdirpSync(parent);
  fs.mkdirSync(dir);
}

function createTempRoot() {
  const tmp = path.join(os.tmpdir(), `dclean-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(tmp, { recursive: true });
  return tmp;
}

function rmSyncRecursive(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) rmSyncRecursive(full);
    else fs.unlinkSync(full);
  }
  fs.rmdirSync(dir);
}

describe('Scanners integration', () => {
  let tempRoot;

  beforeEach(() => {
    tempRoot = createTempRoot();
  });

  afterEach(() => {
    if (tempRoot) rmSyncRecursive(tempRoot);
  });

  describe('NodeModulesScanner', () => {
    it('finds node_modules and returns items with size and metadata', async () => {
      const projectDir = path.join(tempRoot, 'my-app');
      const nodeModulesDir = path.join(projectDir, 'node_modules');
      mkdirpSync(nodeModulesDir);
      fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"my-app"}\n');

      const scanner = new NodeModulesScanner();
      const result = await scanner.scan(tempRoot);

      expect(result.type).toBe('node_modules');
      expect(result.count).toBeGreaterThanOrEqual(1);
      expect(result.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: nodeModulesDir,
            parentProject: 'my-app',
            size: expect.any(Number),
            lastModifiedDays: expect.any(Number),
          }),
        ])
      );
      expect(result.totalSize).toBeGreaterThanOrEqual(0);
    });

    it('excludes nested node_modules (only top-level per project)', async () => {
      const projectDir = path.join(tempRoot, 'proj');
      mkdirpSync(path.join(projectDir, 'node_modules', 'pkg', 'node_modules'));
      fs.writeFileSync(path.join(projectDir, 'package.json'), '{}');

      const scanner = new NodeModulesScanner();
      const result = await scanner.scan(tempRoot);

      expect(result.count).toBe(1);
      expect(result.items[0].path).toBe(path.join(projectDir, 'node_modules'));
    });

    it('correctly identifies node_modules even if parent path contains "node_modules" string', async () => {
      const projectDir = path.join(tempRoot, 'my-node_modules-parser');
      const nodeModulesDir = path.join(projectDir, 'node_modules');
      mkdirpSync(nodeModulesDir);
      fs.writeFileSync(path.join(projectDir, 'package.json'), '{}');

      const scanner = new NodeModulesScanner();
      const result = await scanner.scan(tempRoot);

      expect(result.count).toBe(1);
      expect(result.items[0].path).toBe(nodeModulesDir);
    });
  });

  describe('PythonVenvScanner', () => {
    it('finds venv when pyvenv.cfg exists', async () => {
      const projectDir = path.join(tempRoot, 'py-project');
      const venvDir = path.join(projectDir, 'venv');
      mkdirpSync(venvDir);
      fs.writeFileSync(path.join(venvDir, 'pyvenv.cfg'), 'home = /usr\n');

      const scanner = new PythonVenvScanner();
      const result = await scanner.scan(tempRoot);

      expect(result.type).toBe('python_venv');
      expect(result.count).toBeGreaterThanOrEqual(1);
      expect(result.items.some((i) => i.path === venvDir)).toBe(true);
    });

    it('finds .venv when bin/python exists', async () => {
      const projectDir = path.join(tempRoot, 'other');
      const venvDir = path.join(projectDir, '.venv');
      mkdirpSync(path.join(venvDir, 'bin'));
      fs.writeFileSync(path.join(venvDir, 'bin', 'python'), '#!/usr/bin/env python\n');

      const scanner = new PythonVenvScanner();
      const result = await scanner.scan(tempRoot);

      expect(result.count).toBeGreaterThanOrEqual(1);
      expect(result.items.some((i) => i.path === venvDir)).toBe(true);
    });
  });

  describe('PodsScanner', () => {
    it('finds Pods directories', async () => {
      const projectDir = path.join(tempRoot, 'ios-app');
      const podsDir = path.join(projectDir, 'Pods');
      mkdirpSync(podsDir);

      const scanner = new PodsScanner();
      const result = await scanner.scan(tempRoot);

      expect(result.type).toBe('pods');
      expect(result.count).toBeGreaterThanOrEqual(1);
      expect(result.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: podsDir,
            size: expect.any(Number),
            lastModifiedDays: expect.any(Number),
          }),
        ])
      );
    });
  });
});
