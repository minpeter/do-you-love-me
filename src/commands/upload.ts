import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import pc from 'picocolors';

import { resolveOpenClawPaths } from '../core/config-path';
import {
  isFileNotFoundError,
  readJson5,
  stringifyJson5,
} from '../core/json5-utils';
import { filterSensitiveFields } from '../core/sensitive-filter';
import type { PresetManifest } from '../core/types';
import { listWorkspaceFiles, resolveWorkspaceDir } from '../core/workspace';

interface UploadOptions {
  create?: boolean;
  description?: string;
  force?: boolean;
  private?: boolean;
}

const TRAILING_SLASH_PATTERN = /\/+$/;

export function parseRepo(input: string): { owner: string; repo: string } {
  const normalized = input.replace(TRAILING_SLASH_PATTERN, '');

  if (normalized.startsWith('https://github.com/')) {
    const withoutPrefix = normalized.slice('https://github.com/'.length);
    const parts = withoutPrefix.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(
        `Invalid GitHub repository: '${input}'. Expected format: 'owner/repo' or 'https://github.com/owner/repo'`
      );
    }
    return { owner: parts[0], repo: parts[1] };
  }

  const parts = normalized.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(
      `Invalid GitHub repository: '${input}'. Expected format: 'owner/repo'`
    );
  }

  return { owner: parts[0], repo: parts[1] };
}

async function exec(
  command: string[],
  options?: { cwd?: string }
): Promise<{ stdout: string; exitCode: number }> {
  const proc = Bun.spawn(command, {
    cwd: options?.cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  return { stdout: stdout.trim(), exitCode };
}

async function execOrThrow(
  command: string[],
  errorMessage: string,
  options?: { cwd?: string }
): Promise<string> {
  const proc = Bun.spawn(command, {
    cwd: options?.cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const detail = stderr.trim() || stdout.trim();
    throw new Error(`${errorMessage}${detail ? `: ${detail}` : ''}`);
  }

  return stdout.trim();
}

async function checkGhInstalled(): Promise<void> {
  const { exitCode } = await exec(['gh', '--version']);
  if (exitCode !== 0) {
    throw new Error(
      'GitHub CLI (gh) is not installed or not in PATH. Install it from https://cli.github.com'
    );
  }
}

async function checkGhAuth(): Promise<void> {
  const { exitCode } = await exec(['gh', 'auth', 'status']);
  if (exitCode !== 0) {
    throw new Error(
      "GitHub CLI is not authenticated. Run 'gh auth login' first."
    );
  }
}

async function repoExists(owner: string, repo: string): Promise<boolean> {
  const { exitCode } = await exec([
    'gh',
    'repo',
    'view',
    `${owner}/${repo}`,
    '--json',
    'name',
  ]);
  return exitCode === 0;
}

async function createRepo(
  owner: string,
  repo: string,
  options: { private?: boolean; description?: string }
): Promise<void> {
  const args = ['gh', 'repo', 'create', `${owner}/${repo}`, '--confirm'];

  if (options.private) {
    args.push('--private');
  } else {
    args.push('--public');
  }

  if (options.description) {
    args.push('--description', options.description);
  }

  await execOrThrow(args, `Failed to create repository '${owner}/${repo}'`);
}

async function readCurrentConfig(
  configPath: string
): Promise<Record<string, unknown>> {
  try {
    const snapshot = await readJson5(configPath);
    return snapshot.parsed;
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return {};
    }
    throw error;
  }
}

export function buildManifest(
  repoName: string,
  filteredConfig: Record<string, unknown>,
  workspaceFileList: string[],
  description?: string
): PresetManifest {
  return {
    name: repoName,
    description:
      description ??
      `Uploaded from OpenClaw on ${new Date().toISOString().split('T')[0]}`,
    version: '1.0.0',
    config: filteredConfig,
    workspaceFiles: workspaceFileList,
  };
}

export async function prepareStagingDir(
  manifest: PresetManifest,
  workspaceDir: string,
  workspaceFileList: string[]
): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-upload-'));

  // Write preset.json5
  const manifestContent = stringifyJson5(
    manifest as unknown as Record<string, unknown>
  );
  await fs.writeFile(
    path.join(tmpDir, 'preset.json5'),
    manifestContent,
    'utf-8'
  );

  // Copy workspace files flat into staging dir
  for (const filename of workspaceFileList) {
    const src = path.join(workspaceDir, filename);
    const dest = path.join(tmpDir, filename);
    await fs.copyFile(src, dest);
  }

  return tmpDir;
}

async function pushToGitHub(
  stagingDir: string,
  owner: string,
  repo: string,
  force?: boolean
): Promise<void> {
  const cwd = stagingDir;

  await execOrThrow(['git', 'init'], 'Failed to initialize git repository', {
    cwd,
  });

  await execOrThrow(['git', 'add', '.'], 'Failed to stage files', { cwd });

  await execOrThrow(
    ['git', 'commit', '-m', 'Update preset via apex upload'],
    'Failed to create commit',
    { cwd }
  );

  await execOrThrow(
    ['git', 'branch', '-M', 'main'],
    'Failed to rename branch',
    { cwd }
  );

  await execOrThrow(
    [
      'git',
      'remote',
      'add',
      'origin',
      `https://github.com/${owner}/${repo}.git`,
    ],
    'Failed to add remote',
    { cwd }
  );

  await execOrThrow(buildPushCommand(force), 'Failed to push to GitHub', {
    cwd,
  });
}

export function buildPushCommand(force?: boolean): string[] {
  const command = ['git', 'push', '-u', 'origin', 'main'];
  if (force) {
    command.push('--force');
  }
  return command;
}

export async function uploadCommand(
  repoArg: string,
  options: UploadOptions = {}
): Promise<void> {
  const { owner, repo } = parseRepo(repoArg);

  // Verify gh CLI is available and authenticated
  await checkGhInstalled();
  await checkGhAuth();

  // Resolve local paths
  const paths = await resolveOpenClawPaths();
  const currentConfig = await readCurrentConfig(paths.configPath);
  const workspaceDir = resolveWorkspaceDir(currentConfig, paths.stateDir);

  // Collect workspace files
  const workspaceFileList = await listWorkspaceFiles(workspaceDir);
  if (workspaceFileList.length === 0) {
    console.log(
      pc.yellow(
        '⚠ No workspace files found. The preset will only contain config.'
      )
    );
  }

  // Filter sensitive fields from config
  const filteredConfig = filterSensitiveFields(currentConfig);
  const configKeyCount = Object.keys(currentConfig).length;
  const filteredKeyCount = Object.keys(filteredConfig).length;

  // Build manifest
  const manifest = buildManifest(
    repo,
    filteredConfig,
    workspaceFileList,
    options.description
  );

  // Handle repo creation/existence
  const exists = await repoExists(owner, repo);

  if (!(exists || options.create)) {
    throw new Error(
      `Repository '${owner}/${repo}' does not exist. Use --create to create it.`
    );
  }

  if (!exists && options.create) {
    await createRepo(owner, repo, {
      private: options.private,
      description: options.description,
    });
    console.log(
      pc.green(
        `Repository '${owner}/${repo}' created (${options.private ? 'private' : 'public'}).`
      )
    );
  }

  // Prepare staging directory with flat structure
  const stagingDir = await prepareStagingDir(
    manifest,
    workspaceDir,
    workspaceFileList
  );

  try {
    // Push to GitHub
    await pushToGitHub(stagingDir, owner, repo, options.force);
  } finally {
    // Cleanup staging directory
    await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {
      // Best-effort cleanup; ignore errors
    });
  }

  // Print summary
  console.log(
    pc.green(`\n✓ Preset uploaded to: https://github.com/${owner}/${repo}`)
  );
  if (workspaceFileList.length > 0) {
    console.log(`  Workspace files: ${workspaceFileList.join(', ')}`);
  }
  console.log('  Preset manifest: preset.json5');
  if (filteredKeyCount < configKeyCount) {
    console.log(
      pc.dim('  Note: Sensitive fields (auth, env, meta, etc.) were excluded.')
    );
  }
  console.log(pc.dim(`\n  Apply with: apex apply ${owner}/${repo}`));
}
