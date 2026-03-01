# CORE KNOWLEDGE BASE

## OVERVIEW

`src/core` contains shared invariants used by all command flows: merge semantics, path resolution, backup, sensitive-field filtering, preset I/O, workspace and skills operations, and remote preset cache handling.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Change merge behavior | `src/core/merge.ts` | `null` deletes keys; arrays replace |
| Add/remove sensitive keys | `src/core/constants.ts`, `src/core/sensitive-filter.ts` | Pattern-based path matching (`*` segment support) |
| Adjust OpenClaw path layout | `src/core/config-path.ts` | Path priority is env-first (`OPENCLAW_CONFIG_PATH`, `OPENCLAW_STATE_DIR`) |
| Update backup behavior | `src/core/backup.ts` | Timestamped backups for config/workspace files |
| Change preset manifest handling | `src/core/preset-loader.ts`, `src/core/json5-utils.ts` | Reads/writes `preset.json5` with validation |
| Change remote GitHub logic | `src/core/remote.ts` | `owner/repo` parse, clone timeout, cache reuse/force refresh |
| Change workspace file operations | `src/core/workspace.ts`, `src/core/constants.ts` | Uses `WORKSPACE_FILES` allowlist |
| Change skill install behavior | `src/core/skills.ts` | Copies preset skill dirs to `~/.agents/skills` |

## MODULE CONTRACTS

- `merge.ts`: pure merge function; no I/O; does not mutate inputs.
- `config-path.ts`: single source of truth for state/config/preset/backups dirs.
- `sensitive-filter.ts`: export/diff safety layer; removed fields must stay removed.
- `preset-loader.ts`: strict manifest field validation (`name`, `description`, `version`).
- `remote.ts`: only public GitHub clone path; cached directory key format is `owner--repo`.
- `workspace.ts`: resolves workspace path from config first, then falls back to state dir.

## CONVENTIONS (LOCAL)

- Keep fs errors explicit: handle known codes (`ENOENT`) and rethrow unknown failures.
- Keep cross-module helpers in core; command files should orchestrate, not re-implement.
- Maintain pure utility boundaries for merge/filter helpers (no logging inside them).
- Prefer small focused functions with typed return contracts over ad-hoc object shapes.

## ANTI-PATTERNS

- Do not change `deepMerge` behavior without updating tests in `src/core/__tests__/merge.test.ts`.
- Do not bypass `filterSensitiveFields` in export/diff paths.
- Do not alter path-priority semantics casually; env overrides are external contracts.
- Do not silently swallow remote clone failures; preserve explicit user-facing errors.

## TEST CHECKLIST

- Run `bun test src/core/__tests__` after core changes.
- Run `bun run check:types` when changing exported core types/contracts.
- For `remote.ts` changes, run `src/core/__tests__/remote.test.ts` with network access.
