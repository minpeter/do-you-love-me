# Preset Skill Deployment

## TL;DR

> **Quick Summary**: Add skill deployment to oh-my-openclaw presets. When `apply` runs, skills bundled in the preset (`skills/` directory) are copied to `~/.agents/skills/`, making them available to OpenClaw's runtime. Apex preset gets a real prompt-guard skill.
> 
> **Deliverables**:
> - `src/core/skills.ts` — Skill copy logic with collision prompting
> - Updated `src/core/types.ts` — `skills` field on PresetManifest
> - Updated `src/commands/apply.ts` — Skill deployment step after workspace files
> - `src/presets/apex/skills/prompt-guard/SKILL.md` — Bundled prompt-guard skill
> - Updated `src/presets/apex/preset.json5` — `skills` field
> - Tests and documentation updates
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 5 → Task 7 → Final Wave

---

## Context

### Original Request
User wants presets to bundle "skills" (dynamic context files for OpenClaw agents). When applying a preset, skills should be deployed to `~/.agents/skills/` so they appear in `openclaw skills list`.

### Interview Summary
**Key Discussions**:
- Skill collision: Interactive Y/N prompt when skill already exists. `--force` overwrites. Non-TTY: skip with warning.
- export: Out of scope (maintainer-only concern)
- apex gets prompt-guard SKILL.md — convert from TOOLS.md Part 2 to agent-oriented guide format
- `--clean` does NOT affect skills (too risky — could delete skills from other sources)
- No skill backup (can be reapplied from preset)
- No new npm dependencies (use Node's readline for prompts)

**Research Findings**:
- Skill structure: `<name>/SKILL.md` + optional subdirs (`scripts/`, `references/`, `bin/`, etc.)
- SKILL.md: YAML frontmatter (name, description, optional metadata) + markdown body
- User skills path: `~/.agents/skills/<name>/`
- Skills auto-detected by `openclaw skills list` when placed in `~/.agents/skills/`
- Full recursive directory copy needed (not just SKILL.md)

### Metis Review
**Identified Gaps** (addressed):
- **Skill dir recursive copy**: Must use `fs.cp({recursive: true})` — skills can have `scripts/`, `references/`, `bin/`, not just SKILL.md
- **SKILL.md format**: prompt-guard SKILL.md must be agent-oriented guide (When to Use, Quick Start), NOT Python API reference dump from TOOLS.md
- **Test isolation**: Need env var or parameter override for `~/.agents/skills/` target path in tests
- **`install` command**: Does NOT get skill deployment (stays as simple `apply apex` alias)
- **`diff`/`list` commands**: Do NOT show skill info (explicitly out of scope)

---

## Work Objectives

### Core Objective
Enable oh-my-openclaw presets to bundle and deploy OpenClaw agent skills, with the apex preset shipping a real prompt-guard skill.

### Concrete Deliverables
- `src/core/skills.ts` — `copySkills()`, `promptOverwrite()` functions
- `src/core/types.ts` — `skills?: string[]` field on PresetManifest
- `src/commands/apply.ts` — Skill deployment integration
- `src/presets/apex/skills/prompt-guard/SKILL.md` — Prompt Guard agent skill
- `src/presets/apex/preset.json5` — Updated with `skills: ['prompt-guard']`
- `src/core/__tests__/skills.test.ts` — Unit tests
- `src/commands/__tests__/apply.test.ts` — Integration tests for skill deploy
- Updated `AGENTS.md` and `README.md`

### Definition of Done
- [x] `bun test` — all tests pass (0 failures)
- [x] `bun run typecheck` — no type errors
- [x] `bun run build` — builds successfully
- [x] `bun run src/cli.ts apply apex --dry-run` — shows skills to install
- [x] `openclaw skills list` shows prompt-guard after `apply apex`

### Must Have
- `preset.json5` supports `skills` field (string array of skill dir names)
- `apply` copies skill directories recursively to `~/.agents/skills/`
- Interactive Y/N prompt when existing skill would be overwritten
- `--force` skips prompt and overwrites
- Non-TTY environments: skip existing skills with warning
- `--dry-run` shows which skills would be installed
- Apex preset bundles prompt-guard skill
- Skills appear in `openclaw skills list` after apply

### Must NOT Have (Guardrails)
- Do NOT add skill support to `install` command (stays as simple `apply apex` alias, inherits skill behavior from apply)
- Do NOT add skill display to `diff` or `list` commands
- Do NOT add skill capture to `export` command
- Do NOT add new npm dependencies
- Do NOT modify `src/core/merge.ts`, `src/core/backup.ts`, `src/core/sensitive-filter.ts`
- Do NOT modify `src/core/remote.ts`
- Do NOT modify `src/core/workspace.ts` (skills are a separate concern)
- Do NOT validate SKILL.md frontmatter content (just copy files)
- Do NOT dump TOOLS.md Part 2 verbatim into SKILL.md — write agent-oriented content
- Do NOT make `--clean` delete skills from `~/.agents/skills/`

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Framework**: bun test

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **CLI**: Use Bash — Run commands, assert output
- **Tests**: Use Bash — `bun test` with specific file paths

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — types + core module + skill content):
├── Task 1: Create src/core/skills.ts [deep]
├── Task 2: Update PresetManifest type + apex preset.json5 [quick]
└── Task 3: Create prompt-guard SKILL.md [writing]

Wave 2 (Integration — wire into apply):
└── Task 4: Integrate skill deploy into apply.ts [deep]

Wave 3 (Tests):
├── Task 5: Unit tests for skills.ts [unspecified-high]
└── Task 6: Integration tests for skill deploy [unspecified-high]

Wave 4 (Documentation):
├── Task 7: Update AGENTS.md [quick]
└── Task 8: Update README.md [quick]

Wave FINAL (Review):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 4 → Task 5/6 → Task 7/8 → Final Wave
Parallel Speedup: ~50% faster than sequential
Max Concurrent: 3 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1    | —         | 4, 5 |
| 2    | —         | 4 |
| 3    | —         | 4 |
| 4    | 1, 2, 3   | 6 |
| 5    | 1         | 7, 8 |
| 6    | 4         | 7, 8 |
| 7    | 5, 6      | F1-F4 |
| 8    | 5, 6      | F1-F4 |

### Agent Dispatch Summary

- **Wave 1**: **3 tasks** — T1 → `deep`, T2 → `quick`, T3 → `writing`
- **Wave 2**: **1 task** — T4 → `deep`
- **Wave 3**: **2 tasks** — T5 → `unspecified-high`, T6 → `unspecified-high`
- **Wave 4**: **2 tasks** — T7 → `quick`, T8 → `quick`
- **FINAL**: **4 tasks** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.

- [x] 1. Create `src/core/skills.ts` — Skill Copy Logic with Collision Handling

  **What to do**:
  - Create `src/core/skills.ts` with these exports:
    - `copySkills(presetDir: string, skills: string[], options?: { force?: boolean; dryRun?: boolean }): Promise<void>` — Main entry point. For each skill name: resolve source dir (`path.join(presetDir, 'skills', skillName)`), resolve target dir (`path.join(os.homedir(), '.agents', 'skills', skillName)`). If dryRun, just log and return. If target exists and not force: call `promptOverwrite()`. If TTY and user says no: skip. If non-TTY: skip with warning. If target doesn't exist or overwrite confirmed: use `fs.cp(src, dest, { recursive: true })` to copy entire directory.
    - `promptOverwrite(skillName: string): Promise<boolean>` — Uses Node's `readline` module to ask `Skill '${skillName}' already exists. Overwrite? [y/N]`. Returns true if user types 'y' or 'Y'. Defaults to N (false). If `!process.stdin.isTTY`, return false immediately.
  - Import only: `node:path`, `node:fs/promises`, `node:os`, `node:readline`
  - Use `fs.cp` with `{ recursive: true }` to handle SKILL.md + scripts/ + references/ + any other subdirs
  - Log messages with `console.log`: `OK Skill '${name}' installed.`, `Skipped skill '${name}' (already exists).`, `Skill '${name}' already exists. Overwrite? [y/N]`
  - Handle edge cases: source skill dir doesn't exist → throw descriptive error, SKILL.md missing in source → warn but still copy

  **Must NOT do**:
  - Do NOT add npm dependencies (use built-in readline)
  - Do NOT validate SKILL.md frontmatter content
  - Do NOT import picocolors (core modules don't use it, only commands do)
  - Do NOT backup existing skills before overwrite
  - Do NOT create `~/.agents/skills/` if no skills to install

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Core module with filesystem operations, interactive I/O (readline), TTY detection, and recursive copy. Needs careful error handling.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 4 (integration), Task 5 (unit tests)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/core/workspace.ts:32-43` — `copyWorkspaceFiles()` pattern: iterate files, mkdir dest, fs.copyFile. Your function is similar but uses `fs.cp({recursive: true})` for directories instead of single files.
  - `src/core/remote.ts:87-123` — `cloneToCache()` pattern for error handling and cleanup: try/catch with descriptive user-facing error messages.

  **API/Type References**:
  - `src/core/types.ts:1-10` — `PresetManifest` interface (Task 2 adds `skills` field).
  - Node.js `fs.cp()` — `fs.cp(src, dest, { recursive: true })` copies directory recursively (Bun supports this).
  - Node.js `readline` — `readline.createInterface({ input: process.stdin, output: process.stdout })` for interactive prompts.

  **WHY Each Reference Matters:**
  - `workspace.ts` — Shows the project's pattern for copying preset content to user directories. Your skill copy follows the same concept but for directories instead of individual files.
  - `remote.ts` — Shows error handling pattern with user-friendly messages. Skill copy errors should follow the same style.

  **Acceptance Criteria**:
  - [x] File exists: `src/core/skills.ts`
  - [x] `bun run typecheck` — no type errors
  - [x] Exports `copySkills` and `promptOverwrite`

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: copySkills copies skill directory recursively
    Tool: Bash (bun eval)
    Preconditions: Create temp preset with skills/test-skill/SKILL.md
    Steps:
      1. Create temp dirs and a fake skill with SKILL.md
      2. Call copySkills(presetDir, ['test-skill'], { force: true })
      3. Verify target dir has SKILL.md
    Expected Result: Skill directory copied to target
    Evidence: .sisyphus/evidence/task-1-copy-skills.txt

  Scenario: copySkills skips existing skill in non-TTY
    Tool: Bash (bun eval)
    Preconditions: Target skill already exists
    Steps:
      1. Create existing skill in target dir
      2. Call copySkills without force (process.stdin.isTTY is false in eval)
      3. Verify original content unchanged
    Expected Result: Existing skill not overwritten, warning logged
    Evidence: .sisyphus/evidence/task-1-skip-existing.txt
  ```

  **Commit**: YES
  - Message: `feat(core): add skill deployment module`
  - Files: `src/core/skills.ts`
  - Pre-commit: `bun run typecheck`

---

- [x] 2. Update PresetManifest Type + Apex `preset.json5`

  **What to do**:
  - In `src/core/types.ts`, add `skills?: string[]` to `PresetManifest` interface (after `workspaceFiles` field, line 9).
  - In `src/presets/apex/preset.json5`, add `skills: ['prompt-guard']` after the `workspaceFiles` line (line 41).
  - In `src/core/__tests__/types.test.ts`, update the test that checks PresetManifest fields if one exists.

  **Must NOT do**:
  - Do NOT modify any other type definitions
  - Do NOT change existing field types

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Two small edits — add one field to interface and one line to json5.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 4 (integration needs the type)
  - **Blocked By**: None

  **References**:
  - `src/core/types.ts:1-10` — PresetManifest interface. Add `skills?: string[]` after line 9 (`workspaceFiles`).
  - `src/presets/apex/preset.json5:41` — `workspaceFiles` line. Add `skills` on next line.
  - `src/core/__tests__/types.test.ts` — May have a test validating PresetManifest fields. Update if needed.

  **Acceptance Criteria**:
  - [x] `PresetManifest` has `skills?: string[]` field
  - [x] `preset.json5` has `skills: ['prompt-guard']`
  - [x] `bun run typecheck` — no type errors

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: PresetManifest type accepts skills field
    Tool: Bash (bun eval)
    Steps:
      1. Run: bun eval "import type { PresetManifest } from './src/core/types'; const p: PresetManifest = { name: 'test', description: 'test', version: '1.0', skills: ['a'] }; console.log('OK')"
      2. Assert output: OK
    Expected Result: Type compiles with skills field
    Evidence: .sisyphus/evidence/task-2-type-check.txt
  ```

  **Commit**: YES
  - Message: `feat(preset): add skills field to PresetManifest and apex preset`
  - Files: `src/core/types.ts`, `src/presets/apex/preset.json5`
  - Pre-commit: `bun run typecheck`

---

- [x] 3. Create `src/presets/apex/skills/prompt-guard/SKILL.md`

  **What to do**:
  - Create directory: `src/presets/apex/skills/prompt-guard/`
  - Create `SKILL.md` with YAML frontmatter + agent-oriented guide content.
  - Frontmatter MUST include: `name: prompt-guard`, `description: "..."`, `metadata: { "openclaw": { "emoji": "🛡️" } }`
  - Body should be an **agent usage guide** (100-150 lines), NOT a Python API reference dump. Include:
    - When to Use / When NOT to Use
    - Quick Start (CLI commands, Python one-liners)
    - Security Levels table (SAFE through CRITICAL)
    - Shield Categories table
    - Integration workflow (receive → scan → execute → scan output → return)
    - Configuration basics (sensitivity, pattern_tier, owner_ids, canary_tokens)
  - Extract the useful bits from `src/presets/apex/TOOLS.md` Part 2 (lines 176-492) but rewrite for agent consumption. Remove: detailed Python class internals, cache API, HiveFence internals, file structure, tiered loading API details.

  **Must NOT do**:
  - Do NOT copy TOOLS.md Part 2 verbatim
  - Do NOT include Python class/method internals (PromptGuard.__init__, _cache internals)
  - Do NOT exceed 200 lines
  - Do NOT modify existing TOOLS.md content

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Content creation task. Requires understanding the source material and rewriting it for a different audience (AI agent vs developer).
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 4 (apply needs the skill dir to exist)
  - **Blocked By**: None

  **References**:
  - `src/presets/apex/TOOLS.md:176-492` — Source material for prompt-guard. Extract security levels, categories, quick start, and integration workflow. Rewrite for agent use.
  - `~/github.com/minpeter/openclaw/skills/tmux/SKILL.md` — Example of well-structured bundled SKILL.md. Follow same structure: When to Use, When NOT to Use, core instructions.
  - `~/.agents/skills/ralph-tui-prd/SKILL.md` — Example of user SKILL.md. Simpler frontmatter format.

  **Acceptance Criteria**:
  - [x] File exists: `src/presets/apex/skills/prompt-guard/SKILL.md`
  - [x] Has valid YAML frontmatter with `name: prompt-guard`
  - [x] Content is agent-oriented (When to Use, Quick Start sections)
  - [x] Under 200 lines

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: SKILL.md exists and has correct frontmatter
    Tool: Bash (grep)
    Steps:
      1. grep 'name: prompt-guard' src/presets/apex/skills/prompt-guard/SKILL.md
      2. grep 'When to Use' src/presets/apex/skills/prompt-guard/SKILL.md
      3. wc -l src/presets/apex/skills/prompt-guard/SKILL.md (assert < 200)
    Expected Result: All assertions pass
    Evidence: .sisyphus/evidence/task-3-skill-md.txt
  ```

  **Commit**: YES
  - Message: `feat(preset): add prompt-guard skill to apex preset`
  - Files: `src/presets/apex/skills/prompt-guard/SKILL.md`
  - Pre-commit: —

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `bun run typecheck` + `bun test`. Review changed files for `as any`, empty catches, unused imports, AI slop.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Execute real CLI: apply apex (with skills), verify prompt-guard in ~/.agents/skills/, run openclaw skills list, test --dry-run, test --force, test collision prompt.
  Output: `Scenarios [N/N pass] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  Diff all changes vs plan. Verify forbidden files untouched. Check scope creep.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | VERDICT`


- [x] 4. Integrate Skill Deployment into `apply.ts`

  **What to do**:
  - Import `{ copySkills }` from `'../core/skills'` in `src/commands/apply.ts`.
  - After workspace files are copied (line 159), add skill deployment block:
    ```
    if (preset.skills?.length) {
      await copySkills(presetDir, preset.skills, { force: options.force, dryRun: options.dryRun });
    }
    ```
  - In the dry-run output section (around line 121-123), add skill display:
    ```
    if (preset.skills?.length) {
      console.log(`Skills to install: ${preset.skills.join(', ')}`);
    }
    ```
  - In the actual apply section, after copySkills call, log the count:
    ```
    console.log(pc.green(`OK Skills installed: ${preset.skills.join(', ')}`));
    ```
  - The `install` command calls `applyCommand('apex', ...)` so it inherits skill behavior automatically.

  **Must NOT do**:
  - Do NOT modify workspace copy logic
  - Do NOT modify config merge logic
  - Do NOT add skill-specific CLI flags (reuse existing --force, --dry-run)
  - Do NOT handle --clean for skills (skills are unaffected by --clean)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Integration into the core apply flow. Must surgically add skill support without breaking existing behavior.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential)
  - **Blocks**: Task 6 (integration tests)
  - **Blocked By**: Tasks 1, 2, 3

  **References**:
  - `src/commands/apply.ts:157-160` — Workspace file copy block. Skill deployment goes AFTER this.
  - `src/commands/apply.ts:112-126` — Dry-run output section. Add skill display here.
  - `src/core/skills.ts` — (Task 1) `copySkills(presetDir, skills, options)` function signature.
  - `src/commands/install.ts` — Calls `applyCommand('apex', ...)`. No changes needed here — it inherits skill behavior.

  **Acceptance Criteria**:
  - [x] `bun run typecheck` — no type errors
  - [x] `bun test` — all existing tests still pass
  - [x] `import copySkills` present in apply.ts
  - [x] Dry-run output includes skills info
  - [x] Existing local/remote preset flow unchanged

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: apply apex --dry-run shows skills
    Tool: Bash
    Steps:
      1. Run: bun run src/cli.ts apply apex --dry-run 2>&1
      2. Assert output contains 'Skills to install: prompt-guard'
    Expected Result: Dry-run lists skills
    Evidence: .sisyphus/evidence/task-4-dryrun-skills.txt

  Scenario: Local preset without skills still works
    Tool: Bash
    Steps:
      1. Run: bun test src/commands/__tests__/apply.test.ts
      2. Assert all existing tests pass
    Expected Result: No regression
    Evidence: .sisyphus/evidence/task-4-no-regression.txt
  ```

  **Commit**: YES
  - Message: `feat(apply): integrate skill deployment into apply command`
  - Files: `src/commands/apply.ts`
  - Pre-commit: `bun test`

---

- [x] 5. Add Unit Tests for `src/core/skills.ts`

  **What to do**:
  - Create `src/core/__tests__/skills.test.ts`
  - Test structure: `describe('skills')` with nested describes for each function.
  - **`copySkills` tests:**
    - `test('copies skill directory to target')` — create temp preset with skills/test-skill/SKILL.md, call copySkills, verify SKILL.md exists at target
    - `test('copies skill with subdirectories recursively')` — create skill with scripts/ subdir, verify recursive copy
    - `test('creates target parent directory if missing')` — target ~/.agents/skills/ doesn't exist yet
    - `test('overwrites existing skill when force is true')` — create existing skill, copySkills with force, verify content updated
    - `test('skips existing skill in non-TTY without force')` — in bun test stdin is not TTY, verify skip behavior
    - `test('does not copy in dry-run mode')` — call with dryRun: true, verify no files created at target
    - `test('throws on missing skill directory in preset')` — skill name listed but dir doesn't exist in preset
    - `test('installs multiple skills in order')` — two skills, both get installed
  - Use temp directories via `fs.mkdtemp`, clean up in `afterEach`
  - Override target path via env var or parameter to avoid touching real ~/.agents/skills/

  **Must NOT do**:
  - Do NOT modify existing test files
  - Do NOT mock filesystem operations (test real behavior with temp dirs)
  - Do NOT touch real ~/.agents/skills/ directory

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Substantial test file with 8+ tests, temp dir management, filesystem assertions.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 6)
  - **Blocks**: Tasks 7, 8
  - **Blocked By**: Task 1 (skills.ts must exist)

  **References**:
  - `src/commands/__tests__/apply.test.ts:21-96` — Test helper pattern: `createTempEnv()`, `afterEach` cleanup. Follow same approach.
  - `src/core/__tests__/remote.test.ts` — Recent test file showing project conventions for core module tests.
  - `src/core/skills.ts` — (Task 1) Functions to test.

  **Acceptance Criteria**:
  - [x] File exists: `src/core/__tests__/skills.test.ts`
  - [x] `bun test src/core/__tests__/skills.test.ts` — all tests pass
  - [x] At least 8 test cases

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All skill unit tests pass
    Tool: Bash
    Steps:
      1. Run: bun test src/core/__tests__/skills.test.ts 2>&1
      2. Assert: 0 failures, 8+ tests
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-5-unit-tests.txt
  ```

  **Commit**: YES
  - Message: `test(core): add unit tests for skill deployment`
  - Files: `src/core/__tests__/skills.test.ts`
  - Pre-commit: `bun test`

---

- [x] 6. Add Integration Tests for Skill Deployment via Apply

  **What to do**:
  - In `src/commands/__tests__/apply.test.ts`, add `describe('skill deployment')` block at the end.
  - **Test cases:**
    - `test('apply copies skills to target directory')` — Create temp preset with skills dir, apply, verify skill installed
    - `test('apply shows skills in dry-run output')` — Apply with dryRun, capture logs, assert 'Skills to install'
    - `test('apply with --force overwrites existing skills')` — Pre-create skill, apply with force, verify overwritten
    - `test('apply skips existing skills without force')` — Pre-create skill, apply without force (non-TTY), verify untouched
    - `test('apply without skills field works normally')` — Preset with no skills field, verify no skill-related output
  - Use existing `createTempEnv()` and helper functions.

  **Must NOT do**:
  - Do NOT modify existing test cases or helpers
  - Do NOT mock filesystem

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 5)
  - **Blocks**: Tasks 7, 8
  - **Blocked By**: Task 4 (apply integration must exist)

  **References**:
  - `src/commands/__tests__/apply.test.ts` — All existing helpers and test patterns.
  - `src/commands/apply.ts` — (Task 4) Updated apply flow with skill deployment.

  **Acceptance Criteria**:
  - [x] `bun test src/commands/__tests__/apply.test.ts` — all pass (old + new)
  - [x] At least 5 new tests in `describe('skill deployment')`

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All apply tests pass including skill deployment
    Tool: Bash
    Steps:
      1. Run: bun test src/commands/__tests__/apply.test.ts 2>&1
      2. Assert: 0 failures
    Expected Result: All old + new tests pass
    Evidence: .sisyphus/evidence/task-6-integration-tests.txt
  ```

  **Commit**: YES
  - Message: `test(apply): add integration tests for skill deployment`
  - Files: `src/commands/__tests__/apply.test.ts`
  - Pre-commit: `bun test`

---

- [x] 7. Update AGENTS.md

  **What to do**:
  - Update STRUCTURE section: add `skills/` directory under `src/presets/apex/`
  - Update WHERE TO LOOK table: add row for skill deployment (`src/core/skills.ts`)
  - Update PRESET RESOLUTION ORDER: mention skill deployment step
  - Add note about `~/.agents/skills/` as target path

  **Must NOT do**: Do NOT rewrite entire file.

  **Recommended Agent Profile**: `quick`

  **Parallelization**: Wave 4 (with Task 8). Blocked by Tasks 5, 6.

  **References**: `AGENTS.md` (full file)

  **Acceptance Criteria**:
  - [x] AGENTS.md mentions skills.ts and skill deployment
  - [x] AGENTS.md mentions ~/.agents/skills/ target path

  **QA Scenarios:**
  ```
  Scenario: AGENTS.md documents skill deployment
    Tool: Bash (grep)
    Steps:
      1. grep 'skills.ts' AGENTS.md
      2. grep '.agents/skills' AGENTS.md
    Evidence: .sisyphus/evidence/task-7-agents-md.txt
  ```

  **Commit**: YES (group with Task 8)
  - Message: `docs: update AGENTS.md and README.md for skill deployment`

---

- [x] 8. Update README.md

  **What to do**:
  - Update apply command description: mention skill deployment
  - Add section about skills in presets (after Remote Presets section)
  - Document collision behavior (prompt, --force, non-TTY)

  **Must NOT do**: Do NOT rewrite unrelated sections.

  **Recommended Agent Profile**: `quick`

  **Parallelization**: Wave 4 (with Task 7). Blocked by Tasks 5, 6.

  **References**: `README.md` (full file)

  **Acceptance Criteria**:
  - [x] README.md documents skill deployment feature
  - [x] README.md mentions collision handling

  **QA Scenarios:**
  ```
  Scenario: README.md documents skills
    Tool: Bash (grep)
    Steps:
      1. grep -c 'skill' README.md (assert > 0)
      2. grep 'Overwrite' README.md (assert collision docs exist)
    Evidence: .sisyphus/evidence/task-8-readme-md.txt
  ```

  **Commit**: YES (group with Task 7)
  - Message: `docs: update AGENTS.md and README.md for skill deployment`

---

## Commit Strategy

| Wave | Commit Message | Files | Pre-commit |
|------|---------------|-------|------------|
| 1 | `feat(core): add skill deployment module` | `src/core/skills.ts` | `bun run typecheck` |
| 1 | `feat(preset): add skills field to PresetManifest and apex preset` | `src/core/types.ts`, `src/presets/apex/preset.json5` | `bun run typecheck` |
| 1 | `feat(preset): add prompt-guard skill to apex preset` | `src/presets/apex/skills/prompt-guard/SKILL.md` | — |
| 2 | `feat(apply): integrate skill deployment into apply command` | `src/commands/apply.ts` | `bun test` |
| 3 | `test(core): add unit tests for skill deployment` | `src/core/__tests__/skills.test.ts` | `bun test` |
| 3 | `test(apply): add integration tests for skill deployment` | `src/commands/__tests__/apply.test.ts` | `bun test` |
| 4 | `docs: update AGENTS.md and README.md for skill deployment` | `AGENTS.md`, `README.md` | `bun test` |

---

## Success Criteria

### Verification Commands
```bash
bun run typecheck           # Expected: no errors
bun test                    # Expected: all tests pass (0 failures)
bun run build               # Expected: builds successfully
bun run src/cli.ts apply apex --dry-run  # Expected: shows skills to install
```

### Final Checklist
- [x] `src/core/skills.ts` exists with `copySkills` function
- [x] `PresetManifest` has `skills?: string[]` field
- [x] `src/commands/apply.ts` calls skill copy after workspace files
- [x] `src/presets/apex/skills/prompt-guard/SKILL.md` exists with agent-oriented content
- [x] `src/presets/apex/preset.json5` has `skills: ['prompt-guard']`
- [x] Interactive prompt on skill collision (skips in non-TTY)
- [x] `--force` overwrites skills without prompt
- [x] `--dry-run` shows skills that would be installed
- [x] `install` command inherits skill behavior from apply
- [x] All existing tests still pass
- [x] No new npm dependencies
- [x] `src/core/workspace.ts` NOT modified
- [x] `src/core/merge.ts` NOT modified
- [x] `src/core/remote.ts` NOT modified
