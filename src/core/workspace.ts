import fs from 'node:fs/promises';
import path from 'node:path';
import { WORKSPACE_FILES } from './constants';

const SKILLS_DIRNAME = 'skills';
const SKILL_ENTRY_FILENAME = 'SKILL.md';

function isErrnoCode(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  return (error as { code?: unknown }).code === code;
}

// Reads agents.defaults.workspace from parsed config, falls back to {stateDir}/workspace
export function resolveWorkspaceDir(
  config: Record<string, unknown>,
  stateDir: string
): string {
  const agents = config.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const workspace = defaults?.workspace as string | undefined;
  return workspace ?? path.join(stateDir, 'workspace');
}

// Returns list of existing MD files from WORKSPACE_FILES constant
export async function listWorkspaceFiles(
  workspaceDir: string
): Promise<string[]> {
  const existing: string[] = [];
  for (const filename of WORKSPACE_FILES) {
    const filePath = path.join(workspaceDir, filename);
    try {
      await fs.access(filePath);
      existing.push(filename);
    } catch (error) {
      if (!isErrnoCode(error, 'ENOENT')) {
        throw error;
      }

      // File doesn't exist, skip
    }
  }
  return existing;
}

// Returns list of existing skill directory names from {rootDir}/skills/*/SKILL.md
export async function listWorkspaceSkills(rootDir: string): Promise<string[]> {
  const skillsDir = path.join(rootDir, SKILLS_DIRNAME);
  let entries: Array<{ isDirectory: () => boolean; name: string }>;

  try {
    entries = await fs.readdir(skillsDir, { withFileTypes: true });
  } catch (error) {
    if (!isErrnoCode(error, 'ENOENT')) {
      throw error;
    }

    return [];
  }

  const existing: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillEntry = path.join(skillsDir, entry.name, SKILL_ENTRY_FILENAME);
    let hasSkillEntry = false;
    try {
      await fs.access(skillEntry);
      hasSkillEntry = true;
    } catch (error) {
      if (!isErrnoCode(error, 'ENOENT')) {
        throw error;
      }
    }

    if (hasSkillEntry) {
      existing.push(entry.name);
    }
  }

  return existing.sort();
}

// Returns existing skill entry file paths relative to workspace root
export async function listWorkspaceSkillFiles(
  workspaceDir: string
): Promise<string[]> {
  const skills = await listWorkspaceSkills(workspaceDir);
  return skills.map((skillName) =>
    path.join(SKILLS_DIRNAME, skillName, SKILL_ENTRY_FILENAME)
  );
}

// Copies specified MD files from src to dest directory
export async function copyWorkspaceFiles(
  srcDir: string,
  destDir: string,
  files: string[]
): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  const overwrittenFiles: string[] = [];

  for (const filename of files) {
    const dest = path.join(destDir, filename);
    try {
      await fs.access(dest);
      overwrittenFiles.push(filename);
    } catch (error) {
      if (!isErrnoCode(error, 'ENOENT')) {
        throw error;
      }
    }
  }

  if (overwrittenFiles.length > 0) {
    console.warn(
      `Warning: Overwriting existing workspace files: ${overwrittenFiles.join(', ')}`
    );
  }

  for (const filename of files) {
    const src = path.join(srcDir, filename);
    const dest = path.join(destDir, filename);
    await fs.copyFile(src, dest);
  }
}

export async function copyWorkspaceSkills(
  srcRootDir: string,
  destRootDir: string,
  skills: string[]
): Promise<void> {
  if (skills.length === 0) {
    return;
  }

  const srcSkillsDir = path.join(srcRootDir, SKILLS_DIRNAME);
  const destSkillsDir = path.join(destRootDir, SKILLS_DIRNAME);
  await fs.mkdir(destSkillsDir, { recursive: true });

  for (const skillName of skills) {
    await fs.cp(
      path.join(srcSkillsDir, skillName),
      path.join(destSkillsDir, skillName),
      {
        recursive: true,
        force: true,
      }
    );
  }
}

// Copies current workspace MD files into preset directory, returns list of copied files
export async function exportWorkspaceFiles(
  workspaceDir: string,
  presetDir: string
): Promise<string[]> {
  const existingFiles = await listWorkspaceFiles(workspaceDir);
  if (existingFiles.length > 0) {
    await copyWorkspaceFiles(workspaceDir, presetDir, existingFiles);
  }
  return existingFiles;
}

export async function exportWorkspaceSkills(
  workspaceDir: string,
  presetDir: string
): Promise<string[]> {
  const existingSkills = await listWorkspaceSkills(workspaceDir);
  if (existingSkills.length > 0) {
    await copyWorkspaceSkills(workspaceDir, presetDir, existingSkills);
  }

  return existingSkills;
}
