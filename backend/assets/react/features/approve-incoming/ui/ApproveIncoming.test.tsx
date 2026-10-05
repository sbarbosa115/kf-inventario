import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {vi} from 'vitest';
import {fakeApi} from '@/shared/test/fakeApi';
import {ToastProvider} from '@/shared/ui';
import {ApproveIncomingButton} from './ApproveIncomingButton';

const USA = {id: 2, name: 'Usa'};

function row(code: string, quantity: number) {
  return {
    id: quantity,
    status: 0,
    quantity,
    product_id: quantity,
    uuid: `uuid-${code}`,
    code,
    title: `Title ${code}`,
    detail: null,
    price: 10,
    warehouse: USA,
  };
}

function renderButton(rows = [row('KF-01', 5), row('KF-02', 3)]) {
  const onApproved = vi.fn();
  render(
    <MemoryRouter>
      <ToastProvider>
        <ApproveIncomingButton
          warehouse={USA}
          rows={rows}
          onApproved={onApproved}
        />
      </ToastProvider>
    </MemoryRouter>,
  );
  return onApproved;
}

describe('ApproveIncomingButton', () => {
  it('says in its label how many products wait', () => {
    fakeApi({});
    renderButton();
    expect(
      screen.getByRole('button', {name: 'Approve all (2)'}),
    ).toBeEnabled();
  });

  it('is disabled with nothing incoming', () => {
    fakeApi({});
    renderButton([]);
    expect(
      screen.getByRole('button', {name: 'Approve all (0)'}),
    ).toBeDisabled();
  });

  it('asks first, naming the products, the units and the warehouse; Cancel sends nothing', async () => {
    const api = fakeApi({});
    const onApproved = renderButton();

    await userEvent.click(screen.getByRole('button', {name: 'Approve all (2)'}));
    const dialog = screen.getByRole('dialog', {
      name: 'Approve everything incoming?',
    });
    expect(dialog).toHaveTextContent(
      "Approve 2 products, 8 units, into Usa's stock?",
    );
    await userEvent.click(within(dialog).getByRole('button', {name: 'Cancel'}));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.calls, 'nothing is approved without the confirmation').toEqual(
      [],
    );
    expect(onApproved).not.toHaveBeenCalled();
  });

  it('approves once confirmed and says how many the API approved', async () => {
    const api = fakeApi({
      'POST /warehouses/2/incoming/approve': [200, {approved: 2}],
    });
    const onApproved = renderButton();

    await userEvent.click(screen.getByRole('button', {name: 'Approve all (2)'}));
    await userEvent.click(
      screen.getByRole('button', {name: 'Approve 2 products'}),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      '2 incoming products were approved.',
    );
    expect(onApproved).toHaveBeenCalledWith(2);
    expect(api.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says so when the warehouse no longer exists', async () => {
    fakeApi({
      'POST /warehouses/2/incoming/approve': [
        404,
        {error: 'warehouse_not_found'},
      ],
    });
    const onApproved = renderButton();

    await userEvent.click(screen.getByRole('button', {name: 'Approve all (2)'}));
    await userEvent.click(
      screen.getByRole('button', {name: 'Approve 2 products'}),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This warehouse no longer exists.',
    );
    expect(onApproved).not.toHaveBeenCalled();
  });
});
