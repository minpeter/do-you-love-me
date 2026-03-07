const PRESET_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function isValidPresetName(name: string): boolean {
  return PRESET_NAME_PATTERN.test(name);
}

export function assertValidPresetName(name: string): void {
  if (!isValidPresetName(name)) {
    throw new Error(
      `Invalid preset name '${name}'. Only letters, numbers, '_' and '-' are allowed.`
    );
  }
}
