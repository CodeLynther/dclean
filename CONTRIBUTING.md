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

## Technical Architecture

D Clean is designed as a modular, registry-driven CLI tool.

### Scanner Registry
All scanning logic is encapsulated in **Scanner Classes** inheriting from `BaseScanner`. Scanners are registered in `src/scanners/index.js` and orchestrated via `runAllScans`. This decoupling allows for easy addition of new scan types (e.g., specific language build artifacts) without modifying the main delivery loop.

### Safety Model
- **Non-Destructive**: The tool uses the `trash` package to move folders to the system Trash rather than performing a permanent `rm -rf`.
- **Validation Path**: Every path is validated against `isPathSafeForDeletion` in `src/cleaner/safeDelete.js`, preventing accidental modifications to system or protected directories (e.g., `~/.ssh`, `/usr/local`).
- **Interactive First**: The CLI defaults to interactive confirmation, requiring explicit user intent for every deletion action.

### Performance
- **Asynchronous Walking**: Directory tree traversal is performed asynchronously using native `fs.promises` to maximize I/O throughput.
- **Size Caching**: Directory sizes are cached during a single session to prevent redundant calculations during the filtering and confirmation phases.

