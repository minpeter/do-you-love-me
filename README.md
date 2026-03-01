# apex

OpenClaw configuration preset manager.

## What is this?
apex is a CLI utility for managing configuration presets for [OpenClaw](https://github.com/minpeter/openclaw), a self-hosted AI agent gateway. It allows you to switch between different agent personalities, toolsets, and model configurations with a single command by bundling `openclaw.json` overrides and workspace markdown files.

## Quick Start

### Installation

1. Clone the repository:
```bash
   git clone https://github.com/minpeter/apex.git
   cd apex
```

2. Copy the contents of `setup.md` and paste it directly into your preferred AI coding agent:
   - [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
   - [OpenCode](https://github.com/nicepkg/opencode)
   - [Codex](https://github.com/openai/codex)
   - Or any other coding agent

   The agent will handle dependency installation, building, and initial configuration automatically.
```bash
   # Example: using Claude Code
   cat setup.md | claude
```

> **Note**: [Bun](https://bun.sh) is required as a prerequisite. Make sure it's installed before running setup.

### Basic Workflow
1. **List** available presets: `apex list`
2. **Diff** a preset against your current config: `apex diff apex`
3. **Apply** the preset: `apex apply apex`
4. **Install** apex quickly: `apex install`
5. **Export** your current setup as a new preset: `apex export my-custom-setup`
6. **Apply** a preset from GitHub: `apex apply minpeter/demo-researcher`

## Commands

### list
Lists all built-in and user-defined presets.
```bash
apex list
```
**Example Output:**
```
Available presets:

  apex [builtin]
    All-in-one power assistant with full capabilities (all-in-one, power, assistant)
    v1.0.0
```

### apply
Applies a preset to your OpenClaw configuration. It merges the preset's JSON config into your `openclaw.json`, copies any bundled workspace files (like `AGENTS.md`) to your `.openclaw` directory, and installs any bundled skills to `~/.agents/skills/`. The `<preset>` argument can be a local preset name, a GitHub shorthand (`owner/repo`), or a full GitHub URL (`https://github.com/owner/repo`).
```bash
apex apply <preset> [options]
```
- **Arguments:** `<preset>` - Name of the preset to apply.
- **Flags:**
  - `--dry-run`: Show what would change without making any modifications.
  - `--no-backup`: Skip creating a backup of your current configuration (default: backups are created).
  - `--clean`: Remove existing config and workspace files before applying (clean install).
  - `--force`: Re-download a remote preset even if it's already cached locally.

### install
Installs the apex preset (shortcut for `apply apex`).
```bash
apex install [options]
```
- **Flags:**
  - `--dry-run`: Show what would change without making any modifications.
  - `--no-backup`: Skip creating a backup.
  - `--clean`: Remove existing config and workspace files before applying.

### export
Saves your current `openclaw.json` and workspace markdown files as a new reusable preset.
```bash
apex export <name> [options]
```
- **Arguments:** `<name>` - Name for the new preset.
- **Flags:**
  - `--description <desc>`: Add a short description.
  - `--version <ver>`: Specify a version (default: 1.0.0).
  - `--force`: Overwrite an existing preset with the same name.

### diff
Shows a structural comparison between your current configuration and a specific preset.
```bash
apex diff <preset> [options]
```
- **Flags:**
  - `--json`: Output the diff in JSON format.

## Built-in Presets

| Name | Description | Use Case |
| :--- | :--- | :--- |
| **apex** | All-in-one power assistant with full capabilities | The single built-in preset with 100% of all capabilities. |

## How It Works

### Deep Merge Semantics
When applying a preset, apex uses a deep merge strategy for `openclaw.json`:
- **Scalars (String, Number, Boolean):** Overwrite existing values.
- **Objects:** Merged recursively.
- **Arrays:** Entirely replaced by the preset's array.
- **Null:** Deletes the key from the target configuration.

### Sensitive Field Protection
To prevent accidental exposure of secrets, certain fields are filtered during exports and diffs. These include:
- `auth`, `env`, `meta`
- `gateway.auth`
- `hooks.token`
- `models.providers.*.apiKey`
- `channels.*.botToken`, `channels.*.token`

### Automatic Backups
Before applying changes, apex creates timestamped backups in `~/.openclaw/apex/backups/` (for `openclaw.json`, plus workspace backups when workspace files are replaced).

## Creating Custom Presets
Presets are stored in `~/.openclaw/apex/`. You can create them manually by making a directory with a `preset.json5` file and any accompanying markdown files (`AGENTS.md`, `SOUL.md`, etc.).

### Preset Format Example (`preset.json5`)
```json5
{
  name: "my-preset",
  description: "My custom configuration",
  version: "1.0.0",
  config: {
    identity: {
      name: "CustomBot",
      emoji: "🤖"
    }
  },
  workspaceFiles: ["AGENTS.md"]
}
```

## Remote Presets

You can apply presets directly from public GitHub repositories without any local setup.

### Usage

```bash
# Apply by shorthand (owner/repo)
apex apply minpeter/demo-researcher

# Apply by full GitHub URL
apex apply https://github.com/minpeter/demo-researcher

# Force re-download (ignores local cache)
apex apply minpeter/demo-researcher --force
```

Remote presets are automatically cached as user presets at `~/.openclaw/apex/presets/owner--repo/`. Subsequent applies reuse the cached version unless `--force` is specified.

> **Note**: Only public GitHub repositories are supported. Private repos require authentication which is not currently supported.

## Skills in Presets

Presets can bundle OpenClaw agent skills. When you apply a preset, any skills listed in its `skills` field are automatically copied to `~/.agents/skills/`, making them available to `openclaw skills list`.

### Collision Handling

If a skill already exists at the target location:
- **Interactive (TTY)**: You will be prompted to confirm overwrite (`[y/N]`).
- **Non-interactive (non-TTY / CI)**: The existing skill is skipped with a warning.
- **`--force` flag**: Overwrites existing skills without prompting.

### Preset Format with Skills

```json5
{
  name: "my-preset",
  description: "My preset with skills",
  version: "1.0.0",
  skills: ["my-skill"],  // skill directory names under skills/
  config: { ... },
  workspaceFiles: ["AGENTS.md"]
}
```

Skills are stored in the preset's `skills/<name>/` directory and must contain a `SKILL.md` file.

## Development
- **Prerequisites:** Bun
- **Install dependencies:** `bun install`
- **Run lint:** `bun run lint`
- **Run tests:** `bun test`
- **Type check:** `bun run typecheck`
- **Build binary:** `bun run build:compile`

## Architecture
- `src/core/`: Core logic including merge strategy, backup system, and sensitive field filtering.
- `src/commands/`: CLI command implementations (`list`, `apply`, `export`, `diff`, `install`).
- `src/presets/`: Built-in preset templates and manifests.

## License
MIT
