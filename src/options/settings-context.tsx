import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import type { SaveSettingsResult } from '../shared/protocol';
import type { Settings } from '../shared/types';
import { useAsk } from './options-context';

interface SettingsApi {
  settings: Settings;
  /** Saves the patch in the worker. The page shows the new values at once and goes back if the worker refuses. */
  save(patch: Partial<Settings>): Promise<SaveSettingsResult>;
  /** Loads the settings from the worker again, after another part of the page changed them. */
  refresh(): Promise<void>;
}

const SettingsContext = createContext<SettingsApi | undefined>(undefined);

/** Loads the settings from the worker. It renders its children when they are loaded. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const ask = useAsk();
  const [settings, setSettings] = useState<Settings>();

  useEffect(() => {
    ask('settings/get', null).then(setSettings).catch(console.error);
  }, [ask]);

  const save = useCallback(
    async (patch: Partial<Settings>) => {
      setSettings((current) => current && { ...current, ...patch });
      const result = await ask('settings/save', patch);
      setSettings(result.ok ? result.settings : await ask('settings/get', null));
      return result;
    },
    [ask],
  );

  const refresh = useCallback(async () => setSettings(await ask('settings/get', null)), [ask]);

  if (!settings) return null;
  return <SettingsContext value={{ settings, save, refresh }}>{children}</SettingsContext>;
}

export function useSettings(): SettingsApi {
  const api = useContext(SettingsContext);
  if (!api) throw new Error('useSettings needs a SettingsProvider above it');
  return api;
}
