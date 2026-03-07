import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { diffCommand } from '../diff';

const ADDED_KEY_PATTERN = /identity|agents|tools/;
const INVALID_PRESET_JSON_PATTERN = /Invalid JSON5 in .*preset\.json5:/;

describe('diffCommand', () => {
  let output: string[] = [];
  const originalLog = console.log;
  let tempStateDir: string;

  beforeEach(async () => {
    output = [];
    console.log = (...args: unknown[]) => {
      output.push(args.map(String).join(' '));
    };

    tempStateDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'openclaw-diff-test-')
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

  test('shows added keys (green +) when current config is missing preset keys', async () => {
    // Empty config — all preset keys will be "added"
    const configPath = path.join(tempStateDir, 'openclaw.json');
    await fs.writeFile(configPath, '{}', 'utf-8');
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    await diffCommand('apex');

    const combined = output.join('\n');
    // apex preset has identity, agents, tools keys
    expect(combined).toContain('+');
    // Should show added keys from apex preset
    expect(combined).toMatch(ADDED_KEY_PATTERN);
  });

  test('shows changed values with old → new format', async () => {
    const configPath = path.join(tempStateDir, 'openclaw.json');
    // Set identity.name to something different from apex preset (Apex)
    await fs.writeFile(
      configPath,
      JSON.stringify({ identity: { name: 'OldBot', emoji: '🦞' } }),
      'utf-8'
    );
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    await diffCommand('apex');

    const combined = output.join('\n');
    // Should show changed value with → separator
    expect(combined).toContain('→');
    expect(combined).toContain('OldBot');
    expect(combined).toContain('Apex');
  });

  test('--verbose prints detailed operation logs', async () => {
    const configPath = path.join(tempStateDir, 'openclaw.json');
    await fs.writeFile(configPath, '{}', 'utf-8');
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    await diffCommand('apex', { verbose: true });

    const combined = output.join('\n');
    expect(combined).toContain('[verbose]');
    expect(combined).toContain('Resolved paths:');
    expect(combined).toContain('Computed config diff');
  });

  test('shows removed keys (null) in red with - prefix', async () => {
    // Create a custom preset with null value (meaning delete)
    const presetsDir = path.join(
      tempStateDir,
      'apex',
      'presets',
      'test-remove'
    );
    await fs.mkdir(presetsDir, { recursive: true });
    await fs.writeFile(
      path.join(presetsDir, 'preset.json5'),
      JSON.stringify({
        name: 'test-remove',
        description: 'Test preset with removal',
        version: '1.0.0',
        config: {
          tools: null,
        },
      }),
      'utf-8'
    );

    const configPath = path.join(tempStateDir, 'openclaw.json');
    await fs.writeFile(
      configPath,
      JSON.stringify({ tools: { allow: ['read'] } }),
      'utf-8'
    );
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    await diffCommand('test-remove');

    const combined = output.join('\n');
    // Should show removed key with - prefix
    expect(combined).toContain('-');
    expect(combined).toContain('tools');
  });

  test('--json produces valid JSON diff', async () => {
    const configPath = path.join(tempStateDir, 'openclaw.json');
    await fs.writeFile(
      configPath,
      JSON.stringify({ identity: { name: 'OldBot' } }),
      'utf-8'
    );
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    await diffCommand('apex', { json: true });

    const jsonOutput = output.join('\n');
    const parsed = JSON.parse(jsonOutput) as {
      preset: string;
      changes: { path: string; type: string }[];
      workspaceFiles: { toAdd: string[]; toReplace: string[] };
    };

    expect(parsed.preset).toBe('apex');
    expect(Array.isArray(parsed.changes)).toBe(true);
    expect(typeof parsed.workspaceFiles).toBe('object');
    expect(Array.isArray(parsed.workspaceFiles.toAdd)).toBe(true);
    expect(Array.isArray(parsed.workspaceFiles.toReplace)).toBe(true);

    // After legacy migration normalization, identity moves to agents.list
    // So changes should include agents.list (different arrays with OldBot vs Apex)
    const listChange = parsed.changes.find((c) => c.path === 'agents.list');
    expect(listChange).toBeDefined();
    expect(listChange?.type).toBe('changed');
  });

  test('--verbose with --json still emits parseable JSON on stdout', async () => {
    const configPath = path.join(tempStateDir, 'openclaw.json');
    await fs.writeFile(
      configPath,
      JSON.stringify({ identity: { name: 'OldBot' } }),
      'utf-8'
    );
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    await diffCommand('apex', { json: true, verbose: true });

    const jsonOutput = output.join('\n');
    const parsed = JSON.parse(jsonOutput) as {
      changes: { path: string; type: string }[];
      preset: string;
    };

    expect(parsed.preset).toBe('apex');
    expect(Array.isArray(parsed.changes)).toBe(true);
  });

  test('reports workspace file differences', async () => {
    const configPath = path.join(tempStateDir, 'openclaw.json');
    await fs.writeFile(configPath, '{}', 'utf-8');
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    await diffCommand('apex', { json: true });

    const jsonOutput = output.join('\n');
    const parsed = JSON.parse(jsonOutput) as {
      preset: string;
      changes: { path: string; type: string }[];
      workspaceFiles: { toAdd: string[]; toReplace: string[] };
    };

    expect(parsed.workspaceFiles.toAdd).toContain('AGENTS.md');
    expect(parsed.workspaceFiles.toAdd).toContain('SOUL.md');
    expect(parsed.workspaceFiles.toAdd).toContain('USER.md');
    expect(parsed.workspaceFiles.toAdd).toContain('IDENTITY.md');
  });

  test('shows no differences when config matches preset', async () => {
    // Create a minimal preset with no config
    const presetsDir = path.join(
      tempStateDir,
      'apex',
      'presets',
      'empty-preset'
    );
    await fs.mkdir(presetsDir, { recursive: true });
    await fs.writeFile(
      path.join(presetsDir, 'preset.json5'),
      JSON.stringify({
        name: 'empty-preset',
        description: 'Empty preset for testing',
        version: '1.0.0',
        config: {},
        workspaceFiles: [],
      }),
      'utf-8'
    );

    const configPath = path.join(tempStateDir, 'openclaw.json');
    await fs.writeFile(configPath, '{}', 'utf-8');
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    await diffCommand('empty-preset');

    const combined = output.join('\n');
    expect(combined).toContain('No differences');
  });

  test('throws error for unknown preset', async () => {
    const configPath = path.join(tempStateDir, 'openclaw.json');
    await fs.writeFile(configPath, '{}', 'utf-8');
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    await expect(diffCommand('nonexistent-preset-xyz')).rejects.toThrow(
      "Preset 'nonexistent-preset-xyz' not found. Run 'apex list' to see available presets."
    );
  });

  test('supports remote preset references in owner/repo format', async () => {
    const configPath = path.join(tempStateDir, 'openclaw.json');
    await fs.writeFile(configPath, '{}', 'utf-8');
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    const cachePath = path.join(
      tempStateDir,
      'apex',
      'presets',
      'minpeter--demo-researcher'
    );
    await fs.mkdir(cachePath, { recursive: true });
    await fs.writeFile(
      path.join(cachePath, 'preset.json5'),
      JSON.stringify({
        name: 'demo-researcher',
        description: 'Cached remote preset for diff test',
        version: '1.0.0',
        config: {
          identity: { name: 'RemoteBot' },
        },
      }),
      'utf-8'
    );

    await diffCommand('minpeter/demo-researcher', { json: true });

    const jsonOutput = output.at(-1);
    expect(jsonOutput).toBeDefined();
    const parsed = JSON.parse(jsonOutput as string) as {
      preset: string;
      changes: { path: string; type: string }[];
      workspaceFiles: { toAdd: string[]; toReplace: string[] };
    };

    expect(parsed.preset).toBe('minpeter/demo-researcher');
    expect(Array.isArray(parsed.changes)).toBe(true);
    expect(typeof parsed.workspaceFiles).toBe('object');
    expect(Array.isArray(parsed.workspaceFiles.toAdd)).toBe(true);
    expect(Array.isArray(parsed.workspaceFiles.toReplace)).toBe(true);

    await expect(fs.stat(cachePath)).resolves.toBeDefined();
  }, 60_000);

  test('throws on invalid current config JSON5', async () => {
    const configPath = path.join(tempStateDir, 'openclaw.json');
    await fs.writeFile(configPath, '{ invalid', 'utf-8');
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    await expect(diffCommand('apex')).rejects.toThrow(
      `Invalid JSON5 in ${configPath}:`
    );
  });

  test('throws when user preset exists but manifest is invalid', async () => {
    const userPresetDir = path.join(tempStateDir, 'apex', 'presets', 'apex');
    await fs.mkdir(userPresetDir, { recursive: true });
    await fs.writeFile(path.join(userPresetDir, 'preset.json5'), '{', 'utf-8');

    const configPath = path.join(tempStateDir, 'openclaw.json');
    await fs.writeFile(configPath, '{}', 'utf-8');
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    await expect(diffCommand('apex')).rejects.toThrow(
      INVALID_PRESET_JSON_PATTERN
    );
  });

  test('redacts sensitive values from diff output', async () => {
    const presetDir = path.join(
      tempStateDir,
      'apex',
      'presets',
      'sensitive-diff'
    );
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(
      path.join(presetDir, 'preset.json5'),
      JSON.stringify({
        name: 'sensitive-diff',
        description: 'Sensitive redaction test',
        version: '1.0.0',
        config: {
          identity: { name: 'NewBot' },
          env: { OPENAI_API_KEY: 'preset-secret' },
          gateway: { auth: { token: 'preset-token' } },
          models: { providers: { custom: { apiKey: 'preset-model-key' } } },
        },
      }),
      'utf-8'
    );

    const configPath = path.join(tempStateDir, 'openclaw.json');
    await fs.writeFile(
      configPath,
      JSON.stringify({
        identity: { name: 'OldBot' },
        env: { OPENAI_API_KEY: 'current-secret' },
        gateway: { auth: { token: 'current-token' } },
        models: { providers: { custom: { apiKey: 'current-model-key' } } },
      }),
      'utf-8'
    );
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    await diffCommand('sensitive-diff', { json: true });

    const combined = output.join('\n');
    expect(combined).not.toContain('current-secret');
    expect(combined).not.toContain('preset-secret');
    expect(combined).not.toContain('current-token');
    expect(combined).not.toContain('preset-token');
    expect(combined).not.toContain('current-model-key');
    expect(combined).not.toContain('preset-model-key');
    expect(combined).toContain('OldBot');
    expect(combined).toContain('NewBot');
  });
});
