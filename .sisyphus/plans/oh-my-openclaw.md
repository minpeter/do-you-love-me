# oh-my-openclaw: OpenClaw Configuration Preset Manager

## TL;DR

> **Quick Summary**: Build a CLI tool (`oh-my-openclaw`) that manages OpenClaw configuration presets — bundles of `openclaw.json` overrides + workspace markdown files (AGENTS.md, SOUL.md, etc.) that can be listed, applied (deep merge), exported, and diffed.
> 
> **Deliverables**:
> - `oh-my-openclaw list` — show available presets
> - `oh-my-openclaw apply <preset>` — deep merge preset into live config + copy workspace MD files
> - `oh-my-openclaw export <name>` — extract current config into a new preset
> - `oh-my-openclaw diff [preset]` — show diff between current config and preset
> - 4 built-in presets: default, developer, researcher, creative
> - Single binary via `bun build --compile`
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 4 waves
> **Critical Path**: Task 1 → Task 3 → Task 5 → Task 9 → Task 10 → Task 13 → F1-F4

---

## Context

### Original Request
Build "oh-my-openclaw" — an OpenClaw settings preset manager. `oh-my-openclaw apply <preset>` applies CREED, skills, memory, MCP settings in one shot.

### Interview Summary
**Key Discussions**:
- OpenClaw is a personal AI agent gateway (not just a coding tool) — config at `~/.openclaw/openclaw.json` (JSON5)
- Presets include BOTH JSON5 config overrides AND workspace MD files (AGENTS.md, SOUL.md, IDENTITY.md, USER.md, TOOLS.md, HEARTBEAT.md, BOOTSTRAP.md)
- Deep merge strategy: only preset-defined sections merge into existing config
- CLI name: `oh-my-openclaw` (full name, not abbreviated)
- Tech stack: TypeScript + Bun + commander.js + json5
- TDD approach with bun test
- MVP: local presets only (no GitHub registry)

**Research Findings**:
- OpenClaw validates config with Zod `.strict()` — unknown keys cause INSTANT errors. Cannot add custom metadata keys to openclaw.json.
- Workspace path is dynamic: `agents.defaults.workspace` in config (default `~/.openclaw/workspace`)
- Config path resolved via: `OPENCLAW_CONFIG_PATH` → `OPENCLAW_STATE_DIR` → `~/.openclaw/openclaw.json`
- OpenClaw already has backup rotation (max 5 `.bak` files) — our backups must be in separate directory
- ClawHub exists for skills registry but NOT for config presets — this is our niche
- No hot config reload — user must run `openclaw gateway restart` after apply
- `env` section can contain API keys directly — must be in sensitive fields blocklist
- Bun static asset embedding via `import ... with { type: 'file' }` for built-in presets

### Metis Review
**Identified Gaps** (addressed):
- Zod .strict() compatibility: preset keys must all be valid OpenClaw config keys → added validation
- Dynamic workspace path: must read config first to resolve workspace location → added to apply/export logic
- Config path resolution must respect env vars → added OPENCLAW_CONFIG_PATH/OPENCLAW_STATE_DIR support
- Sensitive fields blocklist was incomplete → expanded to include env.**, meta.**, auth.**, gateway.auth.**, hooks.token, models.providers.*.apiKey
- JSON5 comment loss on write: MVP accepts loss with strong warning + full backup; merge abstracted behind interface for future $include-based approach
- No gateway restart notification → must print reminder after apply
- Built-in preset embedding: use Bun `import with { type: 'file' }` not filesystem reads

---

## Work Objectives

### Core Objective
Build a TypeScript+Bun CLI tool that manages OpenClaw configuration presets, enabling users to switch between curated configuration bundles with one command.

### Concrete Deliverables
- `oh-my-openclaw` CLI binary (compilable via `bun build --compile`)
- 4 CLI commands: `list`, `apply`, `export`, `diff`
- 4 built-in presets: `default`, `developer`, `researcher`, `creative`
- Deep merge engine with sensitive field protection
- Automatic backup system
- Full test suite (TDD)

### Definition of Done
- [x] `oh-my-openclaw list` shows built-in + user presets with metadata
- [x] `oh-my-openclaw apply developer` merges preset into current config + copies MD files to workspace
- [x] `oh-my-openclaw export my-setup` creates preset from current config + workspace MD files
- [x] `oh-my-openclaw diff developer` shows colorized diff of current vs preset config
- [x] All auth/env/meta/credential fields are excluded from export and never overwritten by apply
- [x] Backup created before every apply
- [x] `bun test` passes with all tests green
- [x] Single binary compiles via `bun build --compile`

### Must Have
- Config path resolution respects `OPENCLAW_CONFIG_PATH` and `OPENCLAW_STATE_DIR` environment variables
- Workspace path dynamically resolved from config (`agents.defaults.workspace`)
- All preset keys validated against known OpenClaw config schema (no unknown keys that would break Zod .strict())
- Automatic backup before any destructive operation
- Sensitive fields blocklist: `auth.**`, `env.**`, `meta.**`, `gateway.auth.**`, `hooks.token`, `models.providers.*.apiKey`, `channels.*.botToken`, `channels.*.token`
- User notification after apply: "Run `openclaw gateway restart` to apply changes"
- Deep merge semantics: scalar = override, object = recursive merge, array = replace, null = delete key
- Built-in presets embedded in compiled binary

### Must NOT Have (Guardrails)
- NEVER read/write/modify `auth-profiles.json`
- NEVER read/write/modify `credentials/` directory
- NEVER add custom keys to `openclaw.json` (Zod .strict() would break OpenClaw)
- NEVER include API keys, tokens, or passwords in presets or exports
- NEVER delete or modify files without creating a backup first
- NO GitHub registry / remote preset downloading (post-MVP)
- NO OpenClaw plugin integration (standalone CLI only)
- NO over-abstraction: keep it simple, one purpose per module
- NO interactive prompts in MVP (all commands are non-interactive, use flags)
- NO excessive JSDoc comments or generic variable names (data/result/item/temp)

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (greenfield)
- **Automated tests**: TDD (test first → implement → refactor)
- **Framework**: bun test (built-in, zero config)
- **Each task follows**: RED (failing test) → GREEN (minimal impl) → REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **CLI commands**: Use Bash — Run `oh-my-openclaw` commands, assert stdout/stderr, check exit codes
- **File operations**: Use Bash — Check file existence, content, permissions
- **Library/Module**: Use Bash (bun REPL) — Import, call functions, compare output

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — start immediately, all independent):
├── Task 1: Project scaffolding + tooling config [quick]
├── Task 2: Type definitions + constants [quick]
├── Task 3: Config path resolver module [quick]
├── Task 4: JSON5 read/write utilities [quick]
└── Task 5: Deep merge engine (TDD) [deep]

Wave 2 (Core modules — after Wave 1):
├── Task 6: Workspace MD file resolver + copier (depends: 3, 4) [unspecified-high]
├── Task 7: Backup manager (depends: 3, 4) [quick]
├── Task 8: Sensitive fields filter (depends: 2) [quick]
├── Task 9: Preset loader + validator (depends: 2, 4, 5) [unspecified-high]
└── Task 10: Built-in preset templates (depends: 2) [quick]

Wave 3 (CLI commands — after Wave 2):
├── Task 11: `list` command (depends: 9, 10) [quick]
├── Task 12: `apply` command (depends: 5, 6, 7, 8, 9) [deep]
├── Task 13: `export` command (depends: 6, 8, 9) [unspecified-high]
├── Task 14: `diff` command (depends: 4, 9) [unspecified-high]
└── Task 15: CLI entry point + commander setup (depends: 11, 12, 13, 14) [quick]

Wave 4 (Build + Polish — after Wave 3):
├── Task 16: Binary compilation + asset embedding (depends: 15) [quick]
└── Task 17: Integration tests + edge cases (depends: 15, 16) [deep]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 3 → Task 5 → Task 9 → Task 12 → Task 15 → Task 16 → F1-F4
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 5 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 3,4,5,6,7,8,9,10,11-17 | 1 |
| 2 | — | 5,8,9,10 | 1 |
| 3 | — | 6,7,9,12,13 | 1 |
| 4 | — | 6,7,9,14 | 1 |
| 5 | — | 9,12 | 1 |
| 6 | 3,4 | 12,13 | 2 |
| 7 | 3,4 | 12 | 2 |
| 8 | 2 | 12,13 | 2 |
| 9 | 2,4,5 | 11,12,13,14 | 2 |
| 10 | 2 | 11,16 | 2 |
| 11 | 9,10 | 15 | 3 |
| 12 | 5,6,7,8,9 | 15 | 3 |
| 13 | 6,8,9 | 15 | 3 |
| 14 | 4,9 | 15 | 3 |
| 15 | 11,12,13,14 | 16,17 | 3 |
| 16 | 15 | 17 | 4 |
| 17 | 15,16 | F1-F4 | 4 |

### Agent Dispatch Summary

- **Wave 1**: **5 tasks** — T1 → `quick`, T2 → `quick`, T3 → `quick`, T4 → `quick`, T5 → `deep`
- **Wave 2**: **5 tasks** — T6 → `unspecified-high`, T7 → `quick`, T8 → `quick`, T9 → `unspecified-high`, T10 → `quick`
- **Wave 3**: **5 tasks** — T11 → `quick`, T12 → `deep`, T13 → `unspecified-high`, T14 → `unspecified-high`, T15 → `quick`
- **Wave 4**: **2 tasks** — T16 → `quick`, T17 → `deep`
- **FINAL**: **4 tasks** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs


- [x] 1. Project Scaffolding + Tooling Config

  **What to do**:
  - Initialize Bun project: `bun init` with `name: "oh-my-openclaw"`, `type: "module"`
  - Create `package.json` with scripts: `build`, `build:compile`, `test`, `typecheck`, `clean`
  - Create `tsconfig.json` with strict mode, ESM output, target ES2022
  - Create `.gitignore` (node_modules, dist, .DS_Store, *.bak)
  - Create directory structure:
    ```
    src/
    ├── cli.ts            # CLI entry point
    ├── commands/         # Command implementations
    ├── core/             # Core logic modules
    ├── presets/          # Built-in preset files
    └── __tests__/        # Test files (colocated also ok)
    ```
  - Install dependencies: `commander`, `json5`, `picocolors` (for colored output)
  - Install devDependencies: `@types/bun`
  - Write a smoke test: `bun test` runs and passes with a placeholder test

  **Must NOT do**:
  - Do NOT add eslint/prettier — keep tooling minimal
  - Do NOT add complex build pipelines — single `bun build` command
  - Do NOT install `deepmerge-ts` or other merge libraries — we write our own

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4, 5)
  - **Blocks**: All subsequent tasks
  - **Blocked By**: None

  **References**:
  - `openclaw/openclaw` `package.json` — TypeScript + Bun project structure pattern
  - Bun docs: https://bun.sh/docs/cli/build — `bun build --compile` flags and options
  - commander.js: https://github.com/tj/commander.js — CLI parsing library

  **Acceptance Criteria**:
  - [x] `bun test` runs and exits 0 (1 placeholder test passes)
  - [x] `bun run typecheck` exits 0 (no TS errors)
  - [x] `package.json` has `build:compile` script with `--compile --bytecode`
  - [x] All 4 directories exist: `src/commands/`, `src/core/`, `src/presets/`, `src/__tests__/`

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Project builds and tests pass
    Tool: Bash
    Preconditions: Fresh clone of the repo
    Steps:
      1. Run `bun install`
      2. Run `bun test`
      3. Run `bun run typecheck`
    Expected Result: All exit code 0
    Failure Indicators: Non-zero exit code, missing dependencies
    Evidence: .sisyphus/evidence/task-1-smoke-test.txt

  Scenario: Directory structure is correct
    Tool: Bash
    Steps:
      1. Run `ls -R src/`
      2. Assert directories exist: commands/, core/, presets/, __tests__/
    Expected Result: All 4 directories listed
    Evidence: .sisyphus/evidence/task-1-dirs.txt
  ```

  **Commit**: YES
  - Message: `feat(init): project scaffolding with bun, typescript, commander`
  - Files: `package.json, tsconfig.json, .gitignore, src/**`
  - Pre-commit: `bun test && bun run typecheck`

---

- [x] 2. Type Definitions + Constants

  **What to do**:
  - Create `src/core/types.ts` with all shared types:
    ```typescript
    // Preset manifest (metadata + config overrides)
    interface PresetManifest {
      name: string;
      description: string;
      version: string;
      author?: string;
      tags?: string[];
      // The config overrides (partial openclaw.json)
      config?: Record<string, unknown>;
      // List of workspace files included in this preset
      workspaceFiles?: string[];
    }
    
    // Resolved paths for the current OpenClaw installation
    interface ResolvedPaths {
      configPath: string;     // path to openclaw.json
      stateDir: string;       // ~/.openclaw/
      workspaceDir: string;   // resolved from config
      presetsDir: string;     // ~/.openclaw/oh-my-openclaw/presets/
      backupsDir: string;     // ~/.openclaw/oh-my-openclaw/backups/
    }
    
    // Config snapshot for diff/merge operations
    interface ConfigSnapshot {
      raw: string;           // original file content (for comment preservation)
      parsed: Record<string, unknown>;  // parsed JSON5 object
      path: string;          // file path
    }
    ```
  - Create `src/core/constants.ts` with:
    - `SENSITIVE_FIELDS`: blocklist array — `['auth', 'env', 'meta', 'gateway.auth', 'hooks.token']` plus glob patterns for `models.providers.*.apiKey`, `channels.*.botToken`, `channels.*.token`
    - `WORKSPACE_FILES`: `['AGENTS.md', 'SOUL.md', 'IDENTITY.md', 'USER.md', 'TOOLS.md', 'HEARTBEAT.md', 'BOOTSTRAP.md']`
    - `DEFAULT_CONFIG_PATH`: `~/.openclaw/openclaw.json`
    - `OH_MY_OPENCLAW_DIR`: `oh-my-openclaw`
    - `PRESET_MANIFEST_FILENAME`: `preset.json5`
  - Write tests: type assertions compile, constants are non-empty

  **Must NOT do**:
  - Do NOT add runtime validation (Zod) for our own types — keep it simple
  - Do NOT import OpenClaw's types — we define our own minimal subset

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4, 5)
  - **Blocks**: Tasks 5, 8, 9, 10
  - **Blocked By**: None

  **References**:
  - OpenClaw config structure: `~/.openclaw/openclaw.json` — sections: identity, agents, channels, tools, skills, session, gateway, logging, hooks, cron, env, meta, auth
  - OpenClaw workspace files: AGENTS.md, SOUL.md, IDENTITY.md, USER.md, TOOLS.md, HEARTBEAT.md, BOOTSTRAP.md
  - Sensitive fields: auth-profiles.json is separate file; env section can contain plaintext API keys; meta section is auto-managed

  **Acceptance Criteria**:
  - [x] `bun run typecheck` passes with all types defined
  - [x] SENSITIVE_FIELDS array contains at minimum: auth, env, meta, gateway.auth, hooks.token
  - [x] WORKSPACE_FILES array contains all 7 standard workspace files

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Types are importable and constants are correct
    Tool: Bash (bun)
    Steps:
      1. Run `bun -e "import { SENSITIVE_FIELDS, WORKSPACE_FILES } from './src/core/constants'; console.log(SENSITIVE_FIELDS.length >= 5, WORKSPACE_FILES.length === 7)"`
    Expected Result: stdout contains "true true"
    Evidence: .sisyphus/evidence/task-2-types-check.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `feat(core): add type definitions and constants`
  - Files: `src/core/types.ts, src/core/constants.ts`
  - Pre-commit: `bun run typecheck`

---

- [x] 3. Config Path Resolver Module

  **What to do**:
  - Create `src/core/config-path.ts` that resolves OpenClaw config file location
  - Resolution order (matching OpenClaw's own logic):
    1. `OPENCLAW_CONFIG_PATH` env var (direct path to config file)
    2. `OPENCLAW_STATE_DIR` env var + `/openclaw.json`
    3. `~/.openclaw/openclaw.json` (default)
  - Also resolves:
    - `stateDir`: directory containing config (e.g., `~/.openclaw/`)
    - `presetsDir`: `{stateDir}/oh-my-openclaw/presets/`
    - `backupsDir`: `{stateDir}/oh-my-openclaw/backups/`
  - Auto-create `presetsDir` and `backupsDir` if they don't exist (`mkdir -p` equivalent)
  - Export `resolveOpenClawPaths(): Promise<ResolvedPaths>` function
  - Write TDD tests:
    - Default path resolves to `~/.openclaw/openclaw.json`
    - `OPENCLAW_CONFIG_PATH` takes highest priority
    - `OPENCLAW_STATE_DIR` computes config path correctly
    - presetsDir/backupsDir derived from stateDir

  **Must NOT do**:
  - Do NOT implement legacy path resolution (`.clawdbot/`, `.moltbot/`) — that's post-MVP
  - Do NOT validate that config file actually exists — caller handles that

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4, 5)
  - **Blocks**: Tasks 6, 7, 9
  - **Blocked By**: None

  **References**:
  - `openclaw/openclaw` `src/config/paths.ts` lines 18-30 — `LEGACY_STATE_DIRNAMES`, `NEW_STATE_DIRNAME`, `CONFIG_FILENAME` constants and resolution logic
  - `openclaw/openclaw` `src/config/paths.ts` lines 108+ — `resolveCanonicalConfigPath()` reads `OPENCLAW_CONFIG_PATH` and `OPENCLAW_STATE_DIR` env vars
  - Node.js `os.homedir()` — for `~` expansion

  **Acceptance Criteria**:
  - [x] Test: default resolution returns `$HOME/.openclaw/openclaw.json`
  - [x] Test: `OPENCLAW_CONFIG_PATH=/tmp/custom.json` returns that exact path
  - [x] Test: `OPENCLAW_STATE_DIR=/tmp/state` returns `/tmp/state/openclaw.json`
  - [x] Test: presetsDir = `{stateDir}/oh-my-openclaw/presets/`

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Default path resolution works
    Tool: Bash (bun)
    Steps:
      1. Run `bun -e "import { resolveOpenClawPaths } from './src/core/config-path'; const p = await resolveOpenClawPaths(); console.log(p.configPath.endsWith('.openclaw/openclaw.json'))"`
    Expected Result: stdout is "true"
    Evidence: .sisyphus/evidence/task-3-default-path.txt

  Scenario: Env var override works
    Tool: Bash
    Steps:
      1. Run `OPENCLAW_CONFIG_PATH=/tmp/test-oc.json bun -e "import { resolveOpenClawPaths } from './src/core/config-path'; const p = await resolveOpenClawPaths(); console.log(p.configPath)"`
    Expected Result: stdout is "/tmp/test-oc.json"
    Evidence: .sisyphus/evidence/task-3-env-override.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `feat(core): add OpenClaw config path resolver`
  - Files: `src/core/config-path.ts, src/core/__tests__/config-path.test.ts`
  - Pre-commit: `bun test src/core/__tests__/config-path.test.ts`

---

- [x] 4. JSON5 Read/Write Utilities

  **What to do**:
  - Create `src/core/json5-utils.ts` with:
    - `readJson5(filePath: string): Promise<ConfigSnapshot>` — reads file, returns raw string + parsed object + path
    - `writeJson5(filePath: string, data: Record<string, unknown>): Promise<void>` — serializes and writes JSON5
    - `parseJson5(content: string): Record<string, unknown>` — thin wrapper around json5.parse
    - `stringifyJson5(data: Record<string, unknown>): string` — thin wrapper around json5.stringify with 2-space indent
  - Handle edge cases:
    - File doesn't exist → throw clear error with path
    - File is not valid JSON5 → throw clear error with parse details
    - Empty file → return empty object `{}`
  - **IMPORTANT**: Add warning comment that JSON5 write DESTROYS comments from original file. This is a known MVP limitation.
  - Write TDD tests for all cases

  **Must NOT do**:
  - Do NOT try to preserve JSON5 comments in MVP — accepted limitation
  - Do NOT use `comment-json` — JSON5 full-spec compatibility unverified
  - Do NOT implement atomic writes (temp + rename) in MVP — simple write is fine

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3, 5)
  - **Blocks**: Tasks 6, 7, 9, 14
  - **Blocked By**: None

  **References**:
  - `json5` npm package: https://github.com/json5/json5 — `parse()` and `stringify()` API
  - OpenClaw config uses JSON5 features: unquoted keys, trailing commas, `//` comments

  **Acceptance Criteria**:
  - [x] Test: reads a valid JSON5 file with comments and trailing commas
  - [x] Test: writes JSON5 with 2-space indent
  - [x] Test: throws descriptive error for missing file
  - [x] Test: throws descriptive error for invalid JSON5 syntax
  - [x] Test: empty file returns `{}`

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: JSON5 round-trip works
    Tool: Bash (bun)
    Steps:
      1. Create /tmp/test.json5 with content: `{ // comment\n  name: "test",\n}`
      2. Run `bun -e "import { readJson5 } from './src/core/json5-utils'; const s = await readJson5('/tmp/test.json5'); console.log(s.parsed.name)"`
    Expected Result: stdout is "test"
    Evidence: .sisyphus/evidence/task-4-json5-roundtrip.txt

  Scenario: Missing file throws clear error
    Tool: Bash
    Steps:
      1. Run `bun -e "import { readJson5 } from './src/core/json5-utils'; await readJson5('/nonexistent/path.json5')" 2>&1`
    Expected Result: stderr contains path "/nonexistent/path.json5"
    Evidence: .sisyphus/evidence/task-4-missing-file-error.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `feat(core): add JSON5 read/write utilities`
  - Files: `src/core/json5-utils.ts, src/core/__tests__/json5-utils.test.ts`
  - Pre-commit: `bun test src/core/__tests__/json5-utils.test.ts`

---

- [x] 5. Deep Merge Engine (TDD)

  **What to do**:
  - Create `src/core/merge.ts` with:
    - `deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown>`
    - Merge semantics (matching oh-my-posh's proven pattern):
      - Scalar values: override wins
      - Objects: recursive merge
      - Arrays: override replaces entire array (not append)
      - `null` in override: deletes the key from base
      - `undefined` in override: skips (base value preserved)
    - Returns a NEW object (never mutates inputs)
  - This is the most critical module — use strict TDD:
    - RED: Write failing test for each merge case
    - GREEN: Implement minimal code to pass
    - REFACTOR: Clean up
  - Test cases (minimum):
    - Simple scalar override
    - Nested object merge
    - Array replacement
    - Null deletion
    - Undefined skip
    - Deep nested merge (3+ levels)
    - Override with new key not in base
    - Base key not in override stays untouched
    - Mixed scenario: some override, some new, some delete

  **Must NOT do**:
  - Do NOT use `deepmerge-ts` or any external merge library
  - Do NOT handle circular references (OpenClaw config has none)
  - Do NOT handle `Date`, `RegExp`, `Map`, `Set` — only plain objects/arrays/scalars

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []
  - Reason: Core algorithm with many edge cases, requires careful TDD discipline

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3, 4)
  - **Blocks**: Tasks 9, 12
  - **Blocked By**: None

  **References**:
  - `oh-my-posh` `src/config/merge.go` lines 117-164 — reflection-based merge: zero-value fields skip, slices merge, maps merge
  - OpenClaw merge semantics: config.patch uses RFC 7386 JSON Merge Patch (null = delete, missing = no change)
  - oh-my-posh pattern: scalar=override, map=merge, slice=replace (closest to OpenClaw's approach)

  **Acceptance Criteria**:
  - [x] Test: 9+ test cases covering all merge scenarios
  - [x] Test: inputs are NEVER mutated (verified by Object.freeze)
  - [x] Test: 3-level deep merge works correctly
  - [x] Test: null deletes key, undefined preserves base value
  - [x] `bun test src/core/__tests__/merge.test.ts` → all pass

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Deep merge produces correct output
    Tool: Bash (bun)
    Steps:
      1. Run `bun -e "
         import { deepMerge } from './src/core/merge';
         const base = { identity: { name: 'Bot', emoji: '🦞' }, tools: { allow: ['read'] } };
         const over = { identity: { name: 'DevBot' }, tools: { allow: ['read', 'write', 'exec'] } };
         const result = deepMerge(base, over);
         console.log(result.identity.name, result.identity.emoji, result.tools.allow.length);
         "`
    Expected Result: stdout is "DevBot 🦞 3" (name overridden, emoji preserved from base, array replaced)
    Evidence: .sisyphus/evidence/task-5-deep-merge.txt

  Scenario: Null deletion works
    Tool: Bash (bun)
    Steps:
      1. Run `bun -e "
         import { deepMerge } from './src/core/merge';
         const base = { a: 1, b: 2, c: 3 };
         const result = deepMerge(base, { b: null });
         console.log('b' in result, result.a, result.c);
         "`
    Expected Result: stdout is "false 1 3"
    Evidence: .sisyphus/evidence/task-5-null-delete.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `feat(core): add deep merge engine with TDD`
  - Files: `src/core/merge.ts, src/core/__tests__/merge.test.ts`
  - Pre-commit: `bun test src/core/__tests__/merge.test.ts`

---

- [x] 6. Workspace MD File Resolver + Copier

  **What to do**:
  - Create `src/core/workspace.ts` with:
    - `resolveWorkspaceDir(config: Record<string, unknown>, stateDir: string): string` — reads `agents.defaults.workspace` from parsed config, falls back to `{stateDir}/workspace`
    - `listWorkspaceFiles(workspaceDir: string): Promise<string[]>` — returns list of existing MD files from WORKSPACE_FILES constant
    - `copyWorkspaceFiles(srcDir: string, destDir: string, files: string[]): Promise<void>` — copies specified MD files from src to dest
    - `exportWorkspaceFiles(workspaceDir: string, presetDir: string): Promise<string[]>` — copies current workspace MD files into preset directory, returns list of copied files
  - Handle: workspace dir doesn't exist (skip gracefully), individual MD file missing (skip with warning), dest dir auto-creation
  - Write TDD tests with temp directories

  **Must NOT do**:
  - Do NOT copy non-MD files from workspace (only the 7 standard files)
  - Do NOT modify MD file contents during copy (byte-exact copy)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 7, 8, 9, 10)
  - **Blocks**: Tasks 12, 13
  - **Blocked By**: Tasks 3, 4

  **References**:
  - OpenClaw workspace: `agents.defaults.workspace` defaults to `~/.openclaw/workspace` — see `openclaw/openclaw` `src/config/paths.ts`
  - Workspace files: AGENTS.md, SOUL.md, IDENTITY.md, USER.md, TOOLS.md, HEARTBEAT.md, BOOTSTRAP.md
  - Multi-agent: `agents.list[n].workspace` can override per agent — for MVP, only handle `agents.defaults.workspace`

  **Acceptance Criteria**:
  - [x] Test: resolves `agents.defaults.workspace` from config
  - [x] Test: falls back to `{stateDir}/workspace` when not in config
  - [x] Test: lists only existing MD files (skips missing ones)
  - [x] Test: copies files byte-exact
  - [x] Test: handles missing workspace dir gracefully

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Workspace resolution from config
    Tool: Bash (bun)
    Steps:
      1. Run `bun -e "
         import { resolveWorkspaceDir } from './src/core/workspace';
         const dir = resolveWorkspaceDir({ agents: { defaults: { workspace: '/tmp/custom-ws' } } }, '/home/user/.openclaw');
         console.log(dir);
         "`
    Expected Result: stdout is "/tmp/custom-ws"
    Evidence: .sisyphus/evidence/task-6-workspace-resolve.txt

  Scenario: Missing workspace dir handled gracefully
    Tool: Bash (bun)
    Steps:
      1. Run `bun -e "
         import { listWorkspaceFiles } from './src/core/workspace';
         const files = await listWorkspaceFiles('/nonexistent/workspace');
         console.log(files.length);
         "`
    Expected Result: stdout is "0" (empty array, no crash)
    Evidence: .sisyphus/evidence/task-6-missing-workspace.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `feat(core): add workspace MD file resolver and copier`
  - Files: `src/core/workspace.ts, src/core/__tests__/workspace.test.ts`
  - Pre-commit: `bun test src/core/__tests__/workspace.test.ts`

---

- [x] 7. Backup Manager

  **What to do**:
  - Create `src/core/backup.ts` with:
    - `createBackup(configPath: string, backupsDir: string): Promise<string>` — copies config file to backupsDir with timestamp filename, returns backup path
    - Backup naming: `openclaw.json.{ISO-timestamp}.bak` (e.g., `openclaw.json.2026-03-01T12-00-00.bak`)
    - `createWorkspaceBackup(workspaceDir: string, backupsDir: string, files: string[]): Promise<string>` — creates a timestamped subdirectory in backupsDir and copies workspace MD files there
    - `listBackups(backupsDir: string): Promise<string[]>` — list available backups sorted by date (newest first)
    - `restoreBackup(backupPath: string, configPath: string): Promise<void>` — restore a backup (for future use)
  - Auto-create backupsDir if doesn't exist
  - Write TDD tests

  **Must NOT do**:
  - Do NOT implement backup rotation/cleanup in MVP
  - Do NOT conflict with OpenClaw's own `.bak` files (our backups are in separate dir)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 8, 9, 10)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 3, 4

  **References**:
  - oh-my-zsh install.sh backup pattern: always rename to `.pre-oh-my-zsh` before modifying
  - OpenClaw already uses `.bak` through `.bak.4` (max 5 rotation) — our backups MUST be in `~/.openclaw/oh-my-openclaw/backups/` to avoid collision

  **Acceptance Criteria**:
  - [x] Test: creates timestamped backup file
  - [x] Test: backup content matches original byte-for-byte
  - [x] Test: backupsDir auto-created if missing
  - [x] Test: listBackups returns sorted (newest first)

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Backup creation and listing
    Tool: Bash
    Steps:
      1. Create temp config file: `echo '{"test":1}' > /tmp/test-oc.json`
      2. Run `bun -e "
         import { createBackup, listBackups } from './src/core/backup';
         const p = await createBackup('/tmp/test-oc.json', '/tmp/test-backups');
         const list = await listBackups('/tmp/test-backups');
         console.log(p.includes('.bak'), list.length === 1);
         "`
    Expected Result: stdout is "true true"
    Evidence: .sisyphus/evidence/task-7-backup.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `feat(core): add backup manager`
  - Files: `src/core/backup.ts, src/core/__tests__/backup.test.ts`
  - Pre-commit: `bun test src/core/__tests__/backup.test.ts`

---

- [x] 8. Sensitive Fields Filter

  **What to do**:
  - Create `src/core/sensitive-filter.ts` with:
    - `filterSensitiveFields(config: Record<string, unknown>): Record<string, unknown>` — returns a deep copy with all sensitive fields removed
    - Blocklist patterns:
      - Exact top-level keys: `auth`, `env`, `meta`
      - Dot-path patterns: `gateway.auth`, `hooks.token`
      - Glob patterns: `models.providers.*.apiKey`, `channels.*.botToken`, `channels.*.token`
    - `isSensitivePath(path: string[]): boolean` — checks if a given key path is sensitive
  - Write TDD tests with realistic config containing secrets

  **Must NOT do**:
  - Do NOT use regex for path matching — use explicit path traversal
  - Do NOT modify input object — return new filtered copy

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 9, 10)
  - **Blocks**: Tasks 12, 13
  - **Blocked By**: Task 2

  **References**:
  - OpenClaw config `env` section: can contain `OPENROUTER_API_KEY: "sk-or-..."` directly as plaintext
  - OpenClaw `auth` section: references `auth-profiles.json` which is a separate secrets file
  - `meta` section: auto-managed by OpenClaw (`lastTouchedVersion`, `lastTouchedAt`) — never in presets
  - `gateway.auth.token`: gateway access token
  - `channels.*.botToken`/`.token`: per-channel bot tokens

  **Acceptance Criteria**:
  - [x] Test: top-level `auth`, `env`, `meta` completely removed
  - [x] Test: `gateway.auth.token` removed but `gateway.port` preserved
  - [x] Test: `channels.discord.token` removed but `channels.discord.guilds` preserved
  - [x] Test: `models.providers.custom.apiKey` removed but `models.providers.custom.baseUrl` preserved
  - [x] Test: input object is not mutated

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Sensitive fields are filtered out
    Tool: Bash (bun)
    Steps:
      1. Run `bun -e "
         import { filterSensitiveFields } from './src/core/sensitive-filter';
         const cfg = {
           identity: { name: 'Bot' },
           auth: { profiles: { 'anthropic:key': {} } },
           env: { API_KEY: 'secret' },
           meta: { lastTouchedVersion: '1.0' },
           gateway: { port: 18789, auth: { token: 'gw-secret' } },
           channels: { discord: { token: 'bot-token', guilds: { '123': {} } } }
         };
         const filtered = filterSensitiveFields(cfg);
         console.log(
           filtered.auth === undefined,
           filtered.env === undefined,
           filtered.meta === undefined,
           filtered.gateway.auth === undefined,
           filtered.gateway.port === 18789,
           filtered.channels.discord.token === undefined,
           Object.keys(filtered.channels.discord.guilds).length === 1,
           filtered.identity.name === 'Bot'
         );
         "`
    Expected Result: stdout is "true true true true true true true true"
    Evidence: .sisyphus/evidence/task-8-sensitive-filter.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `feat(core): add sensitive fields filter`
  - Files: `src/core/sensitive-filter.ts, src/core/__tests__/sensitive-filter.test.ts`
  - Pre-commit: `bun test src/core/__tests__/sensitive-filter.test.ts`

---

- [x] 9. Preset Loader + Validator

  **What to do**:
  - Create `src/core/preset-loader.ts` with:
    - `loadPreset(presetPath: string): Promise<PresetManifest>` — reads `preset.json5` from a preset directory, parses it, validates required fields
    - `listPresets(presetsDir: string, builtinPresets: PresetManifest[]): Promise<PresetManifest[]>` — scans presetsDir for user presets + merges with built-in presets
    - `savePreset(presetDir: string, manifest: PresetManifest, workspaceFiles?: Map<string, string>): Promise<void>` — writes preset.json5 + copies workspace files
    - Validation: `name` (required), `description` (required), `version` (required, semver-like)
    - Error handling: missing preset.json5, invalid JSON5, missing required fields
  - Built-in presets are identified by a `builtin: true` flag in metadata
  - User presets in `presetsDir` take precedence over built-in presets with same name
  - Write TDD tests

  **Must NOT do**:
  - Do NOT validate preset config keys against OpenClaw Zod schema at runtime — too complex for MVP
  - Do NOT support nested preset directories — flat structure only

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8, 10)
  - **Blocks**: Tasks 11, 12, 13, 14
  - **Blocked By**: Tasks 2, 4, 5

  **References**:
  - oh-my-zsh plugin loading: `ZSH_CUSTOM` directory takes precedence over bundled — same pattern for user presets overriding built-in
  - Starship preset format: minimal — only changed keys. Our preset.json5 follows same principle.
  - Preset directory structure: `presets/developer/preset.json5` + `presets/developer/AGENTS.md` + `presets/developer/SOUL.md` etc.

  **Acceptance Criteria**:
  - [x] Test: loads valid preset.json5 from directory
  - [x] Test: throws on missing preset.json5
  - [x] Test: throws on missing required fields (name, description, version)
  - [x] Test: listPresets merges built-in + user presets
  - [x] Test: user preset overrides built-in with same name
  - [x] Test: savePreset creates directory + writes preset.json5 + copies MD files

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Load and list presets
    Tool: Bash (bun)
    Steps:
      1. Create `/tmp/test-presets/my-preset/preset.json5` with content: `{ name: 'my-preset', description: 'Test', version: '1.0.0' }`
      2. Run `bun -e "
         import { loadPreset } from './src/core/preset-loader';
         const p = await loadPreset('/tmp/test-presets/my-preset');
         console.log(p.name, p.version);
         "`
    Expected Result: stdout is "my-preset 1.0.0"
    Evidence: .sisyphus/evidence/task-9-load-preset.txt

  Scenario: Missing required field throws
    Tool: Bash
    Steps:
      1. Create `/tmp/test-presets/bad/preset.json5` with content: `{ name: 'bad' }`
      2. Run `bun -e "import { loadPreset } from './src/core/preset-loader'; await loadPreset('/tmp/test-presets/bad')" 2>&1`
    Expected Result: stderr contains "description" or "version" (missing field error)
    Evidence: .sisyphus/evidence/task-9-missing-field.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `feat(core): add preset loader and validator`
  - Files: `src/core/preset-loader.ts, src/core/__tests__/preset-loader.test.ts`
  - Pre-commit: `bun test src/core/__tests__/preset-loader.test.ts`

---

- [x] 10. Built-in Preset Templates

  **What to do**:
  - Create 4 preset directories under `src/presets/`:
    - `default/preset.json5` — minimal clean config (identity only)
    - `developer/preset.json5` — developer-focused: elevated tools, coding skills, higher-capability model
    - `researcher/preset.json5` — research-focused: web tools, summary skills, conservative model
    - `creative/preset.json5` — creative work: image generation skills, creative model selection
  - Each preset includes:
    - `preset.json5` with metadata (name, description, version, author, tags) + config overrides
    - At least `AGENTS.md` and `SOUL.md` with personality-appropriate content
  - Config overrides should ONLY use known OpenClaw config keys (Zod .strict() safe)
  - Example `developer/preset.json5`:
    ```json5
    {
      name: 'developer',
      description: 'Full-stack developer setup with elevated tools and coding-optimized model',
      version: '1.0.0',
      author: 'oh-my-openclaw',
      tags: ['coding', 'developer', 'elevated'],
      config: {
        identity: { name: 'DevBot', theme: 'coding assistant', emoji: '💻' },
        agents: { defaults: { model: { primary: 'anthropic/claude-sonnet-4-5' } } },
        tools: { allow: ['exec', 'process', 'read', 'write', 'edit', 'apply_patch'] }
      },
      workspaceFiles: ['AGENTS.md', 'SOUL.md']
    }
    ```
  - Write a test that validates all built-in presets load without errors

  **Must NOT do**:
  - Do NOT include any API keys, tokens, or secrets in presets
  - Do NOT reference specific channel configs (presets are channel-agnostic)
  - Do NOT be overly creative with MD content — keep it concise and practical

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8, 9)
  - **Blocks**: Tasks 11, 16
  - **Blocked By**: Task 2

  **References**:
  - OpenClaw identity config: `{ name: string, theme: string, emoji: string }`
  - OpenClaw tools allow list: `exec`, `process`, `read`, `write`, `edit`, `apply_patch` are common coding tools
  - OpenClaw model format: `provider/model-name` (e.g., `anthropic/claude-sonnet-4-5`)

  **Acceptance Criteria**:
  - [x] 4 preset directories exist: default, developer, researcher, creative
  - [x] Each has valid preset.json5 with name, description, version
  - [x] Each has at least AGENTS.md and SOUL.md
  - [x] Test: all 4 presets load successfully via preset-loader
  - [x] No secrets/tokens/API keys in any preset file

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: All built-in presets are valid
    Tool: Bash (bun)
    Steps:
      1. Run `bun -e "
         import { loadPreset } from './src/core/preset-loader';
         for (const name of ['default', 'developer', 'researcher', 'creative']) {
           const p = await loadPreset('./src/presets/' + name);
           console.log(p.name + ':ok');
         }"` 
    Expected Result: stdout contains "default:ok", "developer:ok", "researcher:ok", "creative:ok"
    Evidence: .sisyphus/evidence/task-10-builtin-presets.txt

  Scenario: No secrets in preset files
    Tool: Bash
    Steps:
      1. Run `grep -ri 'sk-\|api.key\|token.*=\|password' src/presets/ || echo 'CLEAN'`
    Expected Result: stdout is "CLEAN"
    Evidence: .sisyphus/evidence/task-10-no-secrets.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `feat(presets): add 4 built-in preset templates`
  - Files: `src/presets/*/preset.json5, src/presets/*/AGENTS.md, src/presets/*/SOUL.md`
  - Pre-commit: `bun test`

---

- [x] 11. `list` Command

  **What to do**:
  - Create `src/commands/list.ts`:
    - Loads built-in presets + scans user presets directory
    - Displays table/formatted list: name, description, version, source (built-in/user), tags
    - Color coding with `picocolors`: built-in presets in dim, user presets in bright
    - Indicate currently applied preset (if state tracking exists)
    - Support `--json` flag for machine-readable output
  - Write TDD tests

  **Must NOT do**:
  - Do NOT add interactive selection — just list
  - Do NOT fetch remote presets

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 12, 13, 14)
  - **Blocks**: Task 15
  - **Blocked By**: Tasks 9, 10

  **References**:
  - `openclaw skills list` CLI output style — clean table format with status indicators
  - `picocolors` npm package for terminal colors

  **Acceptance Criteria**:
  - [x] Test: lists built-in presets (4 entries)
  - [x] Test: includes user presets from presets dir
  - [x] Test: `--json` flag outputs valid JSON array
  - [x] Shows name, description, version, source for each preset

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: List shows built-in presets
    Tool: Bash
    Steps:
      1. Run `bun src/cli.ts list`
    Expected Result: stdout contains "default", "developer", "researcher", "creative"
    Evidence: .sisyphus/evidence/task-11-list.txt

  Scenario: JSON output is valid
    Tool: Bash
    Steps:
      1. Run `bun src/cli.ts list --json | bun -e "const d=JSON.parse(await Bun.stdin.text());console.log(Array.isArray(d), d.length>=4)"`
    Expected Result: stdout is "true true"
    Evidence: .sisyphus/evidence/task-11-list-json.txt
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `feat(cli): add list command`
  - Files: `src/commands/list.ts, src/commands/__tests__/list.test.ts`
  - Pre-commit: `bun test`

---

- [x] 12. `apply` Command

  **What to do**:
  - Create `src/commands/apply.ts` — the most critical command:
    1. Resolve OpenClaw paths (config, workspace, backups)
    2. Verify config file exists (error if not)
    3. Load the target preset
    4. Create backup of current config AND workspace MD files
    5. Read current config via JSON5 utils
    6. Deep merge preset config into current config
    7. Write merged config back to openclaw.json
    8. Copy preset's workspace MD files to workspace directory (only files present in preset)
    9. Print summary: what changed, backup location, reminder to restart gateway
    10. Print: `✓ Preset 'developer' applied. Run 'openclaw gateway restart' to activate.`
  - Handle flags: `--dry-run` (show what would change without writing), `--no-backup` (skip backup, use with caution)
  - Handle edge cases:
    - Config file missing → create new from preset config only
    - Preset has no config overrides (only MD files) → skip merge, only copy MD files
    - Preset has no MD files (only config) → skip copy, only merge config
  - **CRITICAL**: Print warning that JSON5 comments in original config will be lost
  - Write comprehensive TDD tests

  **Must NOT do**:
  - Do NOT modify `auth-profiles.json` or any file outside openclaw.json and workspace
  - Do NOT apply sensitive fields from preset (use filter before merge)
  - Do NOT restart gateway automatically — only print reminder

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []
  - Reason: Orchestrates all core modules (merge, backup, workspace, filter); many edge cases

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 11, 13, 14)
  - **Blocks**: Task 15
  - **Blocked By**: Tasks 5, 6, 7, 8, 9

  **References**:
  - oh-my-zsh install.sh: always backup before modifying user files
  - oh-my-posh merge.go lines 117-164: deep merge with zero-value skip
  - OpenClaw config gateway: user must run `openclaw gateway restart` after config changes

  **Acceptance Criteria**:
  - [x] Test: applies preset config via deep merge
  - [x] Test: copies preset MD files to workspace
  - [x] Test: creates backup before writing
  - [x] Test: `--dry-run` shows changes without writing
  - [x] Test: sensitive fields in preset are filtered out before merge
  - [x] Test: prints gateway restart reminder
  - [x] Test: handles preset with only MD files (no config)
  - [x] Test: handles preset with only config (no MD files)

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Full apply workflow
    Tool: Bash
    Preconditions: Create temp config + workspace
    Steps:
      1. mkdir -p /tmp/omo-test/.openclaw/workspace /tmp/omo-test/.openclaw/oh-my-openclaw/presets /tmp/omo-test/.openclaw/oh-my-openclaw/backups
      2. echo '{identity:{name:"OldBot"}}' > /tmp/omo-test/.openclaw/openclaw.json
      3. Run `OPENCLAW_CONFIG_PATH=/tmp/omo-test/.openclaw/openclaw.json bun src/cli.ts apply developer 2>&1`
      4. Read /tmp/omo-test/.openclaw/openclaw.json
      5. Check /tmp/omo-test/.openclaw/oh-my-openclaw/backups/ has a backup
    Expected Result:
      - Config contains `identity.name` = "DevBot" (from developer preset)
      - Backup file exists in backups dir
      - stdout contains "gateway restart"
    Failure Indicators: Config unchanged, no backup created, no restart reminder
    Evidence: .sisyphus/evidence/task-12-apply-full.txt

  Scenario: Dry run doesn't modify files
    Tool: Bash
    Steps:
      1. echo '{identity:{name:"Original"}}' > /tmp/omo-dryrun.json
      2. Run `OPENCLAW_CONFIG_PATH=/tmp/omo-dryrun.json bun src/cli.ts apply developer --dry-run 2>&1`
      3. Run `bun -e "const j=require('json5');console.log(j.parse(await Bun.file('/tmp/omo-dryrun.json').text()).identity.name)"`
    Expected Result: Config still has "Original" (not modified)
    Evidence: .sisyphus/evidence/task-12-apply-dryrun.txt
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `feat(cli): add apply command with deep merge and backup`
  - Files: `src/commands/apply.ts, src/commands/__tests__/apply.test.ts`
  - Pre-commit: `bun test`

---

- [x] 13. `export` Command

  **What to do**:
  - Create `src/commands/export.ts`:
    1. Resolve OpenClaw paths
    2. Read current config via JSON5 utils
    3. Filter out sensitive fields
    4. Create new preset directory: `{presetsDir}/{name}/`
    5. Write `preset.json5` with metadata (prompted or default) + filtered config
    6. Copy workspace MD files into the preset directory
    7. Print summary: what was exported, where it's saved, any fields excluded
  - Flags: `--name` (preset name), `--description`, `--version` (default: 1.0.0)
  - If name already exists, error with suggestion to use `--force`
  - `--force` overwrites existing preset
  - Write TDD tests

  **Must NOT do**:
  - Do NOT export auth/env/meta fields (use sensitive filter)
  - Do NOT modify the current config (read-only operation)
  - Do NOT create presets outside the presetsDir

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 11, 12, 14)
  - **Blocks**: Task 15
  - **Blocked By**: Tasks 6, 8, 9

  **References**:
  - Sensitive fields filter (Task 8): used to strip secrets before writing preset
  - Workspace resolver (Task 6): used to find and copy MD files

  **Acceptance Criteria**:
  - [x] Test: creates preset directory with preset.json5 + MD files
  - [x] Test: sensitive fields are excluded from exported config
  - [x] Test: errors on duplicate name (without --force)
  - [x] Test: `--force` overwrites existing preset
  - [x] Test: workspace MD files are copied

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Export creates valid preset
    Tool: Bash
    Steps:
      1. Setup: create config with identity + workspace with AGENTS.md
      2. Run `OPENCLAW_CONFIG_PATH=/tmp/omo-export/.openclaw/openclaw.json bun src/cli.ts export my-setup`
      3. Check /tmp/omo-export/.openclaw/oh-my-openclaw/presets/my-setup/preset.json5 exists
      4. Check /tmp/omo-export/.openclaw/oh-my-openclaw/presets/my-setup/AGENTS.md exists
    Expected Result: Both files exist, preset.json5 has name="my-setup"
    Evidence: .sisyphus/evidence/task-13-export.txt

  Scenario: Sensitive fields not exported
    Tool: Bash
    Steps:
      1. Create config with env.SECRET_KEY = "hidden"
      2. Run export command
      3. Read preset.json5 and check for SECRET_KEY
    Expected Result: preset.json5 does NOT contain "SECRET_KEY" or "hidden"
    Evidence: .sisyphus/evidence/task-13-no-secrets.txt
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `feat(cli): add export command`
  - Files: `src/commands/export.ts, src/commands/__tests__/export.test.ts`
  - Pre-commit: `bun test`

---

- [x] 14. `diff` Command

  **What to do**:
  - Create `src/commands/diff.ts`:
    1. Resolve OpenClaw paths
    2. Read current config
    3. Load target preset
    4. Compare current config vs preset config (key-by-key diff)
    5. Display colorized diff output:
      - Green `+` for keys preset would add
      - Red `-` for keys preset would remove (null values)
      - Yellow `~` for keys preset would change (different value)
      - Dim for keys that are the same
    6. Also show workspace MD file diff (which files would be added/replaced)
  - Use `picocolors` for coloring
  - Support `--json` flag for machine-readable diff output
  - If no preset specified, show diff against the currently applied preset (if tracked)
  - Write TDD tests

  **Must NOT do**:
  - Do NOT use external diff library — implement simple key-comparison diff
  - Do NOT show full file content — only changed keys/values

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 11, 12, 13)
  - **Blocks**: Task 15
  - **Blocked By**: Tasks 4, 9

  **References**:
  - `picocolors` for terminal colors: green, red, yellow, dim
  - Key-by-key comparison: traverse both objects, report additions/removals/changes at each path

  **Acceptance Criteria**:
  - [x] Test: shows added keys in green
  - [x] Test: shows changed values with old → new
  - [x] Test: shows removed keys (null) in red
  - [x] Test: `--json` produces valid JSON diff
  - [x] Test: reports workspace file differences (files that would be added/replaced)

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Diff shows changes between current and preset
    Tool: Bash
    Steps:
      1. Create config: `{identity:{name:"OldBot",emoji:"🦞"},tools:{allow:["read"]}}`
      2. Run `OPENCLAW_CONFIG_PATH=/tmp/omo-diff.json bun src/cli.ts diff developer 2>&1`
    Expected Result: stdout contains "identity.name" with change from "OldBot" to developer preset's name
    Evidence: .sisyphus/evidence/task-14-diff.txt

  Scenario: JSON diff output
    Tool: Bash
    Steps:
      1. Run `OPENCLAW_CONFIG_PATH=/tmp/omo-diff.json bun src/cli.ts diff developer --json | bun -e "const d=JSON.parse(await Bun.stdin.text());console.log(typeof d.changes)"`
    Expected Result: stdout is "object"
    Evidence: .sisyphus/evidence/task-14-diff-json.txt
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `feat(cli): add diff command`
  - Files: `src/commands/diff.ts, src/commands/__tests__/diff.test.ts`
  - Pre-commit: `bun test`

---

- [x] 15. CLI Entry Point + Commander Setup

  **What to do**:
  - Create `src/cli.ts` as the main entry point:
    - Setup `commander` program with name "oh-my-openclaw", version from package.json
    - Register all 4 commands (list, apply, export, diff) with their options
    - Global error handling: catch all unhandled errors, print user-friendly message
    - Add `--version` and `--help` flags (commander does this automatically)
  - Create `bin/oh-my-openclaw.js` shim for npm-based execution: `#!/usr/bin/env bun\nimport '../src/cli.ts'`
  - Ensure all commands work end-to-end through the CLI entry point

  **Must NOT do**:
  - Do NOT add commands beyond the 4 MVP ones
  - Do NOT add global flags beyond --version and --help

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after all Wave 3 commands)
  - **Blocks**: Tasks 16, 17
  - **Blocked By**: Tasks 11, 12, 13, 14

  **References**:
  - commander.js subcommand pattern: `program.command('apply').argument('<preset>').option('--dry-run').action(async (preset, opts) => { ... })`
  - `openclaw/openclaw` CLI (`src/cli/`) as pattern reference for commander setup

  **Acceptance Criteria**:
  - [x] `bun src/cli.ts --help` shows all 4 commands
  - [x] `bun src/cli.ts --version` shows version from package.json
  - [x] `bun src/cli.ts list` works end-to-end
  - [x] `bun src/cli.ts apply --help` shows apply-specific options
  - [x] Unknown command shows error + help

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: CLI help shows all commands
    Tool: Bash
    Steps:
      1. Run `bun src/cli.ts --help`
    Expected Result: stdout contains "list", "apply", "export", "diff"
    Evidence: .sisyphus/evidence/task-15-cli-help.txt

  Scenario: Unknown command shows error
    Tool: Bash
    Steps:
      1. Run `bun src/cli.ts foobar 2>&1`
    Expected Result: stderr contains "unknown command" or similar error
    Evidence: .sisyphus/evidence/task-15-unknown-cmd.txt
  ```

  **Commit**: YES
  - Message: `feat(cli): wire up CLI entry point with all commands`
  - Files: `src/cli.ts, bin/oh-my-openclaw.js`
  - Pre-commit: `bun test`

---

- [x] 16. Binary Compilation + Asset Embedding

  **What to do**:
  - Update `package.json` build scripts:
    - `build`: `bun build src/cli.ts --outdir dist --target bun --format esm`
    - `build:compile`: `bun build src/cli.ts --compile --bytecode --outfile dist/oh-my-openclaw`
  - Embed built-in presets in compiled binary using Bun's static import:
    ```typescript
    // src/presets/index.ts
    import defaultPreset from './default/preset.json5' with { type: 'file' };
    import defaultAgents from './default/AGENTS.md' with { type: 'file' };
    // ... etc for all preset files
    ```
  - Create `src/presets/index.ts` that exports a Map of preset names to their file references
  - Test that the compiled binary works standalone (without source files)
  - Verify built-in presets are accessible from the compiled binary

  **Must NOT do**:
  - Do NOT set up CI/CD pipelines — just local build scripts
  - Do NOT cross-compile for multiple platforms in MVP

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (sequential after Wave 3)
  - **Blocks**: Task 17
  - **Blocked By**: Task 15

  **References**:
  - Bun compile docs: https://bun.sh/docs/bundler/executables
  - Bun `import ... with { type: 'file' }` for static assets: returns internal `$bunfs` path readable via `Bun.file()`
  - `peterbe/gg2` package.json: `--compile --bytecode` for faster startup

  **Acceptance Criteria**:
  - [x] `bun run build:compile` produces `dist/oh-my-openclaw` binary
  - [x] Binary runs without `bun` installed: `./dist/oh-my-openclaw --version`
  - [x] `./dist/oh-my-openclaw list` shows built-in presets from embedded assets
  - [x] Binary size is reasonable (< 100MB)

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Compiled binary works standalone
    Tool: Bash
    Steps:
      1. Run `bun run build:compile`
      2. Run `./dist/oh-my-openclaw --version`
      3. Run `./dist/oh-my-openclaw list`
    Expected Result: version printed, list shows 4 built-in presets
    Failure Indicators: "not found" error, missing presets
    Evidence: .sisyphus/evidence/task-16-binary.txt
  ```

  **Commit**: YES
  - Message: `feat(build): add binary compilation with embedded presets`
  - Files: `src/presets/index.ts, package.json (scripts)`
  - Pre-commit: `bun test && bun run build:compile`

---

- [x] 17. Integration Tests + Edge Cases

  **What to do**:
  - Create `src/__tests__/integration.test.ts` with end-to-end scenarios:
    - Full workflow: `export` → `list` (verify it appears) → `diff` → `apply` → `diff` again (verify no diff)
    - Edge case: apply to nonexistent config (should create new file)
    - Edge case: export from empty workspace (no MD files)
    - Edge case: apply preset with only MD files (no config overrides)
    - Edge case: apply preset with only config (no MD files)
    - Edge case: config file is not valid JSON5 (clear error)
    - Edge case: preset directory is empty (clear error)
    - Edge case: multiple applies in sequence (each creates backup)
  - Use temp directories for all tests (no side effects on real config)
  - All tests should clean up after themselves

  **Must NOT do**:
  - Do NOT test against real ~/.openclaw/ — always use temp dirs
  - Do NOT test remote/GitHub features

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []
  - Reason: Complex multi-step integration scenarios with many edge cases

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (after Task 16)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 15, 16

  **References**:
  - All core modules (Tasks 3-9) — integration tests exercise the full stack
  - All commands (Tasks 11-14) — called via the CLI entry point

  **Acceptance Criteria**:
  - [x] Full workflow test passes (export → list → diff → apply → diff)
  - [x] All 8 edge cases tested and handled
  - [x] No tests touch real ~/.openclaw/
  - [x] All tests clean up temp directories
  - [x] `bun test` runs all tests (unit + integration) and all pass

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Full export-apply cycle
    Tool: Bash
    Steps:
      1. Setup temp OpenClaw environment
      2. Run `oh-my-openclaw export cycle-test`
      3. Run `oh-my-openclaw list --json` and verify "cycle-test" appears
      4. Modify config manually
      5. Run `oh-my-openclaw diff cycle-test` and verify changes shown
      6. Run `oh-my-openclaw apply cycle-test`
      7. Run `oh-my-openclaw diff cycle-test` and verify no changes
    Expected Result: Full cycle completes, final diff shows no differences
    Evidence: .sisyphus/evidence/task-17-full-cycle.txt

  Scenario: Apply to nonexistent config creates new file
    Tool: Bash
    Steps:
      1. Set OPENCLAW_CONFIG_PATH to a path that doesn't exist
      2. Run `oh-my-openclaw apply developer`
      3. Verify config file was created with developer preset config
    Expected Result: New config file exists with developer preset content
    Evidence: .sisyphus/evidence/task-17-new-config.txt
  ```

  **Commit**: YES
  - Message: `test(integration): add end-to-end and edge case tests`
  - Files: `src/__tests__/integration.test.ts`
  - Pre-commit: `bun test`
## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + `bun test`. Review all files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task. Test cross-command integration (export → list → diff → apply → diff again). Test edge cases: missing config, empty workspace, preset with only MD files. Save evidence to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1. Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `feat(core): add project scaffolding, types, and foundation modules` — package.json, tsconfig.json, src/types.ts, src/config-path.ts, src/json5-utils.ts, src/merge.ts
- **Wave 2**: `feat(core): add workspace resolver, backup manager, preset loader` — src/workspace.ts, src/backup.ts, src/sensitive-filter.ts, src/preset-loader.ts, presets/*/
- **Wave 3**: `feat(cli): add list, apply, export, diff commands` — src/commands/*.ts, src/cli.ts
- **Wave 4**: `feat(build): add binary compilation and integration tests` — build script, src/**/*.test.ts

---

## Success Criteria

### Verification Commands
```bash
bun test                                    # Expected: all tests pass
bun build src/cli.ts --compile --outfile dist/oh-my-openclaw  # Expected: binary created
./dist/oh-my-openclaw list                  # Expected: shows 4+ presets
./dist/oh-my-openclaw apply developer       # Expected: config updated, backup created
./dist/oh-my-openclaw export test-export    # Expected: preset dir created
./dist/oh-my-openclaw diff developer        # Expected: colorized diff output
```

### Final Checklist
- [x] All "Must Have" present
- [x] All "Must NOT Have" absent
- [x] All tests pass (`bun test`)
- [x] Binary compiles and runs standalone
- [x] Built-in presets work from compiled binary
- [x] Sensitive fields never appear in exports
- [x] Backups created before every apply
- [x] Config path resolution respects env vars
