import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {fakeApi} from '@/shared/test/fakeApi';
import {ToastProvider} from '@/shared/ui';
import {QuickPhrases} from './QuickPhrases';

const PHRASES = [
  {id: 1, text: 'Called the customer', position: 1, active: true},
  {id: 2, text: 'Waiting for payment', position: 2, active: true},
  {id: 3, text: 'Old phrase', position: 3, active: false},
];

const renderTab = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <QuickPhrases />
      </ToastProvider>
    </MemoryRouter>,
  );

const items = () =>
  within(screen.getByRole('list', {name: 'Quick phrases'}))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

describe('Settings › Quick phrases', () => {
  it('lists every phrase (inactive too, asked with ?all=1) and previews the active ones', async () => {
    const api = fakeApi({'GET /settings/quick-phrases': [200, PHRASES]});
    renderTab();

    await screen.findByRole('list', {name: 'Quick phrases'});
    expect(api.calls[0]?.url.search).toBe('?all=1');
    expect(
      screen.getByRole('switch', {name: 'Old phrase is active'}),
    ).not.toBeChecked();
    const preview = screen.getByRole('group', {
      name: 'What the comment box shows',
    });
    expect(
      within(preview).getByText('Waiting for payment'),
    ).toBeInTheDocument();
    expect(within(preview).queryByText('Old phrase')).not.toBeInTheDocument();
  });

  it('adds a phrase with Enter and shows it at the end', async () => {
    const api = fakeApi({
      'GET /settings/quick-phrases': [200, PHRASES],
      'POST /settings/quick-phrases': [
        201,
        {id: 4, text: 'Shipped today', position: 4, active: true},
      ],
    });
    renderTab();

    await userEvent.type(
      await screen.findByLabelText('Add phrase'),
      'Shipped today{Enter}',
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Phrase added.',
    );
    expect(api.calls.find((call) => call.method === 'POST')?.body).toEqual({
      text: 'Shipped today',
      active: true,
    });
    expect(items().at(-1)).toContain('Shipped today');
    expect(screen.getByLabelText('Add phrase')).toHaveValue('');
  });

  it('does not add a blank phrase', async () => {
    const api = fakeApi({'GET /settings/quick-phrases': [200, PHRASES]});
    renderTab();

    await userEvent.type(
      await screen.findByLabelText('Add phrase'),
      '   {Enter}',
    );

    expect(screen.getByText('Write the phrase first.')).toBeInTheDocument();
    expect(api.calls.filter((call) => call.method === 'POST')).toEqual([]);
  });

  it('renames a phrase inline, keeping its active state', async () => {
    const api = fakeApi({
      'GET /settings/quick-phrases': [200, PHRASES],
      'PUT /settings/quick-phrases/2': [
        200,
        {id: 2, text: 'Payment received', position: 2, active: true},
      ],
    });
    renderTab();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Rename Waiting for payment'}),
    );
    const field = screen.getByLabelText('Phrase');
    await userEvent.clear(field);
    await userEvent.type(field, 'Payment received{Enter}');

    await screen.findByRole('status');
    expect(items()[1]).toContain('Payment received');
    expect(api.calls.find((call) => call.method === 'PUT')?.body).toEqual({
      text: 'Payment received',
      active: true,
    });
  });

  it('moves a phrase down: the order is sent for every phrase and the answer is shown', async () => {
    const api = fakeApi({
      'GET /settings/quick-phrases': [200, PHRASES],
      'PUT /settings/quick-phrases/order': [
        200,
        [
          {...PHRASES[1], position: 1},
          {...PHRASES[0], position: 2},
          PHRASES[2],
        ],
      ],
    });
    renderTab();

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Move Called the customer down',
      }),
    );

    await screen.findByRole('status');
    expect(api.calls.find((call) => call.method === 'PUT')?.body).toEqual({
      ids: [2, 1, 3],
    });
    expect(items()[0]).toContain('Waiting for payment');
    expect(
      screen.getByRole('button', {name: 'Move Waiting for payment up'}),
    ).toBeDisabled();
  });

  it('deactivates a phrase with its switch', async () => {
    const api = fakeApi({
      'GET /settings/quick-phrases': [200, PHRASES],
      'PUT /settings/quick-phrases/1': [200, {...PHRASES[0], active: false}],
    });
    renderTab();

    await userEvent.click(
      await screen.findByRole('switch', {
        name: 'Called the customer is active',
      }),
    );

    await screen.findByRole('status');
    expect(api.calls.find((call) => call.method === 'PUT')?.body).toEqual({
      text: 'Called the customer',
      active: false,
    });
    expect(
      screen.getByRole('switch', {name: 'Called the customer is active'}),
    ).not.toBeChecked();
  });

  it('deletes only after confirming', async () => {
    const api = fakeApi({
      'GET /settings/quick-phrases': [200, PHRASES],
      'DELETE /settings/quick-phrases/3': [204],
    });
    renderTab();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Delete Old phrase'}),
    );
    expect(api.calls.filter((call) => call.method === 'DELETE')).toEqual([]);
    const dialog = screen.getByRole('dialog', {name: 'Delete this phrase?'});
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Delete phrase'}),
    );

    await screen.findByRole('status');
    expect(items().join()).not.toContain('Old phrase');
  });
});
