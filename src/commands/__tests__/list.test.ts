import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { listCommand } from '../list';

describe('listCommand', () => {
  let output: string[] = [];
  const originalLog = console.log;
  let tempStateDir: string;

  beforeEach(async () => {
    output = [];
    console.log = (...args: unknown[]) => {
      output.push(args.map(String).join(' '));
    };

    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-list-test-'));
    process.env.OPENCLAW_STATE_DIR = tempStateDir;
    delete process.env.OPENCLAW_CONFIG_PATH;
  });

  afterEach(async () => {
    console.log = originalLog;

    delete process.env.OPENCLAW_STATE_DIR;
    delete process.env.OPENCLAW_CONFIG_PATH;

    if (tempStateDir) {
      await fs.rm(tempStateDir, { recursive: true, force: true });
    }
  });

  test('lists built-in presets (5 entries) with expected fields', async () => {
    await listCommand();

    const combined = output.join('\n');
    expect(combined).toContain('default');
    expect(combined).toContain('developer');
    expect(combined).toContain('researcher');
    expect(combined).toContain('creative');
    expect(combined).toContain('[builtin]');

    const nameLines = output.filter((line) => /^\s{2}\S+ \[builtin\]$/.test(line));
    expect(nameLines.length).toBe(5);

    const versionLines = output.filter((line) => line.trimStart().startsWith('v'));
    expect(versionLines.length).toBe(5);
  });

  test('--json flag outputs valid JSON array', async () => {
    await listCommand({ json: true });

    const json = JSON.parse(output.join('\n')) as Array<Record<string, unknown>>;
    expect(Array.isArray(json)).toBe(true);
    expect(json).toHaveLength(5);

    for (const preset of json) {
      expect(typeof preset.name).toBe('string');
      expect(typeof preset.description).toBe('string');
      expect(typeof preset.version).toBe('string');
      expect(preset.builtin).toBe(true);
    }
  });
});
