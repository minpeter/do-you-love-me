import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

export interface CopySkillsOptions {
  dryRun?: boolean;
  force?: boolean;
  targetBaseDir?: string;
}

const SKILL_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

function isErrnoCode(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  return (error as { code?: unknown }).code === code;
}

function validateSkillName(name: string): void {
  if (name === '.' || name === '..' || !SKILL_NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid skill name '${name}'. Use only letters, numbers, dot, underscore, and hyphen.`
    );
  }
}

function isYes(input: string): boolean {
  return input.trim().toLowerCase() === 'y';
}

export function promptOverwrite(skillName: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      `Skill '${skillName}' already exists. Overwrite? [y/N] `,
      (answer) => {
        rl.close();
        resolve(isYes(answer));
      }
    );
  });
}

function sourceSkillDirExists(sourceDir: string): Promise<boolean> {
  return fs
    .stat(sourceDir)
    .then((stats) => stats.isDirectory())
    .catch((error) => {
      if (isErrnoCode(error, 'ENOENT')) {
        return false;
      }

      throw error;
    });
}

function targetSkillExists(targetDir: string): Promise<boolean> {
  return fs
    .stat(targetDir)
    .then(() => true)
    .catch((error) => {
      if (isErrnoCode(error, 'ENOENT')) {
        return false;
      }

      throw error;
    });
}

function skipExistingSkill(name: string): void {
  console.log(
    `Skipped skill '${name}' (already exists. Use --force to overwrite).`
  );
}

async function shouldCopySkill(
  name: string,
  alreadyExists: boolean,
  forceOverwrite: boolean
): Promise<boolean> {
  if (!(alreadyExists && !forceOverwrite)) {
    return true;
  }

  if (!process.stdin.isTTY) {
    skipExistingSkill(name);
    return false;
  }

  const overwrite = await promptOverwrite(name);
  if (!overwrite) {
    skipExistingSkill(name);
    return false;
  }

  return true;
}

export async function copySkills(
  presetDir: string,
  skills: string[],
  options?: CopySkillsOptions
): Promise<string[]> {
  if (skills.length === 0) {
    return [];
  }

  const sourceBaseDir = path.join(presetDir, 'skills');
  const homeDir = process.env.HOME ?? os.homedir();
  const targetBaseDir =
    options?.targetBaseDir ?? path.join(homeDir, '.agents', 'skills');
  const isDryRun = options?.dryRun === true;
  const forceOverwrite = options?.force === true;
  let targetBaseEnsured = false;
  const installed: string[] = [];

  for (const name of skills) {
    validateSkillName(name);

    const srcDir = path.join(sourceBaseDir, name);
    const destDir = path.join(targetBaseDir, name);
    const sourceExists = await sourceSkillDirExists(srcDir);

    if (!sourceExists) {
      throw new Error(`Skill '${name}' not found in preset at ${srcDir}`);
    }

    if (isDryRun) {
      console.log(`Would install skill: ${name}`);
      continue;
    }

    const alreadyExists = await targetSkillExists(destDir);

    const shouldCopy = await shouldCopySkill(
      name,
      alreadyExists,
      forceOverwrite
    );
    if (!shouldCopy) {
      continue;
    }

    if (alreadyExists) {
      await fs.rm(destDir, { recursive: true, force: true });
    }

    if (!targetBaseEnsured) {
      await fs.mkdir(targetBaseDir, { recursive: true });
      targetBaseEnsured = true;
    }

    await fs.cp(srcDir, destDir, { recursive: true });
    console.log(`OK Skill '${name}' installed.`);
    installed.push(name);
  }
  return installed;
}
