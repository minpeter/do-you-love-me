# COMMANDS KNOWLEDGE BASE

## OVERVIEW

`src/commands` implements user-facing CLI flows (`list`, `apply`, `export`, `diff`) and composes core modules for path resolution, preset loading, merge/filter logic, backups, workspace files, and skills.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Apply/install behavior | `src/commands/apply.ts` | Clean mode, backup mode, merge + workspace + skills + restart notice |
| Diff output behavior | `src/commands/diff.ts` | Structural config diff + workspace add/replace report |
| Export behavior | `src/commands/export.ts` | Preset creation + sensitive-field filtering + workspace export |
| List output behavior | `src/commands/list.ts` | Built-in + user preset listing and JSON output mode |
| CLI wiring for install shortcut | `src/cli.ts` | `install` delegates to `applyCommand('apex')` |

## FLOW INVARIANTS

- `apply`: resolve preset (remote ref may clone/cache) -> resolve workspace dir from current config -> backup/clean handling -> merge config -> write config -> copy workspace files -> install skills -> print restart instruction.
- `diff`: load preset + current config -> normalize legacy keys -> compute structural diff from raw preset config -> optionally print JSON.
- `export`: read current config -> filter sensitive fields -> write preset manifest -> export workspace files -> rewrite manifest.
- `list`: show both built-in and user presets, with optional JSON output.

## CONVENTIONS (LOCAL)

- Keep command functions thin orchestration layers; delegate mechanics to `src/core/*`.
- Preserve friendly CLI output with `picocolors`; errors must be actionable.
- Keep `--dry-run`, `--clean`, `--no-backup`, and `--force` semantics stable across apply/install paths.
- Document `--dry-run` as no final apply writes (not no-op on remote/cache resolution).
- Maintain behavior parity between `install` and `apply apex`.

## ANTI-PATTERNS

- Do not bypass backup logic when not explicitly in `--no-backup` mode.
- Do not apply/export raw config without running sensitive-field filtering where required.
- Do not change workspace file rules in commands; source them from core constants/workspace helpers.
- Do not describe `diff` output as an exact preview of `apply`; `apply` filters sensitive paths before merge.
- Do not remove the post-apply restart reminder unless runtime behavior changes.

## TEST CHECKLIST

- Run `bun test src/commands/__tests__` after command changes.
- For `apply.ts` changes, run `src/commands/__tests__/apply.test.ts` and integration tests.
- For output shape changes, verify both human-readable and `--json` modes.
