import { describe, expect, test } from 'bun:test';

import { assertValidPresetName, isValidPresetName } from '../preset-name';

describe('preset name validation', () => {
  test('accepts names with letters, numbers, underscores, and hyphens', () => {
    expect(isValidPresetName('apex')).toBe(true);
    expect(isValidPresetName('apex_2')).toBe(true);
    expect(isValidPresetName('apex-2')).toBe(true);
    expect(isValidPresetName('Apex_2026')).toBe(true);
  });

  test('rejects empty names and names with invalid characters', () => {
    expect(isValidPresetName('')).toBe(false);
    expect(isValidPresetName('bad$name')).toBe(false);
    expect(isValidPresetName('bad name')).toBe(false);
    expect(isValidPresetName('bad/name')).toBe(false);
    expect(isValidPresetName('../bad')).toBe(false);
  });

  test('throws an actionable error for invalid names', () => {
    expect(() => assertValidPresetName('bad/name')).toThrow(
      "Invalid preset name 'bad/name'. Only letters, numbers, '_' and '-' are allowed."
    );
  });
});
