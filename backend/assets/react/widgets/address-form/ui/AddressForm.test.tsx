import {useState} from 'react';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {emptyAddress, type AddressValue} from '@/entities/customer';
import type {Country} from '@/entities/location';
import {AddressForm} from './AddressForm';

const LOCATIONS: Country[] = [
  {
    id: 1,
    name: 'Colombia',
    code: 'CO',
    states: [
      {
        id: 10,
        name: 'Antioquia',
        code: 'ANT',
        cities: [{id: 100, name: 'Medellin'}],
      },
    ],
  },
  {
    id: 2,
    name: 'Peru',
    code: 'PE',
    states: [
      {id: 20, name: 'Lima', code: 'LIM', cities: [{id: 200, name: 'Lima'}]},
    ],
  },
];

/** Keeps the addresses the way the form page does, and exposes them so a test can read what would be sent. */
function Harness({initial = [emptyAddress()]}: {initial?: AddressValue[]}) {
  const [addresses, setAddresses] = useState(initial);
  return (
    <>
      <AddressForm
        addresses={addresses}
        locations={LOCATIONS}
        onChange={setAddresses}
      />
      <output data-testid="value">{JSON.stringify(addresses)}</output>
    </>
  );
}

const value = (): AddressValue[] =>
  JSON.parse(screen.getByTestId('value').textContent ?? '[]');

async function pick(label: string, option: string) {
  const input = screen.getByLabelText(label);
  await userEvent.click(input);
  await userEvent.click(
    await screen.findByText(option, {selector: '[class*=option]'}),
  );
}

async function typeNew(label: string, name: string) {
  const input = screen.getByLabelText(label);
  await userEvent.click(input);
  await userEvent.type(input, name);
  await userEvent.click(await screen.findByText(`Create "${name}"`));
}

describe('AddressForm', () => {
  it('offers the states of the chosen country, then the cities of the chosen state', async () => {
    render(<Harness />);

    await userEvent.click(screen.getByLabelText('State'));
    expect(screen.getByText('No options')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    await pick('Country', 'Colombia');
    await userEvent.click(screen.getByLabelText('State'));
    expect(screen.getByText('Antioquia')).toBeInTheDocument();
    expect(screen.queryByText('Lima')).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    await pick('State', 'Antioquia');
    await userEvent.click(screen.getByLabelText('City'));
    expect(screen.getByText('Medellin')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await pick('City', 'Medellin');

    expect(value()[0]).toMatchObject({
      country: {id: 1, name: 'Colombia'},
      state: {id: 10, name: 'Antioquia'},
      city: {id: 100, name: 'Medellin'},
    });
  });

  it('empties the state and the city when the country changes', async () => {
    render(
      <Harness
        initial={[
          {
            ...emptyAddress(),
            country: {id: 1, name: 'Colombia'},
            state: {id: 10, name: 'Antioquia'},
            city: {id: 100, name: 'Medellin'},
          },
        ]}
      />,
    );

    await pick('Country', 'Peru');

    expect(value()[0]).toMatchObject({
      country: {id: 2, name: 'Peru'},
      state: {id: null, name: ''},
      city: {id: null, name: ''},
    });
  });

  it('lets a name that does not exist be typed for each place, with no id', async () => {
    render(<Harness />);

    await typeNew('Country', 'Chile');
    await typeNew('State', 'Maule');
    await typeNew('City', 'Talca');

    expect(value()[0]).toMatchObject({
      country: {id: null, name: 'Chile'},
      state: {id: null, name: 'Maule'},
      city: {id: null, name: 'Talca'},
    });
  });

  it('does not offer to create a name that is already an option', async () => {
    render(<Harness />);

    await userEvent.type(screen.getByLabelText('Country'), 'Peru');

    expect(screen.queryByText('Create "Peru"')).not.toBeInTheDocument();
  });

  it('writes the street and the zip code into the address', async () => {
    render(<Harness />);

    await userEvent.type(screen.getByLabelText('Address'), '1 Main St');
    await userEvent.type(screen.getByLabelText('Zip Code'), '050021');

    expect(value()[0]).toMatchObject({
      address: '1 Main St',
      zip_code: '050021',
    });
  });

  it('adds another address and removes it again, but never the first', async () => {
    render(<Harness />);
    expect(
      screen.queryByRole('button', {name: 'Remove address'}),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Add address'}));
    expect(value()).toHaveLength(2);
    const second = screen.getByRole('group', {name: 'Address 2'});
    await userEvent.type(within(second).getByLabelText('Address'), 'Second');

    await userEvent.click(
      within(second).getByRole('button', {name: 'Remove address'}),
    );

    expect(value()).toHaveLength(1);
    expect(screen.queryByRole('group', {name: 'Address 2'})).toBeNull();
  });

  it('shows each address as a card named by its number and its type', () => {
    render(
      <Harness
        initial={[
          {...emptyAddress(), address_type: 1},
          {...emptyAddress(), address_type: 2},
          emptyAddress(),
        ]}
      />,
    );

    expect(
      screen.getByRole('group', {name: 'Address 1 · Billing'}),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', {name: 'Address 2 · Shipping'}),
    ).toBeInTheDocument();
    // An address without a type is only numbered.
    expect(screen.getByRole('group', {name: 'Address 3'})).toBeInTheDocument();
  });

  it('puts the country, state and city of a card in one row, and "Add address" under the cards', () => {
    render(<Harness initial={[emptyAddress(), emptyAddress()]} />);

    const card = screen.getByRole('group', {name: 'Address 1'});
    const row = within(card).getByLabelText('Country').closest('.form-row')!;
    expect(within(row as HTMLElement).getByLabelText('State')).toBeTruthy();
    expect(within(row as HTMLElement).getByLabelText('City')).toBeTruthy();
    expect(
      screen.getAllByRole('button', {name: 'Add address'}),
      'one button for the whole widget, not one per card',
    ).toHaveLength(1);
    const last = screen.getByRole('group', {name: 'Address 2'});
    expect(
      last.compareDocumentPosition(
        screen.getByRole('button', {name: 'Add address'}),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the button comes after the last card',
    ).toBeTruthy();
  });

  it('styles the selects with the kit (kf-select classes)', async () => {
    render(<Harness />);

    await userEvent.click(screen.getByLabelText('Country'));

    expect(document.querySelector('.kf-select__control')).not.toBeNull();
    expect(document.querySelector('.kf-select__menu')).not.toBeNull();
  });

  it('offers to add the first address when there is none', async () => {
    render(<Harness initial={[]} />);

    await userEvent.click(screen.getByRole('button', {name: /Add address/}));

    expect(value()).toHaveLength(1);
  });

  it('says which of the street and the zip code is missing once asked to', () => {
    render(
      <AddressForm
        addresses={[emptyAddress()]}
        locations={LOCATIONS}
        onChange={() => undefined}
        showErrors
      />,
    );

    expect(screen.getAllByText('This value should not be blank.')).toHaveLength(
      2,
    );
  });
});
