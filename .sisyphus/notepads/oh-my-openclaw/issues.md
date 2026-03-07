# Issues & Gotchas

## [2026-03-01] Known Issues at Start

- JSON5 comment loss: writing JSON5 will destroy comments in original openclaw.json. MVP accepts this with clear warning + full backup before apply.
- Bun static asset import syntax: `import x from './file' with { type: 'file' }` — this is Bun-specific, not standard TypeScript/ESM
- Test isolation: ALL tests MUST use temp directories (never touch real ~/.openclaw/)
- Preset keys MUST all be valid OpenClaw config keys (no custom metadata keys in config section)

## [2026-03-01] Task 8 Sensitive Fields Filter
- Initial implementation dropped recursion path context, causing misses for  and .
- Fixed by passing  into recursive  calls.

## [2026-03-01] Task 8 Sensitive Fields Filter
- Initial implementation dropped recursion path context, causing misses for `channels.*.token` and `models.providers.*.apiKey`.
- Fixed by passing `currentPath` into recursive `filterSensitiveFields` calls.
