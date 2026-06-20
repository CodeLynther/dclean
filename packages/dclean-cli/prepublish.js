'use strict';

const fs = require('fs');
const path = require('path');

const dir = __dirname;
const rootPkg = JSON.parse(fs.readFileSync(path.join(dir, '../../package.json'), 'utf8'));
const pkgPath = path.join(dir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

pkg.version = rootPkg.version;
pkg.dependencies['@codelynther/dclean'] = `^${rootPkg.version}`;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

for (const file of ['README.md', 'LICENSE']) {
  const target = path.join(dir, file);
  fs.rmSync(target, { force: true });
  fs.copyFileSync(path.join(dir, '../../', file), target);
}
