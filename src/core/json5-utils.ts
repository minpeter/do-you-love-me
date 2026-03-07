import fs from 'node:fs/promises';
import JSON5 from 'json5';

import type { ConfigSnapshot } from './types';

function ensureObjectRoot(
  parsed: unknown,
  errorMessage: string
): Record<string, unknown> {
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error(errorMessage);
  }

  return parsed as Record<string, unknown>;
}

function extractErrnoCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const maybeCode = (error as { code?: unknown }).code;
  if (typeof maybeCode === 'string') {
    return maybeCode;
  }

  return undefined;
}

export function isFileNotFoundError(error: unknown): boolean {
  if (extractErrnoCode(error) === 'ENOENT') {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return extractErrnoCode(error.cause) === 'ENOENT';
}

export async function readJson5(filePath: string): Promise<ConfigSnapshot> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Cannot read file: ${filePath}`, { cause: error });
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return { raw, parsed: {}, path: filePath };
  }

  let parsed: unknown;
  try {
    parsed = JSON5.parse(trimmed);
  } catch (err) {
    throw new Error(
      `Invalid JSON5 in ${filePath}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return {
    raw,
    parsed: ensureObjectRoot(
      parsed,
      `Invalid JSON5 in ${filePath}: root value must be an object`
    ),
    path: filePath,
  };
}

export async function writeJson5(
  filePath: string,
  data: Record<string, unknown>
): Promise<void> {
  // Write standard JSON (valid JSON5 subset) to ensure compatibility
  // with openclaw gateway which may not handle unquoted keys
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Strip JSON5 string literals so comment markers inside strings are ignored.
 */
const JSON5_STRING_RE = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g;

function stripJson5Strings(content: string): string {
  return content.replace(JSON5_STRING_RE, '""');
}

/**
 * Detect JSON5 comments (// or /* ... *​/) outside of string literals.
 */
export function hasJson5Comments(content: string): boolean {
  const stripped = stripJson5Strings(content);
  return stripped.includes('//') || stripped.includes('/*');
}

export function parseJson5(content: string): Record<string, unknown> {
  if (content.trim() === '') {
    return {};
  }

  const parsed = JSON5.parse(content);
  return ensureObjectRoot(
    parsed,
    'Invalid JSON5 content: root value must be an object'
  );
}

export function stringifyJson5(data: Record<string, unknown>): string {
  return JSON5.stringify(data, null, 2);
}
