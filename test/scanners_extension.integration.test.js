'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const RustTargetScanner = require('../src/scanners/rustTarget');
const GradleBuildScanner = require('../src/scanners/gradleBuild');
const CMakeBuildScanner = require('../src/scanners/cmakeBuild');
const FlutterBuildScanner = require('../src/scanners/flutterBuild');
const XcodeScanner = require('../src/scanners/xcodeDerivedData');

function mkdirpSync(dir) {
    if (fs.existsSync(dir)) return;
    const parent = path.dirname(dir);
    if (parent !== dir) mkdirpSync(parent);
    fs.mkdirSync(dir);
}

function createTempRoot() {
    const tmp = path.join(os.tmpdir(), `dclean-ext-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
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

describe('Scanners Extensions Integration', () => {
    let tempRoot;

    beforeEach(() => {
        tempRoot = createTempRoot();
    });

    afterEach(() => {
        if (tempRoot) rmSyncRecursive(tempRoot);
    });

    describe('RustTargetScanner', () => {
        it('finds target dir when Cargo.toml exists', async () => {
            const projectDir = path.join(tempRoot, 'rust-proj');
            const targetDir = path.join(projectDir, 'target');
            mkdirpSync(targetDir);
            fs.writeFileSync(path.join(projectDir, 'Cargo.toml'), '[package]\nname="test"\n');

            const scanner = new RustTargetScanner();
            const result = await scanner.scan(tempRoot);

            expect(result.type).toBe('rust_target');
            expect(result.count).toBe(1);
            expect(result.items[0].path).toBe(targetDir);
        });

        it('ignores target dir when Cargo.toml is missing', async () => {
            const projectDir = path.join(tempRoot, 'fake-proj');
            const targetDir = path.join(projectDir, 'target');
            mkdirpSync(targetDir);

            const scanner = new RustTargetScanner();
            const result = await scanner.scan(tempRoot);

            expect(result.count).toBe(0);
        });
    });

    describe('GradleBuildScanner', () => {
        it('finds build and .gradle when build.gradle exists', async () => {
            const projectDir = path.join(tempRoot, 'android-app');
            const buildDir = path.join(projectDir, 'build');
            const dotGradleDir = path.join(projectDir, '.gradle');
            mkdirpSync(buildDir);
            mkdirpSync(dotGradleDir);
            fs.writeFileSync(path.join(projectDir, 'build.gradle'), '// gradle');

            const scanner = new GradleBuildScanner();
            const result = await scanner.scan(tempRoot);

            expect(result.count).toBe(2);
            const paths = result.items.map(i => i.path);
            expect(paths).toContain(buildDir);
            expect(paths).toContain(dotGradleDir);
        });

        it('finds build when settings.gradle exists', async () => {
            const projectDir = path.join(tempRoot, 'java-proj');
            const buildDir = path.join(projectDir, 'build');
            mkdirpSync(buildDir);
            fs.writeFileSync(path.join(projectDir, 'settings.gradle'), '// settings');

            const scanner = new GradleBuildScanner();
            const result = await scanner.scan(tempRoot);

            expect(result.count).toBe(1);
            expect(result.items[0].path).toBe(buildDir);
        });
    });

    describe('CMakeBuildScanner', () => {
        it('finds cmake-build-debug when CMakeLists.txt exists', async () => {
            const projectDir = path.join(tempRoot, 'cpp-proj');
            const buildDir = path.join(projectDir, 'cmake-build-debug');
            mkdirpSync(buildDir);
            fs.writeFileSync(path.join(projectDir, 'CMakeLists.txt'), 'cmake_minimum_required(VERSION 3.10)');

            const scanner = new CMakeBuildScanner();
            const result = await scanner.scan(tempRoot);

            expect(result.count).toBe(1);
            expect(result.items[0].path).toBe(buildDir);
        });
    });

    describe('FlutterBuildScanner', () => {
        it('finds build and .dart_tool when pubspec.yaml exists', async () => {
            const projectDir = path.join(tempRoot, 'flutter-app');
            const buildDir = path.join(projectDir, 'build');
            const dartToolDir = path.join(projectDir, '.dart_tool');
            mkdirpSync(buildDir);
            mkdirpSync(dartToolDir);
            fs.writeFileSync(path.join(projectDir, 'pubspec.yaml'), 'name: my_app\n');

            const scanner = new FlutterBuildScanner();
            const result = await scanner.scan(tempRoot);

            expect(result.count).toBe(2);
        });
    });

    describe('XcodeScanner', () => {
        it('finds local build folder when .xcodeproj exists', async () => {
            const projectDir = path.join(tempRoot, 'ios-app');
            const buildDir = path.join(projectDir, 'build');
            mkdirpSync(buildDir);
            // Mock xcodeproj directory
            const xcodeproj = path.join(projectDir, 'App.xcodeproj');
            mkdirpSync(xcodeproj);

            const Scanner = require('../src/scanners/xcodeDerivedData');
            const scanner = new Scanner({ homeDir: tempRoot });
            const result = await scanner.scan(tempRoot);

            expect(result.count).toBe(1);
            expect(result.items[0].path).toBe(buildDir);
        });

        it('finds global DerivedData when utilizing custom homeDir option', async () => {
            // Mock a "home" with DerivedData
            const mockHome = path.join(tempRoot, 'mock-home');
            const derivedData = path.join(mockHome, 'Library/Developer/Xcode/DerivedData');
            mkdirpSync(derivedData);

            // Create a dummy project inside DerivedData
            const projectDD = path.join(derivedData, 'MyProject-abcde');
            mkdirpSync(projectDD);

            // Create a separate scan path that is NOT related to home
            const scanPath = path.join(tempRoot, 'some-other-place');
            mkdirpSync(scanPath);

            // Pass mockHome to scanner
            const scanner = new XcodeScanner({ homeDir: mockHome });

            // Scan unrelated path, should still find global DerivedData because of our fix
            const result = await scanner.scan(scanPath);

            expect(result.items.some(i => i.path === projectDD)).toBe(true);
        });
    });
});
