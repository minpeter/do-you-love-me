import path from 'node:path';
import pc from 'picocolors';
import { resolveOpenClawPaths } from '../core/config-path';
import { isFileNotFoundError, readJson5 } from '../core/json5-utils';
import { migrateLegacyKeys } from '../core/legacy-migration';
import { loadPreset } from '../core/preset-loader';
import { cloneToCache, isGitHubRef, parseGitHubRef } from '../core/remote';
import { filterSensitiveFields } from '../core/sensitive-filter';
import type { PresetManifest } from '../core/types';
import { listWorkspaceFiles, resolveWorkspaceDir } from '../core/workspace';
import { getBuiltinPresets } from '../presets/index';

interface DiffOptions {
  json?: boolean;
  verbose?: boolean;
}

interface DiffEntry {
  currentValue?: unknown;
  path: string;
  presetValue?: unknown;
  type: 'added' | 'changed' | 'removed';
}

function logVerbose(
  enabled: boolean,
  message: string,
  options: { jsonOutput: boolean }
): void {
  if (!enabled) {
    return;
  }

  const text = pc.dim(`[verbose] ${message}`);
  if (options.jsonOutput) {
    console.error(text);
    return;
  }

  console.log(text);
}

function isPresetNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.startsWith('Preset not found:')
  );
}

async function resolvePresetForDiff(
  presetName: string,
  presetsDir: string
): Promise<PresetManifest> {
  if (isGitHubRef(presetName)) {
    const { owner, repo } = parseGitHubRef(presetName);
    const cachePath = await cloneToCache(owner, repo, presetsDir);
    console.log(pc.green(`Remote preset '${owner}/${repo}' ready.`));
    return await loadPreset(cachePath);
  }

  const userPresetPath = path.join(presetsDir, presetName);
  try {
    return await loadPreset(userPresetPath);
  } catch (error) {
    if (!isPresetNotFoundError(error)) {
      throw error;
    }
  }

  const builtin = (await getBuiltinPresets()).find(
    (p) => p.name === presetName
  );
  if (!builtin) {
    throw new Error(
      `Preset '${presetName}' not found. Run 'apex list' to see available presets.`
    );
  }

  return builtin;
}

async function loadCurrentConfigForDiff(
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

// Recursively compute diff between current and preset config
function computeDiff(
  current: Record<string, unknown>,
  preset: Record<string, unknown>,
  prefix = ''
): DiffEntry[] {
  const entries: DiffEntry[] = [];
  const allKeys = new Set([...Object.keys(current), ...Object.keys(preset)]);

  for (const key of allKeys) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const currentVal = current[key];
    const presetVal = preset[key];

    if (!(key in preset)) {
      // Key only in current — not changed by preset (skip)
      continue;
    }

    if (!(key in current)) {
      // Key only in preset — would be added
      entries.push({ path: fullPath, type: 'added', presetValue: presetVal });
      continue;
    }

    if (presetVal === null) {
      // Null in preset means delete
      entries.push({
        path: fullPath,
        type: 'removed',
        currentValue: currentVal,
      });
      continue;
    }

    if (
      typeof currentVal === 'object' &&
      currentVal !== null &&
      !Array.isArray(currentVal) &&
      typeof presetVal === 'object' &&
      presetVal !== null &&
      !Array.isArray(presetVal)
    ) {
      // Both objects — recurse
      entries.push(
        ...computeDiff(
          currentVal as Record<string, unknown>,
          presetVal as Record<string, unknown>,
          fullPath
        )
      );
    } else if (JSON.stringify(currentVal) !== JSON.stringify(presetVal)) {
      entries.push({
        path: fullPath,
        type: 'changed',
        currentValue: currentVal,
        presetValue: presetVal,
      });
    }
  }

  return entries;
}

export async function diffCommand(
  presetName: string,
  options: DiffOptions = {}
): Promise<void> {
  const verbose = Boolean(options.verbose);
  const jsonOutput = Boolean(options.json);

  const paths = await resolveOpenClawPaths();
  logVerbose(
    verbose,
    `Resolved paths: config=${paths.configPath}, presets=${paths.presetsDir}, state=${paths.stateDir}`,
    { jsonOutput }
  );

  logVerbose(verbose, `Resolving preset '${presetName}'`, { jsonOutput });
  const preset = await resolvePresetForDiff(presetName, paths.presetsDir);
  logVerbose(verbose, `Loaded preset '${preset.name}'`, { jsonOutput });
  const currentConfig = await loadCurrentConfigForDiff(paths.configPath);

  const rawPresetConfig = (preset.config ?? {}) as Record<string, unknown>;
  const filteredPresetConfig = filterSensitiveFields(rawPresetConfig);
  const filteredCurrentConfig = filterSensitiveFields(currentConfig);
  const { config: presetConfig } = migrateLegacyKeys(filteredPresetConfig);
  const { config: normalizedCurrent } = migrateLegacyKeys(
    filteredCurrentConfig
  );
  const configDiff = computeDiff(normalizedCurrent, presetConfig);
  logVerbose(
    verbose,
    `Computed config diff with ${configDiff.length} change(s)`,
    { jsonOutput }
  );

  // Workspace diff
  const workspaceDir = resolveWorkspaceDir(currentConfig, paths.stateDir);
  logVerbose(verbose, `Workspace directory resolved to ${workspaceDir}`, {
    jsonOutput,
  });
  const currentWsFiles = await listWorkspaceFiles(workspaceDir);
  const presetWsFiles = preset.workspaceFiles ?? [];
  const wsFilesToAdd = presetWsFiles.filter((f) => !currentWsFiles.includes(f));
  const wsFilesToReplace = presetWsFiles.filter((f) =>
    currentWsFiles.includes(f)
  );
  logVerbose(
    verbose,
    `Workspace diff: add=${wsFilesToAdd.length}, replace=${wsFilesToReplace.length}`,
    { jsonOutput }
  );

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          preset: presetName,
          changes: configDiff,
          workspaceFiles: { toAdd: wsFilesToAdd, toReplace: wsFilesToReplace },
        },
        null,
        2
      )
    );
    return;
  }

  if (
    configDiff.length === 0 &&
    wsFilesToAdd.length === 0 &&
    wsFilesToReplace.length === 0
  ) {
    console.log(pc.green('✓ No differences — current config matches preset.'));
    return;
  }

  console.log(pc.bold(`Diff: current config vs '${presetName}' preset\n`));

  for (const entry of configDiff) {
    if (entry.type === 'added') {
      console.log(
        pc.green(`  + ${entry.path}: ${JSON.stringify(entry.presetValue)}`)
      );
    } else if (entry.type === 'removed') {
      console.log(
        pc.red(`  - ${entry.path}: ${JSON.stringify(entry.currentValue)}`)
      );
    } else {
      console.log(
        pc.yellow(
          `  ~ ${entry.path}: ${JSON.stringify(entry.currentValue)} → ${JSON.stringify(entry.presetValue)}`
        )
      );
    }
  }

  if (wsFilesToAdd.length > 0) {
    console.log(
      pc.green(`\n  + Workspace files to add: ${wsFilesToAdd.join(', ')}`)
    );
  }
  if (wsFilesToReplace.length > 0) {
    console.log(
      pc.yellow(
        `  ~ Workspace files to replace: ${wsFilesToReplace.join(', ')}`
      )
    );
  }
}
