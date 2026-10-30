import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { renderPanel } from '../../../tests/support/render-panel';
import { FooterBar } from './FooterBar';

it('asks the worker to open the options page from the Options button', async () => {
  const { send } = renderPanel(<FooterBar />);

  await userEvent.click(screen.getByRole('button', { name: 'Options' }));

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'options/open' });
});
