import fs from 'node:fs/promises';
import path from 'node:path';
import pc from 'picocolors';

import { resolveOpenClawPaths } from '../core/config-path';
import { isFileNotFoundError, readJson5 } from '../core/json5-utils';
import { savePreset } from '../core/preset-loader';
import { assertValidPresetName } from '../core/preset-name';
import { filterSensitiveFields } from '../core/sensitive-filter';
import type { PresetManifest } from '../core/types';
import { exportWorkspaceFiles, resolveWorkspaceDir } from '../core/workspace';

interface ExportOptions {
  description?: string;
  force?: boolean;
  verbose?: boolean;
  version?: string;
}

function logVerbose(enabled: boolean, message: string): void {
  if (!enabled) {
    return;
  }

  console.log(pc.dim(`[verbose] ${message}`));
}

export async function exportCommand(
  name: string,
  options: ExportOptions = {}
): Promise<void> {
  assertValidPresetName(name);
  const verbose = Boolean(options.verbose);
  const paths = await resolveOpenClawPaths();
  logVerbose(
    verbose,
    `Resolved paths: config=${paths.configPath}, presets=${paths.presetsDir}, state=${paths.stateDir}`
  );

  // Check if preset already exists
  const presetDir = path.join(paths.presetsDir, name);
  logVerbose(verbose, `Checking if preset directory exists: ${presetDir}`);
  try {
    await fs.access(presetDir);
    if (!options.force) {
      throw new Error(
        `Preset '${name}' already exists. Use --force to overwrite.`
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('already exists')) {
      throw err;
    }
    // Preset doesn't exist, that's fine
  }

  // Read current config
  let currentConfig: Record<string, unknown> = {};
  try {
    logVerbose(verbose, `Reading config from ${paths.configPath}`);
    const snapshot = await readJson5(paths.configPath);
    currentConfig = snapshot.parsed;
  } catch (err) {
    if (isFileNotFoundError(err)) {
      console.log(
        pc.yellow('⚠ No OpenClaw config found. Exporting empty config.')
      );
    } else {
      throw err;
    }
  }

  // Filter sensitive fields
  const filteredConfig = filterSensitiveFields(currentConfig);
  logVerbose(
    verbose,
    `Filtered config keys: before=${Object.keys(currentConfig).length}, after=${Object.keys(filteredConfig).length}`
  );

  // Resolve workspace dir
  const workspaceDir = resolveWorkspaceDir(currentConfig, paths.stateDir);
  logVerbose(verbose, `Workspace directory resolved to ${workspaceDir}`);

  // Build manifest
  const manifest: PresetManifest = {
    name,
    description:
      options.description ??
      `Exported from OpenClaw on ${new Date().toISOString().split('T')[0]}`,
    version: options.version ?? '1.0.0',
    config: filteredConfig,
    workspaceFiles: [],
  };

  logVerbose(verbose, `Ensuring preset directory exists: ${presetDir}`);
  await fs.mkdir(presetDir, { recursive: true });

  // Copy workspace MD files
  logVerbose(verbose, `Exporting workspace files from ${workspaceDir}`);
  const copiedFiles = await exportWorkspaceFiles(workspaceDir, presetDir);
  manifest.workspaceFiles = copiedFiles;
  logVerbose(verbose, `Copied ${copiedFiles.length} workspace file(s)`);

  logVerbose(
    verbose,
    `Writing preset manifest to ${path.join(presetDir, 'preset.json5')}`
  );
  await savePreset(presetDir, manifest);

  console.log(pc.green(`\n✓ Preset '${name}' exported to: ${presetDir}`));
  if (copiedFiles.length > 0) {
    console.log(`  Workspace files: ${copiedFiles.join(', ')}`);
  }
  if (Object.keys(filteredConfig).length < Object.keys(currentConfig).length) {
    console.log(
      pc.dim('  Note: Sensitive fields (auth, env, meta, etc.) were excluded.')
    );
  }
}
