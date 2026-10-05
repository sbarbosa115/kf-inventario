import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {I18nProvider} from '@/shared/i18n';
import {LanguageSwitch} from './LanguageSwitch';
import {ThemeSwitch} from './ThemeSwitch';
import {WarehouseSwitch} from './WarehouseSwitch';

const THREE = [
  {id: 1, name: 'Colombia'},
  {id: 2, name: 'Usa'},
  {id: 3, name: 'España'},
];

function Warehouses({list = THREE}: {list?: {id: number; name: string}[]}) {
  const [id, setId] = useState<number | null>(1);
  return <WarehouseSwitch warehouses={list} value={id} onChange={setId} />;
}

describe('WarehouseSwitch', () => {
  it('is a segmented control for up to four warehouses, arrows included', async () => {
    render(<Warehouses />);

    const group = screen.getByRole('radiogroup', {name: 'Warehouse'});
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Colombia'})).toBeChecked();
    await userEvent.click(screen.getByRole('radio', {name: 'Usa'}));
    expect(screen.getByRole('radio', {name: 'Usa'})).toBeChecked();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', {name: 'España'})).toBeChecked();
    expect(screen.getByRole('radio', {name: 'España'})).toHaveFocus();
  });

  it('is a select beyond four', async () => {
    render(
      <Warehouses
        list={[...THREE, {id: 4, name: 'Mexico'}, {id: 5, name: 'Peru'}]}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText('Warehouse'), 'Peru');
    expect(screen.getByLabelText('Warehouse')).toHaveValue('5');
  });
});

describe('LanguageSwitch', () => {
  afterEach(() => localStorage.clear());

  it('switches the language and remembers it', async () => {
    render(
      <I18nProvider locale="en">
        <LanguageSwitch />
      </I18nProvider>,
    );

    expect(screen.getByRole('radiogroup', {name: 'Language'})).toBeVisible();
    expect(screen.getByRole('radio', {name: 'English'})).toBeChecked();
    await userEvent.click(screen.getByRole('radio', {name: 'Español'}));
    expect(screen.getByRole('radiogroup', {name: 'Idioma'})).toBeVisible();
    expect(localStorage.getItem('kf.locale')).toBe('es');
  });
});

describe('ThemeSwitch', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('offers Light, Dark and System and remembers the choice', async () => {
    render(<ThemeSwitch />);

    await userEvent.click(screen.getByRole('button', {name: 'Theme: System'}));
    expect(screen.getByRole('menuitemradio', {name: 'System'})).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Dark'}));
    expect(localStorage.getItem('kf.theme')).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('button', {name: 'Theme: Dark'})).toBeVisible();
  });
});
