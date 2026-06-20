# D Clean

[![npm version](https://img.shields.io/npm/v/dclean-cli)](https://www.npmjs.com/package/dclean-cli)
[![npm downloads](https://img.shields.io/npm/dm/dclean-cli)](https://www.npmjs.com/package/dclean-cli)
[![website](https://img.shields.io/website?url=https://codelynther.github.io/dclean/)](https://codelynther.github.io/dclean/)
[![CI](https://github.com/CodeLynther/dclean/actions/workflows/ci.yml/badge.svg)](https://github.com/CodeLynther/dclean/actions/workflows/ci.yml)

Website: [codelynther.github.io/dclean](https://codelynther.github.io/dclean/)

CLI to find and remove development bloat. Scans configured paths, shows sizes in tables, and moves selected items to Trash.

## What it scans

- `node_modules`
- Python venvs (`venv`, `.venv`, `env`, `virtualenv`)
- NVM Node.js versions
- CocoaPods `Pods`
- Rust `target`
- Gradle/Android `build` and `.gradle`
- C++ `cmake-build-debug`
- Flutter `build` and `.dart_tool`
- Xcode `DerivedData` and local `build`
- AI dev tool data (Cursor, Claude, Antigravity): scan only, no deletion

## Installation

```bash
npm install -g dclean-cli
```

Alternative install (same CLI):

```bash
npm install -g @codelynther/dclean
```

Try without installing:

```bash
npx dclean-cli --init
npx dclean-cli --node-modules --dry-run
```

From source:

```bash
git clone https://github.com/CodeLynther/dclean.git
cd dclean
npm install
npm link
```

Requires **Node.js 20+**. macOS and Linux only.

## Setup

D Clean does not scan your whole disk. Set scan paths once, then pass flags for what to scan.

**Interactive setup**

```bash
dclean --init
```

Paths are saved to `~/.dclean/config.json`. Legacy `~/.devclean.json` is migrated automatically.

**Manual config**

```json
{
  "scanPaths": ["~/projects", "~/dev", "~/Desktop"]
}
```

## Usage

Nothing runs until you pass a scanner flag:

```bash
dclean --node-modules
dclean --python
dclean --nvm
dclean --pods
dclean --rust
dclean --gradle
dclean --cmake
dclean --flutter
dclean --xcode
dclean --ai-dev-tools
dclean --node-modules --pods
dclean --path ~/projects
dclean --dry-run
dclean --no-interactive
dclean --yes
dclean --verbose
dclean --init
dclean --monitor --silent
dclean --history
dclean --help
```

Results are sorted by size. Confirmed items go to Trash, not permanent delete.

## Monitor mode

Scan on a schedule and get a system notification when bloat crosses thresholds. Monitor mode never deletes files.

**Setup:** run `dclean --init` once before using monitor in cron. Monitor needs configured scan paths (or pass `--path`).

```bash
dclean --monitor --silent
```

Defaults with `--monitor`:

- Alert if one category (e.g. Xcode DerivedData) exceeds 5 GB
- Alert if total reclaimable space exceeds 10 GB

Cron example (Sunday 6 PM):

```bash
0 18 * * 0 /path/to/node /path/to/dclean --monitor --silent
```

Find paths with `which node` and `which dclean`. Cron does not load nvm, so use absolute paths.

Scope the monitor to specific scanners:

```bash
dclean --monitor --xcode --nvm --silent
```

## Safety

- Deletes only under your home directory
- Protected roots (Desktop, Documents, `.ssh`, `Library`) cannot be removed; contents inside them can
- Confirmation required unless `--yes`
- Use `--dry-run` to preview

## Platform support

| Platform | Supported |
|----------|-----------|
| macOS | Yes |
| Linux | Yes |
| Windows | No |

## Testing

```bash
npm test
```

## Dependencies

See [DEPENDENCIES.md](DEPENDENCIES.md).

## License

MIT
