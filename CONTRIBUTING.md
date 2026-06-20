# Contributing to D Clean

Thanks for your interest in contributing.

## Development setup

```bash
git clone https://github.com/CodeLynther/dclean.git
cd dclean
npm install
npm link   # optional: run `dclean` locally
```

Requires **Node.js 20+**.

## Code quality

- **Lint:** `npm run lint`
- **Tests:** `npm test`
- **Smoke test:** `dclean --help` and `dclean --node-modules --no-interactive --path .`

Please run `npm run lint` and `npm test` before submitting a PR.

## Submitting changes

1. Open an issue or pick an existing one.
2. Fork the repo, create a branch, and make your changes.
3. Ensure lint and tests pass.
4. Open a pull request with a clear description of the change.

## Code style

- The project uses ESLint and Prettier. Run `npm run lint` to check.
- Prefer existing patterns in the codebase (e.g. CommonJS, async/await, chalk for output).

## npm packages

This repo publishes two npm packages on each release:

| Package | Role |
|---------|------|
| `dclean-cli` | Public install name (`packages/dclean-cli`, thin wrapper) |
| `@codelynther/dclean` | Core package with all source code |

Keep versions in sync. The publish workflow releases `@codelynther/dclean` first, then `dclean-cli`.

`packages/dclean-cli/README.md` and `LICENSE` are symlinks to the repo root. `prepublishOnly` copies them to real files before publish so npm includes the readme on the registry page.

## Technical architecture

D Clean is a modular, registry-driven CLI tool.

### Scanner registry

Scanning logic lives in scanner classes extending `BaseScanner`. Scanners are registered in `src/scanners/index.js` and run via `runAllScans`.

### Monitor mode

`--check` scans configured paths and sends a system notification when bloat crosses thresholds. It never deletes files. Cron usage requires scan paths from `dclean --init` (or `--path`).

### Safety model

- **Non-destructive:** uses the `trash` package to move folders to Trash, not `rm -rf`.
- **Path validation:** every path is checked by `validatePathForDeletion` in `src/cleaner/safeDelete.js` before deletion.
- **Interactive first:** the CLI defaults to interactive confirmation unless `--yes` is passed.

### Performance

- **Async walking:** directory traversal uses `fs.promises`.
- **Size caching:** directory sizes are cached during a scan session.
