import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { type Ask, OptionsContext } from '../../src/options/options-context';
import type { SaveSettingsResult } from '../../src/shared/protocol';
import { DEFAULT_SETTINGS } from '../../src/shared/settings';
import type { Settings } from '../../src/shared/types';

/**
 * Renders an options page component with a fake worker.
 * The worker keeps the settings in memory and answers `settings/save` like the real one,
 * unless `refuse` gives an error text: then it refuses every save with that text.
 * `answers` gives the reply of the fake worker by request name. It comes before the built-in replies.
 * Returns the `ask` mock, so a test can check which request the page sends.
 */
export function renderOptions(
  ui: ReactElement,
  {
    settings = DEFAULT_SETTINGS,
    refuse,
    answers = {},
  }: {
    settings?: Settings;
    refuse?: string;
    answers?: Record<string, (request: unknown) => unknown>;
  } = {},
) {
  let current = settings;
  const ask = vi.fn(async (rpc: string, request: unknown) => {
    if (rpc in answers) return (answers[rpc] as (request: unknown) => unknown)(request);
    if (rpc === 'settings/get') return current;
    if (rpc === 'settings/save') {
      if (refuse) return { ok: false, error: refuse } satisfies SaveSettingsResult;
      current = { ...current, ...(request as Partial<Settings>) };
      return { ok: true, settings: current } satisfies SaveSettingsResult;
    }
    throw new Error(`Unexpected request: ${rpc}`);
  });
  render(<OptionsContext value={ask as unknown as Ask}>{ui}</OptionsContext>);
  return { ask };
}
