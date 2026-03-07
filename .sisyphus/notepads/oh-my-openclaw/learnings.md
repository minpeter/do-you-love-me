# Learnings

## [2026-03-01] Project Initialization

### Tech Stack
- TypeScript + Bun + commander.js + json5 + picocolors
- TDD approach: RED → GREEN → REFACTOR
- Single compiled binary via `bun build --compile --bytecode`

### Critical OpenClaw Constraints
- OpenClaw uses Zod `.strict()` validation → unknown config keys BREAK OpenClaw instantly
- Config path resolution order: `OPENCLAW_CONFIG_PATH` → `OPENCLAW_STATE_DIR/openclaw.json` → `~/.openclaw/openclaw.json`
- Workspace path: `agents.defaults.workspace` in config (default `~/.openclaw/workspace`)
- No hot config reload: user must run `openclaw gateway restart` after apply
- OpenClaw already has backup rotation (max 5 `.bak` files) → our backups MUST be in `~/.openclaw/oh-my-openclaw/backups/`

### Sensitive Fields Blocklist
- Top-level: `auth`, `env`, `meta`
- Dot-path: `gateway.auth`, `hooks.token`
- Glob: `models.providers.*.apiKey`, `channels.*.botToken`, `channels.*.token`

### Workspace Files (standard 7)
- AGENTS.md, SOUL.md, IDENTITY.md, USER.md, TOOLS.md, HEARTBEAT.md, BOOTSTRAP.md

### Deep Merge Semantics
- Scalar: override wins
- Object: recursive merge
- Array: override replaces entire array
- `null` in override: deletes key from base
- `undefined` in override: skips (base value preserved)
- Never mutates inputs

## [2026-03-01] Task 1 Scaffolding Notes

### Tooling Baseline
- `tsconfig.json` uses ESM + `moduleResolution: bundler` + strict mode for Bun-first TypeScript workflow.
- `package.json` scripts are aligned to two build paths: ESM bundle and compiled bytecode binary.

### Test + Verification Pattern
- Keep a minimal Bun test in `src/__tests__/placeholder.test.ts` to guarantee green CI baseline from day one.
- Save repeatable smoke-test evidence under `.sisyphus/evidence/` to preserve bootstrapping traceability.

## [2026-03-01] Task 2 Type Definitions + Constants

### Core Contracts
- Keep OpenClaw-facing types minimal and local (`PresetManifest`, `ResolvedPaths`, `ConfigSnapshot`) without importing upstream internal types.
- Export shared constants from `src/core/constants.ts` to centralize sensitive-path and workspace-file conventions.

### Testing Notes
- `as const` arrays require typed expected values in tests (`Array<(typeof SENSITIVE_FIELDS)[number]>`) to satisfy TypeScript overload checks.
- Assert both structural constraints (length checks) and exact semantic values for workspace files and path-based constants.

## [2026-03-01] Task 4 JSON5 Utilities

### JSON5 IO Patterns
- `readJson5` should return `{ raw, parsed, path }` and normalize empty/whitespace-only files to `parsed: {}`.
- Parse errors should preserve path context (`Invalid JSON5 in <path>`) to simplify CLI troubleshooting.
- Missing file errors should be normalized to `Cannot read file: <path>` instead of leaking raw fs error wording.

### Test Strategy
- Use per-test temp directories under `/tmp` with `mkdtemp` + `afterEach` cleanup to guarantee isolation.
- Verify write formatting through nested-object indentation checks to lock 2-space JSON5 stringify behavior.

## [2026-03-01] Task 5 Deep Merge Engine

### TDD Execution
- Start with `src/core/__tests__/merge.test.ts` first and run the single-file suite to confirm RED state when `../merge` is missing.
- Cover all required merge semantics with 10 tests, including mixed object/array overrides and frozen-input immutability checks.

### Merge Semantics Lock-in
- `null` in override deletes a key from the merged result (`'key' in result` becomes `false`).
- `undefined` in override is treated as no-op and preserves base values.
- Recursive merge is only for non-null, non-array objects on both sides; arrays are full replacement.

## Task 6 - Workspace MD File Resolver + Copier (2026-03-01)

### Patterns observed
- `WORKSPACE_FILES` in `constants.ts` is `as const` tuple — spread with `[...WORKSPACE_FILES]` for mutable array
- Bun test: `beforeEach`/`afterEach` with `mkdtemp` + `rm(dir, { recursive: true, force: true })` is the canonical temp dir pattern
- `fs.access(filePath)` throws on missing file — safe way to check existence without TOCTOU
- `fs.mkdir(destDir, { recursive: true })` silently handles already-existing dirs
- For dynamic imports inside tests, `const { mkdir } = await import('node:fs/promises')` works fine in Bun

### Config access pattern
```typescript
const agents = config.agents as Record<string, unknown> | undefined;
const defaults = agents?.defaults as Record<string, unknown> | undefined;
const workspace = defaults?.workspace as string | undefined;
return workspace ?? path.join(stateDir, 'workspace');
```
Cast each level separately — avoids deep nested casting errors.

### Test results
17 tests pass, 0 fail across 22 expect() calls in 114ms

## [2026-03-01] Task 8 Sensitive Fields Filter
- Path-segment traversal with wildcard  matches sensitive patterns without regex usage.
- Passing accumulated  during recursive descent is required for nested glob patterns like .
- Deep-cloning arrays in filter output preserves non-mutation guarantees while still filtering object branches.

## [2026-03-01] Task 8 Sensitive Fields Filter
- Path-segment traversal with wildcard `*` matches sensitive patterns without regex usage.
- Passing accumulated `keyPath` during recursive descent is required for nested glob patterns like `channels.*.token`.
- Deep-cloning arrays in filter output preserves non-mutation guarantees while still filtering object branches.

## [2026-03-01] Task 7 Backup Manager
- `createBackup` must create `backupsDir` recursively before `copyFile` for first-run reliability.
- ISO timestamp with `replace(/[:.]/g, '-')` produces filename-safe backup names while preserving sort order.
- `listBackups` can sort backup filenames lexicographically and reverse to get newest-first ordering.
- Byte-for-byte validation should use `Buffer` input/output in tests to guarantee binary-safe copy semantics.

## [2026-03-01] Task 10 Built-in Preset Templates
- Built-in preset directories use `workspaceFiles: ['AGENTS.md', 'SOUL.md']` and keep `config` channel-agnostic.
- `loadPreset('./src/presets/<name>')` smoke check passes for `default`, `developer`, `researcher`, `creative`.
- Keep tools allow-lists minimal and explicit per persona (`developer` and `researcher` only where needed).

## [2026-03-01] Import Path Extension Fix
- With `moduleResolution: bundler`, relative TypeScript imports should omit `.ts` extensions (`'./x'`, not `'./x.ts'`) to avoid TS5097.
- Scoped fix can be done by changing import specifier strings only; no logic changes are needed.

## Task 9 - Preset Loader (2026-03-01)

### Pattern: temp dir cleanup in tests
Use `afterEach` with `tempDirs.splice(0)` array pattern to track and clean all temp dirs:
```ts
const tempDirs: string[] = [];
async function createTempDir(prefix: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
  tempDirs.push(dir);
  return dir;
}
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
});
```

### Pattern: user presets override builtins
Use `Set<string>` of user preset names to filter builtins:
```ts
const userPresetNames = new Set(userPresets.map(p => p.name));
const filteredBuiltins = builtinPresets.filter(p => !userPresetNames.has(p.name));
return [...filteredBuiltins, ...userPresets];
```

### readJson5 returns ConfigSnapshot
`snapshot.parsed` is `Record<string, unknown>` — cast to `Partial<PresetManifest>` for validation.

### savePreset
`fs.mkdir(presetDir, { recursive: true })` handles nested dir creation.
