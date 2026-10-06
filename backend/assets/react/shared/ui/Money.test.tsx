import {render, screen} from '@testing-library/react';
import {I18nProvider} from '@/shared/i18n';
import {Money, Num} from './Money';

const plain = (text: string | null) =>
  (text ?? '').replace(/[\u00a0\u202f]/g, ' ');

describe('Money and Num', () => {
  it('write the amount in the current language, tabular', () => {
    render(
      <I18nProvider locale="es">
        <Money amount="1250.5" />
        <Num value={12345} />
      </I18nProvider>,
    );

    expect(plain(screen.getByText(/US\$/).textContent)).toBe('US$ 1.250,50');
    expect(screen.getByText(/US\$/)).toHaveClass('kf-num');
    expect(plain(screen.getByText(/12/).textContent)).toBe('12.345');
  });

  it('marks a negative amount', () => {
    render(<Money amount={-2} />);

    expect(screen.getByText('-$2.00')).toHaveClass('kf-num--negative');
  });
});
