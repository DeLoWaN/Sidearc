import type { Density, Settings } from './types';

export const DENSITIES: readonly Density[] = ['compact', 'normal', 'spacious'];

export const MIN_ARCHIVE_HOURS = 1;
export const MAX_ARCHIVE_HOURS = 720;

export const DEFAULT_SETTINGS: Settings = {
  autoArchiveHours: 12,
  gradientFrom: '#b9a7f0',
  gradientTo: '#a7c4f0',
  density: 'normal',
};

const COLOUR = /^#[0-9a-f]{6}$/i;

const show = (value: unknown) => JSON.stringify(value) ?? String(value);

/** Checks one value. Returns the clean value, or the error text. */
function checkSetting(
  name: keyof Settings,
  value: unknown,
): { value: unknown } | { error: string } {
  switch (name) {
    case 'autoArchiveHours':
      if (
        Number.isInteger(value) &&
        (value as number) >= MIN_ARCHIVE_HOURS &&
        (value as number) <= MAX_ARCHIVE_HOURS
      )
        return { value };
      return {
        error: `${name} must be a whole number from ${MIN_ARCHIVE_HOURS} to ${MAX_ARCHIVE_HOURS}, got ${show(value)}`,
      };
    case 'gradientFrom':
    case 'gradientTo':
      if (typeof value === 'string' && COLOUR.test(value)) return { value: value.toLowerCase() };
      return { error: `${name} must be a colour like #rrggbb, got ${show(value)}` };
    case 'density':
      if (DENSITIES.includes(value as Density)) return { value };
      return { error: `${name} must be compact, normal or spacious, got ${show(value)}` };
  }
}

/**
 * Checks a patch of settings that comes from outside the worker.
 * Returns the clean patch, or the first error. A colour is saved in lower case.
 */
export function parseSettingsPatch(
  input: unknown,
): { ok: true; patch: Partial<Settings> } | { ok: false; error: string } {
  if (input === null || typeof input !== 'object' || Array.isArray(input))
    return { ok: false, error: 'The settings must be an object' };

  const patch: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(input)) {
    if (!(name in DEFAULT_SETTINGS)) return { ok: false, error: `Unknown setting: ${name}` };
    const checked = checkSetting(name as keyof Settings, value);
    if ('error' in checked) return { ok: false, error: checked.error };
    patch[name] = checked.value;
  }
  return { ok: true, patch: patch as Partial<Settings> };
}

/** Merges stored data over the defaults. A stored value that is not valid gives its default back. */
export function readSettings(stored: unknown): Settings {
  const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  if (stored === null || typeof stored !== 'object') return settings as unknown as Settings;
  for (const [name, value] of Object.entries(stored)) {
    if (!(name in DEFAULT_SETTINGS)) continue;
    // Any positive stored delay stands, so a test can store a few seconds.
    if (name === 'autoArchiveHours' && typeof value === 'number' && value > 0) {
      settings[name] = value;
      continue;
    }
    const checked = checkSetting(name as keyof Settings, value);
    if ('value' in checked) settings[name] = checked.value;
  }
  return settings as unknown as Settings;
}
