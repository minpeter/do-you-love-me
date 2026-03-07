import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { APEX_DIR } from './constants';
import type { ResolvedPaths } from './types';

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

export async function resolveOpenClawPaths(): Promise<ResolvedPaths> {
  let configPath: string;
  let stateDir: string;

  if (process.env.OPENCLAW_CONFIG_PATH) {
    configPath = process.env.OPENCLAW_CONFIG_PATH;
    stateDir = path.dirname(configPath);
  } else if (process.env.OPENCLAW_STATE_DIR) {
    stateDir = process.env.OPENCLAW_STATE_DIR;
    configPath = path.join(stateDir, 'openclaw.json');
  } else {
    stateDir = path.join(os.homedir(), '.openclaw');
    configPath = path.join(stateDir, 'openclaw.json');
  }
  // Migrate legacy state directory (oh-my-openclaw -> apex)
  const legacyDir = path.join(stateDir, 'oh-my-openclaw');
  const newDir = path.join(stateDir, APEX_DIR);
  if ((await pathExists(legacyDir)) && !(await pathExists(newDir))) {
    await fs.rename(legacyDir, newDir);
  }

  const workspaceDir = path.join(stateDir, 'workspace');
  const presetsDir = path.join(stateDir, APEX_DIR, 'presets');
  const backupsDir = path.join(stateDir, APEX_DIR, 'backups');

  await fs.mkdir(presetsDir, { recursive: true });
  await fs.mkdir(backupsDir, { recursive: true });

  return { configPath, stateDir, workspaceDir, presetsDir, backupsDir };
}
