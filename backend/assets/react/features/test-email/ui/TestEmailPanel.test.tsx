import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {fakeApi} from '@/shared/test/fakeApi';
import {TestEmailPanel} from './TestEmailPanel';

const open = (defaultTo = 'admin@example.com') =>
  render(<TestEmailPanel defaultTo={defaultTo} onClose={() => undefined} />);

describe('TestEmailPanel', () => {
  it('prefills the address and shows the host it was sent through, inline', async () => {
    const api = fakeApi({
      'POST /settings/email/test': [
        202,
        {queued: true, host: 'smtp.example.com'},
      ],
    });
    open();

    expect(screen.getByLabelText('Send to')).toHaveValue('admin@example.com');
    await userEvent.click(screen.getByRole('button', {name: 'Send'}));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Sent through smtp.example.com',
    );
    expect(api.calls[0]?.body).toEqual({to: 'admin@example.com'});
  });

  it('shows the server’s own reason when the send fails, and the panel stays open', async () => {
    fakeApi({
      'POST /settings/email/test': [
        502,
        {
          error: 'smtp_failed',
          message: 'SMTP failed',
          detail: {reason: 'Connection to "nowhere.invalid:25" refused'},
        },
      ],
    });
    open();

    await userEvent.click(screen.getByRole('button', {name: 'Send'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The server refused it: Connection to "nowhere.invalid:25" refused',
    );
    expect(screen.getByRole('button', {name: 'Send'})).toBeEnabled();
  });

  it('says to wait when asked again within ten seconds', async () => {
    fakeApi({
      'POST /settings/email/test': [
        429,
        {error: 'test_email_too_soon', message: 'Too soon'},
      ],
    });
    open();

    await userEvent.click(screen.getByRole('button', {name: 'Send'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Wait a few seconds before sending another test email.',
    );
  });

  it('shows the API’s message on the address it refuses (422)', async () => {
    fakeApi({
      'POST /settings/email/test': [
        422,
        {
          error: 'validation_failed',
          violations: [{field: 'from_address', message: 'Set a sender first.'}],
        },
      ],
    });
    open();

    await userEvent.click(screen.getByRole('button', {name: 'Send'}));

    expect(await screen.findByText('Set a sender first.')).toBeInTheDocument();
  });

  it('does not call the API for an address that is not one', async () => {
    const api = fakeApi({});
    open('nope');

    await userEvent.click(screen.getByRole('button', {name: 'Send'}));

    expect(
      screen.getByText('Enter a valid email address.'),
    ).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });
});
