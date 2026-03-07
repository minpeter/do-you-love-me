import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildManifest,
  buildPushCommand,
  parseRepo,
  prepareStagingDir,
} from '../upload';

describe('upload: parseRepo', () => {
  test('parses owner/repo shorthand', () => {
    const result = parseRepo('minpeter/my-preset');
    expect(result).toEqual({ owner: 'minpeter', repo: 'my-preset' });
  });

  test('parses full GitHub URL', () => {
    const result = parseRepo('https://github.com/minpeter/demo-researcher');
    expect(result).toEqual({ owner: 'minpeter', repo: 'demo-researcher' });
  });

  test('strips trailing slashes', () => {
    const result = parseRepo('minpeter/my-preset///');
    expect(result).toEqual({ owner: 'minpeter', repo: 'my-preset' });
  });

  test('strips trailing slashes from URL', () => {
    const result = parseRepo('https://github.com/minpeter/my-preset/');
    expect(result).toEqual({ owner: 'minpeter', repo: 'my-preset' });
  });

  test('throws on empty input', () => {
    expect(() => parseRepo('')).toThrow('Invalid GitHub repository');
  });

  test('throws on single segment', () => {
    expect(() => parseRepo('minpeter')).toThrow('Invalid GitHub repository');
  });

  test('throws on three segments', () => {
    expect(() => parseRepo('a/b/c')).toThrow('Invalid GitHub repository');
  });

  test('throws on URL with wrong segment count', () => {
    expect(() => parseRepo('https://github.com/minpeter')).toThrow(
      'Invalid GitHub repository'
    );
  });

  test('throws on URL with too many segments', () => {
    expect(() => parseRepo('https://github.com/minpeter/repo/extra')).toThrow(
      'Invalid GitHub repository'
    );
  });
});

describe('upload: buildManifest', () => {
  test('builds manifest with default description', () => {
    const manifest = buildManifest('my-preset', { key: 'value' }, [
      'AGENTS.md',
    ]);

    expect(manifest.name).toBe('my-preset');
    expect(manifest.description).toContain('Uploaded from OpenClaw on');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.config).toEqual({ key: 'value' });
    expect(manifest.workspaceFiles).toEqual(['AGENTS.md']);
  });

  test('builds manifest with custom description', () => {
    const manifest = buildManifest(
      'my-preset',
      {},
      ['AGENTS.md', 'SOUL.md'],
      'My custom preset'
    );

    expect(manifest.description).toBe('My custom preset');
  });

  test('builds manifest with empty config and no workspace files', () => {
    const manifest = buildManifest('empty', {}, []);

    expect(manifest.name).toBe('empty');
    expect(manifest.config).toEqual({});
    expect(manifest.workspaceFiles).toEqual([]);
  });

  test('includes skills when provided', () => {
    const manifest = buildManifest(
      'skill-preset',
      {},
      ['AGENTS.md'],
      'Skill preset',
      ['prompt-guard', 'tmux-opencode']
    );

    expect(manifest.skills).toEqual(['prompt-guard', 'tmux-opencode']);
  });
});

describe('upload: buildPushCommand', () => {
  test('uses normal push by default', () => {
    expect(buildPushCommand()).toEqual(['git', 'push', '-u', 'origin', 'main']);
  });

  test('adds force flag only when explicitly enabled', () => {
    expect(buildPushCommand(true)).toEqual([
      'git',
      'push',
      '-u',
      'origin',
      'main',
      '--force',
    ]);
  });
});

describe('upload: prepareStagingDir', () => {
  let tempWorkspaceDir: string;

  beforeEach(async () => {
    tempWorkspaceDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'upload-staging-test-workspace-')
    );
  });

  afterEach(async () => {
    if (tempWorkspaceDir) {
      await fs.rm(tempWorkspaceDir, { recursive: true, force: true });
    }
  });

  test('creates preset.json5 in staging dir', async () => {
    const manifest = buildManifest('test-preset', { foo: 'bar' }, []);
    const stagingDir = await prepareStagingDir(manifest, tempWorkspaceDir, []);

    try {
      const manifestPath = path.join(stagingDir, 'preset.json5');
      const stat = await fs.stat(manifestPath);
      expect(stat.isFile()).toBe(true);

      const content = await fs.readFile(manifestPath, 'utf-8');
      expect(content).toContain('test-preset');
      expect(content).toContain('foo');
      expect(content).toContain('bar');
    } finally {
      await fs.rm(stagingDir, { recursive: true, force: true });
    }
  });

  test('copies workspace files flat into staging dir', async () => {
    // Create workspace files
    await fs.writeFile(
      path.join(tempWorkspaceDir, 'AGENTS.md'),
      '# My Agent',
      'utf-8'
    );
    await fs.writeFile(
      path.join(tempWorkspaceDir, 'SOUL.md'),
      '# My Soul',
      'utf-8'
    );

    const manifest = buildManifest('test', {}, ['AGENTS.md', 'SOUL.md']);
    const stagingDir = await prepareStagingDir(manifest, tempWorkspaceDir, [
      'AGENTS.md',
      'SOUL.md',
    ]);

    try {
      const agentsContent = await fs.readFile(
        path.join(stagingDir, 'AGENTS.md'),
        'utf-8'
      );
      expect(agentsContent).toBe('# My Agent');

      const soulContent = await fs.readFile(
        path.join(stagingDir, 'SOUL.md'),
        'utf-8'
      );
      expect(soulContent).toBe('# My Soul');

      // Verify flat structure — no subdirectories
      const entries = await fs.readdir(stagingDir);
      expect(entries.sort()).toEqual(
        ['AGENTS.md', 'SOUL.md', 'preset.json5'].sort()
      );
    } finally {
      await fs.rm(stagingDir, { recursive: true, force: true });
    }
  });

  test('handles empty workspace file list', async () => {
    const manifest = buildManifest('empty', { identity: { name: 'Bot' } }, []);
    const stagingDir = await prepareStagingDir(manifest, tempWorkspaceDir, []);

    try {
      const entries = await fs.readdir(stagingDir);
      expect(entries).toEqual(['preset.json5']);
    } finally {
      await fs.rm(stagingDir, { recursive: true, force: true });
    }
  });

  test('manifest in staging dir contains workspaceFiles list', async () => {
    await fs.writeFile(
      path.join(tempWorkspaceDir, 'AGENTS.md'),
      '# Agent',
      'utf-8'
    );

    const manifest = buildManifest('test', {}, ['AGENTS.md']);
    const stagingDir = await prepareStagingDir(manifest, tempWorkspaceDir, [
      'AGENTS.md',
    ]);

    try {
      const content = await fs.readFile(
        path.join(stagingDir, 'preset.json5'),
        'utf-8'
      );
      expect(content).toContain('AGENTS.md');
      expect(content).toContain('workspaceFiles');
    } finally {
      await fs.rm(stagingDir, { recursive: true, force: true });
    }
  });

  test('copies skills directory into staging dir', async () => {
    const skillDir = path.join(tempWorkspaceDir, 'skills', 'my-skill');
    await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# My Skill', 'utf-8');
    await fs.writeFile(
      path.join(skillDir, 'scripts', 'run.sh'),
      '#!/bin/sh\necho "ok"\n',
      'utf-8'
    );

    const manifest = buildManifest('test', {}, [], undefined, ['my-skill']);
    const stagingDir = await prepareStagingDir(
      manifest,
      tempWorkspaceDir,
      [],
      ['my-skill']
    );

    try {
      const entry = await fs.readFile(
        path.join(stagingDir, 'skills', 'my-skill', 'SKILL.md'),
        'utf-8'
      );
      expect(entry).toBe('# My Skill');

      const script = await fs.readFile(
        path.join(stagingDir, 'skills', 'my-skill', 'scripts', 'run.sh'),
        'utf-8'
      );
      expect(script).toContain('echo "ok"');
    } finally {
      await fs.rm(stagingDir, { recursive: true, force: true });
    }
  });
});

describe('upload: sensitive field filtering', () => {
  let tempStateDir: string;

  beforeEach(async () => {
    tempStateDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'upload-sensitive-test-')
    );
    process.env.OPENCLAW_STATE_DIR = tempStateDir;
    Reflect.deleteProperty(process.env, 'OPENCLAW_CONFIG_PATH');
  });

  afterEach(async () => {
    Reflect.deleteProperty(process.env, 'OPENCLAW_STATE_DIR');
    Reflect.deleteProperty(process.env, 'OPENCLAW_CONFIG_PATH');

    if (tempStateDir) {
      await fs.rm(tempStateDir, { recursive: true, force: true });
    }
  });

  test('sensitive fields are excluded from generated manifest config', () => {
    // Use filterSensitiveFields directly via buildManifest
    // The upload command calls filterSensitiveFields before buildManifest
    // We test the integration by importing filterSensitiveFields
    const { filterSensitiveFields } = require('../../core/sensitive-filter');

    const config = {
      identity: { name: 'MyBot' },
      auth: { token: 'secret-token' },
      env: { SECRET: 'hidden' },
      meta: { internal: 'data' },
      tools: { allow: ['read', 'write'] },
    };

    const filtered = filterSensitiveFields(config);
    const manifest = buildManifest('test', filtered, []);

    const manifestConfig = manifest.config as Record<string, unknown>;
    expect(manifestConfig.identity).toEqual({ name: 'MyBot' });
    expect(manifestConfig.tools).toEqual({ allow: ['read', 'write'] });
    expect(manifestConfig.auth).toBeUndefined();
    expect(manifestConfig.env).toBeUndefined();
    expect(manifestConfig.meta).toBeUndefined();
  });
});

describe('upload: uploadCommand error paths', () => {
  let output: string[] = [];
  const originalLog = console.log;
  let tempStateDir: string;

  beforeEach(async () => {
    output = [];
    console.log = (...args: unknown[]) => {
      output.push(args.map(String).join(' '));
    };

    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upload-cmd-test-'));
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

  test('throws on invalid repo argument', async () => {
    const { uploadCommand } = await import('../upload');
    return expect(uploadCommand('invalid-no-slash')).rejects.toThrow(
      'Invalid GitHub repository'
    );
  });
});

describe('upload: uploadCommand staging cleanup', () => {
  let tempStateDir: string;
  let tempBinDir: string;
  let markerPath: string;
  let originalPath: string;

  beforeEach(async () => {
    tempStateDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'upload-cleanup-test-')
    );
    tempBinDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'upload-cleanup-bin-')
    );
    markerPath = path.join(tempStateDir, 'staging-dir.txt');
    originalPath = process.env.PATH ?? '';

    const ghPath = path.join(tempBinDir, 'gh');
    const gitPath = path.join(tempBinDir, 'git');

    await fs.writeFile(
      ghPath,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "gh version 0.0.0"
  exit 0
fi

if [ "$1" = "auth" ] && [ "$2" = "status" ]; then
  exit 0
fi

if [ "$1" = "repo" ] && [ "$2" = "view" ]; then
  echo '{"name":"repo"}'
  exit 0
fi

echo "unexpected gh command: $*" >&2
exit 1
`,
      'utf-8'
    );

    await fs.writeFile(
      gitPath,
      `#!/bin/sh
if [ "$1" = "init" ]; then
  mkdir -p .git
  exit 0
fi

if [ "$1" = "add" ] || [ "$1" = "commit" ] || [ "$1" = "branch" ] || [ "$1" = "remote" ]; then
  exit 0
fi

if [ "$1" = "push" ]; then
  mkdir -p cleanup-gate
  chmod 000 cleanup-gate
  sleep 0.2
  chmod 755 cleanup-gate
  printf "%s" "$PWD" > "$APEX_UPLOAD_TEST_STAGING_PATH"
  exit 0
fi

echo "unexpected git command: $*" >&2
exit 1
`,
      'utf-8'
    );

    await fs.chmod(ghPath, 0o755);
    await fs.chmod(gitPath, 0o755);

    process.env.OPENCLAW_STATE_DIR = tempStateDir;
    Reflect.deleteProperty(process.env, 'OPENCLAW_CONFIG_PATH');
    process.env.APEX_UPLOAD_TEST_STAGING_PATH = markerPath;
    process.env.PATH = `${tempBinDir}:${originalPath}`;
  });

  afterEach(async () => {
    Reflect.deleteProperty(process.env, 'OPENCLAW_STATE_DIR');
    Reflect.deleteProperty(process.env, 'OPENCLAW_CONFIG_PATH');
    Reflect.deleteProperty(process.env, 'APEX_UPLOAD_TEST_STAGING_PATH');
    process.env.PATH = originalPath;

    if (tempBinDir) {
      await fs.rm(tempBinDir, { recursive: true, force: true });
    }

    if (tempStateDir) {
      await fs.rm(tempStateDir, { recursive: true, force: true });
    }
  });

  test('waits for git push completion before staging cleanup', async () => {
    const { uploadCommand } = await import('../upload');

    await uploadCommand('owner/repo');

    const stagingDir = (await fs.readFile(markerPath, 'utf-8')).trim();
    expect(stagingDir.length).toBeGreaterThan(0);
    await expect(fs.stat(stagingDir)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
