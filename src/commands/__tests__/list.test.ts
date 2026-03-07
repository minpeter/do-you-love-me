import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import { listCommand } from '../list';

const BUILTIN_NAME_LINE_PATTERN = /^\s{2}\S+ \[builtin\]$/;

describe('listCommand', () => {
  let output: string[] = [];
  const originalLog = console.log;
  let tempStateDir: string;

  beforeEach(async () => {
    output = [];
    console.log = (...args: unknown[]) => {
      const stripped = stripVTControlCharacters(args.map(String).join(' '));
      output.push(stripped);
    };

    tempStateDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'openclaw-list-test-')
    );
    process.env.OPENCLAW_STATE_DIR = tempStateDir;
    Reflect.deleteProperty(process.env, 'OPENCLAW_CONFIG_PATH');
  });

  afterEach(async () => {
    console.log = originalLog;

    Reflect.deleteProperty(process.env, 'OPENCLAW_STATE_DIR');
    Reflect.deleteProperty(process.env, 'OPENCLAW_CONFIG_PATH');

    if (tempStateDir) {
      await fs.rm(tempStateDir, { recursive: true, force: true });
    }
  });

  test('lists built-in presets (1 entry) with expected fields', async () => {
    await listCommand();

    const combined = output.join('\n');
    expect(combined).toContain('apex');
    expect(combined).toContain('[builtin]');

    const nameLines = output.filter((line) =>
      BUILTIN_NAME_LINE_PATTERN.test(line)
    );
    expect(nameLines.length).toBe(1);

    const versionLines = output.filter((line) =>
      line.trimStart().startsWith('v')
    );
    expect(versionLines.length).toBe(1);
  });

  test('--json flag outputs valid JSON array', async () => {
    await listCommand({ json: true });

    const json = JSON.parse(output.join('\n')) as Record<string, unknown>[];
    expect(Array.isArray(json)).toBe(true);
    expect(json).toHaveLength(1);

    for (const preset of json) {
      expect(typeof preset.name).toBe('string');
      expect(typeof preset.description).toBe('string');
      expect(typeof preset.version).toBe('string');
      expect(preset.builtin).toBe(true);
    }
  });
});
