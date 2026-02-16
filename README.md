# D Clean

- **Clean up** development bloat: `node_modules`, Python venvs, old NVM Node versions, CocoaPods Pods
- **One command** — pick what to scan, then choose what to remove
- **Interactive** — tables by size, checkboxes to select, confirm before anything is moved
- **Safe** — moves to Trash (recoverable); only under your home directory

## What it does

- **Scans** only the directories you configure (no full-disk scan) for:
  - `node_modules` folders
  - Python venvs (`venv`, `.venv`, `env`, `virtualenv`)
  - NVM-installed Node.js versions
  - CocoaPods `Pods` folders
  - Rust `target` folders
  - Gradle/Android `build` & `.gradle` folders
  - C++ `cmake-build-debug` folders
  - Flutter `build` & `.dart_tool` folders
  - Xcode `DerivedData` & local `build` folders
- **Shows** sizes and last-used info in tables
- **History** — tracks how much space you've saved over time
- **Lets you choose** what to delete (with smart defaults: old items pre-selected)
- **Granular control** — delete entire categories or pick specific folders
- **Moves to Trash** only what you confirm (recoverable); only under your home directory

## Installation

**From npm** (when published):

```bash
npm install -g @codelynther/dclean
```

**From source** (clone and link):

```bash
git clone https://github.com/CodeLynther/dclean.git
cd dclean
npm install
npm link
```

Then run `dclean` from anywhere. Requires **Node.js 20+**.

## Setup (first run)

D Clean does **not** scan your whole disk. You choose **where** to scan (config) and **what** to scan (flags).

**Option 1 – interactive (recommended)**

Run `dclean --init` to set scan paths. You’ll be prompted to:

- **Choose common paths** (e.g. ~/Desktop, ~/projects, ~/dev, ~/code)
- **Add a custom path** (e.g. `~/my-projects` or any full path)
- **Save to config** so the same paths are used next time

Your selection is written to `~/.dclean/config.json`.

**Option 2 – config manually**

Create `~/.dclean/config.json`:

```json
{
  "scanPaths": ["~/projects", "~/dev", "~/Desktop"]
}
```

Use `~` for home or absolute paths. Multiple paths are scanned and results are merged.

## Usage

You must tell D Clean **what** to scan; nothing runs by default:

```bash
dclean --node-modules         # Scan node_modules (in your config paths)
dclean --python               # Scan Python venvs
dclean --nvm                  # Scan NVM versions (~/.nvm)
dclean --pods                 # Scan CocoaPods Pods
dclean --rust                 # Scan Rust target directories
dclean --gradle               # Scan Gradle/Android build directories
dclean --cmake                # Scan C++ CMake build directories
dclean --flutter              # Scan Flutter build directories
dclean --xcode                # Scan Xcode DerivedData & build directories
dclean --ai-dev-tools         # Scan AI dev tool data (Cursor, Claude, Antigravity); scan-only, no deletion offered
dclean --node-modules --pods  # Combine as needed
dclean --path ~/projects      # Scan this directory (overrides config; must exist)
dclean --dry-run              # Show what would be moved to Trash (no changes)
dclean --no-interactive       # Only scan and display, no cleanup prompts
dclean --yes                  # Auto-confirm move to Trash (use with caution)
dclean --verbose              # Debug output and full stack on errors
dclean --init                 # Interactively set scan paths and save to ~/.devclean.json
dclean --history              # Show cleanup history and total space saved
dclean --help                 # Show all options
```

Results are **sorted by size (largest first)**. Items are **moved to Trash**, not permanently deleted.

## For developers

- **Exit codes:** `0` = success, `1` = error, `130` = cancelled (e.g. Ctrl+C).
- **--path:** Must be an existing, readable directory; `~` is expanded. Invalid path exits with a clear error.
- **Config paths:** Non-existent or unreadable paths in `~/.dclean/config.json` are skipped with a warning; if none are valid, the CLI exits with an error.
- **--verbose:** Use when debugging; prints stack traces on errors and optional debug logs.
- **Prompts:** Ctrl+C and EOF are handled cleanly (exit 130 or error message).

## Safety

- Move-to-Trash is **only allowed under your home directory**. You can restore from Trash.
- The **root** of protected folders (Desktop, Documents, `.ssh`, `Library`) cannot be deleted; contents inside them (e.g. `~/Desktop/work/project/node_modules`) can be cleaned.
- You must **confirm** before anything is moved to Trash (unless you pass `--yes`).
- Use **`--dry-run`** first to see exactly what would be moved.

## Platform support

| Platform | Supported |
|----------|-----------|
| **macOS** | ✅ Yes |
| **Linux** | ✅ Yes |
| **Windows** | ❌ Not supported |

## Requirements

- **Node.js 20+** (required by move-to-Trash dependency)
- **macOS or Linux** (Windows not supported)

## Testing

Run the test suite (requires Node 20+):

```bash
npm test
```

- **Unit tests** (`test/safeDelete.test.js`): `validatePathForDeletion`, `getProtectedPaths`, and `safeDelete` (with mocked trash and `os.homedir`).
- **Integration tests** (`test/scanners.integration.test.js`, `test/scanners_extension.integration.test.js`):
    - NodeModules, PythonVenv, and Pods scanners.
    - Rust, Gradle, CMake, Flutter, and Xcode scanners.
    - Tests run against temporary directories with dummy projects.

## Dependencies

We keep the dependency set small. See [DEPENDENCIES.md](DEPENDENCIES.md) for what each package does and possible alternatives.

## License

MIT
