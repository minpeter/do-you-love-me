import { SENSITIVE_FIELDS } from './constants';

// Patterns that match common secret/token values regardless of field path
const SECRET_VALUE_PATTERNS = [
  /^[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}$/, // Discord bot token
  /^xoxb-[0-9]+-[0-9]+-[A-Za-z0-9]+$/, // Slack bot token
  /^sk-[A-Za-z0-9]{32,}$/, // OpenAI API key
  /^sk-ant-[A-Za-z0-9_-]{80,}$/, // Anthropic API key
  /^gsk_[A-Za-z0-9]{20,}$/, // Groq API key
  /^xai-[A-Za-z0-9]{20,}$/, // xAI API key
  /^ghp_[A-Za-z0-9]{36}$/, // GitHub personal access token
  /^npm_[A-Za-z0-9]{36}$/, // npm token
  /^eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}$/, // JWT
];

function matchesPattern(path: string[], pattern: string): boolean {
  const patternParts = pattern.split('.');
  const memo = new Map<string, boolean>();

  function match(pathIndex: number, patternIndex: number): boolean {
    const key = `${pathIndex}:${patternIndex}`;
    const cached = memo.get(key);

    if (cached !== undefined) {
      return cached;
    }

    if (patternIndex === patternParts.length) {
      const isMatch = pathIndex === path.length;
      memo.set(key, isMatch);
      return isMatch;
    }

    const patternPart = patternParts[patternIndex];

    if (patternPart === '**') {
      const isMatch =
        match(pathIndex, patternIndex + 1) ||
        (pathIndex < path.length && match(pathIndex + 1, patternIndex));
      memo.set(key, isMatch);
      return isMatch;
    }

    if (pathIndex >= path.length) {
      memo.set(key, false);
      return false;
    }

    if (patternPart === '*' || path[pathIndex] === patternPart) {
      const isMatch = match(pathIndex + 1, patternIndex + 1);
      memo.set(key, isMatch);
      return isMatch;
    }

    memo.set(key, false);
    return false;
  }

  return match(0, 0);
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item));
  }

  return value;
}

export function isSensitivePath(keyPath: string[]): boolean {
  for (const pattern of SENSITIVE_FIELDS) {
    if (matchesPattern(keyPath, pattern)) {
      return true;
    }
  }

  return false;
}

export function looksLikeSecret(value: unknown): boolean {
  if (typeof value !== 'string' || value.length < 20) {
    return false;
  }
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

export function filterSensitiveFields(
  config: Record<string, unknown>,
  keyPath: string[] = []
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    const currentPath = [...keyPath, key];

    if (isSensitivePath(currentPath)) {
      continue;
    }

    if (typeof value === 'string' && looksLikeSecret(value)) {
      continue;
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = filterSensitiveFields(
        value as Record<string, unknown>,
        currentPath
      );
      continue;
    }

    result[key] = cloneValue(value);
  }

  return result;
}
