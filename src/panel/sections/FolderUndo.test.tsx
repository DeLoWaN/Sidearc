import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { startWorker } from '../../../tests/support/worker';
import type { ItemRecord } from '../../shared/types';
import { App } from '../App';
import { connectToWorker } from '../connection';
import { PanelContext } from '../panel-context';
import { resetPanelStore } from '../store';
import { resetPanelUi } from '../ui-store';

/** A Folder "Work" that holds a collapsed Folder "Projects" with a Pinned Tab, and two more Pinned Tabs. */
const records: ItemRecord[] = [
  {
    id: 'work',
    kind: 'folder',
    title: 'Work',
    url: '',
    parentId: null,
    position: 0,
    collapsed: false,
  },
  {
    id: 'projects',
    kind: 'folder',
    title: 'Projects',
    url: '',
    parentId: 'work',
    position: 0,
    collapsed: true,
  },
  {
    id: 'wiki',
    kind: 'pinned',
    title: 'Wiki',
    url: 'https://wiki.test/',
    parentId: 'projects',
    position: 0,
    collapsed: false,
  },
  {
    id: 'mail',
    kind: 'pinned',
    title: 'Mail',
    url: 'https://mail.test/',
    parentId: 'work',
    position: 1,
    collapsed: false,
  },
  {
    id: 'chat',
    kind: 'pinned',
    title: 'Chat',
    url: 'https://chat.test/',
    parentId: 'work',
    position: 2,
    collapsed: false,
  },
  {
    id: 'home',
    kind: 'pinned',
    title: 'Home',
    url: 'https://home.test/',
    parentId: null,
    position: 1,
    collapsed: false,
  },
];

const stored = async () => (await browser.storage.local.get('items')).items as ItemRecord[];
const sorted = (items: ItemRecord[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));

beforeEach(async () => {
  fakeChrome.reset();
  resetPanelStore();
  resetPanelUi();
  await startWorker();
  await browser.storage.local.set({ items: records });
  await fakeChrome.openWindow(['https://start.test/']);
  const connection = await connectToWorker();
  render(
    <PanelContext value={connection}>
      <App />
    </PanelContext>,
  );
  await screen.findByRole('button', { name: 'Work' });
});

async function confirmDelete() {
  const dialog = await screen.findByRole('alertdialog', { name: 'Delete Work?' });
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
}

async function undo() {
  await userEvent.click(
    within(screen.getByRole('contentinfo')).getByRole('button', { name: 'Undo' }),
  );
}

describe('the Undo button after a Folder with nested content is deleted from its row', () => {
  it('brings the Folder back with its ids, its order and its collapsed flags after the cross', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Delete Work' }));
    await confirmDelete();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Work' })).toBeNull());
    expect((await stored()).map((item) => item.id)).toEqual(['home']);

    await undo();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Work' })).toBeVisible());
    expect(sorted(await stored())).toEqual(sorted(records));
  });

  it('brings the Folder back with its ids, its order and its collapsed flags after the middle click', async () => {
    await userEvent.pointer({
      keys: '[MouseMiddle]',
      target: screen.getByRole('button', { name: 'Work' }),
    });
    await confirmDelete();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Work' })).toBeNull());
    expect((await stored()).map((item) => item.id)).toEqual(['home']);

    await undo();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Work' })).toBeVisible());
    expect(sorted(await stored())).toEqual(sorted(records));
  });
});
