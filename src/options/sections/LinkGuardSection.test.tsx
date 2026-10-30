import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeChrome } from '../../../tests/support/fake-chrome';
import { LINK_GUARD_ORIGINS } from '../../link-guard/origins';
import { LinkGuardSection } from './LinkGuardSection';

beforeEach(() => fakeChrome.reset());

const toggle = () =>
  screen.getByRole('checkbox', { name: 'Open links to other sites in a new tab' });

it('is off until the user grants the access on the Chrome prompt', async () => {
  render(<LinkGuardSection />);
  expect(toggle()).not.toBeChecked();

  await userEvent.click(toggle());

  await waitFor(() => expect(toggle()).toBeChecked());
  expect(fakeChrome.grantedOrigins).toEqual(LINK_GUARD_ORIGINS);
});

it('stays off when the user declines the Chrome prompt', async () => {
  fakeChrome.grantsRequests = false;
  render(<LinkGuardSection />);

  await userEvent.click(toggle());

  await waitFor(() => expect(toggle()).not.toBeChecked());
  expect(fakeChrome.grantedOrigins).toEqual([]);
});

it('removes the access when the user turns it off', async () => {
  fakeChrome.grantedOrigins = [...LINK_GUARD_ORIGINS];
  render(<LinkGuardSection />);
  await waitFor(() => expect(toggle()).toBeChecked());

  await userEvent.click(toggle());

  await waitFor(() => expect(toggle()).not.toBeChecked());
  expect(fakeChrome.grantedOrigins).toEqual([]);
});

it('follows a change that the user makes in the Chrome settings', async () => {
  render(<LinkGuardSection />);

  await fakeChrome.grantOrigins(LINK_GUARD_ORIGINS);
  await waitFor(() => expect(toggle()).toBeChecked());

  await fakeChrome.removeOrigins(LINK_GUARD_ORIGINS);
  await waitFor(() => expect(toggle()).not.toBeChecked());
});

it('shows why Chrome refused the change', async () => {
  vi.spyOn(browser.permissions, 'request').mockRejectedValue(new Error('Permission denied'));
  render(<LinkGuardSection />);

  await userEvent.click(toggle());

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Chrome refused the change: Permission denied',
  );
  expect(toggle()).not.toBeChecked();
});
