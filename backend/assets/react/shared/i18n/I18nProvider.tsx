import {createContext, useContext, useMemo, type ReactNode} from 'react';
import {translator, type Locale, type Translate} from './i18n';

interface I18n {
  locale: Locale;
  t: Translate;
}

const I18nContext = createContext<I18n | null>(null);

/** The UI language. English only today; a second catalog plugs in here. */
export function I18nProvider({
  locale = 'en',
  children,
}: {
  locale?: Locale;
  children: ReactNode;
}) {
  const value = useMemo(() => ({locale, t: translator(locale)}), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Outside a provider (a component test) it answers in English. */
export function useTranslation(): I18n {
  return useContext(I18nContext) ?? FALLBACK;
}

const FALLBACK: I18n = {locale: 'en', t: translator('en')};
