# Apex Preset — Learnings

## [2026-03-01] Session init: ses_35b071bd0ffey1SGIgdJFTRg4h

### Codebase Conventions
- Presets live in `src/presets/<name>/` with `preset.json5` + workspace MD files
- `src/presets/index.ts` line 10: `presetNames` array — just add 'apex' to register
- `tools.allow` array is currently used in developer preset (NOT `tools.profile: 'full'`)
- developer preset `tools.allow`: `['exec', 'process', 'read', 'write', 'edit', 'apply_patch']`
- Existing AGENTS.md files are SHORT (4 lines) — apex will be much richer
- Existing SOUL.md files are SHORT (3 lines) — apex SOUL.md will be rich/adaptive
- `workspaceFiles` array in preset.json5 tells apply command which MD files to copy

### Developer Preset Structure (canonical reference):
```json5
{
  name: 'developer',
  description: '...',
  version: '1.0.0',
  author: 'oh-my-openclaw',
  tags: ['coding', 'developer', 'elevated'],
  builtin: true,
  config: {
    identity: { name: 'DevBot', theme: 'coding assistant', emoji: '💻' },
    agents: { defaults: { model: { primary: 'anthropic/claude-sonnet-4-5' } } },
    tools: { allow: [...] },
  },
  workspaceFiles: ['AGENTS.md', 'SOUL.md'],
}
```

### Key Decisions
- `tools.profile: 'full'` status is UNCERTAIN — prefer explicit `tools.allow` with ALL tools
- `identity` top-level key: follow existing pattern (all 4 presets use it), even if OpenClaw docs say otherwise
- Apex model: `anthropic/claude-sonnet-4-5` (same as developer preset)
- Apex emoji: ⚡
- Workspace files: AGENTS.md, SOUL.md, TOOLS.md, USER.md, IDENTITY.md (5 total)

### Task 1 Validation Note
- `src/presets/apex/preset.json5` created using developer preset structure with explicit `tools.allow` list (15 entries), no sensitive keys, and `loadPreset('./src/presets/apex')` verification result `apex 5` captured in `.sisyphus/evidence/task-1-apex-preset-load.txt`
- Created comprehensive SOUL.md, IDENTITY.md, and USER.md for the 'apex' preset.
- Established adaptive personality framework with specific sections for core truths, communication, capabilities, boundaries, and philosophy.
- Designed USER.md as a template with clear placeholder sections for high customization.
- Ensured 'adapt' concept is present in SOUL.md as per requirements.
## TOOLS.md Creation Learning
- Successfully aggregated large-scale documentation from multiple remote sources (Gist, Raw GitHub) into a single reference file.
- Preserved complex formatting including tables, code blocks, and multi-language characters.
- Implemented clear integration guidelines to bridge separate tools (offense vs defense).
- Verified file size (>490 lines) and key term density (48 occurrences) as part of QA.
- Created comprehensive AGENTS.md for apex preset with security-first guidelines, channel rules, and development workflow instructions.
- Verified content against required sections and keywords.
- Added `src/presets/__tests__/apex.test.ts` with 6 assertions covering load, metadata, workspace files (exact 5), required config sections, builtin flag, and sensitive-key absence checks.
- Verified registration and stability: `bun test` (106 pass), `bun run typecheck` (tsc clean), `bun src/cli.ts list` includes `apex [builtin]`; evidence stored in `.sisyphus/evidence/task-5-registration.txt`.

## Task 6 Binary QA Learning
- For `OPENCLAW_STATE_DIR` overrides, workspace markdown files are copied to `<stateDir>/workspace/` (not directly under `<stateDir>`).
- Compiled binary QA path is stable via `./dist/oh-my-openclaw list` + `./dist/oh-my-openclaw apply apex` with temp `openclaw.json`.
- Current native binary size remains `58M`, safely below the `<100MB` threshold.
- Full reproducible output for build/list/apply/size validation is recorded in `.sisyphus/evidence/task-6-binary-apex.txt`.
