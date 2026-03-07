# Architectural Decisions

## [2026-03-01] Project Start

- CLI name: `oh-my-openclaw` (full name, not abbreviated)
- Preset format: JSON5 (same as OpenClaw config)
- State storage: `~/.openclaw/oh-my-openclaw/presets/` and `~/.openclaw/oh-my-openclaw/backups/`
- MVP scope: Local presets only (no GitHub registry)
- Preset structure: directory-based (each preset = a directory with preset.json5 + MD files)
- PRESET_MANIFEST_FILENAME: `preset.json5`
- JSON5 comment loss: MVP accepts this limitation (full backup created before apply)
- Built-in preset embedding: Bun `import ... with { type: 'file' }` for compiled binary
- No interactive prompts in MVP (all flags-based)
- No eslint/prettier (minimal tooling)
- Do NOT install deepmerge-ts or other merge libraries (write our own)
- JSON5 utility contract: empty files parse as `{}` and file read/parse failures are rethrown with user-facing, path-inclusive messages.

## [2026-03-01] Task 5 Deep Merge Engine

- Implemented `deepMerge(base, override)` in `src/core/merge.ts` with plain-object recursion gate (`typeof === 'object'`, non-null, non-array).
- Kept array behavior as full override replacement (no concatenation) to align with OpenClaw merge patch expectations.
- Chosen semantics: `override[key] === null` deletes from result, `override[key] === undefined` skips change.
- Kept implementation intentionally narrow (no circular refs, Date/RegExp/Map/Set handling) per task scope.

## [2026-03-01] Task 7 Backup Manager

- Implemented backup naming as `openclaw.json.<ISO timestamp>.bak` under dedicated backups dir to avoid any collision with OpenClaw native `.bak` rotation in the config directory.
- Kept `listBackups` scope intentionally strict to `.bak` entries only and return full absolute paths sorted newest-first.

## [2026-03-01] Task 8 Sensitive Fields Filter
- Implemented  using dot-part comparison with  wildcard to satisfy no-regex constraint.
-  recursively filters only object records and clones arrays/items to avoid input mutation.

## [2026-03-01] Task 8 Sensitive Fields Filter
- Implemented `matchesPattern(path, pattern)` using dot-part comparison with `*` wildcard to satisfy no-regex constraint.
- `filterSensitiveFields` recursively filters only object records and clones arrays/items to avoid input mutation.

## [2026-03-01] Task 10 Built-in Preset Templates
- Added four built-in presets under `src/presets/` (`default`, `developer`, `researcher`, `creative`) with identical manifest schema and persona-specific identity/model/tool defaults.
- Standardized built-in workspace scaffolding to exactly `AGENTS.md` + `SOUL.md` for all templates.

## [2026-03-01] Import Path Extension Fix
- Enforced project convention for relative imports: omit `.ts` extension in source files to stay compatible with TypeScript `bundler` resolution.
