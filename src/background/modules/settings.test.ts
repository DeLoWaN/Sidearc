import { beforeEach, expect, it, vi } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { connectPanel, settle, startWorker, stopWorker } from '../../../tests/support/worker';
import type { SettingsRpc } from '../../shared/protocol';

beforeEach(async () => {
  fakeChrome.reset();
  await startWorker();
});

type SaveResult = SettingsRpc['settings/save']['response'];

/** Asks the worker like the options page does. */
const getSettings = () =>
  browser.runtime.sendMessage({ rpc: 'settings/get', request: null }) as Promise<
    SettingsRpc['settings/get']['response']
  >;
const saveSettings = (patch: unknown) =>
  browser.runtime.sendMessage({ rpc: 'settings/save', request: patch }) as Promise<SaveResult>;

it('gives the default settings when nothing is saved', async () => {
  expect(await getSettings()).toEqual({
    autoArchiveHours: 12,
    gradientFrom: '#b9a7f0',
    gradientTo: '#a7c4f0',
    density: 'normal',
  });
});

it('saves the settings of a patch and keeps the others', async () => {
  const result = await saveSettings({ density: 'compact', autoArchiveHours: 48 });

  expect(result).toEqual({
    ok: true,
    settings: {
      autoArchiveHours: 48,
      gradientFrom: '#b9a7f0',
      gradientTo: '#a7c4f0',
      density: 'compact',
    },
  });
  expect(await getSettings()).toEqual((result as { settings: unknown }).settings);
});

it('keeps every setting when two saves arrive at the same time', async () => {
  await Promise.all([
    saveSettings({ gradientFrom: '#111111' }),
    saveSettings({ gradientTo: '#222222' }),
    saveSettings({ density: 'compact' }),
  ]);

  expect(await getSettings()).toMatchObject({
    gradientFrom: '#111111',
    gradientTo: '#222222',
    density: 'compact',
  });
});

it('keeps the saved settings when Chrome stops and restarts the worker', async () => {
  await saveSettings({ gradientFrom: '#112233', gradientTo: '#445566' });

  stopWorker();
  await startWorker();

  expect(await getSettings()).toMatchObject({ gradientFrom: '#112233', gradientTo: '#445566' });
});

it.each([
  [{ autoArchiveHours: 0 }, 'autoArchiveHours must be a whole number from 1 to 720, got 0'],
  [{ autoArchiveHours: 1.5 }, 'autoArchiveHours must be a whole number from 1 to 720, got 1.5'],
  [{ autoArchiveHours: 721 }, 'autoArchiveHours must be a whole number from 1 to 720, got 721'],
  [{ autoArchiveHours: '12' }, 'autoArchiveHours must be a whole number from 1 to 720, got "12"'],
  [{ gradientFrom: 'red' }, 'gradientFrom must be a colour like #rrggbb, got "red"'],
  [{ gradientTo: '#12345' }, 'gradientTo must be a colour like #rrggbb, got "#12345"'],
  [{ density: 'huge' }, 'density must be compact, normal or spacious, got "huge"'],
  [{ volume: 11 }, 'Unknown setting: volume'],
  [null, 'The settings must be an object'],
])('refuses %j with a precise error and saves nothing', async (patch, error) => {
  await saveSettings({ autoArchiveHours: 24 });

  expect(await saveSettings(patch)).toEqual({ ok: false, error });
  expect(await getSettings()).toMatchObject({ autoArchiveHours: 24, density: 'normal' });
});

it('saves nothing when one value of the patch is wrong', async () => {
  const result = await saveSettings({ density: 'compact', autoArchiveHours: 0 });

  expect(result).toMatchObject({ ok: false });
  expect(await getSettings()).toMatchObject({ density: 'normal', autoArchiveHours: 12 });
});

it('accepts a colour in capitals and saves it in lower case', async () => {
  await saveSettings({ gradientFrom: '#AABBCC' });
  expect(await getSettings()).toMatchObject({ gradientFrom: '#aabbcc' });
});

it('ignores a stored setting that is not valid any more', async () => {
  await browser.storage.local.set({ settings: { density: 'huge', autoArchiveHours: 6 } });
  await settle();
  expect(await getSettings()).toMatchObject({ density: 'normal', autoArchiveHours: 6 });
});

it.each([0.5, 0, 721, 1.5])(
  'gives the default delay back when the stored delay is %s hours',
  async (hours) => {
    await browser.storage.local.set({ settings: { autoArchiveHours: hours, density: 'compact' } });

    expect(await getSettings()).toMatchObject({ autoArchiveHours: 12, density: 'compact' });
  },
);

it('sends the settings to a panel that connects', async () => {
  const window = await fakeChrome.openWindow(['https://a.test/']);
  const panel = connectPanel(window);
  await settle();

  expect(panel.latest()?.settings).toEqual(await getSettings());
});

it('sends the new settings to every open panel at once', async () => {
  const first = await fakeChrome.openWindow(['https://a.test/']);
  const second = await fakeChrome.openWindow(['https://b.test/']);
  const panels = [connectPanel(first), connectPanel(second)];
  await settle();

  await saveSettings({ density: 'spacious', gradientTo: '#102030' });
  await settle();

  for (const panel of panels)
    expect(panel.latest()?.settings).toMatchObject({ density: 'spacious', gradientTo: '#102030' });
});

it('sends nothing new to the panels when the settings are refused', async () => {
  const window = await fakeChrome.openWindow(['https://a.test/']);
  const panel = connectPanel(window);
  await settle();
  const before = panel.states.length;

  await saveSettings({ density: 'huge' });
  await settle();

  expect(panel.states).toHaveLength(before);
});

it('opens the options page when the panel asks for it', async () => {
  const open = vi.spyOn(browser.runtime, 'openOptionsPage').mockResolvedValue();
  const window = await fakeChrome.openWindow(['https://a.test/']);
  const panel = connectPanel(window);

  panel.send({ type: 'options/open' });
  await settle();

  expect(open).toHaveBeenCalledOnce();
});
