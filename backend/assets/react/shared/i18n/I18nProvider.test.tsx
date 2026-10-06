import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {I18nProvider, useTranslation} from './I18nProvider';

function Probe() {
  const {t, locale, setLocale} = useTranslation();
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === 'en' ? 'es' : 'en')}
    >
      {t('common.save')}
    </button>
  );
}

describe('I18nProvider', () => {
  afterEach(() => localStorage.clear());

  it('switches the language, remembers it and sets the page language', async () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByRole('button')).toHaveTextContent('Save');
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('Guardar');
    expect(localStorage.getItem('kf.locale')).toBe('es');
    expect(document.documentElement.lang).toBe('es');
  });

  it('starts in the remembered language', () => {
    localStorage.setItem('kf.locale', 'es');
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByRole('button')).toHaveTextContent('Guardar');
  });
});
